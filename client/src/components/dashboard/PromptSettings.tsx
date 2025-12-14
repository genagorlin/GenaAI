import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bot, 
  MessageSquare, 
  ChevronDown, 
  ChevronRight,
  Save,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

interface PromptSettingsProps {
  clientId: string;
}

const DEFAULT_ROLE_PROMPT = "You are an empathetic thinking partner. Do not prescribe advice. Ask clarifying questions when needed.";
const DEFAULT_TASK_PROMPT = "Respond reflectively and explore meaning without telling the client what to do. If helpful, ask a clarifying question to deepen understanding.";

export function PromptSettings({ clientId }: PromptSettingsProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [roleContent, setRoleContent] = useState("");
  const [taskContent, setTaskContent] = useState("");
  const [hasRoleChanges, setHasRoleChanges] = useState(false);
  const [hasTaskChanges, setHasTaskChanges] = useState(false);

  const { data, isLoading } = useQuery<{ rolePrompt: RolePrompt; taskPrompt: TaskPrompt }>({
    queryKey: ["/api/clients", clientId, "prompts"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/prompts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prompts");
      const result = await res.json();
      setRoleContent(result.rolePrompt.content);
      setTaskContent(result.taskPrompt.content);
      setHasRoleChanges(false);
      setHasTaskChanges(false);
      return result;
    },
    enabled: !!clientId,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "prompts"] });
      setHasRoleChanges(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "prompts"] });
      setHasTaskChanges(false);
    },
  });

  const handleRoleChange = (value: string) => {
    setRoleContent(value);
    setHasRoleChanges(value !== data?.rolePrompt.content);
  };

  const handleTaskChange = (value: string) => {
    setTaskContent(value);
    setHasTaskChanges(value !== data?.taskPrompt.content);
  };

  const saveRolePrompt = () => {
    updateRolePromptMutation.mutate(roleContent);
  };

  const saveTaskPrompt = () => {
    updateTaskPromptMutation.mutate(taskContent);
  };

  const resetRolePrompt = () => {
    setRoleContent(DEFAULT_ROLE_PROMPT);
    setHasRoleChanges(DEFAULT_ROLE_PROMPT !== data?.rolePrompt.content);
  };

  const resetTaskPrompt = () => {
    setTaskContent(DEFAULT_TASK_PROMPT);
    setHasTaskChanges(DEFAULT_TASK_PROMPT !== data?.taskPrompt.content);
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid="prompt-settings">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors"
        data-testid="toggle-prompt-settings"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">AI Prompt Settings</span>
          <span className="text-xs text-muted-foreground">
            Customize how the AI responds to this client
          </span>
        </div>
        {(hasRoleChanges || hasTaskChanges) && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-400">
            Unsaved changes
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Role Prompt</label>
                <span className="text-xs text-muted-foreground">(AI personality)</span>
              </div>
              <div className="flex items-center gap-2">
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveRolePrompt}
                  disabled={!hasRoleChanges || updateRolePromptMutation.isPending}
                  className="h-7 text-xs gap-1"
                  data-testid="button-save-role"
                >
                  <Save className="h-3 w-3" />
                  Save
                </Button>
              </div>
            </div>
            <Textarea
              value={roleContent}
              onChange={(e) => handleRoleChange(e.target.value)}
              placeholder="Define the AI's personality and behavior..."
              className="min-h-[80px] resize-none text-sm"
              data-testid="textarea-role-prompt"
            />
            <p className="text-xs text-muted-foreground">
              This defines who the AI is when talking to this client. Keep it under 500 tokens.
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Task Prompt</label>
                <span className="text-xs text-muted-foreground">(Response instructions)</span>
              </div>
              <div className="flex items-center gap-2">
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveTaskPrompt}
                  disabled={!hasTaskChanges || updateTaskPromptMutation.isPending}
                  className="h-7 text-xs gap-1"
                  data-testid="button-save-task"
                >
                  <Save className="h-3 w-3" />
                  Save
                </Button>
              </div>
            </div>
            <Textarea
              value={taskContent}
              onChange={(e) => handleTaskChange(e.target.value)}
              placeholder="Define how the AI should respond..."
              className="min-h-[80px] resize-none text-sm"
              data-testid="textarea-task-prompt"
            />
            <p className="text-xs text-muted-foreground">
              This tells the AI how to structure its responses. Keep it under 500 tokens.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
