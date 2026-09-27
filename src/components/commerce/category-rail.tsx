'use client'

import { useEffect, useRef } from 'react'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE CATEGORY RAIL — a rail that drifts, and stops when you look at it.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It moves on its own, left to right, slowly enough to read. Put a pointer on it
 * and it stops dead — the motion exists to say "there is more of this than fits",
 * and the moment someone is actually reading a tile, continuing to move it is
 * working against them.
 *
 * WHY A REAL SCROLL CONTAINER AND NOT A CSS MARQUEE:
 *
 * A `transform: translateX` marquee is two lines of CSS and cannot be touched —
 * literally. It has no scroll position, so a phone cannot swipe it, and giving
 * it one means reimplementing momentum, rubber-banding and fling velocity by
 * hand, all of which the browser already does better. So the rail is an ordinary
 * horizontal scroller and the drift is nothing more than `scrollLeft` being
 * nudged each frame. Swipe, trackpad, shift-wheel and keyboard all work because
 * none of them were replaced.
 *
 * THE LOOP: the tiles are rendered four times over. When the drift reaches the
 * start of the track it jumps forward by a whole number of copies, which lands on
 * a pixel-identical frame further along — so the seam cannot be seen, because
 * there is nothing different to see.
 *
 * FOUR copies rather than two, and that is not padding. A jump is only invisible
 * if there is somewhere to jump TO: with two copies of three categories the whole
 * track was 2500px against a 1920px viewport, so the furthest the scroll could
 * ever travel was 580px and the "seamless" jump was a 1250px lurch clamped to the
 * end of the rail. Four copies give the drift room to run, and the jump distance
 * is computed as the largest whole number of copies that still fits inside the
 * scrollable range.
 *
 * WHAT STOPS IT: a pointer over the rail, a finger on it (plus a moment after,
 * so a fling is allowed to settle rather than being fought), keyboard focus
 * inside it, the tab being hidden, the section being scrolled off screen, and
 * `prefers-reduced-motion`. Anything else and it drifts.
 *
 * Every one of those is ASKED each frame rather than tracked in a variable, so
 * there is no state that can get stuck holding the rail still.
 */

/**
 * Pixels per second.
 *
 * 26 was too slow to register. A 23rem tile took fourteen seconds to travel its
 * own width, which at a glance is indistinguishable from a rail that is not
 * moving at all — and a motion nobody perceives is the cost of the animation
 * with none of the benefit. 45 crosses a tile in about eight seconds: plainly
 * moving, still slow enough to read a name as it passes.
 */
const DRIFT = 45

/** How long after a finger lifts before the drift resumes. Lets a fling settle. */
const RESUME_AFTER_TOUCH_MS = 2200

/**
 * How many times the tile set is repeated.
 *
 * The loop needs at least one copy's worth of scroll range to jump across, and a
 * copy has to be wider than the widest viewport for that to hold. Three
 * categories at 23rem is roughly 1200px a copy, so four copies clear a 4K screen
 * with room over.
 */
const COPIES = 4

export function CategoryRail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  /** Set while a finger is down, and for a moment after it lifts. */
  const touchingUntil = useRef(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track || !railRef.current) return

    /*
      Read live rather than once at mount, so turning the system setting off
      starts the rail without a reload.
    */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const rail = railRef.current
    let frame = 0
    let last = performance.now()
    let onScreen = true

    /*
      ASKED, NOT REMEMBERED.

      This was a counter — hover incremented it, mouse-leave decremented it — and
      a counter only stays correct if every increment is matched. `mouseleave`
      does not fire when the pointer leaves via the edge of the window, or when
      the element under it re-renders mid-hover, so one unmatched increment left
      the rail paused for the rest of the page's life with nothing to show why.

      There is no state here now. Each frame asks the DOM what is true: is the
      pointer over the rail, is focus inside it, was there a finger on it
      recently. Nothing to leak, and it self-corrects the moment the answer
      changes.
    */
    const held = () =>
      rail.matches(':hover') ||
      rail.contains(document.activeElement) ||
      performance.now() < touchingUntil.current

    /*
      The distance to jump when the drift runs off the start.

      A whole number of copies, so the frame after the jump is identical to the
      frame before it — and the largest such number that still lands inside the
      scrollable range, so the rail spends as long as possible between seams.
      Recomputed on demand because a resize changes both terms.
    */
    const jump = () => {
      const unit = track.scrollWidth / COPIES
      const range = track.scrollWidth - track.clientWidth
      return Math.max(1, Math.floor(range / unit)) * unit
    }

    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (!held() && onScreen && !document.hidden && !reduced.matches) {
        /*
          Leftward through the list means the tiles travel RIGHT across the
          screen, which is the direction that was asked for.
        */
        const next = track.scrollLeft - (DRIFT * dt) / 1000
        track.scrollLeft = next <= 0 ? next + jump() : next
      }
      frame = requestAnimationFrame(tick)
    }

    // Start one jump in, so there is rail in both directions to swipe into.
    track.scrollLeft = jump()
    frame = requestAnimationFrame(tick)

    // Nothing to animate for a reader who has scrolled past it.
    const seen = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    seen.observe(track)

    const onVisibility = () => {
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      seen.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  /*
    Touch holds the rail while the finger is down and for a beat after it lifts.
    Without the tail the drift resumes into the middle of a fling and the two
    fight over the same scroll position.

    A DEADLINE rather than a flag: `pointerup` does not always arrive — a
    cancelled gesture, a call taking over the screen — and a deadline expires on
    its own where a flag would stay set. Pushed forward on every event, so the
    hold lasts as long as the finger does.
  */
  function onTouch(event: React.PointerEvent) {
    if (event.pointerType === 'mouse') return
    touchingUntil.current = performance.now() + RESUME_AFTER_TOUCH_MS
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      ref={railRef}
      className="cat-rail [--tile:min(76vw,20rem)] min-[640px]:[--tile:min(44vw,20rem)] min-[1280px]:[--tile:min(25vw,23rem)]"
    >
      <div
        ref={trackRef}
        tabIndex={0}
        aria-label={`${label}, scrollable`}
        onPointerDown={onTouch}
        onPointerMove={onTouch}
        onPointerUp={onTouch}
        onPointerCancel={onTouch}
        /*
          `touch-action: pan-x` tells the browser this gesture is horizontal
          before the first frame of it, so a swipe never steals a beat from the
          page's vertical scroll deciding which one it belongs to.

          No snapping. Snap points and a continuous drift disagree by definition:
          the browser would keep pulling the rail back onto the nearest tile.
        */
        className="-mx-[clamp(1rem,4.5vw,5.5rem)] flex touch-pan-x gap-6 overflow-x-auto overscroll-x-contain px-[clamp(1rem,4.5vw,5.5rem)] py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/*
          The first copy is the real one. The rest exist only so the loop has
          identical frames to jump between, and are hidden from assistive
          technology — a screen reader should hear three categories, not twelve.
        */}
        {children}
        {Array.from({ length: COPIES - 1 }, (_, i) => (
          <div key={i} aria-hidden className="contents">
            {children}
          </div>
        ))}
      </div>
    </div>
  )
}
