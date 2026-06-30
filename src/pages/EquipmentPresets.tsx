import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Plus, Save, Trash2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'fartlek'] as const;
type RunType = typeof RUN_TYPES[number];

const EQUIPMENT_OPTIONS = [
  'barbell', 'dumbbells', 'kettlebell', 'sled', 'ski erg', 'rower',
  'assault bike', 'wall ball', 'sandbag', 'pull-up bar', 'box', 'none',
];

const DEFAULT_WEIGHTS: Record<RunType, number> = {
  easy: 0.6, tempo: 0.15, interval: 0.1, long: 0.15, fartlek: 0,
};

interface Preset {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  equipment: Record<string, boolean>;
  run_type_weights: Record<RunType, number>;
}

interface DraftState {
  id?: string;
  name: string;
  description: string;
  equipment: Record<string, boolean>;
  weights: Record<RunType, number>;
}

const emptyDraft = (): DraftState => ({
  name: '',
  description: '',
  equipment: {},
  weights: { ...DEFAULT_WEIGHTS },
});

export default function EquipmentPresets() {
  const navigate = useNavigate();
  const { user, currentOrg, effectiveRole } = useAuth();
  const canManage = effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('equipment_presets')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name', { ascending: true });
    if (error) toast.error('Failed to load presets');
    else setPresets((data || []) as Preset[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const weightsSum = useMemo(
    () => draft ? Math.round(RUN_TYPES.reduce((s, k) => s + (draft.weights[k] || 0), 0) * 100) : 0,
    [draft]
  );

  const equipmentSelected = useMemo(
    () => draft ? Object.keys(draft.equipment).filter((k) => draft.equipment[k]) : [],
    [draft]
  );

  const draftError = (): string | null => {
    if (!draft) return null;
    if (!draft.name.trim()) return 'Name is required.';
    if (equipmentSelected.length === 0) return 'Pick at least one equipment option ("none" if no equipment).';
    if (equipmentSelected.includes('none') && equipmentSelected.length > 1) {
      return 'If "none" is selected, no other equipment can be selected.';
    }
    if (weightsSum !== 100) return `Run type weights must total 100% (currently ${weightsSum}%).`;
    return null;
  };

  const startNew = () => setDraft(emptyDraft());
  const startEdit = (p: Preset) =>
    setDraft({
      id: p.id,
      name: p.name,
      description: p.description || '',
      equipment: { ...(p.equipment || {}) },
      weights: { ...DEFAULT_WEIGHTS, ...(p.run_type_weights || {}) },
    });

  const onSave = async () => {
    if (!draft || !user || !currentOrg) return;
    const err = draftError();
    if (err) { toast.error(err); return; }
    setSaving(true);
    const payload = {
      organization_id: currentOrg.id,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      equipment: draft.equipment,
      run_type_weights: draft.weights,
      created_by: user.id,
    };
    const q = draft.id
      ? (supabase as any).from('equipment_presets').update(payload).eq('id', draft.id)
      : (supabase as any).from('equipment_presets').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message?.includes('duplicate') ? 'A preset with that name already exists.' : (error.message || 'Save failed'));
      return;
    }
    toast.success('Preset saved');
    setDraft(null);
    load();
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this preset?')) return;
    const { error } = await (supabase as any).from('equipment_presets').delete().eq('id', id);
    if (error) toast.error(error.message || 'Delete failed');
    else { toast.success('Preset deleted'); load(); }
  };

  if (!canManage) {
    return (
      <div className="container max-w-2xl py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Only coaches and admins can manage equipment presets.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Equipment Presets</h1>
          <p className="text-sm text-muted-foreground">
            Create reusable equipment + run-mix presets your athletes can apply with one click.
          </p>
        </div>
        {!draft && (
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" /> New preset
          </Button>
        )}
      </div>

      {draft && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{draft.id ? 'Edit preset' : 'New preset'}</CardTitle>
              <CardDescription>Define equipment and a run-type mix athletes can apply.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDraft(null)} aria-label="Cancel">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Name</Label>
              <Input
                id="preset-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Home gym, Full HYROX setup"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-desc">Description (optional)</Label>
              <Textarea
                id="preset-desc"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="When to use this preset"
                maxLength={300}
              />
            </div>

            <div>
              <Label>Equipment</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                {EQUIPMENT_OPTIONS.map((e) => (
                  <label key={e} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!!draft.equipment[e]}
                      onCheckedChange={(c) =>
                        setDraft({ ...draft, equipment: { ...draft.equipment, [e]: !!c } })
                      }
                    />
                    <span className="text-sm capitalize">{e}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Run type mix</Label>
              {RUN_TYPES.map((k) => {
                const pct = Math.round((draft.weights[k] || 0) * 100);
                return (
                  <div key={k} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="capitalize text-sm">{k}</span>
                      <Badge variant="secondary">{pct}%</Badge>
                    </div>
                    <Slider
                      min={0} max={100} step={5}
                      value={[pct]}
                      onValueChange={(v) =>
                        setDraft({ ...draft, weights: { ...draft.weights, [k]: v[0] / 100 } })
                      }
                      aria-label={`${k} weight`}
                    />
                  </div>
                );
              })}
              <p className={`text-sm ${weightsSum === 100 ? 'text-muted-foreground' : 'text-destructive'}`}>
                Total: {weightsSum}% {weightsSum !== 100 && '(must equal 100%)'}
              </p>
            </div>

            {draftError() && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{draftError()}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
              <Button onClick={onSave} disabled={saving || !!draftError()}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save preset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : presets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No presets yet. Create one to give athletes a one-click setup.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {presets.map((p) => {
            const eqList = Object.keys(p.equipment || {}).filter((k) => p.equipment[k]);
            return (
              <Card key={p.id}>
                <CardContent className="py-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{p.name}</div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {eqList.slice(0, 8).map((e) => (
                        <Badge key={e} variant="secondary" className="capitalize">{e}</Badge>
                      ))}
                      {eqList.length > 8 && (
                        <Badge variant="outline">+{eqList.length - 8}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
