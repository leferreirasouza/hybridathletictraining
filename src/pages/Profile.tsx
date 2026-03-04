import { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings as SettingsIcon, Calendar, Upload, Pencil, Check, X, Activity, Flag, Heart, User, TrendingUp, Flame, Route, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CoachInfoCard from '@/components/dashboard/CoachInfoCard';
import RacePicker from '@/components/races/RacePicker';
import { useTranslation } from 'react-i18next';

const FITNESS_LEVELS = [
  { value: 'beginner', labelKey: 'onboarding.beginner' },
  { value: 'intermediate', labelKey: 'onboarding.intermediate' },
  { value: 'advanced', labelKey: 'onboarding.advanced' },
  { value: 'elite', labelKey: 'onboarding.elite' },
];

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, currentRole, effectiveRole, signOut } = useAuth();
  const name = user?.user_metadata?.full_name || 'User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: completedSessions } = useQuery({
    queryKey: ['training-stats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('completed_sessions')
        .select('date, actual_distance_km')
        .eq('athlete_id', user.id)
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const trainingStats = useMemo(() => {
    if (!completedSessions || completedSessions.length === 0) {
      return { totalSessions: 0, totalDistance: 0, currentStreak: 0 };
    }
    const totalSessions = completedSessions.length;
    const totalDistance = completedSessions.reduce((sum, s) => sum + (Number(s.actual_distance_km) || 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const uniqueDates = [...new Set(completedSessions.map(s => s.date))].sort().reverse();
    let streak = 0;
    const checkDate = new Date(today);
    const firstSessionDate = uniqueDates[0] ? new Date(uniqueDates[0] + 'T00:00:00') : null;
    if (firstSessionDate) {
      const diffFromToday = Math.floor((today.getTime() - firstSessionDate.getTime()) / 86400000);
      if (diffFromToday > 1) return { totalSessions, totalDistance, currentStreak: 0 };
      checkDate.setTime(firstSessionDate.getTime());
    }
    for (const dateStr of uniqueDates) {
      const d = new Date(dateStr + 'T00:00:00');
      if (d.getTime() === checkDate.getTime()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (d.getTime() < checkDate.getTime()) {
        break;
      }
    }
    return { totalSessions, totalDistance, currentStreak: streak };
  }, [completedSessions]);

  const [editingBio, setEditingBio] = useState(false);
  const [bioForm, setBioForm] = useState({ age: '', weight_kg: '', max_hr: '', fitness_level: 'intermediate' });

  const startEditBio = () => {
    setBioForm({
      age: profile?.age?.toString() || '',
      weight_kg: profile?.weight_kg?.toString() || '',
      max_hr: profile?.max_hr?.toString() || '',
      fitness_level: profile?.fitness_level || 'intermediate',
    });
    setEditingBio(true);
  };

  const saveBio = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      age: bioForm.age ? parseInt(bioForm.age) : null,
      weight_kg: bioForm.weight_kg ? parseFloat(bioForm.weight_kg) : null,
      max_hr: bioForm.max_hr ? parseInt(bioForm.max_hr) : null,
      fitness_level: bioForm.fitness_level,
    } as any).eq('id', user!.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success(t('profile.profileUpdated'));
    setEditingBio(false);
    queryClient.invalidateQueries({ queryKey: ['profile-full'] });
    queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
  };

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ goal_race_name: '', goal_race_date: '', goal_race_location: '', goal_race_id: '' });

  const startEditGoal = () => {
    setGoalForm({
      goal_race_name: profile?.goal_race_name || '',
      goal_race_date: profile?.goal_race_date || '',
      goal_race_location: profile?.goal_race_location || '',
      goal_race_id: (profile as any)?.goal_race_id || '',
    });
    setEditingGoal(true);
  };

  const handleRaceSelected = (race: any) => {
    setGoalForm({
      goal_race_name: race.race_name,
      goal_race_date: race.race_date,
      goal_race_location: race.city ? `${race.city}, ${race.country}` : race.country,
      goal_race_id: race.id,
    });
  };

  const saveGoal = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      goal_race_name: goalForm.goal_race_name.trim() || null,
      goal_race_date: goalForm.goal_race_date || null,
      goal_race_location: goalForm.goal_race_location.trim() || null,
      goal_race_id: goalForm.goal_race_id || null,
    } as any).eq('id', user!.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success(t('profile.goalRaceUpdated'));
    setEditingGoal(false);
    queryClient.invalidateQueries({ queryKey: ['profile-full'] });
    queryClient.invalidateQueries({ queryKey: ['profile-goal-race'] });
    queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    if (!authError) {
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user!.id);
      toast.success(t('profile.profileUpdated'));
      setEditing(false);
    } else {
      toast.error('Failed to update: ' + authError.message);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${ext}`;
    await supabase.storage.from('avatars').remove([filePath]);
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl } as any).eq('id', user.id);
    setUploadingAvatar(false);
    if (updateError) { toast.error('Failed to save avatar'); return; }
    toast.success(t('profile.avatarUpdated'));
    queryClient.invalidateQueries({ queryKey: ['profile-full'] });
    queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar className="h-16 w-16 border-2 border-primary/30">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
              <AvatarFallback className="gradient-hyrox text-primary-foreground text-lg font-display">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploadingAvatar ? (
                <div className="h-5 w-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <Label className="text-xs">{t('auth.fullName')}</Label>
                <div className="flex gap-2">
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-9" maxLength={100} autoFocus />
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-success" onClick={handleSaveName} disabled={saving}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setEditing(false); setFullName(name); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-xl font-display font-bold">{name}</h1>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge variant="secondary" className="mt-1 capitalize">{(effectiveRole || 'athlete').replace('_', ' ')}</Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Biometrics Card */}
        <Card className="glass">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" /> {t('profile.biometrics')}
            </CardTitle>
            {!editingBio && (
              <Button variant="ghost" size="sm" onClick={startEditBio}>
                <Pencil className="h-3 w-3 mr-1" /> {t('profile.edit')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingBio ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.age')}</Label>
                    <Input type="number" value={bioForm.age} onChange={e => setBioForm(f => ({ ...f, age: e.target.value }))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.weightKg')}</Label>
                    <Input type="number" step="0.1" value={bioForm.weight_kg} onChange={e => setBioForm(f => ({ ...f, weight_kg: e.target.value }))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.maxHr')}</Label>
                    <Input type="number" value={bioForm.max_hr} onChange={e => setBioForm(f => ({ ...f, max_hr: e.target.value }))} className="h-8" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('onboarding.fitnessLevel')}</Label>
                  <Select value={bioForm.fitness_level} onValueChange={v => setBioForm(f => ({ ...f, fitness_level: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FITNESS_LEVELS.map(fl => <SelectItem key={fl.value} value={fl.value}>{t(fl.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingBio(false)}>{t('profile.cancel')}</Button>
                  <Button size="sm" className="gradient-hyrox" onClick={saveBio} disabled={saving}>{saving ? t('profile.saving') : t('profile.save')}</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <div><span className="text-muted-foreground text-xs">{t('onboarding.age')}</span><p className="font-medium">{profile?.age || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">{t('onboarding.weightKg').replace(' (kg)', '')}</span><p className="font-medium">{profile?.weight_kg ? `${profile.weight_kg} kg` : '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">{t('onboarding.maxHr').replace(' HR', ' HR')}</span><p className="font-medium">{profile?.max_hr ? `${profile.max_hr} ${t('common.bpm')}` : '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">{t('onboarding.fitnessLevel')}</span><p className="font-medium capitalize">{profile?.fitness_level || '—'}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal Race Card */}
        <Card className="glass">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary" /> {t('profile.goalRace')}
            </CardTitle>
            {!editingGoal && (
              <Button variant="ghost" size="sm" onClick={startEditGoal}>
                <Pencil className="h-3 w-3 mr-1" /> {t('profile.edit')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingGoal ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('onboarding.raceName')}</Label>
                  <Input value={goalForm.goal_race_name} onChange={e => setGoalForm(f => ({ ...f, goal_race_name: e.target.value }))} className="h-8" placeholder="HYROX Munich 2025" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.raceDate')}</Label>
                    <Input type="date" value={goalForm.goal_race_date} onChange={e => setGoalForm(f => ({ ...f, goal_race_date: e.target.value }))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('onboarding.location')}</Label>
                    <Input value={goalForm.goal_race_location} onChange={e => setGoalForm(f => ({ ...f, goal_race_location: e.target.value }))} className="h-8" placeholder="Munich, DE" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingGoal(false)}>{t('profile.cancel')}</Button>
                  <Button size="sm" className="gradient-hyrox" onClick={saveGoal} disabled={saving}>{saving ? t('profile.saving') : t('profile.save')}</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {profile?.goal_race_date ? (
                  <div className="space-y-1">
                    <p className="font-medium">{profile.goal_race_name || t('profile.goalRace')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(profile.goal_race_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {profile.goal_race_location && ` · ${profile.goal_race_location}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('profile.noGoalRace')}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Stats */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> {t('profile.trainingSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold font-display">{trainingStats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">{t('profile.totalSessions')}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <Route className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold font-display">{trainingStats.totalDistance.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{t('profile.totalKm')}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <Flame className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold font-display">{trainingStats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">{t('profile.dayStreak')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coach Info */}
        <CoachInfoCard />

        {/* Quick Actions */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">{t('profile.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Button variant="ghost" className="w-full justify-start h-11" onClick={() => navigate('/plans')}>
              <Upload className="h-4 w-4 mr-3 text-muted-foreground" />
              {t('profile.importBuildPlan')}
            </Button>
            <Button variant="ghost" className="w-full justify-start h-11" onClick={() => navigate('/schedule')}>
              <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
              {t('profile.googleCalendarSync')}
            </Button>
            <Button variant="ghost" className="w-full justify-start h-11" onClick={() => navigate('/settings')}>
              <SettingsIcon className="h-4 w-4 mr-3 text-muted-foreground" />
              {t('profile.settings')}
            </Button>
            <Button variant="ghost" className="w-full justify-start h-11" onClick={() => navigate('/activity')}>
              <Activity className="h-4 w-4 mr-3 text-muted-foreground" />
              {t('profile.activityLog')}
            </Button>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> {t('profile.signOut')}
        </Button>
      </motion.div>
    </div>
  );
}
