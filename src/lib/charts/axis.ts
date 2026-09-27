/**
 * Axis arithmetic for the admin's bar charts (components/admin/figures.tsx). Pure.
 */

/**
 * The top of a chart axis: the smallest 1, 2, 2.5 or 5 × a power of ten that is at
 * least `value`, and never under `floor`. Ticks at 0, half and the top then land on
 * round numbers — $0 / $250 / $500 — rather than $0 / $155 / $310.
 *
 * The floor defaults to 100 because money here is in cents: an axis never tops out
 * under a dollar. Counts pass a floor of their own.
 */
export function niceCeiling(value: number, floor = 100): number {
  if (value <= floor) return floor
  let power = 10 ** Math.floor(Math.log10(value))
  // Math.log10 can land a hair under an exact power of ten; never step below it.
  if (power * 10 <= value) power *= 10
  for (const step of [1, 2, 2.5, 5]) {
    if (step * power >= value) return step * power
  }
  return 10 * power
}

/**
 * Which bars get an axis label: at most about six, counted back from the newest so
 * today's bar is always labelled and the rest do not collide on a phone.
 */
export function labelledBars(count: number): Set<number> {
  const stride = Math.max(1, Math.ceil(count / 6))
  const labelled = new Set<number>()
  for (let i = count - 1; i >= 0; i -= stride) labelled.add(i)
  return labelled
}
