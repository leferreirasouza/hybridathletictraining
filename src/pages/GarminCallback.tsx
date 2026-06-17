import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function GarminCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('Finishing Garmin connection…');

  useEffect(() => {
    const oauth_token = params.get('oauth_token');
    const oauth_verifier = params.get('oauth_verifier');

    if (!oauth_token || !oauth_verifier) {
      setStatus('error');
      setMessage('Missing Garmin callback parameters.');
      return;
    }

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('error');
        setMessage('You must be logged in to finish connecting Garmin.');
        return;
      }
      const { error } = await supabase.functions.invoke('garmin-oauth', {
        body: { action: 'callback', oauth_token, oauth_verifier },
      });
      if (error) {
        setStatus('error');
        setMessage(error.message ?? 'Failed to connect Garmin.');
        return;
      }
      localStorage.setItem('ha-garmin-connected', '1');
      setStatus('success');
      setMessage('Garmin connected!');
      toast.success('Garmin connected');
      setTimeout(() => navigate('/settings'), 1200);
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        {status === 'working' && <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />}
        {status === 'success' && <CheckCircle2 className="h-8 w-8 mx-auto text-primary" />}
        {status === 'error' && <XCircle className="h-8 w-8 mx-auto text-destructive" />}
        <p className="text-sm text-foreground">{message}</p>
        {status === 'error' && (
          <button onClick={() => navigate('/settings')} className="text-xs text-primary underline">
            Back to Settings
          </button>
        )}
      </div>
    </div>
  );
}
