## Diagnosis

Google sign-in is actually succeeding on the backend — the auth logs show a successful Google login at 22:23:00 for your account, the `/token` exchange returned 200, `/user` returned 200, and the `user_roles` query came back with your master_admin/admin memberships.

The bug is on the frontend: in `src/pages/Auth.tsx`, `handleGoogleSignIn` (and `handleAppleSignIn`) only handle the error and redirect cases. When `lovable.auth.signInWithOAuth` returns successfully with tokens already set (the ID-token path that runs after Google bounces back), the code does nothing — so you stay stuck on `/auth` even though you're signed in. The email/password handler correctly calls `navigate('/dashboard')` on success; the OAuth handlers don't.

## Fix

In `src/pages/Auth.tsx`:

1. In `handleGoogleSignIn` and `handleAppleSignIn`, after the `error` check, if `result.redirected` is true just return (browser will redirect to the provider); otherwise tokens are set — call `navigate('/dashboard')`.
2. Add a small `useEffect` that watches `useAuth().user` and, if a user is already present while on `/auth`, navigates to `/dashboard`. This also covers the case where the OAuth callback lands back on `/auth` with the session already restored.

No backend, RLS, or `src/integrations/lovable/index.ts` changes are needed (that file is auto-generated and the SDK is behaving correctly).

## Verify

- Sign out, click "Sign in with Google", complete the Google prompt → should land on `/dashboard` instead of staying on `/auth`.
- Email/password sign-in keeps working as before.
