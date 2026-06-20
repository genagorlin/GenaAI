import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// CHUNKING
// ----------------------------------------------------------------------------
// The book is stored as clean plain text (mammoth extractRawText), so chapter
// markup is gone. We chunk paragraph-aware so excerpts are never cut mid-
// sentence, packing paragraphs into ~targetTokens windows with a small overlap
// for cross-boundary continuity. The reconcile pass (later) merges concepts
// that span chunks.
// ============================================================================

export interface BookChunk {
  index: number;
  text: string;
  tokenEstimate: number;
  startParagraph: number;
  endParagraph: number;
}

const estTokens = (s: string) => Math.ceil(s.length / 4);

export function chunkText(
  text: string,
  opts: { targetTokens?: number; overlapParagraphs?: number } = {}
): BookChunk[] {
  const targetTokens = opts.targetTokens ?? 8000;
  const overlapParagraphs = opts.overlapParagraphs ?? 1;

  // Split into paragraphs on blank lines; keep non-empty, trimmed-right paragraphs.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/, ""))
    .filter((p) => p.trim().length > 0);

  const chunks: BookChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;
  let startPara = 0;

  const flush = (endPara: number) => {
    if (current.length === 0) return;
    const body = current.join("\n\n");
    chunks.push({
      index: chunks.length,
      text: body,
      tokenEstimate: estTokens(body),
      startParagraph: startPara,
      endParagraph: endPara,
    });
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const t = estTokens(para);

    // If adding this paragraph would overflow and we already have content,
    // close the current chunk and start a new one carrying overlap paragraphs.
    if (currentTokens + t > targetTokens && current.length > 0) {
      flush(i - 1);
      const overlap = current.slice(Math.max(0, current.length - overlapParagraphs));
      current = [...overlap];
      currentTokens = overlap.reduce((a, p) => a + estTokens(p), 0);
      startPara = i - overlap.length;
    }

    current.push(para);
    currentTokens += t;
  }
  flush(paragraphs.length - 1);

  return chunks;
}

// ============================================================================
// EXTRACTION (one chunk -> candidate wiki pages)
// ----------------------------------------------------------------------------
// Uses Sonnet (cheaper for the bulk pass). Forces a structured tool call so the
// output is always valid JSON. Every excerpt is meant to be VERBATIM source
// text; validateExcerpts() afterward hard-checks that.
// ============================================================================

export interface CandidatePage {
  slug: string;
  title: string;
  summary: string;
  excerpts: string[];
}

const PROPOSE_TOOL = {
  name: "propose_pages",
  description: "Propose wiki pages extracted from the provided book text.",
  input_schema: {
    type: "object" as const,
    properties: {
      pages: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            slug: { type: "string" as const, description: "URL-safe identifier, lowercase with hyphens, e.g. 'drill-sergeant-mindset'." },
            title: { type: "string" as const, description: "Clear human-readable page title." },
            summary: { type: "string" as const, description: "1-2 sentence summary of the concept, in your own words (NOT a quote)." },
            excerpts: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "One or more passages copied VERBATIM (character-for-character) from the provided text that define or best illustrate this concept.",
            },
          },
          required: ["slug", "title", "summary", "excerpts"],
        },
      },
    },
    required: ["pages"],
  },
};

const EXTRACTION_SYSTEM = `You are building a knowledge wiki from Dr. Gena Gorlin's book draft on the "builder's mindset" and the psychology of ambition. You are given ONE chunk of the book.

Identify the distinct CONCEPTS, DISTINCTIONS, frameworks, and named ideas actually presented in this chunk. For each substantive one, propose a wiki page via the propose_pages tool.

For each page:
- slug: short, URL-safe (lowercase, hyphens), e.g. "rational-ambition".
- title: a clear title.
- summary: 1-2 sentences in YOUR OWN words describing the concept (this is a summary, not a quote).
- excerpts: one or more passages copied VERBATIM from the provided text — character for character, exact punctuation and wording — that define or best illustrate the concept. These are Gena's actual words and will be quoted to users, so they MUST appear EXACTLY in the source text. Copy them straight from the provided text; do NOT retype from memory, paraphrase, fix typos, "clean up" punctuation, or change curly quotes to straight quotes. If you cannot find a verbatim passage for a concept, OMIT that concept rather than inventing a quote.

Rules:
- One page per concept/distinction. Embed illustrative examples as excerpts inside their parent concept's page; do not make separate pages for examples.
- Only propose pages for substantive concepts present in THIS chunk.
- If the chunk is front-matter, a table of contents, or purely transitional, propose zero pages.`;

