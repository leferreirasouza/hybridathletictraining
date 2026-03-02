import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { csvData, organizationId, planName } = await req.json();
    if (!csvData || !organizationId || !planName) {
      throw new Error("Missing required fields: csvData, organizationId, planName");
    }

    // Parse CSV lines
    const lines = csvData.split("\n").map((l: string) => l.trim()).filter((l: string) => l);
    if (lines.length < 2) throw new Error("CSV must have at least a header and one data row");

    const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
    const errors: { row: number; message: string }[] = [];

    // Create training plan
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({ name: planName, organization_id: organizationId, created_by: user.id })
      .select()
      .single();
    if (planError) throw planError;

    // Create plan version
    const { data: version, error: versionError } = await supabase
      .from("plan_versions")
      .insert({ plan_id: plan.id, version_number: 1, created_by: user.id })
      .select()
      .single();
    if (versionError) throw versionError;

    // Map columns
    const colMap: Record<string, number> = {};
    const expectedCols = ["date", "week", "day", "discipline", "session", "distance (km)", "duration (min)", "intensity/target", "workout details", "notes"];
    for (const col of expectedCols) {
      const idx = headers.findIndex((h: string) => h.includes(col.split(" ")[0]) || h.includes(col));
      if (idx !== -1) colMap[col] = idx;
    }

    // Parse rows into planned sessions
    const sessions = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c: string) => c.trim());
      try {
        const disciplineRaw = cols[colMap["discipline"]] || "custom";
        const validDisciplines = ["run", "bike", "stairs", "rowing", "skierg", "mobility", "strength", "accessories", "hyrox_station", "prehab", "custom"];
        const discipline = validDisciplines.includes(disciplineRaw.toLowerCase()) ? disciplineRaw.toLowerCase() : "custom";
        
        const intensityRaw = (cols[colMap["intensity/target"]] || "").toLowerCase().replace(/ /g, "_");
        const validIntensities = ["easy", "moderate", "hard", "race_pace", "max_effort"];
        const intensity = validIntensities.includes(intensityRaw) ? intensityRaw : null;

        sessions.push({
          plan_version_id: version.id,
          date: cols[colMap["date"]] || null,
          week_number: parseInt(cols[colMap["week"]]) || 1,
          day_of_week: parseInt(cols[colMap["day"]]) || 1,
          discipline,
          session_name: cols[colMap["session"]] || `Session ${i}`,
          distance_km: parseFloat(cols[colMap["distance (km)"]]) || null,
          duration_min: parseFloat(cols[colMap["duration (min)"]]) || null,
          intensity,
          workout_details: cols[colMap["workout details"]] || null,
          notes: cols[colMap["notes"]] || null,
          order_index: i - 1,
        });
      } catch (e) {
        errors.push({ row: i + 1, message: `Parse error: ${e}` });
      }
    }

    // Insert all sessions
    if (sessions.length > 0) {
      const { error: insertError } = await supabase.from("planned_sessions").insert(sessions);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      planId: plan.id,
      versionId: version.id,
      sessionsCreated: sessions.length,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
