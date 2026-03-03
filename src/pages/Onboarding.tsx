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
  const [checkingMaster, setCheckingMaster] = useState(true);

  // Check if user already has master_admin role (set via DB, not hardcoded emails)
  useEffect(() => {
    if (!user) return;
    const checkMasterRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'master_admin')
        .limit(1);

      if (data && data.length > 0) {
        // Already a master admin, refresh and go to dashboard
        await refreshMemberships();
        navigate('/dashboard');
      }
      setCheckingMaster(false);
    };
    checkMasterRole();
  }, [user]);

  // Fetch available orgs when reaching org selection step
  useEffect(() => {
    if (step === 2) fetchOrgs();
  }, [step]);

  const fetchOrgs = async () => {
    const { data, error } = await supabase.from('organizations').select('id, name').eq('is_active', true);
    if (!error && data) {
      setOrgs(data);
    } else {
      setOrgs([]);
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
      toast.success('Welcome to Hybrid Athletics! 🎉');
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  if (checkingMaster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-xl gradient-hyrox animate-pulse-glow" />
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
              <CardDescription>How will you use Hybrid Athletics?</CardDescription>
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
