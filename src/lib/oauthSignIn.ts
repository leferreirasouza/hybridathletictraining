import { supabase } from '@/integrations/supabase/client';

export type OAuthProvider = 'google' | 'apple';

export interface OAuthResult {
  error?: Error;
  /** The browser is navigating to the provider; nothing more to do here. */
  redirected?: boolean;
}

/**
 * Google/Apple sign-in. On Lovable Cloud this goes through Lovable's managed
 * OAuth broker (`@/integrations/lovable`). On our own Supabase project
 * (VITE_AUTH_MODE=supabase) it is plain Supabase Auth, with the Google client
 * and Apple Services ID configured in that project's Auth settings and
 * `redirectTo` listed in its allowed redirect URLs.
 */
export async function signInWithOAuth(provider: OAuthProvider, redirectTo: string): Promise<OAuthResult> {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    return error ? { error } : { redirected: true };
  }

  // Loaded only in Lovable mode, so the Lovable package can be dropped at cutover.
  const { lovable } = await import('@/integrations/lovable/index');
  const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectTo });
  if ('error' in result && result.error) {
    return { error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
  }
  return { redirected: 'redirected' in result && !!result.redirected };
}
