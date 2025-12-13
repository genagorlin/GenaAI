import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { date: "Mon", sentiment: 45, intensity: 30 },
  { date: "Tue", sentiment: 35, intensity: 60 },
  { date: "Wed", sentiment: 60, intensity: 40 },
  { date: "Thu", sentiment: 75, intensity: 20 },
  { date: "Fri", sentiment: 65, intensity: 35 },
  { date: "Sat", sentiment: 80, intensity: 25 },
  { date: "Sun", sentiment: 70, intensity: 30 },
];

export function SentimentChart() {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Emotional Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontFamily: 'var(--font-sans)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="sentiment" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2} 
                dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="intensity" 
                stroke="hsl(var(--accent-foreground))" 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={false}
                opacity={0.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
