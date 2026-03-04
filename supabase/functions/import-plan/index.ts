import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map day names to numbers
const dayNameToNum: Record<string, number> = {
  monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 7, sun: 7,
};

const validDisciplines = ["run", "bike", "stairs", "rowing", "skierg", "mobility", "strength", "accessories", "hyrox_station", "prehab", "custom"];

// Smart discipline mapping for multi-type sessions like "Gym + Bike", "Run + HYROX"
function mapDiscipline(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (validDisciplines.includes(lower)) return lower;

  // Priority-based matching for compound disciplines
  if (lower.includes("hyrox")) return "hyrox_station";
  if (lower.includes("run")) return "run";
  if (lower.includes("bike") || lower.includes("cycle")) return "bike";
  if (lower.includes("row")) return "rowing";
  if (lower.includes("ski")) return "skierg";
  if (lower.includes("gym") || lower.includes("strength") || lower.includes("legs") || lower.includes("upper")) return "strength";
  if (lower.includes("mobil")) return "mobility";
  if (lower.includes("prehab")) return "prehab";
  if (lower.includes("stair")) return "stairs";
  return "custom";
}

// Smart intensity mapping for rich text like "Z2 + strides", "Threshold / RPE 7", "Hard reps / RPE 8"
function mapIntensity(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (!lower) return null;

  if (lower.includes("race") && !lower.includes("race_pace")) return "race_pace";
  if (lower === "race") return "race_pace";
  if (lower.includes("max") || lower.includes("all out")) return "max_effort";
  if (lower.includes("threshold") || lower.includes("tempo") || lower.includes("hard") || lower.includes("vo2") || lower.includes("vo₂")) return "hard";
  if (lower.includes("moderate") || lower.includes("steady")) return "moderate";
  if (lower.includes("easy") || lower.includes("z2") || lower.includes("z1") || lower.includes("recovery")) return "easy";
  if (lower.includes("race_pace")) return "race_pace";
  return null;
}

function parseDayOfWeek(raw: string): number {
  if (!raw) return 1;
  const trimmed = raw.trim().toLowerCase();
  // Try numeric first
  const num = parseInt(trimmed);
  if (!isNaN(num) && num >= 1 && num <= 7) return num;
  // Try name
  return dayNameToNum[trimmed] || 1;
}

function parseDate(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  // Handle various date formats
  const trimmed = raw.trim();
  // ISO format check
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
  // Try Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  return null;
}

