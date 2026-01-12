import { useState } from "react";
import { ArrowRight, Sparkles, Activity, ShieldCheck, Smartphone, Mail, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send login link");
      }

      setIsSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background Noise/Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-secondary blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="z-10 flex w-full max-w-5xl items-center gap-16">

        {/* Left Side: Brand & Value */}
        <div className="hidden lg:flex flex-1 flex-col gap-8">
           <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
             </div>
             <span className="font-serif text-2xl font-medium tracking-tight">GenaGPT</span>
           </div>

           <h1 className="font-serif text-5xl font-medium leading-[1.1] text-foreground">
             Command center for <br/>
             <span className="text-primary italic">AI-Augmented</span> Coaching.
           </h1>

           <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
             Monitor client signals, track emotional velocity, and intervene when it matters most.
           </p>

           <div className="flex flex-col gap-4 mt-4">
              <div className="flex items-center gap-3 text-sm text-foreground/80">
                <Activity className="h-5 w-5 text-emerald-500" />
                Real-time sentiment analysis
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground/80">
                <Smartphone className="h-5 w-5 text-blue-500" />
                Live Mobile App Integration
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground/80">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Enterprise-grade security
              </div>
           </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full max-w-md flex-1">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
             <div className="mb-8 text-center lg:text-left">
                <h2 className="font-serif text-2xl font-medium">Coach Login</h2>
                <p className="text-sm text-muted-foreground mt-1">Access your professional workspace</p>
             </div>

             {isSent ? (
               <div className="space-y-4 text-center">
                 <div className="flex justify-center">
                   <CheckCircle className="h-12 w-12 text-emerald-500" />
                 </div>
                 <h3 className="font-medium text-lg">Check your email</h3>
                 <p className="text-sm text-muted-foreground">
                   We've sent a sign-in link to <strong>{email}</strong>. Click the link in the email to sign in.
                 </p>
                 <Button
                   variant="outline"
                   onClick={() => { setIsSent(false); setEmail(""); }}
                   className="mt-4"
                 >
                   Use a different email
                 </Button>
               </div>
             ) : (
               <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="space-y-2">
                   <label htmlFor="email" className="text-sm font-medium">
                     Email address
                   </label>
                   <div className="relative">
                     <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                       id="email"
                       type="email"
                       placeholder="you@example.com"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="pl-10 h-11"
                       required
                     />
                   </div>
                 </div>

                 {error && (
                   <p className="text-sm text-red-500">{error}</p>
                 )}

                 <Button
                   type="submit"
                   className="w-full h-11 text-base bg-primary hover:bg-primary/90"
                   disabled={isLoading || !email}
                   data-testid="button-login"
                 >
                   {isLoading ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Sending link...
                     </>
                   ) : (
                     <>
                       Send sign-in link <ArrowRight className="ml-2 h-4 w-4" />
                     </>
                   )}
                 </Button>

                 <p className="text-xs text-center text-muted-foreground">
                   We'll email you a magic link to sign in
                 </p>
               </form>
             )}

             <div className="mt-6 pt-6 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>v2.4.0 (Stable)</span>
                <span className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  API Gateway Active
                </span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
