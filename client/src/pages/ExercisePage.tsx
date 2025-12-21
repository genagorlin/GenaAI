import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface ExerciseStep {
  id: string;
  title: string;
  instructions: string;
  stepOrder: number;
  completionCriteria: string | null;
  supportingMaterial: string | null;
}

interface GuidedExercise {
  id: string;
  title: string;
  description: string;
}

interface ExerciseSession {
  id: string;
  clientId: string;
  exerciseId: string;
  threadId: string | null;
  currentStepId: string | null;
  status: string;
}

interface StepResponse {
  id: string;
  sessionId: string;
  stepId: string;
  clientAnswer: string;
  aiFeedback: string | null;
  needsRevision: number;
  submittedAt: string | null;
}

export default function ExercisePage() {
  const { clientId, sessionId } = useParams<{ clientId: string; sessionId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  const { data: sessionData, isLoading: sessionLoading } = useQuery<{
    session: ExerciseSession;
    exercise: GuidedExercise;
    steps: ExerciseStep[];
  }>({
    queryKey: ["/api/exercise-sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!sessionId,
  });

  const { data: responses = [], refetch: refetchResponses } = useQuery<StepResponse[]>({
    queryKey: ["/api/exercises/sessions", sessionId, "responses"],
    queryFn: async () => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/responses`);
      if (!res.ok) throw new Error("Failed to fetch responses");
      return res.json();
    },
    enabled: !!sessionId,
  });

  const session = sessionData?.session;
  const exercise = sessionData?.exercise;
  const steps = sessionData?.steps || [];
  const currentStep = steps[currentStepIndex];
  const currentResponse = responses.find(r => r.stepId === currentStep?.id);

  useEffect(() => {
    if (currentResponse) {
      setAnswer(currentResponse.clientAnswer || "");
    } else {
      setAnswer("");
    }
  }, [currentResponse, currentStepIndex]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentStepIndex]);

  const submitResponseMutation = useMutation({
    mutationFn: async ({ stepId, clientAnswer }: { stepId: string; clientAnswer: string }) => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/steps/${stepId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientAnswer }),
      });
      if (!res.ok) throw new Error("Failed to save response");
      return res.json();
    },
    onSuccess: () => {
      refetchResponses();
    },
  });

  const reviewResponseMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/steps/${stepId}/review`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to review response");
      return res.json();
    },
    onSuccess: (response: StepResponse) => {
      refetchResponses();
      if (response.needsRevision) {
        toast.info("The AI has some feedback on your answer");
      }
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (updates: Partial<ExerciseSession>) => {
      const res = await fetch(`/api/exercise-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-sessions", sessionId] });
    },
  });

  const handleSubmitAndContinue = async () => {
    if (!currentStep || !answer.trim()) return;
    
    setIsReviewing(true);
    try {
      await submitResponseMutation.mutateAsync({
        stepId: currentStep.id,
        clientAnswer: answer.trim(),
      });
      
      const reviewResult = await reviewResponseMutation.mutateAsync(currentStep.id);
      
      if (reviewResult.needsRevision) {
        setIsReviewing(false);
        return;
      }
      
      if (currentStepIndex < steps.length - 1) {
        const nextStep = steps[currentStepIndex + 1];
        await updateSessionMutation.mutateAsync({ currentStepId: nextStep.id });
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        await updateSessionMutation.mutateAsync({ 
          status: "completed",
          currentStepId: null,
        });
        toast.success("Exercise completed!");
        if (session?.threadId) {
          setLocation(`/chat/${clientId}/${session.threadId}`);
        } else {
          setLocation(`/inbox/${clientId}`);
        }
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleGoBack = async () => {
    if (currentStepIndex > 0) {
      if (answer.trim() && currentStep) {
        await submitResponseMutation.mutateAsync({
          stepId: currentStep.id,
          clientAnswer: answer.trim(),
        });
      }
      const prevStep = steps[currentStepIndex - 1];
      await updateSessionMutation.mutateAsync({ currentStepId: prevStep.id });
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleExit = () => {
    if (session?.threadId) {
      setLocation(`/chat/${clientId}/${session.threadId}`);
    } else {
      setLocation(`/inbox/${clientId}`);
    }
  };

  if (sessionLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session || !exercise || steps.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Exercise not found or has no steps</p>
          <Button variant="outline" onClick={() => setLocation(`/inbox/${clientId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inbox
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const hasAnswer = answer.trim().length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-primary truncate" data-testid="text-exercise-title">
                {exercise.title}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExit}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              data-testid="button-exit-exercise"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" data-testid="text-step-title">
                {currentStep?.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-step-instructions">
                {currentStep?.instructions}
              </p>
              
              {currentStep?.supportingMaterial && (
                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                  <p className="font-medium text-xs uppercase text-muted-foreground mb-2">Reference</p>
                  <p className="whitespace-pre-wrap">{currentStep.supportingMaterial}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[150px] resize-none"
              data-testid="input-step-answer"
              disabled={isReviewing}
            />
            
            {currentResponse?.needsRevision === 1 && currentResponse?.aiFeedback && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">Feedback</p>
                  <p className="text-sm text-amber-700" data-testid="text-ai-feedback">
                    {currentResponse.aiFeedback}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t px-4 py-4 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={handleGoBack}
            disabled={isFirstStep || isReviewing}
            data-testid="button-prev-step"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <Button
            onClick={handleSubmitAndContinue}
            disabled={!hasAnswer || isReviewing}
            data-testid="button-next-step"
          >
            {isReviewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reviewing...
              </>
            ) : isLastStep ? (
              <>
                Complete
                <CheckCircle2 className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
