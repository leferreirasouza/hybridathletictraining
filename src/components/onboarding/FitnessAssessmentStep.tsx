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
          <ClipboardCheck className="h-5 w-5 text-primary" /> Fitness Assessment
        </CardTitle>
        <CardDescription>
          Help us understand your background so we can personalize your training safely. All fields are optional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Training History */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Training History</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Years training</Label>
              <Input
                type="number"
                value={data.training_years}
                onChange={e => update('training_years', e.target.value)}
                placeholder="3"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Weekly hours</Label>
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
            <Label className="text-xs">Race experience</Label>
            <Textarea
              value={data.previous_race_experience}
              onChange={e => update('previous_race_experience', e.target.value)}
              placeholder="e.g., 2x HYROX Open, 1x half marathon..."
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        {/* Injury History */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Injury & Mobility</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Current injuries / pain areas</Label>
            <Input
              value={data.current_injuries}
              onChange={e => update('current_injuries', e.target.value)}
              placeholder="e.g., mild knee tendinitis"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Past injuries</Label>
            <Input
              value={data.past_injuries}
              onChange={e => update('past_injuries', e.target.value)}
              placeholder="e.g., ACL reconstruction 2022"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mobility limitations</Label>
            <Input
              value={data.mobility_limitations}
              onChange={e => update('mobility_limitations', e.target.value)}
              placeholder="e.g., limited ankle dorsiflexion"
              className="h-9"
            />
          </div>
        </div>

        {/* Health & Lifestyle */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Health & Lifestyle</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Resting HR (bpm)</Label>
              <Input
                type="number"
                value={data.resting_hr}
                onChange={e => update('resting_hr', e.target.value)}
                placeholder="62"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Avg sleep (hours)</Label>
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
              <Label className="text-xs">Stress level</Label>
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
              <Label className="text-xs">Nutrition quality</Label>
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
