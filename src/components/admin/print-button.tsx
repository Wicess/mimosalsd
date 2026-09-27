'use client'

import { Button } from '@/components/ui/button'

/**
 * Opens the browser's print dialog.
 *
 * The whole reason the invoice is a page rather than a generated PDF: every operating
 * system already has a renderer, a "save as PDF" option and a printer picker, and all
 * three are better than anything we would ship in the bundle.
 *
 * It is a `<button>`, not a link, and the page is fully usable without it — Ctrl/Cmd+P
 * does the same thing. So there is no fallback to write: if JavaScript never loads,
 * the documents are still on screen and still print correctly, because the `@media
 * print` rules are CSS.
 */
export function PrintButton() {
  return (
    <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
      Print
    </Button>
  )
}
