import { useState, useRef, useEffect } from "react";
import { ArrowRight, Sparkles, Mail, User, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [about, setAbout] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"register" | "code">("register");
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first code input when step changes to code
  useEffect(() => {
    if (step === "code" && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus();
    }
  }, [step]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/clients/register-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          about: about.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
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
        body: JSON.stringify({ email: email.trim(), code: codeToSubmit }),
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

  const handleResendCode = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/clients/register-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to resend code");
      }

      setCode(["", "", "", "", "", ""]);
      codeInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
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

      <div className="z-10 w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          {/* Header */}
          <div className="mb-8">
            {step === "register" ? (
              <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => { setStep("register"); setCode(["", "", "", "", "", ""]); setError(""); }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="font-serif text-2xl font-medium tracking-tight">GenaAI</span>
            </div>
            {step === "register" ? (
              <>
                <h2 className="font-serif text-2xl font-medium">Create your account</h2>
                <p className="text-sm text-muted-foreground mt-1">Get started with your builder's mindset AI copilot</p>
              </>
            ) : (
              <>
                <h2 className="font-serif text-2xl font-medium">Enter your code</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
              </>
            )}
          </div>

          {step === "code" ? (
            <div className="space-y-6">
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
                  onClick={handleResendCode}
                  className="text-primary hover:underline"
                  disabled={isLoading}
                >
                  Resend code
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Your name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

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

              <div className="space-y-2">
                <label htmlFor="about" className="text-sm font-medium">
                  Tell me a bit about yourself and what brings you to GenaAI
                </label>
                <Textarea
                  id="about"
                  placeholder="I'm looking to work on..."
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Optional, but helps your AI copilot understand you better
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base bg-primary hover:bg-primary/90"
                disabled={isLoading || !name || !email}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                We'll email you a code to sign in
              </p>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
