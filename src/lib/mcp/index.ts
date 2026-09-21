import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getTodaysSession from "./tools/get-todays-session";
import listUpcomingSessions from "./tools/list-upcoming-sessions";
import listRecentCompletions from "./tools/list-recent-completions";
import getTrainingLoad from "./tools/get-training-load";
import getGoalRace from "./tools/get-goal-race";
import listStravaActivities from "./tools/list-strava-activities";
import getWeeklyRollup from "./tools/get-weekly-rollup";

// The OAuth issuer MUST be the direct Supabase host, built from the project
// ref that Vite inlines at build time. SUPABASE_URL may be proxied.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hybrid-athletics-mcp",
  title: "Hybrid Athletics",
  version: "0.1.0",
  instructions:
    "Read-only access to the signed-in HYROX athlete's training data on Hybrid Athletics. " +
    "Use `get_todays_session` for today's workout, `list_upcoming_sessions` to look ahead, " +
    "`list_recent_completions` for recent training history, `get_training_load` for the current " +
    "CTL/ATL/TSB fitness/fatigue snapshot, and `get_goal_race` for the athlete's next HYROX race. " +
    "All tools return data for the signed-in user only.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getTodaysSession, listUpcomingSessions, listRecentCompletions, getTrainingLoad, getGoalRace],
});
