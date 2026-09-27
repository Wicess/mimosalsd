'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { MoonIcon, SunIcon } from '@/components/ui/icon'
import { applyTheme, readStoredTheme, storeTheme, syncThemeColor } from '@/lib/design/theme'
import { cn } from '@/lib/utils'

/**
 * A change made here is broadcast so every mounted toggle re-reads at once. `storage`
 * covers other tabs; the custom event covers this one, which `storage` does not fire for.
 */
const THEME_EVENT = 'themepreferencechange'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener(THEME_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(THEME_EVENT, onChange)
  }
}

/** Dark unless the visitor chose light: dark is the site's default (app/layout.tsx). */
function currentTheme(): 'light' | 'dark' {
  return readStoredTheme() === 'light' ? 'light' : 'dark'
}

/*
  The server cannot read localStorage, so it renders the default. The inline script in
  <head> has already put a stored light choice on <html>, so nothing visible changes on
  hydration: only which icon the button shows.
*/
function serverSnapshot(): 'dark' {
  return 'dark'
}

/**
 * Light or dark, from the nav bar on every screen size (owner, 2026-09-15).
 *
 * Two states rather than the old three-way control: the site is dark by default on
 * every device, so there is no "follow the device" state to offer. The icon shows the
 * theme the button switches TO, and the label says so.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverSnapshot)
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Switch to light mode' : 'Switch to dark mode'
  const Icon = next === 'light' ? SunIcon : MoonIcon

  // The status bar colour, for a visitor whose stored light theme was applied before paint.
  useEffect(() => {
    syncThemeColor()
  }, [theme])

  function toggle() {
    storeTheme(next)
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md px-3 text-foreground transition-colors duration-[160ms] hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring) motion-reduce:transition-none',
        className,
      )}
    >
      <Icon className="size-5" />
    </button>
  )
}
