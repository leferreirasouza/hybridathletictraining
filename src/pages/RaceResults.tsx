import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Upload, Plus, Trophy, Clock, TrendingUp, Loader2, Camera, Trash2, ChevronDown, ChevronUp, X, ImagePlus, Images, Check } from 'lucide-react';
import RaceComparisonChart from '@/components/races/RaceComparisonChart';
import { useTranslation } from 'react-i18next';

const STATIONS = [
  'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps',
  'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls',
];

const CATEGORIES = [
  { value: 'open', label: 'Open' },
  { value: 'pro', label: 'Pro' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'relay', label: 'Relay' },
];

function formatTime(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseTimeToSeconds(input: string): number | null {
  if (!input.trim()) return null;
  const parts = input.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function RaceResults() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: races, isLoading } = useQuery({
    queryKey: ['race-results', user?.id],
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

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">{t('raceResults.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('raceResults.racesRecorded', { count: races?.length || 0 })}</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-hyrox" size="sm">
              <Plus className="h-4 w-4 mr-1" /> {t('raceResults.addRace')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{t('raceResults.addRaceResult')}</DialogTitle>
            </DialogHeader>
            <AddRaceForm
              onSuccess={() => {
                setAddDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['race-results'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !races?.length ? (
        <Card className="glass border-primary/20 overflow-hidden">
          <div className="h-1 gradient-hyrox" />
          <CardContent className="p-8 text-center space-y-3">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">{t('raceResults.noRaces')}</p>
            <p className="text-sm text-muted-foreground">{t('raceResults.noRacesDesc')}</p>
            <Button className="gradient-hyrox" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> {t('raceResults.addFirstRace')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          <RaceComparisonChart races={races} />
          {races.map((race: any) => (
            <RaceCard key={race.id} race={race} onDelete={() => queryClient.invalidateQueries({ queryKey: ['race-results'] })} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function RaceCard({ race, onDelete }: { race: any; onDelete: () => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();

  const runSplits = [race.run_1_seconds, race.run_2_seconds, race.run_3_seconds, race.run_4_seconds, race.run_5_seconds, race.run_6_seconds, race.run_7_seconds, race.run_8_seconds];
  const stationSplits = [race.station_1_seconds, race.station_2_seconds, race.station_3_seconds, race.station_4_seconds, race.station_5_seconds, race.station_6_seconds, race.station_7_seconds, race.station_8_seconds];
  const totalRun = runSplits.reduce((a: number, b: number | null) => a + (b || 0), 0);
  const totalStation = stationSplits.reduce((a: number, b: number | null) => a + (b || 0), 0);

  const handleDelete = async () => {
    const { error } = await supabase.from('race_results' as any).delete().eq('id', race.id);
    if (error) toast.error('Failed to delete');
    else { toast.success(t('raceResults.raceDeleted')); onDelete(); }
  };

  return (
    <motion.div variants={item}>
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-display font-bold">{race.race_name || 'HYROX Race'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {new Date(race.race_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {race.race_location && (
                  <span className="text-[11px] text-muted-foreground">· {race.race_location}</span>
                )}
                <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">{race.category}</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-display font-bold text-primary">{formatTime(race.total_time_seconds)}</p>
              <p className="text-[10px] text-muted-foreground">{t('raceResults.totalTime')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2 rounded-lg bg-blue-500/10">
              <p className="text-xs font-bold text-blue-500">{formatTime(totalRun || null)}</p>
              <p className="text-[9px] text-muted-foreground">{t('raceResults.running')}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-primary/10">
              <p className="text-xs font-bold text-primary">{formatTime(totalStation || null)}</p>
              <p className="text-[9px] text-muted-foreground">{t('raceResults.stations')}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/60">
              <p className="text-xs font-bold text-muted-foreground">{formatTime(race.total_transition_seconds)}</p>
              <p className="text-[9px] text-muted-foreground">{t('raceResults.transitions')}</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {expanded ? t('raceResults.hideSplits') : t('raceResults.viewSplits')}
          </Button>

          {expanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
              {STATIONS.map((station, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_60px] gap-2 items-center text-xs">
                  <span className="text-muted-foreground">{station}</span>
                  <span className="text-right font-mono text-blue-500">{formatTime(runSplits[i])}</span>
                  <span className="text-right font-mono text-primary">{formatTime(stationSplits[i])}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground">Legend:</span>
                <div className="flex gap-3">
                  <span className="text-[10px] text-blue-500">Run</span>
                  <span className="text-[10px] text-primary">Station</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-full text-destructive text-xs mt-2" onClick={handleDelete}>
                <Trash2 className="h-3 w-3 mr-1" /> {t('raceResults.deleteRace')}
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AddRaceForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<'upload' | 'manual'>('upload');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [raceName, setRaceName] = useState('');
  const [raceLocation, setRaceLocation] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [category, setCategory] = useState('open');
  const [totalTime, setTotalTime] = useState('');
  const [transitionTime, setTransitionTime] = useState('');
  const [runSplits, setRunSplits] = useState<string[]>(Array(8).fill(''));
  const [stationSplits, setStationSplits] = useState<string[]>(Array(8).fill(''));
  const [notes, setNotes] = useState('');
  const [inputMethod, setInputMethod] = useState('manual');

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      const { data, error } = await supabase.functions.invoke('parse-race-screenshot', {
        body: { imageBase64: base64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const d = data.data;
      if (d.race_name) setRaceName(d.race_name);
      if (d.race_location) setRaceLocation(d.race_location);
      if (d.race_date) setRaceDate(d.race_date);
      if (d.category) setCategory(d.category);
      if (d.total_time_seconds) setTotalTime(formatTime(d.total_time_seconds));
      if (d.total_transition_seconds) setTransitionTime(formatTime(d.total_transition_seconds));

      const newRunSplits = [...runSplits];
      const newStationSplits = [...stationSplits];
      for (let i = 0; i < 8; i++) {
        const runKey = `run_${i + 1}_seconds`;
        const stationKey = `station_${i + 1}_seconds`;
        if (d[runKey]) newRunSplits[i] = formatTime(d[runKey]);
        if (d[stationKey]) newStationSplits[i] = formatTime(d[stationKey]);
      }
      setRunSplits(newRunSplits);
      setStationSplits(newStationSplits);
      setInputMethod('screenshot');

      toast.success(`Race data extracted (${d.confidence} confidence). Please review and adjust.`);
      setTab('manual');
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse screenshot');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!raceDate) { toast.error(t('raceResults.raceDateRequired')); return; }

    setSaving(true);
    try {
      const row: any = {
        athlete_id: user.id,
        race_date: raceDate,
        race_name: raceName.trim() || null,
        race_location: raceLocation.trim() || null,
        category,
        total_time_seconds: parseTimeToSeconds(totalTime),
        total_transition_seconds: parseTimeToSeconds(transitionTime),
        input_method: inputMethod,
        notes: notes.trim() || null,
      };

      for (let i = 0; i < 8; i++) {
        row[`run_${i + 1}_seconds`] = parseTimeToSeconds(runSplits[i]);
        row[`station_${i + 1}_seconds`] = parseTimeToSeconds(stationSplits[i]);
      }

      const { error } = await supabase.from('race_results' as any).insert(row);
      if (error) throw error;

      toast.success(t('raceResults.raceSaved'));
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">
            <Camera className="h-3.5 w-3.5 mr-1" /> {t('raceResults.uploadScreenshot')}
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('raceResults.manualEntry')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <Card className="glass">
            <CardContent className="p-6 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-primary" />
              <p className="text-sm font-medium">{t('raceResults.uploadRoxFit')}</p>
              <p className="text-xs text-muted-foreground">{t('raceResults.uploadRoxFitDesc')}</p>
              <label className="block">
                <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} disabled={parsing} />
                <Button className="gradient-hyrox" disabled={parsing} asChild>
                  <span>
                    {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                    {parsing ? t('raceResults.analyzing') : t('raceResults.chooseImage')}
                  </span>
                </Button>
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('onboarding.raceName')}</Label>
              <Input value={raceName} onChange={e => setRaceName(e.target.value)} placeholder="HYROX Munich" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('onboarding.location')}</Label>
              <Input value={raceLocation} onChange={e => setRaceLocation(e.target.value)} placeholder="Munich, DE" className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('onboarding.raceDate')} *</Label>
              <Input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('raceResults.category')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('raceResults.totalTimeLabel')}</Label>
              <Input value={totalTime} onChange={e => setTotalTime(e.target.value)} placeholder="1:25:30" className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('raceResults.transitionsLabel')}</Label>
              <Input value={transitionTime} onChange={e => setTransitionTime(e.target.value)} placeholder="8:00" className="h-8 text-xs font-mono" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('raceResults.splitsLabel')}</Label>
            <div className="grid grid-cols-[1fr_80px_80px] gap-x-2 gap-y-1.5 items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Station</span>
              <span className="text-[10px] font-semibold text-blue-500 text-center uppercase">Run</span>
              <span className="text-[10px] font-semibold text-primary text-center uppercase">Station</span>
              {STATIONS.map((station, i) => (
                <>
                  <span className="text-[10px] text-muted-foreground">{station}</span>
                  <Input value={runSplits[i]} onChange={e => { const n = [...runSplits]; n[i] = e.target.value; setRunSplits(n); }} className="h-7 text-xs font-mono text-center" placeholder="Run" />
                  <Input value={stationSplits[i]} onChange={e => { const n = [...stationSplits]; n[i] = e.target.value; setStationSplits(n); }} className="h-7 text-xs font-mono text-center" placeholder="Station" />
                </>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('raceResults.raceNotes')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />
          </div>

          <Button className="w-full gradient-hyrox" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('raceResults.saveRace')}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
