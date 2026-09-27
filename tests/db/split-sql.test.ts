import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitStatements } from '@/lib/db/split-sql'

/**
 * The migration runner sends one statement per request, so this function decides
 * what actually reaches the production database. It was wrong: it tracked quotes
 * but not comments, and a thoughtfully commented migration halted every migration
 * after it. These cases are the inputs that broke it.
 */

describe('splitStatements', () => {
  it('splits ordinary statements on their semicolons', () => {
    expect(splitStatements('SELECT 1;\nSELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('ignores a semicolon inside a -- comment', () => {
    // The exact shape from 0008: prose with a semicolon, then the real statement.
    const sql = `-- only rows written wrong; re-running is a no-op
UPDATE "Order" SET "x" = 1 WHERE "y" = 2;`
    expect(splitStatements(sql)).toEqual(['UPDATE "Order" SET "x" = 1 WHERE "y" = 2'])
  })

  it('ignores an apostrophe inside a -- comment', () => {
    // The exact shape from 0009. Without the fix the apostrophe opened a string and
    // the next real semicolon was swallowed, merging two statements into one.
    const sql = `-- derived from the thread's own messages
UPDATE "A" SET "b" = 1;
UPDATE "C" SET "d" = 2;`
    expect(splitStatements(sql)).toEqual(['UPDATE "A" SET "b" = 1', 'UPDATE "C" SET "d" = 2'])
  })

  it('still respects a semicolon inside a string literal', () => {
    expect(splitStatements(`INSERT INTO t VALUES ('a;b');`)).toEqual([
      `INSERT INTO t VALUES ('a;b')`,
    ])
  })

  it('does not treat -- inside a string as a comment', () => {
    expect(splitStatements(`SELECT '--not a comment';`)).toEqual([
      `SELECT '--not a comment'`,
    ])
  })

  it('handles an escaped quote inside a string', () => {
    expect(splitStatements(`SELECT 'it''s; fine';`)).toEqual([`SELECT 'it''s; fine'`])
  })

  it('skips a block comment containing a semicolon', () => {
    expect(splitStatements(`/* a; b */ SELECT 1;`)).toEqual(['SELECT 1'])
  })

  it('drops the transaction markers the HTTP driver cannot honour', () => {
    expect(splitStatements('BEGIN;\nALTER TYPE x ADD VALUE \'Y\';\nCOMMIT;')).toEqual([
      "ALTER TYPE x ADD VALUE 'Y'",
    ])
  })

  it('keeps a quoted identifier containing a semicolon intact', () => {
    expect(splitStatements('SELECT "a;b" FROM t;')).toEqual(['SELECT "a;b" FROM t'])
  })

  /*
    The real files, not just synthetic cases. No migration may yield a statement that
    begins with prose — that is precisely the fragment that reached Postgres as a
    syntax error and stopped the runner.
  */
  describe('every migration in the repository', () => {
    const dir = join(process.cwd(), 'prisma/migrations')
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()

    for (const folder of folders) {
      it(`${folder} splits into well-formed SQL`, () => {
        const sql = readFileSync(join(dir, folder, 'migration.sql'), 'utf8')
        const statements = splitStatements(sql)
        expect(statements.length).toBeGreaterThan(0)
        for (const statement of statements) {
          // Every statement opens with a SQL keyword, never with comment prose.
          expect(statement, `${folder}: ${statement.slice(0, 60)}`).toMatch(
            /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|WITH|SELECT|COMMENT|GRANT)\b/i,
          )
        }
      })
    }
  })
})
