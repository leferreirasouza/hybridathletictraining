import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Check, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLog';

const adjustmentTypeLabels: Record<string, string> = {
  interference_spacing: 'Concurrent-training conflict',
  tsb_intensity_reduction: 'Fatigue-driven reduction',
  tsb_volume_reduction: 'Fatigue-driven reduction',
};

export default function PeriodizationAdjustmentsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingAdjustments, isLoading } = useQuery({
    queryKey: ['coach-pending-periodization-adjustments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: assignments } = await supabase
        .from('coach_athlete_assignments')
        .select('athlete_id')
        .eq('coach_id', user.id);
      if (!assignments?.length) return [];
      const athleteIds = assignments.map(a => a.athlete_id);
      const { data, error } = await supabase
        .from('periodization_adjustments')
        .select('*')
        .in('athlete_id', athleteIds)
        .eq('status', 'pending_coach')
        .order('created_at', { ascending: false });
      if (error) return [];
      const enriched = await Promise.all((data || []).map(async (adj) => {
        const [profileRes, sessionRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', adj.athlete_id).single(),
          supabase.from('planned_sessions').select('session_name, discipline').eq('id', adj.target_session_id).single(),
        ]);
        return { ...adj, athlete_name: profileRes.data?.full_name || 'Unknown', target_session: sessionRes.data };
      }));
      return enriched;
    },
    enabled: !!user?.id,
  });

  const handleApprove = async (adj: any) => {
    const { error: sessionErr } = await supabase
      .from('planned_sessions')
      .update({
        intensity: adj.suggested_intensity,
        duration_min: adj.suggested_duration_min,
        distance_km: adj.suggested_distance_km,
      })
      .eq('id', adj.target_session_id);
    if (sessionErr) { toast.error('Failed to apply adjustment: ' + sessionErr.message); return; }

    const { error } = await supabase
      .from('periodization_adjustments')
      .update({ status: 'active' })
      .eq('id', adj.id);
    if (error) { toast.error('Failed to approve: ' + error.message); return; }

    logAudit('periodization.approved', 'periodization_adjustment', adj.id, { adjustment_type: adj.adjustment_type });
    toast.success('Adjustment approved ✅');
    queryClient.invalidateQueries({ queryKey: ['coach-pending-periodization-adjustments'] });
  };

  const handleReject = async (adj: any) => {
    const { error } = await supabase
      .from('periodization_adjustments')
      .update({ status: 'cancelled' })
      .eq('id', adj.id);
    if (error) { toast.error('Failed to reject'); return; }

    logAudit('periodization.rejected', 'periodization_adjustment', adj.id, { adjustment_type: adj.adjustment_type });
    toast.success('Adjustment rejected');
    queryClient.invalidateQueries({ queryKey: ['coach-pending-periodization-adjustments'] });
  };

  if (isLoading || !pendingAdjustments?.length) return null;

  return (
    <Card className="glass border-amber-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-500" /> Periodization Adjustments
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs">
            {pendingAdjustments.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingAdjustments.map((adj: any) => (
          <div key={adj.id} className="p-3 rounded-lg border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{adj.athlete_name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{adj.target_session?.session_name || 'session'}</span>
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                {adjustmentTypeLabels[adj.adjustment_type] || adj.adjustment_type}
              </Badge>
            </div>
            {adj.reason_details && (
              <p className="text-xs text-muted-foreground italic">"{adj.reason_details}"</p>
            )}
            <p className="text-xs text-muted-foreground">
              {adj.original_intensity} → {adj.suggested_intensity}
              {adj.suggested_duration_min != null && ` · ${Math.round(adj.suggested_duration_min)}min`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => handleReject(adj)}>
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
              <Button size="sm" className="flex-1 gradient-hyrox" onClick={() => handleApprove(adj)}>
                <Check className="h-3.5 w-3.5 mr-1" /> Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
