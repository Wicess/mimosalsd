/**
 * Theme selection.
 *
 * Three states, not two. "System" is the default and is a real choice — it means
 * "follow the device", which is what most people want and what the OS already knows.
 * A two-way switch silently overrides that the first time it is touched and gives no
 * way back, which is why the toggle here is a three-way control rather than the
 * sun/moon switch every site ships.
 */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_STORAGE_KEY = 'theme-preference'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/**
 * Applied to `<html>`. The CSS is written so that:
 *   - no attribute  → `prefers-color-scheme` decides
 *   - data-theme="light" → beats a dark OS
 *   - data-theme="dark"  → beats a light OS
 * So "system" is expressed by REMOVING the attribute, not by setting a third value.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    root.style.removeProperty('color-scheme')
  } else {
    root.setAttribute('data-theme', theme)
    // Keeps form controls, scrollbars and the caret in the chosen theme.
    root.style.colorScheme = theme
  }
  syncThemeColor()
}

/**
 * The phone's status bar takes its colour from <meta name="theme-color">, which the
 * layout sets to the dark header. Read back from the header's own token, so the bar
 * matches whichever theme is on screen with no second copy of the colour.
 */
export function syncThemeColor(): void {
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
  if (!surface) return
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', surface))
}

export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(raw) ? raw : 'system'
  } catch {
    // Private mode or blocked storage — follow the device rather than failing.
    return 'system'
  }
}

export function storeTheme(theme: Theme): void {
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Preference simply will not persist. The page still switches for this session.
  }
}

/**
 * Runs BEFORE first paint, inlined in <head>.
 *
 * Without it the document renders with the OS theme, then React hydrates and swaps
 * to the stored preference — a white flash on every navigation for anyone who chose
 * dark on a light machine. It has to be inline and synchronous for that reason; an
 * external file would be fetched too late to help.
 *
 * Deliberately tiny and defensive: it touches only the root element, and any failure
 * leaves the OS preference in place, which is a working page rather than a broken one.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t}}catch(e){}})()`
