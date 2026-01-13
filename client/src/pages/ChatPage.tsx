import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Mic, BookOpen, Smile, Loader2, Square, ArrowLeft, ChevronRight, X, Dumbbell, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ExerciseMenu } from "@/components/ExerciseMenu";
import { ExerciseProgress } from "@/components/ExerciseProgress";
import { SurveyMenu } from "@/components/SurveyMenu";
import { SurveyPlayer } from "@/components/SurveyPlayer";
import { ClipboardList } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface ReferenceDocument {
  id: number;
  title: string;
  content: string;
  description: string | null;
  createdAt: string;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

interface Message {
  id: string;
  clientId: string;
  threadId: string | null;
  role: "user" | "ai" | "coach";
  content: string;
  type: string;
  duration: string | null;
  timestamp: string;
}

interface Thread {
  id: string;
  clientId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface GuidedExercise {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMinutes?: number;
}

interface ExerciseStep {
  id: string;
  title: string;
  instructions: string;
  stepOrder: number;
}

interface ExerciseSession {
  id: string;
  clientId: string;
  exerciseId: string;
  threadId: string | null;
  currentStepId: string | null;
  status: string;
}

interface ExerciseSessionData {
  session: ExerciseSession;
  exercise: GuidedExercise;
  currentStep: ExerciseStep | null;
  steps: ExerciseStep[];
}

export default function ChatPage() {
  const { clientId, threadId } = useParams<{ clientId: string; threadId: string }>();
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showExercises, setShowExercises] = useState(false);
  const [showSurveys, setShowSurveys] = useState(false);
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ReferenceDocument | null>(null);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(() => {
    // Persist voice mode preference in localStorage
    const saved = localStorage.getItem("voiceModeEnabled");
    return saved === "true";
  });
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const voiceModeRef = useRef(voiceModeEnabled);
  const queryClient = useQueryClient();

  // Check if user is authenticated for client access
  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { authenticated: false };
      return res.json();
    },
    retry: false
  });

  // Redirect to client login if not authenticated
  useEffect(() => {
    if (!authLoading && authStatus && !authStatus.authenticated && clientId) {
      const returnTo = encodeURIComponent(`/chat/${clientId}`);
      window.location.href = `/api/client/login?returnTo=${returnTo}`;
    }
  }, [authLoading, authStatus, clientId]);

  const { data: client, error: clientError } = useQuery<Client>({
    queryKey: ["/api/chat", clientId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${clientId}/info`);
      if (res.status === 401) {
        // Session upgrade required or not authenticated - redirect to login
        const returnTo = encodeURIComponent(`/chat/${clientId}${threadId ? `/${threadId}` : ''}`);
        window.location.href = `/api/client/login?returnTo=${returnTo}`;
        throw new Error("reauth-required");
      }
      if (res.status === 403) {
        throw new Error("email-mismatch");
      }
      if (res.status === 404) {
        throw new Error("not-found");
      }
      if (!res.ok) throw new Error("unknown");
      return res.json();
    },
    enabled: !!clientId && authStatus?.authenticated,
    retry: false
  });

  // Handle access denied - redirect to access denied page
  useEffect(() => {
    if (clientError && clientError.message !== "reauth-required") {
      const reason = clientError.message === "email-mismatch" ? "email-mismatch" : 
                     clientError.message === "not-found" ? "not-found" : "unknown";
      setLocation(`/client-access-denied?reason=${reason}&clientId=${clientId}`);
    }
  }, [clientError, clientId, setLocation]);

  const { data: thread } = useQuery<Thread>({
    queryKey: ["/api/threads", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/threads/${threadId}`);
      if (!res.ok) throw new Error("Thread not found");
      return res.json();
    },
    enabled: !!threadId,
    retry: false
  });

  const { data: referenceDocuments = [] } = useQuery<ReferenceDocument[]>({
    queryKey: ["/api/reference-documents"],
    queryFn: async () => {
      const res = await fetch("/api/reference-documents");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showLibrary,
    staleTime: 5 * 60 * 1000
  });

  const { data: exerciseSessionData } = useQuery<ExerciseSessionData | null>({
    queryKey: ["/api/clients", clientId, "threads", threadId, "exercise-session"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/threads/${threadId}/exercise-session`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!clientId && !!threadId,
    staleTime: 30 * 1000,
  });

  const startExerciseMutation = useMutation({
    mutationFn: async (exercise: GuidedExercise) => {
      const stepsRes = await fetch(`/api/exercises/${exercise.id}/steps`);
      const steps = await stepsRes.json();
      const firstStep = steps.length > 0 ? steps[0] : null;
      
      const res = await fetch(`/api/clients/${clientId}/exercise-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: exercise.id,
          threadId,
          currentStepId: firstStep?.id || null,
          status: "in_progress",
        }),
      });
      if (!res.ok) throw new Error("Failed to start exercise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/clients", clientId, "threads", threadId, "exercise-session"] 
      });
    },
  });

  const updateExerciseSessionMutation = useMutation({
    mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: { currentStepId?: string | null; status?: string; summary?: string } }) => {
      console.log("[Exercise] Updating session:", sessionId, "with:", updates);
      const res = await fetch(`/api/exercise-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("[Exercise] Update failed:", res.status, errorText);
        throw new Error("Failed to update exercise session");
      }
      const result = await res.json();
      console.log("[Exercise] Update result:", result);
      return result;
    },
    onSuccess: () => {
      console.log("[Exercise] Invalidating and refetching session data after update");
      queryClient.invalidateQueries({ 
        queryKey: ["/api/clients", clientId, "threads", threadId, "exercise-session"] 
      });
    },
    onError: (error) => {
      console.error("[Exercise] Mutation error:", error);
    },
  });

  const handleAdvanceStep = () => {
    console.log("[Exercise] handleAdvanceStep called, session data:", exerciseSessionData);
    if (!exerciseSessionData?.session?.id) {
      console.log("[Exercise] No session data or ID available");
      return;
    }
    const { session, currentStep, steps } = exerciseSessionData;
    const currentIndex = currentStep ? steps.findIndex(s => s.id === currentStep.id) : -1;
    console.log("[Exercise] Current step index:", currentIndex, "of", steps.length, "steps");
    
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      console.log("[Exercise] Advancing to next step:", nextStep.id, nextStep.title);
      updateExerciseSessionMutation.mutate({ 
        sessionId: session.id, 
        updates: { currentStepId: nextStep.id } 
      });
    } else {
      console.log("[Exercise] On last step, marking as completed");
      updateExerciseSessionMutation.mutate({ 
        sessionId: session.id,
        updates: { status: "completed", currentStepId: null }
      });
    }
  };

  const handleExitExercise = () => {
    if (!exerciseSessionData?.session?.id) return;
    updateExerciseSessionMutation.mutate({ 
      sessionId: exerciseSessionData.session.id, 
      updates: { status: "abandoned" } 
    });
  };

  const handleGoBack = () => {
    console.log("[Exercise] handleGoBack called");
    if (!exerciseSessionData?.session?.id) {
      console.log("[Exercise] No session data or ID available for going back");
      return;
    }
    const { session, currentStep, steps } = exerciseSessionData;
    const currentIndex = currentStep ? steps.findIndex(s => s.id === currentStep.id) : -1;
    console.log("[Exercise] Current step index:", currentIndex);
    
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      console.log("[Exercise] Going back to step:", prevStep.id, prevStep.title);
      updateExerciseSessionMutation.mutate({ 
        sessionId: session.id, 
        updates: { currentStepId: prevStep.id } 
      });
    }
  };

  const handleBackToInbox = () => {
    setLocation(`/chat/${clientId}`);
  };

  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSessionEnd = useCallback(async () => {
    if (!clientId) return;
    
    try {
      await fetch(`/api/clients/${clientId}/session-end`, { method: "POST" });
      console.log("[Session] Session end triggered");
    } catch (error) {
      console.error("[Session] Failed to trigger session end:", error);
    }
  }, [clientId]);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    inactivityTimerRef.current = setTimeout(() => {
      console.log("[Session] Inactivity timeout reached");
      triggerSessionEnd();
    }, INACTIVITY_TIMEOUT_MS);
  }, [triggerSessionEnd]);

  useEffect(() => {
    resetInactivityTimer();
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerSessionEnd();
      } else if (document.visibilityState === "visible") {
        resetInactivityTimer();
      }
    };

    const handleBeforeUnload = () => {
      if (clientId) {
        navigator.sendBeacon(`/api/clients/${clientId}/session-end`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [clientId, triggerSessionEnd, resetInactivityTimer]);

  const [openingTimeout, setOpeningTimeout] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);
  
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/threads", threadId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/threads/${threadId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!threadId,
    refetchInterval: hasMessages ? 5000 : 1000
  });
  
  useEffect(() => {
    if (messages.length > 0) {
      setHasMessages(true);
      setOpeningTimeout(false);
      return;
    }
    
    // Show fallback after 10 seconds of waiting
    const timeout = setTimeout(() => {
      setOpeningTimeout(true);
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [messages.length]);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    voiceModeRef.current = voiceModeEnabled;
  }, [voiceModeEnabled]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
    };
  }, []);

  // Helper to clean up audio resources
  const cleanupAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setIsPlayingAudio(false);
  }, []);

  // Toggle voice mode and persist preference
  const toggleVoiceMode = useCallback(() => {
    const newValue = !voiceModeRef.current;
    setVoiceModeEnabled(newValue);
    localStorage.setItem("voiceModeEnabled", String(newValue));
    voiceModeRef.current = newValue;
    
    // Stop any playing audio when disabling voice mode
    if (!newValue) {
      cleanupAudio();
    }
  }, [cleanupAudio]);

  // Play text-to-speech for a message
  const playTTS = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    // Clean up any existing audio first
    cleanupAudio();
    
    try {
      setIsPlayingAudio(true);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("TTS error:", errorData);
        toast.error("Voice playback unavailable", {
          description: "The AI response will be shown as text only."
        });
        setIsPlayingAudio(false);
        return;
      }
      
      const { audio, format } = await response.json();
      
      // Convert base64 to audio and play
      const audioData = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      const blob = new Blob([audioData], { type: `audio/${format}` });
      const url = URL.createObjectURL(blob);
      currentAudioUrlRef.current = url;
      
      const audioElement = new Audio(url);
      currentAudioRef.current = audioElement;
      
      audioElement.onended = () => {
        if (currentAudioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          currentAudioUrlRef.current = null;
        }
        currentAudioRef.current = null;
        setIsPlayingAudio(false);
      };
      
      audioElement.onerror = () => {
        if (currentAudioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          currentAudioUrlRef.current = null;
        }
        currentAudioRef.current = null;
        setIsPlayingAudio(false);
        toast.error("Voice playback failed", {
          description: "There was a problem playing the audio."
        });
      };
      
      await audioElement.play();
    } catch (error) {
      console.error("Failed to play TTS:", error);
      cleanupAudio();
      toast.error("Voice playback unavailable", {
        description: "Could not generate voice response."
      });
    }
  }, [cleanupAudio]);

  // Stop currently playing audio
  const stopAudio = useCallback(() => {
    cleanupAudio();
  }, [cleanupAudio]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content, type: "text", threadId })
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/threads", threadId, "messages"] });
      
      const previousMessages = queryClient.getQueryData<Message[]>(["/api/threads", threadId, "messages"]);
      
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        clientId: clientId!,
        threadId: threadId || null,
        role: "user",
        content,
        type: "text",
        duration: null,
        timestamp: new Date().toISOString()
      };
      
      queryClient.setQueryData<Message[]>(
        ["/api/threads", threadId, "messages"],
        (old) => [...(old || []), optimisticMessage]
      );
      
      setIsAiTyping(true);
      
      return { previousMessages };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads", threadId, "messages"] });
      setIsAiTyping(false);
      
      // Auto-play AI response if voice mode is enabled (use ref for current value)
      if (voiceModeRef.current && data?.aiMessage?.content) {
        playTTS(data.aiMessage.content);
      }
    },
    onError: (err, content, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/threads", threadId, "messages"], context.previousMessages);
      }
      setIsAiTyping(false);
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || sendMessageMutation.isPending) return;
    const content = inputValue.trim();
    setInputValue("");
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    resetInactivityTimer();
    sendMessageMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Reset height to auto to correctly calculate scrollHeight
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to find a supported MIME type
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else {
          // Fallback - let browser choose
          mimeType = "";
        }
      }
      
      const recorderOptions = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          console.log("No audio chunks recorded");
          return;
        }
        
        const actualMimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        console.log("Audio recorded:", audioBlob.size, "bytes, type:", actualMimeType);
        setIsTranscribing(true);
        
        try {
          const formData = new FormData();
          // Use appropriate extension based on mime type
          const ext = actualMimeType.includes("mp4") ? "m4a" : actualMimeType.includes("ogg") ? "ogg" : "webm";
          formData.append("audio", audioBlob, `recording.${ext}`);
          
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Transcription API error:", response.status, errorData);
            const errorMsg = errorData?.details || errorData?.error || "Transcription failed";
            alert(`Voice transcription error: ${errorMsg}`);
            throw new Error(errorMsg);
          }
          
          const { text } = await response.json();
          console.log("Transcription result:", text);
          if (text && text.trim()) {
            resetInactivityTimer();
            sendMessageMutation.mutate(text.trim());
          }
        } catch (error) {
          console.error("Transcription error:", error);
        } finally {
          setIsTranscribing(false);
        }
      };

      // Request data every second to ensure we capture audio
      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check your browser permissions.");
    }
  }, [sendMessageMutation, resetInactivityTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getFirstName = (fullName: string) => {
    return fullName?.split(' ')[0] || 'there';
  };

  if (!clientId) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center p-6">
          <p className="text-muted-foreground">Invalid chat link</p>
        </div>
      </div>
    );
  }

  // Show loading while checking auth
  if (authLoading || (!authStatus?.authenticated)) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
      <div className="w-full h-full sm:max-w-[450px] lg:max-w-[700px] xl:max-w-[900px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden relative flex flex-col">
        <div className="absolute inset-0 z-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>

        <div className="z-10 flex items-center gap-3 bg-[hsl(var(--wa-header))] p-3 text-white shadow-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToInbox}
            className="h-8 w-8 text-white hover:bg-white/10 shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
            <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-lg">
              G
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="truncate text-lg font-medium leading-tight" data-testid="text-chat-title">GenaAI</h2>
            {isAiTyping ? (
              <p className="truncate text-xs text-white/80">typing...</p>
            ) : (
              <p className="truncate text-xs text-white/80">Your thinking partner</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowExercises(true)}
            className="h-8 w-8 text-white hover:bg-white/10"
            data-testid="button-exercises"
          >
            <Dumbbell className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSurveys(true)}
            className="h-8 w-8 text-white hover:bg-white/10"
            data-testid="button-surveys"
          >
            <ClipboardList className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLibrary(true)}
            className="h-8 w-8 text-white hover:bg-white/10"
            data-testid="button-library"
          >
            <BookOpen className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={isPlayingAudio ? stopAudio : toggleVoiceMode}
            className={cn(
              "h-8 w-8 hover:bg-white/10",
              voiceModeEnabled ? "text-emerald-300" : "text-white"
            )}
            data-testid="button-voice-mode"
            title={voiceModeEnabled ? "Voice mode ON - click to disable" : "Enable voice mode"}
          >
            {isPlayingAudio ? (
              <Square className="h-4 w-4" />
            ) : voiceModeEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
        </div>

        {exerciseSessionData && exerciseSessionData.session.status === "in_progress" && (
          <ExerciseProgress
            exercise={exerciseSessionData.exercise}
            session={exerciseSessionData.session}
            currentStep={exerciseSessionData.currentStep}
            steps={exerciseSessionData.steps}
            onAdvanceStep={handleAdvanceStep}
            onGoBack={handleGoBack}
            onExitExercise={handleExitExercise}
            isAdvancing={updateExerciseSessionMutation.isPending}
          />
        )}

        <div className="z-10 flex-1 overflow-y-auto p-2 sm:p-4 bg-[#efe7dd]" ref={scrollRef}>
          <div className="flex flex-col gap-2 pb-2">
            <div className="flex justify-center py-2">
              <span className="bg-[#e1f3fb] text-slate-600 text-[11px] px-2 py-1 rounded-lg shadow-sm font-medium">
                Today
              </span>
            </div>

            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : messages.length === 0 ? (
              openingTimeout ? (
                <div className="self-start bg-white text-slate-900 rounded-lg rounded-tl-none px-3 py-2 shadow-sm max-w-[85%]">
                  <p className="text-[15px] leading-relaxed">
                    Hi {client ? getFirstName(client.name) : 'there'}! I'm here whenever you want to think something through. What's on your mind?
                  </p>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-500/80">
                      {formatTime(new Date().toISOString())}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="self-start bg-white text-slate-900 rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  data-testid={`message-${message.id}`}
                  className={cn(
                    "flex max-w-[85%] flex-col rounded-lg px-2 pt-2 pb-1 shadow-sm relative",
                    message.role === "user"
                      ? "self-end bg-[hsl(var(--wa-outgoing))] text-slate-900 rounded-tr-none"
                      : message.role === "coach"
                      ? "self-start bg-violet-500 text-white rounded-tl-none"
                      : "self-start bg-white text-slate-900 rounded-tl-none"
                  )}
                >
                  {message.role === "coach" && (
                    <div className="text-[10px] font-medium text-violet-100 px-1 mb-0.5">
                      Coach Gena
                    </div>
                  )}
                  <div className="text-[15px] leading-relaxed break-words px-1 prose prose-sm prose-slate max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className={cn(
                      "text-[10px]",
                      message.role === "coach" ? "text-violet-100/80" : "text-slate-500/80"
                    )}>
                      {formatTime(message.timestamp)}
                    </span>
                    {message.role === "user" && (
                      <span className="text-blue-500">
                        <svg viewBox="0 0 16 15" width="16" height="15">
                          <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.06a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.06a.366.366 0 0 0-.064-.512z"></path>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            {isAiTyping && (
              <div className="self-start bg-white text-slate-900 rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="z-10 bg-[#f0f2f5] px-2 py-2 flex items-end gap-2">
          <div className="flex-1 bg-white rounded-[24px] min-h-[44px] flex items-center px-3 py-1 shadow-sm gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0">
              <Smile className="h-6 w-6" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message"
              className="flex-1 min-h-[24px] max-h-[200px] border-0 bg-transparent p-1 text-[16px] focus-visible:ring-0 placeholder:text-slate-400 resize-none leading-5 overflow-y-auto"
              rows={1}
              data-testid="input-message"
            />
          </div>
          
          {inputValue.trim() ? (
            <Button 
              size="icon" 
              className="h-11 w-11 rounded-full shadow-md shrink-0 transition-all duration-200 bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90 text-white"
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending}
              data-testid="button-send"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          ) : (
            <Button 
              size="icon" 
              className={cn(
                "h-11 w-11 rounded-full shadow-md shrink-0 transition-all duration-200",
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
                  : isTranscribing
                  ? "bg-amber-500 text-white"
                  : "bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90 text-white"
              )}
              onClick={handleMicClick}
              disabled={isTranscribing}
              data-testid="button-mic"
            >
              {isTranscribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRecording ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      <Sheet open={showLibrary} onOpenChange={setShowLibrary}>
        <SheetContent side="right" className="w-full sm:max-w-md lg:max-w-lg xl:max-w-xl p-0 flex flex-col">
          {selectedDocument ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b bg-slate-50">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDocument(null)}
                  className="h-8 w-8"
                  data-testid="button-library-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{selectedDocument.title}</h3>
                  {selectedDocument.description && (
                    <p className="text-sm text-muted-foreground truncate">{selectedDocument.description}</p>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {selectedDocument.content}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <SheetHeader className="p-4 border-b bg-slate-50">
                <SheetTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Gena's Writings
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Explore the ideas and frameworks that inform your coaching sessions
                </p>
              </SheetHeader>
              <ScrollArea className="flex-1">
                {referenceDocuments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No writings available yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {referenceDocuments.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        data-testid={`document-${doc.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 truncate">{doc.title}</h4>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">{doc.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {Math.round(doc.content.split(/\s+/).length)} words
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ExerciseMenu
        clientId={clientId || ""}
        threadId={threadId}
        onSelectExercise={(exercise) => startExerciseMutation.mutate(exercise)}
        isOpen={showExercises}
        onOpenChange={setShowExercises}
      />

      <SurveyMenu
        clientId={clientId || ""}
        isOpen={showSurveys}
        onOpenChange={setShowSurveys}
        onSelectSurvey={(surveyId) => {
          setShowSurveys(false);
          setActiveSurveyId(surveyId);
        }}
      />

      {activeSurveyId && (
        <SurveyPlayer
          clientId={clientId || ""}
          surveyId={activeSurveyId}
          onClose={() => setActiveSurveyId(null)}
          onComplete={(summary) => {
            toast.success("Survey completed!");
          }}
        />
      )}
    </div>
  );
}
