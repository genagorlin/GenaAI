import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageCircle, Loader2, ChevronRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

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
  
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [newTitle, setNewTitle] = useState("");

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

  const renameThreadMutation = useMutation({
    mutationFn: async ({ threadId, title }: { threadId: string; title: string }) => {
      const res = await fetch(`/api/threads/${threadId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename thread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "threads"] });
      setRenameDialogOpen(false);
      setSelectedThread(null);
      setNewTitle("");
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete thread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "threads"] });
      setDeleteDialogOpen(false);
      setSelectedThread(null);
    },
  });

  const handleNewThread = () => {
    createThreadMutation.mutate();
  };

  const handleOpenThread = (threadId: string) => {
    setLocation(`/chat/${clientId}/${threadId}`);
  };

  const handleRenameClick = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThread(thread);
    setNewTitle(thread.title);
    setRenameDialogOpen(true);
  };

  const handleDeleteClick = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThread(thread);
    setDeleteDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    if (selectedThread && newTitle.trim()) {
      renameThreadMutation.mutate({ threadId: selectedThread.id, title: newTitle.trim() });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedThread) {
      deleteThreadMutation.mutate(selectedThread.id);
    }
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
        <div className="flex items-center gap-3 bg-[hsl(var(--wa-header))] p-3 text-white shadow-md">
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
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => handleOpenThread(thread.id)}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                        data-testid={`thread-menu-${thread.id}`}
                      >
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => handleRenameClick(thread, e as any)}
                        data-testid={`thread-rename-${thread.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleDeleteClick(thread, e as any)}
                        className="text-red-600 focus:text-red-600"
                        data-testid={`thread-delete-${thread.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>

        {threads.length > 0 && (
          <button
            onClick={handleNewThread}
            disabled={createThreadMutation.isPending}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
            data-testid="button-new-conversation"
            aria-label="New conversation"
          >
            {createThreadMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Plus className="h-6 w-6" />
            )}
          </button>
        )}
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter new title"
            data-testid="input-rename-thread"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenameSubmit} 
              disabled={renameThreadMutation.isPending || !newTitle.trim()}
              data-testid="button-confirm-rename"
            >
              {renameThreadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedThread?.title}" and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteThreadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
