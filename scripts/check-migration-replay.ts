#!/usr/bin/env tsx
/** Prints what scripts/migration-replay.ts found. Enforced by tests/db/migration-replay.test.ts. */
import { join } from 'node:path'
import { expectedFromSchema, missingFromReplay, replayMigrations } from './migration-replay'

const built = replayMigrations(join(process.cwd(), 'prisma', 'migrations'))
const expected = expectedFromSchema(join(process.cwd(), 'prisma', 'schema.prisma'))
const differences = missingFromReplay(built, expected)
const columns = [...expected.models.values()].reduce((sum, set) => sum + set.size, 0)

console.log(
  `\nMigration replay check — ${built.migrations} migration(s), ${built.statements} statement(s), ` +
    `rebuilding ${built.tables.size} table(s) and ${built.types.size} enum(s).\n` +
    `schema.prisma expects ${expected.models.size} table(s), ${columns} column(s), ${expected.enums.size} enum(s).\n`,
)

if (built.problems.length > 0) {
  console.log(`✗ ${built.problems.length} statement problem(s):\n`)
  for (const problem of built.problems) console.log(problem, '\n')
}
if (differences.length > 0) {
  console.log(`✗ the rebuilt schema would not match schema.prisma (${differences.length}):\n`)
  for (const difference of differences) console.log(`  ${difference}`)
  console.log('')
}
if (built.problems.length === 0 && differences.length === 0) {
  console.log('✓ PASSED — the history rebuilds schema.prisma from an empty database.\n')
} else {
  process.exitCode = 1
}
