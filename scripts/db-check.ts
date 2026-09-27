#!/usr/bin/env tsx
/** Connectivity smoke test with retry. `npm run db:check` */
import 'dotenv/config'
import { query } from '../src/lib/db/neon'

async function main() {
  const info = await query<{ db: string; version: string }>(
    'select current_database() as db, version() as version',
  )
  console.log('✓ connected to:', info[0]?.db)
  console.log('  server:', info[0]?.version?.slice(0, 55))

  const tables = await query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  )
  console.log(
    `  tables: ${tables.length}`,
    tables.length ? `(${tables.slice(0, 4).map((t) => t.table_name).join(', ')}…)` : '(empty)',
  )
}

main().catch((e: Error) => {
  console.error('✗ FAILED:', e.message.split('\n')[0])
  process.exit(1)
})
