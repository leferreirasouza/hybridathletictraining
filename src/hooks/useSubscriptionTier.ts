import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'free' | 'paid';

/**
 * UI-ONLY tier read, same caveat as AuthContext's viewAsRole/effectiveRole:
 * this does NOT enforce anything. Real enforcement is server-side, in
 * generate-plan and hyrox-ai-coach (see supabase/functions/_shared/subscription.ts).
 * Use this only to drive what the UI shows (upgrade prompts, disabled
 * buttons) — never as the actual gate on a securable action.
 *
 * No `subscriptions` row, or a row whose status isn't active/trialing,
 * reads as free — mirrors the server-side getAthleteTier() definition.
 */
export function useSubscriptionTier() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['subscription-tier', user?.id],
    queryFn: async (): Promise<{ tier: SubscriptionTier; status: string | null }> => {
      const { data } = await supabase
        .from('subscriptions' as any)
        .select('tier, status')
        .eq('athlete_id', user!.id)
        .maybeSingle();
      const row = data as { tier: SubscriptionTier; status: string } | null;
      if (!row || (row.status !== 'active' && row.status !== 'trialing')) {
        return { tier: 'free', status: row?.status ?? null };
      }
      return { tier: row.tier, status: row.status };
    },
    enabled: !!user,
  });

  return {
    tier: query.data?.tier ?? 'free',
    status: query.data?.status ?? null,
    isPaid: query.data?.tier === 'paid',
    loading: query.isLoading,
  };
}
