import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  estimateMaxHr,
  maxHrAdvice,
  MAX_HR_LOOKBACK_DAYS,
} from '../../../supabase/functions/_shared/maxHrEstimate.ts';

const dismissKey = (userId: string, bpm: number) => `maxhr-dismissed:${userId}:${bpm}`;

function isDismissed(userId: string, bpm: number): boolean {
  try {
    return localStorage.getItem(dismissKey(userId, bpm)) === '1';
  } catch {
    return false;
  }
}

/**
 * Max HR drives training load (session_trimp) and the HR checks on imported
 * workouts. Only 3 of 15 profiles had one, so this card suggests a value from
 * the athlete's own sessions (_shared/maxHrEstimate.ts) — or flags a profile
 * value the data clearly exceeds. Nothing is saved until the athlete confirms.
 */
export default function MaxHrCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  const { data: advice } = useQuery({
    queryKey: ['max-hr-advice', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const since = new Date(Date.now() - MAX_HR_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
      const [{ data: profile }, { data: sessions }] = await Promise.all([
        supabase.from('profiles').select('max_hr').eq('id', user.id).maybeSingle(),
        supabase
          .from('completed_sessions')
          .select('max_hr, data_flags')
          .eq('athlete_id', user.id)
          .not('max_hr', 'is', null)
          .gte('date', since),
      ]);
      const maxima = (sessions ?? [])
        .filter((s) => !(s.data_flags ?? []).includes('max_hr_artifact'))
        .map((s) => s.max_hr);
      return maxHrAdvice(profile?.max_hr ?? null, estimateMaxHr(maxima));
    },
  });

  if (!user || !advice || advice.kind === 'none' || hidden) return null;
  if (advice.kind === 'raise' && isDismissed(user.id, advice.bpm)) return null;

  const save = async (bpm: number) => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ max_hr: bpm }).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error(t('maxHr.saveFailed'));
      return;
    }
    toast.success(t('maxHr.saved', { bpm }));
    queryClient.invalidateQueries({ queryKey: ['max-hr-advice'] });
    queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
    queryClient.invalidateQueries({ queryKey: ['profile-full'] });
  };

  const keepCurrent = () => {
    if (advice.kind !== 'raise') return;
    try {
      localStorage.setItem(dismissKey(user.id, advice.bpm), '1');
    } catch {
      // Private mode: just hide for this visit.
    }
    setHidden(true);
  };

  return (
    <Card className="glass border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <HeartPulse className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-display font-bold">{t(`maxHr.title_${advice.kind}`)}</p>
            <p className="text-xs text-muted-foreground">
              {advice.kind === 'use_estimate' && t('maxHr.body_use_estimate', { bpm: advice.bpm, count: advice.sampleSize })}
              {advice.kind === 'raise' && t('maxHr.body_raise', { bpm: advice.bpm, current: advice.current, count: advice.sampleSize })}
              {advice.kind === 'enter' && t('maxHr.body_enter')}
            </p>
            {advice.kind !== 'enter' && <p className="text-[11px] text-muted-foreground">{t('maxHr.why')}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {advice.kind === 'use_estimate' && (
            <Button size="sm" disabled={saving} onClick={() => save(advice.bpm)}>{t('maxHr.use', { bpm: advice.bpm })}</Button>
          )}
          {advice.kind === 'raise' && (
            <>
              <Button size="sm" disabled={saving} onClick={() => save(advice.bpm)}>{t('maxHr.update', { bpm: advice.bpm })}</Button>
              <Button size="sm" variant="outline" onClick={keepCurrent}>{t('maxHr.keep', { bpm: advice.current })}</Button>
            </>
          )}
          <Button size="sm" variant={advice.kind === 'enter' ? 'default' : 'ghost'} onClick={() => navigate('/profile')}>
            {t('maxHr.enterOwn')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
