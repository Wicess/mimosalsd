#!/usr/bin/env tsx
/**
 * Regenerate src/lib/legality/state-dyeing.data.ts from a research file.
 *
 *   npx tsx scripts/state-dyeing-facts.ts scripts/content/state-facts-2026-09-28.json
 *
 * The research file holds one sourced record per jurisdiction (water hardness from
 * USGS, climate from the NOAA/NCEI State Climate Summaries, sassafras range from Flora
 * of North America, fibre events from each event's own site). This script copies it
 * into typed data, minus the entries a person decided not to publish (EXCLUDE below,
 * each with its reason), so the page never shows anything that was not checked.
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** Event names left out on review, with why. */
const EXCLUDE: Record<string, string> = {
  'Fiber Arts Festival': 'ND: a general multi-craft show, not a fibre or dye event',
}

const HARDNESS = new Set(['soft', 'moderate', 'hard', 'very hard', 'varies'])

const file = process.argv[2]
if (!file) throw new Error('usage: state-dyeing-facts.ts <research.json>')
const { states } = JSON.parse(readFileSync(file, 'utf8')) as {
  states: Record<string, {
    waterHardness: string | null
    waterNote: string | null
    waterSource: string | null
    humidity: string | null
    humiditySource: string | null
    sassafrasNative: boolean | null
    sassafrasSource: string | null
    fiberEvents: { name: string; place: string; month: string | null; url: string }[]
  }>
}

const out: Record<string, unknown> = {}
for (const [code, s] of Object.entries(states).sort(([a], [b]) => a.localeCompare(b))) {
  if (s.waterHardness && !HARDNESS.has(s.waterHardness)) throw new Error(`${code}: unknown hardness ${s.waterHardness}`)
  out[code] = {
    waterHardness: s.waterHardness,
    waterNote: s.waterNote,
    waterSource: s.waterSource,
    humidity: s.humidity,
    humiditySource: s.humiditySource,
    sassafrasNative: s.sassafrasNative,
    sassafrasSource: s.sassafrasSource,
    fiberEvents: s.fiberEvents.filter((e) => !(e.name in EXCLUDE)),
  }
}

const header = readFileSync('src/lib/legality/state-dyeing.data.ts', 'utf8').split('export const STATE_DYEING_FACTS')[0]
writeFileSync(
  'src/lib/legality/state-dyeing.data.ts',
  `${header}export const STATE_DYEING_FACTS: Partial<Record<UsJurisdictionCode, StateDyeingFacts>> = ${JSON.stringify(out, null, 2)}\n`,
)
console.log(`Wrote ${Object.keys(out).length} jurisdictions.`)
