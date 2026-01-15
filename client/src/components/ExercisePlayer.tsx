import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  SkipForward,
  MessageCircle,
  Send,
  Loader2,
  Check,
  X,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

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
  status: "in_progress" | "completed" | "skipped";
  aiGuidance?: { role: string; content: string; timestamp: string }[];
}

interface GuidedExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
  introText?: string;
  systemPrompt?: string;
}

interface ExercisePlayerProps {
  sessionId: string;
  clientId: string;
  onClose?: () => void;
}

export function ExercisePlayer({ sessionId, clientId, onClose }: ExercisePlayerProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  // -1 = intro screen, 0+ = step index
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [response, setResponse] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidanceMessage, setGuidanceMessage] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch full exercise session data
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/exercise-sessions/${sessionId}/full`],
    queryFn: async () => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/full`);
      if (!res.ok) throw new Error("Failed to load exercise");
      return res.json() as Promise<{
        session: { id: string; exerciseId: string; currentStepId?: string; status: string; summary?: string };
        exercise: GuidedExercise;
        steps: ExerciseStep[];
        responses: ExerciseStepResponse[];
      }>;
    },
  });

  const steps = data?.steps || [];
  const responses = data?.responses || [];
  const hasIntro = data?.exercise?.introText && data.exercise.introText.trim().length > 0;
  const isOnIntro = currentStepIndex === -1 && hasIntro;
  const actualStepIndex = hasIntro ? currentStepIndex : Math.max(0, currentStepIndex);
  const currentStep = steps[actualStepIndex];
  const currentResponse = responses.find(r => r.stepId === currentStep?.id);
  const totalSteps = steps.length;

  // Initialize response from saved data
  useEffect(() => {
    if (isOnIntro) {
      setResponse("");
    } else if (currentResponse) {
      setResponse(currentResponse.response || "");
    } else {
      setResponse("");
    }
  }, [currentResponse, currentStepIndex, isOnIntro]);

  // Auto-save mutation
  const saveResponseMutation = useMutation({
    mutationFn: async ({ stepId, response, status }: { stepId: string; response: string; status: string }) => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/responses/${stepId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, status }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setAutoSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: [`/api/exercise-sessions/${sessionId}/full`] });
    },
    onError: () => {
      setAutoSaveStatus("idle");
    },
  });

  // Auto-save with debounce
  const autoSave = useCallback((newResponse: string, status: string = "in_progress") => {
    if (!currentStep || isOnIntro) return;

    setAutoSaveStatus("saving");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveResponseMutation.mutate({
        stepId: currentStep.id,
        response: newResponse,
        status,
      });
    }, 1000);
  }, [currentStep, saveResponseMutation, isOnIntro]);

  // Handle response change
  const handleResponseChange = (value: string) => {
    setResponse(value);
    autoSave(value);
  };

  // AI Guidance mutation
  const guidanceMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/responses/${currentStep?.id}/guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to get guidance");
      return res.json();
    },
    onSuccess: () => {
      setGuidanceMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/exercise-sessions/${sessionId}/full`] });
    },
  });

  // Generate summary mutation
  const summaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/exercise-sessions/${sessionId}/full`] });
    },
  });

  // Navigation handlers
  const goToStep = (index: number) => {
    // Save current response before navigating (not on intro screen)
    if (!isOnIntro && currentStep && response !== (currentResponse?.response || "")) {
      saveResponseMutation.mutate({
        stepId: currentStep.id,
        response,
        status: response.trim() ? "completed" : "in_progress",
      });
    }
    setCurrentStepIndex(index);
    setShowGuidance(false);
  };

  const handleNext = () => {
    if (isOnIntro) {
      // Move from intro to first step
      goToStep(0);
    } else if (currentStepIndex < totalSteps - 1) {
      goToStep(currentStepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex === 0 && hasIntro) {
      // Go back to intro
      goToStep(-1);
    } else if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep) {
      saveResponseMutation.mutate({
        stepId: currentStep.id,
        response: response,
        status: "skipped",
      });
    }
    if (currentStepIndex < totalSteps - 1) {
      goToStep(currentStepIndex + 1);
    }
  };

  const handleComplete = async () => {
    // Save final response
    if (currentStep) {
      await saveResponseMutation.mutateAsync({
        stepId: currentStep.id,
        response,
        status: response.trim() ? "completed" : "skipped",
      });
    }
    // Generate summary
    await summaryMutation.mutateAsync();
  };

  const handleSendGuidance = () => {
    if (!guidanceMessage.trim()) return;
    guidanceMutation.mutate(guidanceMessage);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(`/inbox/${clientId}`);
    }
  };

  // Get step status
  const getStepStatus = (stepId: string) => {
    const stepResponse = responses.find(r => r.stepId === stepId);
    return stepResponse?.status || "pending";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load exercise</p>
        <Button variant="outline" onClick={handleClose}>Go Back</Button>
      </div>
    );
  }

  // Show summary view if completed
  if (data.session.status === "completed" && data.session.summary) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="flex items-center gap-4 max-w-3xl mx-auto">
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-medium flex-1">{data.exercise.title}</h1>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Check className="h-4 w-4 text-emerald-500" />
              Completed
            </span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-6 space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-medium">Summary</h2>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="whitespace-pre-wrap">{data.session.summary}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => summaryMutation.mutate()}
              disabled={summaryMutation.isPending}
            >
              {summaryMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Regenerate Summary
            </Button>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-muted-foreground">Your Responses</h3>
            {steps.map((step, idx) => {
              const stepResponse = responses.find(r => r.stepId === step.id);
              return (
                <div key={step.id} className="space-y-2">
                  <h4 className="font-medium text-sm">
                    Step {idx + 1}: {step.title}
                    {stepResponse?.status === "skipped" && (
                      <span className="ml-2 text-xs text-muted-foreground">(skipped)</span>
                    )}
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {stepResponse?.response || "(no response)"}
                  </p>
                </div>
              );
            })}
          </div>

          <Button className="w-full" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const guidance = currentResponse?.aiGuidance || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-medium">{data.exercise.title}</h1>
            <p className="text-sm text-muted-foreground">
              {isOnIntro ? "Introduction" : `Step ${currentStepIndex + 1} of ${totalSteps}`}
            </p>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {hasIntro && (
              <button
                onClick={() => goToStep(-1)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  isOnIntro ? "bg-primary scale-125" : "bg-emerald-500"
                )}
                title="Introduction"
              />
            )}
            {steps.map((step, idx) => {
              const status = getStepStatus(step.id);
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(idx)}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-all",
                    idx === currentStepIndex && !isOnIntro
                      ? "bg-primary scale-125"
                      : status === "completed"
                        ? "bg-emerald-500"
                        : status === "skipped"
                          ? "bg-amber-500"
                          : "bg-muted-foreground/30"
                  )}
                  title={`Step ${idx + 1}: ${step.title}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {isOnIntro ? (
            /* Introduction screen */
            <div className="space-y-6">
              <h2 className="text-2xl font-medium">{data.exercise.title}</h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-lg">
                  {data.exercise.introText}
                </p>
              </div>
              {data.exercise.estimatedMinutes && (
                <p className="text-sm text-muted-foreground">
                  Estimated time: {data.exercise.estimatedMinutes} minutes
                </p>
              )}
            </div>
          ) : (
            /* Step content */
            <div className="space-y-3">
              <h2 className="text-xl font-medium">{currentStep?.title}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {currentStep?.instructions}
              </p>
            </div>
          )}

          {/* Response textarea - only show on actual steps, not intro */}
          {!isOnIntro && (
            <>
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={response}
                  onChange={(e) => handleResponseChange(e.target.value)}
                  placeholder="Write your response here..."
                  className="min-h-[200px] text-base resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {autoSaveStatus === "saving" ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    ) : autoSaveStatus === "saved" ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check className="h-3 w-3" />
                        Saved
                      </span>
                    ) : null}
                  </span>
                  <span>{response.length} characters</span>
                </div>
              </div>

              {/* AI Guidance panel */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowGuidance(!showGuidance)}
                  className="w-full px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Need help with this step?
                  <ChevronRight className={cn("h-4 w-4 ml-auto transition-transform", showGuidance && "rotate-90")} />
                </button>

                {showGuidance && (
                  <div className="border-t p-4 space-y-4 bg-muted/20">
                    {guidance.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Ask a question about this step and I'll help guide you.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {guidance.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "p-3 rounded-lg text-sm",
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
                        onClick={handleSendGuidance}
                        disabled={!guidanceMessage.trim() || guidanceMutation.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="sticky bottom-0 border-t bg-background px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {isOnIntro ? (
            /* Intro screen navigation */
            <>
              <div className="flex-1" />
              <Button onClick={handleNext} className="gap-2">
                Begin Exercise
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            /* Step navigation */
            <>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStepIndex === 0 && !hasIntro}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>

              <div className="flex-1" />

              {currentStepIndex === totalSteps - 1 ? (
                <Button onClick={handleComplete} disabled={summaryMutation.isPending}>
                  {summaryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Finishing...
                    </>
                  ) : (
                    "Complete Exercise"
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
