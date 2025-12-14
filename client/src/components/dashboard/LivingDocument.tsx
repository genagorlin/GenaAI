import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Plus, 
  GripVertical, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Save,
  Edit3,
  Check,
  X,
  Sparkles,
  Target,
  Star,
  BookOpen,
  LayoutList,
  FileEdit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PromptSettings } from "./PromptSettings";
import { DocumentView } from "./DocumentView";

type ProfileViewMode = "prompt-entry" | "document";

interface DocumentSection {
  id: string;
  documentId: string;
  sectionType: string;
  title: string;
  content: string;
  sortOrder: number;
  isCollapsed: number;
  createdAt: string;
  updatedAt: string;
}

interface ClientDocument {
  id: string;
  clientId: string;
  title: string;
  lastUpdated: string;
  createdAt: string;
}

interface LivingDocumentProps {
  clientId: string;
  clientName: string;
}

const sectionTypeIcons: Record<string, React.ElementType> = {
  summary: BookOpen,
  highlight: Star,
  focus: Target,
  context: FileText,
  custom: Sparkles,
};

const sectionTypeLabels: Record<string, string> = {
  summary: "Overview",
  highlight: "Highlight",
  focus: "Focus Area",
  context: "Context",
  custom: "Custom",
};

export function LivingDocument({ clientId, clientName }: LivingDocumentProps) {
  const queryClient = useQueryClient();
  const [profileViewMode, setProfileViewMode] = useState<ProfileViewMode>("prompt-entry");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionType, setNewSectionType] = useState("custom");

  const { data, isLoading } = useQuery<{ document: ClientDocument; sections: DocumentSection[] }>({
    queryKey: ["/api/clients", clientId, "document"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/document`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch document");
      return res.json();
    },
    enabled: !!clientId,
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DocumentSection> }) => {
      const res = await fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
      setEditingSectionId(null);
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (section: { title: string; sectionType: string; content: string; sortOrder: number }) => {
      const res = await fetch(`/api/clients/${clientId}/document/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(section),
      });
      if (!res.ok) throw new Error("Failed to create section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
      setIsAddingSection(false);
      setNewSectionTitle("");
      setNewSectionType("custom");
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sections/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
    },
  });

  const startEditing = (section: DocumentSection) => {
    setEditingSectionId(section.id);
    setEditingTitle(section.title);
    setEditingContent(section.content);
  };

  const saveEdit = () => {
    if (editingSectionId) {
      updateSectionMutation.mutate({
        id: editingSectionId,
        updates: { title: editingTitle, content: editingContent },
      });
    }
  };

  const cancelEdit = () => {
    setEditingSectionId(null);
    setEditingTitle("");
    setEditingContent("");
  };

  const toggleCollapsed = (section: DocumentSection) => {
    updateSectionMutation.mutate({
      id: section.id,
      updates: { isCollapsed: section.isCollapsed ? 0 : 1 },
    });
  };

  const addNewSection = () => {
    if (!newSectionTitle.trim()) return;
    const maxOrder = Math.max(...(data?.sections.map(s => s.sortOrder) || [0]), -1);
    createSectionMutation.mutate({
      title: newSectionTitle,
      sectionType: newSectionType,
      content: "",
      sortOrder: maxOrder + 1,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="document-loading">
        <div className="animate-pulse text-muted-foreground">Loading document...</div>
      </div>
    );
  }

  const sections = data?.sections || [];
  const document = data?.document;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-serif font-medium" data-testid="document-title">
              {clientName}'s Profile
            </h2>
            <p className="text-xs text-muted-foreground">
              Last updated: {document?.lastUpdated ? new Date(document.lastUpdated).toLocaleDateString() : "Never"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Button
              variant={profileViewMode === "prompt-entry" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setProfileViewMode("prompt-entry")}
              className="gap-2 h-8"
              data-testid="button-view-prompt-entry"
            >
              <LayoutList className="h-4 w-4" />
              Prompt Entry
            </Button>
            <Button
              variant={profileViewMode === "document" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setProfileViewMode("document")}
              className="gap-2 h-8"
              data-testid="button-view-document-unified"
            >
              <FileEdit className="h-4 w-4" />
              Document
            </Button>
          </div>
          {profileViewMode === "prompt-entry" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingSection(true)}
              className="gap-2"
              data-testid="button-add-section"
            >
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          )}
        </div>
      </div>

      {profileViewMode === "document" ? (
        <DocumentView clientId={clientId} clientName={clientName} />
      ) : (
        <>
          <PromptSettings clientId={clientId} />

      {isAddingSection && (
        <div className="rounded-lg border border-primary/50 bg-primary/5 p-4 space-y-3" data-testid="new-section-form">
          <div className="flex gap-3">
            <Select value={newSectionType} onValueChange={setNewSectionType}>
              <SelectTrigger className="w-40" data-testid="select-section-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Overview</SelectItem>
                <SelectItem value="highlight">Highlight</SelectItem>
                <SelectItem value="focus">Focus Area</SelectItem>
                <SelectItem value="context">Context</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Section title..."
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              className="flex-1"
              data-testid="input-section-title"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAddingSection(false);
                setNewSectionTitle("");
              }}
              data-testid="button-cancel-section"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={addNewSection}
              disabled={!newSectionTitle.trim() || createSectionMutation.isPending}
              data-testid="button-save-section"
            >
              Add Section
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-4 pr-4">
          {sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-sections">
              No sections yet. Add one to get started.
            </div>
          ) : (
            sections.map((section) => {
              const Icon = sectionTypeIcons[section.sectionType] || FileText;
              const isEditing = editingSectionId === section.id;

              return (
                <div
                  key={section.id}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                  data-testid={`section-${section.id}`}
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleCollapsed(section)}
                        className="text-muted-foreground hover:text-foreground"
                        data-testid={`toggle-collapse-${section.id}`}
                      >
                        {section.isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                      <Icon className="h-4 w-4 text-primary" />
                      {isEditing ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="h-7 w-48 text-sm font-medium"
                          data-testid={`input-edit-title-${section.id}`}
                        />
                      ) : (
                        <span className="font-medium text-sm">{section.title}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {sectionTypeLabels[section.sectionType] || "Custom"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={saveEdit}
                            disabled={updateSectionMutation.isPending}
                            data-testid={`button-save-edit-${section.id}`}
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                            data-testid={`button-cancel-edit-${section.id}`}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEditing(section)}
                            data-testid={`button-edit-${section.id}`}
                          >
                            <Edit3 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => deleteSectionMutation.mutate(section.id)}
                            disabled={deleteSectionMutation.isPending}
                            data-testid={`button-delete-${section.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {!section.isCollapsed && (
                    <div className="p-4">
                      {isEditing ? (
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          placeholder="Add your notes here..."
                          className="min-h-[120px] resize-none"
                          data-testid={`textarea-edit-content-${section.id}`}
                        />
                      ) : section.content ? (
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap" data-testid={`content-${section.id}`}>
                          {section.content}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Click edit to add notes to this section...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
        </>
      )}
    </div>
  );
}
