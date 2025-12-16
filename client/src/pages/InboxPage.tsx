import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageCircle, Loader2, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientDocumentView } from "@/components/ClientDocumentView";

interface Thread {
  id: string;
  clientId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

interface Client {
  id: string;
  name: string;
}

function formatWhatsAppTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function InboxPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"chat" | "document">("chat");

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/chat", clientId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${clientId}/info`);
      if (!res.ok) throw new Error("Client not found");
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ["/api/clients", clientId, "threads"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/threads`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clientId,
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New conversation" }),
      });
      if (!res.ok) throw new Error("Failed to create thread");
      return res.json();
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "threads"] });
      setLocation(`/chat/${clientId}/${thread.id}`);
    },
  });

  const handleNewThread = () => {
    createThreadMutation.mutate();
  };

  const handleOpenThread = (threadId: string) => {
    setLocation(`/chat/${clientId}/${threadId}`);
  };

  if (!clientId) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <p className="text-muted-foreground">Invalid link</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
      <div className="w-full h-full sm:max-w-[450px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden flex flex-col relative">
        <div className="bg-[hsl(var(--wa-header))] text-white shadow-md">
          <div className="flex items-center gap-3 p-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
              <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-lg">
                G
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="truncate text-lg font-medium leading-tight" data-testid="text-inbox-title">
                GenaGPT
              </h2>
              <p className="truncate text-xs text-white/80">
                {client?.name ? `Hi ${client.name.split(' ')[0]}!` : 'Your thinking partner'}
              </p>
            </div>
          </div>
          <div className="flex border-t border-white/10">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "chat" 
                  ? "bg-white/10 text-white border-b-2 border-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
              data-testid="tab-chat"
            >
              <MessageCircle className="h-4 w-4" />
              Conversations
            </button>
            <button
              onClick={() => setActiveTab("document")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "document" 
                  ? "bg-white/10 text-white border-b-2 border-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
              data-testid="tab-document"
            >
              <FileText className="h-4 w-4" />
              My Document
            </button>
          </div>
        </div>

        {activeTab === "chat" ? (
          <>
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <MessageCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No conversations yet</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Start a new conversation with your AI thinking partner
                  </p>
                  <Button
                    onClick={handleNewThread}
                    disabled={createThreadMutation.isPending}
                    className="bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90"
                    data-testid="button-start-first-conversation"
                  >
                    {createThreadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Start conversation
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => handleOpenThread(thread.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      data-testid={`thread-item-${thread.id}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <MessageCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium text-slate-900 truncate text-[15px]">
                            {thread.title}
                          </h3>
                          <span className="text-xs text-slate-500 shrink-0">
                            {formatWhatsAppTimestamp(thread.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate mt-0.5">
                          Tap to continue...
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleNewThread}
              disabled={createThreadMutation.isPending}
              className="fixed bottom-20 right-4 sm:absolute sm:bottom-6 sm:right-6 w-14 h-14 rounded-full bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50 z-50"
              data-testid="button-new-conversation"
              aria-label="New conversation"
            >
              {createThreadMutation.isPending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </button>
          </>
        ) : (
          <div className="flex-1 overflow-hidden bg-slate-50">
            <ClientDocumentView clientId={clientId!} />
          </div>
        )}
      </div>
    </div>
  );
}
