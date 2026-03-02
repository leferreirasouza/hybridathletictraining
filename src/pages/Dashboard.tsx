import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Dumbbell, Clock, Target, TrendingUp, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const mockTodaySession = {
  discipline: 'Run + SkiErg',
  name: 'Tempo Run + Station Work',
  duration: 65,
  intensity: 'Hard',
  details: '8km tempo run @ 5:00/km → 1000m SkiErg @ 1:55/500m',
  blocks: [
    { name: '8km Tempo Run', target: '5:00/km', type: 'run' },
    { name: 'SkiErg 1000m', target: '1:55/500m', type: 'skierg' },
    { name: 'Wall Balls x30', target: '6kg', type: 'station' },
  ],
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Athlete';

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        {/* Greeting */}
        <motion.div variants={item}>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-display font-bold mt-1">
            Hey, {firstName} 👊
          </h1>
        </motion.div>

        {/* Today's Session Card */}
        <motion.div variants={item}>
          <Card className="glass overflow-hidden border-primary/20">
            <div className="h-1 gradient-hyrox" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-display">{mockTodaySession.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{mockTodaySession.discipline}</p>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                  {mockTodaySession.intensity}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{mockTodaySession.duration} min</span>
                <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />3 blocks</span>
              </div>

              <div className="space-y-2">
                {mockTodaySession.blocks.map((block, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full gradient-hyrox" />
                      <span className="text-sm font-medium">{block.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{block.target}</span>
                  </div>
                ))}
              </div>

              <Button className="w-full gradient-hyrox mt-2" onClick={() => navigate('/log')}>
                <Dumbbell className="h-4 w-4 mr-2" /> Start Session
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3">
          {[
            { label: 'Week Volume', value: '32 km', icon: TrendingUp },
            { label: 'Sessions', value: '4/6', icon: Calendar },
            { label: 'Avg RPE', value: '6.5', icon: Target },
          ].map((stat) => (
            <Card key={stat.label} className="glass">
              <CardContent className="p-3 text-center">
                <stat.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-lg font-display font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Week Overview */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display">This Week</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/schedule')}>
                  View all <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                  const isToday = i === new Date().getDay() - 1;
                  const isCompleted = i < 2;
                  const hasSession = i < 6;
                  return (
                    <div
                      key={i}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-colors ${
                        isToday ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                      }`}
                    >
                      <span className="text-muted-foreground">{day}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${
                        isCompleted ? 'bg-success' : hasSession ? 'bg-muted-foreground/30' : 'bg-transparent'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