export async function extractCandidatePages(
  chunkText: string,
  opts: { model?: string } = {}
): Promise<CandidatePage[]> {
  const model = opts.model ?? "claude-sonnet-4-6";
  const anthropic = new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model,
    max_tokens: 8000,
    system: EXTRACTION_SYSTEM,
    tools: [PROPOSE_TOOL],
    tool_choice: { type: "tool", name: "propose_pages" },
    messages: [{ role: "user", content: chunkText }],
  });

  const toolUse = (response.content as any[]).find((b) => b.type === "tool_use");
  const pages = (toolUse?.input?.pages as CandidatePage[]) || [];
  return pages;
}

// ============================================================================
// VERBATIM VALIDATION (hard check)
// ----------------------------------------------------------------------------
// Every excerpt must match the source. We report per-excerpt status so flagged
// (non-verbatim) excerpts can be reviewed/dropped rather than silently quoted as
// Gena's words.
// ============================================================================

export type ExcerptStatus = "exact" | "near" | "missing";

export interface ValidatedExcerpt {
  text: string;
  status: ExcerptStatus;
  // Diagnostics for non-exact excerpts: how many normalized characters matched
  // before diverging, the total normalized length, and the excerpt text around
  // the divergence point. Lets us distinguish "real quote, one odd character"
  // from "genuinely fabricated".
  matchedChars?: number;
  normLength?: number;
  divergence?: string;
}

export interface ValidatedPage {
  slug: string;
  title: string;
  summary: string;
  excerpts: ValidatedExcerpt[];
  excerptCounts: { exact: number; near: number; missing: number };
}

// Normalize away differences that don't change the words: Unicode compatibility
// forms (NFKC handles ligatures, full-width chars, some spaces), invisible
// characters (soft hyphen U+00AD, zero-width U+200B-200D/2060/FEFF), every
// smart-quote / apostrophe / dash / ellipsis variant, and whitespace. Explicit
// \u escapes keep the codepoints unambiguous. Only genuinely altered/fabricated
// text survives this.
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[­​‌‍⁠﻿]/g, "")
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();

// Largest k such that normSource contains needle.slice(0, k). Prefix-substring
// is monotone (a substring's prefix is also a substring), so binary search works.
function longestPrefixMatch(needle: string, normSource: string): number {
  if (!needle) return 0;
  let lo = 1, hi = needle.length, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (normSource.includes(needle.slice(0, mid))) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}

export function validateExcerpts(pages: CandidatePage[], sourceText: string): ValidatedPage[] {
  const normSource = normalize(sourceText);
  return pages.map((p) => {
    const excerpts: ValidatedExcerpt[] = (p.excerpts || []).map((ex) => {
      const nEx = normalize(ex);
      let status: ExcerptStatus;
      if (sourceText.includes(ex)) status = "exact";
      else if (normSource.includes(nEx)) status = "near"; // same words; quotes/dashes/spacing differ
      else status = "missing"; // not found even after normalization -> fabricated/altered

      if (status === "exact") return { text: ex, status };
      const matchedChars = longestPrefixMatch(nEx, normSource);
      return {
        text: ex,
        status,
        matchedChars,
        normLength: nEx.length,
        divergence: nEx.slice(Math.max(0, matchedChars - 15), matchedChars + 20),
      };
    });
    const excerptCounts = {
      exact: excerpts.filter((e) => e.status === "exact").length,
      near: excerpts.filter((e) => e.status === "near").length,
      missing: excerpts.filter((e) => e.status === "missing").length,
    };
    return { slug: p.slug, title: p.title, summary: p.summary, excerpts, excerptCounts };
  });
}
