/**
 * Prisma's "the table does not exist" (P2021).
 *
 * Code that reads a table added by a newer migration uses this to tell "the
 * migration has not been applied yet" apart from a real failure. The first is an
 * expected state during a deploy, and reporting it would page the operator every
 * cache refresh until someone runs the migration.
 */
/**
 * A unique constraint refused a write (Prisma P2002). Used where a random value can,
 * very rarely, collide, and the right answer is to draw again rather than fail.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2021'
  )
}

/**
 * Prisma's "the column does not exist" (P2022).
 *
 * The sibling of `isMissingTableError`, and the one that caused a production outage
 * on 2026-09-11: a migration dropped a column, the deployed code still selected it,
 * and every admin order page failed. The same happens the other way round when a
 * deploy that reads a NEW column lands before the migration that adds it.
 *
 * Code reading a column added by a recent migration can use this to degrade to
 * "nothing there yet" instead of taking the page down with it.
 */
export function isMissingColumnError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2022'
  )
}

/** Either kind of schema lag: the database is behind the code that queries it. */
export function isSchemaBehindError(error: unknown): boolean {
  return isMissingTableError(error) || isMissingColumnError(error)
}
