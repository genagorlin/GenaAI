import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, ChevronRight, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SurveyExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
}

interface SurveyMenuProps {
  clientId: string;
  onSelectSurvey: (surveyId: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurveyMenu({ 
  clientId, 
  onSelectSurvey, 
  isOpen, 
  onOpenChange 
}: SurveyMenuProps) {
  const { data: surveys = [], isLoading } = useQuery<SurveyExercise[]>({
    queryKey: ["/api/surveys"],
    queryFn: async () => {
      const res = await fetch("/api/surveys");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const groupedSurveys = surveys.reduce((acc, survey) => {
    const category = survey.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(survey);
    return acc;
  }, {} as Record<string, SurveyExercise[]>);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Survey Exercises
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(70vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No surveys available yet.</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSurveys).map(([category, categorySurveys]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categorySurveys.map((survey) => (
                      <button
                        key={survey.id}
                        onClick={() => {
                          onSelectSurvey(survey.id);
                          onOpenChange(false);
                        }}
                        className="w-full text-left p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                        data-testid={`survey-option-${survey.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{survey.title}</span>
                              {survey.estimatedMinutes && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {survey.estimatedMinutes}m
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {survey.description}
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
