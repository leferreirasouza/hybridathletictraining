import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Footprints, Bike, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

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

type Granularity = 'monthly' | 'yearly';

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getYearKey(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

export default function MileageHistory() {
  const { user } = useAuth();
  const [granularity, setGranularity] = useState<Granularity>('monthly');

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['mileage-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('date, discipline, actual_distance_km')
        .eq('athlete_id', user.id)
        .order('date', { ascending: true });
      return error ? [] : data || [];
    },
    enabled: !!user,
  });

  const { chartData, totalRun, totalBike, allTimeData } = useMemo(() => {
    if (!sessions?.length) return { chartData: [], totalRun: 0, totalBike: 0, allTimeData: [] };

    const bucketMap = new Map<string, { key: string; run: number; bike: number }>();
    let totalRun = 0;
    let totalBike = 0;

    for (const s of sessions) {
      const dist = Number(s.actual_distance_km) || 0;
      if (dist === 0) continue;

      const key = granularity === 'monthly' ? getMonthKey(s.date) : getYearKey(s.date);
      const bucket = bucketMap.get(key) || { key, run: 0, bike: 0 };

      if (s.discipline === 'run') {
        bucket.run += dist;
        totalRun += dist;
      } else if (s.discipline === 'bike') {
        bucket.bike += dist;
        totalBike += dist;
      }

      bucketMap.set(key, bucket);
    }

    const chartData = Array.from(bucketMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => ({
        label: granularity === 'monthly' ? getMonthLabel(b.key) : b.key,
        run: Math.round(b.run * 10) / 10,
        bike: Math.round(b.bike * 10) / 10,
      }));

    // Cumulative all-time running data
    let cumRun = 0;
    let cumBike = 0;
    const allTimeData = Array.from(bucketMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => {
        cumRun += b.run;
        cumBike += b.bike;
        return {
          label: granularity === 'monthly' ? getMonthLabel(b.key) : b.key,
          cumRun: Math.round(cumRun * 10) / 10,
          cumBike: Math.round(cumBike * 10) / 10,
        };
      });

    return { chartData, totalRun, totalBike, allTimeData };
  }, [sessions, granularity]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-container py-6">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">Mileage History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track your running &amp; cycling distance over time</p>
          </div>
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <TabsList className="h-8">
              <TabsTrigger value="monthly" className="text-xs px-3 h-6">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs px-3 h-6">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Summary Cards */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          <Card className="glass">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Footprints className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-display font-bold leading-tight">{totalRun.toFixed(1)} km</p>
                <p className="text-[10px] text-muted-foreground">Total Running</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Bike className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-display font-bold leading-tight">{totalBike.toFixed(1)} km</p>
                <p className="text-[10px] text-muted-foreground">Total Cycling</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Period Breakdown Chart */}
        {chartData.length > 0 ? (
          <>
            <motion.div variants={item}>
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {granularity === 'monthly' ? 'Monthly' : 'Yearly'} Distance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(v: number, name: string) => [`${v} km`, name === 'run' ? 'Running' : 'Cycling']}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => v === 'run' ? 'Running' : 'Cycling'} />
                      <Bar dataKey="run" name="run" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bike" name="bike" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Cumulative Chart */}
            <motion.div variants={item}>
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    Cumulative Distance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={allTimeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(v: number, name: string) => [`${v} km`, name === 'cumRun' ? 'Running (cum.)' : 'Cycling (cum.)']}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => v === 'cumRun' ? 'Running (cumulative)' : 'Cycling (cumulative)'} />
                      <Bar dataKey="cumRun" name="cumRun" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} fillOpacity={0.5} />
                      <Bar dataKey="cumBike" name="cumBike" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} fillOpacity={0.5} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Detail Table */}
            <motion.div variants={item}>
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 text-[10px] text-muted-foreground font-medium px-2 pb-1 border-b border-border">
                      <span>Period</span>
                      <span className="text-right">Run (km)</span>
                      <span className="text-right">Bike (km)</span>
                    </div>
                    {[...chartData].reverse().map((row) => (
                      <div key={row.label} className="grid grid-cols-3 text-xs px-2 py-1.5 rounded hover:bg-muted/50">
                        <span className="font-medium">{row.label}</span>
                        <span className="text-right font-mono text-blue-500">{row.run}</span>
                        <span className="text-right font-mono text-emerald-500">{row.bike}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : (
          <motion.div variants={item}>
            <Card className="glass">
              <CardContent className="p-8 text-center space-y-3">
                <Footprints className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-display font-bold">No mileage data yet</p>
                <p className="text-sm text-muted-foreground">Log sessions with distance to start tracking your mileage history.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
