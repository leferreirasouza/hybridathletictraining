import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Search, Sparkles, Check, X, Edit2, Trash2, Loader2, Dumbbell, ShieldCheck, AlertTriangle, BookOpen, Camera } from 'lucide-react';
import ScreenshotParserDialog from '@/components/exercises/ScreenshotParserDialog';
import { useTranslation } from 'react-i18next';

const CATEGORIES = ['strength', 'endurance', 'mobility', 'plyometric', 'station_specific', 'accessory', 'warmup', 'cooldown', 'general'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'elite'];
const DISCIPLINES = ['run', 'bike', 'stairs', 'rowing', 'skierg', 'mobility', 'strength', 'accessories', 'hyrox_station', 'prehab', 'custom'];
const HYROX_STATIONS = ['skierg', 'sled_push', 'sled_pull', 'burpee_broad_jump', 'row', 'farmers_carry', 'sandbag_lunges', 'wall_balls'];

type Exercise = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  discipline: string;
  muscle_groups: string[];
  equipment_required: string[];
  hyrox_station: string | null;
  difficulty_level: string;
  description: string | null;
  coaching_cues: string | null;
  contraindications: string | null;
  progression_from: string | null;
  progression_to: string | null;
  video_url: string | null;
  is_approved: boolean;
  source: string;
  created_at: string;
};

const emptyExercise = {
  name: '',
  category: 'general',
  subcategory: '',
  discipline: 'custom',
  muscle_groups: '',
  equipment_required: '',
  hyrox_station: '',
  difficulty_level: 'intermediate',
  description: '',
  coaching_cues: '',
  contraindications: '',
  progression_from: '',
  progression_to: '',
  video_url: '',
};

