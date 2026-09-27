/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CAN prisma/migrations REBUILD THE SCHEMA FROM NOTHING?
 *
 *  Production was not built by replaying these files, so nothing ever forced them
 *  to be replayable — and one of them was not: 0008 updated a column no earlier
 *  migration created, because that column reached production by `prisma db push`.
 *  A gap like that is invisible until the day it matters, and the day it matters
 *  is the day the database is gone.
 *
 *  Replaying them for real needs a throwaway Postgres, which not every machine or
 *  CI job has. So this replays them symbolically: it walks the statements in
 *  order, keeps a catalogue of what exists so far, and reports the first use of a
 *  table, column or enum that nothing before it created. Then it compares the
 *  catalogue with schema.prisma, because a history can touch only what it created
 *  and still rebuild the WRONG schema.
 *
 *  It reports a statement it cannot parse rather than passing over it. A checker
 *  that quietly skips what it does not understand reports a sound history when it
 *  has not read half of it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { splitStatements } from '../src/lib/db/split-sql'

/** Table name → its columns, and the enum types, as they stand mid-replay. */
export interface Catalogue {
  readonly tables: Map<string, Set<string>>
  readonly types: Set<string>
  readonly problems: string[]
  readonly migrations: number
  readonly statements: number
}

export interface Expected {
  readonly models: Map<string, Set<string>>
  readonly enums: Set<string>
}

/** `"public"."Order"` and `Order` are the same table. */
function ident(raw: string): string {
  const last = raw.trim().split('.').pop() ?? ''
  return last.replace(/^"|"$/g, '')
}

/** Split on commas that are not inside parentheses or quotes. */
function splitTop(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: "'" | '"' | null = null
  let current = ''
  for (const char of input) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') quote = char
    else if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

export function replayMigrations(directory: string): Catalogue {
  const tables = new Map<string, Set<string>>()
  const types = new Set<string>()
  const problems: string[] = []
  let where = ''

  const report = (message: string) => problems.push(`${where}\n    ${message}`)

  const requireTable = (name: string): Set<string> | null => {
    const columns = tables.get(name)
    if (!columns) report(`table "${name}" does not exist yet`)
    return columns ?? null
  }

  const requireColumn = (table: string, column: string): void => {
    const columns = tables.get(table)
    if (columns && !columns.has(column)) report(`"${table}" has no column "${column}" yet`)
  }

  const requireType = (name: string): void => {
    if (!types.has(name)) report(`enum type "${name}" does not exist yet`)
  }

  /** A column definition whose type is an enum this history created. */
  const noteTypeUse = (definition: string): void => {
    const match = /^"[^"]+"\s+"([^"]+)"/.exec(definition.trim())
    if (match) requireType(match[1]!)
  }

  const enumStatement = (statement: string): boolean => {
    const create = /^CREATE\s+TYPE\s+("?[\w".]+"?)\s+AS\s+ENUM/i.exec(statement)
    if (create) {
      types.add(ident(create[1]!))
      return true
    }
    const rename = /^ALTER\s+TYPE\s+("?[\w".]+"?)\s+RENAME\s+TO\s+("?[\w".]+"?)/i.exec(statement)
    if (rename) {
      requireType(ident(rename[1]!))
      types.delete(ident(rename[1]!))
      types.add(ident(rename[2]!))
      return true
    }
    const addValue = /^ALTER\s+TYPE\s+("?[\w".]+"?)\s+ADD\s+VALUE/i.exec(statement)
    if (addValue) {
      requireType(ident(addValue[1]!))
      return true
    }
    const drop = /^DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?("?[\w".]+"?)/i.exec(statement)
    if (drop) {
      requireType(ident(drop[1]!))
      types.delete(ident(drop[1]!))
      return true
    }
    return false
  }

  const createTable = (statement: string): boolean => {
    const match = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w".]+"?)\s*\(([\s\S]*)\)[^)]*$/i.exec(statement)
    if (!match) return false
    const columns = new Set<string>()
    for (const part of splitTop(match[2]!)) {
      if (/^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)\b/i.test(part)) continue
      const column = /^"([^"]+)"/.exec(part)
      if (!column) {
        report(`could not read a column from: ${part.slice(0, 60)}`)
        continue
      }
      columns.add(column[1]!)
      noteTypeUse(part)
    }
    tables.set(ident(match[1]!), columns)
    return true
  }

  const alterTable = (statement: string): boolean => {
    const match = /^ALTER\s+TABLE\s+(?:ONLY\s+)?("?[\w".]+"?)\s+([\s\S]+)$/i.exec(statement)
    if (!match) return false
    const table = ident(match[1]!)
    const columns = requireTable(table)
    for (const action of splitTop(match[2]!)) {
      const add = /^ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"[\s\S]*)$/i.exec(action)
      if (add) {
        noteTypeUse(add[1]!)
        columns?.add(ident(/^("[^"]+")/.exec(add[1]!)![1]!))
        continue
      }
      const drop = /^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/i.exec(action)
      if (drop) {
        requireColumn(table, drop[1]!)
        columns?.delete(drop[1]!)
        continue
      }
      const alter = /^ALTER\s+COLUMN\s+"([^"]+)"\s+([\s\S]*)$/i.exec(action)
      if (alter) {
        requireColumn(table, alter[1]!)
        const toType = /^TYPE\s+"([^"]+)"/i.exec(alter[2]!)
        if (toType) requireType(toType[1]!)
        continue
      }
      const foreign =
        /^ADD\s+CONSTRAINT\s+"[^"]+"\s+FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+("?[\w".]+"?)\s*\(([^)]*)\)/i.exec(
          action,
        )
      if (foreign) {
        for (const column of splitTop(foreign[1]!)) requireColumn(table, ident(column))
        const target = ident(foreign[2]!)
        if (requireTable(target)) {
          for (const column of splitTop(foreign[3]!)) requireColumn(target, ident(column))
        }
        continue
      }
      const key = /^ADD\s+CONSTRAINT\s+"[^"]+"\s+(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^)]*)\)/i.exec(action)
      if (key) {
        for (const column of splitTop(key[1]!)) requireColumn(table, ident(column))
        continue
      }
      if (/^DROP\s+CONSTRAINT\b/i.test(action) || /^ADD\s+CONSTRAINT\s+"[^"]+"\s+CHECK\b/i.test(action)) continue
      report(`unrecognised ALTER TABLE action: ${action.slice(0, 70)}`)
    }
    return true
  }

  const createIndex = (statement: string): boolean => {
    const match =
      /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?[\w]+"?\s+ON\s+("?[\w".]+"?)\s*(?:USING\s+\w+\s*)?\(([\s\S]*)\)\s*$/i.exec(
        statement,
      )
    if (!match) return false
    const table = ident(match[1]!)
    if (!requireTable(table)) return true
    for (const part of splitTop(match[2]!)) {
      // An expression index — lower("email") — names its columns inside.
      for (const column of part.match(/"([^"]+)"/g) ?? [`"${ident(part)}"`]) {
        requireColumn(table, ident(column))
      }
    }
    return true
  }

  const updateRows = (statement: string): boolean => {
    const match = /^UPDATE\s+("?[\w".]+"?)(?:\s+(?:AS\s+)?(\w+))?\s+SET\s+([\s\S]*)$/i.exec(statement)
    if (!match) return false
    const table = ident(match[1]!)
    if (!requireTable(table)) return true
    const body = match[3]!
    for (const part of splitTop(body.split(/\bFROM\b|\bWHERE\b/i)[0]!)) {
      const target = /^"([^"]+)"\s*=/.exec(part)
      if (target) requireColumn(table, target[1]!)
    }
    // Whatever else it reads must at least exist somewhere by now.
    const known = new Set<string>([...tables.keys()])
    for (const set of tables.values()) for (const column of set) known.add(column)
    for (const raw of body.match(/"([^"]+)"/g) ?? []) {
      const name = ident(raw)
      if (!known.has(name)) report(`"${name}" is not a table or column that exists yet`)
    }
    return true
  }

  const directories = readdirSync(directory).sort()
  let statements = 0
  let migrations = 0

  for (const name of directories) {
    let sql: string
    try {
      sql = readFileSync(join(directory, name, 'migration.sql'), 'utf8')
    } catch {
      continue
    }
    migrations++
    for (const statement of splitStatements(sql)) {
      statements++
      where = `  ${name}: ${statement.replace(/\s+/g, ' ').slice(0, 70)}…`
      // Nothing to catalogue: the schema every object below lives in.
      if (/^CREATE\s+SCHEMA\b/i.test(statement)) continue
      if (enumStatement(statement)) continue
      if (createTable(statement)) continue
      if (alterTable(statement)) continue
      if (createIndex(statement)) continue
      if (updateRows(statement)) continue
      report('unrecognised statement — this checker has not read it')
    }
  }

  return { tables, types, problems, migrations, statements }
}

