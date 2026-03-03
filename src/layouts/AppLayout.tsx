import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Dumbbell, MessageSquare, User, BarChart3, Shield, ClipboardList, Trophy, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionReminders } from '@/hooks/useSessionReminders';

const athleteTabs = [
  { path: '/dashboard', icon: Home, label: 'Today' },
  { path: '/schedule', icon: Calendar, label: 'Plan' },
  { path: '/log', icon: Dumbbell, label: 'Log' },
  { path: '/analytics', icon: TrendingUp, label: 'Stats' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const coachTabs = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/athletes', icon: User, label: 'Athletes' },
  { path: '/plans', icon: Calendar, label: 'Plans' },
  { path: '/ai', icon: MessageSquare, label: 'AI' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const adminTabs = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/admin', icon: Shield, label: 'Admin' },
  { path: '/athletes', icon: User, label: 'Athletes' },
  { path: '/plans', icon: Calendar, label: 'Plans' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, user } = useAuth();

  // Fire browser notification reminders while app is open
  useSessionReminders(user?.id);

  const tabs = currentRole === 'master_admin' ? adminTabs : currentRole === 'coach' ? coachTabs : athleteTabs;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pb-20 safe-top">
        <Outlet />
      </main>

      {/* Bottom Tab Bar — mobile-first */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t safe-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path ||
              (tab.path !== '/dashboard' && location.pathname.startsWith(tab.path));
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors relative",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full gradient-hyrox"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
