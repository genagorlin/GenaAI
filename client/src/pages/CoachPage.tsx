import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Search, 
  Bell, 
  Activity, 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  Repeat,
  ArrowRight,
  Sparkles,
  Smartphone,
  Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { SentimentChart } from "@/components/dashboard/SentimentChart";

export default function CoachPage() {
  const [selectedClient, setSelectedClient] = useState("Sarah Miller");

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
             </div>
             <span className="font-serif font-medium">Coach Workspace</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search clients..." className="pl-9 bg-background/50 border-sidebar-border" />
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1 pb-4">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider flex justify-between items-center">
              Active Clients
              <Badge variant="outline" className="text-[10px] h-4 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
                API Online
              </Badge>
            </div>
            {["Sarah Miller", "David Chen", "Elena Rodriguez", "Marcus Johnson"].map((client) => (
              <button
                key={client}
                onClick={() => setSelectedClient(client)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  selectedClient === client 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`relative h-8 w-8 rounded-full flex items-center justify-center ${selectedClient === client ? "bg-white/20" : "bg-sidebar-accent"}`}>
                    <span className="text-xs font-medium">{client.split(' ').map(n => n[0]).join('')}</span>
                    {/* Mobile App Connection Dot */}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-background flex items-center justify-center">
                      <span className={`h-1.5 w-1.5 rounded-full ${client === "Sarah Miller" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                    </span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span>{client}</span>
                    <span className={`text-[10px] ${selectedClient === client ? "text-white/70" : "text-muted-foreground"}`}>
                      {client === "Sarah Miller" ? "Mobile App Active" : "Last seen 2d ago"}
                    </span>
                  </div>
                </div>
                {client === "Sarah Miller" && (
                   <Badge variant="outline" className="bg-background/20 border-white/20 text-[10px] h-5 px-1.5">3 New</Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-4 rounded-lg bg-sidebar-accent p-3">
             <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground mb-1">
               <Wifi className="h-3 w-3 text-emerald-500" /> API Status
             </div>
             <div className="text-[10px] text-muted-foreground">
               Listening for incoming signals from React Native endpoints...
             </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground">
            <Users className="h-4 w-4" /> Manage Clients
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border px-8">
          <div className="flex items-center gap-4">
            <h1 className="font-serif text-2xl font-medium text-foreground">{selectedClient}</h1>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30">
               <Smartphone className="h-3 w-3" />
               Client App Connected
            </div>
          </div>
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" className="text-muted-foreground">
               <Bell className="h-5 w-5" />
             </Button>
             <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
               Prepare Session <ArrowRight className="h-4 w-4" />
             </Button>
          </div>
        </header>

        {/* Dashboard Content */}
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-6xl mx-auto space-y-8">
            
            {/* Top Row: Mental Model & Velocity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Mental Model Card */}
              <div className="lg:col-span-1 rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">AI Mental Model</h3>
                </div>
                <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-xs text-muted-foreground uppercase tracking-wider">Core Values</label>
                     <div className="flex flex-wrap gap-2">
                       <Badge variant="outline" className="bg-background">Autonomy</Badge>
                       <Badge variant="outline" className="bg-background">Competence</Badge>
                       <Badge variant="outline" className="bg-background">Team Harmony</Badge>
                     </div>
                   </div>
                   <Separator />
                   <div className="space-y-2">
                     <label className="text-xs text-muted-foreground uppercase tracking-wider">Current blockers</label>
                     <p className="text-sm text-foreground/80 leading-relaxed">
                       Struggling to delegate due to fear of quality drop. Feeling "imposter" syndrome about new VP title.
                     </p>
                   </div>
                </div>
              </div>

              {/* Chart */}
              <div className="lg:col-span-2">
                 <SentimentChart />
              </div>
            </div>

            {/* Signals Feed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  Recent Signals
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs">Filter by Topic</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs">Export Summary</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InsightCard 
                  category="Emotional Spike"
                  title="Anxiety regarding Board Meeting"
                  description="Sarah expressed high anxiety (8/10) about the upcoming Q3 presentation. Used words like 'trapped', 'unprepared', and 'fake'."
                  timestamp="2 hours ago"
                  icon={AlertCircle}
                />
                <InsightCard 
                  category="Recurring Theme"
                  title="The 'Rescuer' Pattern"
                  description="Third mention this week of stepping in to fix a junior engineer's code late at night. Contradicts her goal of 'stepping back'."
                  timestamp="Yesterday"
                  icon={Repeat}
                />
                <InsightCard 
                  category="Shift"
                  title="Perspective Change on Hiring"
                  description="Showed openness to hiring a senior lead, previously was resistant. Acknowledged she 'can't be everywhere'."
                  timestamp="2 days ago"
                  icon={TrendingUp}
                />
              </div>
            </div>

            {/* Raw Journal Feed Preview */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
               <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
                 <h3 className="font-medium text-sm">Recent Journal Excerpts (Context)</h3>
                 <Button variant="ghost" size="sm" className="text-xs h-7">View Full Log</Button>
               </div>
               <div className="p-6 space-y-4 bg-background/50">
                 <div className="pl-4 border-l-2 border-primary/20 space-y-1">
                   <p className="text-xs text-muted-foreground font-mono">Today, 10:45 AM</p>
                   <p className="text-sm italic text-foreground/80">"I just feel like if I don't check every PR, something will slip through and it will be my fault. I know that's irrational but..."</p>
                 </div>
                 <div className="pl-4 border-l-2 border-primary/20 space-y-1 opacity-70">
                   <p className="text-xs text-muted-foreground font-mono">Yesterday, 4:20 PM</p>
                   <p className="text-sm italic text-foreground/80">"Maybe David is right. I am bottlenecking the team. But letting go feels like jumping off a cliff."</p>
                 </div>
               </div>
            </div>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
