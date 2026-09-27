'use client'

import { useEffect } from 'react'

const SENT_KEY = 'sg-human-checked'
/** Things a person does and a page-fetching bot does not. Scrolling alone is not one: the browser scrolls pages by itself. */
const INPUTS = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'mousemove'] as const

/**
 * Proves a person is using the site, so the admin counts real visitors only
 * (lib/visitors/human.ts).
 *
 * The first genuine input — a touch, a tap, a key, a mouse wheel or a mouse move,
 * delivered by the browser itself (`isTrusted`), on a page whose JavaScript ran —
 * sends one small request, once per browsing session; the server keeps one record
 * per visitor. A browser under automation says so (`navigator.webdriver`) and sends
 * nothing. Nothing is sent on the admin, and nothing about the input is recorded,
 * only that there was one.
 */
export function HumanCheck() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return
    if (navigator.webdriver) return
    try {
      if (sessionStorage.getItem(SENT_KEY) === '1') return
    } catch {
      // Storage blocked: check anyway; the server records it once regardless.
    }

    let done = false
    const stop = () => {
      for (const type of INPUTS) window.removeEventListener(type, onInput, true)
    }
    function onInput(event: Event) {
      if (done || !event.isTrusted) return
      done = true
      stop()
      void fetch('/api/visits/human', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: window.location.pathname }),
        keepalive: true,
      })
        .then((response) => {
          if (!response.ok) return
          try {
            sessionStorage.setItem(SENT_KEY, '1')
          } catch {
            // Ignore.
          }
        })
        .catch(() => {})
    }
    for (const type of INPUTS) window.addEventListener(type, onInput, { capture: true, passive: true })
    return stop
  }, [])

  return null
}
