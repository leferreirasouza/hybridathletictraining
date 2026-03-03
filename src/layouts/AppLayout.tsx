import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Dumbbell, Mail, User, Shield, Eye, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth, getAccessibleRoles } from '@/contexts/AuthContext';
import { useSessionReminders } from '@/hooks/useSessionReminders';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const roleLabels: Record<string, string> = {
  master_admin: 'Master Admin',
  admin: 'Admin',
  coach: 'Coach',
  athlete: 'Athlete',
};

const tabsByRole: Record<string, { path: string; icon: any; label: string }[]> = {
  athlete: [
    { path: '/dashboard', icon: Home, label: 'Today' },
    { path: '/schedule', icon: Calendar, label: 'Plan' },
    { path: '/log', icon: Dumbbell, label: 'Log' },
    { path: '/messages', icon: Mail, label: 'Chat' },
    { path: '/profile', icon: User, label: 'Profile' },
  ],
  coach: [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/athletes', icon: User, label: 'Athletes' },
    { path: '/messages', icon: Mail, label: 'Chat' },
    { path: '/plans', icon: Calendar, label: 'Plans' },
    { path: '/profile', icon: User, label: 'Profile' },
  ],
  admin: [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/admin', icon: Shield, label: 'Manage' },
    { path: '/athletes', icon: User, label: 'Athletes' },
    { path: '/messages', icon: Mail, label: 'Chat' },
    { path: '/profile', icon: User, label: 'Profile' },
  ],
  master_admin: [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/admin', icon: Shield, label: 'Admin' },
    { path: '/messages', icon: Mail, label: 'Chat' },
    { path: '/plans', icon: Calendar, label: 'Plans' },
    { path: '/profile', icon: User, label: 'Profile' },
  ],
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, effectiveRole, viewAsRole, setViewAsRole, user } = useAuth();
  const queryClient = useQueryClient();

  useSessionReminders(user?.id);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-message-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null);
      return error ? 0 : (count ?? 0);
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('nav-unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        if ((payload.new as any).recipient_id === user.id) {
          queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const activeRole = effectiveRole ?? 'athlete';
  const tabs = tabsByRole[activeRole] ?? tabsByRole.athlete;

  // Accessible roles for the switcher
  const accessibleRoles = currentRole ? getAccessibleRoles(currentRole) : [];
  const showSwitcher = accessibleRoles.length > 1;
  const isViewingAs = viewAsRole && viewAsRole !== currentRole;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top header bar with bell */}
      <header className={cn(
        "sticky top-0 z-40 glass border-b flex items-center justify-between px-4 h-12",
        !isViewingAs && "safe-top"
      )}>
        <span className="text-sm font-display font-bold text-foreground">Hybrid Athletics</span>
        <button
          onClick={() => navigate('/messages')}
          className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
          aria-label="Messages"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* View-As banner */}
      {isViewingAs && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center justify-center gap-2">
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            Viewing as {roleLabels[viewAsRole!]}
          </span>
          <button
            onClick={() => setViewAsRole(currentRole!)}
            className="text-xs text-primary underline ml-2"
          >
            Exit
          </button>
        </div>
      )}

      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t safe-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path ||
              (tab.path !== '/dashboard' && location.pathname.startsWith(tab.path));
            const showBadge = tab.path === '/messages' && unreadCount > 0;

            // Replace profile tab with role switcher if available
            if (tab.path === '/profile' && showSwitcher) {
              return (
                <DropdownMenu key="profile-switcher">
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors relative",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}>
                      {isActive && (
                        <motion.div layoutId="tab-indicator"
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full gradient-hyrox"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                      )}
                      <User className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Menu</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 mb-2">
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="h-4 w-4 mr-2" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Eye className="h-3 w-3" /> Switch View
                    </DropdownMenuLabel>
                    {accessibleRoles.map(role => (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => setViewAsRole(role)}
                        className={cn(activeRole === role && "bg-primary/10 text-primary")}
                      >
                        {roleLabels[role]}
                        {role === currentRole && (
                          <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">yours</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

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
                  <motion.div layoutId="tab-indicator"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full gradient-hyrox"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                )}
                <div className="relative">
                  <tab.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
