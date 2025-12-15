import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  MoreVertical,
  Trash2,
  UserCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Bot,
  MessageSquare,
  FileText,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  lastActive: string;
  mobileAppConnected: number;
}

interface ManageClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientSelect?: (clientId: string) => void;
  selectedClientId?: string | null;
}

type OnboardingStep = "info" | "role-prompt" | "task-prompt" | "sections" | "complete";

const DEFAULT_ROLE_PROMPT = "You are an empathetic thinking partner. Do not prescribe advice. Ask clarifying questions when needed.";
const DEFAULT_TASK_PROMPT = "Respond reflectively and explore meaning without telling the client what to do. If helpful, ask a clarifying question to deepen understanding.";

export function ManageClientsDialog({ open, onOpenChange, onClientSelect, selectedClientId }: ManageClientsDialogProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("info");
  
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [rolePrompt, setRolePrompt] = useState(DEFAULT_ROLE_PROMPT);
  const [taskPrompt, setTaskPrompt] = useState(DEFAULT_TASK_PROMPT);
  const [initialNotes, setInitialNotes] = useState("");
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create client");
      return res.json();
    },
    onSuccess: (client) => {
      setCreatedClientId(client.id);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  const updateRolePromptMutation = useMutation({
    mutationFn: async ({ clientId, content }: { clientId: string; content: string }) => {
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
    mutationFn: async ({ clientId, content }: { clientId: string; content: string }) => {
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

  const createSectionMutation = useMutation({
    mutationFn: async ({ clientId, section }: { clientId: string; section: { title: string; sectionType: string; content: string; sortOrder: number } }) => {
      const res = await fetch(`/api/clients/${clientId}/document/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(section),
      });
      if (!res.ok) throw new Error("Failed to create section");
      return res.json();
    },
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
      if (deletedClientId === selectedClientId && onClientSelect) {
        const remainingClients = clients.filter(c => c.id !== deletedClientId);
        if (remainingClients.length > 0) {
          onClientSelect(remainingClients[0].id);
        }
      }
    },
    onError: () => {
      toast.error("Failed to delete client. Please try again.");
    },
  });

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetOnboarding = () => {
    setIsCreating(false);
    setOnboardingStep("info");
    setNewClientName("");
    setNewClientEmail("");
    setRolePrompt(DEFAULT_ROLE_PROMPT);
    setTaskPrompt(DEFAULT_TASK_PROMPT);
    setInitialNotes("");
    setCreatedClientId(null);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim() || !newClientEmail.trim()) return;
    try {
      await createClientMutation.mutateAsync({ name: newClientName, email: newClientEmail });
      setOnboardingStep("role-prompt");
    } catch (error) {
      toast.error("Failed to create client. Please try again.");
    }
  };

  const handleSaveRolePrompt = async () => {
    if (!createdClientId) {
      toast.error("Client not found. Please start over.");
      resetOnboarding();
      return;
    }
    try {
      await updateRolePromptMutation.mutateAsync({ clientId: createdClientId, content: rolePrompt });
      setOnboardingStep("task-prompt");
    } catch (error) {
      toast.error("Failed to save role prompt. Please try again.");
    }
  };

  const handleSaveTaskPrompt = async () => {
    if (!createdClientId) {
      toast.error("Client not found. Please start over.");
      resetOnboarding();
      return;
    }
    try {
      await updateTaskPromptMutation.mutateAsync({ clientId: createdClientId, content: taskPrompt });
      setOnboardingStep("sections");
    } catch (error) {
      toast.error("Failed to save task prompt. Please try again.");
    }
  };

  const handleSaveInitialNotes = async () => {
    if (!createdClientId) {
      toast.error("Client not found. Please start over.");
      resetOnboarding();
      return;
    }
    try {
      if (initialNotes.trim()) {
        await createSectionMutation.mutateAsync({
          clientId: createdClientId,
          section: {
            title: "Initial Notes",
            sectionType: "context",
            content: initialNotes,
            sortOrder: 0,
          },
        });
      }
      setOnboardingStep("complete");
      toast.success(`${newClientName} has been set up successfully!`);
    } catch (error) {
      toast.error("Failed to save initial notes. Please try again.");
    }
  };

  const handleFinishOnboarding = () => {
    if (createdClientId && onClientSelect) {
      onClientSelect(createdClientId);
    }
    resetOnboarding();
    onOpenChange(false);
  };

  const stepNumber = {
    info: 1,
    "role-prompt": 2,
    "task-prompt": 3,
    sections: 4,
    complete: 5,
  };

  const renderOnboardingContent = () => {
    switch (onboardingStep) {
      case "info":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium">Client Information</h3>
              <p className="text-sm text-muted-foreground">
                Enter the basic details for your new client
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  placeholder="e.g., Sarah Chen"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  data-testid="input-new-client-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="e.g., sarah@example.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  data-testid="input-new-client-email"
                />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={resetOnboarding} data-testid="button-cancel-onboarding">
                Cancel
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={!newClientName.trim() || !newClientEmail.trim() || createClientMutation.isPending}
                className="gap-2"
                data-testid="button-next-step"
              >
                {createClientMutation.isPending ? "Creating..." : "Next"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "role-prompt":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium">AI Personality</h3>
              <p className="text-sm text-muted-foreground">
                Define how the AI should behave with {newClientName}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role Prompt</label>
              <Textarea
                value={rolePrompt}
                onChange={(e) => setRolePrompt(e.target.value)}
                placeholder="Define the AI's personality..."
                className="min-h-[120px]"
                data-testid="textarea-onboarding-role"
              />
              <p className="text-xs text-muted-foreground">
                This defines who the AI is when talking to this client
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setOnboardingStep("info")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSaveRolePrompt}
                  disabled={updateRolePromptMutation.isPending}
                  className="gap-2"
                  data-testid="button-next-step"
                >
                  {updateRolePromptMutation.isPending ? "Saving..." : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                data-testid="link-do-this-later"
              >
                Do this later
              </button>
            </div>
          </div>
        );

      case "task-prompt":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium">Response Style</h3>
              <p className="text-sm text-muted-foreground">
                Define how the AI should respond to {newClientName}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Task Prompt</label>
              <Textarea
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                placeholder="Define response instructions..."
                className="min-h-[120px]"
                data-testid="textarea-onboarding-task"
              />
              <p className="text-xs text-muted-foreground">
                Instructions for how the AI structures its responses
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setOnboardingStep("role-prompt")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSaveTaskPrompt}
                  disabled={updateTaskPromptMutation.isPending}
                  className="gap-2"
                  data-testid="button-next-step"
                >
                  {updateTaskPromptMutation.isPending ? "Saving..." : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                data-testid="link-do-this-later"
              >
                Do this later
              </button>
            </div>
          </div>
        );

      case "sections":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium">Initial Notes</h3>
              <p className="text-sm text-muted-foreground">
                Add any context or background for {newClientName}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                value={initialNotes}
                onChange={(e) => setInitialNotes(e.target.value)}
                placeholder="What should the AI know about this client? Goals, challenges, background..."
                className="min-h-[140px]"
                data-testid="textarea-onboarding-notes"
              />
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setOnboardingStep("task-prompt")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSaveInitialNotes}
                  disabled={createSectionMutation.isPending}
                  className="gap-2"
                  data-testid="button-next-step"
                >
                  {createSectionMutation.isPending ? "Saving..." : "Finish Setup"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                data-testid="link-do-this-later"
              >
                Do this later
              </button>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="space-y-6 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Client Created!</h3>
              <p className="text-sm text-muted-foreground">
                {newClientName} is now set up and ready to start conversations
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
              <p className="text-sm font-medium">What's next?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Share the mobile app link with {newClientName}</li>
                <li>• Review and customize the AI prompts anytime</li>
                <li>• Add more sections to their profile</li>
              </ul>
            </div>
            <Button onClick={handleFinishOnboarding} className="w-full gap-2" data-testid="button-finish-onboarding">
              <Sparkles className="h-4 w-4" />
              Go to {newClientName}'s Profile
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="manage-clients-dialog">
        {isCreating ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Client Setup
              </DialogTitle>
              <div className="flex items-center gap-2 pt-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      step <= stepNumber[onboardingStep]
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </DialogHeader>
            <div className="py-4">{renderOnboardingContent()}</div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Clients
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-clients"
                  />
                </div>
                <Button onClick={() => setIsCreating(true)} className="gap-2" data-testid="button-add-client">
                  <Plus className="h-4 w-4" />
                  Add Client
                </Button>
              </div>

              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading clients...
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No clients match your search" : "No clients yet"}
                    </p>
                    {!searchQuery && (
                      <Button variant="outline" onClick={() => setIsCreating(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Your First Client
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        data-testid={`client-row-${client.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {client.name.split(" ").map((n) => n[0]).join("")}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={client.mobileAppConnected ? "default" : "outline"}
                            className="text-xs"
                          >
                            {client.mobileAppConnected ? "Connected" : "Pending"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (onClientSelect) onClientSelect(client.id);
                              onOpenChange(false);
                            }}
                            data-testid={`button-view-client-${client.id}`}
                          >
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${client.name}?`)) {
                                    deleteClientMutation.mutate(client.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
