/**
 * Shown where a page needs a migration the database has not had yet. Says which
 * one and what to run, rather than showing an error screen with a digest in it.
 */
export function MigrationNotice({
  migration,
  what,
}: {
  /** The migration's folder name, e.g. "0013_promoters". */
  migration: string
  /** What is unavailable until it is applied, in plain words. */
  what: string
}) {
  return (
    <section className="rounded-lg bg-warning-bg p-4 text-sm leading-relaxed text-warning-fg">
      <h2 className="font-semibold">Database migration {migration} has not been applied</h2>
      <p className="mt-1 opacity-90">
        {what} Back the database up, then run <code>npm run db:migrate:http</code>. It only adds
        columns and tables, and is safe to run twice.
      </p>
    </section>
  )
}
