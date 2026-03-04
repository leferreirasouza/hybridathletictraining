import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';

interface DesktopSidebarProps {
  tabs: { path: string; icon: any; label: string }[];
  unreadCount: number;
  avatarUrl?: string;
  userName: string;
  userInitials: string;
  showSwitcher: boolean;
  accessibleRoles: string[];
  activeRole: string;
  currentRole: string | null;
  roleLabels: Record<string, string>;
  setViewAsRole: (role: string) => void;
}

export function DesktopSidebar({
  tabs,
  unreadCount,
  avatarUrl,
  userName,
  userInitials,
  showSwitcher,
  accessibleRoles,
  activeRole,
  currentRole,
  roleLabels,
  setViewAsRole,
}: DesktopSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-40">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
        <span className="font-display font-bold text-sidebar-foreground text-base tracking-tight">
          {t('app.name')}
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        {tabs.filter(tab => tab.path !== '/profile').map((tab) => {
          const isActive = location.pathname === tab.path ||
            (tab.path !== '/dashboard' && location.pathname.startsWith(tab.path));
          const showBadge = tab.path === '/messages' && unreadCount > 0;

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <tab.icon className="h-4.5 w-4.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {showBadge && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Role switcher */}
      {showSwitcher && (
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-1.5 font-medium">
            {t('nav.switchView')}
          </p>
          {accessibleRoles.map(role => (
            <button
              key={role}
              onClick={() => setViewAsRole(role)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
                activeRole === role
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              {roleLabels[role]}
              {role === currentRole && (
                <Badge variant="secondary" className="ml-auto text-[8px] px-1 py-0 bg-sidebar-accent text-sidebar-foreground/60 border-0">
                  {t('nav.yours')}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"
        >
          <Avatar className="h-8 w-8 border border-sidebar-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
            <AvatarFallback className="text-[10px] font-bold gradient-hyrox text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">{roleLabels[activeRole]}</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
