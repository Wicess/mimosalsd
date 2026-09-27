#!/usr/bin/env node
/**
 * Runs before `build` and `dev`.
 *
 * An interrupted Next build leaves `.next/lock` behind plus a half-written app
 * manifest. The next build then "succeeds" against that debris and serves a 500
 * ("client reference manifest does not exist") for whichever route was mid-write.
 * That cost real debugging time once, so detect it rather than rediscover it.
 *
 * Only clears the lock when no next process actually holds it.
 */
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

const lock = '.next/lock'
if (!existsSync(lock)) process.exit(0)

let running = ''
try {
  running = execSync('pgrep -af "next (build|dev)" || true', { encoding: 'utf8' })
} catch {
  /* pgrep missing — fall through and leave the lock alone */
}

if (running.trim() === '') {
  rmSync(lock, { recursive: true, force: true })
  rmSync('.next/server/app', { recursive: true, force: true })
  console.log('• cleared a stale .next lock from an interrupted build')
} else {
  console.error('✗ another Next build/dev process is running — refusing to clear the lock:')
  console.error(running.trim().split('\n').map((l) => `    ${l}`).join('\n'))
  process.exit(1)
}
