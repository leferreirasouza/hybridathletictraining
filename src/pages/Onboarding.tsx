import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Users, Trophy } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export default function Onboarding() {
  const { user, refreshMemberships } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState<AppRole>('athlete');
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!user || !orgName.trim()) {
      toast.error('Please enter an organization name');
      return;
    }
    setLoading(true);
    try {
      // Create org
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName.trim() })
        .select()
        .single();
      if (orgError) throw orgError;

      // Create role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, organization_id: org.id, role });
      if (roleError) throw roleError;

      await refreshMemberships();
      toast.success('Welcome to HYROX Coach OS! 🎉');
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl gradient-hyrox flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Let's get set up</h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step} of 2</p>
        </div>

        {step === 1 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">Your Role</CardTitle>
              <CardDescription>How will you use HYROX Coach OS?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={role} onValueChange={(v) => setRole(v as AppRole)} className="space-y-3">
                {[
                  { value: 'athlete', icon: Trophy, label: 'Athlete', desc: 'Follow training plans, log sessions, track progress' },
                  { value: 'coach', icon: Users, label: 'Coach', desc: 'Create plans, manage athletes, review performance' },
                  { value: 'master_admin', icon: Dumbbell, label: 'Admin', desc: 'Full access — manage orgs, coaches, and athletes' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      role === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} />
                    <opt.icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <Button className="w-full gradient-hyrox" onClick={() => setStep(2)}>
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">Organization</CardTitle>
              <CardDescription>Create or name your team / gym / coaching group</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. HYROX London Squad"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button className="flex-1 gradient-hyrox" onClick={handleComplete} disabled={loading}>
                  {loading ? 'Setting up…' : 'Get Started'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
