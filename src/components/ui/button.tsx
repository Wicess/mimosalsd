import { cn } from '@/lib/utils'

/**
 * Button.
 *
 * `accent` is the CTA variant and there should be exactly ONE on a screen. Scarcity
 * is what makes a CTA read as the primary action; two golds and neither is primary.
 *
 * Every variant clears the 44px touch floor (WCAG 2.5.8 / Apple HIG) even at `sm` —
 * padding grows rather than the target shrinking.
 */
type Variant = 'accent' | 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  accent:
    'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover shadow-sm',
  secondary:
    'border border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
  ghost: 'text-foreground hover:bg-surface-sunken',
  danger: 'bg-danger-fg text-white hover:opacity-90',
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-5 text-base',
  lg: 'min-h-12 px-6 text-lg',
}

/**
 * A link that looks like a button.
 *
 * Exists because `<Button><a href>…</a></Button>` is invalid HTML and produces
 * overlapping, partially-obscured tap targets — caught by an axe target-size failure on
 * the cart. If it navigates it is an anchor; if it acts it is a button.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium',
        /*
          Transform is in the transition list, and there is a press state.

          Every button on the site animated its colours and nothing else, so a tap
          produced no acknowledgement until the action itself completed — on a slow
          connection that is a control that appears not to have heard you. 160ms is
          the press-feedback band; anything slower stops reading as a response.

          Named properties, never `all`: `all` would animate layout properties too and
          drag the button off the compositor.
        */
        'transition-[scale,color,background-color,border-color] duration-[160ms] ease-[var(--ease-standard)]',
        'active:scale-[0.97] motion-reduce:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}) {
  return (
    <button
      // Disabled while loading so a double-tap cannot double-submit an order.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium',
        /*
          Transform is in the transition list, and there is a press state.

          Every button on the site animated its colours and nothing else, so a tap
          produced no acknowledgement until the action itself completed — on a slow
          connection that is a control that appears not to have heard you. 160ms is
          the press-feedback band; anything slower stops reading as a response.

          Named properties, never `all`: `all` would animate layout properties too and
          drag the button off the compositor.
        */
        'transition-[scale,color,background-color,border-color] duration-[160ms] ease-[var(--ease-standard)]',
        'active:scale-[0.97] motion-reduce:active:scale-100',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  )
}
