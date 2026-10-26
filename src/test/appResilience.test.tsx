import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import '@/i18n';

// --- Supabase mock: per-table rows the card reads -------------------------
let tableRows: Record<string, unknown> = {};
function builder(table: string) {
  const rows = tableRows[table];
  const result = { data: rows, error: null };
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'gte', 'order', 'limit', 'update']) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null });
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import MaxHrCard from '@/components/dashboard/MaxHrCard';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { isChunkLoadError } from '@/lib/appRecovery';
import { estimateMaxHr } from '../../supabase/functions/_shared/maxHrEstimate.ts';

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <MaxHrCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

// The owner's real shape: profile 194, sessions regularly 196–199, two spikes.
const ownerSessions = [211, 209, 199, 198, 197, 197, 196, 196, ...Array.from({ length: 30 }, (_, i) => 150 + i)].map(
  (max_hr, i) => ({ max_hr, data_flags: i < 2 ? ['max_hr_artifact'] : [] }),
);

describe('MaxHrCard renders against real data shapes', () => {
  beforeEach(() => {
    tableRows = {};
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it("suggests raising the owner's max HR to the estimate", async () => {
    tableRows = { profiles: [{ max_hr: 194 }], completed_sessions: ownerSessions };
    const expected = estimateMaxHr(ownerSessions.filter((s) => !s.data_flags.length).map((s) => s.max_hr))!.bpm;
    expect(expected).toBeGreaterThan(194);
    renderCard();
    expect(await screen.findByText(`Update to ${expected} bpm`)).toBeInTheDocument();
    expect(screen.getByText(/Keep 194 bpm/)).toBeInTheDocument();
  });

  it('asks for a max HR when there is no profile value and no data (null data_flags too)', async () => {
    tableRows = { profiles: [{ max_hr: null }], completed_sessions: [{ max_hr: 180, data_flags: null }] };
    renderCard();
    expect(await screen.findByText(/Add your max heart rate/)).toBeInTheDocument();
  });

  it('renders nothing when the profile value is fine', async () => {
    tableRows = { profiles: [{ max_hr: 200 }], completed_sessions: ownerSessions };
    const { container } = renderCard();
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('AppErrorBoundary', () => {
  it('shows the error instead of a dark screen', () => {
    const Boom = () => {
      throw new Error('kaboom in a page');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('kaboom in a page')).toBeInTheDocument();
    expect(screen.getByText('Reload app')).toBeInTheDocument();
  });

  it('recognises stale page-file errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/Dashboard-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('kaboom'))).toBe(false);
  });
});
