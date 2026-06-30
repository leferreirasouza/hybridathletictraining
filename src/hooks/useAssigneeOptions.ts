import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface AssigneeOption {
  id: string;
  fullName: string;
  role: AppRole;
}

const rolePriority: Record<AppRole, number> = {
  master_admin: 0,
  admin: 1,
  coach: 2,
  athlete: 3,
};

/**
 * Lifted from PlanBuilder.tsx — returns the list of athletes (plus the
 * current user) that a coach/admin can create/assign plans for within the
 * current organization. Disabled when the caller has no manage-plans role.
 */
export function useAssigneeOptions(enabled: boolean) {
  const { user, currentOrg, currentRole } = useAuth();

  return useQuery({
    queryKey: ['assignee-options', currentOrg?.id, user?.id],
    queryFn: async (): Promise<AssigneeOption[]> => {
      if (!currentOrg || !user) return [];

      const { data: roleRows, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id);

      if (error) throw error;

      const roleByUser = new Map<string, AppRole>();
      (roleRows || []).forEach((row) => {
        const existing = roleByUser.get(row.user_id as string);
        const nextRole = row.role as AppRole;
        if (!existing || rolePriority[nextRole] < rolePriority[existing]) {
          roleByUser.set(row.user_id as string, nextRole);
        }
      });

      if (!roleByUser.has(user.id)) {
        roleByUser.set(user.id, (currentRole as AppRole) || 'coach');
      }

      const userIds = [...roleByUser.keys()];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      return userIds
        .map((id) => ({
          id,
          fullName: profileMap.get(id) || (id === user.id ? 'You' : 'Unknown'),
          role: roleByUser.get(id) || 'athlete',
        }))
        .sort((a, b) => {
          if (a.id === user.id) return -1;
          if (b.id === user.id) return 1;
          return a.fullName.localeCompare(b.fullName);
        });
    },
    enabled: enabled && !!currentOrg?.id && !!user?.id,
  });
}
