import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Users, 
  MessageCircle, 
  FileText, 
  ChevronRight, 
  Send, 
  Loader2,
  LogOut,
  Plus,
  Link2,
  Check,
  Bot,
  User as UserIcon
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LivingDocument } from "@/components/dashboard/LivingDocument";
import { ManageClientsDialog } from "@/components/dashboard/ManageClientsDialog";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  lastActive: string;
  mobileAppConnected: number;
}

interface Thread {
  id: string;
  clientId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

interface Message {
  id: string;
  clientId: string;
  threadId: string | null;
  role: string;
  content: string;
  type: string;
  timestamp: string;
}

type MobileView = "clients" | "client-detail" | "thread";

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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

export function MobileCoachView() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };
  const [view, setView] = useState<MobileView>("clients");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showDocument, setShowDocument] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [isManageClientsOpen, setIsManageClientsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const { data: threads = [] } = useQuery<Thread[]>({
    queryKey: ["/api/clients", selectedClientId, "threads"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${selectedClientId}/threads`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/threads", selectedThreadId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/threads/${selectedThreadId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedThreadId,
  });

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const sendCoachMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/coach/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      setCoachMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/threads", selectedThreadId, "messages"] });
      if (data.aiMessage) {
        toast.success("Message sent - AI responded");
      } else {
        toast.success("Message sent");
      }
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedThreadId(null);
    setShowDocument(false);
    setView("client-detail");
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setView("thread");
  };

  const handleBack = () => {
    if (view === "thread") {
      setSelectedThreadId(null);
      setView("client-detail");
    } else if (view === "client-detail") {
      setSelectedClientId(null);
      setView("clients");
    }
  };

  const handleCopyLink = async () => {
    if (!selectedClientId) return;
    const link = `${window.location.origin}/chat/${selectedClientId}`;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSendMessage = () => {
    if (!coachMessage.trim()) return;
    sendCoachMessage.mutate(coachMessage.trim());
  };

  if (view === "clients") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">G</span>
            </div>
            <h1 className="font-semibold text-lg">GenaGPT</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsManageClientsOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clients ({clients.length})
            </h2>
            <div className="space-y-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border hover:bg-accent transition-colors text-left"
                  data-testid={`mobile-client-${client.id}`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-medium text-primary">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{client.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {formatTimeAgo(client.lastActive)}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>

        <ManageClientsDialog 
          open={isManageClientsOpen} 
          onOpenChange={setIsManageClientsOpen} 
        />
      </div>
    );
  }

  if (view === "client-detail" && selectedClient) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="flex items-center gap-3 p-4 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{selectedClient.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{selectedClient.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {linkCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          </Button>
        </header>

        <div className="flex border-b">
          <button
            onClick={() => setShowDocument(false)}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              !showDocument 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            Conversations
          </button>
          <button
            onClick={() => setShowDocument(true)}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              showDocument 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Document
          </button>
        </div>

        {showDocument ? (
          <ScrollArea className="flex-1">
            <div className="p-4">
              <LivingDocument clientId={selectedClientId!} clientName={selectedClient?.name || ""} />
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {threads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border hover:bg-accent transition-colors text-left"
                    data-testid={`mobile-thread-${thread.id}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{thread.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimeAgo(thread.lastMessageAt)}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  if (view === "thread" && selectedThread) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="flex items-center gap-3 p-4 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{selectedThread.title}</h1>
            <p className="text-sm text-muted-foreground">{selectedClient?.name}</p>
          </div>
        </header>

        <ScrollArea className="flex-1 bg-slate-50 dark:bg-slate-900/50">
          <div className="p-4 space-y-3">
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isCoach = message.role === "coach";
              const isAI = message.role === "ai";

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      isUser
                        ? 'bg-emerald-500 text-white rounded-br-sm'
                        : isCoach
                        ? 'bg-violet-600 text-white rounded-bl-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {(isAI || isCoach) && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] h-4 px-1 gap-0.5 ${
                            isCoach 
                              ? 'text-violet-100 border-violet-400/50' 
                              : 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/30'
                          }`}
                        >
                          {isCoach ? <UserIcon className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                          {isCoach ? 'Coach' : 'AI'}
                        </Badge>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <div className={`text-[10px] mt-1 ${
                      isUser || isCoach ? 'text-white/70' : 'text-slate-400'
                    }`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-card">
          <div className="flex gap-2">
            <Textarea
              value={coachMessage}
              onChange={(e) => setCoachMessage(e.target.value)}
              placeholder="Send a coach message..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!coachMessage.trim() || sendCoachMessage.isPending}
              className="shrink-0"
            >
              {sendCoachMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
