import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, Shield, Calendar, Upload, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
  const { user, currentRole, signOut } = useAuth();
  const name = user?.user_metadata?.full_name || 'User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/30">
            <AvatarFallback className="gradient-hyrox text-primary-foreground text-lg font-display">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-display font-bold">{name}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-1 capitalize">{currentRole || 'athlete'}</Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { icon: Upload, label: 'Import Plan (CSV/XLSX)', action: () => {} },
              { icon: Download, label: 'Export Plan', action: () => {} },
              { icon: Calendar, label: 'Google Calendar Sync', action: () => {} },
              { icon: Shield, label: 'Health Data Permissions', action: () => {} },
              { icon: Settings, label: 'Settings', action: () => {} },
            ].map((item) => (
              <Button key={item.label} variant="ghost" className="w-full justify-start h-11" onClick={item.action}>
                <item.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                {item.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </motion.div>
    </div>
  );
}
