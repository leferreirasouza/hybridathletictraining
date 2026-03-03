import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flag, MapPin, Target, ChevronRight } from 'lucide-react';
import { differenceInDays, differenceInWeeks, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function GoalRaceCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile-goal-race', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return data as any;
    },
    enabled: !!user,
  });

  if (!profile?.goal_race_date) {
    // No goal race set — show CTA
    return (
      <Card className="glass border-dashed border-primary/30 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/profile')}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Flag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-display font-bold">Set Your Goal Race</p>
            <p className="text-xs text-muted-foreground">Add a target race to power your countdown & plan</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const raceDateObj = new Date(profile.goal_race_date + 'T00:00:00');
  const daysUntil = differenceInDays(raceDateObj, new Date());
  const weeksUntil = differenceInWeeks(raceDateObj, new Date());

  if (daysUntil < 0) return null; // past race

  return (
    <Card className="glass overflow-hidden border-primary/20">
      <div className="h-1 gradient-hyrox" />
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(1, daysUntil / 120))}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-display font-bold leading-none">{daysUntil}</span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">days</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-sm font-display font-bold truncate">
                {profile.goal_race_name || 'Goal Race'}
              </p>
            </div>
            {profile.goal_race_location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {profile.goal_race_location}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(raceDateObj, 'EEEE, MMMM d, yyyy')}
            </p>
            <Badge variant="secondary" className="mt-1.5 text-[10px] bg-primary/10 text-primary border-0">
              {weeksUntil} weeks to go
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
