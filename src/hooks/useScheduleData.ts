import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';

const PLAN_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 80%, 55%)',
  'hsl(280, 65%, 55%)',
  'hsl(160, 65%, 45%)',
  'hsl(35, 80%, 50%)',
];

export function useScheduleData() {
  const { currentOrg, user, loading, membershipsLoading } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const authLoading = loading || membershipsLoading;
  const authReady = !authLoading && !!currentOrg?.id && !!user?.id;

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['org-plans', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return [];

      const { data: orgPlans, error } = await supabase
        .from('training_plans')
        .select('id, name, created_at, source, archived_at')
        .eq('organization_id', currentOrg.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error || !orgPlans?.length) return [];

      const planIds = orgPlans.map((plan) => plan.id);
      const { data: versions } = await supabase
        .from('plan_versions')
        .select('id, plan_id, version_number')
        .in('plan_id', planIds)
        .order('plan_id', { ascending: true })
        .order('version_number', { ascending: false });

      const latestVersionByPlan = new Map<string, string>();
      (versions || []).forEach((version) => {
        if (!latestVersionByPlan.has(version.plan_id)) {
          latestVersionByPlan.set(version.plan_id, version.id);
        }
      });

      if (latestVersionByPlan.size === 0) {
        return orgPlans;
      }

      const latestVersionIds = [...latestVersionByPlan.values()];
      const { data: planSessions } = await supabase
        .from('planned_sessions')
        .select('plan_version_id, athlete_id')
        .in('plan_version_id', latestVersionIds);

      const visibleVersionIds = new Set(
        (planSessions || [])
          .filter((session) => !session.athlete_id || session.athlete_id === user.id)
          .map((session) => session.plan_version_id),
      );
      const versionIdsWithSessions = new Set((planSessions || []).map((session) => session.plan_version_id));

      const visiblePlanIds = new Set<string>();
      latestVersionByPlan.forEach((versionId, planId) => {
        if (!versionIdsWithSessions.has(versionId) || visibleVersionIds.has(versionId)) {
          visiblePlanIds.add(planId);
        }
      });

      return orgPlans.filter((plan) => visiblePlanIds.has(plan.id));
    },
    enabled: authReady,
  });

  const effectiveSelection = selectedPlanId || ((plans?.length ?? 0) > 1 ? 'all' : (plans?.[0]?.id || ''));
  const isAllPlans = effectiveSelection === 'all';
  const activePlanId = isAllPlans ? '' : effectiveSelection;

  const planColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (plans || []).forEach((p, i) => {
      map[p.id] = PLAN_COLORS[i % PLAN_COLORS.length];
    });
    return map;
  }, [plans]);

  const planNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (plans || []).forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [plans]);

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
    enabled: authReady && !!activePlanId && !isAllPlans,
  });

  const { data: allVersions } = useQuery({
    queryKey: ['all-plan-versions', currentOrg?.id, plans?.map((p) => p.id).join(',')],
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
    enabled: authReady && isAllPlans && (plans?.length ?? 0) > 0,
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
    enabled: authReady && !!version?.id && !isAllPlans,
  });

  const { data: allSessions, isLoading: allSessionsLoading } = useQuery({
    queryKey: ['all-planned-sessions', currentOrg?.id, allVersions?.map((v) => v.id).join(',')],
    queryFn: async () => {
      if (!allVersions?.length) return [];
      const versionIds = allVersions.map((v) => v.id);
      const { data, error } = await supabase
        .from('planned_sessions')
        .select('*')
        .in('plan_version_id', versionIds)
        .order('week_number', { ascending: true })
        .order('day_of_week', { ascending: true })
        .order('order_index', { ascending: true });
      if (error) return [];

      const versionToPlan: Record<string, string> = {};
      for (const v of allVersions) {
        versionToPlan[v.id] = v.plan_id;
      }

      return (data || []).map((session) => ({
        ...session,
        _planId: versionToPlan[session.plan_version_id],
        _planName: planNameMap[versionToPlan[session.plan_version_id]] || 'Plan',
        _planColor: planColorMap[versionToPlan[session.plan_version_id]] || PLAN_COLORS[0],
      }));
    },
    enabled: authReady && isAllPlans && (allVersions?.length ?? 0) > 0,
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
    enabled: authReady && !!version?.id && !isAllPlans,
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
    enabled: authReady && !!version?.id && !isAllPlans,
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
    enabled: authReady && !!user?.id,
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
    enabled: authReady && !!user?.id,
  });

  const maxWeek = useMemo(() => {
    if (!activeSessions?.length) return 1;
    return Math.max(...activeSessions.map((session) => session.week_number));
  }, [activeSessions]);

  const substitutionMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const sub of substitutions || []) {
      map[sub.original_session_id] = sub;
    }
    return map;
  }, [substitutions]);

  const scheduleLoading = authLoading || (authReady && (plansLoading || (isAllPlans ? allSessionsLoading : sessionsLoading)));

  return {
    authReady,
    authLoading,
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
    isLoading: scheduleLoading,
    noPlan: authReady && !plansLoading && (!plans || plans.length === 0),
    planColorMap,
    planNameMap,
  };
}
