// "New since your last conversation" block for the AI coach prompt: the
// sessions synced or logged after the athlete's previous chat message, so the
// coach can pick up what happened in between instead of answering as if
// nothing changed. Pure and import-free (vitest loads the same file).

export const NEW_SINCE_LIMIT = 8;

export interface NewSinceItem {
  date: string;
  discipline: string;
  minutes: number | null;
  km: number | null;
  source: "strava" | "manual";
  /** Pre-formatted data-quality note, e.g. " [indoor, distance/pace estimated]". */
  note?: string;
}

/** Newest first; total counts everything found, items may be truncated. */
export function formatNewSince(sinceIso: string, items: NewSinceItem[], total: number): string {
  if (total <= 0 || items.length === 0) return "";
  const shown = [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, NEW_SINCE_LIMIT);
  const lines = shown.map(
    (i) =>
      `- ${i.date}: ${i.discipline}${i.minutes ? ` | ${Math.round(i.minutes)} min` : ""}${i.km ? ` | ${i.km.toFixed(1)} km` : ""}${i.source === "manual" ? " | logged manually" : ""}${i.note ?? ""}`,
  );
  const more = total - shown.length;
  return [
    `NEW SINCE YOUR LAST CONVERSATION (${sinceIso.slice(0, 10)}): ${total} session${total === 1 ? "" : "s"} synced or logged since the athlete last messaged you.`,
    ...lines,
    ...(more > 0 ? [`- …and ${more} more`] : []),
    "Acknowledge these briefly when they are relevant to the question (for example how a new session compares with what was planned); do not list them unprompted, and never mention sessions that are not shown here.",
  ].join("\n");
}
