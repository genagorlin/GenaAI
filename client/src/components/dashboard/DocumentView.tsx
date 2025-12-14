import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Bot, MessageSquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface DocumentViewProps {
  clientId: string;
  clientName: string;
}

export function DocumentView({ clientId, clientName }: DocumentViewProps) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [roleContent, setRoleContent] = useState("");
  const [taskContent, setTaskContent] = useState("");
  const [sectionContents, setSectionContents] = useState<Record<string, { title: string; content: string }>>({});

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

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
    if (promptData) {
      setRoleContent(promptData.rolePrompt.content);
      setTaskContent(promptData.taskPrompt.content);
    }
  }, [promptData]);

  useEffect(() => {
    if (documentData?.sections) {
      const contents: Record<string, { title: string; content: string }> = {};
      documentData.sections.forEach(s => {
        contents[s.id] = { title: s.title, content: s.content };
      });
      setSectionContents(contents);
    }
  }, [documentData]);

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
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "document"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "prompts"] });
      
      setHasChanges(false);
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
      <div className="flex items-center justify-center h-64" data-testid="document-view-loading">
        <div className="animate-pulse text-muted-foreground">Loading document...</div>
      </div>
    );
  }

  const sections = documentData?.sections || [];

  return (
    <div className="space-y-4" data-testid="document-view">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Edit all sections in one flowing document. Changes save together.
        </p>
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
              {isSaving ? "Saving..." : "Save All Changes"}
            </>
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-8 space-y-8 max-w-3xl mx-auto">
          <div className="space-y-4" data-testid="doc-section-role">
            <div className="flex items-center gap-2 text-primary">
              <Bot className="h-5 w-5" />
              <h2 className="text-lg font-serif font-medium">Role Prompt</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Defines the AI's personality when talking to this client
            </p>
            <textarea
              value={roleContent}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full min-h-[100px] p-4 text-sm leading-relaxed bg-muted/30 rounded-lg border-0 focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
              placeholder="Define the AI's role and personality..."
              data-testid="textarea-doc-role"
            />
          </div>

          <div className="border-t border-border" />

          <div className="space-y-4" data-testid="doc-section-task">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquare className="h-5 w-5" />
              <h2 className="text-lg font-serif font-medium">Task Prompt</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Instructions for how the AI should respond
            </p>
            <textarea
              value={taskContent}
              onChange={(e) => handleTaskChange(e.target.value)}
              className="w-full min-h-[100px] p-4 text-sm leading-relaxed bg-muted/30 rounded-lg border-0 focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
              placeholder="Define how the AI should respond..."
              data-testid="textarea-doc-task"
            />
          </div>

          {sections.length > 0 && (
            <>
              <div className="border-t border-border" />
              
              <div className="space-y-6">
                <h2 className="text-lg font-serif font-medium text-muted-foreground">Profile Sections</h2>
                
                {sections.map((section) => (
                  <div key={section.id} className="space-y-2" data-testid={`doc-section-${section.id}`}>
                    <input
                      type="text"
                      value={sectionContents[section.id]?.title || ""}
                      onChange={(e) => handleSectionChange(section.id, "title", e.target.value)}
                      className="w-full text-base font-medium bg-transparent border-0 focus:outline-none focus:ring-0 px-0"
                      placeholder="Section title..."
                      data-testid={`input-doc-title-${section.id}`}
                    />
                    <textarea
                      value={sectionContents[section.id]?.content || ""}
                      onChange={(e) => handleSectionChange(section.id, "content", e.target.value)}
                      className="w-full min-h-[80px] p-4 text-sm leading-relaxed bg-muted/30 rounded-lg border-0 focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
                      placeholder="Add content..."
                      data-testid={`textarea-doc-content-${section.id}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-full text-sm shadow-lg">
          You have unsaved changes
        </div>
      )}
    </div>
  );
}
