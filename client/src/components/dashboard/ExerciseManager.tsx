import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dumbbell, 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowLeft
} from "lucide-react";
import { FileAttachments } from "@/components/FileAttachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ExerciseStep {
  id: string;
  exerciseId: string;
  title: string;
  instructions: string;
  completionCriteria?: string;
  supportingMaterial?: string;
  stepOrder: number;
  nextStepId?: string;
}

interface GuidedExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
  systemPrompt: string;
  isPublished: number;
  sortOrder: number;
  steps?: ExerciseStep[];
}

const CATEGORIES = ["Values", "Emotions", "Beliefs", "Goals", "Habits", "Decisions", "Interpersonal"];

type ViewMode = "list" | "edit";

export function ExerciseManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingExercise, setEditingExercise] = useState<GuidedExercise | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [editingStep, setEditingStep] = useState<ExerciseStep | null>(null);
  const [isAddingStep, setIsAddingStep] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState({ 
    title: "", 
    description: "", 
    category: "",
    estimatedMinutes: 15,
    systemPrompt: "" 
  });
  const [newStep, setNewStep] = useState({
    title: "",
    instructions: "",
    completionCriteria: "",
    supportingMaterial: ""
  });
  
  const queryClient = useQueryClient();

  const { data: exercises = [], isLoading } = useQuery<GuidedExercise[]>({
    queryKey: ["/api/coach/exercises"],
    enabled: isOpen,
  });

  const createExerciseMutation = useMutation({
    mutationFn: async (exercise: typeof newExercise) => {
      const res = await fetch("/api/coach/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exercise),
      });
      if (!res.ok) throw new Error("Failed to create exercise");
      return res.json();
    },
    onSuccess: (newEx) => {
      const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/exercises"], [...currentData, newEx]);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      }
      setIsCreating(false);
      setNewExercise({ title: "", description: "", category: "", estimatedMinutes: 15, systemPrompt: "" });
      toast.success("Exercise created");
    },
    onError: () => {
      toast.error("Failed to create exercise");
    },
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GuidedExercise> & { id: string }) => {
      const res = await fetch(`/api/coach/exercises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update exercise");
      return res.json();
    },
    onSuccess: (updatedEx, variables) => {
      const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/exercises"], 
          currentData.map(e => e.id === variables.id ? { ...e, ...variables } : e)
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      }
      setViewMode("list");
      setEditingExercise(null);
      toast.success("Exercise updated");
    },
    onError: () => {
      toast.error("Failed to update exercise");
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/exercises/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete exercise");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/exercises"], currentData.filter(e => e.id !== deletedId));
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      }
      toast.success("Exercise deleted");
    },
    onError: () => {
      toast.error("Failed to delete exercise");
    },
  });

  const reorderExerciseMutation = useMutation({
    mutationFn: async ({ id, newSortOrder }: { id: string; newSortOrder: number }) => {
      const res = await fetch(`/api/coach/exercises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newSortOrder }),
      });
      if (!res.ok) throw new Error("Failed to reorder exercise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
    },
    onError: () => {
      toast.error("Failed to reorder exercise");
    },
  });

  const moveExercise = (exerciseId: string, direction: "up" | "down") => {
    const sortedExercises = [...exercises].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const currentIndex = sortedExercises.findIndex(e => e.id === exerciseId);
    if (currentIndex === -1) return;
    
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= sortedExercises.length) return;
    
    const currentExercise = sortedExercises[currentIndex];
    const swapExercise = sortedExercises[swapIndex];
    
    const currentOrder = currentExercise.sortOrder ?? currentIndex;
    const swapOrder = swapExercise.sortOrder ?? swapIndex;
    
    reorderExerciseMutation.mutate({ id: currentExercise.id, newSortOrder: swapOrder });
    reorderExerciseMutation.mutate({ id: swapExercise.id, newSortOrder: currentOrder });
  };

  const createStepMutation = useMutation({
    mutationFn: async ({ exerciseId, ...step }: typeof newStep & { exerciseId: string; stepOrder: number }) => {
      const res = await fetch(`/api/coach/exercises/${exerciseId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step),
      });
      if (!res.ok) throw new Error("Failed to create step");
      return res.json();
    },
    onSuccess: (newStepData, variables) => {
      const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/exercises"], 
          currentData.map(e => e.id === variables.exerciseId 
            ? { ...e, steps: [...(e.steps || []), newStepData] }
            : e
          )
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      }
      setIsAddingStep(null);
      setNewStep({ title: "", instructions: "", completionCriteria: "", supportingMaterial: "" });
      toast.success("Step added");
    },
    onError: () => {
      toast.error("Failed to add step");
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExerciseStep> & { id: string }) => {
      const res = await fetch(`/api/coach/steps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update step");
      return res.json();
    },
    onSuccess: (updatedStep, variables) => {
      const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/exercises"], 
          currentData.map(e => ({
            ...e,
            steps: e.steps?.map(s => s.id === variables.id ? { ...s, ...updatedStep } : s)
          }))
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      }
      setEditingStep(null);
      toast.success("Step updated");
    },
    onError: () => {
      toast.error("Failed to update step");
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/steps/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete step");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/exercises"], 
          currentData.map(e => ({
            ...e,
            steps: e.steps?.filter(s => s.id !== deletedId)
          }))
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      }
      toast.success("Step deleted");
    },
    onError: () => {
      toast.error("Failed to delete step");
    },
  });

  const moveStep = async (exerciseId: string, steps: ExerciseStep[], stepId: string, direction: 'up' | 'down') => {
    console.log('[moveStep] Called with:', { exerciseId, stepsLength: steps?.length, stepId, direction });
    if (!steps || steps.length === 0) {
      console.log('[moveStep] Early return: no steps');
      return;
    }
    
    const currentIndex = steps.findIndex(s => s.id === stepId);
    console.log('[moveStep] currentIndex:', currentIndex);
    if (currentIndex === -1) {
      console.log('[moveStep] Early return: step not found');
      return;
    }
    
    if (direction === 'up' && currentIndex === 0) {
      console.log('[moveStep] Early return: cannot move first step up');
      return;
    }
    if (direction === 'down' && currentIndex === steps.length - 1) {
      console.log('[moveStep] Early return: cannot move last step down');
      return;
    }
    
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentStep = steps[currentIndex];
    const swapStep = steps[swapIndex];
    console.log('[moveStep] Swapping:', { currentStep: currentStep.title, currentOrder: currentStep.stepOrder, swapStep: swapStep.title, swapOrder: swapStep.stepOrder });
    
    const newCurrentOrder = swapStep.stepOrder;
    const newSwapOrder = currentStep.stepOrder;
    
    // Optimistically update the cache
    const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
    if (currentData) {
      queryClient.setQueryData(["/api/coach/exercises"], 
        currentData.map(e => e.id === exerciseId 
          ? {
              ...e,
              steps: e.steps?.map(s => {
                if (s.id === currentStep.id) return { ...s, stepOrder: newCurrentOrder };
                if (s.id === swapStep.id) return { ...s, stepOrder: newSwapOrder };
                return s;
              })
            }
          : e
        )
      );
    }
    
    // Persist to server
    try {
      await Promise.all([
        fetch(`/api/coach/steps/${currentStep.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepOrder: newCurrentOrder }),
        }),
        fetch(`/api/coach/steps/${swapStep.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepOrder: newSwapOrder }),
        }),
      ]);
    } catch (error) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      toast.error("Failed to reorder steps");
    }
  };

  const toggleExpanded = async (id: string) => {
    const next = new Set(expandedExercises);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      const existing = exercises.find(e => e.id === id);
      if (existing && !existing.steps) {
        const res = await fetch(`/api/coach/exercises/${id}`);
        const data = await res.json();
        const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
        if (currentData) {
          queryClient.setQueryData(["/api/coach/exercises"], 
            currentData.map(e => e.id === id ? { ...e, steps: data.steps } : e)
          );
        }
      }
    }
    setExpandedExercises(next);
  };

  const togglePublished = async (exercise: GuidedExercise) => {
    const newValue = exercise.isPublished === 1 ? 0 : 1;
    // Optimistic update
    const currentData = queryClient.getQueryData<GuidedExercise[]>(["/api/coach/exercises"]);
    if (currentData) {
      queryClient.setQueryData(["/api/coach/exercises"], 
        currentData.map(e => e.id === exercise.id ? { ...e, isPublished: newValue } : e)
      );
    }
    try {
      await fetch(`/api/coach/exercises/${exercise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: newValue }),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      toast.error("Failed to update");
    }
  };

  const startEditing = (exercise: GuidedExercise) => {
    setEditingExercise({ ...exercise });
    setViewMode("edit");
  };

  const cancelEditing = () => {
    setEditingExercise(null);
    setViewMode("list");
  };

  const saveExercise = () => {
    if (!editingExercise) return;
    updateExerciseMutation.mutate({
      id: editingExercise.id,
      title: editingExercise.title,
      description: editingExercise.description,
      category: editingExercise.category,
      estimatedMinutes: editingExercise.estimatedMinutes,
      systemPrompt: editingExercise.systemPrompt
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setViewMode("list");
        setEditingExercise(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-open-exercises">
          <Dumbbell className="h-4 w-4" />
          <span className="hidden sm:inline">Exercises</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl xl:max-w-6xl max-h-[85vh] sm:max-h-[85vh] h-[100dvh] sm:h-auto w-full sm:w-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {viewMode === "edit" && (
              <Button variant="ghost" size="sm" onClick={cancelEditing} className="mr-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Dumbbell className="h-5 w-5" />
            {viewMode === "edit" ? "Edit Exercise" : "Guided Exercises"}
          </DialogTitle>
        </DialogHeader>

        {viewMode === "list" ? (
          <ScrollArea className="h-[calc(100dvh-120px)] sm:h-[70vh] pr-4">
            <div className="space-y-4">
              {!isCreating && (
                <Button 
                  onClick={() => setIsCreating(true)} 
                  className="w-full gap-2"
                  variant="outline"
                  data-testid="button-create-exercise"
                >
                  <Plus className="h-4 w-4" />
                  Create New Exercise
                </Button>
              )}

              {isCreating && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
                  <Input
                    placeholder="Exercise title (e.g., Values Clarification)"
                    value={newExercise.title}
                    onChange={(e) => setNewExercise({ ...newExercise, title: e.target.value })}
                    data-testid="input-new-exercise-title"
                  />
                  <Textarea
                    placeholder="Description (what clients will see when choosing this exercise)"
                    value={newExercise.description}
                    onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                    rows={2}
                    data-testid="input-new-exercise-description"
                  />
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <Select
                        value={newExercise.category}
                        onValueChange={(value) => setNewExercise({ ...newExercise, category: value })}
                      >
                        <SelectTrigger data-testid="select-new-exercise-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-muted-foreground">Est. Minutes</Label>
                      <Input
                        type="number"
                        value={newExercise.estimatedMinutes}
                        onChange={(e) => setNewExercise({ ...newExercise, estimatedMinutes: parseInt(e.target.value) || 15 })}
                        data-testid="input-new-exercise-minutes"
                      />
                    </div>
                  </div>
                  <Textarea
                    placeholder="System prompt for AI (overall instructions for guiding this exercise)"
                    value={newExercise.systemPrompt}
                    onChange={(e) => setNewExercise({ ...newExercise, systemPrompt: e.target.value })}
                    rows={3}
                    data-testid="input-new-exercise-prompt"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => createExerciseMutation.mutate(newExercise)}
                      disabled={!newExercise.title || !newExercise.description || createExerciseMutation.isPending}
                      data-testid="button-save-new-exercise"
                    >
                      {createExerciseMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Create Exercise
                    </Button>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : exercises.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No exercises yet. Create your first one to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const sortedExercises = [...exercises].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    return sortedExercises.map((exercise, index) => {
                      const sortedSteps = exercise.steps ? [...exercise.steps].sort((a, b) => a.stepOrder - b.stepOrder) : [];
                      const isFirst = index === 0;
                      const isLast = index === sortedExercises.length - 1;
                    
                      return (
                        <div key={exercise.id} className="border rounded-lg overflow-hidden">
                          <div 
                            className="p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleExpanded(exercise.id)}
                            data-testid={`exercise-row-${exercise.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveExercise(exercise.id, "up")}
                                    disabled={isFirst || reorderExerciseMutation.isPending}
                                    data-testid={`move-up-${exercise.id}`}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveExercise(exercise.id, "down")}
                                    disabled={isLast || reorderExerciseMutation.isPending}
                                    data-testid={`move-down-${exercise.id}`}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex-shrink-0 mt-0.5">
                                  {expandedExercises.has(exercise.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{exercise.title}</span>
                                    {exercise.category && (
                                      <Badge variant="secondary" className="text-xs">{exercise.category}</Badge>
                                    )}
                                    {exercise.estimatedMinutes && (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {exercise.estimatedMinutes}m
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{exercise.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePublished(exercise)}
                                  className={exercise.isPublished === 1 ? "text-green-600" : "text-muted-foreground"}
                                  data-testid={`toggle-publish-${exercise.id}`}
                                >
                                  {exercise.isPublished === 1 ? (
                                    <Eye className="h-4 w-4" />
                                  ) : (
                                    <EyeOff className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditing(exercise)}
                                  data-testid={`edit-exercise-${exercise.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive" data-testid={`delete-exercise-${exercise.id}`}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{exercise.title}"? This will also delete all steps.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteExerciseMutation.mutate(exercise.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>

                        {expandedExercises.has(exercise.id) && (
                          <div className="border-t bg-muted/30 p-3 space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase">Steps</div>
                            
                            {sortedSteps.length > 0 ? (
                              <div className="space-y-2">
                                {sortedSteps.map((step, idx) => (
                                  <div key={step.id} className="flex items-start gap-2 p-2 rounded border bg-background">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
                                      {idx + 1}
                                    </div>
                                    {editingStep?.id === step.id ? (
                                      <div className="flex-1 space-y-2">
                                        <Input
                                          value={editingStep.title}
                                          onChange={(e) => setEditingStep({ ...editingStep, title: e.target.value })}
                                          placeholder="Step title"
                                          data-testid={`input-edit-step-title-${step.id}`}
                                        />
                                        <Textarea
                                          value={editingStep.instructions}
                                          onChange={(e) => setEditingStep({ ...editingStep, instructions: e.target.value })}
                                          placeholder="AI instructions for this step"
                                          rows={3}
                                          data-testid={`input-edit-step-instructions-${step.id}`}
                                        />
                                        <Input
                                          value={editingStep.completionCriteria || ""}
                                          onChange={(e) => setEditingStep({ ...editingStep, completionCriteria: e.target.value })}
                                          placeholder="Completion criteria (when to advance)"
                                          data-testid={`input-edit-step-criteria-${step.id}`}
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button variant="ghost" size="sm" onClick={() => setEditingStep(null)}>
                                            <X className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            onClick={() => {
                                              if (editingStep) {
                                                updateStepMutation.mutate({
                                                  id: editingStep.id,
                                                  title: editingStep.title,
                                                  instructions: editingStep.instructions,
                                                  completionCriteria: editingStep.completionCriteria,
                                                  supportingMaterial: editingStep.supportingMaterial,
                                                });
                                              }
                                            }}
                                            disabled={updateStepMutation.isPending || !editingStep?.title}
                                          >
                                            {updateStepMutation.isPending ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Save className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">{step.title}</div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{step.instructions}</p>
                                      </div>
                                    )}
                                    {editingStep?.id !== step.id && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <div className="flex flex-col">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              moveStep(exercise.id, sortedSteps, step.id, 'up');
                                            }}
                                            disabled={idx === 0}
                                            data-testid={`move-step-up-${step.id}`}
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              moveStep(exercise.id, sortedSteps, step.id, 'down');
                                            }}
                                            disabled={idx === sortedSteps.length - 1}
                                            data-testid={`move-step-down-${step.id}`}
                                          >
                                            <ArrowDown className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setEditingStep(step)}
                                          data-testid={`edit-step-${step.id}`}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="text-destructive" data-testid={`delete-step-${step.id}`}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Step</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Are you sure you want to delete this step?
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => deleteStepMutation.mutate(step.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground italic">No steps yet</div>
                            )}

                            {isAddingStep === exercise.id ? (
                              <div className="space-y-2 p-2 border rounded bg-background">
                                <Input
                                  value={newStep.title}
                                  onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
                                  placeholder="Step title (e.g., 'Identify your core values')"
                                  data-testid={`input-new-step-title-${exercise.id}`}
                                />
                                <Textarea
                                  value={newStep.instructions}
                                  onChange={(e) => setNewStep({ ...newStep, instructions: e.target.value })}
                                  placeholder="AI instructions for this step"
                                  rows={3}
                                  data-testid={`input-new-step-instructions-${exercise.id}`}
                                />
                                <Input
                                  value={newStep.completionCriteria}
                                  onChange={(e) => setNewStep({ ...newStep, completionCriteria: e.target.value })}
                                  placeholder="Completion criteria (optional - when AI should advance)"
                                  data-testid={`input-new-step-criteria-${exercise.id}`}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => setIsAddingStep(null)}>
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      createStepMutation.mutate({
                                        ...newStep,
                                        exerciseId: exercise.id,
                                        stepOrder: sortedSteps.length
                                      });
                                    }}
                                    disabled={!newStep.title || !newStep.instructions || createStepMutation.isPending}
                                    data-testid={`button-save-new-step-${exercise.id}`}
                                  >
                                    {createStepMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Add Step
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full gap-2"
                                onClick={() => setIsAddingStep(exercise.id)}
                                data-testid={`button-add-step-${exercise.id}`}
                              >
                                <Plus className="h-4 w-4" />
                                Add Step
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : editingExercise && (
          <ScrollArea className="h-[calc(100dvh-120px)] sm:h-[70vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input
                  value={editingExercise.title}
                  onChange={(e) => setEditingExercise({ ...editingExercise, title: e.target.value })}
                  placeholder="Exercise title"
                  data-testid="input-edit-exercise-title"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  value={editingExercise.description}
                  onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  data-testid="input-edit-exercise-description"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Select
                    value={editingExercise.category || ""}
                    onValueChange={(value) => setEditingExercise({ ...editingExercise, category: value })}
                  >
                    <SelectTrigger data-testid="select-edit-exercise-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label className="text-xs text-muted-foreground">Est. Minutes</Label>
                  <Input
                    type="number"
                    value={editingExercise.estimatedMinutes || ""}
                    onChange={(e) => setEditingExercise({ ...editingExercise, estimatedMinutes: parseInt(e.target.value) || undefined })}
                    data-testid="input-edit-exercise-minutes"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">System Prompt (AI Instructions)</Label>
                <Textarea
                  value={editingExercise.systemPrompt}
                  onChange={(e) => setEditingExercise({ ...editingExercise, systemPrompt: e.target.value })}
                  placeholder="Overall instructions for how the AI should guide this exercise"
                  rows={4}
                  className="mt-1"
                  data-testid="input-edit-exercise-prompt"
                />
              </div>
              
              <FileAttachments exerciseId={editingExercise.id} />
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button 
                  onClick={saveExercise}
                  disabled={updateExerciseMutation.isPending}
                  data-testid="button-save-edit-exercise"
                >
                  {updateExerciseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
