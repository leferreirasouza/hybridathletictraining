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

const MAX_RACE_IMAGES = 20;

type RaceImageItem = {
  dataUrl: string;
  name: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
  error?: string;
};

type ExtractedRaceData = {
  race_name?: string | null;
  race_location?: string | null;
  race_date?: string | null;
  category?: string | null;
  total_time_seconds?: number | null;
  total_transition_seconds?: number | null;
  confidence?: string;
  notes?: string;
  [key: string]: any;
};

type DetectedRace = {
  key: string;
  data: ExtractedRaceData;
  raceName: string;
  raceLocation: string;
  raceDate: string;
  category: string;
  totalTime: string;
  transitionTime: string;
  runSplits: string[];
  stationSplits: string[];
  notes: string;
  selected: boolean;
};

function mergeRaceData(results: ExtractedRaceData[]): ExtractedRaceData {
  const merged: ExtractedRaceData = {};
  const fields = [
    'race_name', 'race_location', 'race_date', 'category',
    'total_time_seconds', 'total_transition_seconds',
    ...Array.from({ length: 8 }, (_, i) => `run_${i + 1}_seconds`),
    ...Array.from({ length: 8 }, (_, i) => `station_${i + 1}_seconds`),
  ];

  for (const field of fields) {
    for (const r of results) {
      if (r[field] != null) {
        merged[field] = r[field];
        break;
      }
    }
  }

  const confidenceLevels = ['low', 'medium', 'high'];
  const worstConfidence = results.reduce((worst, r) => {
    const idx = confidenceLevels.indexOf(r.confidence || 'high');
    return idx < worst ? idx : worst;
  }, 2);
  merged.confidence = confidenceLevels[worstConfidence];

  return merged;
}

function getRaceKey(data: ExtractedRaceData): string {
  const name = (data.race_name || '').toLowerCase().trim();
  const date = data.race_date || '';
  // Group by name+date; if both empty, use 'unknown'
  if (!name && !date) return 'unknown';
  return `${name}||${date}`;
}

