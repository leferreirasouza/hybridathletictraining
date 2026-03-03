import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Moon, Sun, Ruler, Bell, Globe, ShieldCheck, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

type Units = 'metric' | 'imperial';
type ThemeMode = 'light' | 'dark' | 'system';

function getStoredTheme(): ThemeMode {
  return (localStorage.getItem('ha-theme') as ThemeMode) || 'dark';
}
function getStoredUnits(): Units {
  return (localStorage.getItem('ha-units') as Units) || 'metric';
}
function getStoredNotifs(): boolean {
  return localStorage.getItem('ha-notifs') !== 'false';
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
  const [notifications, setNotifications] = useState(getStoredNotifs);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    localStorage.setItem('ha-theme', theme);
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ha-units', units);
  }, [units]);

  useEffect(() => {
    localStorage.setItem('ha-notifs', String(notifications));
  }, [notifications]);

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
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-toggle">Session Reminders</Label>
              <Switch
                id="notif-toggle"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
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
