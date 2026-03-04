import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';

// Consistent plan colors for visual distinction
const PLAN_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 80%, 55%)',
  'hsl(280, 65%, 55%)',
  'hsl(160, 65%, 45%)',
  'hsl(35, 80%, 50%)',
];

export function useScheduleData() {
  const { currentOrg, user } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['org-plans', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, name, created_at, source, archived_at')
        .eq('organization_id', currentOrg.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      return error ? [] : data || [];
    },
    enabled: !!currentOrg,
  });

  // Auto-default to 'all' when multiple plans exist
  const effectiveSelection = selectedPlanId || ((plans?.length ?? 0) > 1 ? 'all' : (plans?.[0]?.id || ''));
  const isAllPlans = effectiveSelection === 'all';
  const activePlanId = isAllPlans ? '' : effectiveSelection;

  // Build a color map for plans
  const planColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (plans || []).forEach((p, i) => {
      map[p.id] = PLAN_COLORS[i % PLAN_COLORS.length];
    });
    return map;
  }, [plans]);

  const planNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (plans || []).forEach(p => { map[p.id] = p.name; });
    return map;
  }, [plans]);

  // Fetch latest version for single plan
  const { data: version } = useQuery({
    queryKey: ['plan-version', activePlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_versions')
        .select('id, version_number, plan_id')
        .eq('plan_id', activePlanId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
      return error ? null : data;
    },
    enabled: !!activePlanId && !isAllPlans,
  });

  // Fetch all plan versions (latest per plan) for "all" mode
  const { data: allVersions } = useQuery({
    queryKey: ['all-plan-versions', plans?.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!plans?.length) return [];
      const results: Array<{ id: string; plan_id: string; version_number: number }> = [];
      for (const plan of plans) {
        const { data } = await supabase
          .from('plan_versions')
          .select('id, version_number, plan_id')
          .eq('plan_id', plan.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();
        if (data) results.push(data);
      }
      return results;
    },
    enabled: isAllPlans && (plans?.length ?? 0) > 0,
  });

  // Sessions for single plan
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
    enabled: !!version?.id && !isAllPlans,
  });

  // Sessions for ALL plans (merged)
  const { data: allSessions, isLoading: allSessionsLoading } = useQuery({
    queryKey: ['all-planned-sessions', allVersions?.map(v => v.id).join(',')],
    queryFn: async () => {
      if (!allVersions?.length) return [];
      const versionIds = allVersions.map(v => v.id);
      const { data, error } = await supabase
        .from('planned_sessions')
        .select('*')
        .in('plan_version_id', versionIds)
        .order('week_number', { ascending: true })
        .order('day_of_week', { ascending: true })
        .order('order_index', { ascending: true });
      if (error) return [];
      // Annotate each session with plan info
      const versionToPlan: Record<string, string> = {};
      for (const v of allVersions) {
        versionToPlan[v.id] = v.plan_id;
      }
      return (data || []).map(s => ({
        ...s,
        _planId: versionToPlan[s.plan_version_id],
        _planName: planNameMap[versionToPlan[s.plan_version_id]] || 'Plan',
        _planColor: planColorMap[versionToPlan[s.plan_version_id]] || PLAN_COLORS[0],
      }));
    },
    enabled: isAllPlans && (allVersions?.length ?? 0) > 0,
  });

  const activeSessions = isAllPlans ? (allSessions || []) : (sessions || []);

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
    enabled: !!version?.id && !isAllPlans,
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
    enabled: !!version?.id && !isAllPlans,
  });

  const { data: completedSessions } = useQuery({
    queryKey: ['completed-sessions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('id, planned_session_id, date, discipline')
        .eq('athlete_id', user.id);
      return error ? [] : data || [];
    },
    enabled: !!user?.id,
  });

  const { data: substitutions } = useQuery({
    queryKey: ['session-substitutions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('session_substitutions' as any)
        .select('*')
        .eq('athlete_id', user.id)
        .in('status', ['active', 'pending_coach']);
      return error ? [] : (data as any[]) || [];
    },
    enabled: !!user?.id,
  });

  const maxWeek = useMemo(() => {
    if (!activeSessions?.length) return 1;
    return Math.max(...activeSessions.map(s => s.week_number));
  }, [activeSessions]);

  const substitutionMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const sub of (substitutions || [])) {
      map[sub.original_session_id] = sub;
    }
    return map;
  }, [substitutions]);

  return {
    plans,
    plansLoading,
    activePlanId,
    setSelectedPlanId,
    isAllPlans,
    version,
    sessions: activeSessions,
    sessionsLoading: isAllPlans ? allSessionsLoading : sessionsLoading,
    weeklySummaries: isAllPlans ? [] : (weeklySummaries || []),
    targets: isAllPlans ? [] : (targets || []),
    completedSessions: completedSessions || [],
    substitutionMap,
    maxWeek,
    isLoading: plansLoading || (isAllPlans ? allSessionsLoading : sessionsLoading),
    noPlan: !plansLoading && (!plans || plans.length === 0),
    planColorMap,
    planNameMap,
  };
}
