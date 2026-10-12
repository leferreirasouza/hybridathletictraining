import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { logAudit } from '@/lib/auditLog';

// Display + confirm only. Suggestions are created by hand-reviewed server
// logic; nothing here decides what to change — it never modifies a plan
// unless a coach presses Accept.


function change(label: string, from: unknown, to: unknown, unit = '') {
  if (to == null || from === to) return null;
  return `${label} ${from ?? '—'}${unit} → ${to}${unit}`;
}

export default function PlanSuggestions({ sessions }: { sessions: { id: string; session_name: string }[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ids = sessions.map((s) => s.id);

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
  const nameOf = (id: string) => sessions.find((s) => s.id === id)?.session_name ?? t('planSuggest.session');
  const done = () => {
    qc.invalidateQueries({ queryKey: ['plan-suggestions'] });
    qc.invalidateQueries({ queryKey: ['planned-sessions'] });
    qc.invalidateQueries({ queryKey: ['coach-pending-periodization-adjustments'] });
  };

  const respond = async (a: any, accept: boolean) => {
    const { error } = await supabase.rpc('respond_to_plan_suggestion' as any, { _adjustment_id: a.id, _accept: accept });
    if (error) { toast.error(t('planSuggest.failed') + error.message); return; }
    logAudit(accept ? 'periodization.approved' : 'periodization.rejected', 'periodization_adjustment', a.id, { adjustment_type: a.adjustment_type });
    toast.success(accept ? t('planSuggest.updated') : t('planSuggest.dismissed'));
    done();
  };
  const reasonLabel = (k: string) => t(`planSuggest.r_${k}`, { defaultValue: k.replace(/_/g, ' ') });

  return (
    <div className="space-y-2">
      {items.map((a) => {
        const changes = [
          change(t('planSuggest.intensity'), a.original_intensity, a.suggested_intensity),
          change(t('planSuggest.time'), a.original_duration_min, a.suggested_duration_min, ' min'),
          change(t('planSuggest.distance'), a.original_distance_km, a.suggested_distance_km, ' km'),
        ].filter(Boolean);
        return (
          <div key={a.id} className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-bold flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" /> {t('planSuggest.title')} · {reasonLabel(a.adjustment_type)}
            </p>
            <p className="text-sm font-medium">{nameOf(a.target_session_id)}</p>
            {changes.length > 0 && <p className="text-xs text-muted-foreground">{changes.join(' · ')}</p>}
            {a.reason_details && <p className="text-xs text-muted-foreground">{a.reason_details}</p>}
            <div className="flex gap-2">
              <Button size="sm" className="gap-1" onClick={() => respond(a, true)}><Check className="h-3.5 w-3.5" /> {t('planSuggest.accept')}</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => respond(a, false)}><X className="h-3.5 w-3.5" /> {t('planSuggest.dismiss')}</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
