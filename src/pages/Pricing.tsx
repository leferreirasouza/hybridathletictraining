import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Dumbbell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { toast } from 'sonner';

const FREE_FEATURES = [
  'Manual session logging',
  'Schedule & calendar export',
  'Dashboard & training history',
  'Race calendar',
  'Strava auto-sync',
  'Training load (CTL/ATL/TSB) insights',
];

const PAID_FEATURES = [
  'Everything in Free',
  'AI-generated training plans',
  'AI coach chat',
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPaid } = useSubscriptionTier();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/auth?next=/pricing');
      return;
    }
    setLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: {} });
      if (error || !data?.url) {
        toast.error(data?.error ?? 'Failed to start checkout');
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background page-container py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Pricing</h1>
        </div>

        <p className="text-lg text-muted-foreground leading-relaxed">
          Manual logging, Strava sync and your training data stay free — always. Upgrade when you want AI to build your plan and coach you through it.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold">Free</h2>
              <p className="text-sm text-muted-foreground">Everything you need to train and track</p>
            </div>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-primary bg-card p-6 space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold">Paid</h2>
              <p className="text-sm text-muted-foreground">Let AI build and coach your training</p>
            </div>
            <ul className="space-y-2">
              {PAID_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isPaid ? (
              <Button className="w-full gradient-hyrox" disabled>
                Current plan
              </Button>
            ) : (
              <Button className="w-full gradient-hyrox" onClick={handleUpgrade} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upgrade
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link to={user ? '/dashboard' : '/auth'}>← Back</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
