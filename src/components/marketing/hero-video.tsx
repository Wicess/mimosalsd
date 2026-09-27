'use client'

import { useEffect, useRef, useState } from 'react'

export interface HeroVideoSource {
  readonly src: string
  readonly type: 'video/mp4' | 'video/webm'
}

/** One clip, in each format it comes in, in the order the browser should try them. */
export interface HeroVideoClip {
  readonly sources: readonly HeroVideoSource[]
}

/** How long one clip takes to fade in over the other. Matches `duration-1000` below. */
const CROSSFADE_MS = 1000

/**
 * The phone hero's film: a muted loop behind the copy, below `lg` only.
 *
 * Nothing here may cost the first paint. The photograph underneath paints first and
 * is what LCP measures; the film is fetched only once the browser goes idle, and only
 * when all of these hold:
 *
 *   · the screen is narrower than `lg`. From `lg` the hero is the two-column layout
 *     with the specimen plate, and there is no film at all;
 *   · the visitor has not asked for reduced motion;
 *   · the visitor has not asked to save data (`navigator.connection.saveData`).
 *
 * It fades in on its first real frame, so there is never a black box between the
 * photograph and the film, and it pauses whenever the hero is off screen, so a phone
 * scrolled down to the products is not decoding video nobody can see. If the browser
 * refuses to play it (iOS Low Power Mode does), the photograph simply stays.
 *
 * ── More than one clip: a carousel ─────────────────────────────────────────
 * Each clip plays once and the next fades in OVER it, the last handing back to the
 * first. Over, not across: the outgoing clip stays fully opaque until the incoming
 * one has covered it, so the photograph never shows through mid-fade. Only the
 * first clip is fetched up front; the rest are fetched once it is playing, so a
 * visitor who leaves in the first seconds downloads one clip, not every clip.
 *
 * Muted, inline and never picture-in-picture, because iOS only autoplays a video
 * that is all of those.
 *
 * No play/pause button, at the owner's repeated request. Visitors who have asked their
 * device for reduced motion never get the film at all (see the checks above), which
 * is the accessibility case the button used to cover.
 */
export function HeroVideo({ clips }: { clips: readonly HeroVideoClip[] }) {
  const videos = useRef<Array<HTMLVideoElement | null>>([])
  // Mirrors `active` for event handlers, which would otherwise see a stale value.
  const activeRef = useRef(0)
  // Clips whose element has been told to load, so each is loaded exactly once.
  const loadedRef = useRef(new Set<number>())
  const [armed, setArmed] = useState(false)
  // How many clips may fetch: the first, and then all of them once it plays.
  const [fetchable, setFetchable] = useState(1)
  const [active, setActive] = useState(0)
  // The clip being faded over. It stays opaque underneath until the fade completes.
  const [outgoing, setOutgoing] = useState<number | null>(null)
  // True from the first frame on. The film stays up when paused; it is a still then.
  const [shown, setShown] = useState(false)
  const carousel = clips.length > 1

  // Whether to fetch at all, decided once the page has gone quiet.
  useEffect(() => {
    const narrow = window.matchMedia('(width < 64rem)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (!narrow.matches || still.matches || connection?.saveData) return

    const arm = () => setArmed(true)
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(arm, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(arm, 1500)
    return () => window.clearTimeout(id)
  }, [])

  // Load each clip once it is allowed to fetch. Safari checks the `muted` ATTRIBUTE
  // before it will autoplay, and React only ever sets the property, so both are set
  // here before anything loads.
  useEffect(() => {
    if (!armed) return
    for (let i = 0; i < Math.min(fetchable, clips.length); i++) {
      const video = videos.current[i]
      if (!video || loadedRef.current.has(i)) continue
      loadedRef.current.add(i)
      video.muted = true
      video.defaultMuted = true
      video.setAttribute('muted', '')
      video.load()
    }
  }, [armed, fetchable, clips.length])

  // Play the clip on screen whenever it can be seen, and pause it whenever it cannot.
  useEffect(() => {
    const first = videos.current[0]
    if (!armed || !first) return

    const narrow = window.matchMedia('(width < 64rem)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let onScreen = true

    const sync = () => {
      const video = videos.current[activeRef.current]
      if (!video) return
      if (onScreen && narrow.matches && !still.matches) {
        void video.play().catch(() => {
          // Refused by the browser. The photograph is the fallback; nothing is broken.
        })
      } else {
        video.pause()
      }
    }

    // Every clip fills the same box, so watching the first is watching them all.
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = Boolean(entry?.isIntersecting)
        sync()
      },
      { threshold: 0.1 },
    )
    observer.observe(first)
    narrow.addEventListener('change', sync)
    still.addEventListener('change', sync)
    const all = videos.current
    return () => {
      observer.disconnect()
      narrow.removeEventListener('change', sync)
      still.removeEventListener('change', sync)
      for (const video of all) video?.pause()
    }
  }, [armed])

  // Once a fade has finished, the clip underneath is hidden and rewound for its next turn.
  useEffect(() => {
    if (outgoing === null) return
    const id = window.setTimeout(() => {
      const video = videos.current[outgoing]
      if (video) {
        video.pause()
        video.currentTime = 0
      }
      setOutgoing(null)
    }, CROSSFADE_MS)
    return () => window.clearTimeout(id)
  }, [outgoing])

  /** The clip on screen has finished: start the next one, which fades in when it plays. */
  const advance = (from: number) => {
    const next = videos.current[(from + 1) % clips.length]
    const current = videos.current[from]
    if (!next) return
    next.currentTime = 0
    void next.play().catch(() => {
      // The next clip will not play. Keep the one on screen going instead of stopping.
      if (current) {
        current.currentTime = 0
        void current.play().catch(() => {})
      }
    })
  }

  return (
    <>
      {clips.map((clip, i) => {
        const visible = shown && (i === active || i === outgoing)
        return (
          <video
            key={clip.sources[0]?.src ?? i}
            ref={(el) => {
              videos.current[i] = el
            }}
            aria-hidden
            tabIndex={-1}
            muted
            loop={!carousel}
            playsInline
            preload="none"
            disablePictureInPicture
            disableRemotePlayback
            onPlaying={() => {
              if (i !== activeRef.current) {
                // The next clip has started: it fades in over the one that just ended.
                setOutgoing(activeRef.current)
                activeRef.current = i
                setActive(i)
              }
              setShown(true)
              if (carousel) setFetchable(clips.length)
            }}
            onEnded={() => {
              if (i === activeRef.current) advance(i)
            }}
            // The clip on screen sits above the one it is covering; both sit under the scrim.
            style={{ zIndex: i === active ? -19 : -20 }}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-[var(--ease-standard)] motion-reduce:transition-none lg:hidden ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {armed && i < fetchable
              ? clip.sources.map((s) => <source key={s.src} src={s.src} type={s.type} />)
              : null}
          </video>
        )
      })}
    </>
  )
}
