import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ClipboardList, 
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
  Type,
  CheckCircle,
  List,
  Star
} from "lucide-react";
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

interface SurveyQuestion {
  id: string;
  surveyId: string;
  questionText: string;
  questionType: "text" | "multipleChoice" | "selectAll" | "rating";
  options?: string[];
  ratingMin?: number;
  ratingMax?: number;
  ratingLabels?: { min: string; max: string };
  isRequired: number;
  questionOrder: number;
}

interface SurveyExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
  summaryPrompt?: string;
  isPublished: number;
  sortOrder: number;
  questions?: SurveyQuestion[];
}

const CATEGORIES = ["Assessment", "Intake", "Values", "Goals", "Habits", "Check-in", "Feedback"];
const QUESTION_TYPES = [
  { value: "text", label: "Text (Fill-in)", icon: Type },
  { value: "multipleChoice", label: "Multiple Choice", icon: CheckCircle },
  { value: "selectAll", label: "Select All That Apply", icon: List },
  { value: "rating", label: "Rating Scale", icon: Star },
];

type ViewMode = "list" | "edit";

export function SurveyManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingSurvey, setEditingSurvey] = useState<SurveyExercise | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedSurveys, setExpandedSurveys] = useState<Set<string>>(new Set());
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState<string | null>(null);
  const [newSurvey, setNewSurvey] = useState({ 
    title: "", 
    description: "", 
    category: "",
    estimatedMinutes: 10,
    summaryPrompt: "" 
  });
  const [newQuestion, setNewQuestion] = useState<{
    questionText: string;
    questionType: "text" | "multipleChoice" | "selectAll" | "rating";
    options: string[];
    ratingMin: number;
    ratingMax: number;
    ratingLabels: { min: string; max: string };
    isRequired: number;
  }>({
    questionText: "",
    questionType: "text",
    options: ["", ""],
    ratingMin: 1,
    ratingMax: 5,
    ratingLabels: { min: "Not at all", max: "Extremely" },
    isRequired: 1,
  });
  
  const queryClient = useQueryClient();

  const { data: surveys = [], isLoading } = useQuery<SurveyExercise[]>({
    queryKey: ["/api/coach/surveys"],
    enabled: isOpen,
  });

  const createSurveyMutation = useMutation({
    mutationFn: async (survey: typeof newSurvey) => {
      const res = await fetch("/api/coach/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(survey),
      });
      if (!res.ok) throw new Error("Failed to create survey");
      return res.json();
    },
    onSuccess: (newSurv) => {
      const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/surveys"], [...currentData, newSurv]);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      }
      setIsCreating(false);
      setNewSurvey({ title: "", description: "", category: "", estimatedMinutes: 10, summaryPrompt: "" });
      toast.success("Survey created");
    },
    onError: () => {
      toast.error("Failed to create survey");
    },
  });

  const updateSurveyMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SurveyExercise> & { id: string }) => {
      const res = await fetch(`/api/coach/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update survey");
      return res.json();
    },
    onSuccess: (_updatedSurv, variables) => {
      const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/surveys"], 
          currentData.map(s => s.id === variables.id ? { ...s, ...variables } : s)
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      }
      setViewMode("list");
      setEditingSurvey(null);
      toast.success("Survey updated");
    },
    onError: () => {
      toast.error("Failed to update survey");
    },
  });

  const deleteSurveyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/surveys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete survey");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/surveys"], currentData.filter(s => s.id !== deletedId));
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      }
      toast.success("Survey deleted");
    },
    onError: () => {
      toast.error("Failed to delete survey");
    },
  });

  const reorderSurveyMutation = useMutation({
    mutationFn: async ({ id, newSortOrder }: { id: string; newSortOrder: number }) => {
      const res = await fetch(`/api/coach/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newSortOrder }),
      });
      if (!res.ok) throw new Error("Failed to reorder survey");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
    },
    onError: () => {
      toast.error("Failed to reorder survey");
    },
  });

  const moveSurvey = (surveyId: string, direction: "up" | "down") => {
    const sortedSurveys = [...surveys].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const currentIndex = sortedSurveys.findIndex(s => s.id === surveyId);
    if (currentIndex === -1) return;
    
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= sortedSurveys.length) return;
    
    const currentSurvey = sortedSurveys[currentIndex];
    const swapSurvey = sortedSurveys[swapIndex];
    
    const currentOrder = currentSurvey.sortOrder ?? currentIndex;
    const swapOrder = swapSurvey.sortOrder ?? swapIndex;
    
    reorderSurveyMutation.mutate({ id: currentSurvey.id, newSortOrder: swapOrder });
    reorderSurveyMutation.mutate({ id: swapSurvey.id, newSortOrder: currentOrder });
  };

  const createQuestionMutation = useMutation({
    mutationFn: async ({ surveyId, ...question }: typeof newQuestion & { surveyId: string; questionOrder: number }) => {
      const res = await fetch(`/api/coach/surveys/${surveyId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(question),
      });
      if (!res.ok) throw new Error("Failed to create question");
      return res.json();
    },
    onSuccess: (newQuestionData, variables) => {
      const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/surveys"], 
          currentData.map(s => s.id === variables.surveyId 
            ? { ...s, questions: [...(s.questions || []), newQuestionData] }
            : s
          )
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      }
      setIsAddingQuestion(null);
      setNewQuestion({
        questionText: "",
        questionType: "text",
        options: ["", ""],
        ratingMin: 1,
        ratingMax: 5,
        ratingLabels: { min: "Not at all", max: "Extremely" },
        isRequired: 1,
      });
      toast.success("Question added");
    },
    onError: () => {
      toast.error("Failed to add question");
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SurveyQuestion> & { id: string }) => {
      const res = await fetch(`/api/coach/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update question");
      return res.json();
    },
    onSuccess: (updatedQuestion, variables) => {
      const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/surveys"], 
          currentData.map(s => ({
            ...s,
            questions: s.questions?.map(q => q.id === variables.id ? { ...q, ...updatedQuestion } : q)
          }))
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      }
      setEditingQuestion(null);
      toast.success("Question updated");
    },
    onError: () => {
      toast.error("Failed to update question");
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/questions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete question");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
      if (currentData) {
        queryClient.setQueryData(["/api/coach/surveys"], 
          currentData.map(s => ({
            ...s,
            questions: s.questions?.filter(q => q.id !== deletedId)
          }))
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      }
      toast.success("Question deleted");
    },
    onError: () => {
      toast.error("Failed to delete question");
    },
  });

  const moveQuestion = async (surveyId: string, questions: SurveyQuestion[], questionId: string, direction: 'up' | 'down') => {
    if (!questions || questions.length === 0) return;
    
    const currentIndex = questions.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;
    
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === questions.length - 1) return;
    
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentQuestion = questions[currentIndex];
    const swapQuestion = questions[swapIndex];
    
    const newCurrentOrder = swapQuestion.questionOrder;
    const newSwapOrder = currentQuestion.questionOrder;
    
    const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
    if (currentData) {
      queryClient.setQueryData(["/api/coach/surveys"], 
        currentData.map(s => s.id === surveyId 
          ? {
              ...s,
              questions: s.questions?.map(q => {
                if (q.id === currentQuestion.id) return { ...q, questionOrder: newCurrentOrder };
                if (q.id === swapQuestion.id) return { ...q, questionOrder: newSwapOrder };
                return q;
              })
            }
          : s
        )
      );
    }
    
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/coach/questions/${currentQuestion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionOrder: newCurrentOrder }),
        }),
        fetch(`/api/coach/questions/${swapQuestion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionOrder: newSwapOrder }),
        }),
      ]);
      
      if (!res1.ok || !res2.ok) {
        throw new Error("Server returned error");
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      toast.error("Failed to reorder questions");
    }
  };

  const toggleExpanded = async (id: string) => {
    const next = new Set(expandedSurveys);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      const existing = surveys.find(s => s.id === id);
      if (existing && !existing.questions) {
        const res = await fetch(`/api/coach/surveys/${id}`);
        const data = await res.json();
        const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
        if (currentData) {
          queryClient.setQueryData(["/api/coach/surveys"], 
            currentData.map(s => s.id === id ? { ...s, questions: data.questions } : s)
          );
        }
      }
    }
    setExpandedSurveys(next);
  };

  const togglePublished = async (survey: SurveyExercise) => {
    const newValue = survey.isPublished === 1 ? 0 : 1;
    const currentData = queryClient.getQueryData<SurveyExercise[]>(["/api/coach/surveys"]);
    if (currentData) {
      queryClient.setQueryData(["/api/coach/surveys"], 
        currentData.map(s => s.id === survey.id ? { ...s, isPublished: newValue } : s)
      );
    }
    try {
      await fetch(`/api/coach/surveys/${survey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: newValue }),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/surveys"] });
      toast.error("Failed to update");
    }
  };

  const startEditing = (survey: SurveyExercise) => {
    setEditingSurvey({ ...survey });
    setViewMode("edit");
  };

  const cancelEditing = () => {
    setEditingSurvey(null);
    setViewMode("list");
  };

  const saveSurvey = () => {
    if (!editingSurvey) return;
    updateSurveyMutation.mutate({
      id: editingSurvey.id,
      title: editingSurvey.title,
      description: editingSurvey.description,
      category: editingSurvey.category,
      estimatedMinutes: editingSurvey.estimatedMinutes,
      summaryPrompt: editingSurvey.summaryPrompt
    });
  };

  const getQuestionTypeIcon = (type: string) => {
    const found = QUESTION_TYPES.find(t => t.value === type);
    return found ? found.icon : Type;
  };

  const getQuestionTypeLabel = (type: string) => {
    const found = QUESTION_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };

  const renderQuestionForm = (
    question: typeof newQuestion,
    setQuestion: (q: typeof newQuestion) => void
  ) => (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Question Type</Label>
        <Select
          value={question.questionType}
          onValueChange={(value: typeof question.questionType) => 
            setQuestion({ ...question, questionType: value })
          }
        >
          <SelectTrigger data-testid="select-question-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Question Text</Label>
        <Textarea
          placeholder="Enter your question..."
          value={question.questionText}
          onChange={(e) => setQuestion({ ...question, questionText: e.target.value })}
          rows={2}
          data-testid="input-question-text"
        />
      </div>

      {(question.questionType === "multipleChoice" || question.questionType === "selectAll") && (
        <div>
          <Label className="text-xs text-muted-foreground">Options</Label>
          <div className="space-y-2">
            {question.options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...question.options];
                    newOpts[idx] = e.target.value;
                    setQuestion({ ...question, options: newOpts });
                  }}
                  data-testid={`input-option-${idx}`}
                />
                {question.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOpts = question.options.filter((_, i) => i !== idx);
                      setQuestion({ ...question, options: newOpts });
                    }}
                    data-testid={`remove-option-${idx}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuestion({ ...question, options: [...question.options, ""] })}
              data-testid="add-option"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Option
            </Button>
          </div>
        </div>
      )}

      {question.questionType === "rating" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Min Value</Label>
            <Input
              type="number"
              value={question.ratingMin}
              onChange={(e) => setQuestion({ ...question, ratingMin: parseInt(e.target.value) || 1 })}
              data-testid="input-rating-min"
            />
            <Input
              placeholder="Label (e.g., Not at all)"
              value={question.ratingLabels.min}
              onChange={(e) => setQuestion({ 
                ...question, 
                ratingLabels: { ...question.ratingLabels, min: e.target.value } 
              })}
              className="mt-2"
              data-testid="input-rating-label-min"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Value</Label>
            <Input
              type="number"
              value={question.ratingMax}
              onChange={(e) => setQuestion({ ...question, ratingMax: parseInt(e.target.value) || 5 })}
              data-testid="input-rating-max"
            />
            <Input
              placeholder="Label (e.g., Extremely)"
              value={question.ratingLabels.max}
              onChange={(e) => setQuestion({ 
                ...question, 
                ratingLabels: { ...question.ratingLabels, max: e.target.value } 
              })}
              className="mt-2"
              data-testid="input-rating-label-max"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setViewMode("list");
        setEditingSurvey(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-open-surveys">
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Surveys</span>
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
            <ClipboardList className="h-5 w-5" />
            {viewMode === "edit" ? "Edit Survey" : "Survey Exercises"}
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
                  data-testid="button-create-survey"
                >
                  <Plus className="h-4 w-4" />
                  Create New Survey
                </Button>
              )}

              {isCreating && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
                  <Input
                    placeholder="Survey title (e.g., Weekly Check-in)"
                    value={newSurvey.title}
                    onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
                    data-testid="input-new-survey-title"
                  />
                  <Textarea
                    placeholder="Description (what clients will see when choosing this survey)"
                    value={newSurvey.description}
                    onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })}
                    rows={2}
                    data-testid="input-new-survey-description"
                  />
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <Select
                        value={newSurvey.category}
                        onValueChange={(value) => setNewSurvey({ ...newSurvey, category: value })}
                      >
                        <SelectTrigger data-testid="select-new-survey-category">
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
                        value={newSurvey.estimatedMinutes}
                        onChange={(e) => setNewSurvey({ ...newSurvey, estimatedMinutes: parseInt(e.target.value) || 10 })}
                        data-testid="input-new-survey-minutes"
                      />
                    </div>
                  </div>
                  <Textarea
                    placeholder="AI summary prompt (instructions for generating summary after completion)"
                    value={newSurvey.summaryPrompt}
                    onChange={(e) => setNewSurvey({ ...newSurvey, summaryPrompt: e.target.value })}
                    rows={3}
                    data-testid="input-new-survey-prompt"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => createSurveyMutation.mutate(newSurvey)}
                      disabled={!newSurvey.title || !newSurvey.description || createSurveyMutation.isPending}
                      data-testid="button-save-new-survey"
                    >
                      {createSurveyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Create Survey
                    </Button>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : surveys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No surveys yet. Create your first one to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const sortedSurveys = [...surveys].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    return sortedSurveys.map((survey, index) => {
                      const sortedQuestions = survey.questions ? [...survey.questions].sort((a, b) => a.questionOrder - b.questionOrder) : [];
                      const isFirst = index === 0;
                      const isLast = index === sortedSurveys.length - 1;
                    
                      return (
                        <div key={survey.id} className="border rounded-lg overflow-hidden">
                          <div 
                            className="p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleExpanded(survey.id)}
                            data-testid={`survey-row-${survey.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveSurvey(survey.id, "up")}
                                    disabled={isFirst || reorderSurveyMutation.isPending}
                                    data-testid={`move-up-${survey.id}`}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveSurvey(survey.id, "down")}
                                    disabled={isLast || reorderSurveyMutation.isPending}
                                    data-testid={`move-down-${survey.id}`}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex-shrink-0 mt-0.5">
                                  {expandedSurveys.has(survey.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium truncate">{survey.title}</span>
                                    {survey.category && (
                                      <Badge variant="secondary" className="text-xs">{survey.category}</Badge>
                                    )}
                                    {survey.estimatedMinutes && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                        <Clock className="h-3 w-3" />
                                        {survey.estimatedMinutes}m
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">{survey.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => togglePublished(survey)}
                                  title={survey.isPublished ? "Published (click to unpublish)" : "Draft (click to publish)"}
                                >
                                  {survey.isPublished ? (
                                    <Eye className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEditing(survey)}
                                  data-testid={`edit-survey-${survey.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-destructive"
                                      data-testid={`delete-survey-${survey.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Survey</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete "{survey.title}" and all its questions. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground"
                                        onClick={() => deleteSurveyMutation.mutate(survey.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>

                          {expandedSurveys.has(survey.id) && (
                            <div className="border-t bg-muted/30 p-3">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-medium">Questions ({sortedQuestions.length})</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsAddingQuestion(survey.id)}
                                  data-testid={`add-question-${survey.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Question
                                </Button>
                              </div>

                              {isAddingQuestion === survey.id && (
                                <div className="border rounded-lg p-3 mb-3 bg-background space-y-4">
                                  {renderQuestionForm(newQuestion, setNewQuestion)}
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsAddingQuestion(null)}>
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => createQuestionMutation.mutate({
                                        ...newQuestion,
                                        surveyId: survey.id,
                                        questionOrder: sortedQuestions.length,
                                      })}
                                      disabled={!newQuestion.questionText || createQuestionMutation.isPending}
                                      data-testid="button-save-new-question"
                                    >
                                      {createQuestionMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                      )}
                                      Add Question
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {sortedQuestions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No questions yet. Add your first question to get started.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {sortedQuestions.map((question, qIdx) => {
                                    const IconComponent = getQuestionTypeIcon(question.questionType);
                                    const isFirstQ = qIdx === 0;
                                    const isLastQ = qIdx === sortedQuestions.length - 1;

                                    if (editingQuestion?.id === question.id) {
                                      return (
                                        <div key={question.id} className="border rounded-lg p-3 bg-background space-y-4">
                                          {renderQuestionForm(
                                            {
                                              questionText: editingQuestion.questionText,
                                              questionType: editingQuestion.questionType,
                                              options: (editingQuestion.options as string[]) || ["", ""],
                                              ratingMin: editingQuestion.ratingMin || 1,
                                              ratingMax: editingQuestion.ratingMax || 5,
                                              ratingLabels: (editingQuestion.ratingLabels as { min: string; max: string }) || { min: "", max: "" },
                                              isRequired: editingQuestion.isRequired,
                                            },
                                            (q) => setEditingQuestion({ ...editingQuestion, ...q })
                                          )}
                                          <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(null)}>
                                              <X className="h-4 w-4 mr-1" />
                                              Cancel
                                            </Button>
                                            <Button
                                              size="sm"
                                              onClick={() => updateQuestionMutation.mutate({
                                                id: editingQuestion.id,
                                                questionText: editingQuestion.questionText,
                                                questionType: editingQuestion.questionType,
                                                options: editingQuestion.options,
                                                ratingMin: editingQuestion.ratingMin,
                                                ratingMax: editingQuestion.ratingMax,
                                                ratingLabels: editingQuestion.ratingLabels,
                                              })}
                                              disabled={updateQuestionMutation.isPending}
                                            >
                                              {updateQuestionMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                              ) : (
                                                <Save className="h-4 w-4 mr-1" />
                                              )}
                                              Save
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div 
                                        key={question.id} 
                                        className="flex items-start gap-2 p-2 rounded-lg border bg-background"
                                        data-testid={`question-row-${question.id}`}
                                      >
                                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={() => moveQuestion(survey.id, sortedQuestions, question.id, "up")}
                                            disabled={isFirstQ}
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={() => moveQuestion(survey.id, sortedQuestions, question.id, "down")}
                                            disabled={isLastQ}
                                          >
                                            <ArrowDown className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <Badge variant="outline" className="text-xs gap-1">
                                            <IconComponent className="h-3 w-3" />
                                            {getQuestionTypeLabel(question.questionType)}
                                          </Badge>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm">{question.questionText}</p>
                                          {question.options && question.options.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                              Options: {(question.options as string[]).join(", ")}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setEditingQuestion(question)}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-destructive"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  This will permanently delete this question. This cannot be undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  className="bg-destructive text-destructive-foreground"
                                                  onClick={() => deleteQuestionMutation.mutate(question.id)}
                                                >
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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
        ) : (
          <ScrollArea className="h-[calc(100dvh-120px)] sm:h-[70vh] pr-4">
            {editingSurvey && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    value={editingSurvey.title}
                    onChange={(e) => setEditingSurvey({ ...editingSurvey, title: e.target.value })}
                    data-testid="input-edit-survey-title"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea
                    value={editingSurvey.description}
                    onChange={(e) => setEditingSurvey({ ...editingSurvey, description: e.target.value })}
                    rows={2}
                    data-testid="input-edit-survey-description"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select
                      value={editingSurvey.category || ""}
                      onValueChange={(value) => setEditingSurvey({ ...editingSurvey, category: value })}
                    >
                      <SelectTrigger data-testid="select-edit-survey-category">
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
                      value={editingSurvey.estimatedMinutes || ""}
                      onChange={(e) => setEditingSurvey({ ...editingSurvey, estimatedMinutes: parseInt(e.target.value) || 10 })}
                      data-testid="input-edit-survey-minutes"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">AI Summary Prompt</Label>
                  <Textarea
                    value={editingSurvey.summaryPrompt || ""}
                    onChange={(e) => setEditingSurvey({ ...editingSurvey, summaryPrompt: e.target.value })}
                    placeholder="Instructions for AI when generating summary of responses..."
                    rows={4}
                    data-testid="input-edit-survey-prompt"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={cancelEditing}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={saveSurvey}
                    disabled={updateSurveyMutation.isPending}
                    data-testid="button-save-survey-changes"
                  >
                    {updateSurveyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
