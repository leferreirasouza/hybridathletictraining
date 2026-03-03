import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Clock, MapPin, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { disciplineConfig } from '@/components/schedule/config';

const DISCIPLINE_COLORS: Record<string, string> = {
  run: 'hsl(217, 91%, 60%)',
  bike: 'hsl(160, 84%, 39%)',
  rowing: 'hsl(188, 78%, 41%)',
  skierg: 'hsl(199, 89%, 48%)',
  strength: 'hsl(38, 92%, 50%)',
  hyrox_station: 'hsl(15, 100%, 55%)',
  mobility: 'hsl(271, 91%, 65%)',
  prehab: 'hsl(168, 76%, 42%)',
  accessories: 'hsl(215, 16%, 47%)',
  stairs: 'hsl(48, 96%, 53%)',
  custom: 'hsl(220, 9%, 46%)',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Analytics() {
  const { user } = useAuth();

  const { data: completedSessions, isLoading } = useQuery({
    queryKey: ['analytics-completed', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('date, discipline, actual_duration_min, actual_distance_km, rpe')
        .eq('athlete_id', user.id)
        .order('date', { ascending: true });
      return error ? [] : data || [];
    },
    enabled: !!user,
  });

  // Group sessions by ISO week
  const { weeklyData, disciplineBreakdown, totals } = useMemo(() => {
    if (!completedSessions?.length) return { weeklyData: [], disciplineBreakdown: [], totals: { sessions: 0, duration: 0, distance: 0, avgRpe: 0 } };

    const weekMap = new Map<string, { week: string; duration: number; distance: number; sessions: number; rpeSum: number; rpeCount: number }>();
    const discMap = new Map<string, { discipline: string; duration: number; distance: number; sessions: number }>();
    let totalDuration = 0, totalDistance = 0, totalRpe = 0, rpeCount = 0;

    for (const s of completedSessions) {
      const d = new Date(s.date);
      // Get ISO week label (e.g. "W12")
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      const weekKey = `W${weekNum}`;

      const dur = Number(s.actual_duration_min) || 0;
      const dist = Number(s.actual_distance_km) || 0;

      // Weekly
      const existing = weekMap.get(weekKey) || { week: weekKey, duration: 0, distance: 0, sessions: 0, rpeSum: 0, rpeCount: 0 };
      existing.duration += dur;
      existing.distance += dist;
      existing.sessions += 1;
      if (s.rpe) { existing.rpeSum += s.rpe; existing.rpeCount += 1; }
      weekMap.set(weekKey, existing);

      // Discipline
      const disc = discMap.get(s.discipline) || { discipline: s.discipline, duration: 0, distance: 0, sessions: 0 };
      disc.duration += dur;
      disc.distance += dist;
      disc.sessions += 1;
      discMap.set(s.discipline, disc);

      totalDuration += dur;
      totalDistance += dist;
      if (s.rpe) { totalRpe += s.rpe; rpeCount += 1; }
    }

    return {
      weeklyData: Array.from(weekMap.values()),
      disciplineBreakdown: Array.from(discMap.values()).sort((a, b) => b.duration - a.duration),
      totals: {
        sessions: completedSessions.length,
        duration: totalDuration,
        distance: totalDistance,
        avgRpe: rpeCount > 0 ? totalRpe / rpeCount : 0,
      },
    };
  }, [completedSessions]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={item}>
          <h1 className="text-xl font-display font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your training volume overview</p>
        </motion.div>

        {/* Summary cards */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Sessions', value: totals.sessions, icon: TrendingUp },
            { label: 'Total Duration', value: `${Math.round(totals.duration)} min`, icon: Clock },
            { label: 'Total Distance', value: `${totals.distance.toFixed(1)} km`, icon: MapPin },
            { label: 'Avg RPE', value: totals.avgRpe > 0 ? totals.avgRpe.toFixed(1) : '—', icon: Flame },
          ].map(stat => (
            <Card key={stat.label} className="glass">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-display font-bold leading-tight">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Weekly Duration Chart */}
        {weeklyData.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Weekly Duration (min)</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(15, 100%, 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(15, 100%, 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="duration" stroke="hsl(15, 100%, 55%)" fill="url(#durationGrad)" strokeWidth={2} name="Duration (min)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Weekly Distance Chart */}
        {weeklyData.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Weekly Distance (km)</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="distance" fill="hsl(200, 90%, 48%)" radius={[4, 4, 0, 0]} name="Distance (km)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Discipline Breakdown */}
        {disciplineBreakdown.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Volume by Discipline</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ResponsiveContainer width="100%" height={Math.max(120, disciplineBreakdown.length * 36)}>
                  <BarChart data={disciplineBreakdown} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis
                      type="category"
                      dataKey="discipline"
                      tick={{ fontSize: 10 }}
                      className="fill-muted-foreground"
                      width={70}
                      tickFormatter={(v: string) => disciplineConfig[v]?.label || v}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v: string) => disciplineConfig[v]?.label || v}
                    />
                    <Bar
                      dataKey="duration"
                      name="Duration (min)"
                      radius={[0, 4, 4, 0]}
                      fill="hsl(15, 100%, 55%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {completedSessions?.length === 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardContent className="p-8 text-center space-y-2">
                <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-display font-bold">No Data Yet</p>
                <p className="text-sm text-muted-foreground">Log completed sessions to see your training analytics here.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
