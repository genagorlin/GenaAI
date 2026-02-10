import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageCircle, Loader2, ChevronRight, FileText, BookOpen, ArrowLeft, Dumbbell, Clock, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientDocumentView } from "@/components/ClientDocumentView";
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

interface GuidedExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
  sortOrder?: number;
}

function formatWhatsAppTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateFormatted = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateFormatted}, ${timeStr}`;
}

export default function InboxPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"chat" | "exercises" | "document" | "library">("chat");
  const [selectedDocument, setSelectedDocument] = useState<{ id: number; title: string; content: string; description: string | null } | null>(null);

  // Check if user is authenticated for client access
  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { authenticated: false };
      return res.json();
    },
    retry: false
  });

  // Redirect to client login if not authenticated
  useEffect(() => {
    if (!authLoading && authStatus && !authStatus.authenticated && clientId) {
      const returnTo = encodeURIComponent(`/inbox/${clientId}`);
      window.location.href = `/api/client/login?returnTo=${returnTo}`;
    }
  }, [authLoading, authStatus, clientId]);

  const { data: client, error: clientError } = useQuery<Client>({
    queryKey: ["/api/chat", clientId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${clientId}/info`);
      if (res.status === 401) {
        // Session upgrade required or not authenticated - redirect to login
        const returnTo = encodeURIComponent(`/inbox/${clientId}`);
        window.location.href = `/api/client/login?returnTo=${returnTo}`;
        throw new Error("reauth-required");
      }
      if (res.status === 403) {
        throw new Error("email-mismatch");
      }
      if (res.status === 404) {
        throw new Error("not-found");
      }
      if (!res.ok) throw new Error("unknown");
      return res.json();
    },
    enabled: !!clientId && authStatus?.authenticated,
    retry: false,
  });

  // Handle access denied - redirect to access denied page
  useEffect(() => {
    if (clientError && clientError.message !== "reauth-required") {
      const reason = clientError.message === "email-mismatch" ? "email-mismatch" : 
                     clientError.message === "not-found" ? "not-found" : "unknown";
      setLocation(`/client-access-denied?reason=${reason}&clientId=${clientId}`);
    }
  }, [clientError, clientId, setLocation]);

  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ["/api/clients", clientId, "threads"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/threads`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: referenceDocuments = [] } = useQuery<{ id: number; title: string; content: string; description: string | null }[]>({
    queryKey: ["/api/reference-documents"],
    queryFn: async () => {
      const res = await fetch("/api/reference-documents");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "library",
    staleTime: 5 * 60 * 1000,
  });

  const { data: exercises = [], isLoading: exercisesLoading } = useQuery<GuidedExercise[]>({
    queryKey: ["/api/exercises"],
    queryFn: async () => {
      const res = await fetch("/api/exercises");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "exercises",
    staleTime: 5 * 60 * 1000,
  });

  // Exercises come pre-sorted by sortOrder from the server
  // Group by category while preserving sortOrder within each category
  const groupedExercises = exercises.reduce((acc, exercise) => {
    const category = exercise.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(exercise);
    return acc;
  }, {} as Record<string, GuidedExercise[]>);

  // Sort categories by the lowest sortOrder of exercises within each category
  const sortedCategories = Object.keys(groupedExercises).sort((a, b) => {
    const aMinOrder = Math.min(...groupedExercises[a].map(e => e.sortOrder ?? 0));
    const bMinOrder = Math.min(...groupedExercises[b].map(e => e.sortOrder ?? 0));
    return aMinOrder - bMinOrder;
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

  const startExerciseMutation = useMutation({
    mutationFn: async (exercise: GuidedExercise) => {
      // Fetch exercise steps to get the first step ID
      const stepsRes = await fetch(`/api/exercises/${exercise.id}/steps`);
      const steps = await stepsRes.json();
      const firstStep = steps.length > 0 ? steps[0] : null;

      // Pass exerciseId when creating thread so the opening message is exercise-specific
      const threadRes = await fetch(`/api/clients/${clientId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: exercise.title, exerciseId: exercise.id }),
      });
      if (!threadRes.ok) throw new Error("Failed to create thread");
      const thread = await threadRes.json();

      const sessionRes = await fetch(`/api/clients/${clientId}/exercise-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: exercise.id,
          threadId: thread.id,
          currentStepId: firstStep?.id || null,
          status: "in_progress",
        }),
      });
      if (!sessionRes.ok) throw new Error("Failed to start exercise");
      const session = await sessionRes.json();

      return { thread, exercise, session };
    },
    onSuccess: ({ session }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "threads"] });
      // Navigate to the ExercisePlayer page-by-page format
      setLocation(`/exercise/${clientId}/${session.id}`);
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return threadId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "threads"] });
      toast.success("Conversation deleted");
    },
    onError: () => {
      toast.error("Failed to delete conversation");
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

  // Show loading while checking auth
  if (authLoading || (!authStatus?.authenticated)) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
      <div className="w-full h-full sm:max-w-[450px] lg:max-w-[700px] xl:max-w-[900px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden flex flex-col relative">
        <div className="bg-[hsl(var(--wa-header))] text-white shadow-md">
          <div className="flex items-center gap-3 p-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
              <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-lg">
                G
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="truncate text-lg font-medium leading-tight" data-testid="text-inbox-title">
                GenaAI
              </h2>
              <p className="truncate text-xs text-white/80">
                {client?.name ? `Hi ${client.name.split(' ')[0]}!` : 'Your thinking partner'}
              </p>
            </div>
            <Link href={`/contact/${clientId}`}>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white text-xs font-medium transition-colors"
                title="Contact Gena"
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Contact Gena</span>
              </button>
            </Link>
          </div>
          <div className="flex border-t border-white/10">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1 ${
                activeTab === "chat" 
                  ? "bg-white/10 text-white border-b-2 border-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
              data-testid="tab-chat"
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab("exercises")}
              className={`flex-1 py-2 text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1 ${
                activeTab === "exercises" 
                  ? "bg-white/10 text-white border-b-2 border-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
              data-testid="tab-exercises"
            >
              <Dumbbell className="h-4 w-4" />
              Exercises
            </button>
            <button
              onClick={() => setActiveTab("document")}
              className={`flex-1 py-2 text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1 ${
                activeTab === "document" 
                  ? "bg-white/10 text-white border-b-2 border-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
              data-testid="tab-document"
            >
              <FileText className="h-4 w-4" />
              Document
            </button>
            <button
              onClick={() => { setActiveTab("library"); setSelectedDocument(null); }}
              className={`flex-1 py-2 text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1 ${
                activeTab === "library" 
                  ? "bg-white/10 text-white border-b-2 border-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
              data-testid="tab-library"
            >
              <BookOpen className="h-4 w-4" />
              Library
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
                    <div
                      key={thread.id}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                      data-testid={`thread-item-${thread.id}`}
                    >
                      <button
                        onClick={() => handleOpenThread(thread.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`delete-thread-${thread.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{thread.title}"? This will permanently remove all messages in this conversation.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteThreadMutation.mutate(thread.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
        ) : activeTab === "exercises" ? (
          <div className="flex-1 overflow-y-auto bg-white">
            {exercisesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : exercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <Dumbbell className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No exercises yet</h3>
                <p className="text-sm text-slate-500">
                  Guided exercises from your coach will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="p-4 bg-slate-50 border-b">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-amber-600" />
                    Guided Exercises
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Structured activities to deepen your reflection
                  </p>
                </div>
                {sortedCategories.map((category) => (
                  <div key={category}>
                    <div className="px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {category}
                    </div>
                    {groupedExercises[category].map((exercise) => (
                      <button
                        key={exercise.id}
                        onClick={() => startExerciseMutation.mutate(exercise)}
                        disabled={startExerciseMutation.isPending}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 disabled:opacity-50"
                        data-testid={`exercise-item-${exercise.id}`}
                      >
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Dumbbell className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium text-slate-900 truncate text-[15px]">
                              {exercise.title}
                            </h3>
                            {exercise.estimatedMinutes && (
                              <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                <Clock className="h-3 w-3" />
                                {exercise.estimatedMinutes}m
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">
                            {exercise.description}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "document" ? (
          <div className="flex-1 overflow-hidden bg-slate-50">
            <ClientDocumentView clientId={clientId!} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-white">
            {selectedDocument ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 p-4 border-b bg-slate-50 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDocument(null)}
                    className="h-8 w-8"
                    data-testid="button-library-back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">{selectedDocument.title}</h3>
                    {selectedDocument.description && (
                      <p className="text-sm text-muted-foreground truncate">{selectedDocument.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed">
                    {selectedDocument.content}
                  </div>
                </div>
              </div>
            ) : referenceDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No writings yet</h3>
                <p className="text-sm text-slate-500">
                  Your coach's writings and materials will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="p-4 bg-slate-50 border-b">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-violet-600" />
                    Gena's Writings
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Explore the ideas and frameworks that inform your coaching sessions
                  </p>
                </div>
                {referenceDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    data-testid={`library-document-${doc.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <BookOpen className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate text-[15px]">
                        {doc.title}
                      </h3>
                      {doc.description && (
                        <p className="text-sm text-slate-500 truncate mt-0.5">
                          {doc.description}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {Math.round(doc.content.split(/\s+/).length)} words
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
