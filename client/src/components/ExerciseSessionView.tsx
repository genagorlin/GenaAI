import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Loader2, ExternalLink, Pencil, Save, X, Sparkles, Maximize2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ExerciseStep {
  id: string;
  exerciseId: string;
  title: string;
  instructions: string;
  completionCriteria?: string;
  supportingMaterial?: string;
  stepOrder: number;
}

interface ExerciseStepResponse {
  id: string;
  sessionId: string;
  stepId: string;
  response: string;
  status: string;
  aiGuidance?: { role: string; content: string; timestamp: string }[];
}

interface ExerciseSessionViewProps {
  sessionId: string;
  clientId: string;
  editable?: boolean;
  onOpenFullView?: () => void;
}

export function ExerciseSessionView({ sessionId, clientId, editable = true, onOpenFullView }: ExerciseSessionViewProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [expandedResponse, setExpandedResponse] = useState<{ stepTitle: string; response: string } | null>(null);
  const [showAllResponses, setShowAllResponses] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/exercise-sessions", sessionId, "full"],
    queryFn: async () => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/full`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exercise session");
      return res.json() as Promise<{
        session: { id: string; status: string; summary?: string };
        exercise: { id: string; title: string; description: string; introText?: string };
        steps: ExerciseStep[];
        responses: ExerciseStepResponse[];
      }>;
    },
    enabled: !!sessionId,
  });

  const saveResponseMutation = useMutation({
    mutationFn: async ({ stepId, response }: { stepId: string; response: string }) => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/responses/${stepId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response, status: "in_progress" }),
      });
      if (!res.ok) throw new Error("Failed to save response");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-sessions", sessionId, "full"] });
      setEditingStepId(null);
      setEditingText("");
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-sessions", sessionId, "full"] });
    },
  });

  const startEditing = (stepId: string, currentResponse: string) => {
    setEditingStepId(stepId);
    setEditingText(currentResponse || "");
  };

  const cancelEditing = () => {
    setEditingStepId(null);
    setEditingText("");
  };

  const saveEditing = () => {
    if (editingStepId) {
      saveResponseMutation.mutate({ stepId: editingStepId, response: editingText });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Unable to load exercise data
      </div>
    );
  }

  const { session, exercise, steps, responses } = data;
  const isCompleted = session.status === "completed";
  const currentStep = steps[currentStepIndex];
  const currentResponse = responses.find(r => r.stepId === currentStep?.id);

  const goToPrevStep = () => setCurrentStepIndex(Math.max(0, currentStepIndex - 1));
  const goToNextStep = () => setCurrentStepIndex(Math.min(steps.length - 1, currentStepIndex + 1));

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{exercise.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{exercise.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700">
                  <Check className="h-3 w-3" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline">In Progress</Badge>
              )}
              {responses.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowAllResponses(true)} className="gap-1">
                  <List className="h-3 w-3" />
                  All Responses
                </Button>
              )}
              {onOpenFullView && (
                <Button variant="outline" size="sm" onClick={onOpenFullView} className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Open Full View
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Section */}
      {session.summary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.summary}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI Summary</p>
                <p className="text-xs text-muted-foreground">
                  Generate an AI summary of your exercise responses
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending || responses.length === 0}
                className="gap-2"
              >
                {generateSummaryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Navigation */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevStep}
          disabled={currentStepIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => {
            const stepResponse = responses.find(r => r.stepId === step.id);
            const hasResponse = stepResponse?.response && stepResponse.response.trim().length > 0;
            const isSkipped = stepResponse?.status === "skipped";
            const isCurrent = idx === currentStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all",
                  isCurrent ? "w-6 bg-primary" :
                  isSkipped ? "bg-muted-foreground/30" :
                  hasResponse ? "bg-emerald-500" : "bg-muted-foreground/50"
                )}
                title={`Step ${idx + 1}: ${step.title}`}
              />
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextStep}
          disabled={currentStepIndex === steps.length - 1}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Current Step */}
      {currentStep && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              {currentResponse?.status === "skipped" && (
                <Badge variant="outline" className="text-xs">Skipped</Badge>
              )}
            </div>
            <CardTitle className="text-base">{currentStep.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Instructions */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Instructions
              </label>
              <p className="text-sm whitespace-pre-wrap text-foreground/80">
                {currentStep.instructions}
              </p>
            </div>

            {/* Response */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </label>
                <div className="flex items-center gap-1">
                  {currentResponse?.response && currentResponse.response.length > 200 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedResponse({
                        stepTitle: currentStep.title,
                        response: currentResponse.response
                      })}
                      className="h-6 px-2 text-xs gap-1"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Expand
                    </Button>
                  )}
                  {editable && editingStepId !== currentStep.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(currentStep.id, currentResponse?.response || "")}
                      className="h-6 px-2 text-xs gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
              {editingStepId === currentStep.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    placeholder="Enter your response..."
                    className="min-h-[150px] text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEditing}
                      disabled={saveResponseMutation.isPending}
                      className="gap-1"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEditing}
                      disabled={saveResponseMutation.isPending}
                      className="gap-1"
                    >
                      {saveResponseMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-lg bg-muted/50 border min-h-[100px]"
                >
                  {currentResponse?.response ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{currentResponse.response}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {editable ? "Click 'Edit' to add a response" : "No response yet"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* AI Guidance (if any) */}
            {currentResponse?.aiGuidance && currentResponse.aiGuidance.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  AI Guidance
                </label>
                <div className="space-y-2">
                  {currentResponse.aiGuidance.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg text-sm",
                        msg.role === "user"
                          ? "bg-primary/10 ml-8"
                          : "bg-muted/50 border mr-8"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expanded Response Modal */}
      <Dialog open={!!expandedResponse} onOpenChange={() => setExpandedResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{expandedResponse?.stepTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {expandedResponse?.response}
            </p>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* All Responses Modal */}
      <Dialog open={showAllResponses} onOpenChange={setShowAllResponses}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{exercise.title} - All Responses</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {steps.map((step, idx) => {
                const stepResponse = responses.find(r => r.stepId === step.id);
                return (
                  <div key={step.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Step {idx + 1}
                      </Badge>
                      <h3 className="font-medium">{step.title}</h3>
                    </div>
                    <div className="pl-4 border-l-2 border-muted">
                      {stepResponse?.response ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                          {stepResponse.response}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No response</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
