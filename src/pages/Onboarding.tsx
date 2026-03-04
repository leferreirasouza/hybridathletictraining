import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Users, Trophy, User, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Role = 'athlete' | 'coach';

interface Org {
  id: string;
  name: string;
}

export default function Onboarding() {
  const { t } = useTranslation();
  const { user, refreshMemberships } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>('athlete');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingMaster, setCheckingMaster] = useState(true);

  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('intermediate');
  const [goalRaceName, setGoalRaceName] = useState('');
  const [goalRaceDate, setGoalRaceDate] = useState('');
  const [goalRaceLocation, setGoalRaceLocation] = useState('');

  const totalSteps = role === 'athlete' ? 4 : role === 'coach' ? 3 : 2;

  const FITNESS_LEVELS = [
    { value: 'beginner', label: t('onboarding.beginner'), desc: t('onboarding.beginnerDesc') },
    { value: 'intermediate', label: t('onboarding.intermediate'), desc: t('onboarding.intermediateDesc') },
    { value: 'advanced', label: t('onboarding.advanced'), desc: t('onboarding.advancedDesc') },
    { value: 'elite', label: t('onboarding.elite'), desc: t('onboarding.eliteDesc') },
  ];

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
        await refreshMemberships();
        navigate('/dashboard');
      }
      setCheckingMaster(false);
    };
    checkMasterRole();
  }, [user]);

  useEffect(() => {
    if (step === 2) fetchOrgs();
  }, [step]);

  const fetchOrgs = async () => {
    const { data, error } = await supabase.rpc('list_active_organizations');
    if (!error && data) setOrgs(data as Org[]);
    else setOrgs([]);
  };

  const handleComplete = async () => {
    if (!user || !selectedOrgId) {
      toast.error(t('onboarding.selectAnOrg'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('assign_onboarding_role', {
        _org_id: selectedOrgId,
        _role: role,
      });
      if (error) throw error;

      if (role === 'athlete') {
        await supabase.from('profiles').update({
          age: age ? parseInt(age) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          max_hr: maxHr ? parseInt(maxHr) : null,
          fitness_level: fitnessLevel,
          goal_race_name: goalRaceName.trim() || null,
          goal_race_date: goalRaceDate || null,
          goal_race_location: goalRaceLocation.trim() || null,
          onboarding_completed: true,
        } as any).eq('id', user.id);
      } else {
        await supabase.from('profiles').update({
          onboarding_completed: true,
        } as any).eq('id', user.id);
      }

      await refreshMemberships();
      toast.success(t('onboarding.welcome'));
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl gradient-hyrox flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">{t('onboarding.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('onboarding.stepOf', { step, total: totalSteps })}
          </p>
        </div>

        {/* Step 1: Role */}
        {step === 1 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">{t('onboarding.yourRole')}</CardTitle>
              <CardDescription>{t('onboarding.howUse')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="space-y-3">
                {[
                  { value: 'athlete', icon: Trophy, label: t('roles.athlete'), desc: t('onboarding.athleteDesc') },
                  { value: 'coach', icon: Users, label: t('roles.coach'), desc: t('onboarding.coachDesc') },
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
                {t('onboarding.continue')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Organization */}
        {step === 2 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">{t('onboarding.selectOrg')}</CardTitle>
              <CardDescription>
                {role === 'athlete' ? t('onboarding.selectOrgAthleteDesc') : t('onboarding.selectOrgCoachDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('onboarding.noOrgs')}</p>
              ) : (
                <div className="space-y-2">
                  <Label>{t('onboarding.organization')}</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('onboarding.selectAnOrg')} />
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
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">{t('onboarding.back')}</Button>
                <Button className="flex-1 gradient-hyrox" onClick={() => setStep(3)} disabled={!selectedOrgId}>
                  {t('onboarding.continue')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 (Athlete): Profile & Biometrics */}
        {step === 3 && role === 'athlete' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> {t('onboarding.yourProfile')}
              </CardTitle>
              <CardDescription>{t('onboarding.personalizeDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('onboarding.age')}</Label>
                  <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="28" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('onboarding.weightKg')}</Label>
                  <Input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('onboarding.maxHr')}</Label>
                  <Input type="number" value={maxHr} onChange={e => setMaxHr(e.target.value)} placeholder="190" className="h-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('onboarding.fitnessLevel')}</Label>
                <RadioGroup value={fitnessLevel} onValueChange={setFitnessLevel} className="space-y-2">
                  {FITNESS_LEVELS.map(fl => (
                    <label
                      key={fl.value}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        fitnessLevel === fl.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={fl.value} />
                      <div>
                        <span className="font-medium">{fl.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{fl.desc}</span>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">{t('onboarding.back')}</Button>
                <Button className="flex-1 gradient-hyrox" onClick={() => setStep(4)}>{t('onboarding.continue')}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4 (Athlete): Goal Race */}
        {step === 4 && role === 'athlete' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Flag className="h-5 w-5 text-primary" /> {t('onboarding.goalRace')}
              </CardTitle>
              <CardDescription>{t('onboarding.goalRaceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('onboarding.raceName')}</Label>
                <Input value={goalRaceName} onChange={e => setGoalRaceName(e.target.value)} placeholder="HYROX Munich 2025" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('onboarding.raceDate')}</Label>
                  <Input type="date" value={goalRaceDate} onChange={e => setGoalRaceDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('onboarding.location')}</Label>
                  <Input value={goalRaceLocation} onChange={e => setGoalRaceLocation(e.target.value)} placeholder="Munich, DE" className="h-9" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('onboarding.skipHint')}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">{t('onboarding.back')}</Button>
                <Button className="flex-1 gradient-hyrox" onClick={handleComplete} disabled={loading}>
                  {loading ? t('onboarding.settingUp') : t('onboarding.getStarted')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 (Coach): Confirm */}
        {step === 3 && role === 'coach' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">{t('onboarding.confirm')}</CardTitle>
              <CardDescription dangerouslySetInnerHTML={{ __html: t('onboarding.coachConfirmDesc', { org: orgs.find(o => o.id === selectedOrgId)?.name }) }} />
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('onboarding.coachConfirmInfo')}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">{t('onboarding.back')}</Button>
                <Button className="flex-1 gradient-hyrox" onClick={handleComplete} disabled={loading}>
                  {loading ? t('onboarding.settingUp') : t('onboarding.joinAsCoach')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
