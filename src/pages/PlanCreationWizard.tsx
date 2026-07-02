import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { buildWizardSteps, isStepComplete, type StepId } from '@/components/plan-wizard/wizardSteps.config';
import type { WizardAnswers } from '@/components/plan-wizard/wizardTypes';

import AthletePickerStep from '@/components/plan-wizard/steps/AthletePickerStep';
import GoalTypeStep from '@/components/plan-wizard/steps/GoalTypeStep';
import RunAbilityStep from '@/components/plan-wizard/steps/RunAbilityStep';
import RaceTimeStep from '@/components/plan-wizard/steps/RaceTimeStep';
import RunDaysCountStep from '@/components/plan-wizard/steps/RunDaysCountStep';
import DaysOfWeekStep from '@/components/plan-wizard/steps/DaysOfWeekStep';
import RaceDetailsStep from '@/components/plan-wizard/steps/RaceDetailsStep';
import StrengthAbilityStep from '@/components/plan-wizard/steps/StrengthAbilityStep';
import StrengthGoalStep from '@/components/plan-wizard/steps/StrengthGoalStep';
import SessionLengthStep from '@/components/plan-wizard/steps/SessionLengthStep';
import SessionCountStep from '@/components/plan-wizard/steps/SessionCountStep';
import EquipmentStep from '@/components/plan-wizard/steps/EquipmentStep';
import MobilityFocusStep from '@/components/plan-wizard/steps/MobilityFocusStep';
import ReviewStep from '@/components/plan-wizard/steps/ReviewStep';

interface Props {
  onExit?: () => void;
  /** Where to navigate after a plan is successfully generated. Defaults to /schedule. */
  successPath?: string;
}

/**
 * Full-screen multi-step plan-creation wizard. Mirrors the step-state pattern
 * from src/pages/Onboarding.tsx. Step ordering is computed from current
 * answers (see wizardSteps.config.ts) — no hardcoded ternary chains here.
 */
export default function PlanCreationWizard({ onExit, successPath = '/schedule' }: Props) {
  const navigate = useNavigate();
  const { currentRole } = useAuth();
  const isCoach = currentRole === 'coach' || currentRole === 'admin' || currentRole === 'master_admin';

  const [answers, setAnswers] = useState<WizardAnswers>({});
  const [stepIndex, setStepIndex] = useState(0);

  const stepIds = useMemo(() => buildWizardSteps(answers, { isCoach }), [answers, isCoach]);
  const currentStepId = stepIds[stepIndex] ?? stepIds[stepIds.length - 1];
  const progress = ((stepIndex + 1) / stepIds.length) * 100;

  const update = (patch: Partial<WizardAnswers>) =>
    setAnswers((prev) => ({ ...prev, ...patch }));

  const handleExit = () => {
    if (onExit) onExit();
    else navigate(-1);
  };

  const handleBack = () => {
    if (stepIndex === 0) handleExit();
    else setStepIndex((i) => i - 1);
  };

  const handleContinue = () => {
    if (stepIndex < stepIds.length - 1) setStepIndex((i) => i + 1);
  };

  const canContinue = isStepComplete(currentStepId, answers);
  const isLastStep = stepIndex === stepIds.length - 1;

  const goToStep = (id: StepId) => {
    const idx = stepIds.indexOf(id);
    if (idx >= 0) setStepIndex(idx);
  };

  const stepNode = renderStep(currentStepId, answers, update, () => navigate(successPath), goToStep);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Progress value={progress} className="h-1 flex-1" />
        <Button variant="ghost" size="icon" onClick={handleExit} aria-label="Exit">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="px-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Step {stepIndex + 1} of {stepIds.length}
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {stepNode}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Pinned CTA — review step renders its own Generate button */}
      {!isLastStep && (
        <div className="border-t border-border bg-background/95 backdrop-blur px-4 py-4">
          <div className="max-w-md mx-auto">
            <Button className="w-full" size="lg" disabled={!canContinue} onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderStep(
  id: StepId,
  answers: WizardAnswers,
  update: (p: Partial<WizardAnswers>) => void,
  onGenerated: () => void,
  goToStep: (id: StepId) => void,
) {
  switch (id) {
    case 'athletePicker': return <AthletePickerStep answers={answers} update={update} />;
    case 'goalType': return <GoalTypeStep answers={answers} update={update} />;
    case 'runAbility': return <RunAbilityStep answers={answers} update={update} />;
    case 'raceTime': return <RaceTimeStep answers={answers} update={update} />;
    case 'runDaysCount': return <RunDaysCountStep answers={answers} update={update} />;
    case 'runDaysSelect': return <DaysOfWeekStep answers={answers} update={update} variant="run" />;
    case 'raceDetails': return <RaceDetailsStep answers={answers} update={update} />;
    case 'strengthAbility': return <StrengthAbilityStep answers={answers} update={update} />;
    case 'strengthGoal': return <StrengthGoalStep answers={answers} update={update} />;
    case 'sessionLength': return <SessionLengthStep answers={answers} update={update} />;
    case 'strengthCount': return <SessionCountStep answers={answers} update={update} variant="strength" />;
    case 'strengthDays': return <DaysOfWeekStep answers={answers} update={update} variant="strength" />;
    case 'equipment': return <EquipmentStep answers={answers} update={update} />;
    case 'mobilityCount': return <SessionCountStep answers={answers} update={update} variant="mobility" />;
    case 'mobilityDays': return <DaysOfWeekStep answers={answers} update={update} variant="mobility" />;
    case 'mobilityFocus': return <MobilityFocusStep answers={answers} update={update} />;
    case 'review': return <ReviewStep answers={answers} update={update} onGenerated={onGenerated} onEditStep={goToStep} />;
  }
}
