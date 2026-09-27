/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TABLES IN AN ARTICLE BODY (2026-09-18).
 *
 *  Several articles on this site are comparisons — four concentrate methods, three
 *  spectrum terms, a disposable against a cartridge — written as paragraphs because
 *  the renderer had nothing else. A comparison is the shape an answer engine lifts
 *  most readily when it is a table: one row per thing, one column per question, each
 *  cell true on its own. As prose the same facts have to be re-assembled by the
 *  reader, and by the engine, from sentences spread down the page.
 *
 *  The syntax is the pipe table every Markdown editor already writes, so a table typed
 *  or pasted into the admin panel renders without anybody learning a new convention:
 *
 *    | Method | Solvent | Heat |
 *    | --- | --- | --- |
 *    | Rosin | None | Yes |
 *
 *  A block that is ALMOST a table — a missing separator row, a row with the wrong
 *  number of cells — is not guessed at. It is returned as null and renders as the
 *  paragraph it was, so a malformed table shows its pipes rather than silently
 *  dropping or shifting a cell into the wrong column.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface BodyTable {
  readonly header: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

const SEPARATOR_CELL = /^:?-{3,}:?$/

function cells(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|') || trimmed.length < 2) return null
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

/** The table in a body block, or null when the block is not exactly one. */
export function parseTable(block: string): BodyTable | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 3) return null

  const parsed = lines.map(cells)
  if (parsed.some((row) => row === null)) return null
  const [header, separator, ...rows] = parsed as string[][]

  if (!header || !separator) return null
  if (header.length < 2 || header.some((cell) => cell === '')) return null
  if (separator.length !== header.length || !separator.every((cell) => SEPARATOR_CELL.test(cell))) {
    return null
  }
  if (rows.length === 0 || rows.some((row) => row.length !== header.length)) return null

  return { header, rows }
}
