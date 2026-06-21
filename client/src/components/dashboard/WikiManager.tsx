import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Network,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Upload,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WikiPage {
  id: string;
  scope: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  tags?: string[];
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface WikiSource {
  id: string;
  title: string;
  description?: string;
  charCount: number;
  wordCount: number;
  updatedAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export function WikiManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<WikiPage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [newPage, setNewPage] = useState({ slug: "", title: "", summary: "", content: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewChunk, setPreviewChunk] = useState(0);
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: sources = [] } = useQuery<WikiSource[]>({
    queryKey: ["/api/coach/wiki-sources"],
    queryFn: async () => {
      const res = await fetch("/api/coach/wiki-sources", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wiki sources");
      return res.json();
    },
    enabled: isOpen,
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/coach/wiki-sources/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to import document");
      }
      return res.json() as Promise<{ title: string; wordCount: number; replaced: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/wiki-sources"] });
      toast.success(
        `${result.replaced ? "Replaced" : "Imported"} "${result.title}" — ${result.wordCount.toLocaleString()} words`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ sourceId, chunkIndex }: { sourceId: string; chunkIndex: number }) => {
      const res = await fetch("/api/coach/wiki/ingest-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceId, chunkIndex }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate preview");
      }
      return res.json();
    },
    onSuccess: (result) => {
      setPreview(result);
      setPreviewChunk(result.chunkIndex);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const runPreview = (sourceId: string, chunkIndex: number) => {
    setPreviewSourceId(sourceId);
    setPreviewOpen(true); // open the dialog immediately so the wait has visible feedback
    previewMutation.mutate({ sourceId, chunkIndex });
  };

  const { data: pages = [], isLoading } = useQuery<WikiPage[]>({
    queryKey: ["/api/coach/wiki"],
    queryFn: async () => {
      const res = await fetch("/api/coach/wiki?scope=global", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wiki pages");
      return res.json();
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (page: { slug: string; title: string; summary: string; content: string }) => {
      const res = await fetch("/api/coach/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...page, scope: "global" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create page");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/wiki"] });
      setIsCreating(false);
      setNewPage({ slug: "", title: "", summary: "", content: "" });
      toast.success("Wiki page created");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (page: WikiPage) => {
      const res = await fetch(`/api/coach/wiki/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug: page.slug,
          title: page.title,
          summary: page.summary,
          content: page.content,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update page");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/wiki"] });
      setEditingPage(null);
      toast.success("Wiki page updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/wiki/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete page");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/wiki"] });
      toast.success("Wiki page deleted");
    },
  });

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedPages);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPages(next);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Network className="h-4 w-4" />
          Wiki
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Framework Wiki
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Synthesized pages the AI navigates at query time. Each page should be a concept, distinction, or framework component drawn from your writings.
          </p>
        </DialogHeader>

        {/* Sources — raw documents (e.g. the book draft) the wiki is generated from */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Source documents
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importMutation.mutate(file);
                e.target.value = ""; // allow re-selecting the same file
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Import .docx
            </Button>
          </div>
          {sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No sources yet. Import a book draft or essay to generate wiki pages from it (page generation coming next).
            </p>
          ) : (
            <div className="space-y-1">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium flex-1 min-w-0">{s.title}</span>
                  <span className="text-muted-foreground shrink-0">
                    {s.wordCount.toLocaleString()} words
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs gap-1 shrink-0"
                    onClick={() => runPreview(s.id, 0)}
                    disabled={previewMutation.isPending}
                  >
                    {previewMutation.isPending && previewSourceId === s.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Preview pages
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pb-2 border-b">
          <div className="text-sm text-muted-foreground">
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </div>
          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            New page
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {/* Create form */}
              {isCreating && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">New page</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreating(false);
                        setNewPage({ slug: "", title: "", summary: "", content: "" });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input
                      placeholder="The Builder's Mindset"
                      value={newPage.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setNewPage((p) => ({
                          ...p,
                          title,
                          slug: p.slug || slugify(title),
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Slug (URL-safe identifier, must be unique)
                    </label>
                    <Input
                      placeholder="builder-mindset"
                      value={newPage.slug}
                      onChange={(e) => setNewPage((p) => ({ ...p, slug: slugify(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Summary (1-2 lines, used by AI to decide whether to read this page)
                    </label>
                    <Input
                      placeholder="Gena's core framework for relating to one's life as an active construction project."
                      value={newPage.summary}
                      onChange={(e) => setNewPage((p) => ({ ...p, summary: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Content (markdown)
                    </label>
                    <Textarea
                      placeholder="Full page content..."
                      value={newPage.content}
                      onChange={(e) => setNewPage((p) => ({ ...p, content: e.target.value }))}
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCreating(false);
                        setNewPage({ slug: "", title: "", summary: "", content: "" });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => createMutation.mutate(newPage)}
                      disabled={!newPage.title || !newPage.slug || createMutation.isPending}
                      className="gap-1"
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Create
                    </Button>
                  </div>
                </div>
              )}

              {pages.length === 0 && !isCreating ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No wiki pages yet. Create one to get started.
                </div>
              ) : (
                pages.map((page) => {
                  const isExpanded = expandedPages.has(page.id);
                  const isEditing = editingPage?.id === page.id;

                  return (
                    <div key={page.id} className="border rounded-lg overflow-hidden">
                      {isEditing ? (
                        <div className="p-4 space-y-3 bg-muted/30">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Title</label>
                            <Input
                              value={editingPage.title}
                              onChange={(e) =>
                                setEditingPage({ ...editingPage, title: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Slug</label>
                            <Input
                              value={editingPage.slug}
                              onChange={(e) =>
                                setEditingPage({ ...editingPage, slug: slugify(e.target.value) })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Summary</label>
                            <Input
                              value={editingPage.summary}
                              onChange={(e) =>
                                setEditingPage({ ...editingPage, summary: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Content (markdown)
                            </label>
                            <Textarea
                              value={editingPage.content}
                              onChange={(e) =>
                                setEditingPage({ ...editingPage, content: e.target.value })
                              }
                              className="min-h-[300px] font-mono text-sm"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPage(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateMutation.mutate(editingPage)}
                              disabled={updateMutation.isPending}
                              className="gap-1"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-2 p-3 hover:bg-muted/30">
                            <button
                              onClick={() => toggleExpanded(page.id)}
                              className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm truncate">{page.title}</h4>
                                <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                  {page.slug}
                                </code>
                                {page.status !== "approved" && (
                                  <code className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                    {page.status}
                                  </code>
                                )}
                              </div>
                              {page.summary && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {page.summary}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingPage(page)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{page.title}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the wiki page. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(page.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                                {page.content || "(empty)"}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

      {/* Preview of AI-generated pages for one chunk (no DB writes) */}
      <Dialog open={previewOpen} onOpenChange={(o) => { if (!o) { setPreviewOpen(false); setPreview(null); } }}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Preview: proposed pages
            </DialogTitle>
            {preview && (
              <p className="text-sm text-muted-foreground">
                {preview.sourceTitle} — chunk {preview.chunkIndex + 1} of {preview.totalChunks} (~{preview.chunkTokens} tokens) ·
                {" "}{preview.pageCount} page(s), {preview.totalExcerpts} excerpt(s)
                {preview.missingExcerpts > 0 ? (
                  <span className="text-red-600 font-medium"> · ⚠ {preview.missingExcerpts} excerpt(s) not found verbatim</span>
                ) : (
                  <span className="text-emerald-600 font-medium"> · all excerpts verbatim ✓</span>
                )}
              </p>
            )}
          </DialogHeader>

          {preview && (
            <div className="flex items-center gap-2 pb-2 border-b text-sm">
              <span className="text-muted-foreground">Try another chunk:</span>
              <Button
                size="sm" variant="outline" className="h-7"
                disabled={previewMutation.isPending || previewChunk <= 0}
                onClick={() => previewSourceId && runPreview(previewSourceId, previewChunk - 1)}
              >
                ← Prev
              </Button>
              <span className="text-xs text-muted-foreground">chunk {previewChunk + 1}/{preview.totalChunks}</span>
              <Button
                size="sm" variant="outline" className="h-7"
                disabled={previewMutation.isPending || previewChunk >= preview.totalChunks - 1}
                onClick={() => previewSourceId && runPreview(previewSourceId, previewChunk + 1)}
              >
                Next →
              </Button>
              {previewMutation.isPending && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating… (this takes a few seconds)
                </span>
              )}
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {!preview && previewMutation.isPending && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Generating proposed pages…</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    The AI is reading this section of the book and drafting concept pages with verbatim quotes. This usually takes 30–60 seconds.
                  </p>
                </div>
              )}
              {!preview && !previewMutation.isPending && previewMutation.isError && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <X className="h-8 w-8 text-red-500" />
                  <p className="text-sm font-medium">Preview failed</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {(previewMutation.error as Error)?.message || "Something went wrong."}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    If it spun for about a minute first, the generation likely timed out on a dense section. Try again, or try a different chunk.
                  </p>
                </div>
              )}
              {preview?.pages?.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No pages proposed for this chunk (likely front-matter or transitional text).
                </p>
              )}
              {preview?.pages?.map((p: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{p.title}</h4>
                    <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{p.slug}</code>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{p.summary}</p>
                  <div className="space-y-1.5">
                    {p.excerpts.map((ex: any, j: number) => (
                      <div
                        key={j}
                        className={cn(
                          "text-xs p-2 rounded border-l-2",
                          ex.status === "exact" ? "border-emerald-400 bg-emerald-50" :
                          ex.status === "near" ? "border-amber-400 bg-amber-50" :
                          "border-red-400 bg-red-50"
                        )}
                      >
                        <span className={cn(
                          "font-medium uppercase text-[9px] mr-1.5",
                          ex.status === "exact" ? "text-emerald-700" :
                          ex.status === "near" ? "text-amber-700" : "text-red-700"
                        )}>
                          {ex.status === "exact" ? "verbatim ✓" : ex.status === "near" ? "near (whitespace differs)" : "NOT IN SOURCE ✗"}
                        </span>
                        <span className="whitespace-pre-wrap">"{ex.text}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
