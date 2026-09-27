'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { url } from '@/lib/seo/routes'

/**
 * Batch-code lookup.
 *
 * The pattern buyers are told to expect: a code on the package, typed in or scanned,
 * that resolves to the report for THAT batch. Competitors publish a folder of PDFs,
 * which proves nothing about the jar in your hand.
 */
export function BatchLookup({ knownCodes }: { knownCodes: readonly string[] }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return setError('Enter the batch code printed on your package.')
    if (!knownCodes.includes(trimmed)) {
      return setError(
        `We have no published report for batch ${trimmed}. Check the code and try again, or contact us — we would want to know about a package with a code we do not recognise.`,
      )
    }
    router.push(url.labBatch(trimmed))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="batch" className="block text-sm font-medium text-foreground">
        Batch code
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="batch"
          value={code}
          onChange={(e) => {
            setError(null)
            setCode(e.target.value)
          }}
          placeholder="AM-2026-0388"
          autoComplete="off"
          spellCheck={false}
          className="tabular min-h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-base text-foreground"
        />
        <Button type="submit" variant="primary">
          Find report
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-fg">
          {error}
        </p>
      )}
      <p className="text-xs text-foreground-muted">
        Printed on the label and encoded in the QR code on your package.
      </p>
    </form>
  )
}
