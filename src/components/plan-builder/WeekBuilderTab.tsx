import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Loader2, Copy, Save, LayoutTemplate, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgPlans } from '@/hooks/useOrgPlans';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sessionDate, toMonday, inferStartMonday, toTemplateSession, type TemplateSession } from '@/lib/weekBuilder';

type Discipline = Database['public']['Enums']['discipline'];
type Intensity = Database['public']['Enums']['intensity_level'];
type Planned = Database['public']['Tables']['planned_sessions']['Row'];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DISCIPLINES: Discipline[] = ['run', 'bike', 'rowing', 'skierg', 'stairs', 'hyrox_station', 'strength', 'mobility', 'prehab', 'accessories', 'custom'];
const INTENSITIES: Intensity[] = ['easy', 'moderate', 'hard', 'race_pace', 'max_effort'];
const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

interface Draft {
  id?: string;
  day_of_week: number;
  discipline: Discipline;
  session_name: string;
  duration_min: string;
  distance_km: string;
  intensity: Intensity | '';
  workout_details: string;
  notes: string;
}

const nextMonday = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toMonday(d.toISOString().slice(0, 10));
};

export default function WeekBuilderTab() {
  const { user, currentOrg } = useAuth();
  const qc = useQueryClient();
  const { data: plans = [] } = useOrgPlans();
  const [planId, setPlanId] = useState('');
  const [week, setWeek] = useState(1);
  const [startMonday, setStartMonday] = useState(nextMonday());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  // new-plan form
  const [newName, setNewName] = useState('');
  const [newAthlete, setNewAthlete] = useState('');
  // toolbar dialogs
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState('');
  const [tplOpen, setTplOpen] = useState<'save' | 'apply' | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplPick, setTplPick] = useState('');

  const plan = plans.find((p) => p.id === planId);

  const { data: athletes = [] } = useQuery({
    queryKey: ['week-builder-athletes', currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('organization_id', currentOrg!.id).eq('role', 'athlete');
      const ids = [...new Set((roles || []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return (data || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
  });

  const { data: versionId } = useQuery({
    queryKey: ['week-builder-version', planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data } = await supabase.from('plan_versions').select('id').eq('plan_id', planId).order('version_number', { ascending: false }).limit(1).maybeSingle();
      return data?.id ?? null;
    },
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['week-builder-sessions', versionId],
    enabled: !!versionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('planned_sessions').select('*').eq('plan_version_id', versionId!).order('order_index');
      if (error) throw error;
      return data as Planned[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['week-templates', currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data } = await supabase.from('week_templates').select('id, name, sessions').eq('organization_id', currentOrg!.id).order('created_at', { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    const inferred = inferStartMonday(sessions);
    if (inferred) setStartMonday(inferred);
  }, [sessions]);
  useEffect(() => setWeek(1), [planId]);

  const maxWeek = Math.max(1, ...sessions.map((s) => s.week_number));
  const weekSessions = useMemo(() => sessions.filter((s) => s.week_number === week), [sessions, week]);
  const athleteId = plan?.assignedAthleteId ?? sessions.find((s) => s.athlete_id)?.athlete_id ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['week-builder-sessions'] });
    qc.invalidateQueries({ queryKey: ['planned-sessions'] });
    qc.invalidateQueries({ queryKey: ['org-plans'] });
  };

  const rowFor = (s: TemplateSession, w: number, idx: number) => ({
    ...toTemplateSession(s),
    discipline: s.discipline as Discipline,
    intensity: (s.intensity || null) as Intensity | null,
    plan_version_id: versionId!,
    athlete_id: athleteId,
    week_number: w,
    date: sessionDate(startMonday, w, s.day_of_week),
    order_index: idx,
  });

  const createPlan = async () => {
    if (!user || !currentOrg) return;
    if (!newName.trim() || !newAthlete) { toast.error('Add a plan name and pick an athlete'); return; }
    setBusy(true);
    try {
      const { data: p, error } = await supabase.from('training_plans')
        .insert({ name: newName.trim(), organization_id: currentOrg.id, created_by: user.id, source: 'manual' }).select().single();
      if (error) throw error;
      const { data: v, error: vErr } = await supabase.from('plan_versions')
        .insert({ plan_id: p.id, version_number: 1, created_by: user.id }).select().single();
      if (vErr) throw vErr;
      // Placeholder rest-free marker isn't needed; assignment is carried on each session.
      pendingAthlete[v.id] = newAthlete;
      await qc.invalidateQueries({ queryKey: ['org-plans'] });
      setPlanId(p.id);
      setNewName('');
      toast.success('Plan created — add sessions to week 1');
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const effectiveAthlete = athleteId ?? (versionId ? pendingAthlete[versionId] : null) ?? null;

  const saveDraft = async () => {
    if (!draft || !versionId) return;
    if (!draft.session_name.trim()) { toast.error('Give the session a name'); return; }
    if (!effectiveAthlete) { toast.error('This plan has no athlete yet — assign one in Current Plans'); return; }
    setBusy(true);
    const payload = {
      day_of_week: draft.day_of_week,
      discipline: draft.discipline,
      session_name: draft.session_name.trim(),
      duration_min: draft.duration_min ? Number(draft.duration_min) : null,
      distance_km: draft.distance_km ? Number(draft.distance_km) : null,
      intensity: (draft.intensity || null) as Intensity | null,
      workout_details: draft.workout_details || null,
      notes: draft.notes || null,
      date: sessionDate(startMonday, week, draft.day_of_week),
    };
    const { error } = draft.id
      ? await supabase.from('planned_sessions').update(payload).eq('id', draft.id)
      : await supabase.from('planned_sessions').insert({ ...payload, plan_version_id: versionId, athlete_id: effectiveAthlete, week_number: week, order_index: weekSessions.length });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setDraft(null);
    refresh();
  };

  const deleteDraft = async () => {
    if (!draft?.id) return;
    const { error } = await supabase.from('planned_sessions').delete().eq('id', draft.id);
    if (error) { toast.error(error.message); return; }
    setDraft(null);
    refresh();
  };

  const insertWeek = async (source: TemplateSession[], targetWeeks: number[]) => {
    if (!versionId || !effectiveAthlete) { toast.error('This plan has no athlete yet'); return false; }
    const rows = targetWeeks.flatMap((w) => source.map((s, i) => ({ ...rowFor(s, w, i), athlete_id: effectiveAthlete })));
    if (!rows.length) { toast.error('Nothing to copy — this week is empty'); return false; }
    const { error } = await supabase.from('planned_sessions').insert(rows);
    if (error) { toast.error(error.message); return false; }
    refresh();
    return true;
  };

  const doCopy = async () => {
    const targets = [...new Set(copyTargets.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 52 && n !== week))];
    if (!targets.length) { toast.error('Enter week numbers, e.g. 2, 3, 4'); return; }
    setBusy(true);
    const ok = await insertWeek(weekSessions as unknown as TemplateSession[], targets);
    setBusy(false);
    if (ok) { toast.success(`Week ${week} copied to week ${targets.join(', ')}`); setCopyOpen(false); setCopyTargets(''); }
  };

  const saveTemplate = async () => {
    if (!user || !currentOrg || !tplName.trim()) return;
    if (!weekSessions.length) { toast.error('This week is empty'); return; }
    const { error } = await supabase.from('week_templates').insert({
      organization_id: currentOrg.id, created_by: user.id, name: tplName.trim(),
      sessions: weekSessions.map((s) => toTemplateSession(s as unknown as TemplateSession)) as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Week saved as a template');
    qc.invalidateQueries({ queryKey: ['week-templates'] });
    setTplOpen(null); setTplName('');
  };

  const applyTemplate = async () => {
    const tpl = templates.find((t) => t.id === tplPick);
    if (!tpl) return;
    setBusy(true);
    const ok = await insertWeek(tpl.sessions as unknown as TemplateSession[], [week]);
    setBusy(false);
    if (ok) { toast.success(`"${tpl.name}" added to week ${week}`); setTplOpen(null); setTplPick(''); }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('week_templates').delete().eq('id', id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ['week-templates'] });
  };

  const openNew = (day: number) => setDraft({ day_of_week: day, discipline: 'run', session_name: '', duration_min: '', distance_km: '', intensity: '', workout_details: '', notes: '' });
  const openEdit = (s: Planned) => setDraft({
    id: s.id, day_of_week: s.day_of_week, discipline: s.discipline, session_name: s.session_name,
    duration_min: s.duration_min?.toString() ?? '', distance_km: s.distance_km?.toString() ?? '',
    intensity: s.intensity ?? '', workout_details: s.workout_details ?? '', notes: s.notes ?? '',
  });

  const activePlans = plans.filter((p) => p.isActive);

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2"><CardTitle className="text-base font-display">Plan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger><SelectValue placeholder="Pick a plan to edit" /></SelectTrigger>
            <SelectContent>
              {activePlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!planId && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Or start a new plan by hand</p>
              <Input placeholder="Plan name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Select value={newAthlete} onValueChange={setNewAthlete}>
                <SelectTrigger><SelectValue placeholder="Athlete" /></SelectTrigger>
                <SelectContent>
                  {athletes.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || 'Unnamed athlete'}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">First week starts (Monday)</Label>
                  <Input type="date" value={startMonday} onChange={(e) => e.target.value && setStartMonday(toMonday(e.target.value))} />
                </div>
                <Button onClick={createPlan} disabled={busy} className="gap-1.5"><Plus className="h-4 w-4" /> Create</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {planId && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" disabled={week <= 1} onClick={() => setWeek(week - 1)} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-center">
              <p className="font-display font-bold">Week {week}</p>
              <p className="text-[11px] text-muted-foreground">{sessionDate(startMonday, week, 1)} → {sessionDate(startMonday, week, 7)}</p>
            </div>
            <Button variant="ghost" size="icon" disabled={week > maxWeek} onClick={() => setWeek(week + 1)} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCopyOpen(true)}><Copy className="h-3.5 w-3.5" /> Copy week</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTplOpen('save')}><Save className="h-3.5 w-3.5" /> Save as template</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTplOpen('apply')}><LayoutTemplate className="h-3.5 w-3.5" /> Use template</Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {DAYS.map((d, i) => {
                const day = i + 1;
                const list = weekSessions.filter((s) => s.day_of_week === day);
                return (
                  <Card key={d} className="glass">
                    <CardContent className="p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold">{d} <span className="font-normal text-muted-foreground">{sessionDate(startMonday, week, day).slice(5)}</span></p>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openNew(day)} aria-label={`Add session ${d}`}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                      {list.length === 0 && <p className="text-[11px] text-muted-foreground">Rest</p>}
                      {list.map((s) => (
                        <button key={s.id} onClick={() => openEdit(s)} className="w-full text-left rounded-md border border-border/60 bg-muted/30 hover:border-primary/50 px-2 py-1.5">
                          <p className="text-xs font-medium truncate">{s.session_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {label(s.discipline)}{s.distance_km ? ` · ${s.distance_km} km` : ''}{s.duration_min ? ` · ${s.duration_min} min` : ''}
                          </p>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Changes save straight away and show on the athlete's dashboard and schedule.</p>
        </>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? 'Edit session' : 'New session'}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Input placeholder="Session name" value={draft.session_name} onChange={(e) => setDraft({ ...draft, session_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={String(draft.day_of_week)} onValueChange={(v) => setDraft({ ...draft, day_of_week: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={draft.discipline} onValueChange={(v) => setDraft({ ...draft, discipline: v as Discipline })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{label(d)}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min={0} placeholder="Minutes" value={draft.duration_min} onChange={(e) => setDraft({ ...draft, duration_min: e.target.value })} />
                <Input type="number" min={0} step="0.1" placeholder="Km" value={draft.distance_km} onChange={(e) => setDraft({ ...draft, distance_km: e.target.value })} />
              </div>
              <Select value={draft.intensity || 'none'} onValueChange={(v) => setDraft({ ...draft, intensity: v === 'none' ? '' : (v as Intensity) })}>
                <SelectTrigger><SelectValue placeholder="Intensity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No intensity</SelectItem>
                  {INTENSITIES.map((d) => <SelectItem key={d} value={d}>{label(d)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea placeholder="Workout details" value={draft.workout_details} onChange={(e) => setDraft({ ...draft, workout_details: e.target.value })} />
              <Textarea placeholder="Notes for the athlete" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          )}
          <DialogFooter className="gap-2">
            {draft?.id && <Button variant="destructive" onClick={deleteDraft} className="gap-1.5"><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button onClick={saveDraft} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copy week {week}</DialogTitle></DialogHeader>
          <Label className="text-xs">To weeks (e.g. 2, 3, 4)</Label>
          <Input value={copyTargets} onChange={(e) => setCopyTargets(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Sessions are added alongside anything already in those weeks.</p>
          <DialogFooter><Button onClick={doCopy} disabled={busy}>Copy</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tplOpen} onOpenChange={(o) => !o && setTplOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tplOpen === 'save' ? `Save week ${week} as a template` : `Add a template to week ${week}`}</DialogTitle></DialogHeader>
          {tplOpen === 'save' ? (
            <>
              <Input placeholder="Template name, e.g. Base week" value={tplName} onChange={(e) => setTplName(e.target.value)} />
              <DialogFooter><Button onClick={saveTemplate}>Save template</Button></DialogFooter>
            </>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet. Build a week, then press "Save as template".</p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-72 overflow-auto">
                {templates.map((t) => (
                  <div key={t.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${tplPick === t.id ? 'border-primary' : 'border-border/60'}`}>
                    <button className="flex-1 text-left" onClick={() => setTplPick(t.id)}>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{(t.sessions as unknown[]).length} sessions</p>
                    </button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTemplate(t.id)} aria-label="Delete template"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <DialogFooter><Button onClick={applyTemplate} disabled={!tplPick || busy}>Add to week {week}</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Athlete chosen at plan creation, kept until the first session carries it.
const pendingAthlete: Record<string, string> = {};
