/**
 * "Active now" indicator, WHAM's.
 *
 * A dot with one slow expanding ring: presence is ambient state, so it breathes
 * rather than blinks. Offline is a flat dot with no motion at all, so the difference
 * reads at a glance. Never the only signal — every use sits beside words that say
 * the same thing (WCAG 1.4.1). The ring is dropped under reduced motion.
 */
export function PresenceDot({
  online,
  blink = false,
  className = '',
}: {
  online: boolean
  /**
   * The customer-facing version: larger, a vivid green, and blinking with a fast ring
   * so "someone is here" is unmissable in the chat header. The admin inbox keeps the
   * quiet breathing dot, where twenty of them would be noise.
   */
  blink?: boolean
  className?: string
}) {
  if (blink) {
    /*
      The customer chat's "Admin online" light. Asked for bright and pulsing, then
      toned down (owner, 2026-09-14): a small green dot with a soft glow that
      breathes every 2.4s, and one gentle ring spreading out of it. Under reduced
      motion it holds still.
    */
    return (
      <span className={`relative inline-flex size-2.5 shrink-0 ${className}`} aria-hidden>
        {online ? (
          <span className="absolute inset-0 rounded-full bg-presence/45 motion-safe:animate-[pulse-ring_2.4s_var(--ease-out-expo)_infinite]" />
        ) : null}
        <span
          className={`relative size-2.5 rounded-full ${
            online
              ? 'bg-presence shadow-[0_0_4px_1px_color-mix(in_oklab,var(--presence)_45%,transparent)] motion-safe:animate-[presence-glow_2.4s_ease-in-out_infinite]'
              : 'bg-foreground-subtle/50'
          }`}
        />
      </span>
    )
  }
  return (
    <span className={`relative inline-flex size-2 shrink-0 ${className}`} aria-hidden>
      {online ? (
        <span className="absolute inset-0 rounded-full bg-success-fg motion-safe:animate-[pulse-ring_2.4s_var(--ease-out-expo)_infinite]" />
      ) : null}
      <span className={`relative size-2 rounded-full ${online ? 'bg-success-fg' : 'bg-foreground-subtle/50'}`} />
    </span>
  )
}
