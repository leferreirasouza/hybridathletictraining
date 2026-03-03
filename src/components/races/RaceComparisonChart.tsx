import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart3, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { motion } from 'framer-motion';

const STATIONS = [
  'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee BJ',
  'Rowing', 'Farmers', 'SB Lunges', 'Wall Balls',
];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 80%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(40, 90%, 55%)',
];

function formatTime(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeFull(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function raceLabel(race: any): string {
  const date = new Date(race.race_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return race.race_name ? `${race.race_name} (${date})` : date;
}

function shortLabel(race: any): string {
  const date = new Date(race.race_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return race.race_location || date;
}

type ViewMode = 'splits' | 'radar' | 'total';

interface Props {
  races: any[];
}

export default function RaceComparisonChart({ races }: Props) {
  const [selected, setSelected] = useState<string[]>(() =>
    races.slice(0, Math.min(3, races.length)).map((r: any) => r.id)
  );
  const [view, setView] = useState<ViewMode>('splits');

  if (races.length < 2) return null;

  const toggleRace = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const selectedRaces = races
    .filter((r: any) => selected.includes(r.id))
    .sort((a: any, b: any) => new Date(a.race_date).getTime() - new Date(b.race_date).getTime());

  // Build bar chart data: each station shows run + station for each race
  const splitData = STATIONS.map((station, i) => {
    const entry: any = { station };
    selectedRaces.forEach((race: any, ri: number) => {
      entry[`run_${ri}`] = race[`run_${i + 1}_seconds`] || 0;
      entry[`stn_${ri}`] = race[`station_${i + 1}_seconds`] || 0;
    });
    return entry;
  });

  // Build radar data (normalized per split — lower is better)
  const radarData = STATIONS.map((station, i) => {
    const entry: any = { station };
    selectedRaces.forEach((race: any, ri: number) => {
      const runVal = race[`run_${i + 1}_seconds`] || 0;
      const stnVal = race[`station_${i + 1}_seconds`] || 0;
      entry[`race_${ri}`] = runVal + stnVal;
    });
    return entry;
  });

  // Total time trend data
  const totalData = selectedRaces.map((race: any) => ({
    name: shortLabel(race),
    total: race.total_time_seconds || 0,
    running: [1,2,3,4,5,6,7,8].reduce((s, n) => s + (race[`run_${n}_seconds`] || 0), 0),
    stations: [1,2,3,4,5,6,7,8].reduce((s, n) => s + (race[`station_${n}_seconds`] || 0), 0),
    transitions: race.total_transition_seconds || 0,
  }));

  // Improvement calculation
  const getImprovement = () => {
    if (selectedRaces.length < 2) return null;
    const first = selectedRaces[0];
    const last = selectedRaces[selectedRaces.length - 1];
    if (!first.total_time_seconds || !last.total_time_seconds) return null;
    const diff = first.total_time_seconds - last.total_time_seconds;
    return { diff, pct: ((diff / first.total_time_seconds) * 100).toFixed(1) };
  };
  const improvement = getImprovement();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-display font-bold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex justify-between gap-3">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono">{formatTime(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Race selector */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Race Comparison
            </CardTitle>
            {improvement && (
              <Badge
                variant="secondary"
                className={improvement.diff > 0 ? 'bg-emerald-500/10 text-emerald-500' : improvement.diff < 0 ? 'bg-destructive/10 text-destructive' : ''}
              >
                {improvement.diff > 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : improvement.diff < 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <Minus className="h-3 w-3 mr-1" />}
                {improvement.diff > 0 ? `-${formatTimeFull(improvement.diff)}` : `+${formatTimeFull(Math.abs(improvement.diff))}`} ({improvement.pct}%)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {races.map((race: any, i: number) => (
              <label
                key={race.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer text-xs border transition-colors ${
                  selected.includes(race.id)
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/50 opacity-60 hover:opacity-100'
                }`}
              >
                <Checkbox
                  checked={selected.includes(race.id)}
                  onCheckedChange={() => toggleRace(race.id)}
                  className="h-3 w-3"
                />
                <span className="font-medium">{raceLabel(race)}</span>
              </label>
            ))}
          </div>
          {selected.length < 2 && (
            <p className="text-[11px] text-muted-foreground">Select at least 2 races to compare</p>
          )}
        </CardContent>
      </Card>

      {selectedRaces.length >= 2 && (
        <>
          {/* View toggle */}
          <div className="flex gap-1">
            {([
              { key: 'splits', label: 'Splits' },
              { key: 'radar', label: 'Radar' },
              { key: 'total', label: 'Trend' },
            ] as { key: ViewMode; label: string }[]).map(v => (
              <Button
                key={v.key}
                variant={view === v.key ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs h-7 ${view === v.key ? 'gradient-hyrox' : ''}`}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </Button>
            ))}
          </div>

          {/* SPLITS BAR CHART */}
          {view === 'splits' && (
            <Card className="glass">
              <CardContent className="p-3">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={splitData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="station" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis
                      tickFormatter={(v: number) => `${Math.floor(v / 60)}m`}
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(value: string) => {
                        const idx = parseInt(value.split('_')[1]);
                        const type = value.startsWith('run') ? 'Run' : 'Stn';
                        return `${type} – ${shortLabel(selectedRaces[idx])}`;
                      }}
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                    {selectedRaces.map((_: any, ri: number) => (
                      <>
                        <Bar
                          key={`run_${ri}`}
                          dataKey={`run_${ri}`}
                          name={`run_${ri}`}
                          fill={CHART_COLORS[ri]}
                          opacity={0.6}
                          radius={[2, 2, 0, 0]}
                          stackId={`stack_${ri}`}
                        />
                        <Bar
                          key={`stn_${ri}`}
                          dataKey={`stn_${ri}`}
                          name={`stn_${ri}`}
                          fill={CHART_COLORS[ri]}
                          opacity={1}
                          radius={[2, 2, 0, 0]}
                          stackId={`stack_${ri}`}
                        />
                      </>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Lighter = Run · Darker = Station (stacked per race)
                </p>
              </CardContent>
            </Card>
          )}

          {/* RADAR CHART */}
          {view === 'radar' && (
            <Card className="glass">
              <CardContent className="p-3">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="station"
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <PolarRadiusAxis tick={{ fontSize: 8 }} />
                    {selectedRaces.map((_: any, ri: number) => (
                      <Radar
                        key={ri}
                        name={shortLabel(selectedRaces[ri])}
                        dataKey={`race_${ri}`}
                        stroke={CHART_COLORS[ri]}
                        fill={CHART_COLORS[ri]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Combined run + station time per segment (smaller = faster)
                </p>
              </CardContent>
            </Card>
          )}

          {/* TOTAL TIME TREND */}
          {view === 'total' && (
            <Card className="glass">
              <CardContent className="p-3">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={totalData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis
                      tickFormatter={(v: number) => `${Math.floor(v / 60)}m`}
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="running"
                      name="Running"
                      stroke="hsl(210, 80%, 55%)"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="stations"
                      name="Stations"
                      stroke="hsl(150, 60%, 45%)"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Total time progression across selected races
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}