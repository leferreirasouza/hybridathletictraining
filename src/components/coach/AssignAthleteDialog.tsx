import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssigned: () => void;
  existingAthleteIds: string[];
}

export default function AssignAthleteDialog({ open, onOpenChange, onAssigned, existingAthleteIds }: Props) {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [coachType, setCoachType] = useState<'primary' | 'secondary'>('primary');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      // Get coach's org
      const { data: roles } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);
      const oid = roles?.[0]?.organization_id;
      if (!oid) { setLoading(false); return; }
      setOrgId(oid);

      // Get all org members (potential athletes) — include self
      const { data: orgMembers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('organization_id', oid);
      if (!orgMembers?.length) { setLoading(false); return; }

      const memberIds = [...new Set(orgMembers.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds);

      // Filter out already-assigned athletes (to this coach)
      const available = (profiles || []).filter(p => !existingAthleteIds.includes(p.id));
      setCandidates(available);
      setLoading(false);
    })();
  }, [open, user, existingAthleteIds]);

  const handleSave = async () => {
    if (!selectedAthleteId || !orgId || !user) return;
    setSaving(true);
    const { error } = await supabase.from('coach_athlete_assignments').insert({
      organization_id: orgId,
      coach_id: user.id,
      athlete_id: selectedAthleteId,
      coach_type: coachType,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('primary') ? 'This athlete already has a primary coach' : error.message);
    } else {
      toast.success('Athlete assigned! ✅');
      setSelectedAthleteId('');
      onOpenChange(false);
      onAssigned();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Assign Athlete
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No unassigned athletes in your organization.</p>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Athlete</Label>
              <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
                <SelectTrigger><SelectValue placeholder="Select athlete..." /></SelectTrigger>
                <SelectContent>
                  {candidates.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name || 'Unnamed'} {c.id === user?.id ? '(You)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Coach type</Label>
              <Select value={coachType} onValueChange={v => setCoachType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-hyrox" onClick={handleSave} disabled={saving || !selectedAthleteId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
