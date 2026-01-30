import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Search, 
  Bell, 
  Activity, 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  Repeat,
  Sparkles,
  Smartphone,
  Wifi,
  LogOut,
  FileText,
  BarChart3,
  MessageSquare,
  Bot,
  User,
  Settings,
  Link2,
  Check,
  MoreVertical,
  Trash2,
  Send,
  Loader2
} from "lucide-react";
import { MobileCoachView } from "@/components/MobileCoachView";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { LivingDocument } from "@/components/dashboard/LivingDocument";
import { ManageClientsDialog } from "@/components/dashboard/ManageClientsDialog";
import { ReferenceLibrary } from "@/components/dashboard/ReferenceLibrary";
import { ExerciseManager } from "@/components/dashboard/ExerciseManager";
import { ReminderManager } from "@/components/dashboard/ReminderManager";
import { ClientRemindersPanel } from "@/components/dashboard/ClientRemindersPanel";
import { ExerciseSessionView } from "@/components/ExerciseSessionView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  lastActive: string;
  mobileAppConnected: number;
}

interface Insight {
  id: string;
  category: "Emotional Spike" | "Recurring Theme" | "Shift" | "Contradiction";
  title: string;
  description: string;
  timestamp: string;
}

interface SentimentDataPoint {
  date: string;
  sentimentScore: number;
  intensityScore: number;
}

interface Message {
  id: string;
  clientId: string;
  threadId: string | null;
  role: string;
  content: string;
  type: string;
  duration: string | null;
  timestamp: string;
}

