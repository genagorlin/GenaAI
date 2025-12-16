import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Star, 
  Target, 
  BookOpen, 
  Sparkles,
  Save,
  Check,
  Loader2,
  Bot,
  User,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  createdAt: string;
  updatedAt: string;
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

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ClientDocumentViewProps {
  clientId: string;
}

export function ClientDocumentView({ clientId }: ClientDocumentViewProps) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);
  
  const [sectionContents, setSectionContents] = useState<Record<string, { title: string; content: string }>>({});

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    initializedRef.current = false;
    setHasChanges(false);
  }, [clientId]);

  const { data: documentData, isLoading } = useQuery<{ document: ClientDocument; sections: DocumentSection[] }>({
    queryKey: ["/api/chat", clientId, "document"],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${clientId}/document`);
      if (!res.ok) throw new Error("Failed to fetch document");
      return res.json();
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (documentData?.sections && !initializedRef.current && !hasChanges) {
      const contents: Record<string, { title: string; content: string }> = {};
      documentData.sections.forEach(s => {
        contents[s.id] = { title: s.title, content: s.content };
      });
      setSectionContents(contents);
      initializedRef.current = true;
    }
  }, [documentData, hasChanges]);

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { title?: string; content?: string } }) => {
      const res = await fetch(`/api/chat/${clientId}/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update section");
      return res.json();
    },
  });

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
    if (!documentData?.sections) return;
    
    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      for (const section of documentData.sections) {
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
      initializedRef.current = false;
      
      queryClient.invalidateQueries({ queryKey: ["/api/chat", clientId, "document"] });
      
      setShowSaved(true);
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = documentData?.sections || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-lg font-medium text-slate-900" data-testid="text-document-title">
            My Document
          </h2>
          <p className="text-sm text-slate-500">
            Your personal profile and notes
          </p>
        </div>
        <Button
          size="sm"
          onClick={saveAll}
          disabled={!hasChanges || isSaving}
          className="gap-2"
          data-testid="button-save-document"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : showSaved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {showSaved ? "Saved!" : "Save"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-sections">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-slate-600">No sections yet.</p>
              <p className="text-sm text-slate-400 mt-1">
                Your coach will add sections as you work together.
              </p>
            </div>
          ) : (
            sections.map((section) => {
              const Icon = sectionTypeIcons[section.sectionType] || FileText;
              const currentContent = sectionContents[section.id];
              const isAIAuthored = section.lastUpdatedBy === "ai";
              const isClientAuthored = section.lastUpdatedBy === "client";

              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                  data-testid={`section-${section.id}`}
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-emerald-600" />
                      <input
                        type="text"
                        value={currentContent?.title || ""}
                        onChange={(e) => handleSectionChange(section.id, "title", e.target.value)}
                        className="font-medium text-sm bg-transparent border-0 focus:outline-none focus:ring-0 px-0 text-slate-900"
                        placeholder="Section title..."
                        data-testid={`input-section-title-${section.id}`}
                      />
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-200 text-slate-500">
                        {sectionTypeLabels[section.sectionType] || "Custom"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAIAuthored && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 text-blue-600 border-blue-200 bg-blue-50">
                          <Bot className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                      {isClientAuthored && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                          <User className="h-3 w-3" />
                          You
                        </Badge>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(section.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <Textarea
                      value={currentContent?.content || ""}
                      onChange={(e) => handleSectionChange(section.id, "content", e.target.value)}
                      className="min-h-[100px] w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-700 focus-visible:ring-0 placeholder:text-slate-300"
                      placeholder="Add your notes here..."
                      data-testid={`textarea-section-content-${section.id}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
