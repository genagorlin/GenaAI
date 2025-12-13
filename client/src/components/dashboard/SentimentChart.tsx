import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SentimentChartProps {
  data: Array<{
    date: string;
    sentimentScore: number;
    intensityScore: number;
  }>;
}

export function SentimentChart({ data }: SentimentChartProps) {
  const chartData = data.map(d => ({
    date: d.date,
    sentiment: d.sentimentScore,
    intensity: d.intensityScore
  }));
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Emotional Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
