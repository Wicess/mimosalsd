'use client'

import { useEffect } from 'react'
import { isStandalone } from '@/components/pwa/install-store'

/**
 * Registers /sw.js, which makes the site installable and gives it an offline
 * page (public/sw.js says what it will and will not cache).
 *
 * Production only: in development a service worker sits between the browser and
 * the dev server's hot updates, and the first confusing symptom is a page that
 * will not change no matter what you edit.
 *
 * Registered after load, so it never competes with the first paint, and never on
 * an admin page: an operator should always be talking to the live server.
 */
/**
 * Tell the admin the site was installed as an app. Two signals, because browsers
 * differ: Chrome and Edge fire `appinstalled`; Safari never does, but a launch in
 * standalone display mode means it is running installed. Recorded once per visitor
 * by the server, so repeat launches cost one tiny request and write nothing.
 */
function reportInstall() {
  void fetch('/api/visits/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'APP_INSTALLED', path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {})
}

export function ServiceWorker() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return
    // The same test as everywhere else, including iPhones that report `fullscreen` (WebKit bug 264218).
    const standalone = isStandalone()
    let reported = false
    try {
      reported = sessionStorage.getItem('app-install-reported') === '1'
    } catch {
      // Storage blocked: the server still records it only once.
    }
    if (standalone && !reported) {
      reportInstall()
      try {
        sessionStorage.setItem('app-install-reported', '1')
      } catch {
        // Ignore.
      }
    }
    window.addEventListener('appinstalled', reportInstall)
    return () => window.removeEventListener('appinstalled', reportInstall)
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    if (window.location.pathname.startsWith('/admin')) return

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unregistrable worker costs the visitor nothing; the site works without it.
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
