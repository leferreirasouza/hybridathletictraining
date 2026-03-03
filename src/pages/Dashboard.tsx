import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Dumbbell, Clock, Target, TrendingUp, ChevronRight, Flag, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, differenceInWeeks, format } from 'date-fns';
import { useScheduleData } from '@/hooks/useScheduleData';
import { getDiscipline } from '@/components/schedule/config';

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

  const { sessions: plannedSessions, completedSessions: completedPlanned } = useScheduleData();

  // Today's planned sessions
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon..7=Sun

  const completedPlanIds = new Set(completedPlanned.filter(c => c.planned_session_id).map(c => c.planned_session_id));

  const todaySessions = plannedSessions.filter(s => {
    // Match by explicit date or day_of_week
    if (s.date === todayStr) return true;
    if (!s.date && s.day_of_week === todayDow) return true;
    return false;
  });

  // Fetch completed sessions this week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  const weekStart = startOfWeek.toISOString().split('T')[0];

  const { data: completedSessions } = useQuery({
    queryKey: ['completed-sessions-week', user?.id, weekStart],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('athlete_id', user.id)
        .gte('date', weekStart)
        .order('date', { ascending: true });
      return error ? [] : data || [];
    },
    enabled: !!user,
  });

  // Fetch next upcoming race
  const { data: nextRace } = useQuery({
    queryKey: ['next-race', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('race_results')
        .select('race_date, race_name, race_location')
        .eq('athlete_id', user.id)
        .gte('race_date', todayStr)
        .order('race_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!user,
  });

  const totalKm = completedSessions?.reduce((sum, s) => sum + (Number(s.actual_distance_km) || 0), 0) || 0;
  const avgRpe = completedSessions?.length
    ? (completedSessions.reduce((sum, s) => sum + (s.rpe || 0), 0) / completedSessions.length).toFixed(1)
    : '—';
  const sessionCount = completedSessions?.length || 0;

  const raceDateObj = nextRace?.race_date ? new Date(nextRace.race_date + 'T00:00:00') : null;
  const daysUntilRace = raceDateObj ? differenceInDays(raceDateObj, new Date()) : null;
  const weeksUntilRace = raceDateObj ? differenceInWeeks(raceDateObj, new Date()) : null;

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

        {/* Race Countdown */}
        {raceDateObj && daysUntilRace !== null && daysUntilRace >= 0 && (
          <motion.div variants={item}>
            <Card className="glass overflow-hidden border-primary/20">
              <div className="h-1 gradient-hyrox" />
              <CardContent className="p-4 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(1, (daysUntilRace || 0) / 120))}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-display font-bold leading-none">{daysUntilRace}</span>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider">days</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-sm font-display font-bold truncate">
                      {nextRace?.race_name || 'Next Race'}
                    </p>
                  </div>
                  {nextRace?.race_location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {nextRace.race_location}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(raceDateObj, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <Badge variant="secondary" className="mt-1.5 text-[10px] bg-primary/10 text-primary border-0">
                    {weeksUntilRace} weeks to go
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Today's Sessions — actual plan data */}
        <motion.div variants={item}>
          <Card className="glass overflow-hidden border-primary/20">
            <div className="h-1 gradient-hyrox" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-display">Today's Training</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {todaySessions.length > 0
                      ? `${todaySessions.length} session${todaySessions.length > 1 ? 's' : ''} planned`
                      : 'Rest day — no sessions planned'}
                  </p>
                </div>
                {todaySessions.length > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaySessions.length > 0 ? (
                <>
                  {todaySessions.map(session => {
                    const disc = getDiscipline(session.discipline);
                    const DiscIcon = disc.icon;
                    const isDone = completedPlanIds.has(session.id);
                    return (
                      <div key={session.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isDone ? 'bg-success/5 border-success/20' : 'bg-muted/30 border-border/50'}`}>
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${disc.color}`}>
                          <DiscIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{session.session_name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{disc.label}</span>
                            {session.duration_min && <span>· {session.duration_min} min</span>}
                            {session.intensity && <span>· {session.intensity.replace('_', ' ')}</span>}
                          </div>
                        </div>
                        {isDone ? (
                          <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0 shrink-0">Done</Badge>
                        ) : (
                          <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={() => navigate('/log')}>
                            Log
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex gap-2">
                    <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/schedule')}>
                      <Calendar className="h-4 w-4 mr-2" /> View Schedule
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => navigate('/log')}>
                      <Dumbbell className="h-4 w-4 mr-2" /> Log Session
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/schedule')}>
                    <Calendar className="h-4 w-4 mr-2" /> View Schedule
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate('/log')}>
                    <Dumbbell className="h-4 w-4 mr-2" /> Log Session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3">
          {[
            { label: 'Week Volume', value: `${totalKm.toFixed(1)} km`, icon: TrendingUp },
            { label: 'Sessions', value: `${sessionCount}`, icon: Calendar },
            { label: 'Avg RPE', value: avgRpe, icon: Target },
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
                  const isToday = i === ((new Date().getDay() + 6) % 7);
                  const dayDate = new Date(startOfWeek);
                  dayDate.setDate(dayDate.getDate() + i);
                  const dateStr = dayDate.toISOString().split('T')[0];
                  const hasCompleted = completedSessions?.some(s => s.date === dateStr);

                  return (
                    <div
                      key={i}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-colors ${
                        isToday ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                      }`}
                    >
                      <span className="text-muted-foreground">{day}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${
                        hasCompleted ? 'bg-success' : 'bg-muted-foreground/20'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly Report CTA */}
        <motion.div variants={item}>
          <Card className="glass border-accent/20 overflow-hidden cursor-pointer hover:border-accent/40 transition-colors" onClick={() => navigate('/reports')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-display font-bold">Weekly Report</p>
                <p className="text-xs text-muted-foreground">Review your training stats and AI coaching insights</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Coach CTA */}
        <motion.div variants={item}>
          <Card className="glass border-accent/20 overflow-hidden cursor-pointer hover:border-accent/40 transition-colors" onClick={() => navigate('/ai')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🤖</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-display font-bold">AI Coach</p>
                <p className="text-xs text-muted-foreground">Get personalized training advice and session adjustments</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
