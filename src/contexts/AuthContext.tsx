import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Membership, Organization } from '@/types/hyrox';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  currentOrg: Organization | null;
  currentRole: AppRole | null;
  setCurrentOrg: (org: Organization | null) => void;
  signOut: () => Promise<void>;
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
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // When org changes, find role
  useEffect(() => {
    if (currentOrg && memberships.length > 0) {
      const m = memberships.find(m => m.organization_id === currentOrg.id);
      setCurrentRole(m?.role ?? null);
    } else {
      setCurrentRole(null);
    }
  }, [currentOrg, memberships]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMemberships([]);
    setCurrentOrg(null);
    setCurrentRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, memberships, currentOrg, currentRole,
      setCurrentOrg, signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};
