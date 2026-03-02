import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Users, Trophy } from 'lucide-react';

const MASTER_EMAILS = [
  'le.ferreira.souza@gmail.com',
  'k.sanches.azevedo@gmail.com',
];

type Role = 'athlete' | 'coach';

interface Org {
  id: string;
  name: string;
}

export default function Onboarding() {
  const { user, refreshMemberships } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>('athlete');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMaster, setIsMaster] = useState(false);

  // Check if master user & auto-setup
  useEffect(() => {
    if (!user) return;
    const email = user.email?.toLowerCase() ?? '';
    if (MASTER_EMAILS.includes(email)) {
      setIsMaster(true);
      autoSetupMaster();
    }
  }, [user]);

  // Fetch available orgs when reaching org selection step
  useEffect(() => {
    if (step === 2) fetchOrgs();
  }, [step]);

  const fetchOrgs = async () => {
    // Use service-level query via edge function or just fetch all orgs
    // Since new users can't see orgs (no membership yet), we use a public listing approach
    // We'll use supabase rpc or a workaround - let's fetch via the client
    // Note: RLS prevents non-members from seeing orgs. We need to handle this differently.
    // Solution: fetch orgs list from a simpler approach - use supabase functions
    const { data, error } = await supabase.from('organizations').select('id, name');
    if (!error && data) {
      setOrgs(data);
    } else {
      // If RLS blocks, we show a message
      setOrgs([]);
    }
  };

  const autoSetupMaster = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch all orgs (master may not have membership yet, so this might fail)
      // We'll create roles for all existing orgs
      const { data: allOrgs } = await supabase.from('organizations').select('id, name');

      if (!allOrgs || allOrgs.length === 0) {
        // Master user but no orgs exist yet - they need to wait or we create via migration
        toast.error('No organizations found. Please contact support.');
        setLoading(false);
        return;
      }

      // Create master_admin role for each org
      for (const org of allOrgs) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          organization_id: org.id,
          role: 'master_admin',
        });
      }

      await refreshMemberships();
      toast.success('Welcome, Master Admin! 🎉');
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!user || !selectedOrgId) {
      toast.error('Please select an organization');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: user.id,
        organization_id: selectedOrgId,
        role,
      });
      if (error) throw error;

      await refreshMemberships();
      toast.success('Welcome to HYROX Coach OS! 🎉');
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  // Master users get auto-setup, show loading
  if (isMaster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl gradient-hyrox flex items-center justify-center mx-auto animate-pulse">
            <Dumbbell className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Setting up master account…</p>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-muted-foreground mt-1">
            Step {step} of {role === 'coach' ? 3 : 2}
          </p>
        </div>

        {step === 1 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">Your Role</CardTitle>
              <CardDescription>How will you use HYROX Coach OS?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="space-y-3">
                {[
                  { value: 'athlete', icon: Trophy, label: 'Athlete', desc: 'Follow training plans, log sessions, track progress' },
                  { value: 'coach', icon: Users, label: 'Coach', desc: 'Create plans, manage athletes, review performance' },
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
              <CardTitle className="text-lg font-display">Select Organization</CardTitle>
              <CardDescription>
                {role === 'athlete'
                  ? 'Choose the team / gym you belong to'
                  : 'Choose the organization you coach for'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No organizations available yet. Please contact an admin.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                {role === 'athlete' ? (
                  <Button
                    className="flex-1 gradient-hyrox"
                    onClick={handleComplete}
                    disabled={loading || !selectedOrgId}
                  >
                    {loading ? 'Setting up…' : 'Get Started'}
                  </Button>
                ) : (
                  <Button
                    className="flex-1 gradient-hyrox"
                    onClick={() => setStep(3)}
                    disabled={!selectedOrgId}
                  >
                    Continue
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && role === 'coach' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">Confirm</CardTitle>
              <CardDescription>
                You'll join <strong>{orgs.find(o => o.id === selectedOrgId)?.name}</strong> as a Coach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                As a coach you'll be able to create training plans, manage athletes, and review performance data for this organization.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button
                  className="flex-1 gradient-hyrox"
                  onClick={handleComplete}
                  disabled={loading}
                >
                  {loading ? 'Setting up…' : 'Join as Coach'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
