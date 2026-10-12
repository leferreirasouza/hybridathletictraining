import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lightbulb, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { logAudit } from '@/lib/auditLog';

// Display + confirm only. Suggestions are created by hand-reviewed server
// logic; nothing here decides what to change — it never modifies a plan
// unless a coach presses Accept.

const REASON: Record<string, string> = {
  missed_session: 'Missed session',
  harder_than_planned: 'Harder than planned',
  tsb_fatigue: 'High fatigue',
  interference: 'Training clash',
};
const reasonLabel = (t: string) => REASON[t] ?? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function change(label: string, from: unknown, to: unknown, unit = '') {
  if (to == null || from === to) return null;
  return `${label} ${from ?? '—'}${unit} → ${to}${unit}`;
}

export default function PlanSuggestions({ sessions }: { sessions: { id: string; session_name: string }[] }) {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();
  const ids = sessions.map((s) => s.id);
  const canRespond = effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin';

  const { data: items = [] } = useQuery({
    queryKey: ['plan-suggestions', ids.length, ids[0]],
    enabled: ids.length > 0,
    queryFn: async () => {
      const out: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('periodization_adjustments').select('*')
          .in('target_session_id', ids.slice(i, i + 200)).eq('status', 'pending_coach');
        out.push(...(data || []));
      }
      return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
  });

  if (!items.length) return null;
  const nameOf = (id: string) => sessions.find((s) => s.id === id)?.session_name ?? 'Session';
  const done = () => {
    qc.invalidateQueries({ queryKey: ['plan-suggestions'] });
    qc.invalidateQueries({ queryKey: ['planned-sessions'] });
    qc.invalidateQueries({ queryKey: ['coach-pending-periodization-adjustments'] });
  };

  const accept = async (a: any) => {
    const { error: e1 } = await supabase.from('planned_sessions').update({
      intensity: a.suggested_intensity ?? a.original_intensity,
      duration_min: a.suggested_duration_min ?? a.original_duration_min,
      distance_km: a.suggested_distance_km ?? a.original_distance_km,
    }).eq('id', a.target_session_id);
    if (e1) { toast.error('Could not change the session: ' + e1.message); return; }
    const { error } = await supabase.from('periodization_adjustments').update({ status: 'active' }).eq('id', a.id);
    if (error) { toast.error(error.message); return; }
    logAudit('periodization.approved', 'periodization_adjustment', a.id, { adjustment_type: a.adjustment_type });
    toast.success('Plan updated');
    done();
  };

  const dismiss = async (a: any) => {
    const { error } = await supabase.from('periodization_adjustments').update({ status: 'cancelled' }).eq('id', a.id);
    if (error) { toast.error(error.message); return; }
    logAudit('periodization.rejected', 'periodization_adjustment', a.id, { adjustment_type: a.adjustment_type });
    toast.success('Suggestion dismissed');
    done();
  };

  return (
    <div className="space-y-2">
      {items.map((a) => {
        const changes = [
          change('Intensity', a.original_intensity, a.suggested_intensity),
          change('Time', a.original_duration_min, a.suggested_duration_min, ' min'),
          change('Distance', a.original_distance_km, a.suggested_distance_km, ' km'),
        ].filter(Boolean);
        return (
          <div key={a.id} className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-bold flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" /> Suggested change · {reasonLabel(a.adjustment_type)}
            </p>
            <p className="text-sm font-medium">{nameOf(a.target_session_id)}</p>
            {changes.length > 0 && <p className="text-xs text-muted-foreground">{changes.join(' · ')}</p>}
            {a.reason_details && <p className="text-xs text-muted-foreground">{a.reason_details}</p>}
            {canRespond ? (
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={() => accept(a)}><Check className="h-3.5 w-3.5" /> Accept</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => dismiss(a)}><X className="h-3.5 w-3.5" /> Dismiss</Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Waiting for your coach to confirm.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
