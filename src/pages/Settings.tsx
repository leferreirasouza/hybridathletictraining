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
import { ArrowLeft, Moon, Sun, Ruler, Bell, ShieldCheck, Trash2, BellRing, BellOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  getNotifPrefs, setNotifPref, setTrainingTime,
  requestNotificationPermission, getNotificationPermission,
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

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [units, setUnits] = useState<Units>(getStoredUnits);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState(getNotifPrefs);
  const [permStatus, setPermStatus] = useState(getNotificationPermission);

  const updateNotifPref = (key: 'enabled' | 'nightBefore' | 'hourBefore', value: boolean) => {
    setNotifPref(key, value);
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleTrainingTimeChange = (time: string) => {
    setTrainingTime(time);
    const hourBefore = !!time;
    if (!time) setNotifPref('hourBefore', false);
    setNotifPrefs(prev => ({ ...prev, trainingTime: time, hourBefore: time ? prev.hourBefore : false }));
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermStatus(getNotificationPermission());
    if (granted) {
      updateNotifPref('enabled', true);
      toast.success('Notifications enabled!');
    } else {
      toast.error('Notification permission denied. Check your browser settings.');
    }
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
    toast.info('Account deletion request sent. Contact support to complete this process.');
    setConfirmDelete(false);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-display font-bold">Settings</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Appearance */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
              Appearance
            </CardTitle>
            <CardDescription>Choose how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-select">Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
                <SelectTrigger className="w-32" id="theme-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
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
              Units & Measurement
            </CardTitle>
            <CardDescription>Distance and weight display</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="units-select">Unit System</Label>
              <Select value={units} onValueChange={(v) => setUnits(v as Units)}>
                <SelectTrigger className="w-32" id="units-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric (km, kg)</SelectItem>
                  <SelectItem value="imperial">Imperial (mi, lb)</SelectItem>
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
              Notifications
            </CardTitle>
            <CardDescription>Training reminders and updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permStatus === 'unsupported' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellOff className="h-4 w-4" />
                Notifications not supported in this browser
              </div>
            ) : permStatus === 'denied' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <BellOff className="h-4 w-4" />
                  Notifications blocked
                </div>
                <p className="text-xs text-muted-foreground">
                  Enable notifications in your browser settings to receive training reminders.
                </p>
              </div>
            ) : permStatus !== 'granted' ? (
              <Button variant="outline" className="w-full" onClick={handleEnableNotifications}>
                <BellRing className="h-4 w-4 mr-2" /> Enable Notifications
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notif-master">Session Reminders</Label>
                    <p className="text-[11px] text-muted-foreground">Master toggle for all reminders</p>
                  </div>
                  <Switch
                    id="notif-master"
                    checked={notifPrefs.enabled}
                    onCheckedChange={(v) => updateNotifPref('enabled', v)}
                  />
                </div>
                {notifPrefs.enabled && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notif-night" className="text-sm">Night Before</Label>
                        <p className="text-[11px] text-muted-foreground">Reminder at 8 PM</p>
                      </div>
                      <Switch
                        id="notif-night"
                        checked={notifPrefs.nightBefore}
                        onCheckedChange={(v) => updateNotifPref('nightBefore', v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="notif-hour" className="text-sm">1 Hour Before</Label>
                          <p className="text-[11px] text-muted-foreground">
                            {notifPrefs.trainingTime
                              ? `Reminder at ${(() => { const [h,m] = notifPrefs.trainingTime.split(':').map(Number); const rh = h-1 < 0 ? 23 : h-1; return `${String(rh).padStart(2,'0')}:${String(m).padStart(2,'0')}`; })()}`
                              : 'Set your training time to enable'}
                          </p>
                        </div>
                        <Switch
                          id="notif-hour"
                          checked={notifPrefs.hourBefore}
                          onCheckedChange={(v) => updateNotifPref('hourBefore', v)}
                          disabled={!notifPrefs.trainingTime}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="training-time" className="text-xs text-muted-foreground whitespace-nowrap">Training time</Label>
                        <input
                          id="training-time"
                          type="time"
                          value={notifPrefs.trainingTime}
                          onChange={(e) => handleTrainingTimeChange(e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                        />
                        {notifPrefs.trainingTime && (
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => handleTrainingTimeChange('')}>
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  ✓ Browser notifications enabled
                </Badge>
              </>
            )}
          </CardContent>
        </Card>

        {/* Account & Privacy */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Account & Privacy
            </CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Delete Account
                </p>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
              <Button
                variant={confirmDelete ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleDeleteAccount}
              >
                {confirmDelete ? 'Confirm' : 'Delete'}
              </Button>
            </div>
            {confirmDelete && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pt-2">
          Hybrid Athletics v1.0 — Built for performance
        </p>
      </motion.div>
    </div>
  );
}