export default function ExerciseLibrary() {
  const { t } = useTranslation();
  const { user, currentOrg, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterApproved, setFilterApproved] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyExercise);
  const [seedLoading, setSeedLoading] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  const isCoachOrAdmin = effectiveRole && ['coach', 'admin', 'master_admin'].includes(effectiveRole);
  const isMasterAdmin = effectiveRole === 'master_admin';

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercise-library', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('exercise_library' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as Exercise[];
    },
    enabled: !!currentOrg,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        organization_id: currentOrg!.id,
        created_by: user!.id,
        name: values.name,
        category: values.category,
        subcategory: values.subcategory || null,
        discipline: values.discipline,
        muscle_groups: values.muscle_groups ? values.muscle_groups.split(',').map(s => s.trim()) : [],
        equipment_required: values.equipment_required ? values.equipment_required.split(',').map(s => s.trim()) : [],
        hyrox_station: values.hyrox_station || null,
        difficulty_level: values.difficulty_level,
        description: values.description || null,
        coaching_cues: values.coaching_cues || null,
        contraindications: values.contraindications || null,
        progression_from: values.progression_from || null,
        progression_to: values.progression_to || null,
        video_url: values.video_url || null,
        source: 'manual',
      };

      if (editingId) {
        const { error } = await supabase.from('exercise_library' as any).update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exercise_library' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Exercise updated' : 'Exercise added');
      queryClient.invalidateQueries({ queryKey: ['exercise-library'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercise_library' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Exercise deleted');
      queryClient.invalidateQueries({ queryKey: ['exercise-library'] });
    },
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from('exercise_library' as any).update({
        is_approved: approved,
        approved_by: approved ? user!.id : null,
        approved_at: approved ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.approved ? 'Exercise approved ✅' : 'Approval revoked');
      queryClient.invalidateQueries({ queryKey: ['exercise-library'] });
    },
  });

  const resetForm = () => {
    setForm(emptyExercise);
    setEditingId(null);
  };

  const openEdit = (ex: Exercise) => {
    setForm({
      name: ex.name,
      category: ex.category,
      subcategory: ex.subcategory || '',
      discipline: ex.discipline,
      muscle_groups: ex.muscle_groups?.join(', ') || '',
      equipment_required: ex.equipment_required?.join(', ') || '',
      hyrox_station: ex.hyrox_station || '',
      difficulty_level: ex.difficulty_level,
      description: ex.description || '',
      coaching_cues: ex.coaching_cues || '',
      contraindications: ex.contraindications || '',
      progression_from: ex.progression_from || '',
      progression_to: ex.progression_to || '',
      video_url: ex.video_url || '',
    });
    setEditingId(ex.id);
    setDialogOpen(true);
  };

  const handleSeedAI = async () => {
    if (!currentOrg || !user) return;
    setSeedLoading(true);
    try {
      const session_token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!session_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-exercise-library`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ organization_id: currentOrg.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to seed exercises');
      }

      const result = await response.json();
      toast.success(`${result.count} exercises generated! Review and approve them.`);
      queryClient.invalidateQueries({ queryKey: ['exercise-library'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSeedLoading(false);
    }
  };

  const filtered = exercises.filter(ex => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) &&
      !ex.category.toLowerCase().includes(search.toLowerCase()) &&
      !ex.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== 'all' && ex.category !== filterCategory) return false;
    if (filterApproved === 'approved' && !ex.is_approved) return false;
    if (filterApproved === 'pending' && ex.is_approved) return false;
    return true;
  });

  const approvedCount = exercises.filter(e => e.is_approved).length;
  const pendingCount = exercises.filter(e => !e.is_approved).length;

  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t('exerciseLibrary.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('exerciseLibrary.exercisesCount', { total: exercises.length, approved: approvedCount, pending: pendingCount })}
          </p>
        </div>
        {isMasterAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setScreenshotOpen(true)}>
              <Camera className="h-4 w-4 mr-1" />
              {t('exerciseLibrary.scan')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSeedAI} disabled={seedLoading}>
              {seedLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {t('exerciseLibrary.aiSeed')}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t('exerciseLibrary.add')}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>{editingId ? t('exerciseLibrary.editExercise') : t('exerciseLibrary.addExercise')}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-3 pb-4">
                    <div>
                      <Label className="text-xs">Name *</Label>
                      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Barbell Back Squat" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={form.difficulty_level} onValueChange={v => setForm(f => ({ ...f, difficulty_level: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Discipline</Label>
                        <Select value={form.discipline} onValueChange={v => setForm(f => ({ ...f, discipline: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d.replace('_', ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">HYROX Station</Label>
                        <Select value={form.hyrox_station || 'none'} onValueChange={v => setForm(f => ({ ...f, hyrox_station: v === 'none' ? '' : v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {HYROX_STATIONS.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Muscle Groups (comma-separated)</Label>
                      <Input value={form.muscle_groups} onChange={e => setForm(f => ({ ...f, muscle_groups: e.target.value }))} placeholder="quads, glutes, core" />
                    </div>
                    <div>
                      <Label className="text-xs">Equipment Required (comma-separated)</Label>
                      <Input value={form.equipment_required} onChange={e => setForm(f => ({ ...f, equipment_required: e.target.value }))} placeholder="barbell, rack" />
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Coaching Cues</Label>
                      <Textarea value={form.coaching_cues} onChange={e => setForm(f => ({ ...f, coaching_cues: e.target.value }))} rows={2} placeholder="Key form points..." />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Contraindications</Label>
                      <Textarea value={form.contraindications} onChange={e => setForm(f => ({ ...f, contraindications: e.target.value }))} rows={2} placeholder="Avoid if knee pain, lower back issues..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Progression From</Label>
                        <Input value={form.progression_from} onChange={e => setForm(f => ({ ...f, progression_from: e.target.value }))} placeholder="Goblet Squat" />
                      </div>
                      <div>
                        <Label className="text-xs">Progression To</Label>
                        <Input value={form.progression_to} onChange={e => setForm(f => ({ ...f, progression_to: e.target.value }))} placeholder="Front Squat" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Video URL</Label>
                      <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." />
                    </div>
                  </div>
                </ScrollArea>
                <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} className="mt-2">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {editingId ? t('exerciseLibrary.update') : t('exerciseLibrary.addExercise')}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..." className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterApproved} onValueChange={setFilterApproved}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exercise List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No exercises found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {exercises.length === 0 ? 'Use "AI Seed" to generate a starter HYROX exercise bank, or add exercises manually.' : 'Try adjusting your filters.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(ex => (
            <Card key={ex.id} className="p-3 flex items-start gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${ex.is_approved ? 'bg-primary/10' : 'bg-muted'}`}>
                {ex.is_approved ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Dumbbell className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{ex.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{ex.category.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className="text-[10px]">{ex.difficulty_level}</Badge>
                  {ex.hyrox_station && <Badge className="text-[10px] bg-primary/10 text-primary border-0">{ex.hyrox_station.replace('_', ' ')}</Badge>}
                  {!ex.is_approved && <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">pending</Badge>}
                  {ex.source === 'ai_seed' && <Badge variant="outline" className="text-[10px] border-accent/50 text-accent-foreground">AI generated</Badge>}
                </div>
                {ex.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ex.description}</p>}
                {ex.muscle_groups?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {ex.muscle_groups.map(mg => <span key={mg} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{mg}</span>)}
                  </div>
                )}
                {ex.contraindications && (
                  <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {ex.contraindications}
                  </p>
                )}
              </div>
              {isMasterAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleApproval.mutate({ id: ex.id, approved: !ex.is_approved })}>
                    {ex.is_approved ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-primary" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ex)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(ex.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ScreenshotParserDialog open={screenshotOpen} onOpenChange={setScreenshotOpen} />
    </div>
  );
}
