import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Upload, FileSpreadsheet, Trash2, Loader2, CheckCircle2, List, Eye, EyeOff, UserCircle, Search, X, Dumbbell, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import ExcelJS from 'exceljs';
import PlanCreationWizard from '@/pages/PlanCreationWizard';
import { useTranslation } from 'react-i18next';
import { useOrgPlans } from '@/hooks/useOrgPlans';
import { SwapSessionDialog } from '@/components/schedule/SwapSessionDialog';

type Discipline = Database['public']['Enums']['discipline'];
type Intensity = Database['public']['Enums']['intensity_level'];
type AppRole = Database['public']['Enums']['app_role'];

const disciplineOptions: { value: Discipline; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'bike', label: 'Bike' },
  { value: 'rowing', label: 'Row' },
  { value: 'skierg', label: 'SkiErg' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'hyrox_station', label: 'HYROX Station' },
  { value: 'strength', label: 'Strength' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'prehab', label: 'Prehab' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'custom', label: 'Custom' },
];

const intensityOptions: { value: Intensity; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'race_pace', label: 'Race Pace' },
  { value: 'max_effort', label: 'Max Effort' },
];

const rolePriority: Record<AppRole, number> = {
  master_admin: 0,
  admin: 1,
  coach: 2,
  athlete: 3,
};

interface ExerciseEntry {
  exerciseId: string;
  exerciseName: string;
  setsReps: string;
  load?: string;
}

// Accepts: "3x10", "3×10", "4x8-12", "5x30s", "30s", "10 reps", "5 rounds", "AMRAP 10", "EMOM 12"
const SETS_REPS_RE = /^(\s*(\d+\s*[x×]\s*\d+(\s*-\s*\d+)?(\s*(s|sec|secs|m|min|reps?))?|\d+\s*(s|sec|secs|m|min|reps?)|\d+\s*rounds?|amrap\s*\d+|emom\s*\d+)\s*)$/i;
// Accepts: "60kg", "135lb", "75%", "75% 1RM", "BW", "bodyweight", "RPE 8", "RPE 8.5"
const LOAD_RE = /^(\s*(\d+(\.\d+)?\s*(kg|lb|lbs|%|%\s*1rm)|bw|bodyweight|rpe\s*\d+(\.\d+)?)\s*)$/i;

const validateExercise = (ex: ExerciseEntry): string | null => {
  if (!ex.setsReps.trim()) return `${ex.exerciseName}: sets×reps required`;
  if (!SETS_REPS_RE.test(ex.setsReps)) return `${ex.exerciseName}: invalid sets×reps (try "3x10", "5x30s", "AMRAP 10")`;
  if (ex.load && ex.load.trim() && !LOAD_RE.test(ex.load)) return `${ex.exerciseName}: invalid load (try "60kg", "75%", "BW", "RPE 8")`;
  return null;
};

interface SessionRow {
  id: string;
  dbId?: string;
  day: number;
  discipline: Discipline;
  name: string;
  duration: string;
  distance: string;
  intensity: Intensity | '';
  details: string;
  notes: string;
  exercises: ExerciseEntry[];
}

interface AssigneeOption {
  id: string;
  fullName: string;
  role: AppRole;
}

const emptyRow = (): SessionRow => ({
  id: crypto.randomUUID(),
  day: 1,
  discipline: 'run',
  name: '',
  duration: '',
  distance: '',
  intensity: '',
  details: '',
  notes: '',
  exercises: [],
});

