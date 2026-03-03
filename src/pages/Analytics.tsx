import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Clock, MapPin, Flame, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, LineChart, Line, Legend,
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

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

function getISOWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `W${weekNum}`;
}

export default function Analytics() {
  const { user } = useAuth();
  const [volumeMetric, setVolumeMetric] = useState<'duration' | 'distance'>('duration');

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

  const { weeklyData, disciplineBreakdown, totals, rpeData, stackedDisciplineData, activeDisciplines } = useMemo(() => {
    if (!completedSessions?.length)
      return { weeklyData: [], disciplineBreakdown: [], totals: { sessions: 0, duration: 0, distance: 0, avgRpe: 0 }, rpeData: [], stackedDisciplineData: [], activeDisciplines: [] };

    const weekMap = new Map<string, { week: string; duration: number; distance: number; sessions: number; rpeSum: number; rpeCount: number }>();
    const discMap = new Map<string, { discipline: string; duration: number; distance: number; sessions: number }>();
    // For stacked discipline chart: week → { discipline: duration }
    const stackedMap = new Map<string, Record<string, string | number>>();
    const allDiscs = new Set<string>();
    let totalDuration = 0, totalDistance = 0, totalRpe = 0, rpeCount = 0;

    for (const s of completedSessions) {
      const weekKey = getISOWeekLabel(s.date);
      const dur = Number(s.actual_duration_min) || 0;
      const dist = Number(s.actual_distance_km) || 0;

      // Weekly volume
      const existing = weekMap.get(weekKey) || { week: weekKey, duration: 0, distance: 0, sessions: 0, rpeSum: 0, rpeCount: 0 };
      existing.duration += dur;
      existing.distance += dist;
      existing.sessions += 1;
      if (s.rpe) { existing.rpeSum += s.rpe; existing.rpeCount += 1; }
      weekMap.set(weekKey, existing);

      // Discipline totals
      const disc = discMap.get(s.discipline) || { discipline: s.discipline, duration: 0, distance: 0, sessions: 0 };
      disc.duration += dur;
      disc.distance += dist;
      disc.sessions += 1;
      discMap.set(s.discipline, disc);

      // Stacked discipline per week
      const stackRow = stackedMap.get(weekKey) || { week: weekKey };
      stackRow[s.discipline] = (stackRow[s.discipline] as number || 0) + dur;
      stackedMap.set(weekKey, stackRow);
      allDiscs.add(s.discipline);

      totalDuration += dur;
      totalDistance += dist;
      if (s.rpe) { totalRpe += s.rpe; rpeCount += 1; }
    }

    // RPE trend: avg RPE per week
    const rpeData = Array.from(weekMap.values())
      .filter(w => w.rpeCount > 0)
      .map(w => ({ week: w.week, avgRpe: Math.round((w.rpeSum / w.rpeCount) * 10) / 10, sessions: w.sessions }));

    return {
      weeklyData: Array.from(weekMap.values()),
      disciplineBreakdown: Array.from(discMap.values()).sort((a, b) => b.duration - a.duration),
      totals: {
        sessions: completedSessions.length,
        duration: totalDuration,
        distance: totalDistance,
        avgRpe: rpeCount > 0 ? totalRpe / rpeCount : 0,
      },
      rpeData,
      stackedDisciplineData: Array.from(stackedMap.values()),
      activeDisciplines: Array.from(allDiscs).sort(),
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
          <p className="text-sm text-muted-foreground mt-0.5">Your training volume &amp; intensity trends</p>
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

        {/* Weekly Volume Chart with toggle */}
        {weeklyData.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-display">Weekly Volume</CardTitle>
                <Tabs value={volumeMetric} onValueChange={(v) => setVolumeMetric(v as 'duration' | 'distance')}>
                  <TabsList className="h-7">
                    <TabsTrigger value="duration" className="text-[10px] px-2 h-5">Minutes</TabsTrigger>
                    <TabsTrigger value="distance" className="text-[10px] px-2 h-5">Distance</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="pb-3">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(15, 100%, 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(15, 100%, 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Area
                      type="monotone"
                      dataKey={volumeMetric}
                      stroke="hsl(15, 100%, 55%)"
                      fill="url(#volGrad)"
                      strokeWidth={2}
                      name={volumeMetric === 'duration' ? 'Duration (min)' : 'Distance (km)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* RPE Trend Chart */}
        {rpeData.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-destructive" />
                  RPE Trend (Weekly Avg)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={rpeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis domain={[1, 10]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [value, 'Avg RPE']}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgRpe"
                      stroke="hsl(0, 72%, 51%)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'hsl(0, 72%, 51%)' }}
                      activeDot={{ r: 5 }}
                      name="Avg RPE"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stacked Discipline Over Time */}
        {stackedDisciplineData.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Discipline Breakdown Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stackedDisciplineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string) => [
                        `${Math.round(value)} min`,
                        disciplineConfig[name]?.label || name,
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(value: string) => disciplineConfig[value]?.label || value}
                    />
                    {activeDisciplines.map(disc => (
                      <Bar
                        key={disc}
                        dataKey={disc}
                        stackId="disciplines"
                        fill={DISCIPLINE_COLORS[disc] || 'hsl(220, 10%, 50%)'}
                        radius={0}
                        name={disc}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Discipline Totals */}
        {disciplineBreakdown.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Total Volume by Discipline</CardTitle>
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
                      contentStyle={tooltipStyle}
                      labelFormatter={(v: string) => disciplineConfig[v]?.label || v}
                    />
                    <Bar
                      dataKey="duration"
                      name="Duration (min)"
                      radius={[0, 4, 4, 0]}
                    >
                      {disciplineBreakdown.map((entry) => (
                        <rect key={entry.discipline} fill={DISCIPLINE_COLORS[entry.discipline] || 'hsl(15, 100%, 55%)'} />
                      ))}
                    </Bar>
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
