import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileCompletionCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile-completion', user?.id],
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

  if (!profile) return null;

  const fields = [
    { label: 'Name', filled: !!profile.full_name },
    { label: 'Age', filled: !!profile.age },
    { label: 'Weight', filled: !!profile.weight_kg },
    { label: 'Max HR', filled: !!profile.max_hr },
    { label: 'Fitness Level', filled: !!profile.fitness_level },
    { label: 'Goal Race', filled: !!profile.goal_race_date },
  ];

  const filledCount = fields.filter(f => f.filled).length;
  const pct = Math.round((filledCount / fields.length) * 100);

  if (pct === 100) return null;

  return (
    <Card className="glass border-primary/20 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate('/profile')}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-bold">Complete Your Profile</p>
            <p className="text-xs text-muted-foreground">
              {filledCount}/{fields.length} fields — better data = better plans
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        <Progress value={pct} className="h-1.5" />
        <div className="flex flex-wrap gap-1.5">
          {fields.filter(f => !f.filled).map(f => (
            <span key={f.label} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {f.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
