/**
 * Split a migration file into individual statements.
 *
 * The Neon HTTP driver runs one statement per request, so scripts/db-migrate.ts has
 * to cut each migration on its statement-terminating semicolons — and only those.
 *
 * Extracted from the runner and tested because the first version was wrong in a way
 * that only surfaced once somebody wrote a thoughtful comment. It tracked string
 * quotes but not COMMENTS, so a `--` comment's prose was parsed as SQL:
 *
 *  · a semicolon in "rows written wrong; re-running is a no-op" ended a statement,
 *    and the remainder was sent to Postgres as a syntax error — which halted every
 *    migration after it, for everyone, on every run;
 *  · an apostrophe in "the thread's own messages" opened a string literal, after
 *    which every real semicolon was ignored and statements silently merged.
 *
 * Comments are now skipped as a unit, so nothing inside one can change how the SQL
 * around it is read.
 */

const TRANSACTION_MARKERS = new Set(['BEGIN', 'COMMIT', 'ROLLBACK'])

export function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]!

    // A `--` comment outside a string runs to the end of its line. Its contents are
    // prose: skip them whole, keeping only the line break.
    if (!inSingle && !inDouble && char === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      if (end === -1) break
      current += '\n'
      i = end // the loop's i++ steps past the newline
      continue
    }

    // A `/* … */` block comment, skipped the same way. Prisma does not emit these,
    // but a hand-written migration may.
    if (!inSingle && !inDouble && char === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      if (end === -1) break
      i = end + 1
      continue
    }

    if (char === "'" && !inDouble) inSingle = !inSingle
    else if (char === '"' && !inSingle) inDouble = !inDouble

    if (char === ';' && !inSingle && !inDouble) {
      const trimmed = current.trim()
      if (trimmed) statements.push(trimmed)
      current = ''
    } else {
      current += char
    }
  }

  const tail = current.trim()
  if (tail) statements.push(tail)

  return (
    statements
      .map((s) => s.replace(/\n{2,}/g, '\n').trim())
      .filter((s) => s.length > 0)
      // Prisma wraps enum alterations in BEGIN/COMMIT. The HTTP driver auto-commits
      // each statement and cannot span a transaction, so the markers are dropped.
      .filter((s) => !TRANSACTION_MARKERS.has(s.toUpperCase()))
  )
}
