import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface InsightCardProps {
  title: string;
  category: "Emotional Spike" | "Recurring Theme" | "Shift" | "Contradiction";
  description: string;
  timestamp: string;
  icon: LucideIcon;
  className?: string;
}

export function InsightCard({ title, category, description, timestamp, icon: Icon, className }: InsightCardProps) {
  const categoryStyles = {
    "Emotional Spike": "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30",
    "Recurring Theme": "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30",
    "Shift": "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30",
    "Contradiction": "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30",
  };

  return (
    <div className={cn(
      "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md",
      className
    )}>
      <div className="flex items-start justify-between">
        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border", categoryStyles[category])}>
          {category}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{timestamp}</span>
      </div>
      
      <div className="flex gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/50 text-secondary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-medium leading-tight text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
