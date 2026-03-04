import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Dumbbell, Mail, User, Shield, Eye, Bell, MessageSquare, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth, getAccessibleRoles } from '@/contexts/AuthContext';
import { useSessionReminders } from '@/hooks/useSessionReminders';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

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
    { path: '/exercises', icon: BookOpen, label: 'Library' },
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

  const userName = user?.user_metadata?.full_name || 'User';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const { data: profile } = useQuery({
    queryKey: ['profile-avatar', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).single();
      return data as any;
    },
    enabled: !!user,
  });

  const avatarUrl = profile?.avatar_url;

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

  const [bellOpen, setBellOpen] = useState(false);

  const { data: recentUnread = [] } = useQuery({
    queryKey: ['unread-messages-preview', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('direct_messages')
        .select('id, content, created_at, sender_id')
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error || !data?.length) return [];

      // Fetch sender names
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);
      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

      return data.map(m => ({
        ...m,
        sender_name: nameMap.get(m.sender_id) || 'Unknown',
      }));
    },
    enabled: !!user && bellOpen,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('nav-unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
         if ((payload.new as any).recipient_id === user.id) {
          queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-preview'] });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
        queryClient.invalidateQueries({ queryKey: ['unread-messages-preview'] });
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-bold text-foreground">Hybrid Athletics</span>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={bellOpen} onOpenChange={setBellOpen}>
            <PopoverTrigger asChild>
            <button
              className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-display font-bold">Notifications</p>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <ScrollArea className="max-h-[320px]">
              {recentUnread.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No unread messages</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentUnread.map((msg: any) => (
                    <button
                      key={msg.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setBellOpen(false);
                        navigate('/messages');
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{msg.sender_name}</p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: false })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{msg.content}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => { setBellOpen(false); navigate('/messages'); }}
              >
                View all messages
              </Button>
            </div>
          </PopoverContent>
          </Popover>
          <button onClick={() => navigate('/profile')} className="ml-1">
            <Avatar className="h-7 w-7 border border-border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="text-[10px] font-bold gradient-hyrox text-primary-foreground">{userInitials}</AvatarFallback>
            </Avatar>
          </button>
        </div>
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
                      <Avatar className="h-5 w-5 border border-border">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                        <AvatarFallback className="text-[7px] font-bold gradient-hyrox text-primary-foreground">{userInitials}</AvatarFallback>
                      </Avatar>
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
                  {tab.path === '/profile' ? (
                    <Avatar className="h-5 w-5 border border-border">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                      <AvatarFallback className="text-[7px] font-bold gradient-hyrox text-primary-foreground">{userInitials}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <tab.icon className="h-5 w-5" />
                  )}
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
