import { Link } from "wouter";
import { ArrowRight, Lock, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background Noise/Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-secondary blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="z-10 flex w-full max-w-md flex-col items-center text-center gap-12">
        
        <div className="flex flex-col items-center gap-6">
           <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl">
              <Sparkles className="h-10 w-10" />
           </div>
           <div>
             <h1 className="font-serif text-5xl font-medium tracking-tight text-foreground mb-2">
               GenaGPT
             </h1>
             <p className="text-lg text-muted-foreground font-light tracking-wide">
               Your private AI thinking partner.
             </p>
           </div>
        </div>

        {/* Client Entry - Center Stage */}
        <Link href="/client" className="w-full">
          <div className="group relative flex w-full cursor-pointer items-center gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/20">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Brain className="h-7 w-7" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-serif text-xl font-medium">Start Reflection</h3>
              <p className="text-sm text-muted-foreground">Enter your private journal space.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </Link>

        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60 uppercase tracking-widest">
          <Lock className="h-3 w-3" /> Private & Secure Environment
        </div>
      </div>

      {/* Discreet Coach Login */}
      <div className="absolute bottom-8 z-10">
        <Link href="/coach">
          <Button variant="link" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            Log in as Coach
          </Button>
        </Link>
      </div>
    </div>
  );
}
