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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Search, Check, X, Trash2, Loader2, Globe, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SLOT_TYPES = ['run', 'strength', 'mobility_technique', 'hyrox'] as const;
const INTENSITIES = ['easy', 'moderate', 'hard', 'race_pace', 'max_effort'] as const;
const DISCIPLINES = ['run', 'bike', 'stairs', 'rowing', 'skierg', 'mobility', 'strength', 'accessories', 'hyrox_station', 'prehab', 'custom'] as const;
const SUBTYPES: Record<string, string[]> = {
  run: ['easy', 'tempo', 'interval', 'long', 'fartlek'],
  strength: ['lower', 'upper', 'full_body', 'posterior', 'power', 'core'],
  mobility_technique: ['mobility', 'skill_drill', 'rehab', 'run_mechanics'],
  hyrox: ['brick', 'station_endurance', 'erg', 'simulation'],
};

type LibraryRow = {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  discipline: string;
  slot_type: string;
  subtype: string | null;
  intensity: string;
  objective: string;
  execution: string;
  progression: string | null;
  contraindications: string | null;
  rationale: string;
  evidence_refs: string[];
  status: string;
  is_approved: boolean;
  created_by: string | null;
};

const emptyForm = {
  code: '',
  name: '',
  discipline: 'run',
  slot_type: 'run',
  subtype: 'easy',
  intensity: 'easy',
  objective: '',
  execution: '',
  progression: '',
  contraindications: '',
  rationale: '',
};

/**
 * Session library: the catalogue generate-plan picks from. Global entries
 * are read-only here; coaches add org entries (pending), org admins approve.
 * Role checks below only shape the UI — RLS on session_library enforces them.
 */
