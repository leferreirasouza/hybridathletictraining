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

  // Strength module
  steps.push(
    'strengthAbility',
    'strengthGoal',
    'sessionLength',
    'strengthCount',
    'strengthDays',
    'equipment',
  );

  // Mobility module
  steps.push('mobilityCount', 'mobilityFocus');

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
    case 'runDaysCount': return !!a.runDaysPerWeek && a.runDaysPerWeek >= 2;
    case 'runDaysSelect': return !!a.runDays && a.runDays.length === a.runDaysPerWeek;
    case 'raceDetails': return !!a.raceDate;
    case 'strengthAbility': return !!a.strengthAbility;
    case 'strengthGoal': return !!a.strengthGoal;
    case 'sessionLength': return !!a.sessionLengthMin;
    case 'strengthCount': return a.strengthSessionsPerWeek !== undefined && a.strengthSessionsPerWeek >= 0;
    case 'strengthDays':
      return !!a.strengthDays && a.strengthDays.length === (a.strengthSessionsPerWeek ?? 0);
    case 'equipment': return !!a.equipment?.preset;
    case 'mobilityCount':
      return a.mobilitySessionsPerWeek !== undefined && a.mobilitySessionsPerWeek >= 0;
    case 'mobilityFocus': return true;
    case 'review': return true;
  }
}
