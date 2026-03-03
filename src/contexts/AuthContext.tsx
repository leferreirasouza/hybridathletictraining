import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

// Role hierarchy: master_admin > admin > coach > athlete
const ROLE_HIERARCHY: AppRole[] = ['master_admin', 'admin', 'coach', 'athlete'];

function getRoleLevel(role: AppRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/** Returns all roles at or below the given role in the hierarchy */
export function getAccessibleRoles(role: AppRole): AppRole[] {
  const level = getRoleLevel(role);
  return ROLE_HIERARCHY.filter((_, i) => i >= level);
}

interface OrgMembership {
  id: string;
  organization_id: string;
  role: AppRole;
  organization: { id: string; name: string; logo_url: string | null };
}

interface AuthState {
  user: User | null;
  membershipsLoading: boolean;
  session: Session | null;
  loading: boolean;
  memberships: OrgMembership[];
  currentOrg: { id: string; name: string } | null;
  /** The actual assigned role for the current org */
  currentRole: AppRole | null;
  /** The role the user is currently viewing as (can be their role or lower) */
  viewAsRole: AppRole | null;
  /** The effective role used for UI rendering */
  effectiveRole: AppRole | null;
  setCurrentOrg: (org: { id: string; name: string } | null) => void;
  setViewAsRole: (role: AppRole) => void;
  signOut: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  membershipsLoading: true,
  session: null,
  loading: true,
  memberships: [],
  currentOrg: null,
  currentRole: null,
  viewAsRole: null,
  effectiveRole: null,
  setCurrentOrg: () => {},
  setViewAsRole: () => {},
  signOut: async () => {},
  refreshMemberships: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<{ id: string; name: string } | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<AppRole | null>(null);

  const effectiveRole = viewAsRole ?? currentRole;

  const setViewAsRole = (role: AppRole) => {
    // Only allow switching to same or lower role
    if (currentRole && getRoleLevel(role) >= getRoleLevel(currentRole)) {
      setViewAsRoleState(role);
    }
  };

  const fetchMemberships = useCallback(async (userId: string) => {
    setMembershipsLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, organization_id, role, organizations(id, name, logo_url)')
      .eq('user_id', userId);

    if (!error && data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        organization_id: d.organization_id,
        role: d.role,
        organization: d.organizations,
      }));
      setMemberships(mapped);

      if (!currentOrg && mapped.length > 0) {
        // Pick highest role membership first
        const sorted = [...mapped].sort((a, b) => getRoleLevel(a.role) - getRoleLevel(b.role));
        setCurrentOrg({ id: sorted[0].organization.id, name: sorted[0].organization.name });
        setCurrentRole(sorted[0].role);
        setViewAsRoleState(null); // reset view-as on fresh load
      }
    }
    setMembershipsLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchMemberships(session.user.id), 0);
      } else {
        setMemberships([]);
        setMembershipsLoading(false);
        setCurrentOrg(null);
        setCurrentRole(null);
        setViewAsRoleState(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMemberships(session.user.id);
      } else {
        setMembershipsLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentOrg && memberships.length > 0) {
      const m = memberships.find(m => m.organization_id === currentOrg.id);
      setCurrentRole(m?.role ?? null);
      setViewAsRoleState(null); // reset view-as when org changes
    }
  }, [currentOrg, memberships]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMemberships([]);
    setCurrentOrg(null);
    setCurrentRole(null);
    setViewAsRoleState(null);
  };

  const refreshMemberships = async () => {
    if (user) await fetchMemberships(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, membershipsLoading, memberships, currentOrg, currentRole,
      viewAsRole, effectiveRole,
      setCurrentOrg, setViewAsRole, signOut, refreshMemberships,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
