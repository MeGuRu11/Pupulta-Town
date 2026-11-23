export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

// Require the timezone so a shared test link displays the same time on every machine.
function parseInstant(value: string): number | null {
  const pattern = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  const date = pattern.exec(value)?.[1];
  if (!date || !isCalendarDate(date)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseTestOverrides(search: string, enabled: boolean): {
  nowMs: number | null;
  seed: number | null;
} {
  if (!enabled) return { nowMs: null, seed: null };
  const params = new URLSearchParams(search);
  const seedText = params.get("seed") ?? "";
  const seed = /^\d+$/.test(seedText) ? Number(seedText) : NaN;
  return {
    nowMs: parseInstant(params.get("now") ?? ""),
    seed: seed <= 0xffff_ffff ? seed : null,
  };
}
