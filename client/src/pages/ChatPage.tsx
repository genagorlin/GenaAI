import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MoreVertical, Smile, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  clientId: string;
  role: "user" | "ai";
  content: string;
  type: string;
  duration: string | null;
  timestamp: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

export default function ChatPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const queryClient = useQueryClient();

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/chat", clientId, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${clientId}/info`);
      if (!res.ok) throw new Error("Client not found");
      return res.json();
    },
    enabled: !!clientId,
    retry: false
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/clients", clientId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clientId,
    refetchInterval: 5000
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsAiTyping(true);
      const res = await fetch(`/api/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content, type: "text" })
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "messages"] });
      setIsAiTyping(false);
    },
    onError: () => {
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
    sendMessageMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setIsTranscribing(true);
        
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          
          if (!response.ok) throw new Error("Transcription failed");
          
          const { text } = await response.json();
          if (text && text.trim()) {
            sendMessageMutation.mutate(text.trim());
          }
        } catch (error) {
          console.error("Transcription error:", error);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [sendMessageMutation]);

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

  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
      <div className="w-full h-full sm:max-w-[450px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden relative flex flex-col">
        <div className="absolute inset-0 z-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>

        <div className="z-10 flex items-center gap-3 bg-[hsl(var(--wa-header))] p-3 text-white shadow-md">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
            <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-lg">
              G
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="truncate text-lg font-medium leading-tight" data-testid="text-chat-title">GenaGPT</h2>
            {isAiTyping ? (
              <p className="truncate text-xs text-white/80">typing...</p>
            ) : (
              <p className="truncate text-xs text-white/80">Your thinking partner</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-white/70">
            <MoreVertical className="h-5 w-5" />
          </div>
        </div>

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
              messages.map((message) => (
                <div
                  key={message.id}
                  data-testid={`message-${message.id}`}
                  className={cn(
                    "flex max-w-[85%] flex-col rounded-lg px-2 pt-2 pb-1 shadow-sm relative",
                    message.role === "user"
                      ? "self-end bg-[hsl(var(--wa-outgoing))] text-slate-900 rounded-tr-none"
                      : "self-start bg-white text-slate-900 rounded-tl-none"
                  )}
                >
                  <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap px-1">
                    {message.content}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10px] text-slate-500/80">
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
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message"
              className="flex-1 min-h-[24px] max-h-[100px] border-0 bg-transparent p-1 text-[16px] focus-visible:ring-0 placeholder:text-slate-400 resize-none leading-5"
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
    </div>
  );
}
