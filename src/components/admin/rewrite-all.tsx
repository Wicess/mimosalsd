'use client'

import { useRef, useState } from 'react'
import { rewriteNextPostedProduct } from '@/app/actions/admin-posted-products'
import { Button } from '@/components/ui/button'

type Progress = { index: number; total: number; name: string }

/**
 * Research every posted product on the web and rewrite its page, one product at a
 * time, while this page stays open (owner, 2026-09-15). Each product is its own
 * request, so nothing runs up against a time limit, and stopping or closing the
 * page ends the run after the product in hand.
 */
export function RewriteAllButton({ ready }: { ready: boolean }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failures, setFailures] = useState<string[]>([])
  const stop = useRef(false)

  async function run() {
    if (!window.confirm('Research every product on the web and rewrite its page? This uses Claude and web search, takes about a minute per product, and runs while this page stays open.')) return
    stop.current = false
    setRunning(true)
    setMessage(null)
    setFailures([])
    let after: string | null = null
    let rewritten = 0
    try {
      while (!stop.current) {
        const step = await rewriteNextPostedProduct(after)
        if ('error' in step) {
          setMessage(step.error)
          break
        }
        if (step.done) {
          setMessage(`Done: ${rewritten} of ${step.total} products researched and rewritten.`)
          break
        }
        setProgress({ index: step.index, total: step.total, name: step.name })
        if (step.result.error) setFailures((list) => [...list, `${step.name}: ${step.result.error}`])
        else rewritten += 1
        after = step.slug
      }
      if (stop.current) setMessage(`Stopped after ${rewritten} products. Start again to redo them from the first.`)
    } catch {
      setMessage(`The run was interrupted after ${rewritten} products. Start again to continue from the first.`)
    } finally {
      setRunning(false)
    }
  }

  if (!ready) {
    return (
      <p className="max-w-xs text-xs text-foreground-muted">
        Add ANTHROPIC_API_KEY in Vercel to research and rewrite every product page.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" loading={running} disabled={running} onClick={run}>
          {running ? 'Researching…' : 'Research & rewrite all'}
        </Button>
        {running ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => { stop.current = true }}>
            Stop
          </Button>
        ) : null}
      </div>
      {running && progress ? (
        <p role="status" className="text-xs text-foreground-muted">
          {progress.index} of {progress.total}: {progress.name}
        </p>
      ) : null}
      {message ? <p role="status" className="text-xs text-foreground-muted">{message}</p> : null}
      {failures.length ? (
        <ul className="max-w-md list-disc pl-4 text-xs text-danger-fg">
          {failures.map((f) => <li key={f}>{f}</li>)}
        </ul>
      ) : null}
    </div>
  )
}
