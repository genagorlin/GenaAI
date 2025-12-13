import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "ai",
    content: "Hi Sarah. I noticed you were feeling a bit stuck in our last session regarding the team restructure. How is that sitting with you today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
];

export function JournalInterface() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response
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

  return (
    <div className="flex h-full flex-col bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="absolute bottom-[-2px] right-[-2px] h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"></span>
          </div>
          <div>
            <h2 className="font-serif text-lg font-medium leading-none">GenaGPT</h2>
            <p className="text-xs text-muted-foreground">Thinking Partner • Always here</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollRef}>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-4">
          <div className="text-center">
            <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">Today</span>
          </div>
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full flex-col gap-2",
                message.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl p-5 text-base leading-relaxed shadow-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground font-sans rounded-tr-sm"
                    : "bg-card text-card-foreground font-serif rounded-tl-sm border border-border/50"
                )}
              >
                {message.content}
              </div>
              <span className="text-[10px] text-muted-foreground/60 px-2">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-2">
               <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm p-4 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border/40 bg-background/80 p-4 pb-6 backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          <div className="relative rounded-xl border border-border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? (Press Enter to send)"
              className="min-h-[60px] w-full resize-none border-0 bg-transparent p-4 text-base focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                onClick={handleSendMessage} 
                size="sm" 
                className={cn(
                  "h-8 gap-2 px-4 transition-all",
                  inputValue.trim() ? "opacity-100" : "opacity-50"
                )}
                disabled={!inputValue.trim()}
              >
                Reflect <Sparkles className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground/50">
            Your thoughts are private. AI helps you clarify, not judge.
          </p>
        </div>
      </div>
    </div>
  );
}
