import type { WizardAnswers } from './wizardTypes';

export type StepId =
  | 'athletePicker'
  | 'goalType'
  | 'runAbility'
  | 'raceTime'
  | 'runDaysCount'
  | 'runDaysSelect'
  | 'raceDetails'
  | 'strengthAbility'
  | 'strengthGoal'
  | 'sessionLength'
  | 'strengthCount'
  | 'strengthDays'
  | 'equipment'
  | 'mobilityCount'
  | 'mobilityDays'
  | 'mobilityFocus'
  | 'review';

interface BuildOpts {
  isCoach: boolean;
}

/**
 * Data-driven step list. Branches on goalType:
 *  - 'general_fitness' skips race-time and race-details steps
 *  - all other goals include the full running module
 */
export function buildWizardSteps(answers: WizardAnswers, opts: BuildOpts): StepId[] {
  const steps: StepId[] = [];

  if (opts.isCoach) steps.push('athletePicker');

  // Running module
  steps.push('goalType', 'runAbility');
  const hasRace = answers.goalType && answers.goalType !== 'general_fitness';
  if (hasRace) steps.push('raceTime');
  steps.push('runDaysCount', 'runDaysSelect');
  if (hasRace) steps.push('raceDetails');

  // Strength module — day picker only when the athlete opts in (>0 sessions).
  steps.push('strengthAbility', 'strengthGoal', 'sessionLength', 'strengthCount');
  if ((answers.strengthSessionsPerWeek ?? 0) > 0) steps.push('strengthDays');
  steps.push('equipment');

  // Mobility module — day/focus steps only when the athlete opts in (>0 sessions).
  steps.push('mobilityCount');
  if ((answers.mobilitySessionsPerWeek ?? 0) > 0) steps.push('mobilityDays', 'mobilityFocus');

  steps.push('review');
  return steps;
}

/** Per-step validation: returns true when the user may continue. */
export function isStepComplete(stepId: StepId, a: WizardAnswers): boolean {
  switch (stepId) {
    case 'athletePicker': return !!a.athleteId;
    case 'goalType': return !!a.goalType;
    case 'runAbility': return !!a.runAbility;
    case 'raceTime': return !!a.raceDistance && !!a.raceTimeSeconds && a.raceTimeSeconds > 0;
    case 'runDaysCount': {
      const kmOk = a.currentWeeklyKm === undefined
        || (Number.isFinite(a.currentWeeklyKm) && a.currentWeeklyKm >= 0 && a.currentWeeklyKm <= 300);
      return !!a.runDaysPerWeek && a.runDaysPerWeek >= 2 && kmOk;
    }
    case 'runDaysSelect': return !!a.runDays && a.runDays.length === a.runDaysPerWeek;
    case 'raceDetails': return !!a.raceDate;
    case 'strengthAbility': return !!a.strengthAbility;
    case 'strengthGoal': return !!a.strengthGoal;
    case 'sessionLength': return !!a.sessionLengthMin;
    case 'strengthCount': return a.strengthSessionsPerWeek !== undefined && a.strengthSessionsPerWeek >= 0;
    case 'strengthDays':
      return (a.strengthDays ?? []).length === (a.strengthSessionsPerWeek ?? 0);
    case 'equipment': return !!a.equipment?.preset;
    case 'mobilityCount':
      return a.mobilitySessionsPerWeek !== undefined && a.mobilitySessionsPerWeek >= 0;
    case 'mobilityDays':
      return (a.mobilityDays ?? []).length === (a.mobilitySessionsPerWeek ?? 0);
    case 'mobilityFocus': return true;
    case 'review': return true;
  }
}
