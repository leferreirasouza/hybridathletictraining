import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck, AlertTriangle, HeartPulse } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ParqAnswers {
  q1_heart_condition: boolean;
  q2_chest_pain_activity: boolean;
  q3_chest_pain_rest: boolean;
  q4_dizziness: boolean;
  q5_bone_joint: boolean;
  q6_blood_pressure_meds: boolean;
  q7_other_reason: boolean;
  medical_notes: string;
  risk_acknowledged: boolean;
}

interface ParqStepProps {
  answers: ParqAnswers;
  onChange: (answers: ParqAnswers) => void;
  onNext: () => void;
  onBack: () => void;
}

const PARQ_QUESTIONS = [
  { key: 'q1_heart_condition', text: 'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?' },
  { key: 'q2_chest_pain_activity', text: 'Do you feel pain in your chest when you do physical activity?' },
  { key: 'q3_chest_pain_rest', text: 'In the past month, have you had chest pain when you were not doing physical activity?' },
  { key: 'q4_dizziness', text: 'Do you lose your balance because of dizziness or do you ever lose consciousness?' },
  { key: 'q5_bone_joint', text: 'Do you have a bone or joint problem (e.g., back, knee, or hip) that could be made worse by a change in your physical activity?' },
  { key: 'q6_blood_pressure_meds', text: 'Is your doctor currently prescribing drugs for your blood pressure or heart condition?' },
  { key: 'q7_other_reason', text: 'Do you know of any other reason why you should not do physical activity?' },
];

export default function ParqStep({ answers, onChange, onNext, onBack }: ParqStepProps) {
  const { t } = useTranslation();
  const hasRisks = PARQ_QUESTIONS.some(q => answers[q.key as keyof ParqAnswers] === true);

  const toggle = (key: string) => {
    onChange({ ...answers, [key]: !answers[key as keyof ParqAnswers] });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" /> Health Screening (PAR-Q)
        </CardTitle>
        <CardDescription>
          Please answer the following 7 questions honestly. This helps us ensure your training plan is safe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {PARQ_QUESTIONS.map((q, i) => (
            <label
              key={q.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                answers[q.key as keyof ParqAnswers] ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={answers[q.key as keyof ParqAnswers] as boolean}
                onCheckedChange={() => toggle(q.key)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm leading-snug">
                  <span className="font-semibold text-muted-foreground mr-1.5">Q{i + 1}.</span>
                  {q.text}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Additional medical notes (optional)</Label>
          <Textarea
            value={answers.medical_notes}
            onChange={e => onChange({ ...answers, medical_notes: e.target.value })}
            placeholder="Any relevant medical conditions, allergies, medications..."
            rows={2}
            className="text-sm"
          />
        </div>

        {hasRisks && (
          <Alert variant="default" className="border-amber-500 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Health Risk Identified</AlertTitle>
            <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
              Based on your answers, we recommend consulting a qualified healthcare professional before starting an intense training program.
              You can still proceed, but please exercise caution and inform your coach about these concerns.
            </AlertDescription>
          </Alert>
        )}

        {hasRisks && (
          <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/50 bg-amber-500/5 cursor-pointer">
            <Checkbox
              checked={answers.risk_acknowledged}
              onCheckedChange={() => onChange({ ...answers, risk_acknowledged: !answers.risk_acknowledged })}
              className="mt-0.5"
            />
            <p className="text-xs leading-relaxed">
              I acknowledge the health risks identified above. I understand that I should consult a healthcare professional before beginning this training program. I choose to proceed at my own risk.
            </p>
          </label>
        )}

        {!hasRisks && (
          <Alert className="border-emerald-500/30 bg-emerald-500/5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-emerald-700 dark:text-emerald-400 text-sm">No Risk Flags</AlertTitle>
            <AlertDescription className="text-xs">
              Great! No health concerns identified. You're cleared for standard training.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t('onboarding.back')}
          </Button>
          <Button
            className="flex-1 gradient-hyrox"
            onClick={onNext}
            disabled={hasRisks && !answers.risk_acknowledged}
          >
            {t('onboarding.continue')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
