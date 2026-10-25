// Session library helpers for generate-plan: the catalogue the model picks
// from and the code → id resolution of its picks. Pure and import-free
// (vitest loads the same file). Periodization-adjacent, hand-coded: the
// library decides which session *types* exist; the slot/phase/pace/volume
// modules still decide how many of each and how hard.

export interface LibraryEntry {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  slot_type: string;
  subtype: string | null;
  intensity: string;
  objective: string;
}

const SLOT_ORDER = ["run", "strength", "mobility_technique", "hyrox"];
const SLOT_TITLES: Record<string, string> = {
  run: "RUN slots",
  strength: "STRENGTH slots",
  mobility_technique: "MOBILITY / TECHNIQUE slots",
  hyrox: "HYROX-specific sessions",
};
const OBJECTIVE_MAX = 90;

/**
 * Entries visible to a plan: org-specific ones override a global entry with
 * the same code. Assumes the caller already filtered to approved entries of
 * this org or global.
 */
export function effectiveLibrary(entries: LibraryEntry[]): LibraryEntry[] {
  const byCode = new Map<string, LibraryEntry>();
  for (const e of entries) {
    const key = e.code.toUpperCase();
    const current = byCode.get(key);
    if (!current || (current.organization_id === null && e.organization_id !== null)) byCode.set(key, e);
  }
  return [...byCode.values()];
}

/** Compact prompt catalogue grouped by slot type: one line per entry. */
export function formatLibraryCatalogue(entries: LibraryEntry[]): string {
  const lib = effectiveLibrary(entries);
  if (lib.length === 0) return "";
  const lines: string[] = [];
  for (const slot of [...SLOT_ORDER, ...new Set(lib.map((e) => e.slot_type).filter((s) => !SLOT_ORDER.includes(s)))]) {
    const group = lib.filter((e) => e.slot_type === slot).sort((a, b) => a.code.localeCompare(b.code));
    if (group.length === 0) continue;
    lines.push(`${SLOT_TITLES[slot] ?? slot}:`);
    for (const e of group) {
      const objective = e.objective.length > OBJECTIVE_MAX ? `${e.objective.slice(0, OBJECTIVE_MAX - 1)}…` : e.objective;
      lines.push(`  ${e.code} · ${e.name}${e.subtype ? ` · ${e.subtype}` : ""} · ${e.intensity} — ${objective}`);
    }
  }
  return lines.join("\n");
}

/**
 * Maps each session's library_code to an entry id (case-insensitive, org
 * entries win). Unknown or missing codes resolve to null and are counted.
 */
export function resolveLibraryCodes(
  codes: (string | null | undefined)[],
  entries: LibraryEntry[],
): { ids: (string | null)[]; unmatched: number; unknownCodes: string[] } {
  const byCode = new Map(effectiveLibrary(entries).map((e) => [e.code.toUpperCase(), e.id]));
  const unknown = new Set<string>();
  let unmatched = 0;
  const ids = codes.map((raw) => {
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    const id = code ? byCode.get(code) ?? null : null;
    if (!id) {
      unmatched++;
      if (code) unknown.add(code);
    }
    return id;
  });
  return { ids, unmatched, unknownCodes: [...unknown] };
}
