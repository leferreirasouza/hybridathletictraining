import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { logAudit } from '@/lib/auditLog';

describe('auditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls supabase insert with correct action', async () => {
    await logAudit('session.completed', 'completed_session', 'abc-123', { discipline: 'run' });

    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledWith([{
      action: 'session.completed',
      entity_type: 'completed_session',
      entity_id: 'abc-123',
      details: { discipline: 'run' },
    }]);
  });

  it('handles null optional params', async () => {
    await logAudit('auth.login');

    expect(mockInsert).toHaveBeenCalledWith([{
      action: 'auth.login',
      entity_type: null,
      entity_id: null,
      details: null,
    }]);
  });

  it('does not throw on insert error', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB error'));
    // Should not throw
    await expect(logAudit('session.completed')).resolves.toBeUndefined();
  });
});
