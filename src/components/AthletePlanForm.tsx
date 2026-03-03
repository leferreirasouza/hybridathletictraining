import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Sparkles, Trophy, CalendarIcon, MapPin, Flag, AlertTriangle, Timer, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInWeeks, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const hyroxStations = [
  'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps',
  'Row', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls',
];

const experienceLevels = [
  { value: 'beginner', label: 'Beginner', desc: 'First race or <6 months training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 races completed' },
  { value: 'advanced', label: 'Advanced', desc: '3+ races, competitive times' },
];

const focusOptions = [
  { value: 'balanced', label: 'Balanced', desc: 'Running + Stations equally' },
  { value: 'running', label: 'Running Focus', desc: 'Prioritize running speed/endurance' },
  { value: 'stations', label: 'Stations Focus', desc: 'Prioritize station performance' },
];

const runningDistances = [
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half', label: 'Half Marathon' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'other', label: 'Other' },
];

// Average HYROX times by age group (in seconds) for first-timers reference
const HYROX_AGE_GROUP_AVERAGES: Record<string, { total: number; runPerKm: number; label: string }> = {
  '16-24': { total: 5700, runPerKm: 330, label: '16-24' },
  '25-29': { total: 5400, runPerKm: 315, label: '25-29' },
  '30-34': { total: 5400, runPerKm: 315, label: '30-34' },
  '35-39': { total: 5700, runPerKm: 330, label: '35-39' },
  '40-44': { total: 6000, runPerKm: 345, label: '40-44' },
  '45-49': { total: 6300, runPerKm: 360, label: '45-49' },
  '50-54': { total: 6600, runPerKm: 375, label: '50-54' },
  '55-59': { total: 7200, runPerKm: 400, label: '55-59' },
  '60+': { total: 7800, runPerKm: 420, label: '60+' },
};

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseTimeToSeconds(time: string): number | null {
  const parts = time.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export default function AthletePlanForm() {
  const { user, currentOrg } = useAuth();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  // Race type
  const [raceType, setRaceType] = useState<'hyrox' | 'running'>('hyrox');

  // Common fields
  const [experience, setExperience] = useState('beginner');
  const [trainingDays, setTrainingDays] = useState('4');
  const [easyPace, setEasyPace] = useState('');
  const [racePace, setRacePace] = useState('');
  const [nextRaceDate, setNextRaceDate] = useState<Date | undefined>();
  const [nextRaceName, setNextRaceName] = useState('');
  const [nextRaceLocation, setNextRaceLocation] = useState('');
  const [planWeeks, setPlanWeeks] = useState('8');
  const [planFocus, setPlanFocus] = useState('balanced');
  const [weakStations, setWeakStations] = useState<string[]>([]);
  const [injuries, setInjuries] = useState('');
  const [goals, setGoals] = useState('');

  // Running-specific
  const [runDistance, setRunDistance] = useState('10k');
  const [targetTime, setTargetTime] = useState('');

  // HYROX-specific
  const [totalTarget, setTotalTarget] = useState('');
  const [runKmTarget, setRunKmTarget] = useState('');
  const [ageGroup, setAgeGroup] = useState('30-34');

  // Fetch race results
  const { data: raceResults } = useQuery({
    queryKey: ['race-results-for-plan', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('race_results' as any)
        .select('*')
        .eq('athlete_id', user.id)
        .order('race_date', { ascending: false });
      return error ? [] : (data as any[]) || [];
    },
    enabled: !!user,
  });

  // Fetch completed sessions for prediction context
  const { data: completedSessions } = useQuery({
    queryKey: ['completed-for-prediction', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('date, discipline, actual_duration_min, actual_distance_km, rpe, avg_hr, max_hr, avg_pace')
        .eq('athlete_id', user.id)
        .order('date', { ascending: false })
        .limit(100);
      return error ? [] : data || [];
    },
    enabled: !!user,
  });

  const hasRaceHistory = raceResults && raceResults.length > 0;

  // Analyze prior HYROX races to auto-detect weak stations
  const raceAnalysis = useMemo(() => {
    if (!hasRaceHistory || raceType !== 'hyrox') return null;

    const latestRace = raceResults[0];
    const stationTimes: { name: string; seconds: number }[] = [];
    const runTimes: { name: string; seconds: number }[] = [];

    for (let i = 0; i < 8; i++) {
      const stationSec = latestRace[`station_${i + 1}_seconds`];
      const runSec = latestRace[`run_${i + 1}_seconds`];
      if (stationSec) stationTimes.push({ name: hyroxStations[i], seconds: stationSec });
      if (runSec) runTimes.push({ name: `Run ${i + 1}`, seconds: runSec });
    }

    // Find above-average stations (weak ones)
    const avgStation = stationTimes.length > 0 ? stationTimes.reduce((s, t) => s + t.seconds, 0) / stationTimes.length : 0;
    const belowAvg = stationTimes.filter(s => s.seconds > avgStation * 1.1).map(s => s.name);
    const avgRun = runTimes.length > 0 ? runTimes.reduce((s, t) => s + t.seconds, 0) / runTimes.length : 0;

    return {
      totalTime: latestRace.total_time_seconds,
      avgStationTime: avgStation,
      avgRunTime: avgRun,
      weakStations: belowAvg,
      stationTimes,
      runTimes,
    };
  }, [raceResults, raceType, hasRaceHistory]);

  // Auto-suggest weak stations from race data
  const suggestedWeakStations = raceAnalysis?.weakStations || [];

  // Age-group reference for first-time HYROX athletes
  const ageGroupRef = HYROX_AGE_GROUP_AVERAGES[ageGroup];

  const toggleStation = (station: string) => {
    setWeakStations(prev =>
      prev.includes(station) ? prev.filter(s => s !== station) : [...prev, station]
    );
  };

  const handleRequestPrediction = async () => {
    if (!user || !currentOrg) return;
    setLoadingPrediction(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          organizationId: currentOrg.id,
          predictionOnly: true,
          profile: {
            raceType,
            experience,
            trainingDays: parseInt(trainingDays),
            easyPace: easyPace || undefined,
            racePace: racePace || undefined,
            raceDate: nextRaceDate ? format(nextRaceDate, 'yyyy-MM-dd') : undefined,
            runDistance: raceType === 'running' ? runDistance : undefined,
            targetTime: raceType === 'running' && targetTime ? targetTime : undefined,
            totalTarget: raceType === 'hyrox' && totalTarget ? totalTarget : undefined,
            runKmTarget: raceType === 'hyrox' && runKmTarget ? runKmTarget : undefined,
            ageGroup,
            injuries: injuries.trim() || undefined,
            raceResults: hasRaceHistory ? raceResults : undefined,
            trainingHistory: completedSessions || [],
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPrediction(data.prediction);
    } catch (e: any) {
      toast.error(e.message || 'Failed to get prediction');
    } finally {
      setLoadingPrediction(false);
    }
  };

  const handleGenerate = async () => {
    if (!user || !currentOrg) { toast.error('Not logged in'); return; }
    if (!trainingDays || parseInt(trainingDays) < 2 || parseInt(trainingDays) > 7) {
      toast.error('Training days must be between 2 and 7');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          organizationId: currentOrg.id,
          profile: {
            raceType,
            experience,
            trainingDays: parseInt(trainingDays),
            easyPace: easyPace || undefined,
            racePace: racePace || undefined,
            raceDate: nextRaceDate ? format(nextRaceDate, 'yyyy-MM-dd') : undefined,
            raceName: nextRaceName.trim() || undefined,
            raceLocation: nextRaceLocation.trim() || undefined,
            planWeeks: parseInt(planWeeks) || 8,
            planFocus,
            weakStations: weakStations.length > 0 ? weakStations : undefined,
            injuries: injuries.trim() || undefined,
            goals: goals.trim() || undefined,
            raceResults: hasRaceHistory ? raceResults : undefined,
            // Running-specific
            runDistance: raceType === 'running' ? runDistance : undefined,
            targetTime: raceType === 'running' && targetTime ? targetTime : undefined,
            // HYROX-specific
            totalTarget: raceType === 'hyrox' && totalTarget ? totalTarget : undefined,
            runKmTarget: raceType === 'hyrox' && runKmTarget ? runKmTarget : undefined,
            ageGroup,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Plan "${data.planName}" created with ${data.sessionsCreated} sessions!`);
      navigate('/schedule');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Race Type Selector */}
      <Card className="glass overflow-hidden">
        <div className="h-1 gradient-hyrox" />
        <CardContent className="p-4 space-y-3">
          <Label className="font-display font-bold text-sm">What are you training for?</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRaceType('hyrox')}
              className={cn(
                'p-4 rounded-lg border text-left transition-all',
                raceType === 'hyrox' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:border-primary/50'
              )}
            >
              <div className="text-lg mb-1">🏋️</div>
              <p className="text-sm font-bold">HYROX Race</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">8 runs + 8 stations</p>
            </button>
            <button
              type="button"
              onClick={() => setRaceType('running')}
              className={cn(
                'p-4 rounded-lg border text-left transition-all',
                raceType === 'running' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:border-primary/50'
              )}
            >
              <div className="text-lg mb-1">🏃</div>
              <p className="text-sm font-bold">Running Race</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">5K, 10K, Half, Marathon</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Race Results Banner */}
      {hasRaceHistory && (
        <Card className="glass border-success/20 overflow-hidden">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium">
                {raceResults.length} race result{raceResults.length > 1 ? 's' : ''} will be used
              </p>
              <p className="text-[10px] text-muted-foreground">
                AI will analyze your splits to tailor the plan
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/races')}>
              View
            </Button>
          </CardContent>
        </Card>
      )}

      {!hasRaceHistory && (
        <Card className="glass border-primary/20 overflow-hidden">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium">Add race results for a better plan</p>
              <p className="text-[10px] text-muted-foreground">
                Upload ROX Fit screenshots or enter splits manually
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/races')}>
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      {/* HYROX: Race analysis from prior races or age-group defaults */}
      {raceType === 'hyrox' && (
        <>
          {raceAnalysis && (
            <Card className="glass border-accent/20 overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <Label className="font-display font-bold text-sm">Race Analysis</Label>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Last Total</p>
                    <p className="text-sm font-mono font-bold">{fmtTime(raceAnalysis.totalTime || 0)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Avg Run</p>
                    <p className="text-sm font-mono font-bold">{fmtTime(Math.round(raceAnalysis.avgRunTime))}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Avg Station</p>
                    <p className="text-sm font-mono font-bold">{fmtTime(Math.round(raceAnalysis.avgStationTime))}</p>
                  </div>
                </div>
                {suggestedWeakStations.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-warning" />
                      Below-average stations (auto-detected):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedWeakStations.map(s => (
                        <Badge key={s} variant="destructive" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 mt-1"
                      onClick={() => setWeakStations(prev => [...new Set([...prev, ...suggestedWeakStations])])}
                    >
                      Add to weak stations
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!hasRaceHistory && (
            <Card className="glass border-muted overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <Label className="font-display font-bold text-sm">First Race? Age Group Reference</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Since you have no prior races, we'll use age-group averages as starting targets.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Your Age Group</Label>
                  <Select value={ageGroup} onValueChange={setAgeGroup}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(HYROX_AGE_GROUP_AVERAGES).map(([key, v]) => (
                        <SelectItem key={key} value={key}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {ageGroupRef && (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-primary/5 rounded-lg p-2 border border-primary/10">
                      <p className="text-[10px] text-muted-foreground">Avg Total Time</p>
                      <p className="text-sm font-mono font-bold text-primary">{fmtTime(ageGroupRef.total)}</p>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-2 border border-primary/10">
                      <p className="text-[10px] text-muted-foreground">Avg Run Pace</p>
                      <p className="text-sm font-mono font-bold text-primary">{fmtTime(ageGroupRef.runPerKm)}/km</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card className="glass overflow-hidden">
        <div className="h-1 gradient-hyrox" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Your Athlete Profile
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Tell us about yourself and we'll generate a tailored plan.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Experience */}
          <div className="space-y-2">
            <Label>Experience Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {experienceLevels.map(lvl => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setExperience(lvl.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    experience === lvl.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-xs font-medium">{lvl.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{lvl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Plan Focus - only for HYROX */}
          {raceType === 'hyrox' && (
            <div className="space-y-2">
              <Label>Plan Focus</Label>
              <div className="grid grid-cols-3 gap-2">
                {focusOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlanFocus(opt.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      planFocus === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="text-xs font-medium">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Training Availability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Training Days/Week</Label>
              <Select value={trainingDays} onValueChange={setTrainingDays}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan Duration</Label>
              <Select value={planWeeks} onValueChange={setPlanWeeks}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 6, 8, 10, 12, 16].map(w => (
                    <SelectItem key={w} value={String(w)}>{w} weeks</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Paces */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Easy Pace (min/km)</Label>
              <Input value={easyPace} onChange={e => setEasyPace(e.target.value)} placeholder="6:00" className="h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Race Pace (min/km)</Label>
              <Input value={racePace} onChange={e => setRacePace(e.target.value)} placeholder="5:00" className="h-9" />
            </div>
          </div>

          {/* Running race-specific targets */}
          {raceType === 'running' && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <Label className="font-display font-bold text-sm">Race Target</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Distance</Label>
                    <Select value={runDistance} onValueChange={setRunDistance}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {runningDistances.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Target Time (h:mm:ss or mm:ss)</Label>
                    <Input
                      value={targetTime}
                      onChange={e => setTargetTime(e.target.value)}
                      placeholder="e.g. 50:00 or 1:45:00"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Leave target blank to get an AI prediction based on your training data
                </p>
              </CardContent>
            </Card>
          )}

          {/* HYROX-specific targets */}
          {raceType === 'hyrox' && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <Label className="font-display font-bold text-sm">HYROX Targets</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Race Target (h:mm:ss)</Label>
                    <Input
                      value={totalTarget}
                      onChange={e => setTotalTarget(e.target.value)}
                      placeholder={hasRaceHistory ? 'Improve on last race' : ageGroupRef ? fmtTime(ageGroupRef.total) : '1:30:00'}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Run Splits Target (min/km)</Label>
                    <Input
                      value={runKmTarget}
                      onChange={e => setRunKmTarget(e.target.value)}
                      placeholder={hasRaceHistory && raceAnalysis ? fmtTime(Math.round(raceAnalysis.avgRunTime / 60)) : ageGroupRef ? fmtTime(ageGroupRef.runPerKm) : '5:30'}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                {!hasRaceHistory && (
                  <p className="text-[10px] text-muted-foreground">
                    Defaults based on {ageGroupRef?.label} age group averages. Adjust to your fitness level.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Next Race */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <Label className="font-display font-bold text-sm">Next Race</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Race Name</Label>
                  <Input
                    value={nextRaceName}
                    onChange={e => setNextRaceName(e.target.value)}
                    placeholder={raceType === 'hyrox' ? 'HYROX Munich' : 'City Marathon'}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</Label>
                  <Input
                    value={nextRaceLocation}
                    onChange={e => setNextRaceLocation(e.target.value)}
                    placeholder="Munich, DE"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Race Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !nextRaceDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {nextRaceDate ? format(nextRaceDate, 'PPP') : 'Pick your race date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextRaceDate}
                      onSelect={(date) => {
                        setNextRaceDate(date);
                        if (date) {
                          const weeks = differenceInWeeks(date, new Date());
                          if (weeks >= 4 && weeks <= 16) {
                            const closest = [4, 6, 8, 10, 12, 16].reduce((prev, curr) =>
                              Math.abs(curr - weeks) < Math.abs(prev - weeks) ? curr : prev
                            );
                            setPlanWeeks(String(closest));
                          }
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {nextRaceDate && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                    {differenceInDays(nextRaceDate, new Date())} days away
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                    ~{differenceInWeeks(nextRaceDate, new Date())} weeks → {planWeeks}w plan
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weak Stations - only for HYROX */}
          {raceType === 'hyrox' && (
            <div className="space-y-2">
              <Label>Weakest Stations (select any)</Label>
              <div className="flex flex-wrap gap-2">
                {hyroxStations.map(station => (
                  <Badge
                    key={station}
                    variant={weakStations.includes(station) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${
                      weakStations.includes(station)
                        ? 'gradient-hyrox text-primary-foreground border-0'
                        : suggestedWeakStations.includes(station)
                          ? 'border-destructive/50 text-destructive hover:bg-destructive/10'
                          : 'hover:border-primary/50'
                    }`}
                    onClick={() => toggleStation(station)}
                  >
                    {station}
                    {suggestedWeakStations.includes(station) && !weakStations.includes(station) && ' ⚠'}
                  </Badge>
                ))}
              </div>
              {suggestedWeakStations.length > 0 && (
                <p className="text-[10px] text-muted-foreground">⚠ = detected as below average from your race data</p>
              )}
            </div>
          )}

          {/* Injuries */}
          <div className="space-y-2">
            <Label>Injuries / Limitations (optional)</Label>
            <Textarea
              value={injuries}
              onChange={e => setInjuries(e.target.value)}
              placeholder="e.g. Knee pain when lunging, tight hip flexors…"
              rows={2}
              className="text-sm"
              maxLength={500}
            />
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label>Additional Goals (optional)</Label>
            <Textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              placeholder={raceType === 'hyrox' ? 'e.g. Sub 1:20 HYROX time, improve wall balls…' : 'e.g. Sub 50min 10K, build endurance…'}
              rows={2}
              className="text-sm"
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      {/* Race Prediction */}
      <Card className="glass border-accent/20 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <Label className="font-display font-bold text-sm">
                {raceType === 'running' ? 'Race Prediction' : 'Performance Assessment'}
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={handleRequestPrediction}
              disabled={loadingPrediction}
            >
              {loadingPrediction ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
              {loadingPrediction ? 'Analyzing…' : 'Get Prediction'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {raceType === 'running'
              ? 'AI will analyze your training data to predict your finish time and evaluate if your target is realistic and safe.'
              : 'AI will assess your target, identify weak areas, and check for injury risk based on your training load.'}
          </p>
          {prediction && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pt-2 border-t border-border/50">
              {prediction.predictedTime && (
                <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-3 border border-primary/10">
                  <Timer className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Predicted Finish: <span className="font-mono font-bold text-primary">{prediction.predictedTime}</span></p>
                    {prediction.confidence && <p className="text-[10px] text-muted-foreground">Confidence: {prediction.confidence}</p>}
                  </div>
                </div>
              )}
              {prediction.targetFeedback && (
                <div className={cn(
                  'flex items-start gap-2 rounded-lg p-3 border',
                  prediction.riskLevel === 'high' ? 'bg-destructive/5 border-destructive/20' :
                  prediction.riskLevel === 'moderate' ? 'bg-warning/5 border-warning/20' :
                  'bg-success/5 border-success/20'
                )}>
                  <AlertTriangle className={cn(
                    'h-4 w-4 shrink-0 mt-0.5',
                    prediction.riskLevel === 'high' ? 'text-destructive' :
                    prediction.riskLevel === 'moderate' ? 'text-warning' :
                    'text-success'
                  )} />
                  <div>
                    <p className="text-xs font-medium">{prediction.targetFeedback}</p>
                    {prediction.injuryRisk && (
                      <p className="text-[10px] text-muted-foreground mt-1">{prediction.injuryRisk}</p>
                    )}
                  </div>
                </div>
              )}
              {prediction.recommendations && prediction.recommendations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recommendations</p>
                  {prediction.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full gradient-hyrox"
        size="lg"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating your plan…</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-2" /> Generate My {raceType === 'hyrox' ? 'HYROX' : 'Running'} Plan</>
        )}
      </Button>

      {generating && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          AI is building your personalized plan. This may take 15-30 seconds…
        </p>
      )}
    </motion.div>
  );
}
