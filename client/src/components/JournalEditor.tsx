import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Send,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface JournalEntry {
  id: string;
  clientId: string;
  title: string;
  content: string;
  aiGuidance?: { role: string; content: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

interface JournalEditorProps {
  entryId: string;
  clientId: string;
}

export function JournalEditor({ entryId, clientId }: JournalEditorProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidanceMessage, setGuidanceMessage] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);

  const { data: entry, isLoading } = useQuery<JournalEntry>({
    queryKey: ["/api/journal", entryId],
    queryFn: async () => {
      const res = await fetch(`/api/journal/${entryId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch journal entry");
      return res.json();
    },
    enabled: !!entryId,
  });

  // Initialize local state from fetched data (only once)
  useEffect(() => {
    if (entry && !hasLoadedRef.current) {
      setTitle(entry.title);
      setContent(entry.content);
      hasLoadedRef.current = true;
    }
  }, [entry]);

  const saveMutation = useMutation({
    mutationFn: async (data: { title?: string; content?: string }) => {
      const res = await fetch(`/api/journal/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "journal"] });
    },
    onError: () => {
      setSaveStatus("unsaved");
    },
  });

  const debouncedSave = useCallback(
    (newTitle: string, newContent: string) => {
      setSaveStatus("unsaved");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus("saving");
        saveMutation.mutate({ title: newTitle, content: newContent });
      }, 1000);
    },
    [saveMutation]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(newTitle, content);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // Auto-generate title from first line if title is still "Untitled"
    if (title === "Untitled" && newContent.trim()) {
      const firstLine = newContent.trim().split("\n")[0].slice(0, 50);
      const autoTitle = firstLine + (newContent.trim().split("\n")[0].length > 50 ? "..." : "");
      setTitle(autoTitle);
      debouncedSave(autoTitle, newContent);
    } else {
      debouncedSave(title, newContent);
    }
  };

  const guidanceMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/journal/${entryId}/guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to get AI guidance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal", entryId] });
      setGuidanceMessage("");
    },
  });

  const handleSendGuidance = () => {
    if (!guidanceMessage.trim() || guidanceMutation.isPending) return;
    guidanceMutation.mutate(guidanceMessage.trim());
  };

  const guidance = (entry?.aiGuidance as any[]) || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Journal entry not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-slate-50 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/inbox/${clientId}`)}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="font-medium text-lg border-0 bg-transparent p-0 h-auto focus-visible:ring-0 placeholder:text-slate-400"
            placeholder="Entry title..."
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Check className="h-3 w-3" />
              Saved
            </>
          ) : (
            <span className="text-amber-500">Unsaved</span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <Textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing... What's on your mind?"
            className="w-full min-h-[300px] border-0 bg-transparent p-0 text-[15px] leading-relaxed focus-visible:ring-0 resize-none placeholder:text-slate-400"
            autoFocus
          />
        </div>

        {/* AI Guidance panel */}
        <div className="border-t mx-4">
          <button
            onClick={() => setShowGuidance(!showGuidance)}
            className="w-full px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Want AI thought partnership on this entry?
            <ChevronRight className={cn("h-4 w-4 ml-auto transition-transform", showGuidance && "rotate-90")} />
          </button>

          {showGuidance && (
            <div className="border-t p-4 space-y-4 bg-muted/20">
              {guidance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Ask a question or request feedback on what you've written.
                </p>
              ) : (
                <div className="space-y-3">
                  {guidance.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg text-sm whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary/10 ml-8"
                          : "bg-muted mr-8"
                      )}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {guidanceMutation.isPending && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mr-8">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  value={guidanceMessage}
                  onChange={(e) => setGuidanceMessage(e.target.value)}
                  placeholder="Ask a question..."
                  className="min-h-[60px] text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendGuidance();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-[60px] w-10 shrink-0"
                  onClick={handleSendGuidance}
                  disabled={!guidanceMessage.trim() || guidanceMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