function groupByRace(results: ExtractedRaceData[]): Map<string, ExtractedRaceData[]> {
  const groups = new Map<string, ExtractedRaceData[]>();
  for (const r of results) {
    const key = getRaceKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return groups;
}

function extractedToDetected(key: string, merged: ExtractedRaceData): DetectedRace {
  const runSplits = Array.from({ length: 8 }, (_, i) =>
    merged[`run_${i + 1}_seconds`] ? formatTime(merged[`run_${i + 1}_seconds`]) : ''
  );
  const stationSplits = Array.from({ length: 8 }, (_, i) =>
    merged[`station_${i + 1}_seconds`] ? formatTime(merged[`station_${i + 1}_seconds`]) : ''
  );

  return {
    key,
    data: merged,
    raceName: merged.race_name || '',
    raceLocation: merged.race_location || '',
    raceDate: merged.race_date || '',
    category: merged.category || 'open',
    totalTime: merged.total_time_seconds ? formatTime(merged.total_time_seconds) : '',
    transitionTime: merged.total_transition_seconds ? formatTime(merged.total_transition_seconds) : '',
    runSplits,
    stationSplits,
    notes: '',
    selected: true,
  };
}

function AddRaceForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'manual'>('upload');
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseCurrent, setParseCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState<RaceImageItem[]>([]);
  const [extracted, setExtracted] = useState(false);

  // Multi-race state
  const [detectedRaces, setDetectedRaces] = useState<DetectedRace[]>([]);
  const [expandedRace, setExpandedRace] = useState<string | null>(null);

  // Single manual entry state (for manual tab when no screenshots)
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

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_RACE_IMAGES - images.length;
    const accepted = files.slice(0, remaining).filter(f => f.size <= 10 * 1024 * 1024);
    if (files.length > remaining) {
      toast.error(`Max ${MAX_RACE_IMAGES} images. ${remaining} slots remaining.`);
    }
    const newItems: RaceImageItem[] = [];
    for (const file of accepted) {
      const dataUrl = await readFileAsDataUrl(file);
      newItems.push({ dataUrl, name: file.name, status: 'pending' });
    }
    setImages(prev => [...prev, ...newItems]);
    setExtracted(false);
    setDetectedRaces([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setExtracted(false);
    setDetectedRaces([]);
  };

  const parseOneImage = async (base64: string): Promise<ExtractedRaceData> => {
    const { data, error } = await supabase.functions.invoke('parse-race-screenshot', {
      body: { imageBase64: base64 },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.data;
  };

  const handleParseAll = async () => {
    if (!images.length) return;
    setParsing(true);
    setParseProgress(0);
    setParseCurrent(0);

    const results: ExtractedRaceData[] = [];
    let completed = 0;

    for (let i = 0; i < images.length; i++) {
      setParseCurrent(i + 1);
      setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'parsing' } : img));

      try {
        const base64 = images[i].dataUrl.split(',')[1];
        const data = await parseOneImage(base64);
        results.push(data);
        setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'done' } : img));
      } catch (err: any) {
        setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'error', error: err.message } : img));
      }

      completed++;
      setParseProgress(Math.round((completed / images.length) * 100));
    }

    if (results.length > 0) {
      // Group by distinct race
      const groups = groupByRace(results);

      if (groups.size === 1) {
        // Single race — legacy behavior: merge and populate single form
        const merged = mergeRaceData(results);
        if (merged.race_name) setRaceName(merged.race_name);
        if (merged.race_location) setRaceLocation(merged.race_location);
        if (merged.race_date) setRaceDate(merged.race_date);
        if (merged.category) setCategory(merged.category);
        if (merged.total_time_seconds) setTotalTime(formatTime(merged.total_time_seconds));
        if (merged.total_transition_seconds) setTransitionTime(formatTime(merged.total_transition_seconds));
        const newRunSplits = [...runSplits];
        const newStationSplits = [...stationSplits];
        for (let i = 0; i < 8; i++) {
          if (merged[`run_${i + 1}_seconds`]) newRunSplits[i] = formatTime(merged[`run_${i + 1}_seconds`]);
          if (merged[`station_${i + 1}_seconds`]) newStationSplits[i] = formatTime(merged[`station_${i + 1}_seconds`]);
        }
        setRunSplits(newRunSplits);
        setStationSplits(newStationSplits);
        setInputMethod('screenshot');
        setDetectedRaces([]);
      } else {
        // Multiple distinct races detected
        const detected: DetectedRace[] = [];
        for (const [key, groupResults] of groups) {
          const merged = mergeRaceData(groupResults);
          detected.push(extractedToDetected(key, merged));
        }
        setDetectedRaces(detected);
        setExpandedRace(detected[0]?.key || null);
        setInputMethod('screenshot');
      }

      setExtracted(true);
      toast.success(
        groups.size > 1
          ? t('raceResults.multipleRacesDetected', { count: groups.size })
          : t('raceResults.parseDone', { done: results.length, total: images.length })
      );
      setTab('manual');
    }

    setParsing(false);
  };

  const updateDetectedRace = (key: string, updates: Partial<DetectedRace>) => {
    setDetectedRaces(prev =>
      prev.map(r => r.key === key ? { ...r, ...updates } : r)
    );
  };

  const handleSaveMultiple = async () => {
    if (!user) return;
    const selected = detectedRaces.filter(r => r.selected);
    if (!selected.length) { toast.error('Select at least one race to save'); return; }

    const missing = selected.filter(r => !r.raceDate);
    if (missing.length) { toast.error(t('raceResults.raceDateRequired')); return; }

    setSaving(true);
    try {
      const rows = selected.map(r => {
        const row: any = {
          athlete_id: user.id,
          race_date: r.raceDate,
          race_name: r.raceName.trim() || null,
          race_location: r.raceLocation.trim() || null,
          category: r.category,
          total_time_seconds: parseTimeToSeconds(r.totalTime),
          total_transition_seconds: parseTimeToSeconds(r.transitionTime),
          input_method: 'screenshot',
          notes: r.notes.trim() || null,
        };
        for (let i = 0; i < 8; i++) {
          row[`run_${i + 1}_seconds`] = parseTimeToSeconds(r.runSplits[i]);
          row[`station_${i + 1}_seconds`] = parseTimeToSeconds(r.stationSplits[i]);
        }
        return row;
      });

      const { error } = await supabase.from('race_results' as any).insert(rows);
      if (error) throw error;

      toast.success(t('raceResults.multiSaved', { count: rows.length }));
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingle = async () => {
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

  const doneCount = images.filter(i => i.status === 'done').length;
  const errorCount = images.filter(i => i.status === 'error').length;
  const showMultiRaceView = detectedRaces.length > 0;

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

        <TabsContent value="upload" className="mt-3 space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= MAX_RACE_IMAGES || parsing}
            className="w-full border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImagePlus className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {images.length === 0 ? t('raceResults.uploadRoxFit') : t('raceResults.addMore')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('raceResults.imagesAdded', { count: images.length, max: MAX_RACE_IMAGES })}
              </p>
              {images.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">{t('raceResults.uploadRoxFitDesc')}</p>
              )}
            </div>
          </button>

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />

          {images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Images className="h-4 w-4" />
                  {images.length} image{images.length !== 1 ? 's' : ''}
                </p>
                {(doneCount > 0 || errorCount > 0) && (
                  <span className="text-xs text-muted-foreground">
                    {doneCount} done{errorCount > 0 && `, ${errorCount} failed`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {images.map((img, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square">
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    {img.status === 'parsing' && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                    {img.status === 'done' && (
                      <div className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[9px] text-center py-0.5">
                        <Check className="h-2.5 w-2.5 inline" />
                      </div>
                    )}
                    {img.status === 'error' && (
                      <div className="absolute bottom-0 inset-x-0 bg-destructive/90 text-destructive-foreground text-[9px] text-center py-0.5">
                        {t('raceResults.parseFailed')}
                      </div>
                    )}
                    {!parsing && (
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {parsing && (
                <div className="space-y-1.5">
                  <Progress value={parseProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {t('raceResults.parsing', { current: parseCurrent, total: images.length })}
                  </p>
                </div>
              )}

              {!parsing && !extracted && (
                <Button onClick={handleParseAll} className="w-full gradient-hyrox">
                  <Upload className="h-4 w-4 mr-2" />
                  {t('raceResults.parseAll', { count: images.length })}
                </Button>
              )}

              {extracted && (
                <div className="text-center text-xs text-muted-foreground p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <Check className="h-4 w-4 inline mr-1 text-primary" />
                  {showMultiRaceView
                    ? t('raceResults.multipleRacesDetected', { count: detectedRaces.length })
                    : t('raceResults.reviewExtracted')}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-3 space-y-4">
          {showMultiRaceView ? (
            <MultiRaceReview
              detectedRaces={detectedRaces}
              expandedRace={expandedRace}
              setExpandedRace={setExpandedRace}
              updateDetectedRace={updateDetectedRace}
              onSave={handleSaveMultiple}
              saving={saving}
            />
          ) : (
            <SingleRaceForm
              raceName={raceName} setRaceName={setRaceName}
              raceLocation={raceLocation} setRaceLocation={setRaceLocation}
              raceDate={raceDate} setRaceDate={setRaceDate}
              category={category} setCategory={setCategory}
              totalTime={totalTime} setTotalTime={setTotalTime}
              transitionTime={transitionTime} setTransitionTime={setTransitionTime}
              runSplits={runSplits} setRunSplits={setRunSplits}
              stationSplits={stationSplits} setStationSplits={setStationSplits}
              notes={notes} setNotes={setNotes}
              onSave={handleSaveSingle}
              saving={saving}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MultiRaceReview({
  detectedRaces, expandedRace, setExpandedRace, updateDetectedRace, onSave, saving,
}: {
  detectedRaces: DetectedRace[];
  expandedRace: string | null;
  setExpandedRace: (k: string | null) => void;
  updateDetectedRace: (key: string, updates: Partial<DetectedRace>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const selectedCount = detectedRaces.filter(r => r.selected).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-display font-bold flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-primary" />
          {t('raceResults.racesDetected', { count: detectedRaces.length })}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {selectedCount} selected
        </Badge>
      </div>

      {detectedRaces.map((race) => {
        const isExpanded = expandedRace === race.key;
        return (
          <Card key={race.key} className={`overflow-hidden border transition-colors ${race.selected ? 'border-primary/30' : 'border-border opacity-60'}`}>
            <div
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setExpandedRace(isExpanded ? null : race.key)}
            >
              <button
                onClick={e => { e.stopPropagation(); updateDetectedRace(race.key, { selected: !race.selected }); }}
                className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  race.selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                }`}
              >
                {race.selected && <Check className="h-3 w-3 text-primary-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{race.raceName || 'Unknown Race'}</p>
                <p className="text-xs text-muted-foreground">
                  {race.raceDate || 'No date'}{race.raceLocation ? ` · ${race.raceLocation}` : ''}
                  {race.totalTime ? ` · ${race.totalTime}` : ''}
                </p>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>

            {isExpanded && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.raceName')}</Label>
                    <Input value={race.raceName} onChange={e => updateDetectedRace(race.key, { raceName: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.location')}</Label>
                    <Input value={race.raceLocation} onChange={e => updateDetectedRace(race.key, { raceLocation: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.raceDate')} *</Label>
                    <Input type="date" value={race.raceDate} onChange={e => updateDetectedRace(race.key, { raceDate: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('raceResults.category')}</Label>
                    <Select value={race.category} onValueChange={v => updateDetectedRace(race.key, { category: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('raceResults.totalTimeLabel')}</Label>
                    <Input value={race.totalTime} onChange={e => updateDetectedRace(race.key, { totalTime: e.target.value })} className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('raceResults.transitionsLabel')}</Label>
                    <Input value={race.transitionTime} onChange={e => updateDetectedRace(race.key, { transitionTime: e.target.value })} className="h-8 text-xs font-mono" />
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
                        <span key={`label-${i}`} className="text-[10px] text-muted-foreground">{station}</span>
                        <Input key={`run-${i}`} value={race.runSplits[i]} onChange={e => {
                          const n = [...race.runSplits]; n[i] = e.target.value;
                          updateDetectedRace(race.key, { runSplits: n });
                        }} className="h-7 text-xs font-mono text-center" placeholder="Run" />
                        <Input key={`station-${i}`} value={race.stationSplits[i]} onChange={e => {
                          const n = [...race.stationSplits]; n[i] = e.target.value;
                          updateDetectedRace(race.key, { stationSplits: n });
                        }} className="h-7 text-xs font-mono text-center" placeholder="Station" />
                      </>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </Card>
        );
      })}

      <Button className="w-full gradient-hyrox" onClick={onSave} disabled={saving || selectedCount === 0}>
        {saving ? t('common.saving') : t('raceResults.saveAllRaces', { count: selectedCount })}
      </Button>
    </div>
  );
}

function SingleRaceForm({
  raceName, setRaceName, raceLocation, setRaceLocation, raceDate, setRaceDate,
  category, setCategory, totalTime, setTotalTime, transitionTime, setTransitionTime,
  runSplits, setRunSplits, stationSplits, setStationSplits, notes, setNotes,
  onSave, saving,
}: {
  raceName: string; setRaceName: (v: string) => void;
  raceLocation: string; setRaceLocation: (v: string) => void;
  raceDate: string; setRaceDate: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  totalTime: string; setTotalTime: (v: string) => void;
  transitionTime: string; setTransitionTime: (v: string) => void;
  runSplits: string[]; setRunSplits: (v: string[]) => void;
  stationSplits: string[]; setStationSplits: (v: string[]) => void;
  notes: string; setNotes: (v: string) => void;
  onSave: () => void; saving: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
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
              <span key={`label-${i}`} className="text-[10px] text-muted-foreground">{station}</span>
              <Input key={`run-${i}`} value={runSplits[i]} onChange={e => { const n = [...runSplits]; n[i] = e.target.value; setRunSplits(n); }} className="h-7 text-xs font-mono text-center" placeholder="Run" />
              <Input key={`station-${i}`} value={stationSplits[i]} onChange={e => { const n = [...stationSplits]; n[i] = e.target.value; setStationSplits(n); }} className="h-7 text-xs font-mono text-center" placeholder="Station" />
            </>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t('raceResults.raceNotes')}</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />
      </div>

      <Button className="w-full gradient-hyrox" onClick={onSave} disabled={saving}>
        {saving ? t('common.saving') : t('raceResults.saveRace')}
      </Button>
    </>
  );
}
