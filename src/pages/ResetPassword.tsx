import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, KeyRound } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated! Redirecting…');
      setTimeout(() => navigate('/dashboard'), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl gradient-hyrox flex items-center justify-center mb-4 shadow-lg">
            <Dumbbell className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Hybrid Athletics</h1>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Set New Password
            </CardTitle>
            <CardDescription>
              {ready ? 'Choose a new password for your account' : 'Verifying your reset link…'}
            </CardDescription>
          </CardHeader>
          {ready ? (
            <form onSubmit={handleReset}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} required />
                </div>
                <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                  {loading ? 'Updating…' : 'Update Password'}
                </Button>
              </CardContent>
            </form>
          ) : (
            <CardContent>
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 rounded-xl gradient-hyrox animate-pulse-glow" />
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
