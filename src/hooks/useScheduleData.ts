import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';

export function useScheduleData() {
  const { currentOrg } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['org-plans', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, name, created_at')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      return error ? [] : data || [];
    },
    enabled: !!currentOrg,
  });

  const activePlanId = selectedPlanId || plans?.[0]?.id || '';

  const { data: version } = useQuery({
    queryKey: ['plan-version', activePlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_versions')
        .select('id, version_number')
        .eq('plan_id', activePlanId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
      return error ? null : data;
    },
    enabled: !!activePlanId,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['planned-sessions', version?.id],
    queryFn: async () => {
      if (!version) return [];
      const { data, error } = await supabase
        .from('planned_sessions')
        .select('*')
        .eq('plan_version_id', version.id)
        .order('week_number', { ascending: true })
        .order('day_of_week', { ascending: true })
        .order('order_index', { ascending: true });
      return error ? [] : data || [];
    },
    enabled: !!version?.id,
  });

  const { data: weeklySummaries } = useQuery({
    queryKey: ['weekly-summaries', version?.id],
    queryFn: async () => {
      if (!version) return [];
      const { data, error } = await supabase
        .from('weekly_summaries' as any)
        .select('*')
        .eq('plan_version_id', version.id)
        .order('week_number', { ascending: true });
      return error ? [] : (data as any[]) || [];
    },
    enabled: !!version?.id,
  });

  const { data: targets } = useQuery({
    queryKey: ['targets', version?.id],
    queryFn: async () => {
      if (!version) return [];
      const { data, error } = await supabase
        .from('targets')
        .select('*')
        .eq('plan_version_id', version.id);
      return error ? [] : data || [];
    },
    enabled: !!version?.id,
  });

  const maxWeek = useMemo(() => {
    if (!sessions?.length) return 1;
    return Math.max(...sessions.map(s => s.week_number));
  }, [sessions]);

  return {
    plans,
    plansLoading,
    activePlanId,
    setSelectedPlanId,
    version,
    sessions: sessions || [],
    sessionsLoading,
    weeklySummaries: weeklySummaries || [],
    targets: targets || [],
    maxWeek,
    isLoading: plansLoading || sessionsLoading,
    noPlan: !plansLoading && (!plans || plans.length === 0),
  };
}
