import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Activity, AlertCircle } from 'lucide-react';

export default function StravaCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'pending' | 'exchanging' | 'success' | 'error'>('pending');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const code = params.get('code');
  const oauthError = params.get('error');

  useEffect(() => {
    if (oauthError) {
      setStatus('error');
      setErrorMsg(oauthError === 'access_denied' ? 'You declined the Strava authorization.' : oauthError);
      return;
    }
    if (!code) {
      setStatus('error');
      setErrorMsg('Missing authorization code from Strava.');
      return;
    }
    if (loading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/strava/callback?code=${code}`)}`, { replace: true });
      return;
    }

    (async () => {
      setStatus('exchanging');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('No session token');

        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/strava-connect`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });
        const json = await resp.json();
        if (!resp.ok || !json.ok) throw new Error(json.error || 'Token exchange failed');

        setStatus('success');
        toast.success('Strava connected!');
        setTimeout(() => navigate('/profile', { replace: true }), 800);
      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setErrorMsg(e.message || 'Failed to connect Strava');
      }
    })();
  }, [code, oauthError, user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="glass w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Activity className="h-5 w-5 text-primary" /> Strava Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === 'pending' || status === 'exchanging') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-8 w-8 rounded-xl gradient-hyrox animate-pulse-glow" />
              <p className="text-sm text-muted-foreground">
                {status === 'exchanging' ? 'Exchanging tokens with Strava…' : 'Initializing…'}
              </p>
            </div>
          )}
          {status === 'success' && (
            <div className="text-center space-y-3 py-2">
              <div className="text-success font-medium">✓ Connected successfully</div>
              <p className="text-sm text-muted-foreground">Redirecting to your profile…</p>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <p className="text-sm">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => navigate('/profile')}>
                  Back to Profile
                </Button>
                <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/profile')}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
