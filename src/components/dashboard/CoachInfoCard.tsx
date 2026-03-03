import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

export default function CoachInfoCard() {
  const { user } = useAuth();

  const { data: coaches } = useQuery({
    queryKey: ['my-coaches', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // First get assignments
      const { data: assignments, error } = await supabase
        .from('coach_athlete_assignments')
        .select('coach_id, coach_type')
        .eq('athlete_id', user.id);
      if (error || !assignments?.length) return [];
      
      // Then fetch coach names
      const coachIds = assignments.map(a => a.coach_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', coachIds);
      
      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
      return assignments.map(a => ({
        ...a,
        full_name: nameMap.get(a.coach_id) || 'Coach',
      }));
    },
    enabled: !!user,
  });

  if (!coaches || coaches.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">No coach assigned yet — your admin will set this up</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> Your Coaches
        </p>
        {coaches.map((c: any) => (
          <div key={c.coach_id} className="flex items-center justify-between text-sm">
            <span className="font-medium">{c.full_name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">{c.coach_type}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