export default function SessionLibraryTab() {
  const { t } = useTranslation();
  const { user, currentOrg, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isStaff = !!effectiveRole && ['coach', 'admin', 'master_admin'].includes(effectiveRole);
  const isAdmin = !!effectiveRole && ['admin', 'master_admin'].includes(effectiveRole);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['session-library', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_library' as any)
        .select('*')
        .order('slot_type')
        .order('code');
      if (error) throw error;
      // RLS may also return rows of other orgs the user staffs; show this org's.
      return ((data as unknown as LibraryRow[]) || []).filter(
        (e) => e.organization_id === null || e.organization_id === currentOrg?.id,
      );
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['session-library'] });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !currentOrg) throw new Error('no_org');
      const { error } = await supabase.from('session_library' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        discipline: form.discipline,
        slot_type: form.slot_type,
        subtype: form.subtype || null,
        intensity: form.intensity,
        objective: form.objective.trim(),
        execution: form.execution.trim(),
        progression: form.progression.trim() || null,
        contraindications: form.contraindications.trim() || null,
        rationale: form.rationale.trim(),
        status: 'new',
        is_approved: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('sessionLibrary.submitted'));
      setDialogOpen(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: () => toast.error(t('sessionLibrary.saveFailed')),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from('session_library' as any).update({ is_approved: approved }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('sessionLibrary.saveFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('session_library' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error(t('sessionLibrary.saveFailed')),
  });

  const q = search.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (slotFilter !== 'all' && e.slot_type !== slotFilter) return false;
    if (!q) return true;
    return [e.code, e.name, e.objective, e.subtype ?? ''].some((v) => v.toLowerCase().includes(q));
  });
  const pending = entries.filter((e) => !e.is_approved).length;

  const formValid =
    /^[A-Z0-9_]{3,40}$/.test(form.code.trim().toUpperCase()) &&
    form.name.trim() && form.objective.trim() && form.execution.trim() && form.rationale.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold">{t('sessionLibrary.title')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('sessionLibrary.subtitle', { total: entries.length, pending })}
          </p>
        </div>
        {isStaff && currentOrg && (
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setForm(emptyForm); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t('sessionLibrary.add')}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>{t('sessionLibrary.addTitle')}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3 pb-4">
                  <p className="text-xs text-muted-foreground">{t('sessionLibrary.addHint')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t('sessionLibrary.code')}</Label>
                      <Input value={form.code} placeholder="CLUB_TEMPO_3X10" onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('sessionLibrary.name')}</Label>
                      <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t('sessionLibrary.slotType')}</Label>
                      <Select value={form.slot_type} onValueChange={(v) => setForm((f) => ({ ...f, slot_type: v, subtype: SUBTYPES[v]?.[0] ?? '' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SLOT_TYPES.map((s) => <SelectItem key={s} value={s}>{t(`sessionLibrary.slot_${s}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('sessionLibrary.subtype')}</Label>
                      <Select value={form.subtype} onValueChange={(v) => setForm((f) => ({ ...f, subtype: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{(SUBTYPES[form.slot_type] ?? []).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t('sessionLibrary.discipline')}</Label>
                      <Select value={form.discipline} onValueChange={(v) => setForm((f) => ({ ...f, discipline: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('sessionLibrary.intensity')}</Label>
                      <Select value={form.intensity} onValueChange={(v) => setForm((f) => ({ ...f, intensity: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{INTENSITIES.map((i) => <SelectItem key={i} value={i}>{i.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(['objective', 'execution', 'progression', 'contraindications', 'rationale'] as const).map((field) => (
                    <div key={field}>
                      <Label className="text-xs">{t(`sessionLibrary.${field}`)}{['objective', 'execution', 'rationale'].includes(field) ? ' *' : ''}</Label>
                      <Textarea rows={field === 'execution' ? 3 : 2} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                  <Button className="w-full" disabled={!formValid || addMutation.isPending} onClick={() => addMutation.mutate()}>
                    {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {t('sessionLibrary.submit')}
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t('sessionLibrary.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={slotFilter} onValueChange={setSlotFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sessionLibrary.allSlots')}</SelectItem>
            {SLOT_TYPES.map((s) => <SelectItem key={s} value={s}>{t(`sessionLibrary.slot_${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const isGlobal = e.organization_id === null;
            const canDelete = !isGlobal && (isAdmin || (e.created_by === user?.id && !e.is_approved));
            const open = expanded === e.id;
            return (
              <Card key={e.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left flex-1" onClick={() => setExpanded(open ? null : e.id)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold">{e.name}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">{e.code}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <Badge variant="outline" className="text-[10px]">{t(`sessionLibrary.slot_${e.slot_type}`)}{e.subtype ? ` · ${e.subtype.replace(/_/g, ' ')}` : ''}</Badge>
                      <Badge variant="outline" className="text-[10px]">{e.intensity.replace(/_/g, ' ')}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{t(`sessionLibrary.status_${e.status}`, { defaultValue: e.status })}</Badge>
                      {isGlobal ? (
                        <Badge variant="outline" className="text-[10px]"><Globe className="h-2.5 w-2.5 mr-0.5" />{t('sessionLibrary.global')}</Badge>
                      ) : !e.is_approved && (
                        <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">{t('sessionLibrary.pending')}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{e.objective}</p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isGlobal && isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={e.is_approved ? t('sessionLibrary.unapprove') : t('sessionLibrary.approve')}
                        onClick={() => approveMutation.mutate({ id: e.id, approved: !e.is_approved })}>
                        {e.is_approved ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-primary" />}
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {open && (
                  <div className="mt-3 space-y-2 text-xs">
                    {([
                      ['execution', e.execution],
                      ['progression', e.progression],
                      ['contraindications', e.contraindications],
                      ['rationale', e.rationale],
                    ] as const).map(([k, v]) => v && (
                      <div key={k}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t(`sessionLibrary.${k}`)}</p>
                        <p>{v}</p>
                      </div>
                    ))}
                    {e.evidence_refs?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('sessionLibrary.evidence')}</p>
                        <ul className="list-disc pl-4 text-muted-foreground">{e.evidence_refs.map((r) => <li key={r}>{r}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('sessionLibrary.empty')}</p>}
        </div>
      )}
    </div>
  );
}