function ExercisePicker({
  orgId,
  onSelect,
}: {
  orgId?: string;
  onSelect: (exercise: { id: string; name: string; category: string; discipline: string }) => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercise-library', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercise_library')
        .select('id, name, category, subcategory, discipline, difficulty_level, muscle_groups, hyrox_station')
        .eq('is_approved', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      return data || [];
    },
    enabled: !!orgId,
  });

  const categories = ['all', ...Array.from(new Set(exercises.map((e: any) => e.category)))];

  const filtered = exercises.filter((ex: any) => {
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.muscle_groups?.some((m: string) => m.toLowerCase().includes(search.toLowerCase()));
    const matchCat = categoryFilter === 'all' || ex.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categoryColors: Record<string, string> = {
    hyrox: 'bg-primary/15 text-primary',
    strength: 'bg-blue-500/15 text-blue-400',
    prehab: 'bg-green-500/15 text-green-400',
    run_drill: 'bg-orange-500/15 text-orange-400',
    conditioning: 'bg-purple-500/15 text-purple-400',
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c} value={c} className="text-xs capitalize">{c === 'all' ? 'All' : c.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="h-[300px]">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No exercises found</p>
          </div>
        ) : (
          <div className="space-y-1 pr-2">
            {filtered.map((ex: any) => (
              <button
                key={ex.id}
                onClick={() => onSelect({ id: ex.id, name: ex.name, category: ex.category, discipline: ex.discipline })}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border/50 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ex.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${categoryColors[ex.category] || 'bg-muted text-muted-foreground'}`}>
                        {ex.category?.replace('_', ' ')}
                      </span>
                      {ex.difficulty_level && (
                        <span className="text-[10px] text-muted-foreground capitalize">{ex.difficulty_level}</span>
                      )}
                      {ex.muscle_groups?.slice(0, 2).map((m: string) => (
                        <span key={m} className="text-[10px] text-muted-foreground">{m.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function CurrentPlansTab({ onFineTune }: { onFineTune: (planId: string) => void }) {
  const { t } = useTranslation();
  const { user, currentOrg } = useAuth();
  const queryClient = useQueryClient();

  // Fetch org members for assignment dropdown
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['current-plans-members', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return [];
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id);
      const userIds = [...new Set((roleRows || []).map(r => r.user_id as string))];
      if (!userIds.length) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      return (profiles || []).map(p => ({
        id: p.id,
        fullName: p.full_name || (p.id === user.id ? 'You' : 'Unknown'),
      })).sort((a, b) => {
        if (a.id === user?.id) return -1;
        if (b.id === user?.id) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
    },
    enabled: !!currentOrg?.id && !!user?.id,
  });

  const { data: plans, isLoading } = useOrgPlans();

  const handleToggleArchive = async (planId: string, currentlyActive: boolean) => {
    const { error } = await supabase
      .from('training_plans')
      .update({ archived_at: currentlyActive ? new Date().toISOString() : null })
      .eq('id', planId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(currentlyActive ? 'Plan archived — hidden from athlete dashboard' : 'Plan restored — visible on athlete dashboard');
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    }
  };

  const handleDelete = async (planId: string) => {
    const { error } = await supabase.from('training_plans').delete().eq('id', planId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Plan deleted permanently');
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    }
  };

  const handleAssignAthlete = async (planId: string, versionIds: string[], athleteId: string) => {
    if (!versionIds.length) {
      toast.error('No plan versions found');
      return;
    }
    const { error } = await supabase
      .from('planned_sessions')
      .update({ athlete_id: athleteId })
      .in('plan_version_id', versionIds);
    if (error) {
      toast.error(error.message);
    } else {
      const member = orgMembers.find(m => m.id === athleteId);
      toast.success(`Plan assigned to ${member?.fullName || 'athlete'}`);
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plans?.length) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center">
          <List className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-display font-bold">No plans yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create a plan from scratch or import one from a spreadsheet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map(plan => {
        const assignedMember = orgMembers.find(m => m.id === plan.assignedAthleteId);
        return (
          <Card key={plan.id} className={`glass transition-opacity ${!plan.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-sm truncate">{plan.name}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{plan.source}</Badge>
                    {plan.is_template && <Badge variant="secondary" className="text-[10px] shrink-0">Template</Badge>}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{plan.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Created {new Date(plan.created_at).toLocaleDateString()} · {plan.versionCount} version(s)
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    {plan.isActive ? (
                      <Eye className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={() => handleToggleArchive(plan.id, plan.isActive)}
                    />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete plan permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{plan.name}" and all its sessions, versions, and data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(plan.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete Forever
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {/* Assign athlete row */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Assigned to:</span>
                <Select
                  value={plan.assignedAthleteId || ''}
                  onValueChange={(val) => handleAssignAthlete(plan.id, plan.versionIds, val)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgMembers.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.id === user?.id ? `${m.fullName} (You)` : m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end pt-1">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => onFineTune(plan.id)}>
                  <Pencil className="h-3 w-3" /> Fine-tune this plan
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function PlanBuilder() {
  const { t } = useTranslation();
  const { user, currentOrg, currentRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManagePlans = !!currentRole && ['coach', 'admin', 'master_admin'].includes(currentRole);
  const requestedTab = searchParams.get('tab');
  const managerTab = requestedTab === 'plans' || requestedTab === 'build' || requestedTab === 'import' ? requestedTab : 'plans';
  const showAthleteImport = !canManagePlans && requestedTab === 'import';

  const [planName, setPlanName] = useState('');
  const [weekCount, setWeekCount] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [sessionsByWeek, setSessionsByWeek] = useState<Record<number, SessionRow[]>>({ 1: [emptyRow()] });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');

  const { data: assigneeOptions = [] } = useQuery({
    queryKey: ['plan-builder-assignees', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return [] as AssigneeOption[];

      const { data: roleRows, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id);

      if (error) throw error;

      const roleByUser = new Map<string, AppRole>();
      (roleRows || []).forEach((row) => {
        const existing = roleByUser.get(row.user_id as string);
        const nextRole = row.role as AppRole;
        if (!existing || rolePriority[nextRole] < rolePriority[existing]) {
          roleByUser.set(row.user_id as string, nextRole);
        }
      });

      if (!roleByUser.has(user.id)) {
        roleByUser.set(user.id, (currentRole as AppRole) || 'coach');
      }

      const userIds = [...roleByUser.keys()];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));

      return userIds
        .map((id) => ({
          id,
          fullName: profileMap.get(id) || (id === user.id ? 'You' : 'Unknown'),
          role: roleByUser.get(id) || 'athlete',
        }))
        .sort((a, b) => {
          if (a.id === user.id) return -1;
          if (b.id === user.id) return 1;
          return a.fullName.localeCompare(b.fullName);
        });
    },
    enabled: !!canManagePlans && !!currentOrg?.id && !!user?.id,
  });

  const targetAthleteId = selectedAthleteId || user?.id || '';

  const sessions = sessionsByWeek[currentWeek] || [];
  const setSessions = (updater: (prev: SessionRow[]) => SessionRow[]) => {
    setSessionsByWeek(prev => ({ ...prev, [currentWeek]: updater(prev[currentWeek] || []) }));
  };

  useEffect(() => {
    if (!sessionsByWeek[currentWeek]) {
      setSessionsByWeek(prev => ({ ...prev, [currentWeek]: [emptyRow()] }));
    }
  }, [currentWeek]);

  const [pickerForRow, setPickerForRow] = useState<string | null>(null);

  const addRow = () => setSessions(prev => [...prev, emptyRow()]);
  const removeRow = (id: string) => setSessions(prev => prev.filter(s => s.id !== id));
  const updateRow = (id: string, field: keyof SessionRow, value: string | number) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addExercise = (rowId: string, ex: ExerciseEntry) => {
    setSessions(prev => prev.map(s => s.id === rowId
      ? { ...s, exercises: [...s.exercises, ex] }
      : s
    ));
  };

  const removeExercise = (rowId: string, idx: number) => {
    setSessions(prev => prev.map(s => s.id === rowId
      ? { ...s, exercises: s.exercises.filter((_, i) => i !== idx) }
      : s
    ));
  };

  const updateExercise = (rowId: string, idx: number, update: Partial<ExerciseEntry>) => {
    setSessions(prev => prev.map(s => s.id === rowId
      ? { ...s, exercises: s.exercises.map((ex, i) => i === idx ? { ...ex, ...update } : ex) }
      : s
    ));
  };

  const handleSave = async () => {
    if (!planName.trim()) { toast.error('Please enter a plan name'); return; }
    if (!user || !currentOrg) { toast.error('No org context'); return; }
    if (!targetAthleteId) { toast.error('Please select an athlete'); return; }
    const exerciseErrors: string[] = [];
    Object.entries(sessionsByWeek).forEach(([week, rows]) => {
      rows.filter(r => r.name.trim()).forEach(r => {
        r.exercises.forEach(ex => {
          const err = validateExercise(ex);
          if (err) exerciseErrors.push(`W${week} ${r.name}: ${err}`);
        });
      });
    });
    if (exerciseErrors.length > 0) {
      toast.error(exerciseErrors.slice(0, 3).join(' • ') + (exerciseErrors.length > 3 ? ` (+${exerciseErrors.length - 3} more)` : ''));
      return;
    }
    setSaving(true);
    try {
      const { data: plan, error: planErr } = await supabase
        .from('training_plans')
        .insert({ name: planName.trim(), organization_id: currentOrg.id, created_by: user.id, source: 'manual' })
        .select().single();
      if (planErr) throw planErr;
      const { data: version, error: verErr } = await supabase
        .from('plan_versions')
        .insert({ plan_id: plan.id, version_number: 1, created_by: user.id })
        .select().single();
      if (verErr) throw verErr;
      const allSessions = Object.entries(sessionsByWeek).flatMap(([week, rows]) =>
        rows.filter(r => r.name.trim()).map((r, idx) => {
          const workoutDetailsText = r.exercises.length > 0
            ? r.exercises.map(ex => `${ex.exerciseName}${ex.setsReps ? ` — ${ex.setsReps}` : ''}${ex.load ? ` @ ${ex.load}` : ''}`).join('\n')
            : r.details || null;
          return {
            plan_version_id: version.id,
            athlete_id: targetAthleteId,
            week_number: Number(week),
            day_of_week: r.day,
            discipline: r.discipline as Discipline,
            session_name: r.name.trim(),
            duration_min: r.duration ? parseFloat(r.duration) : null,
            distance_km: r.distance ? parseFloat(r.distance) : null,
            intensity: (r.intensity || null) as Intensity | null,
            workout_details: workoutDetailsText,
            notes: r.notes || null,
            order_index: idx,
          };
        })
      );
      if (allSessions.length > 0) {
        const { error: sessErr } = await supabase.from('planned_sessions').insert(allSessions);
        if (sessErr) throw sessErr;
      }
      toast.success(`Plan "${planName}" saved with ${allSessions.length} sessions!`);
      setPlanName(''); setWeekCount(1); setCurrentWeek(1); setSessionsByWeek({ 1: [emptyRow()] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to save plan');
    } finally { setSaving(false); }
  };

  const handleImport = async () => {
    if (!user || !currentOrg) { toast.error('No org context'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const data = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const importName = planName.trim() || file.name.replace(/\.(xlsx|xls|csv)$/i, '');
        const sheets: Record<string, any[][]> = {};
        workbook.eachSheet((worksheet) => {
          const rows: any[][] = [];
          worksheet.eachRow({ includeEmpty: false }, (row) => {
            const values = (row.values as any[]).slice(1);
            rows.push(values.map(v => (v == null ? '' : String(v))));
          });
          if (rows.length > 1) sheets[worksheet.name] = rows;
        });
        if (Object.keys(sheets).length === 0) throw new Error('No data found in the spreadsheet');
        const { data: result, error } = await supabase.functions.invoke('import-plan', {
          body: { sheets, organizationId: currentOrg.id, planName: importName, athleteId: targetAthleteId },
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        const parts = [];
        if (result.sessionsCreated) parts.push(`${result.sessionsCreated} sessions`);
        if (result.targetsCreated) parts.push(`${result.targetsCreated} targets`);
        if (result.weeklySummariesCreated) parts.push(`${result.weeklySummariesCreated} weekly summaries`);
        if (result.garminWorkoutsCreated) parts.push(`${result.garminWorkoutsCreated} Garmin workouts`);
        toast.success(`Imported "${importName}" — ${parts.join(', ')}`);
        if (result.errors?.length > 0) { console.warn('Import warnings:', result.errors); toast.warning(`${result.errors.length} rows had parsing issues`); }
      } catch (e: any) { toast.error(e.message || 'Import failed'); }
      finally { setImporting(false); }
    };
    input.click();
  };

  useEffect(() => {
    if (!user) return;

    if (!canManagePlans) {
      setSelectedAthleteId(user.id);
      return;
    }

    if (!assigneeOptions.length) return;
    if (selectedAthleteId && assigneeOptions.some((option) => option.id === selectedAthleteId)) return;

    const selfOption = assigneeOptions.find((option) => option.id === user.id);
    setSelectedAthleteId(selfOption?.id || assigneeOptions[0].id);
  }, [user, canManagePlans, assigneeOptions, selectedAthleteId]);

  if (!canManagePlans) {
    if (showAthleteImport) {
      return (
        <div className="page-container py-6 space-y-5">
          <h1 className="text-xl font-display font-bold">{t('planBuilder.createYourPlan')}</h1>
          <Card className="glass">
            <CardContent className="p-8 text-center space-y-4">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="font-display font-bold">{t('planBuilder.importFromSpreadsheet')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('planBuilder.importDesc')}</p>
              </div>
              <div className="max-w-xs mx-auto space-y-2">
                <Label className="text-xs text-muted-foreground">{t('planBuilder.planNameOptional')}</Label>
                <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder={t('planBuilder.autoDetected')} className="text-center" />
              </div>
              <div className="max-w-xs mx-auto space-y-2">
                <Label className="text-xs text-muted-foreground">Assign athlete</Label>
                <Select value={targetAthleteId} onValueChange={setSelectedAthleteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select athlete" />
                  </SelectTrigger>
                  <SelectContent>
                    {assigneeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.fullName}{option.id === user?.id ? ' (You)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="gradient-hyrox" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? t('planBuilder.importing') : t('planBuilder.importBtn')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <PlanCreationWizard />;
  }

  return (
    <div className="page-container py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">{t('planBuilder.title')}</h1>
      </div>

      <Tabs value={managerTab} onValueChange={(value) => { const next = new URLSearchParams(searchParams); next.set('tab', value); setSearchParams(next, { replace: true }); }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plans" className="gap-1.5"><List className="h-3.5 w-3.5" /> Current Plans</TabsTrigger>
          <TabsTrigger value="build">{t('planBuilder.buildFromScratch')}</TabsTrigger>
          <TabsTrigger value="import">{t('planBuilder.importFile')}</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <CurrentPlansTab />
        </TabsContent>

        <TabsContent value="build" className="mt-4 space-y-4">
          <Card className="glass">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t('planBuilder.planName')}</Label>
                  <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="HYROX 12-Week Prep" />
                </div>
                <div className="space-y-2">
                  <Label>{t('planBuilder.totalWeeks')}</Label>
                  <Input type="number" min={1} max={52} value={weekCount} onChange={e => setWeekCount(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Assign athlete</Label>
                  <Select value={targetAthleteId} onValueChange={setSelectedAthleteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select athlete" />
                    </SelectTrigger>
                    <SelectContent>
                      {assigneeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.fullName}{option.id === user?.id ? ' (You)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {Array.from({ length: weekCount }, (_, i) => (
                  <Button key={i} variant={currentWeek === i + 1 ? 'default' : 'outline'} size="sm"
                    className={currentWeek === i + 1 ? 'gradient-hyrox' : ''}
                    onClick={() => setCurrentWeek(i + 1)}>W{i + 1}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">{t('planBuilder.weekSessions', { week: currentWeek })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((row, idx) => (
                <motion.div key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">#{idx + 1}</span>
                      <Badge variant="outline" className="text-[10px]">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][row.day - 1]}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(row.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">{t('schedule.day')}</Label>
                      <Select value={String(row.day)} onValueChange={v => updateRow(row.id, 'day', Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                            <SelectItem key={i} value={String(i + 1)}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('logSession.discipline')}</Label>
                      <Select value={row.discipline} onValueChange={v => updateRow(row.id, 'discipline', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {disciplineOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('planBuilder.sessionName')}</Label>
                      <Input className="h-8 text-xs" value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} placeholder="Tempo Run" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">{t('logSession.durationMin')}</Label>
                      <Input className="h-8 text-xs" type="number" value={row.duration} onChange={e => updateRow(row.id, 'duration', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('logSession.distanceKm')}</Label>
                      <Input className="h-8 text-xs" type="number" step="0.1" value={row.distance} onChange={e => updateRow(row.id, 'distance', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Intensity</Label>
                      <Select value={row.intensity} onValueChange={v => updateRow(row.id, 'intensity', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {intensityOptions.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Exercises */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1.5"><Dumbbell className="h-3 w-3" /> Exercises {row.exercises.length > 0 && <span className="text-muted-foreground">({row.exercises.length})</span>}</Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setPickerForRow(row.id)}>
                        <Plus className="h-3 w-3" /> Add Exercise
                      </Button>
                    </div>
                    {row.exercises.length > 0 && (
                      <div className="space-y-1">
                        {row.exercises.map((ex, eIdx) => {
                          const srInvalid = !ex.setsReps.trim() || !SETS_REPS_RE.test(ex.setsReps);
                          const loadInvalid = !!(ex.load && ex.load.trim()) && !LOAD_RE.test(ex.load!);
                          return (
                          <div key={eIdx} className="flex items-center gap-2 bg-muted/40 rounded-md px-2 py-1.5">
                            <span className="text-xs font-medium flex-1 truncate">{ex.exerciseName}</span>
                            <Input
                              className={`h-6 w-16 text-[10px] text-center px-1 ${srInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                              placeholder="3×10"
                              value={ex.setsReps}
                              onChange={e => updateExercise(row.id, eIdx, { setsReps: e.target.value })}
                              aria-invalid={srInvalid}
                              title={srInvalid ? 'Required. Examples: 3x10, 5x30s, AMRAP 10' : ''}
                            />
                            <Input
                              className={`h-6 w-16 text-[10px] text-center px-1 ${loadInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                              placeholder="load"
                              value={ex.load || ''}
                              onChange={e => updateExercise(row.id, eIdx, { load: e.target.value })}
                              aria-invalid={loadInvalid}
                              title={loadInvalid ? 'Examples: 60kg, 75%, BW, RPE 8' : ''}
                            />
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeExercise(row.id, eIdx)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Workout notes</Label>
                    <Textarea className="text-xs min-h-[40px]" rows={1} value={row.details} onChange={e => updateRow(row.id, 'details', e.target.value)} placeholder="Additional context, pacing, cues..." />
                  </div>
                </motion.div>
              ))}
              <Button variant="outline" className="w-full" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> {t('planBuilder.addSession')}
              </Button>

              <Dialog open={!!pickerForRow} onOpenChange={(open) => !open && setPickerForRow(null)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base"><Dumbbell className="h-4 w-4 text-primary" /> Add Exercise</DialogTitle>
                  </DialogHeader>
                  <ExercisePicker
                    orgId={currentOrg?.id}
                    onSelect={(ex) => {
                      if (pickerForRow) {
                        addExercise(pickerForRow, { exerciseId: ex.id, exerciseName: ex.name, setsReps: '' });
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Button className="w-full gradient-hyrox" size="lg" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('common.saving')}</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> {t('planBuilder.savePlan')}</>}
          </Button>
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <Card className="glass">
            <CardContent className="p-8 text-center space-y-4">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="font-display font-bold">{t('planBuilder.importFromSpreadsheet')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('planBuilder.importDesc')}</p>
              </div>
              <div className="max-w-xs mx-auto space-y-2">
                <Label className="text-xs text-muted-foreground">{t('planBuilder.planNameOptional')}</Label>
                <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder={t('planBuilder.autoDetected')} className="text-center" />
              </div>
              <Button className="gradient-hyrox" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? t('planBuilder.importing') : t('planBuilder.importBtn')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('planBuilder.importSheetsInfo')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
