import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const mockWeekSessions = [
  { day: 0, name: 'Easy Run', discipline: 'Run', duration: 45, intensity: 'Easy', completed: true },
  { day: 1, name: 'Strength A', discipline: 'Strength', duration: 60, intensity: 'Hard', completed: true },
  { day: 2, name: 'Tempo + SkiErg', discipline: 'Run + SkiErg', duration: 65, intensity: 'Hard', completed: false },
  { day: 3, name: 'REST', discipline: 'Rest', duration: 0, intensity: 'Easy', completed: false },
  { day: 4, name: 'Intervals + Row', discipline: 'Run + Row', duration: 55, intensity: 'Race Pace', completed: false },
  { day: 5, name: 'HYROX Sim', discipline: 'HYROX', duration: 90, intensity: 'Max Effort', completed: false },
];

const intensityColor: Record<string, string> = {
  Easy: 'bg-success/10 text-success',
  Hard: 'bg-warning/10 text-warning',
  'Race Pace': 'bg-primary/10 text-primary',
  'Max Effort': 'bg-destructive/10 text-destructive',
};

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[80px] text-center">
            {weekOffset === 0 ? 'This Week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="week">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {days.map((day, i) => {
              const session = mockWeekSessions.find(s => s.day === i);
              if (!session) return (
                <Card key={i} className="glass opacity-50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <span className="text-sm font-medium w-10">{day}</span>
                    <span className="text-sm text-muted-foreground">Rest Day</span>
                    <div className="w-16" />
                  </CardContent>
                </Card>
              );
              return (
                <Card key={i} className={`glass ${session.completed ? 'border-success/30' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center min-w-[32px]">
                          <span className="text-xs text-muted-foreground">{day}</span>
                          {session.completed && <div className="h-1.5 w-1.5 rounded-full bg-success mt-1" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{session.name}</p>
                          <p className="text-xs text-muted-foreground">{session.discipline} · {session.duration}min</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={intensityColor[session.intensity] || ''}>
                        {session.intensity}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          <Card className="glass">
            <CardHeader><CardTitle className="text-base font-display">Today's Full Details</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Detailed day view coming soon — will show full session blocks, targets, and logging.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month" className="mt-4">
          <Card className="glass">
            <CardHeader><CardTitle className="text-base font-display">Month Overview</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Calendar month view with volume/intensity heatmap coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