interface Thread {
  id: string;
  clientId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

interface Mention {
  id: string;
  messageId: string;
  clientId: string;
  threadId: string;
  isRead: number;
  createdAt: string;
  message?: {
    content: string;
    timestamp: string;
  };
  client?: {
    name: string;
  };
}

interface DocumentSection {
  id: string;
  documentId: string;
  sectionType: string;
  title: string;
  content: string;
  sortOrder: number;
}

type ViewMode = "document" | "signals" | "messages";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize correctly on first render to prevent flash
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export default function CoachPage() {
  const isMobile = useIsMobile();
  
  // Show mobile view on small screens
  if (isMobile) {
    return <MobileCoachView />;
  }
  
  // Desktop view below
  return <DesktopCoachView />;
}

function DesktopCoachView() {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("document");
  const [isManageClientsOpen, setIsManageClientsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    setSelectedThreadId(null);
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedThreadId) {
      fetch(`/api/coach/threads/${selectedThreadId}/mentions/read`, {
        method: "PATCH",
        credentials: "include",
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/mentions/count"] });
      }).catch(err => {
        console.error("Failed to mark mentions as read:", err);
      });
    }
  }, [selectedThreadId, queryClient]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleCopyLink = () => {
    if (!selectedClient) return;
    const chatUrl = `${window.location.origin}/chat/${selectedClient.id}`;
    navigator.clipboard.writeText(chatUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    }
  });

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const { data: insights = [] } = useQuery<Insight[]>({
    queryKey: ["/api/clients", selectedClient?.id, "insights"],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await fetch(`/api/clients/${selectedClient.id}/insights`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!selectedClient
  });

  const { data: sentimentData = [] } = useQuery<SentimentDataPoint[]>({
    queryKey: ["/api/clients", selectedClient?.id, "sentiment"],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await fetch(`/api/clients/${selectedClient.id}/sentiment`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sentiment");
      const data = await res.json();
      return data.map((d: any) => ({
        date: d.date,
        sentimentScore: d.sentimentScore,
        intensityScore: d.intensityScore
      }));
    },
    enabled: !!selectedClient
  });

  const { data: documentSections = [] } = useQuery<DocumentSection[]>({
    queryKey: ["/api/clients", selectedClient?.id, "document", "sections"],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await fetch(`/api/clients/${selectedClient.id}/document/sections`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedClient
  });

  // Extract specific sections for the AI Mental Model
  const valuesSection = documentSections.find(s => s.sectionType === "values");
  const focusSection = documentSections.find(s => s.sectionType === "focus");
  const highlightsSection = documentSections.find(s => s.sectionType === "highlight");

  const { data: mentionsCount = 0 } = useQuery<number>({
    queryKey: ["/api/coach/mentions/count"],
    queryFn: async () => {
      const res = await fetch("/api/coach/mentions/count", { credentials: "include" });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count || 0;
    },
    refetchInterval: 30000
  });

  const { data: mentions = [] } = useQuery<Mention[]>({
    queryKey: ["/api/coach/mentions"],
    queryFn: async () => {
      const res = await fetch("/api/coach/mentions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000
  });

  const { data: threads = [] } = useQuery<Thread[]>({
    queryKey: ["/api/clients", selectedClient?.id, "threads"],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await fetch(`/api/clients/${selectedClient.id}/threads`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
    },
    enabled: !!selectedClient
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: selectedThreadId
      ? ["/api/threads", selectedThreadId, "messages"]
      : ["/api/clients", selectedClient?.id, "messages"],
    queryFn: async () => {
      if (selectedThreadId) {
        const res = await fetch(`/api/threads/${selectedThreadId}/messages`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch thread messages");
        return res.json();
      }
      if (!selectedClient) return [];
      const res = await fetch(`/api/clients/${selectedClient.id}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedClient || !!selectedThreadId,
    refetchInterval: selectedThreadId ? 3000 : false
  });

  // Fetch exercise session for the selected thread (for coach view)
  const { data: threadExerciseSession } = useQuery<{ session: { id: string; status: string } } | null>({
    queryKey: ["/api/clients", selectedClient?.id, "threads", selectedThreadId, "exercise-session"],
    queryFn: async () => {
      if (!selectedClient || !selectedThreadId) return null;
      const res = await fetch(`/api/clients/${selectedClient.id}/threads/${selectedThreadId}/exercise-session`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedClient && !!selectedThreadId,
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete client");
      return res.json();
    },
    onSuccess: (_, deletedClientId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast.success("Client deleted successfully");
      const remainingClients = clients.filter(c => c.id !== deletedClientId);
      if (remainingClients.length > 0) {
        setSelectedClientId(remainingClients[0].id);
      } else {
        setSelectedClientId(null);
      }
    },
    onError: () => {
      toast.error("Failed to delete client. Please try again.");
    },
  });

  const sendCoachMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedThreadId) throw new Error("No thread selected");
      const res = await fetch(`/api/coach/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
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
      toast.error("Failed to send message. Please try again.");
    },
  });

  const handleSendCoachMessage = () => {
    if (!coachMessage.trim() || sendCoachMessageMutation.isPending) return;
    sendCoachMessageMutation.mutate(coachMessage.trim());
  };

  const recentUserMessages = messages
    .filter(m => m.role === "user")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
             </div>
             <span className="font-serif font-medium">Coach Workspace</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search clients..." className="pl-9 bg-background/50 border-sidebar-border" />
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1 pb-4">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider flex justify-between items-center">
              Active Clients
              <Badge variant="outline" className="text-[10px] h-4 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
                API Online
              </Badge>
            </div>
            {clients.map((client) => (
              <button
                key={client.id}
                data-testid={`client-${client.id}`}
                onClick={() => setSelectedClientId(client.id)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  selectedClient?.id === client.id 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`relative h-8 w-8 rounded-full flex items-center justify-center ${selectedClient?.id === client.id ? "bg-white/20" : "bg-sidebar-accent"}`}>
                    <span className="text-xs font-medium">{client.name.split(' ').map(n => n[0]).join('')}</span>
                    {/* Mobile App Connection Dot */}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-background flex items-center justify-center">
                      <span className={`h-1.5 w-1.5 rounded-full ${client.mobileAppConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                    </span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span>{client.name}</span>
                    <span className={`text-[10px] ${selectedClient?.id === client.id ? "text-white/70" : "text-muted-foreground"}`}>
                      {client.mobileAppConnected ? "Mobile App Active" : `Last active ${formatRelativeTime(client.lastActive)}`}
                    </span>
                  </div>
                </div>
                {client.mobileAppConnected === 1 && (
                   <Badge variant="outline" className="bg-background/20 border-white/20 text-[10px] h-5 px-1.5">{insights.length} New</Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-4 rounded-lg bg-sidebar-accent p-3">
             <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground mb-1">
               <Wifi className="h-3 w-3 text-emerald-500" /> API Status
             </div>
             <div className="text-[10px] text-muted-foreground">
               Listening for incoming signals from React Native endpoints...
             </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => setIsManageClientsOpen(true)}
            data-testid="button-manage-clients"
          >
            <Users className="h-4 w-4" /> Manage Clients
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = "/admin"}
            className="w-full justify-start gap-2 text-muted-foreground mt-2"
            data-testid="button-admin-settings"
          >
            <Settings className="h-4 w-4" /> Settings
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-muted-foreground mt-2"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border px-8">
          <div className="flex items-center gap-4">
            <h1 className="font-serif text-2xl font-medium text-foreground" data-testid="selected-client-name">{selectedClient?.name || "Loading..."}</h1>
            {selectedClient && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-client-menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${selectedClient.name}?`)) {
                        deleteClientMutation.mutate(selectedClient.id);
                      }
                    }}
                    data-testid="menu-item-delete-client"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Client
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {selectedClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 text-muted-foreground"
                data-testid="button-copy-chat-link"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Copy Chat Link
                  </>
                )}
              </Button>
            )}
            {selectedClient && (
              <ClientRemindersPanel client={selectedClient} />
            )}
            {selectedClient?.mobileAppConnected === 1 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30">
                 <Smartphone className="h-3 w-3" />
                 Client App Connected
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center border rounded-lg p-1 bg-muted/30">
               <Button
                 variant={viewMode === "document" ? "secondary" : "ghost"}
                 size="sm"
                 onClick={() => setViewMode("document")}
                 className="gap-2 h-8"
                 data-testid="button-view-document"
               >
                 <FileText className="h-4 w-4" />
                 Profile
               </Button>
               <Button
                 variant={viewMode === "signals" ? "secondary" : "ghost"}
                 size="sm"
                 onClick={() => setViewMode("signals")}
                 className="gap-2 h-8"
                 data-testid="button-view-signals"
               >
                 <BarChart3 className="h-4 w-4" />
                 Signals
               </Button>
               <Button
                 variant={viewMode === "messages" ? "secondary" : "ghost"}
                 size="sm"
                 onClick={() => setViewMode("messages")}
                 className="gap-2 h-8"
                 data-testid="button-view-messages"
               >
                 <MessageSquare className="h-4 w-4" />
                 Messages
               </Button>
             </div>
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="ghost" size="icon" className="text-muted-foreground relative" data-testid="button-mentions">
                   <Bell className="h-5 w-5" />
                   {mentionsCount > 0 && (
                     <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                       {mentionsCount > 9 ? '9+' : mentionsCount}
                     </span>
                   )}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-80 p-0" align="end">
                 <div className="p-3 border-b border-border">
                   <h4 className="font-medium text-sm">Notifications</h4>
                   <p className="text-xs text-muted-foreground">{mentionsCount} unread mention{mentionsCount !== 1 ? 's' : ''}</p>
                 </div>
                 <ScrollArea className="max-h-64">
                   {mentions.length === 0 ? (
                     <div className="p-4 text-center text-sm text-muted-foreground">
                       No notifications
                     </div>
                   ) : (
                     <div className="divide-y divide-border">
                       {mentions.map((mention) => (
                         <button
                           key={mention.id}
                           className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                           onClick={() => {
                             setSelectedClientId(mention.clientId);
                             setViewMode("messages");
                             setTimeout(() => setSelectedThreadId(mention.threadId), 100);
                           }}
                           data-testid={`mention-${mention.id}`}
                         >
                           <div className="flex items-start gap-2">
                             <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                               <span className="text-xs font-medium text-red-600 dark:text-red-400">@</span>
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-medium truncate">{mention.client?.name || 'Client'}</p>
                               <p className="text-xs text-muted-foreground line-clamp-2">{mention.message?.content}</p>
                               <p className="text-[10px] text-muted-foreground mt-1">
                                 {mention.message?.timestamp && new Date(mention.message.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                               </p>
                             </div>
                           </div>
                         </button>
                       ))}
                     </div>
                   )}
                 </ScrollArea>
               </PopoverContent>
             </Popover>
             <ReferenceLibrary />
             <ExerciseManager />
             <ReminderManager />
          </div>
        </header>

        {/* Dashboard Content */}
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-6xl mx-auto space-y-8">
            
            {viewMode === "document" && selectedClient?.id ? (
              <LivingDocument key={selectedClient.id} clientId={selectedClient.id} clientName={selectedClient.name} />
            ) : viewMode === "messages" ? (
              <div className="flex gap-6 h-[calc(100vh-220px)]">
                {/* Left Column: Thread List */}
                <div className="w-80 flex-shrink-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <h3 className="font-medium text-sm">Conversations</h3>
                    <p className="text-xs text-muted-foreground mt-1">{threads.length} thread{threads.length !== 1 ? 's' : ''}</p>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                      {threads.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          No conversations yet
                        </div>
                      ) : (
                        threads
                          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
                          .map((thread) => (
                            <button
                              key={thread.id}
                              onClick={() => setSelectedThreadId(thread.id)}
                              className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                                selectedThreadId === thread.id ? 'bg-muted border-l-2 border-primary' : ''
                              }`}
                              data-testid={`coach-thread-${thread.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                  <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-medium text-sm truncate">{thread.title}</h4>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {formatDateTime(thread.lastMessageAt)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right Column: Thread Messages */}
                <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                  {!selectedThreadId ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="text-sm">Select a conversation to view messages</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Thread Header with Legend */}
                      <div className="p-4 border-b border-border bg-muted/30">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">
                            {threads.find(t => t.id === selectedThreadId)?.title || 'Conversation'}
                          </h3>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                              <span className="text-xs">{selectedClient?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full bg-stone-400" />
                              <span className="text-xs text-muted-foreground">AI</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                              <span className="text-xs text-muted-foreground">You</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Messages or Exercise View */}
                      {threadExerciseSession?.session ? (
                        <ScrollArea className="flex-1">
                          <ExerciseSessionView
                            sessionId={threadExerciseSession.session.id}
                            clientId={selectedClient?.id || ""}
                            editable={true}
                          />
                        </ScrollArea>
                      ) : (
                        <ScrollArea className="flex-1 p-4">
                          <div className="space-y-3">
                            {messages.length === 0 ? (
                              <div className="text-center py-12 text-muted-foreground text-sm">
                                No messages in this thread
                              </div>
                            ) : (
                              messages
                                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                                .map((msg, index) => {
                                  const isAI = msg.role === 'ai';
                                  const isClient = msg.role === 'user';
                                  const isCoach = msg.role === 'coach';
                                  const prevMsg = index > 0 ? messages[index - 1] : null;
                                  const showTimestamp = !prevMsg ||
                                    new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 5 * 60 * 1000;

                                  return (
                                    <div key={msg.id} data-testid={`message-feed-${msg.id}`}>
                                      {showTimestamp && (
                                        <div className="text-center mb-3">
                                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                            {new Date(msg.timestamp).toLocaleString([], {
                                              month: 'short',
                                              day: 'numeric',
                                              hour: 'numeric',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        </div>
                                      )}
                                      <div className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex items-start gap-2 max-w-[85%] ${isCoach ? 'flex-row-reverse' : ''}`}>
                                          <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-0.5 ${
                                            isClient
                                              ? 'bg-sky-100 dark:bg-sky-900/40'
                                              : isCoach
                                              ? 'bg-violet-100 dark:bg-violet-900/40'
                                              : 'bg-stone-200 dark:bg-stone-700'
                                          }`}>
                                            {isClient
                                              ? <User className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                                              : isCoach
                                              ? <span className="text-[9px] font-semibold text-violet-600 dark:text-violet-400">{(user as any)?.firstName?.[0] || 'C'}</span>
                                              : <Bot className="h-3 w-3 text-stone-500 dark:text-stone-400" />
                                            }
                                          </div>
                                          <div className={`rounded-2xl px-4 py-2.5 ${
                                            isClient
                                              ? 'bg-sky-500 text-white rounded-tl-sm'
                                              : isCoach
                                              ? 'bg-violet-500 text-white rounded-tr-sm'
                                              : 'bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-100 rounded-tl-sm'
                                          }`}>
                                            <p className={`text-[10px] font-medium mb-1 ${isCoach ? 'text-violet-100' : 'opacity-70'}`}>
                                              {isClient ? selectedClient?.name : isCoach ? ((user as any)?.firstName || 'Coach') : 'GenaAI'}
                                            </p>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                              {msg.content}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </ScrollArea>
                      )}

                      {/* Coach Message Composer */}
                      <div className="p-3 border-t border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Input
                            value={coachMessage}
                            onChange={(e) => setCoachMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendCoachMessage();
                              }
                            }}
                            placeholder="Send a message to this conversation..."
                            className="flex-1"
                            data-testid="input-coach-message"
                          />
                          <Button
                            size="icon"
                            onClick={handleSendCoachMessage}
                            disabled={!coachMessage.trim() || sendCoachMessageMutation.isPending}
                            className="shrink-0"
                            data-testid="button-send-coach-message"
                          >
                            {sendCoachMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Top Row: Mental Model & Velocity */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Mental Model Card */}
                  <div className="lg:col-span-1 rounded-xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="h-5 w-5 text-primary" />
                      <h3 className="font-medium">AI Mental Model</h3>
                    </div>
                    <div className="space-y-4">
                       <div className="space-y-2">
                         <label className="text-xs text-muted-foreground uppercase tracking-wider">Values / Goals / Life Vision</label>
                         <p className="text-sm text-foreground/80 leading-relaxed">
                           {valuesSection?.content || <span className="text-muted-foreground italic">No values recorded yet</span>}
                         </p>
                       </div>
                       <Separator />
                       <div className="space-y-2">
                         <label className="text-xs text-muted-foreground uppercase tracking-wider">Current Focus Areas</label>
                         <p className="text-sm text-foreground/80 leading-relaxed">
                           {focusSection?.content || <span className="text-muted-foreground italic">No focus areas recorded yet</span>}
                         </p>
                       </div>
                       {highlightsSection?.content && (
                         <>
                           <Separator />
                           <div className="space-y-2">
                             <label className="text-xs text-muted-foreground uppercase tracking-wider">Key Highlights</label>
                             <p className="text-sm text-foreground/80 leading-relaxed">
                               {highlightsSection.content}
                             </p>
                           </div>
                         </>
                       )}
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="lg:col-span-2">
                     <SentimentChart data={sentimentData} />
                  </div>
                </div>

                {/* Signals Feed */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium flex items-center gap-2">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      Recent Signals
                    </h2>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs">Filter by Topic</Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs">Export Summary</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {insights.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        No insights yet for this client
                      </div>
                    ) : (
                      insights.map((insight) => {
                        const iconMap = {
                          "Emotional Spike": AlertCircle,
                          "Recurring Theme": Repeat,
                          "Shift": TrendingUp,
                          "Contradiction": AlertCircle
                        };
                        return (
                          <InsightCard 
                            key={insight.id}
                            category={insight.category}
                            title={insight.title}
                            description={insight.description}
                            timestamp={new Date(insight.timestamp).toLocaleString()}
                            icon={iconMap[insight.category]}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Raw Journal Feed Preview */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                   <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
                     <h3 className="font-medium text-sm">Recent Journal Excerpts (Context)</h3>
                     <Button variant="ghost" size="sm" className="text-xs h-7">View Full Log</Button>
                   </div>
                   <div className="p-6 space-y-4 bg-background/50">
                     {recentUserMessages.length === 0 ? (
                       <div className="text-center py-8 text-muted-foreground text-sm">
                         No journal entries yet from this client
                       </div>
                     ) : (
                       recentUserMessages.map((msg, index) => (
                         <div 
                           key={msg.id} 
                           data-testid={`message-${msg.id}`}
                           className={`pl-4 border-l-2 border-primary/20 space-y-1 ${index > 0 ? 'opacity-70' : ''}`}
                         >
                           <p className="text-xs text-muted-foreground font-mono">
                             {new Date(msg.timestamp).toLocaleString()}
                           </p>
                           <p className="text-sm italic text-foreground/80">"{msg.content}"</p>
                         </div>
                       ))
                     )}
                   </div>
                </div>
              </>
            )}

          </div>
        </ScrollArea>
      </div>

      <ManageClientsDialog
        open={isManageClientsOpen}
        onOpenChange={setIsManageClientsOpen}
        onClientSelect={(clientId) => setSelectedClientId(clientId)}
        selectedClientId={selectedClientId}
      />
    </div>
  );
}
