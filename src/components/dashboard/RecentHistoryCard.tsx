import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function RecentHistoryCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ['dashboard-recent-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('id, date, discipline, actual_duration_min, actual_distance_km, rpe, source')
        .eq('athlete_id', user!.id)
        .order('date', { ascending: false })
        .limit(6);
      return error ? [] : data ?? [];
    },
    enabled: !!user,
  });

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display">
            {t('dashboard.recentHistory', { defaultValue: 'Recent sessions' })}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            {t('dashboard.viewAll')} <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.noCompletedSessions', { defaultValue: 'No completed sessions yet.' })}
          </p>
        ) : (
          data.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
              <div>
                <p className="font-medium capitalize">
                  {t(`dashboard.disciplines.${s.discipline}`, { defaultValue: s.discipline.replace('_', ' ') })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {s.date} · {s.source === 'manual' ? t('dashboard.sourceManual', { defaultValue: 'Manual' }) : s.source}
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {s.actual_distance_km ? `${Number(s.actual_distance_km).toFixed(1)} ${t('common.km')} · ` : ''}
                {s.actual_duration_min ? `${Math.round(Number(s.actual_duration_min))} ${t('common.min')}` : ''}
                {s.rpe ? ` · RPE ${s.rpe}` : ''}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
