'use client'

import { Suspense, lazy, useEffect, useState } from 'react'

/**
 * Non-critical UI, loaded and mounted only after the browser goes idle.
 *
 * `Deferred` alone was not enough: mounting late still left the component code in the
 * main chunk, where it was PARSED AND EVALUATED during initial hydration. `lazy()`
 * moves it to a separate chunk that is never fetched until we ask for it, which is
 * where the Total Blocking Time saving actually comes from.
 *
 * Neither of these is needed for first paint. The age gate must still appear quickly
 * enough to be a real gate, which is why the idle timeout is capped at 1.5s and the
 * Safari fallback is 400ms rather than something lazier.
 */
const AgeGate = lazy(() =>
  import('@/components/compliance/age-gate').then((m) => ({ default: m.AgeGate })),
)
const ChatWidget = lazy(() =>
  import('@/components/chat/chat-widget').then((m) => ({ default: m.ChatWidget })),
)
// The email sign-up, install and notifications prompts, and the install guide.
// Nothing in them is needed before the visitor has been on the page for 10 seconds.
const EngagementPrompts = lazy(() =>
  import('@/components/pwa/engagement').then((m) => ({ default: m.EngagementPrompts })),
)
const UnreadWatcher = lazy(() =>
  import('@/components/chat/unread-watcher').then((m) => ({ default: m.UnreadWatcher })),
)

function useIdle(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }
    ).requestIdleCallback

    if (typeof idle === 'function') {
      const handle = idle(() => setReady(true), { timeout: 1500 })
      return () => {
        const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void })
          .cancelIdleCallback
        cancel?.(handle)
      }
    }

    const timer = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(timer)
  }, [])

  return ready
}

export function DeferredUI({ withChat = true }: { withChat?: boolean } = {}) {
  const ready = useIdle()
  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <AgeGate />
      {/* The full-screen chat page renders without these: nothing may cover its composer. */}
      {withChat ? (
        <>
          <ChatWidget />
          <UnreadWatcher />
          <EngagementPrompts />
        </>
      ) : null}
    </Suspense>
  )
}
