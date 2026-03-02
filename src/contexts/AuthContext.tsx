import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface OrgMembership {
  id: string;
  organization_id: string;
  role: AppRole;
  organization: { id: string; name: string; logo_url: string | null };
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: OrgMembership[];
  currentOrg: { id: string; name: string } | null;
  currentRole: AppRole | null;
  setCurrentOrg: (org: { id: string; name: string } | null) => void;
  signOut: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  memberships: [],
  currentOrg: null,
  currentRole: null,
  setCurrentOrg: () => {},
  signOut: async () => {},
  refreshMemberships: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<{ id: string; name: string } | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);

  const fetchMemberships = useCallback(async (userId: string) => {
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

      // Auto-select first org if none selected
      if (!currentOrg && mapped.length > 0) {
        setCurrentOrg({ id: mapped[0].organization.id, name: mapped[0].organization.name });
        setCurrentRole(mapped[0].role);
      }
    }
  }, [currentOrg]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid Supabase deadlock
        setTimeout(() => fetchMemberships(session.user.id), 0);
      } else {
        setMemberships([]);
        setCurrentOrg(null);
        setCurrentRole(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMemberships(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentOrg && memberships.length > 0) {
      const m = memberships.find(m => m.organization_id === currentOrg.id);
      setCurrentRole(m?.role ?? null);
    }
  }, [currentOrg, memberships]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMemberships([]);
    setCurrentOrg(null);
    setCurrentRole(null);
  };

  const refreshMemberships = async () => {
    if (user) await fetchMemberships(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, memberships, currentOrg, currentRole,
      setCurrentOrg, signOut, refreshMemberships,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
