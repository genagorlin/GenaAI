import { ArrowRight, Sparkles, Activity, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
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

             <div className="space-y-4">
                <Button 
                  onClick={handleLogin}
                  className="w-full h-11 text-base bg-primary hover:bg-primary/90"
                  data-testid="button-login"
                >
                  Sign in with Google <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Secure authentication powered by Replit
                </p>
             </div>

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
