'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckIcon, CrossIcon } from '@/components/ui/icon'

/**
 * Send proof of payment.
 *
 * Ported from WHAM's checkout proof form: several screenshots at once, an optional
 * reference, a preview of what is about to be sent. Uploading ALSO tells us the
 * payment went out, so the buyer does one thing rather than two — the bare "I have
 * paid" button this replaces asked them to claim first and explain second.
 *
 * A `fetch` to a route handler rather than a Server Action, because Server Actions
 * cap their body at 1 MB by default and a single phone screenshot is often more.
 *
 * The limits shown here are advisory. The route enforces all of them again, and
 * decides the file type by reading the bytes — the `accept` attribute is a hint to
 * the file picker, not a security boundary.
 */

const MAX_FILES = 5
const MAX_BYTES = 15 * 1024 * 1024

interface Picked {
  readonly file: File
  /** Object URL for an image preview. Revoked when removed or on unmount. */
  readonly preview: string | null
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'done'; readonly count: number }

export function PaymentProofForm({
  token,
  alreadyClaimed = false,
}: {
  token: string
  /** Once claimed, this becomes "add another receipt" rather than the first send. */
  alreadyClaimed?: boolean
}) {
  const router = useRouter()
  const inputId = useId()
  const refId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Picked[]>([])
  const [txRef, setTxRef] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  // Object URLs hold the whole file in memory until revoked. Several full-resolution
  // screenshots left alive on a phone is a real cost.
  useEffect(
    () => () => {
      for (const p of picked) if (p.preview) URL.revokeObjectURL(p.preview)
    },
    [picked],
  )

  function add(list: FileList | null) {
    if (!list) return
    const incoming = [...list]
    const tooBig = incoming.find((f) => f.size > MAX_BYTES)
    if (tooBig) {
      setStatus({ kind: 'error', message: `${tooBig.name} is over 15 MB.` })
      return
    }
    const room = MAX_FILES - picked.length
    if (incoming.length > room) {
      setStatus({ kind: 'error', message: `Up to ${MAX_FILES} files at a time.` })
    } else {
      setStatus({ kind: 'idle' })
    }
    setPicked((current) => [
      ...current,
      ...incoming.slice(0, room).map((file) => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })),
    ])
    // Clear the input so choosing the same file again still fires `change`.
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(index: number) {
    setPicked((current) => {
      const target = current[index]
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return current.filter((_, i) => i !== index)
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (picked.length === 0 && txRef.trim() === '') {
      setStatus({
        kind: 'error',
        message: 'Add a screenshot, a PDF receipt or a transaction reference.',
      })
      return
    }

    setStatus({ kind: 'sending' })
    const body = new FormData()
    for (const p of picked) body.append('files', p.file)
    if (txRef.trim()) body.append('txRef', txRef.trim())

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(token)}/receipt`, {
        method: 'POST',
        body,
      })
      const result = (await response.json().catch(() => null)) as
        | { ok: true; uploaded: number }
        | { ok: false; error: string }
        | null

      if (!response.ok || !result || !result.ok) {
        setStatus({
          kind: 'error',
          message:
            result && !result.ok ? result.error : 'That did not go through. Please try again.',
        })
        return
      }

      for (const p of picked) if (p.preview) URL.revokeObjectURL(p.preview)
      setPicked([])
      setTxRef('')
      setStatus({ kind: 'done', count: result.uploaded })
      // The status card at the top of the page reads the order; re-render it.
      router.refresh()
    } catch {
      setStatus({
        kind: 'error',
        message: 'You appear to be offline. Nothing was sent — please try again.',
      })
    }
  }

  if (status.kind === 'done') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-success-fg/40 bg-success-bg p-4 text-sm text-success-fg"
      >
        <CheckIcon className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Thank you — we have it.</p>
          <p className="mt-1">
            {status.count > 0
              ? `${status.count} file${status.count === 1 ? '' : 's'} received. `
              : ''}
            We check every payment by hand and will email you as soon as it is confirmed.
          </p>
          <button
            type="button"
            onClick={() => setStatus({ kind: 'idle' })}
            className="mt-2 min-h-11 underline underline-offset-4"
          >
            Add another receipt
          </button>
        </div>
      </div>
    )
  }

  const sending = status.kind === 'sending'

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h3 className="font-product text-base font-medium text-foreground">
        {alreadyClaimed ? 'Add another receipt' : 'Sent the payment? Show us.'}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
        A screenshot of the confirmation, or the PDF your bank gives you. It is stored
        privately and only seen by the person checking your order.
      </p>

      <div className="mt-4">
        <label
          htmlFor={inputId}
          className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-sunken px-4 py-5 text-center text-sm text-foreground-muted hover:border-foreground/40"
        >
          <span className="font-medium text-foreground">Choose screenshots or a PDF</span>
          <span className="text-xs">
            Up to {MAX_FILES} files · 15 MB each · JPG, PNG, WebP or PDF
          </span>
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          onChange={(e) => add(e.target.files)}
          disabled={sending || picked.length >= MAX_FILES}
          className="sr-only"
        />
      </div>

      {picked.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {picked.map((p, i) => (
            <li
              key={`${p.file.name}-${i}`}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-sunken"
            >
              {p.preview ? (
                // A local object URL, so next/image has nothing to optimise.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.preview} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center p-1 text-center text-[11px] break-all text-foreground-muted">
                  {p.file.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={sending}
                aria-label={`Remove ${p.file.name}`}
                className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-stone-950/70 text-white"
              >
                <CrossIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <label htmlFor={refId} className="text-sm font-medium text-foreground">
          Transaction reference <span className="text-foreground-muted">(optional)</span>
        </label>
        <input
          id={refId}
          value={txRef}
          onChange={(e) => setTxRef(e.target.value)}
          maxLength={200}
          disabled={sending}
          placeholder="Cash App note, transaction ID or BTC txid"
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-foreground-subtle"
        />
      </div>

      {status.kind === 'error' && (
        <p role="alert" className="mt-3 text-sm text-danger-fg">
          {status.message}
        </p>
      )}

      <Button type="submit" variant="accent" loading={sending} className="mt-4 w-full">
        {alreadyClaimed ? 'Send receipt' : 'Send proof of payment'}
      </Button>
    </form>
  )
}
