import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Clock, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface GuidedExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
}

interface ExerciseMenuProps {
  clientId: string;
  threadId?: string;
  onSelectExercise: (exercise: GuidedExercise) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseMenu({ 
  clientId, 
  threadId, 
  onSelectExercise, 
  isOpen, 
  onOpenChange 
}: ExerciseMenuProps) {
  const { data: exercises = [], isLoading } = useQuery<GuidedExercise[]>({
    queryKey: ["/api/exercises"],
    queryFn: async () => {
      const res = await fetch("/api/exercises");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const groupedExercises = exercises.reduce((acc, exercise) => {
    const category = exercise.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(exercise);
    return acc;
  }, {} as Record<string, GuidedExercise[]>);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Guided Exercises
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(70vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : exercises.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No exercises available yet.</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedExercises).map(([category, categoryExercises]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryExercises.map((exercise) => (
                      <button
                        key={exercise.id}
                        onClick={() => {
                          onSelectExercise(exercise);
                          onOpenChange(false);
                        }}
                        className="w-full text-left p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                        data-testid={`exercise-option-${exercise.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{exercise.title}</span>
                              {exercise.estimatedMinutes && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {exercise.estimatedMinutes}m
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {exercise.description}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
