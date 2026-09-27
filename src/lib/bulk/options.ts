/**
 * Bulk-enquiry option lists.
 *
 * These live here rather than in `app/actions/bulk.ts` because that module is
 * `'use server'`, and a server-action module may only export async functions. Next
 * replaces every other export with a server reference, so a plain array exported from
 * there arrives on the client as something that is not an array — the failure is
 * `VOLUME_BANDS.map is not a function`, thrown at prerender rather than at compile,
 * which is why it survives typecheck and takes the build down instead.
 *
 * One list, two consumers: the Zod enum that validates the submission and the
 * <select> the customer picks from. Keeping them on the same constant is what stops a
 * form offering a value the action would then reject.
 */
export const VOLUME_BANDS = [
  'Under 10 units',
  '10 – 50 units',
  '50 – 200 units',
  '200+ units',
  'Not sure yet',
] as const

export const CADENCES = ['One-off', 'Monthly', 'Quarterly', 'Ongoing supply'] as const

export type VolumeBand = (typeof VOLUME_BANDS)[number]
export type Cadence = (typeof CADENCES)[number]
