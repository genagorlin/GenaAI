import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  ArrowLeft,
  GripVertical
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
  introText?: string;
  systemPrompt?: string; // Legacy field
  isPublished: number;
  sortOrder: number;
  steps?: ExerciseStep[];
}

const CATEGORIES = ["Values", "Emotions", "Beliefs", "Goals", "Habits", "Decisions", "Interpersonal"];

type ViewMode = "list" | "edit";

// Sortable exercise item component for drag-and-drop
interface SortableExerciseItemProps {
  exercise: GuidedExercise;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onTogglePublished: () => void;
  onStartEditing: () => void;
  onDelete: () => void;
  editingStep: ExerciseStep | null;
  setEditingStep: (step: ExerciseStep | null) => void;
  isAddingStep: string | null;
  setIsAddingStep: (id: string | null) => void;
  newStep: { title: string; instructions: string; completionCriteria: string; supportingMaterial: string };
  setNewStep: (step: { title: string; instructions: string; completionCriteria: string; supportingMaterial: string }) => void;
  moveStep: (exerciseId: string, steps: ExerciseStep[], stepId: string, direction: 'up' | 'down') => void;
  updateStepMutation: any;
  deleteStepMutation: any;
  createStepMutation: any;
}

function SortableExerciseItem({
  exercise,
  isExpanded,
  onToggleExpanded,
  onTogglePublished,
  onStartEditing,
  onDelete,
  editingStep,
  setEditingStep,
  isAddingStep,
  setIsAddingStep,
  newStep,
  setNewStep,
  moveStep,
  updateStepMutation,
  deleteStepMutation,
  createStepMutation,
}: SortableExerciseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sortedSteps = exercise.steps ? [...exercise.steps].sort((a, b) => a.stepOrder - b.stepOrder) : [];

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg overflow-hidden">
      <div className="p-3 hover:bg-muted/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div
              {...attributes}
              {...listeners}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div
              className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
              onClick={onToggleExpanded}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isExpanded ? (
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
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePublished}
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
              onClick={onStartEditing}
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
                    onClick={onDelete}
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

      {isExpanded && (
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
                            e.preventDefault();
                            moveStep(exercise.id, sortedSteps, step.id, 'up');
                          }}
                          disabled={idx === 0}
                          data-testid={`move-step-up-${step.id}`}
                        >
                          <ArrowUp className="h-3 w-3 pointer-events-none" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            moveStep(exercise.id, sortedSteps, step.id, 'down');
                          }}
                          disabled={idx === sortedSteps.length - 1}
                          data-testid={`move-step-down-${step.id}`}
                        >
                          <ArrowDown className="h-3 w-3 pointer-events-none" />
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
}

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
    introText: ""
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
      setNewExercise({ title: "", description: "", category: "", estimatedMinutes: 15, introText: "" });
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const sortedExercises = [...exercises].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const oldIndex = sortedExercises.findIndex(e => e.id === active.id);
    const newIndex = sortedExercises.findIndex(e => e.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Create new order
    const reorderedExercises = arrayMove(sortedExercises, oldIndex, newIndex);

    // Optimistically update the cache with new sort orders
    const updatedExercises = reorderedExercises.map((exercise, index) => ({
      ...exercise,
      sortOrder: index,
    }));
    queryClient.setQueryData(["/api/coach/exercises"], updatedExercises);

    // Persist all changes to server
    try {
      const updates = updatedExercises.map((exercise) =>
        fetch(`/api/coach/exercises/${exercise.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: exercise.sortOrder }),
        })
      );
      const results = await Promise.all(updates);
      if (results.some(r => !r.ok)) {
        throw new Error("Some updates failed");
      }
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/exercises"] });
      toast.error("Failed to reorder exercises");
    }
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
    if (!steps || steps.length === 0) return;

    // Sort steps by stepOrder first to get correct visual order
    const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const currentIndex = sortedSteps.findIndex(s => s.id === stepId);
    if (currentIndex === -1) return;

    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedSteps.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentStep = sortedSteps[currentIndex];
    const swapStep = sortedSteps[swapIndex];

    // Use index-based orders to ensure they're always different
    const newCurrentOrder = swapIndex;
    const newSwapOrder = currentIndex;

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
      const [res1, res2] = await Promise.all([
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

      if (!res1.ok || !res2.ok) {
        throw new Error("Server returned error");
      }
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
      introText: editingExercise.introText
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
                  <div>
                    <Label className="text-xs text-muted-foreground">Introduction Text (shown to clients before starting)</Label>
                    <Textarea
                      placeholder="Welcome text that clients see when they begin this exercise..."
                      value={newExercise.introText}
                      onChange={(e) => setNewExercise({ ...newExercise, introText: e.target.value })}
                      rows={3}
                      className="mt-1"
                      data-testid="input-new-exercise-intro"
                    />
                  </div>
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={[...exercises].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(e => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {(() => {
                        const sortedExercises = [...exercises].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                        return sortedExercises.map((exercise) => (
                          <SortableExerciseItem
                            key={exercise.id}
                            exercise={exercise}
                            isExpanded={expandedExercises.has(exercise.id)}
                            onToggleExpanded={() => toggleExpanded(exercise.id)}
                            onTogglePublished={() => togglePublished(exercise)}
                            onStartEditing={() => startEditing(exercise)}
                            onDelete={() => deleteExerciseMutation.mutate(exercise.id)}
                            editingStep={editingStep}
                            setEditingStep={setEditingStep}
                            isAddingStep={isAddingStep}
                            setIsAddingStep={setIsAddingStep}
                            newStep={newStep}
                            setNewStep={setNewStep}
                            moveStep={moveStep}
                            updateStepMutation={updateStepMutation}
                            deleteStepMutation={deleteStepMutation}
                            createStepMutation={createStepMutation}
                          />
                        ));
                      })()}
                    </div>
                  </SortableContext>
                </DndContext>
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
                <Label className="text-xs text-muted-foreground">Introduction Text (shown to clients before starting)</Label>
                <Textarea
                  value={editingExercise.introText || ""}
                  onChange={(e) => setEditingExercise({ ...editingExercise, introText: e.target.value })}
                  placeholder="Welcome text that clients see when they begin this exercise..."
                  rows={4}
                  className="mt-1"
                  data-testid="input-edit-exercise-intro"
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
