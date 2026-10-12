import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FitnessAssessmentData {
  training_years: string;
  weekly_training_hours: string;
  previous_race_experience: string;
  current_injuries: string;
  past_injuries: string;
  mobility_limitations: string;
  resting_hr: string;
  sleep_hours_avg: string;
  stress_level: number;
  nutrition_quality: number;
}

interface Props {
  data: FitnessAssessmentData;
  onChange: (data: FitnessAssessmentData) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function FitnessAssessmentStep({ data, onChange, onNext, onBack }: Props) {
  const { t } = useTranslation();

  const update = (key: keyof FitnessAssessmentData, value: string | number) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />  {t('auto.k204')}
        </CardTitle>
        <CardDescription>
          
          {t('auto.k236')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Training History */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('auto.k587')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('auto.k643')}</Label>
              <Input
                type="number"
                value={data.training_years}
                onChange={e => update('training_years', e.target.value)}
                placeholder="3"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('auto.k621')}</Label>
              <Input
                type="number"
                step="0.5"
                value={data.weekly_training_hours}
                onChange={e => update('weekly_training_hours', e.target.value)}
                placeholder="6"
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('auto.k434')}</Label>
            <Textarea
              value={data.previous_race_experience}
              onChange={e => update('previous_race_experience', e.target.value)}
              placeholder={t('auto.k166')}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        {/* Injury History */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('auto.k259')}</p>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('auto.k128')}</Label>
            <Input
              value={data.current_injuries}
              onChange={e => update('current_injuries', e.target.value)}
              placeholder={t('auto.k169')}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('auto.k379')}</Label>
            <Input
              value={data.past_injuries}
              onChange={e => update('past_injuries', e.target.value)}
              placeholder={t('auto.k167')}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('auto.k308')}</Label>
            <Input
              value={data.mobility_limitations}
              onChange={e => update('mobility_limitations', e.target.value)}
              placeholder={t('auto.k168')}
              className="h-9"
            />
          </div>
        </div>

        {/* Health & Lifestyle */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('auto.k232')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('auto.k452')}</Label>
              <Input
                type="number"
                value={data.resting_hr}
                onChange={e => update('resting_hr', e.target.value)}
                placeholder="62"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('auto.k82')}</Label>
              <Input
                type="number"
                step="0.5"
                value={data.sleep_hours_avg}
                onChange={e => update('sleep_hours_avg', e.target.value)}
                placeholder="7.5"
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('auto.k527')}</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{data.stress_level}/10</span>
            </div>
            <Slider
              value={[data.stress_level]}
              onValueChange={([v]) => update('stress_level', v)}
              min={1}
              max={10}
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Low</span><span>High</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{t('auto.k363')}</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{data.nutrition_quality}/10</span>
            </div>
            <Slider
              value={[data.nutrition_quality]}
              onValueChange={([v]) => update('nutrition_quality', v)}
              min={1}
              max={10}
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Poor</span><span>Excellent</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t('onboarding.back')}
          </Button>
          <Button className="flex-1 gradient-hyrox" onClick={onNext}>
            {t('onboarding.continue')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