/**
 * What Prisma expects to find, under the names the database uses (@@map / @map).
 * A relation field is not a column; the scalar holding the key is.
 */
export function expectedFromSchema(schemaPath: string): Expected {
  const text = readFileSync(schemaPath, 'utf8')
  const models = new Map<string, Set<string>>()
  const enums = new Set<string>()
  const modelNames = new Set<string>()

  for (const match of text.matchAll(/^model\s+(\w+)\s*\{/gm)) modelNames.add(match[1]!)
  for (const match of text.matchAll(/^enum\s+(\w+)\s*\{/gm)) enums.add(match[1]!)

  for (const match of text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const body = match[2]!
    const columns = new Set<string>()
    for (const line of body.split('\n')) {
      const field = /^\s*(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line)
      if (!field) continue
      const [, name, type, , , rest] = field
      if (modelNames.has(type!)) continue
      columns.add(/@map\("([^"]+)"\)/.exec(rest ?? '')?.[1] ?? name!)
    }
    models.set(/@@map\("([^"]+)"\)/.exec(body)?.[1] ?? match[1]!, columns)
  }
  return { models, enums }
}

/** Every table, column and enum schema.prisma expects that the replay never built. */
export function missingFromReplay(built: Catalogue, expected: Expected): string[] {
  const differences: string[] = []
  for (const [table, columns] of expected.models) {
    const actual = built.tables.get(table)
    if (!actual) {
      differences.push(`the migrations never create table "${table}", which schema.prisma expects`)
      continue
    }
    for (const column of columns) {
      if (!actual.has(column)) differences.push(`the migrations never add "${table}"."${column}"`)
    }
  }
  for (const name of expected.enums) {
    if (!built.types.has(name)) differences.push(`the migrations never create enum "${name}"`)
  }
  return differences
}
