import { useState, useEffect, useRef } from "react";
import { Send, Mic, Camera, Paperclip, MoreVertical, Phone, Video, ChevronLeft, Smile, Trash2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  type: "text" | "audio";
  duration?: string; // For audio messages
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "ai",
    content: "Hi Sarah. I noticed you were feeling a bit stuck in our last session regarding the team restructure. How is that sitting with you today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    type: "text"
  },
];

export function JournalInterface() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isRecording]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
      type: "text"
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    triggerAiResponse();
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = (cancel = false) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    
    if (!cancel) {
      // Format time MM:SS
      const mins = Math.floor(recordingTime / 60);
      const secs = recordingTime % 60;
      const duration = `${mins}:${secs.toString().padStart(2, '0')}`;

      const newMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: "Voice Note",
        timestamp: new Date(),
        type: "audio",
        duration: duration
      };
      setMessages((prev) => [...prev, newMessage]);
      triggerAiResponse();
    }
    setRecordingTime(0);
  };

  // Mock Transcription
  const transcribeVoice = () => {
    // Stop recording and "transcribe"
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    
    setInputValue("I'm actually feeling a bit better about it, but still worried about the timeline.");
  };

  const triggerAiResponse = () => {
    setIsTyping(true);
    setTimeout(() => {
      const aiResponses = [
        "That sounds heavy. When you say you feel 'responsible' for their reaction, what does that responsibility look like to you?",
        "I hear a lot of hesitation in that. Is it the decision itself that feels wrong, or the way you think it will be received?",
        "Let's pause on that feeling of 'imposter' for a second. If you stepped outside of yourself and looked at the facts, what would you see?",
      ];
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: randomResponse,
        timestamp: new Date(),
        type: "text"
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full flex-col bg-[#efe7dd] dark:bg-zinc-900 relative overflow-hidden">
      {/* WhatsApp Background Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat text-slate-900 dark:invert"></div>

      {/* Header */}
      <div className="z-10 flex items-center gap-3 bg-[hsl(var(--wa-header))] p-3 text-white shadow-md">
        <Link href="/">
           <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 -ml-2">
             <ChevronLeft className="h-6 w-6" />
           </Button>
        </Link>
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
          <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-lg">
            G
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <h2 className="truncate text-lg font-medium leading-tight">GenaGPT</h2>
          {isTyping ? (
            <p className="truncate text-xs text-white/80">typing...</p>
          ) : (
            <p className="truncate text-xs text-white/80">Online</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-white">
          <Video className="h-6 w-6" />
          <Phone className="h-5 w-5" />
          <MoreVertical className="h-5 w-5" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="z-10 flex-1 overflow-y-auto p-2 sm:p-4" ref={scrollRef}>
        <div className="flex flex-col gap-2 pb-2">
          {/* Date Separator */}
          <div className="flex justify-center py-2">
             <span className="bg-[#e1f3fb] dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] px-2 py-1 rounded-lg shadow-sm font-medium">
               Today
             </span>
          </div>

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex max-w-[85%] flex-col rounded-lg px-2 pt-2 pb-1 shadow-sm relative group",
                message.role === "user"
                  ? "self-end bg-[hsl(var(--wa-outgoing))] text-slate-900 rounded-tr-none"
                  : "self-start bg-[hsl(var(--wa-incoming))] text-slate-900 rounded-tl-none"
              )}
            >
              {message.type === "audio" ? (
                 <div className="flex items-center gap-3 pr-2 min-w-[200px] py-1">
                    <div className="h-10 w-10 rounded-full bg-slate-400/20 flex items-center justify-center text-slate-500">
                       <Mic className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                       <div className="h-1 bg-slate-300 rounded-full w-full mb-1"></div>
                       <span className="text-xs text-slate-500">{message.duration}</span>
                    </div>
                 </div>
              ) : (
                 <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap font-sans">
                   {message.content}
                 </div>
              )}
              
              <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
                <span className="text-[10px] text-slate-500/80">
                  {formatTime(message.timestamp)}
                </span>
                {message.role === "user" && (
                  <span className="text-blue-500">
                    <svg viewBox="0 0 16 15" width="16" height="15" className="">
                        <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.06a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.06a.366.366 0 0 0-.064-.512z"></path>
                    </svg>
                  </span>
                )}
              </div>

              {/* Little triangle for bubble tail */}
              {message.role === "user" ? (
                  <span className="absolute top-0 -right-2 w-0 h-0 border-[8px] border-t-[hsl(var(--wa-outgoing))] border-r-transparent border-b-transparent border-l-transparent transform rotate-0 z-0"></span>
              ) : (
                  <span className="absolute top-0 -left-2 w-0 h-0 border-[8px] border-t-[hsl(var(--wa-incoming))] border-l-transparent border-b-transparent border-r-transparent transform rotate-0 z-0"></span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="z-10 bg-[#f0f2f5] dark:bg-zinc-800 px-2 py-2 flex items-end gap-2">
        {isRecording ? (
           <div className="flex-1 bg-white dark:bg-zinc-700 rounded-full h-12 flex items-center px-4 gap-4 animate-in slide-in-from-bottom-2 duration-200">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="flex-1 text-slate-600 dark:text-slate-200 font-mono">{formatRecordingTime(recordingTime)}</span>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500" onClick={() => stopRecording(true)}>
                 <Trash2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 font-medium" onClick={transcribeVoice}>
                 Transcribe
              </Button>
              <Button size="icon" className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => stopRecording(false)}>
                 <Send className="h-4 w-4" />
              </Button>
           </div>
        ) : (
          <>
            <div className="flex-1 bg-white dark:bg-zinc-700 rounded-[24px] min-h-[44px] flex items-center px-3 py-1 shadow-sm gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0">
                <Smile className="h-6 w-6" />
              </Button>
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message"
                className="flex-1 min-h-[24px] max-h-[100px] border-0 bg-transparent p-1 text-[16px] focus-visible:ring-0 placeholder:text-slate-400 resize-none leading-5 scrollbar-hide"
                rows={1}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0 transform rotate-[-45deg]">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0">
                <Camera className="h-5 w-5" />
              </Button>
            </div>
            
            <Button 
              size="icon" 
              className={cn(
                "h-11 w-11 rounded-full shadow-md shrink-0 transition-all duration-200",
                inputValue.trim() 
                  ? "bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90 text-white" 
                  : "bg-[hsl(var(--wa-mic))] hover:bg-[hsl(var(--wa-mic))]/90 text-white"
              )}
              onClick={inputValue.trim() ? handleSendMessage : startRecording}
            >
              {inputValue.trim() ? <Send className="h-5 w-5 ml-0.5" /> : <Mic className="h-5 w-5" />}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
