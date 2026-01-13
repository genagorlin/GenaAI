import { useState, useRef, useEffect } from "react";
import { ArrowRight, Sparkles, Activity, ShieldCheck, Smartphone, Mail, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first code input when step changes to code
  useEffect(() => {
    if (step === "code" && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus();
    }
  }, [step]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
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
        throw new Error(data.error || "Failed to send code");
      }

      setStep("code");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every(d => d)) {
      handleCodeSubmit(newCode.join(""));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      handleCodeSubmit(pasted);
    }
  };

  const handleCodeSubmit = async (fullCode?: string) => {
    const codeToSubmit = fullCode || code.join("");
    if (codeToSubmit.length !== 6) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeToSubmit }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid code");
      }

      // Redirect to the appropriate page
      window.location.href = data.redirectUrl || "/";
    } catch (err: any) {
      setError(err.message || "Invalid code");
      setCode(["", "", "", "", "", ""]);
      codeInputRefs.current[0]?.focus();
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

             {step === "code" ? (
               <div className="space-y-6">
                 <button
                   type="button"
                   onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); setError(""); }}
                   className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                 >
                   <ArrowLeft className="h-4 w-4 mr-1" />
                   Back
                 </button>

                 <div className="text-center">
                   <h3 className="font-medium text-lg">Enter your code</h3>
                   <p className="text-sm text-muted-foreground mt-1">
                     We sent a 6-digit code to <strong>{email}</strong>
                   </p>
                 </div>

                 <div className="flex justify-center gap-2">
                   {code.map((digit, index) => (
                     <Input
                       key={index}
                       ref={(el) => { codeInputRefs.current[index] = el; }}
                       type="text"
                       inputMode="numeric"
                       maxLength={1}
                       value={digit}
                       onChange={(e) => handleCodeChange(index, e.target.value)}
                       onKeyDown={(e) => handleCodeKeyDown(index, e)}
                       onPaste={handleCodePaste}
                       className="w-12 h-14 text-center text-2xl font-mono"
                       disabled={isLoading}
                     />
                   ))}
                 </div>

                 {error && (
                   <p className="text-sm text-red-500 text-center">{error}</p>
                 )}

                 {isLoading && (
                   <div className="flex justify-center">
                     <Loader2 className="h-6 w-6 animate-spin text-primary" />
                   </div>
                 )}

                 <p className="text-xs text-center text-muted-foreground">
                   Didn't receive a code?{" "}
                   <button
                     type="button"
                     onClick={() => { setStep("email"); setCode(["", "", "", "", "", ""]); }}
                     className="text-primary hover:underline"
                   >
                     Try again
                   </button>
                 </p>
               </div>
             ) : (
               <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                       Sending code...
                     </>
                   ) : (
                     <>
                       Send sign-in code <ArrowRight className="ml-2 h-4 w-4" />
                     </>
                   )}
                 </Button>

                 <p className="text-xs text-center text-muted-foreground">
                   We'll email you a 6-digit code to sign in
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
