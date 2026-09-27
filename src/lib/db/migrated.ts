import { isSchemaBehindError } from './errors'

/**
 * Run a read that needs a migration the database may not have yet.
 *
 * Code and schema deploy separately here: migrations are applied by hand
 * (`npm run db:migrate:http`), so a deploy can land before its migration. A page
 * that selects a column the database has not got raises P2021/P2022 and shows an
 * error screen; with this it can say which migration is missing instead.
 *
 * Only schema lag is caught. Every other failure still throws, because "the
 * database is behind" and "the database is broken" need different answers.
 */
export type Migrated<T> = { migrated: true; value: T } | { migrated: false }

export async function whenMigrated<T>(read: () => Promise<T>): Promise<Migrated<T>> {
  try {
    return { migrated: true, value: await read() }
  } catch (error) {
    if (isSchemaBehindError(error)) return { migrated: false }
    throw error
  }
}
