'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/** The full link, and one tap to copy it for pasting into a post or a bio. */
export function CopyLink({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <code className="min-w-0 truncate rounded bg-surface-sunken px-2 py-1 text-xs text-foreground">{value}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          } catch {
            setCopied(false)
          }
        }}
        className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium text-foreground hover:bg-surface-sunken"
      >
        {copied ? <CheckIcon className="size-4 text-success-fg" /> : <CopyIcon className="size-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}
