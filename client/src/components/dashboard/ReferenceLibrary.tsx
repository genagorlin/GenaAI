import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  BookOpen, 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight
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

interface ReferenceDocument {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export function ReferenceLibrary() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ReferenceDocument | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [newDoc, setNewDoc] = useState({ title: "", content: "", description: "" });
  
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery<ReferenceDocument[]>({
    queryKey: ["/api/coach/reference-documents"],
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (doc: { title: string; content: string; description?: string }) => {
      const res = await fetch("/api/coach/reference-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      if (!res.ok) throw new Error("Failed to create document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/reference-documents"] });
      setIsCreating(false);
      setNewDoc({ title: "", content: "", description: "" });
      toast.success("Document added to library");
    },
    onError: () => {
      toast.error("Failed to add document");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; description?: string }) => {
      const res = await fetch(`/api/coach/reference-documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/reference-documents"] });
      setEditingDoc(null);
      toast.success("Document updated");
    },
    onError: () => {
      toast.error("Failed to update document");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/reference-documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/reference-documents"] });
      toast.success("Document removed from library");
    },
    onError: () => {
      toast.error("Failed to remove document");
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = () => {
    if (!newDoc.title.trim() || !newDoc.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    createMutation.mutate(newDoc);
  };

  const handleUpdate = () => {
    if (!editingDoc) return;
    updateMutation.mutate({
      id: editingDoc.id,
      title: editingDoc.title,
      content: editingDoc.content,
      description: editingDoc.description,
    });
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-reference-library">
          <BookOpen className="h-4 w-4" />
          Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Reference Library
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Your writings that the AI can reference when talking to clients. The AI will say "As Gena writes..." when drawing on these materials.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {isCreating ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Add New Document</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Title (e.g., 'On Procrastination' or 'The Builder's Mindset')"
                value={newDoc.title}
                onChange={(e) => setNewDoc(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-new-doc-title"
              />
              <Input
                placeholder="Brief description (optional)"
                value={newDoc.description}
                onChange={(e) => setNewDoc(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-new-doc-description"
              />
              <Textarea
                placeholder="Paste your writing here..."
                value={newDoc.content}
                onChange={(e) => setNewDoc(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[200px]"
                data-testid="textarea-new-doc-content"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {wordCount(newDoc.content)} words
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={createMutation.isPending}
                    data-testid="button-save-new-doc"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Document
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => setIsCreating(true)} 
              className="mb-4 gap-2"
              data-testid="button-add-document"
            >
              <Plus className="h-4 w-4" />
              Add Document
            </Button>
          )}

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No documents yet</p>
                <p className="text-sm">Add your writings for the AI to reference in conversations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="border rounded-lg overflow-hidden">
                    {editingDoc?.id === doc.id ? (
                      <div className="p-4 space-y-3 bg-muted/30">
                        <Input
                          value={editingDoc.title}
                          onChange={(e) => setEditingDoc(prev => prev ? { ...prev, title: e.target.value } : null)}
                          data-testid={`input-edit-title-${doc.id}`}
                        />
                        <Input
                          placeholder="Brief description (optional)"
                          value={editingDoc.description || ""}
                          onChange={(e) => setEditingDoc(prev => prev ? { ...prev, description: e.target.value } : null)}
                        />
                        <Textarea
                          value={editingDoc.content}
                          onChange={(e) => setEditingDoc(prev => prev ? { ...prev, content: e.target.value } : null)}
                          className="min-h-[200px]"
                          data-testid={`textarea-edit-content-${doc.id}`}
                        />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {wordCount(editingDoc.content)} words
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingDoc(null)}>
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={handleUpdate}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-edit-${doc.id}`}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => toggleExpanded(doc.id)}
                          data-testid={`button-expand-doc-${doc.id}`}
                        >
                          {expandedDocs.has(doc.id) ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{doc.title}</h4>
                            {doc.description && (
                              <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {wordCount(doc.content)} words • Updated {new Date(doc.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingDoc(doc)}
                              data-testid={`button-edit-doc-${doc.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  data-testid={`button-delete-doc-${doc.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{doc.title}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove this document from your reference library. The AI will no longer be able to draw on this material.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(doc.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </button>
                        {expandedDocs.has(doc.id) && (
                          <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed max-h-80 overflow-y-auto">
                              {doc.content}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
