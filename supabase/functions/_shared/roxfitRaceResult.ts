// Writes the official HYROX result carried by a ROXFIT race import into
// race_results, so race history, PBs and post-race analysis fill themselves.
// Called from ingestStravaActivity() (webhook + sync) and from strava-sync's
// bounded catch-up over already-stored imports. Never throws: a race that
// can't be parsed is logged and skipped, the import itself still succeeds.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isHyroxRaceImport } from "./activityQuality.ts";
import { parseRoxfitDescription } from "./roxfitParse.ts";

/** A manually entered result within this many seconds is the same race. */
const MANUAL_MATCH_TOLERANCE_SECONDS = 5;

export type RaceResultOutcome = "not_a_race" | "unparsed" | "inserted" | "updated" | "attached" | "error";

interface RaceImportLike {
  id?: number;
  name?: string;
  description?: string | null;
  elapsed_time?: number;
  start_date_local?: string;
  external_id?: string | null;
  [key: string]: unknown;
}

export async function upsertRoxfitRaceResult(
  service: SupabaseClient,
  userId: string,
  activity: RaceImportLike,
): Promise<RaceResultOutcome> {
  if (!isHyroxRaceImport(activity) || !activity.description || !activity.id) return "not_a_race";

  const parsed = parseRoxfitDescription(activity.description, activity.name, activity.elapsed_time);
  if ("error" in parsed) {
    console.warn("roxfit race not recorded:", activity.id, parsed.error);
    return "unparsed";
  }
  const race = parsed.race;
  const stravaActivityId = Number(activity.id);
  const raceDate = (activity.start_date_local ?? "").slice(0, 10);
  if (!raceDate) return "unparsed";

  const splits: Record<string, number> = {};
  race.runs.forEach((s, i) => (splits[`run_${i + 1}_seconds`] = s));
  race.stations.forEach((s, i) => (splits[`station_${i + 1}_seconds`] = s));
  const official = {
    ...splits,
    total_time_seconds: race.totalSec,
    total_transition_seconds: race.roxzoneSec,
    division: race.division,
    division_key: race.divisionKey,
    overall_rank: race.overallRank,
    age_group_rank: race.ageGroupRank,
    strava_activity_id: stravaActivityId,
  };

  try {
    // 1) Already recorded from this import: refresh it (idempotent).
    const { data: own } = await service
      .from("race_results")
      .select("id")
      .eq("athlete_id", userId)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();
    if (own?.id) {
      const { error } = await service
        .from("race_results")
        .update({ ...official, category: race.category, input_method: "roxfit" })
        .eq("id", (own as any).id);
      if (error) throw error;
      return "updated";
    }

    // 2) The athlete already entered this race (same day, same time) or set
    // it as their goal race: complete that row instead of adding a second.
    const { data: sameDay } = await service
      .from("race_results")
      .select("*")
      .eq("athlete_id", userId)
      .eq("race_date", raceDate)
      .is("strava_activity_id", null);
    const manual = (sameDay ?? []).find(
      (r: any) =>
        r.input_method !== "goal" &&
        r.total_time_seconds != null &&
        Math.abs(Number(r.total_time_seconds) - race.totalSec) <= MANUAL_MATCH_TOLERANCE_SECONDS,
    ) as any;
    const goal = (sameDay ?? []).find((r: any) => r.input_method === "goal" && r.total_time_seconds == null) as any;
    const target = manual ?? goal;
    if (target) {
      // A manual entry keeps everything the athlete typed and gains only the
      // splits it was missing; a goal row becomes the official result.
      const patch: Record<string, unknown> = manual
        ? Object.fromEntries(Object.entries(official).filter(([k]) => manual[k] == null))
        : { ...official, category: race.category, input_method: "roxfit" };
      const { error } = await service.from("race_results").update(patch).eq("id", target.id);
      if (error) throw error;
      return "attached";
    }

    // 3) New result.
    const { error } = await service.from("race_results").insert({
      athlete_id: userId,
      race_date: raceDate,
      race_name: race.city ? `HYROX ${race.city}` : "HYROX",
      race_location: race.city,
      category: race.category,
      input_method: "roxfit",
      notes: "Imported from ROXFIT via Strava",
      ...official,
    });
    if (error) throw error;
    return "inserted";
  } catch (e) {
    console.error("roxfit race_results write failed:", activity.id, e);
    return "error";
  }
}
