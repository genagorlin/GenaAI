import { storage } from "./storage";
import { normalize } from "./wikiIngestion";

// ============================================================================
// QUOTE GUARD
// ----------------------------------------------------------------------------
// Last-resort safety net against fabricated quotes. After the model produces a
// reply, we check every sentence-length quoted passage against the FULL corpus
// of Gena's real text (all reference documents, including the book). Any quote
// that does not appear verbatim (after typography normalization) has its
// quotation marks stripped, so the user never sees invented text presented as a
// verbatim quote. The concept attribution remains; only the false "these are her
// exact words" signal is removed.
//
// Prompt instructions alone proved insufficient — this is deterministic.
// ============================================================================

let corpusCache: { text: string; at: number } | null = null;
const CORPUS_TTL_MS = 5 * 60 * 1000;

async function getGenaCorpus(): Promise<string> {
  if (corpusCache && Date.now() - corpusCache.at < CORPUS_TTL_MS) return corpusCache.text;
  // All reference documents = Gena's real text: the book (wiki-source) + essays.
  const docs = await storage.getAllReferenceDocuments();
  const joined = docs.map((d) => d.content || "").join("\n\n");
  const text = normalize(joined);
  corpusCache = { text, at: Date.now() };
  return text;
}

// Sentence-length double-quoted spans (curly or straight), >= 40 chars. Short
// quoted phrases are left alone (low fabrication risk, high false-positive cost).
const QUOTE_RE = /([“”])([^“”]{40,}?)([“”])|(")([^"]{40,}?)(")/g;

/**
 * Strip quotation marks from any sentence-length quote that does not appear
 * verbatim in Gena's corpus. Returns the sanitized text and how many were
 * neutralized. Fails open (returns original) on any error — never blocks a reply.
 */
export async function sanitizeQuotes(text: string): Promise<{ text: string; neutralized: number }> {
  try {
    if (!text || (!text.includes('"') && !text.includes("“"))) {
      return { text, neutralized: 0 };
    }
    const corpus = await getGenaCorpus();
    if (!corpus) return { text, neutralized: 0 };

    let neutralized = 0;
    const out = text.replace(QUOTE_RE, (full, _oq, curlyInner, _cq, _sq, straightInner) => {
      const inner = (curlyInner ?? straightInner) as string;
      if (corpus.includes(normalize(inner))) return full; // real quote — keep the marks
      neutralized++;
      return inner; // fabricated/unverifiable — drop the quote marks
    });

    if (neutralized > 0) {
      console.log(`[QuoteGuard] neutralized ${neutralized} unverified quote(s)`);
    }
    return { text: out, neutralized };
  } catch (err) {
    console.error("[QuoteGuard] error (failing open):", err);
    return { text, neutralized: 0 };
  }
}
