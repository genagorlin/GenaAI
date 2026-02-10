import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, Loader2, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ContactGenaPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/contact-gena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), clientId }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setSuccess(true);
      setMessage("");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background flex justify-center bg-zinc-100">
      <div className="w-full h-full sm:max-w-[450px] lg:max-w-[700px] xl:max-w-[900px] bg-white shadow-2xl sm:border-x sm:border-zinc-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[hsl(var(--wa-header))] text-white shadow-md">
          <div className="flex items-center gap-3 p-3">
            <Link href={clientId ? `/inbox/${clientId}` : "/"}>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h2 className="text-lg font-medium">Contact Gena</h2>
              <p className="text-xs text-white/80">Send feedback or ask a question</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Message sent!</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                Thank you for reaching out. Gena will get back to you as soon as possible.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSuccess(false)}
                >
                  Send another message
                </Button>
                <Link href={clientId ? `/inbox/${clientId}` : "/"}>
                  <Button className="bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90">
                    Back to inbox
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-violet-600" />
                </div>
                <p className="text-sm text-slate-600">
                  Have a question, idea, or feedback? I'd love to hear from you. Your message will go directly to my inbox.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-slate-700">
                  Your message
                </label>
                <Textarea
                  id="message"
                  placeholder="Share your thoughts, questions, or feedback..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[200px] resize-none"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-[hsl(var(--wa-accent))] hover:bg-[hsl(var(--wa-accent))]/90"
                disabled={isLoading || !message.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send message
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
