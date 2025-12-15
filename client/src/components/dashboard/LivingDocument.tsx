import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save,
  Check,
  Bot,
  MessageSquare,
  Sparkles,
  Target,
  Star,
  BookOpen,
  Clock,
  RotateCcw,
  Undo2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocumentSection {
  id: string;
  documentId: string;
  sectionType: string;
  title: string;
  content: string;
  previousContent: string | null;
  lastUpdatedBy: string | null;
  pendingReview: number;
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

interface RolePrompt {
  id: string;
  clientId: string;
  content: string;
  updatedAt: string;
}

interface TaskPrompt {
  id: string;
  clientId: string;
  content: string;
  updatedAt: string;
}

interface LivingDocumentProps {
  clientId: string;
  clientName: string;
}

interface CoachConsultation {
  id: string;
  clientId: string;
  role: string;
  content: string;
  timestamp: string;
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

const DEFAULT_ROLE_PROMPT = "You are an empathetic thinking partner. Do not prescribe advice. Ask clarifying questions when needed.";
const DEFAULT_TASK_PROMPT = "Respond reflectively and explore meaning without telling the client what to do. If helpful, ask a clarifying question to deepen understanding.";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function isRecentUpdate(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / 3600000;
  return diffHours < 24;
}

export function LivingDocument({ clientId, clientName }: LivingDocumentProps) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedPromptsRef = useRef(false);
  const initializedSectionsRef = useRef(false);
  
  const [roleContent, setRoleContent] = useState("");
  const [taskContent, setTaskContent] = useState("");
  const [sectionContents, setSectionContents] = useState<Record<string, { title: string; content: string }>>({});
  
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionType, setNewSectionType] = useState("custom");
  
  const [isConsultOpen, setIsConsultOpen] = useState(false);
  const [consultMessage, setConsultMessage] = useState("");
  const consultScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    initializedPromptsRef.current = false;
    initializedSectionsRef.current = false;
    setHasChanges(false);
  }, [clientId]);

  const { data: documentData, isLoading: docLoading } = useQuery<{ document: ClientDocument; sections: DocumentSection[] }>({
    queryKey: ["/api/clients", clientId, "document"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/document`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch document");
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: promptData, isLoading: promptLoading } = useQuery<{ rolePrompt: RolePrompt; taskPrompt: TaskPrompt }>({
    queryKey: ["/api/clients", clientId, "prompts"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/prompts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prompts");
      return res.json();
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (promptData && !initializedPromptsRef.current && !hasChanges) {
      setRoleContent(promptData.rolePrompt.content);
      setTaskContent(promptData.taskPrompt.content);
      initializedPromptsRef.current = true;
    }
  }, [promptData, hasChanges]);

  useEffect(() => {
    if (documentData?.sections && !initializedSectionsRef.current && !hasChanges) {
      const contents: Record<string, { title: string; content: string }> = {};
      documentData.sections.forEach(s => {
        contents[s.id] = { title: s.title, content: s.content };
      });
      setSectionContents(contents);
      initializedSectionsRef.current = true;
    }
  }, [documentData, hasChanges]);

  const updateRolePromptMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/clients/${clientId}/prompts/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update role prompt");
      return res.json();
    },
  });

  const updateTaskPromptMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/clients/${clientId}/prompts/task`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update task prompt");
      return res.json();
    },
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
    onSuccess: (newSection) => {
      setSectionContents(prev => ({
        ...prev,
        [newSection.id]: { title: newSection.title, content: newSection.content || "" }
      }));
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
    onSuccess: (_, deletedId) => {
      setSectionContents(prev => {
        const updated = { ...prev };
        delete updated[deletedId];
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
    },
  });

  const acceptSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sections/${id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to accept update");
      return res.json();
    },
    onSuccess: () => {
      initializedSectionsRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
    },
  });

  const revertSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sections/${id}/revert`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to revert update");
      return res.json();
    },
    onSuccess: (updatedSection) => {
      setSectionContents(prev => ({
        ...prev,
        [updatedSection.id]: { title: updatedSection.title, content: updatedSection.content }
      }));
      initializedSectionsRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
    },
  });

  const { data: consultations, isLoading: consultLoading } = useQuery<CoachConsultation[]>({
    queryKey: ["/api/coach/clients", clientId, "consultations"],
    queryFn: async () => {
      const res = await fetch(`/api/coach/clients/${clientId}/consultations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch consultations");
      return res.json();
    },
    enabled: !!clientId && isConsultOpen,
  });

  const sendConsultationMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/coach/clients/${clientId}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send consultation");
      return res.json();
    },
    onSuccess: () => {
      setConsultMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/coach/clients", clientId, "consultations"] });
    },
  });

  const clearConsultationsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/coach/clients/${clientId}/consultations`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear consultations");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/clients", clientId, "consultations"] });
    },
  });

  useEffect(() => {
    if (consultScrollRef.current && consultations) {
      consultScrollRef.current.scrollTop = consultScrollRef.current.scrollHeight;
    }
  }, [consultations]);

  const handleSendConsultation = () => {
    if (!consultMessage.trim()) return;
    sendConsultationMutation.mutate(consultMessage);
  };

  const handleRoleChange = (value: string) => {
    setRoleContent(value);
    setHasChanges(true);
  };

  const handleTaskChange = (value: string) => {
    setTaskContent(value);
    setHasChanges(true);
  };

  const handleSectionChange = (id: string, field: "title" | "content", value: string) => {
    setSectionContents(prev => {
      const existing = prev[id] || { title: "", content: "" };
      return {
        ...prev,
        [id]: { ...existing, [field]: value }
      };
    });
    setHasChanges(true);
  };

  const resetRolePrompt = () => {
    setRoleContent(DEFAULT_ROLE_PROMPT);
    setHasChanges(true);
  };

  const resetTaskPrompt = () => {
    setTaskContent(DEFAULT_TASK_PROMPT);
    setHasChanges(true);
  };

  const addNewSection = () => {
    if (!newSectionTitle.trim()) return;
    const maxOrder = Math.max(...(documentData?.sections.map(s => s.sortOrder) || [0]), -1);
    createSectionMutation.mutate({
      title: newSectionTitle,
      sectionType: newSectionType,
      content: "",
      sortOrder: maxOrder + 1,
    });
  };

  const saveAll = async () => {
    setIsSaving(true);
    try {
      const promises: Promise<any>[] = [];

      if (roleContent !== promptData?.rolePrompt.content) {
        promises.push(updateRolePromptMutation.mutateAsync(roleContent));
      }
      if (taskContent !== promptData?.taskPrompt.content) {
        promises.push(updateTaskPromptMutation.mutateAsync(taskContent));
      }

      for (const section of documentData?.sections || []) {
        const current = sectionContents[section.id];
        if (current && (current.title !== section.title || current.content !== section.content)) {
          promises.push(updateSectionMutation.mutateAsync({
            id: section.id,
            updates: { title: current.title, content: current.content }
          }));
        }
      }

      await Promise.all(promises);
      
      setHasChanges(false);
      initializedPromptsRef.current = false;
      initializedSectionsRef.current = false;
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "prompts"] });
      
      setShowSaved(true);
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (docLoading || promptLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="document-loading">
        <div className="animate-pulse text-muted-foreground">Loading document...</div>
      </div>
    );
  }

  const sections = documentData?.sections || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-serif font-medium" data-testid="document-title">
              {clientName}'s Profile
            </h2>
            <p className="text-xs text-muted-foreground">
              Living document updated by AI and coach
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <Button
            onClick={saveAll}
            disabled={!hasChanges || isSaving}
            className="gap-2"
            data-testid="button-save-all"
          >
            {showSaved ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-4 mb-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3" data-testid="prompt-role-section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Role Prompt</span>
                    <span className="text-xs text-muted-foreground">(AI personality)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetRolePrompt}
                    className="h-7 text-xs gap-1"
                    data-testid="button-reset-role"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                </div>
                <textarea
                  value={roleContent}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full min-h-[80px] p-3 text-sm leading-relaxed bg-muted/30 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:outline-none resize-none"
                  placeholder="Define the AI's role and personality..."
                  data-testid="textarea-role-prompt"
                />
              </div>

              <div className="space-y-3" data-testid="prompt-task-section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Task Prompt</span>
                    <span className="text-xs text-muted-foreground">(Response instructions)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetTaskPrompt}
                    className="h-7 text-xs gap-1"
                    data-testid="button-reset-task"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                </div>
                <textarea
                  value={taskContent}
                  onChange={(e) => handleTaskChange(e.target.value)}
                  className="w-full min-h-[80px] p-3 text-sm leading-relaxed bg-muted/30 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:outline-none resize-none"
                  placeholder="Define how the AI should respond..."
                  data-testid="textarea-task-prompt"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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

      <ScrollArea className="h-[calc(100vh-420px)]">
        <div className="space-y-4 pr-4">
          {sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-sections">
              <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No profile sections yet.</p>
              <p className="text-sm">Add a section to start building this client's profile.</p>
            </div>
          ) : (
            sections.map((section) => {
              const Icon = sectionTypeIcons[section.sectionType] || FileText;
              const isRecent = isRecentUpdate(section.updatedAt);
              const currentContent = sectionContents[section.id];
              const hasAIUpdate = section.pendingReview === 1 && section.previousContent;
              const isAIAuthored = section.lastUpdatedBy === "ai";

              return (
                <div
                  key={section.id}
                  className={`rounded-xl border bg-card overflow-hidden transition-all ${
                    hasAIUpdate ? "border-blue-400/50 shadow-md ring-1 ring-blue-400/20" : 
                    isRecent ? "border-primary/30 shadow-sm" : "border-border"
                  }`}
                  data-testid={`section-${section.id}`}
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-primary" />
                      <input
                        type="text"
                        value={currentContent?.title || ""}
                        onChange={(e) => handleSectionChange(section.id, "title", e.target.value)}
                        className="font-medium text-sm bg-transparent border-0 focus:outline-none focus:ring-0 px-0 w-48"
                        placeholder="Section title..."
                        data-testid={`input-section-title-${section.id}`}
                      />
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {sectionTypeLabels[section.sectionType] || "Custom"}
                      </Badge>
                      {hasAIUpdate && (
                        <Badge className="text-[10px] h-5 px-1.5 gap-1 bg-blue-500 text-white">
                          <Bot className="h-3 w-3" />
                          AI updated
                        </Badge>
                      )}
                      {isRecent && !hasAIUpdate && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 gap-1 bg-primary/10 text-primary border-primary/20">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(section.updatedAt)}
                        </Badge>
                      )}
                      {isAIAuthored && !hasAIUpdate && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasAIUpdate && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => acceptSectionMutation.mutate(section.id)}
                            disabled={acceptSectionMutation.isPending}
                            data-testid={`button-accept-${section.id}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Accept
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => revertSectionMutation.mutate(section.id)}
                            disabled={revertSectionMutation.isPending}
                            data-testid={`button-revert-${section.id}`}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Revert
                          </Button>
                        </>
                      )}
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
                    </div>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={currentContent?.content || ""}
                      onChange={(e) => handleSectionChange(section.id, "content", e.target.value)}
                      placeholder="Add content to this section..."
                      className="w-full min-h-[100px] p-3 text-sm leading-relaxed bg-muted/20 rounded-lg border-0 focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
                      data-testid={`textarea-section-content-${section.id}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          You have unsaved changes
        </div>
      )}

      {/* AI Consultation Panel */}
      <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <button
          onClick={() => setIsConsultOpen(!isConsultOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 transition-colors"
          data-testid="button-toggle-consult"
        >
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-violet-600" />
            <div className="text-left">
              <span className="font-medium text-sm">Consult AI about {clientName}</span>
              <p className="text-xs text-muted-foreground">Private coach-AI discussion</p>
            </div>
          </div>
          {isConsultOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {isConsultOpen && (
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
              <span className="text-xs text-muted-foreground">
                {consultations?.length || 0} messages
              </span>
              {(consultations?.length || 0) > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground hover:text-destructive"
                  onClick={() => clearConsultationsMutation.mutate()}
                  disabled={clearConsultationsMutation.isPending}
                  data-testid="button-clear-consultations"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
            
            <div 
              ref={consultScrollRef}
              className="h-64 overflow-y-auto p-4 space-y-3"
              data-testid="consultation-messages"
            >
              {consultLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : consultations?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Bot className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Ask me anything about {clientName}</p>
                  <p className="text-xs">Patterns, insights, strategies...</p>
                </div>
              ) : (
                consultations?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "coach" ? "justify-end" : "justify-start"}`}
                    data-testid={`consult-msg-${msg.id}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "coach"
                          ? "bg-violet-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {sendConsultationMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <Input
                value={consultMessage}
                onChange={(e) => setConsultMessage(e.target.value)}
                placeholder="Ask about this client..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendConsultation();
                  }
                }}
                disabled={sendConsultationMutation.isPending}
                data-testid="input-consultation"
              />
              <Button
                onClick={handleSendConsultation}
                disabled={!consultMessage.trim() || sendConsultationMutation.isPending}
                size="icon"
                data-testid="button-send-consultation"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
