import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

/**
 * HYROX Coach OS — Component Render Tests
 * Validates that key components render without crashing.
 */

// Mock dependencies used across components
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ single: () => Promise.resolve({ data: null, error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }), data: [], error: null }),
            data: [],
            error: null,
          }),
          gte: () => ({
            order: () => ({ data: [], error: null }),
            data: [],
            error: null,
          }),
          in: () => ({ data: [], error: null }),
          data: [],
          error: null,
        }),
        order: () => ({
          limit: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
          data: [],
          error: null,
        }),
        data: [],
        error: null,
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
    functions: {
      invoke: () => Promise.resolve({ data: null, error: null }),
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@test.com', user_metadata: { full_name: 'Test User' } },
    session: null,
    loading: false,
    memberships: [{ id: 'm1', organization_id: 'org1', role: 'athlete', organization: { id: 'org1', name: 'Test Org', logo_url: null } }],
    currentOrg: { id: 'org1', name: 'Test Org' },
    currentRole: 'athlete',
    setCurrentOrg: () => {},
    signOut: async () => {},
    refreshMemberships: async () => {},
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/dashboard' }),
  Navigate: () => null,
  Outlet: () => null,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  QueryClientProvider: ({ children }: any) => children,
  QueryClient: vi.fn(),
}));

import React from 'react';

describe('Component Rendering', () => {
  it('renders ActivityLog page without crashing', async () => {
    const { default: ActivityLog } = await import('@/pages/ActivityLog');
    const { container } = render(<ActivityLog />);
    expect(container.querySelector('h1')?.textContent).toBe('Activity Log');
  });
});
