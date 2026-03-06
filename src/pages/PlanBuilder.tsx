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
import { Plus, Upload, FileSpreadsheet, Trash2, Loader2, CheckCircle2, List, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import ExcelJS from 'exceljs';
import AthletePlanForm from '@/components/AthletePlanForm';
import { useTranslation } from 'react-i18next';

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

interface SessionRow {
  id: string;
  day: number;
  discipline: Discipline;
  name: string;
  duration: string;
  distance: string;
  intensity: Intensity | '';
  details: string;
  notes: string;
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
});

function CurrentPlansTab() {
  const { t } = useTranslation();
  const { currentOrg } = useAuth();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['org-plans', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, name, description, is_template, source, created_at, archived_at, created_by')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Fetch session counts per plan
      const planIds = (data || []).map(p => p.id);
      if (planIds.length === 0) return [];
      const { data: versions } = await supabase
        .from('plan_versions')
        .select('id, plan_id')
        .in('plan_id', planIds);
      const versionMap = new Map<string, string[]>();
      (versions || []).forEach(v => {
        const arr = versionMap.get(v.plan_id) || [];
        arr.push(v.id);
        versionMap.set(v.plan_id, arr);
      });
      return (data || []).map(p => ({
        ...p,
        isActive: !p.archived_at,
        versionCount: versionMap.get(p.id)?.length || 0,
      }));
    },
    enabled: !!currentOrg?.id,
  });

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
    // Delete plan versions, sessions, etc. cascade via FK
    const { error } = await supabase.from('training_plans').delete().eq('id', planId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Plan deleted permanently');
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
      {plans.map(plan => (
        <Card key={plan.id} className={`glass transition-opacity ${!plan.isActive ? 'opacity-60' : ''}`}>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      ))}
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

  const addRow = () => setSessions(prev => [...prev, emptyRow()]);
  const removeRow = (id: string) => setSessions(prev => prev.filter(s => s.id !== id));
  const updateRow = (id: string, field: keyof SessionRow, value: string | number) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (!planName.trim()) { toast.error('Please enter a plan name'); return; }
    if (!user || !currentOrg) { toast.error('No org context'); return; }
    if (!targetAthleteId) { toast.error('Please select an athlete'); return; }
    if (!targetAthleteId) { toast.error('Please select an athlete'); return; }
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
        rows.filter(r => r.name.trim()).map((r, idx) => ({
            plan_version_id: version.id,
            athlete_id: targetAthleteId,
            week_number: Number(week),
          day_of_week: r.day,
          discipline: r.discipline as Discipline,
          session_name: r.name.trim(),
          duration_min: r.duration ? parseFloat(r.duration) : null,
          distance_km: r.distance ? parseFloat(r.distance) : null,
          intensity: (r.intensity || null) as Intensity | null,
          workout_details: r.details || null,
          notes: r.notes || null,
          order_index: idx,
        }))
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
              <Button className="gradient-hyrox" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? t('planBuilder.importing') : t('planBuilder.importBtn')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="page-container py-6 space-y-5">
        <h1 className="text-xl font-display font-bold">{t('planBuilder.createYourPlan')}</h1>
        <AthletePlanForm />
      </div>
    );
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('planBuilder.session')} {idx + 1}</span>
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
                  <div>
                    <Label className="text-xs">{t('planBuilder.workoutDetails')}</Label>
                    <Textarea className="text-xs min-h-[40px]" rows={1} value={row.details} onChange={e => updateRow(row.id, 'details', e.target.value)} placeholder="8km @ 5:00/km..." />
                  </div>
                </motion.div>
              ))}
              <Button variant="outline" className="w-full" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> {t('planBuilder.addSession')}
              </Button>
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
