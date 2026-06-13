import { storage } from "./storage";

// Tool definitions exposed to Claude so it can navigate the framework wiki
// at query time (Karpathy-style "read pages on demand" pattern).
// The index of available pages is injected into the system prompt separately
// (see buildWikiIndexSection); this tool fetches the full content of one page.
export const WIKI_TOOLS = [
  {
    name: "read_wiki_page",
    description:
      "Read the full content of a framework wiki page by its slug. The available pages and their slugs are listed in the 'Framework Wiki Index' section of your system prompt. Call this when a concept is relevant and you need its full detail — especially before quoting Gena's writing, so you quote the actual source text rather than paraphrasing from memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string" as const,
          description: "The slug of the page to read, e.g. 'builder-mindset'.",
        },
      },
      required: ["slug"],
    },
  },
];

// Executes a wiki tool call and returns a string result for the model.
export async function executeWikiTool(
  name: string,
  input: any,
  scope: string = "global"
): Promise<string> {
  if (name === "read_wiki_page") {
    const slug = (input?.slug || "").trim();
    if (!slug) {
      return "Error: no slug provided. Provide the slug of the page you want to read.";
    }
    const page = await storage.getWikiPageBySlug(scope, slug);
    if (!page || page.status !== "approved") {
      const all = await storage.getWikiPages(scope, "approved");
      const available = all.map((p) => p.slug).join(", ") || "(none)";
      return `No approved page found with slug "${slug}". Available slugs: ${available}`;
    }
    return `# ${page.title}\n\n${page.content}`;
  }
  return `Unknown tool: ${name}`;
}

// Builds the wiki index section for the system prompt — a compact catalog of
// every approved page (slug, title, one-line summary) so the model knows what
// it can read. Returns "" when there are no pages, so we never inject an empty
// section or advertise a tool with nothing behind it.
export async function buildWikiIndexSection(scope: string = "global"): Promise<string> {
  const pages = await storage.getWikiPages(scope, "approved");
  if (pages.length === 0) return "";

  const lines = pages.map(
    (p) => `- \`${p.slug}\` — **${p.title}**${p.summary ? `: ${p.summary}` : ""}`
  );

  return `# Framework Wiki Index
You have a wiki of pages synthesizing Gena's body of work. These are the pages available to you:

${lines.join("\n")}

When one of these concepts is relevant to the conversation, call the \`read_wiki_page\` tool with its slug to load the full page BEFORE relying on its detail or quoting from it. Treat the one-line summaries above as a table of contents only — never quote from a summary, and never quote a passage you have not loaded via \`read_wiki_page\` (or that does not appear in "Gena's Writings"). If no page is relevant, just answer normally.`;
}
