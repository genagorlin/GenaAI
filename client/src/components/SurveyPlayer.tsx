import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  CheckCircle2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
  questions: SurveyQuestion[];
  summaryPrompt?: string;
}

interface SurveySession {
  id: string;
  clientId: string;
  surveyId: string;
  currentQuestionId?: string;
  status: string;
  aiSummary?: string;
}

interface SurveyResponse {
  id: string;
  sessionId: string;
  questionId: string;
  textResponse?: string;
  selectedOptions?: string[];
  ratingValue?: number;
}

interface SurveyPlayerProps {
  clientId: string;
  surveyId: string;
  onClose: () => void;
  onComplete?: (summary: string) => void;
}

export function SurveyPlayer({ clientId, surveyId, onClose, onComplete }: SurveyPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, {
    text?: string;
    options?: string[];
    rating?: number;
  }>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const { data: survey, isLoading } = useQuery<SurveyExercise>({
    queryKey: ["/api/surveys", surveyId],
    queryFn: async () => {
      const res = await fetch(`/api/surveys/${surveyId}`);
      if (!res.ok) throw new Error("Failed to load survey");
      return res.json();
    },
  });

  useEffect(() => {
    async function loadOrCreateSession() {
      if (!survey) return;
      
      try {
        const activeRes = await fetch(`/api/clients/${clientId}/survey-sessions/${surveyId}/active`);
        let activeSession: SurveySession | null = null;
        
        if (activeRes.ok) {
          activeSession = await activeRes.json();
        }
        
        if (activeSession && activeSession.id) {
          if (activeSession.status === "completed" && activeSession.aiSummary) {
            setSessionId(activeSession.id);
            setSummary(activeSession.aiSummary);
            setIsCompleted(true);
            setIsLoadingSession(false);
            return;
          }
          
          setSessionId(activeSession.id);
          
          const responsesRes = await fetch(`/api/survey-sessions/${activeSession.id}/responses`);
          if (responsesRes.ok) {
            const responses: SurveyResponse[] = await responsesRes.json();
            const loadedAnswers: typeof answers = {};
            
            for (const resp of responses) {
              loadedAnswers[resp.questionId] = {
                text: resp.textResponse || undefined,
                options: resp.selectedOptions as string[] | undefined,
                rating: resp.ratingValue ?? undefined,
              };
            }
            
            setAnswers(loadedAnswers);
            
            const sortedQuestions = survey.questions.sort((a, b) => a.questionOrder - b.questionOrder);
            const lastAnsweredIndex = sortedQuestions.findIndex(q => !loadedAnswers[q.id]);
            if (lastAnsweredIndex > 0) {
              setCurrentQuestionIndex(lastAnsweredIndex);
            } else if (lastAnsweredIndex === -1 && responses.length === sortedQuestions.length) {
              setCurrentQuestionIndex(sortedQuestions.length - 1);
            }
          }
        } else {
          const createRes = await fetch(`/api/clients/${clientId}/survey-sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ surveyId }),
          });
          if (createRes.ok) {
            const newSession: SurveySession = await createRes.json();
            setSessionId(newSession.id);
          } else {
            toast.error("Failed to start survey");
          }
        }
      } catch (error) {
        console.error("Error loading session:", error);
        toast.error("Failed to load survey session");
      }
      
      setIsLoadingSession(false);
    }
    
    if (survey) {
      loadOrCreateSession();
    }
  }, [survey, clientId, surveyId]);

  const saveResponseMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { 
      questionId: string; 
      answer: typeof answers[string];
    }) => {
      if (!sessionId) return;
      const res = await fetch(`/api/survey-sessions/${sessionId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          textResponse: answer.text || null,
          selectedOptions: answer.options || null,
          ratingValue: answer.rating ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save response");
      return res.json();
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) return;
      const res = await fetch(`/api/survey-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "completed",
          completedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
      return res.json();
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId || !survey) return null;
      
      const responsesRes = await fetch(`/api/survey-sessions/${sessionId}/responses`);
      if (!responsesRes.ok) throw new Error("Failed to fetch responses");
      const responses: SurveyResponse[] = await responsesRes.json();
      
      const formattedResponses = survey.questions.map(q => {
        const response = responses.find(r => r.questionId === q.id);
        let answerText = "No response";
        if (response) {
          if (response.textResponse) answerText = response.textResponse;
          else if (response.selectedOptions) answerText = (response.selectedOptions as string[]).join(", ");
          else if (response.ratingValue !== null && response.ratingValue !== undefined) answerText = `${response.ratingValue}`;
        }
        return `Q: ${q.questionText}\nA: ${answerText}`;
      }).join("\n\n");

      const summaryPrompt = survey.summaryPrompt || 
        "Summarize the client's survey responses, highlighting key themes and insights.";

      const res = await fetch("/api/ai/summarize-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: formattedResponses,
          prompt: summaryPrompt,
        }),
      });
      
      if (!res.ok) {
        console.warn("AI summary not available, using basic summary");
        return `Survey completed with ${responses.length} responses.`;
      }
      
      const data = await res.json();
      return data.summary;
    },
    onSuccess: async (summaryText) => {
      if (summaryText && sessionId) {
        await fetch(`/api/survey-sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiSummary: summaryText }),
        });
        setSummary(summaryText);
        onComplete?.(summaryText);
      }
      setIsGeneratingSummary(false);
    },
    onError: () => {
      setIsGeneratingSummary(false);
      toast.error("Failed to generate summary");
    },
  });

  const questions = survey?.questions?.sort((a, b) => a.questionOrder - b.questionOrder) || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleAnswer = (answer: typeof currentAnswer) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer || {},
    }));
  };

  const hasAnswer = () => {
    if (!currentAnswer) return false;
    if (currentAnswer.text && currentAnswer.text.trim()) return true;
    if (currentAnswer.options && currentAnswer.options.length > 0) return true;
    if (currentAnswer.rating !== undefined) return true;
    return false;
  };

  const handleNext = async () => {
    if (!currentQuestion) return;
    
    if (currentAnswer) {
      saveResponseMutation.mutate({ 
        questionId: currentQuestion.id, 
        answer: currentAnswer 
      });
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
      setIsGeneratingSummary(true);
      await completeSessionMutation.mutateAsync();
      generateSummaryMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (isLoading || isLoadingSession) {
    return (
      <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!survey || questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">This survey has no questions yet.</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{survey.title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Survey Complete!</h3>
          
          {isGeneratingSummary ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : summary ? (
            <div className="mt-4 max-w-lg text-left bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Summary</h4>
              <div className="text-sm prose prose-sm dark:prose-invert">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Thank you for completing the survey.</p>
          )}

          <Button className="mt-6" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold">{survey.title}</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentQuestionIndex + 1} of {questions.length}
        </span>
      </header>

      <Progress value={progress} className="h-1" />

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="flex-1 max-w-lg mx-auto w-full">
          <h3 className="text-lg font-medium mb-6" data-testid="survey-question-text">
            {currentQuestion?.questionText}
          </h3>

          {currentQuestion?.questionType === "text" && (
            <Textarea
              placeholder="Type your answer..."
              value={currentAnswer?.text || ""}
              onChange={(e) => handleAnswer({ text: e.target.value })}
              className="min-h-[120px]"
              data-testid="survey-text-input"
            />
          )}

          {currentQuestion?.questionType === "multipleChoice" && currentQuestion.options && (
            <RadioGroup
              value={currentAnswer?.options?.[0] || ""}
              onValueChange={(value) => handleAnswer({ options: [value] })}
              className="space-y-3"
            >
              {(currentQuestion.options as string[]).map((option, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={option} id={`option-${idx}`} data-testid={`survey-option-${idx}`} />
                  <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion?.questionType === "selectAll" && currentQuestion.options && (
            <div className="space-y-3">
              {(currentQuestion.options as string[]).map((option, idx) => {
                const isSelected = currentAnswer?.options?.includes(option) || false;
                return (
                  <div 
                    key={idx} 
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`checkbox-${idx}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const currentOptions = currentAnswer?.options || [];
                        if (checked) {
                          handleAnswer({ options: [...currentOptions, option] });
                        } else {
                          handleAnswer({ options: currentOptions.filter(o => o !== option) });
                        }
                      }}
                      data-testid={`survey-checkbox-${idx}`}
                    />
                    <Label htmlFor={`checkbox-${idx}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion?.questionType === "rating" && (
            <div className="space-y-6">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{currentQuestion.ratingLabels?.min || currentQuestion.ratingMin}</span>
                <span>{currentQuestion.ratingLabels?.max || currentQuestion.ratingMax}</span>
              </div>
              <Slider
                value={[currentAnswer?.rating ?? (currentQuestion.ratingMin || 1)]}
                onValueChange={([value]) => handleAnswer({ rating: value })}
                min={currentQuestion.ratingMin || 1}
                max={currentQuestion.ratingMax || 5}
                step={1}
                className="w-full"
                data-testid="survey-rating-slider"
              />
              <div className="text-center">
                <span className="text-2xl font-bold" data-testid="survey-rating-value">
                  {currentAnswer?.rating ?? (currentQuestion.ratingMin || 1)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                {Array.from({ 
                  length: (currentQuestion.ratingMax || 5) - (currentQuestion.ratingMin || 1) + 1 
                }, (_, i) => (
                  <span key={i}>{(currentQuestion.ratingMin || 1) + i}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between p-4 border-t">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentQuestionIndex === 0}
          data-testid="survey-back-button"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={currentQuestion?.isRequired === 1 && !hasAnswer()}
          data-testid="survey-next-button"
        >
          {currentQuestionIndex === questions.length - 1 ? (
            <>
              Complete
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}
