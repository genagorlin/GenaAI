import { Link } from "wouter";
import { ArrowRight, Lock, BrainCircuit, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import generatedImage from '@assets/generated_images/professional_headshot_of_a_female_coach.png';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background Noise/Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-secondary blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="z-10 flex max-w-3xl flex-col items-center text-center gap-8">
        
        <div className="flex flex-col items-center gap-6 mb-8">
           <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background shadow-xl">
              <img src={generatedImage} alt="Gena" className="h-full w-full object-cover" />
           </div>
           <div>
             <h1 className="font-serif text-5xl font-medium tracking-tight text-foreground sm:text-6xl mb-2">
               Gena
             </h1>
             <p className="text-lg text-muted-foreground font-light tracking-wide">
               AI-Augmented Executive Coaching
             </p>
           </div>
        </div>

        <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Client Entry */}
          <Link href="/client">
            <div className="group relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-center">
                <h3 className="font-serif text-xl font-medium">Client Access</h3>
                <p className="text-sm text-muted-foreground">Enter your private thinking space.</p>
              </div>
              <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-x-1" />
            </div>
          </Link>

          {/* Coach Entry */}
          <Link href="/coach">
            <div className="group relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors group-hover:bg-secondary-foreground group-hover:text-secondary">
                <Activity className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-center">
                <h3 className="font-serif text-xl font-medium">Coach Workspace</h3>
                <p className="text-sm text-muted-foreground">Review signals and insights.</p>
              </div>
               <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-x-1" />
            </div>
          </Link>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground/60 uppercase tracking-widest">
          <Lock className="h-3 w-3" /> Private & Secure Environment
        </div>
      </div>
    </div>
  );
}
