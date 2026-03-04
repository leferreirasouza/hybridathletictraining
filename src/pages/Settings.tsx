import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Moon, Sun, Ruler, Bell, ShieldCheck, Trash2, BellRing, BellOff, Globe, CalendarPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  getNotifPrefs, setNotifPref, getTrainingTimes, setTrainingTimes,
  requestNotificationPermission, getNotificationPermission,
  DAY_LABELS, type DayTrainingTimes,
} from '@/hooks/useSessionReminders';

type Units = 'metric' | 'imperial';
type ThemeMode = 'light' | 'dark' | 'system';

function getStoredTheme(): ThemeMode {
  return (localStorage.getItem('ha-theme') as ThemeMode) || 'dark';
}
function getStoredUnits(): Units {
  return (localStorage.getItem('ha-units') as Units) || 'metric';
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (BR)' },
];

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [units, setUnits] = useState<Units>(getStoredUnits);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState(getNotifPrefs);
  const [permStatus, setPermStatus] = useState(getNotificationPermission);
  const [trainingTimes, setLocalTrainingTimes] = useState<DayTrainingTimes>(getTrainingTimes);

  const updateNotifPref = (key: 'enabled' | 'nightBefore' | 'hourBefore', value: boolean) => {
    setNotifPref(key, value);
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleDayTimeChange = (day: number, time: string) => {
    const updated = { ...trainingTimes, [day]: time };
    if (!time) delete updated[day];
    setTrainingTimes(updated);
    setLocalTrainingTimes(updated);
    const hasAny = Object.values(updated).some(t => !!t);
    if (!hasAny) setNotifPrefs(prev => ({ ...prev, hourBefore: false }));
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermStatus(getNotificationPermission());
    if (granted) {
      updateNotifPref('enabled', true);
      toast.success(t('settings.notifEnabledToast'));
    } else {
      toast.error(t('settings.notifDenied'));
    }
  };

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  useEffect(() => {
    localStorage.setItem('ha-theme', theme);
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ha-units', units);
  }, [units]);

  const handleDeleteAccount = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    toast.info(t('settings.deleteRequest'));
    setConfirmDelete(false);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-display font-bold">{t('settings.title')}</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Language */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              {t('settings.language')}
            </CardTitle>
            <CardDescription>{t('settings.languageDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="lang-select">{t('settings.languageLabel')}</Label>
              <Select value={i18n.language.startsWith('pt') ? 'pt-BR' : 'en'} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-40" id="lang-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
              {t('settings.appearance')}
            </CardTitle>
            <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-select">{t('settings.theme')}</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
                <SelectTrigger className="w-32" id="theme-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                  <SelectItem value="system">{t('settings.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Units */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" />
              {t('settings.units')}
            </CardTitle>
            <CardDescription>{t('settings.unitsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="units-select">{t('settings.unitSystem')}</Label>
              <Select value={units} onValueChange={(v) => setUnits(v as Units)}>
                <SelectTrigger className="w-32" id="units-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">{t('settings.metric')}</SelectItem>
                  <SelectItem value="imperial">{t('settings.imperial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              {t('settings.notifications')}
            </CardTitle>
            <CardDescription>{t('settings.notificationsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permStatus === 'unsupported' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellOff className="h-4 w-4" />
                {t('settings.notifUnsupported')}
              </div>
            ) : permStatus === 'denied' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <BellOff className="h-4 w-4" />
                  {t('settings.notifBlocked')}
                </div>
                <p className="text-xs text-muted-foreground">{t('settings.notifBlockedDesc')}</p>
              </div>
            ) : permStatus !== 'granted' ? (
              <Button variant="outline" className="w-full" onClick={handleEnableNotifications}>
                <BellRing className="h-4 w-4 mr-2" /> {t('settings.enableNotifications')}
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notif-master">{t('settings.sessionReminders')}</Label>
                    <p className="text-[11px] text-muted-foreground">{t('settings.masterToggle')}</p>
                  </div>
                  <Switch id="notif-master" checked={notifPrefs.enabled} onCheckedChange={(v) => updateNotifPref('enabled', v)} />
                </div>
                {notifPrefs.enabled && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notif-night" className="text-sm">{t('settings.nightBefore')}</Label>
                        <p className="text-[11px] text-muted-foreground">{t('settings.nightBeforeDesc')}</p>
                      </div>
                      <Switch id="notif-night" checked={notifPrefs.nightBefore} onCheckedChange={(v) => updateNotifPref('nightBefore', v)} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="notif-hour" className="text-sm">{t('settings.hourBefore')}</Label>
                          <p className="text-[11px] text-muted-foreground">
                            {Object.values(trainingTimes).some(t => !!t)
                              ? t('settings.hourBeforeSchedule')
                              : t('settings.hourBeforeSet')}
                          </p>
                        </div>
                        <Switch id="notif-hour" checked={notifPrefs.hourBefore} onCheckedChange={(v) => updateNotifPref('hourBefore', v)} disabled={!Object.values(trainingTimes).some(t => !!t)} />
                      </div>
                      <div className="space-y-1.5 pl-1">
                        <p className="text-[11px] font-medium text-muted-foreground">{t('settings.trainingTimes')}</p>
                        {[1, 2, 3, 4, 5, 6, 0].map(day => (
                          <div key={day} className="flex items-center justify-between gap-2">
                            <span className="text-xs w-20">{DAY_LABELS[day].slice(0, 3)}</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={trainingTimes[day] || ''}
                                onChange={(e) => handleDayTimeChange(day, e.target.value)}
                                className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground w-24"
                              />
                              {trainingTimes[day] && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleDayTimeChange(day, '')}>
                                  ×
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <Badge variant="secondary" className="text-[10px]">{t('settings.notifEnabled')}</Badge>
              </>
            )}
          </CardContent>
        </Card>

        {/* Account & Privacy */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t('settings.accountPrivacy')}
            </CardTitle>
            <CardDescription>{t('settings.accountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('auth.email')}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> {t('settings.deleteAccount')}
                </p>
                <p className="text-xs text-muted-foreground">{t('settings.deleteWarning')}</p>
              </div>
              <Button variant={confirmDelete ? 'destructive' : 'outline'} size="sm" onClick={handleDeleteAccount}>
                {confirmDelete ? t('settings.confirmDelete') : t('settings.delete')}
              </Button>
            </div>
            {confirmDelete && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmDelete(false)}>
                {t('profile.cancel')}
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pt-2">{t('app.version')}</p>
      </motion.div>
    </div>
  );
}
