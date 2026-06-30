import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrgPlan {
  id: string;
  name: string;
  description: string | null;
  is_template: boolean | null;
  source: string | null;
  created_at: string;
  archived_at: string | null;
  created_by: string | null;
  isActive: boolean;
  versionCount: number;
  versionIds: string[];
  assignedAthleteId: string | null;
}

/**
 * Lifted from PlanBuilder.tsx — returns all training plans for the current
 * org, decorated with version IDs and the (first) assigned athlete id.
 */
export function useOrgPlans(enabled: boolean = true) {
  const { currentOrg } = useAuth();

  return useQuery({
    queryKey: ['org-plans', currentOrg?.id],
    queryFn: async (): Promise<OrgPlan[]> => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, name, description, is_template, source, created_at, archived_at, created_by')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const planIds = (data || []).map((p) => p.id);
      if (planIds.length === 0) return [];

      const { data: versions } = await supabase
        .from('plan_versions')
        .select('id, plan_id')
        .in('plan_id', planIds);

      const versionIds = (versions || []).map((v) => v.id);
      const versionMap = new Map<string, string[]>();
      (versions || []).forEach((v) => {
        const arr = versionMap.get(v.plan_id) || [];
        arr.push(v.id);
        versionMap.set(v.plan_id, arr);
      });

      const assignmentMap = new Map<string, string | null>();
      if (versionIds.length > 0) {
        const { data: sessions } = await supabase
          .from('planned_sessions')
          .select('plan_version_id, athlete_id')
          .in('plan_version_id', versionIds)
          .limit(500);
        const versionToPlan = new Map((versions || []).map((v) => [v.id, v.plan_id]));
        (sessions || []).forEach((s) => {
          const pid = versionToPlan.get(s.plan_version_id);
          if (pid && s.athlete_id && !assignmentMap.has(pid)) {
            assignmentMap.set(pid, s.athlete_id);
          }
        });
      }

      return (data || []).map((p) => ({
        ...p,
        isActive: !p.archived_at,
        versionCount: versionMap.get(p.id)?.length || 0,
        versionIds: versionMap.get(p.id) || [],
        assignedAthleteId: assignmentMap.get(p.id) || null,
      }));
    },
    enabled: enabled && !!currentOrg?.id,
  });
}
