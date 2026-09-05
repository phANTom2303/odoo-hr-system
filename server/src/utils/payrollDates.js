/**
 * @fileoverview Payroll date & numeric helpers — the timezone-safe,
 * string-only date core the payroll engine sits on.
 *
 * Two `pg` footguns this module exists to neutralise (see
 * `PAYROLL_IMPL_SPEC.md` §1):
 *
 * 1. `DECIMAL`/`NUMERIC`/`COUNT` columns arrive as JS strings, not numbers.
 *    Every numeric value read from the DB must go through {@link num} before
 *    arithmetic.
 * 2. `DATE` columns arrive as a JS `Date` at local midnight, which shifts by
 *    a day under `.toISOString()`. The payroll read-model casts every DATE
 *    column to `::text` in SQL, so inside the engine dates are ALWAYS
 *    `'YYYY-MM-DD'` strings. ISO date strings sort lexicographically, so
 *    every comparison here is a plain string comparison — never construct a
 *    `Date` from a period boundary. `Date` objects are only ever built
 *    internally (via `Date.UTC`) as a throwaway calendar calculator.
 */

/**
 * Coerces a `pg` numeric/count value (string | number | null | undefined) to
 * a finite JS number, defaulting to 0.
 *
 * @param {string|number|null|undefined} v
 * @returns {number}
 */
export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Rounds to 2 decimal places (currency amounts), correcting float drift.
 *
 * @param {string|number} n
 * @returns {number}
 */
export const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;

/**
 * Rounds to 4 decimal places (proration_factor precision).
 *
 * @param {string|number} n
 * @returns {number}
 */
export const round4 = (n) => Math.round((num(n) + Number.EPSILON) * 10000) / 10000;

/**
 * Normalises a value coming back from `pg` (already-text 'YYYY-MM-DD'
 * string, a raw `Date` object, or null/undefined) to a `'YYYY-MM-DD'`
 * string. Every payroll read-model query casts DATE columns to `::text`, so
 * this should almost always just pass a string straight through — the
 * `Date` branch exists only as a defensive fallback and uses UTC getters
 * exclusively to avoid local-timezone off-by-one shifts.
 *
 * @param {string|Date|null|undefined} value
 * @returns {string|null}
 */
export const toISODate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
};

/**
 * Later of two 'YYYY-MM-DD' strings (lexicographic — ISO dates sort
 * correctly as strings).
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export const maxDate = (a, b) => (a > b ? a : b);

/**
 * Earlier of two 'YYYY-MM-DD' strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export const minDate = (a, b) => (a < b ? a : b);

/**
 * Inclusive date-range overlap test: (start1 <= end2) && (end1 >= start2).
 *
 * @param {string} s1
 * @param {string} e1
 * @param {string} s2
 * @param {string} e2
 * @returns {boolean}
 */
export const dateRangesOverlap = (s1, e1, s2, e2) => s1 <= e2 && e1 >= s2;

/**
 * ISO day-of-week (1 = Monday … 7 = Sunday) for a 'YYYY-MM-DD' string.
 * Uses `Date.UTC` + `getUTCDay()` exclusively so the result is independent
 * of the host's local timezone.
 *
 * @param {string} iso - 'YYYY-MM-DD'
 * @returns {number} 1..7
 */
export const isoDow = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 (Sun) .. 6 (Sat)
  return js === 0 ? 7 : js;
};

/**
 * Generator yielding each 'YYYY-MM-DD' date from `startISO` to `endISO`
 * inclusive. Yields nothing if `startISO > endISO`. Steps with `Date.UTC` +
 * `setUTCDate` so it never crosses a local-timezone DST boundary.
 *
 * @param {string} startISO - 'YYYY-MM-DD'
 * @param {string} endISO - 'YYYY-MM-DD'
 * @yields {string} 'YYYY-MM-DD'
 */
export function* eachDate(startISO, endISO) {
  if (startISO > endISO) return;
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  while (true) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cursor.getUTCDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (iso > endISO) return;
    yield iso;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

/**
 * Counts days in the inclusive range [start, end] whose ISO day-of-week is
 * in `dayNumbers`. Returns 0 if `start > end` or `dayNumbers` is empty.
 * Equivalent to the algorithm doc's `generate_series` + `EXTRACT(ISODOW)`
 * SQL (§14 `count_workdays`), done in JS to avoid a DB round-trip per call.
 *
 * @param {string} startISO - 'YYYY-MM-DD'
 * @param {string} endISO - 'YYYY-MM-DD'
 * @param {number[]} dayNumbers - ISO day-of-week integers (1..7) to count.
 * @returns {number}
 */
export const countWorkdays = (startISO, endISO, dayNumbers) => {
  if (!dayNumbers || dayNumbers.length === 0) return 0;
  if (startISO > endISO) return 0;
  const daySet = new Set(dayNumbers);
  let count = 0;
  for (const iso of eachDate(startISO, endISO)) {
    if (daySet.has(isoDow(iso))) count++;
  }
  return count;
};

/**
 * Self-check (not executed automatically — verified manually during
 * implementation via `node -e`):
 *   isoDow('2026-09-01') === 2                                  // Tuesday
 *   countWorkdays('2026-09-01', '2026-09-30', [1,2,3,4,5]) === 22
 *   countWorkdays('2026-09-30', '2026-09-01', [1,2,3,4,5]) === 0  // start > end
 *   countWorkdays('2026-09-01', '2026-09-30', []) === 0           // empty dayNumbers
 */
