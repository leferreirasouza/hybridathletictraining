import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseHyroxDate(dateStr: string): string | null {
  // Format: "7. Mar. 2026" or "21. Mar. 2026"
  const months: Record<string, string> = {
    'Jan.': '01', 'Feb.': '02', 'Mar.': '03', 'Apr.': '04',
    'May.': '05', 'May': '05', 'Jun.': '06', 'Jul.': '07', 'Aug.': '08',
    'Sep.': '09', 'Oct.': '10', 'Nov.': '11', 'Dec.': '12',
  };
  const match = dateStr.trim().match(/(\d{1,2})\.\s+(\w+\.?)\s+(\d{4})/);
  if (!match) return null;
  const [, day, monthStr, year] = match;
  const month = months[monthStr];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

function extractContinent(classStr: string): string | null {
  const match = classStr.match(/continent-([\w-]+)/);
  if (!match) return null;
  return match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractCountryFromUrl(url: string): string {
  // Map city slugs to countries
  const cityCountry: Record<string, string> = {
    'washington': 'USA', 'houston': 'USA', 'miami': 'USA', 'new-york': 'USA',
    'glasgow': 'United Kingdom', 'london': 'United Kingdom', 'cardiff': 'United Kingdom',
    'copenhagen': 'Denmark', 'toulouse': 'France', 'lyon': 'France', 'paris': 'France',
    'bangkok': 'Thailand', 'beijing': 'China', 'shanghai': 'China', 'wuhan': 'China',
    'berlin': 'Germany', 'cologne': 'Germany',
    'rotterdam': 'Netherlands', 'heerenveen': 'Netherlands',
    'barcelona': 'Spain', 'malaga': 'Spain',
    'bologna': 'Italy', 'rimini': 'Italy',
    'sao-paulo': 'Brazil', 'buenos-aires': 'Argentina',
    'cancun': 'Mexico', 'monterrey': 'Mexico', 'puebla': 'Mexico',
    'brisbane': 'Australia',
    'hong-kong': 'Hong Kong', 'singapore': 'Singapore',
    'bengaluru': 'India', 'jakarta': 'Indonesia',
    'incheon': 'South Korea', 'lisbon': 'Portugal',
    'mechelen': 'Belgium', 'helsinki': 'Finland',
    'riga': 'Latvia', 'warsaw': 'Poland',
    'stockholm': 'Sweden', 'cape-town': 'South Africa',
    'ottawa': 'Canada',
  };
  
  for (const [city, country] of Object.entries(cityCountry)) {
    if (url.includes(city)) return country;
  }
  return 'Unknown';
}

function extractCityFromTitle(title: string): string {
  // Remove prefixes like "HYROX", sponsor names, "Championships", etc.
  const cleaned = title
    .replace(/^.*?HYROX\s*/i, '')
    .replace(/Americas Championships\s*[–-]\s*/i, '')
    .replace(/EMEA Regional Championships\s*[–-]\s*/i, '')
    .replace(/APAC Championships\s*[–-]\s*/i, '')
    .replace(/World Championships\s*[–-]\s*/i, '')
    .replace(/^(Biotherm|Smart Fit|LUCIS|Original Source|Creapure®?|BYD|GenM)\s*/i, '')
    .replace(/^HYROX\s*/i, '')
    .trim();
  return cleaned || title;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch HYROX page
    const response = await fetch("https://hyrox.com/find-my-race/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HyroxCoachOS/1.0)" },
    });
    const html = await response.text();

    // Parse race articles
    const articleRegex = /<article[^>]*class="([^"]*)"[^>]*>[\s\S]*?<\/article>/g;
    const races: any[] = [];
    let match;

    while ((match = articleRegex.exec(html)) !== null) {
      const articleHtml = match[0];
      const articleClass = match[1];

      // Extract title
      const titleMatch = articleHtml.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>\s*<\/h2>/);
      if (!titleMatch) continue;

      const [, eventUrl, raceName] = titleMatch;

      // Extract dates
      const dateMatches = [...articleHtml.matchAll(/event_date_\d[^>]*>.*?<span class="w-post-elm-value">([^<]+)<\/span>/g)];
      const startDate = dateMatches[0] ? parseHyroxDate(dateMatches[0][1]) : null;
      const endDate = dateMatches[1] ? parseHyroxDate(dateMatches[1][1]) : null;

      if (!startDate) continue;

      const continent = extractContinent(articleClass);
      const country = extractCountryFromUrl(eventUrl);
      const city = extractCityFromTitle(raceName);

      races.push({
        race_type: 'hyrox',
        race_name: raceName.trim(),
        race_date: startDate,
        race_end_date: endDate,
        city,
        country,
        continent,
        external_url: eventUrl,
        source: 'scraper',
        is_verified: true,
      });
    }

    console.log(`Parsed ${races.length} HYROX races`);

    if (races.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No races parsed from HYROX page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete old scraped HYROX races and insert fresh ones
    await supabase.from("races_calendar").delete().eq("source", "scraper").eq("race_type", "hyrox");

    const { error: insertError } = await supabase.from("races_calendar").insert(races);
    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: races.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scraper error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
