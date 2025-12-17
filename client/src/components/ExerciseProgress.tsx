import { ChevronRight, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ExerciseStep {
  id: string;
  title: string;
  stepOrder: number;
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
  currentStepId: string | null;
  status: string;
}

interface ExerciseProgressProps {
  exercise: GuidedExercise;
  session: ExerciseSession;
  currentStep: ExerciseStep | null;
  steps: ExerciseStep[];
  onAdvanceStep: () => void;
  onExitExercise: () => void;
  isAdvancing?: boolean;
}

export function ExerciseProgress({
  exercise,
  session,
  currentStep,
  steps,
  onAdvanceStep,
  onExitExercise,
  isAdvancing = false,
}: ExerciseProgressProps) {
  const currentStepIndex = currentStep 
    ? steps.findIndex(s => s.id === currentStep.id) 
    : -1;
  const progress = steps.length > 0 
    ? ((currentStepIndex + 1) / steps.length) * 100 
    : 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isCompleted = session.status === "completed";

  return (
    <div className="border-b bg-primary/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-primary truncate">
            {exercise.title}
          </span>
          {currentStep && (
            <span className="text-xs text-muted-foreground shrink-0">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isCompleted && !isLastStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdvanceStep}
              disabled={isAdvancing}
              className="h-7 text-xs gap-1"
              data-testid="button-next-step"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
          {isCompleted ? (
            <div className="flex items-center gap-1 text-green-600 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExitExercise}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              data-testid="button-exit-exercise"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <Progress value={progress} className="h-1.5" />
      
      {currentStep && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
          {currentStep.title}
        </p>
      )}
    </div>
  );
}
