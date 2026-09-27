'use client'

import { useActionState, useRef, useState } from 'react'
import { uploadMedia, type MediaUploadState } from '@/app/actions/admin-media'
import { Button } from '@/components/ui/button'

const INITIAL: MediaUploadState = {}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MEDIA UPLOADER
 *
 *  A plain `<form action={…}>` around a file input. No drag-and-drop canvas, no
 *  progress ring, no third-party widget — the operator picks a file and presses a
 *  button, and everything that decides whether the file is acceptable happens on
 *  the server, where it cannot be skipped.
 *
 *  `accept` is set for convenience only. It filters the OS picker and is not a
 *  control: the action sniffs the leading bytes and refuses anything that is not
 *  what it claims, whatever the picker allowed through.
 *
 *  The one piece of local state is the SIZE CHECK, which exists to save an operator
 *  from watching a 40 MB file upload before the server tells them it was too big.
 *  The server enforces the same limit; this is a courtesy, not a gate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MAX_BYTES = 8 * 1024 * 1024

export function MediaUploader() {
  const [state, formAction, pending] = useActionState(uploadMedia, INITIAL)
  const [tooBig, setTooBig] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <form
        action={formAction}
        onSubmit={() => {
          setCopied(false)
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="media-file"
            className="block text-sm font-medium text-foreground"
          >
            File
          </label>
          <input
            ref={inputRef}
            id="media-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0]
              setTooBig(
                file && file.size > MAX_BYTES
                  ? `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.`
                  : null,
              )
              setCopied(false)
            }}
            className="mt-1 block w-full text-sm text-foreground-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-surface-sunken file:px-3 file:text-sm file:text-foreground"
          />
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            JPEG, PNG, GIF, WebP, AVIF or PDF, up to 8 MB. The file type is checked by
            reading the file, not by trusting its extension. SVG is not accepted — it
            can carry script, and it would be served from our own domain.
          </p>
        </div>

        {tooBig && (
          <p role="alert" className="text-sm text-danger-fg">
            {tooBig}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-danger-fg">
            {state.error}
          </p>
        )}

        <Button type="submit" variant="primary" size="sm" loading={pending} disabled={Boolean(tooBig)}>
          Upload
        </Button>
      </form>

      {state.url && (
        /*
          The result is the whole point of the screen, so it is selectable text in a
          real input rather than a line of prose an operator has to drag-select. The
          copy button is progressive: `navigator.clipboard` is unavailable over plain
          HTTP and in some embedded browsers, and the input still works when it is.
        */
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm text-success-fg">Uploaded.</p>
          <label
            htmlFor="media-url"
            className="mt-3 block text-xs font-medium text-foreground"
          >
            Public URL
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="media-url"
              readOnly
              value={state.url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border-strong bg-surface-sunken px-3 text-xs text-foreground"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.url!)
                  setCopied(true)
                } catch {
                  // No clipboard access — the input is already selectable, so the
                  // operator has a way through. Saying nothing is better than an
                  // error about a convenience.
                  inputRef.current?.blur()
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            The name is the hash of the file, so this URL is permanent and safe to
            cache forever. Uploading the same file again returns this same URL.
          </p>
        </div>
      )}
    </div>
  )
}