// Parse a sheet's rows from JSON array format (array of arrays)
function findHeader(rows: any[][], keywords: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map((c: any) => String(c || "").toLowerCase()).join(" ");
    if (keywords.some(k => joined.includes(k))) return i;
  }
  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { sheets, organizationId, planName, csvData } = body;

    if (!organizationId || !planName) {
      throw new Error("Missing required fields: organizationId, planName");
    }

    // Support legacy single-CSV mode
    const sheetsData: Record<string, any[][]> = sheets || {};
    if (csvData && !sheets) {
      // Legacy: parse CSV into array of arrays
      const lines = csvData.split("\n").map((l: string) => l.trim()).filter((l: string) => l);
      sheetsData["Plan Daily"] = lines.map((l: string) => l.split(",").map((c: string) => c.trim()));
    }

    if (Object.keys(sheetsData).length === 0) {
      throw new Error("No sheet data provided");
    }

    const errors: { sheet: string; row: number; message: string }[] = [];

    // Create training plan
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({ name: planName, organization_id: organizationId, created_by: user.id })
      .select()
      .single();
    if (planError) throw planError;

    const { data: version, error: versionError } = await supabase
      .from("plan_versions")
      .insert({ plan_id: plan.id, version_number: 1, created_by: user.id, notes: "Imported from spreadsheet" })
      .select()
      .single();
    if (versionError) throw versionError;

    let sessionsCreated = 0;
    let targetsCreated = 0;
    let weeklySummariesCreated = 0;
    let garminWorkoutsCreated = 0;

    // ─── SHEET 1: TARGETS ───
    const targetsSheet = Object.entries(sheetsData).find(([name]) =>
      name.toLowerCase().includes("target")
    );
    if (targetsSheet) {
      const [sheetName, rows] = targetsSheet;
      const headerIdx = findHeader(rows, ["type", "primary", "target"]);
      const headers = (rows[headerIdx] || []).map((h: any) => String(h || "").toLowerCase());

      const typeCol = headers.findIndex((h: string) => h.includes("type"));
      const primaryCol = headers.findIndex((h: string) => h.includes("primary"));
      const secondaryCol = headers.findIndex((h: string) => h.includes("secondary") || h.includes("guardrail"));
      const referenceCol = headers.findIndex((h: string) => h.includes("current") || h.includes("reference") || h.includes("garmin"));
      const usageCol = headers.findIndex((h: string) => h.includes("how") || h.includes("usage") || h.includes("use"));

      const targetRows = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[typeCol]) continue;
        const typeVal = String(row[typeCol] || "").trim();
        if (!typeVal) continue;

        targetRows.push({
          plan_version_id: version.id,
          type: typeVal,
          primary_target: String(row[primaryCol] || "").trim(),
          secondary_guardrail: secondaryCol >= 0 ? String(row[secondaryCol] || "").trim() || null : null,
          current_reference: referenceCol >= 0 ? String(row[referenceCol] || "").trim() || null : null,
          usage_guide: usageCol >= 0 ? String(row[usageCol] || "").trim() || null : null,
        });
      }

      if (targetRows.length > 0) {
        const { error: tErr } = await supabase.from("targets").insert(targetRows);
        if (tErr) {
          errors.push({ sheet: sheetName, row: 0, message: `Targets insert: ${tErr.message}` });
        } else {
          targetsCreated = targetRows.length;
        }
      }
    }

    // ─── SHEET 2: PLAN DAILY ───
    const planSheet = Object.entries(sheetsData).find(([name]) => {
      const lower = name.toLowerCase();
      return lower.includes("plan") || lower.includes("daily") || lower.includes("session");
    }) || Object.entries(sheetsData)[0]; // fallback to first sheet

    if (planSheet) {
      const [sheetName, rows] = planSheet;
      const headerIdx = findHeader(rows, ["date", "week", "discipline", "session"]);
      const headers = (rows[headerIdx] || []).map((h: any) => String(h || "").toLowerCase());

      // Flexible column mapping
      const colMap: Record<string, number> = {};
      const mappings: [string, string[]][] = [
        ["date", ["date"]],
        ["week", ["week"]],
        ["day", ["day"]],
        ["discipline", ["discipline"]],
        ["session", ["session", "name"]],
        ["distance", ["distance"]],
        ["duration", ["duration"]],
        ["intensity", ["intensity", "target"]],
        ["details", ["workout", "details"]],
        ["notes", ["notes"]],
      ];

      for (const [key, keywords] of mappings) {
        const idx = headers.findIndex((h: string) => keywords.some(k => h.includes(k)));
        if (idx !== -1) colMap[key] = idx;
      }

      const sessions = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        try {
          const rawDiscipline = String(row[colMap["discipline"]] || "").trim();
          if (!rawDiscipline) continue; // skip empty rows

          const rawDay = String(row[colMap["day"]] || "").trim();
          const rawIntensity = String(row[colMap["intensity"]] || "").trim();
          const rawDate = colMap["date"] !== undefined ? String(row[colMap["date"]] || "").trim() : "";

          sessions.push({
            plan_version_id: version.id,
            date: parseDate(rawDate),
            week_number: parseInt(String(row[colMap["week"]] || "1")) || 1,
            day_of_week: parseDayOfWeek(rawDay),
            discipline: mapDiscipline(rawDiscipline),
            session_name: String(row[colMap["session"]] || `Session ${i}`).trim(),
            distance_km: colMap["distance"] !== undefined ? parseFloat(String(row[colMap["distance"]])) || null : null,
            duration_min: colMap["duration"] !== undefined ? parseFloat(String(row[colMap["duration"]])) || null : null,
            intensity: mapIntensity(rawIntensity),
            workout_details: colMap["details"] !== undefined ? String(row[colMap["details"]] || "").trim() || null : null,
            notes: colMap["notes"] !== undefined ? String(row[colMap["notes"]] || "").trim() || null : null,
            order_index: sessions.length,
          });
        } catch (e) {
          errors.push({ sheet: sheetName, row: i + 1, message: `Parse error: ${e}` });
        }
      }

      if (sessions.length > 0) {
        const { error: insertError } = await supabase.from("planned_sessions").insert(sessions);
        if (insertError) throw insertError;
        sessionsCreated = sessions.length;
      }
    }

    // ─── SHEET 3: WEEKLY SUMMARY ───
    const weeklySheet = Object.entries(sheetsData).find(([name]) => {
      const lower = name.toLowerCase();
      return lower.includes("weekly") || lower.includes("summary");
    });
    if (weeklySheet) {
      const [sheetName, rows] = weeklySheet;
      const headerIdx = findHeader(rows, ["week", "run", "bike"]);
      const headers = (rows[headerIdx] || []).map((h: any) => String(h || "").toLowerCase());

      const weekCol = headers.findIndex((h: string) => h.includes("week") && !h.includes("start") && !h.includes("end"));
      const startCol = headers.findIndex((h: string) => h.includes("start"));
      const endCol = headers.findIndex((h: string) => h.includes("end"));
      const runKmCol = headers.findIndex((h: string) => h.includes("run") && h.includes("km"));
      const runDaysCol = headers.findIndex((h: string) => h.includes("run") && h.includes("day"));
      const bikeCol = headers.findIndex((h: string) => h.includes("bike"));
      const notesCol = headers.findIndex((h: string) => h.includes("notes"));

      const summaries = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const weekNum = parseInt(String(row[weekCol] || ""));
        if (isNaN(weekNum)) continue;

        summaries.push({
          plan_version_id: version.id,
          week_number: weekNum,
          week_start: startCol >= 0 ? parseDate(String(row[startCol] || "")) : null,
          week_end: endCol >= 0 ? parseDate(String(row[endCol] || "")) : null,
          run_km_target: runKmCol >= 0 ? parseFloat(String(row[runKmCol] || "")) || null : null,
          run_days: runDaysCol >= 0 ? String(row[runDaysCol] || "").trim() || null : null,
          bike_z2_min_target: bikeCol >= 0 ? parseFloat(String(row[bikeCol] || "")) || null : null,
          notes: notesCol >= 0 ? String(row[notesCol] || "").trim() || null : null,
        });
      }

      if (summaries.length > 0) {
        const { error: wsErr } = await supabase.from("weekly_summaries").insert(summaries);
        if (wsErr) {
          errors.push({ sheet: sheetName, row: 0, message: `Weekly summaries: ${wsErr.message}` });
        } else {
          weeklySummariesCreated = summaries.length;
        }
      }
    }

    // ─── SHEET 4: GARMIN WORKOUTS ───
    const garminSheet = Object.entries(sheetsData).find(([name]) => {
      const lower = name.toLowerCase();
      return lower.includes("garmin") || lower.includes("workout");
    });
    if (garminSheet) {
      const [sheetName, rows] = garminSheet;
      const headerIdx = findHeader(rows, ["workout", "name", "steps", "garmin"]);
      const headers = (rows[headerIdx] || []).map((h: any) => String(h || "").toLowerCase());

      const nameCol = headers.findIndex((h: string) => h.includes("workout") || h.includes("name"));
      const whenCol = headers.findIndex((h: string) => h.includes("when") || h.includes("week") || h.includes("day"));
      const stepsCol = headers.findIndex((h: string) => h.includes("step") || h.includes("garmin"));
      const targetTypeCol = headers.findIndex((h: string) => h.includes("target") && h.includes("type"));
      const guidanceCol = headers.findIndex((h: string) => h.includes("guidance") || h.includes("target"));

      const workouts = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const workoutName = nameCol >= 0 ? String(row[nameCol] || "").trim() : "";
        if (!workoutName || workoutName.toLowerCase().startsWith("setup")) continue;

        workouts.push({
          plan_version_id: version.id,
          workout_name: workoutName,
          when_week_day: whenCol >= 0 ? String(row[whenCol] || "").trim() || null : null,
          steps_garmin_style: stepsCol >= 0 ? String(row[stepsCol] || "").trim() || null : null,
          target_type: targetTypeCol >= 0 ? String(row[targetTypeCol] || "").trim() || null : null,
          target_guidance: guidanceCol >= 0 ? String(row[guidanceCol] || "").trim() || null : null,
        });
      }

      if (workouts.length > 0) {
        const { error: gwErr } = await supabase.from("garmin_workouts").insert(workouts);
        if (gwErr) {
          errors.push({ sheet: sheetName, row: 0, message: `Garmin workouts: ${gwErr.message}` });
        } else {
          garminWorkoutsCreated = workouts.length;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      planId: plan.id,
      versionId: version.id,
      sessionsCreated,
      targetsCreated,
      weeklySummariesCreated,
      garminWorkoutsCreated,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-plan error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
