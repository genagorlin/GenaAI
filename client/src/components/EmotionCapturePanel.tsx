import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

interface EmotionSnapshot {
  id: string;
  sessionId: string;
  emotionName: string;
  intensity: number | null;
  surfaceContent: string | null;
  tone: string | null;
  actionUrges: string | null;
  underlyingBelief: string | null;
  underlyingValues: string | null;
}

interface EmotionCapturePanelProps {
  sessionId: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const EMOTION_SUGGESTIONS = [
  "Anxiety", "Fear", "Frustration", "Anger", "Sadness", 
  "Guilt", "Shame", "Excitement", "Hope", "Overwhelm"
];

const TONE_SUGGESTIONS = [
  "Bullying", "Defensive", "Pessimistic", "Self-critical",
  "Catastrophizing", "Dismissive", "Protective", "Nurturing"
];

export function EmotionCapturePanel({ sessionId, isExpanded = false, onToggle }: EmotionCapturePanelProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [expandedEmotionId, setExpandedEmotionId] = useState<string | null>(null);
  
  const [newEmotion, setNewEmotion] = useState({
    emotionName: "",
    intensity: 5,
    surfaceContent: "",
    tone: "",
    actionUrges: "",
    underlyingBelief: "",
    underlyingValues: "",
  });

  const { data: emotions = [] } = useQuery<EmotionSnapshot[]>({
    queryKey: ["/api/exercises/sessions", sessionId, "emotions"],
    queryFn: async () => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/emotions`);
      if (!res.ok) throw new Error("Failed to fetch emotions");
      return res.json();
    },
    enabled: !!sessionId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newEmotion) => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/emotions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create emotion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises/sessions", sessionId, "emotions"] });
      setIsAdding(false);
      setNewEmotion({
        emotionName: "",
        intensity: 5,
        surfaceContent: "",
        tone: "",
        actionUrges: "",
        underlyingBelief: "",
        underlyingValues: "",
      });
      toast.success("Emotion captured");
    },
    onError: () => {
      toast.error("Failed to save emotion");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<typeof newEmotion>) => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/emotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update emotion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises/sessions", sessionId, "emotions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/exercises/sessions/${sessionId}/emotions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete emotion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises/sessions", sessionId, "emotions"] });
      toast.success("Emotion removed");
    },
  });

  const handleSaveNew = () => {
    if (!newEmotion.emotionName.trim()) {
      toast.error("Please enter an emotion name");
      return;
    }
    createMutation.mutate(newEmotion);
  };

  const EmotionForm = ({ 
    values, 
    onChange, 
    onSave, 
    onCancel,
    showSave = true
  }: { 
    values: typeof newEmotion; 
    onChange: (field: string, value: any) => void;
    onSave?: () => void;
    onCancel?: () => void;
    showSave?: boolean;
  }) => (
    <div className="space-y-4" data-testid="emotion-form">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Emotion Name
        </label>
        <Input
          placeholder="e.g., Anxiety, Fear, Frustration..."
          value={values.emotionName}
          onChange={(e) => onChange("emotionName", e.target.value)}
          data-testid="input-emotion-name"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {EMOTION_SUGGESTIONS.filter(e => 
            !emotions.some(em => em.emotionName.toLowerCase() === e.toLowerCase())
          ).slice(0, 5).map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onChange("emotionName", suggestion)}
              data-testid={`button-emotion-suggestion-${suggestion.toLowerCase()}`}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Intensity: {values.intensity}/10
        </label>
        <Slider
          value={[values.intensity]}
          onValueChange={([v]) => onChange("intensity", v)}
          max={10}
          min={0}
          step={1}
          className="w-full"
          data-testid="slider-intensity"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Surface Content (I feel this because I think that...)
        </label>
        <Textarea
          placeholder="What thoughts are driving this emotion?"
          value={values.surfaceContent}
          onChange={(e) => onChange("surfaceContent", e.target.value)}
          className="min-h-[60px] resize-none"
          data-testid="input-surface-content"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Tone (How is this emotion speaking to you?)
        </label>
        <Input
          placeholder="e.g., Bullying, Protective, Catastrophizing..."
          value={values.tone}
          onChange={(e) => onChange("tone", e.target.value)}
          data-testid="input-tone"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {TONE_SUGGESTIONS.slice(0, 4).map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onChange("tone", suggestion)}
              data-testid={`button-tone-suggestion-${suggestion.toLowerCase()}`}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Action Urges (What does this emotion want you to do/not do?)
        </label>
        <Textarea
          placeholder="What action is this emotion pushing you toward?"
          value={values.actionUrges}
          onChange={(e) => onChange("actionUrges", e.target.value)}
          className="min-h-[60px] resize-none"
          data-testid="input-action-urges"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Underlying Belief/Mindset
        </label>
        <Textarea
          placeholder="What core belief or mindset drives this emotion?"
          value={values.underlyingBelief}
          onChange={(e) => onChange("underlyingBelief", e.target.value)}
          className="min-h-[60px] resize-none"
          data-testid="input-underlying-belief"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Underlying Values (I feel this because I care about...)
        </label>
        <Textarea
          placeholder="What do you care about that's connected to this emotion?"
          value={values.underlyingValues}
          onChange={(e) => onChange("underlyingValues", e.target.value)}
          className="min-h-[60px] resize-none"
          data-testid="input-underlying-values"
        />
      </div>

      {showSave && (
        <div className="flex gap-2 justify-end pt-2">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-emotion">
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={onSave} data-testid="button-save-emotion">
            Save Emotion
          </Button>
        </div>
      )}
    </div>
  );

  const EmotionCard = ({ emotion }: { emotion: EmotionSnapshot }) => {
    const isExpanded = expandedEmotionId === emotion.id;
    const [editValues, setEditValues] = useState({
      emotionName: emotion.emotionName,
      intensity: emotion.intensity ?? 5,
      surfaceContent: emotion.surfaceContent ?? "",
      tone: emotion.tone ?? "",
      actionUrges: emotion.actionUrges ?? "",
      underlyingBelief: emotion.underlyingBelief ?? "",
      underlyingValues: emotion.underlyingValues ?? "",
    });

    const handleFieldChange = (field: string, value: any) => {
      setEditValues(prev => ({ ...prev, [field]: value }));
      updateMutation.mutate({ id: emotion.id, [field]: value });
    };

    return (
      <div 
        className="border rounded-lg bg-white overflow-hidden"
        data-testid={`card-emotion-${emotion.id}`}
      >
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
          onClick={() => setExpandedEmotionId(isExpanded ? null : emotion.id)}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-2 h-8 rounded-full"
              style={{ 
                backgroundColor: `hsl(${(emotion.intensity ?? 5) * 12}, 70%, 50%)` 
              }}
            />
            <div>
              <p className="font-medium text-sm">{emotion.emotionName}</p>
              {emotion.intensity !== null && (
                <p className="text-xs text-muted-foreground">
                  Intensity: {emotion.intensity}/10
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate(emotion.id);
              }}
              data-testid={`button-delete-emotion-${emotion.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div className="px-3 pb-3 border-t pt-3">
            <EmotionForm
              values={editValues}
              onChange={handleFieldChange}
              showSave={false}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-lg cursor-pointer hover:bg-violet-100 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-violet-800">
              Emotions ({emotions.length})
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-violet-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-violet-600" />
          )}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-2">
        {emotions.map((emotion) => (
          <EmotionCard key={emotion.id} emotion={emotion} />
        ))}
        
        {isAdding ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                Capture New Emotion
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsAdding(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmotionForm
                values={newEmotion}
                onChange={(field, value) => setNewEmotion(prev => ({ ...prev, [field]: value }))}
                onSave={handleSaveNew}
                onCancel={() => setIsAdding(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            className="w-full border-dashed border-violet-300 text-violet-700 hover:bg-violet-50"
            onClick={() => setIsAdding(true)}
            data-testid="button-add-emotion"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Emotion
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
