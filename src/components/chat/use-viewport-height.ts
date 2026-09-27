'use client'

import { useEffect } from 'react'

/**
 * Keeps a chat sized to the space the software keyboard actually leaves.
 *
 * Ported from WHAM, where it fixed a reported bug. `100svh`/`100dvh` know nothing
 * about the keyboard: when it opens, the layout keeps its full height, the browser
 * scrolls the focused input into view, and the conversation slides off the top —
 * the composer ends up marooned mid-screen under blank space.
 *
 * visualViewport reports the real visible rectangle, keyboard included. This
 * publishes it as `--app-vh` (and the keyboard's offset as `--app-vv-top`) on the
 * root, so the chat is laid out against what the person can actually see. A style
 * write rather than React state, so a keyboard animation costs one property set per
 * frame instead of re-rendering the message list.
 */
export function useViewportHeight(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const vv = window.visualViewport
    const root = document.documentElement

    const apply = () => {
      root.style.setProperty('--app-vh', `${Math.round(vv?.height ?? window.innerHeight)}px`)
      // iOS also OFFSETS the viewport when the keyboard opens; without this the
      // composer sits under it even when the height is right.
      root.style.setProperty('--app-vv-top', `${Math.round(vv?.offsetTop ?? 0)}px`)
    }

    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('orientationchange', apply)
      root.style.removeProperty('--app-vh')
      root.style.removeProperty('--app-vv-top')
    }
  }, [enabled])
}
