/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  DESIGN TOKENS — three layers: primitive → semantic → component
 *
 *  Defined in TypeScript rather than only in CSS so that contrast ratios are
 *  TESTABLE. `tests/design/contrast.test.ts` verifies every foreground/background
 *  pair against WCAG 2.2 AA in both themes. A palette claim that is not tested is
 *  just a hope — and saturated "psychedelic" palettes fail contrast by default.
 *
 *  DIRECTION: herbarium. Pressed plants, laboratory glass, field notes.
 *  The buyer's first two questions are "is this legal?" and "will I get scammed?".
 *  Neon and rainbow gradients answer neither. This palette answers both by looking
 *  like the thing it actually is: a botanical house that tests what it sells.
 *
 *  Parchment ground, deep botanical green, one scarce citron CTA, and a near-neutral
 *  grey reserved for data. The greens and greys share a hue so the page reads as one
 *  material rather than a kit of parts — and the yellow earns its loudness by being
 *  the only warm thing on the screen.
 *
 *  It replaces a blue-violet scheme that was the single most common palette in
 *  generated design work. Considered colour, generous whitespace, editorial type,
 *  and clinical clarity exactly where trust is decided — COAs, legality, shipping,
 *  checkout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── LAYER 1: PRIMITIVES ──────────────────────────────────────────────────────
// Raw values. A component must never reference these directly.

/**
 * Stone — the neutral ramp, tinted green so it belongs to the greens rather than
 * sitting beside them. One grey family, consistently biased; mixing a warm and a cool
 * grey is what makes a palette look assembled instead of designed.
 */
export const stone = {
  950: '#12160F',
  900: '#1A1F16',
  800: '#262D20',
  700: '#363E2E',
  600: '#48523B',
  500: '#5C6749',
  400: '#7E876C',
  300: '#B3BAA4',
  200: '#E4E7E1',
  100: '#E9EBE0',
  50: '#F4F5EE',
} as const

/**
 * Graphite — a true neutral grey, used by the LIGHT theme only.
 *
 * `stone` is tinted green so it belongs beside the greens, which is right on a dark
 * ground where everything is a shade of the same near-black. On white it read as
 * sage: body copy looked faintly olive rather than grey. Light mode is white and
 * grey with green as the accent, so its neutrals are neutral.
 *
 * Two ramps, one per theme, never side by side — so this is not the mixed-grey
 * problem, it is each theme using the grey that suits its ground.
 */
export const graphite = {
  950: '#16181A',
  900: '#1F2225',
  800: '#2C3033',
  700: '#3D4246',
  600: '#4E5459',
  500: '#646B71',
  400: '#868D94',
  300: '#B4BABF',
  200: '#DFE2E5',
  100: '#EEF0F2',
  50: '#F6F7F8',
} as const

/**
 * Paper — parchment. The page ground carries the faintest yellow, so "light yellow"
 * is the material the site is printed on rather than a colour applied on top of it.
 * Pure white is reserved for raised cards, where it reads as a sheet laid down.
 */
export const paper = {
  /**
   * White is the site. Not off-white, not parchment — white.
   *
   * An earlier pass used a faint yellow ground, which tinted every page and made the
   * green read as the dominant colour rather than the accent. Green now appears only
   * where something is interactive or growing; the page itself is a clean sheet, and
   * the two greys below are the only tonal steps away from it.
   */
  base: '#FFFFFF',
  raised: '#FFFFFF',
  sunken: '#F5F7F4',
} as const

/**
 * Moss — deep botanical green.
 *
 * No longer wired into either theme: the palette runs a single accent (citron), and
 * green now appears only where it is semantic — the success status pair — and in the
 * hue the `stone` neutrals are tinted with. The ramp stays because it is the source
 * those semantic greens were picked against, and because reversing the single-accent
 * decision should be a one-line change rather than a re-derivation.
 */
export const moss = {
  900: '#0F2417',
  800: '#153020',
  700: '#1C4429',
  600: '#255637',
  500: '#316B46',
  400: '#5C9370',
  300: '#8FBBA0',
  200: '#C0D9C9',
  100: '#E3EFE8',
} as const

/**
 * Citron — light yellow. Reserved for the primary CTA, and scarcity is what makes it
 * work: it is the only warm colour on the page, so it needs no size or weight to be
 * found. Carried at 300 with near-black text rather than a saturated fill with white
 * text — the light value is the point, and it clears AA by a wide margin.
 */
export const citron = {
  900: '#332B05',
  800: '#4C4008',
  700: '#6B5A0D',
  600: '#877312',
  500: '#A88F1C',
  400: '#CDB443',
  300: '#E6D283',
  200: '#F2E6B2',
  100: '#FAF4D9',
} as const

/**
 * Clinical — near-neutral grey for data surfaces: COA tables, lab panels, specs.
 * Holds a trace of the same hue as `stone`, so a lab table reads cooler and cleaner
 * than the page around it without introducing a second grey family.
 */
export const clinical = {
  900: '#181B17',
  800: '#252924',
  700: '#3A403A',
  600: '#4E554E',
  500: '#68706A',
  400: '#9AA19C',
  300: '#C6CBC7',
  200: '#DFE3E0',
  100: '#EFF2EE',
} as const

/**
 * Status — compliance states.
 * Colour is NEVER the only signal (WCAG 1.4.1). Every status surface pairs its
 * colour with an icon and a text label. In this category a misread status is not a
 * cosmetic problem — it is someone believing we can ship to a state we cannot.
 */
/**
 * Dye swatches (2026-09-29): the shades Mimosa hostilis root bark gives on wool, for
 * the home page's colour range. Content colours, not interface colours: they appear
 * only as swatch fills, and they are approximations of a dyed skein, which the page
 * says.
 */
export const dyeSwatch = {
  rose: '#c4868b',
  plum: '#7e3e5c',
  burgundy: '#6a2432',
  chocolate: '#4b2b22',
  slate: '#5c5d69',
  charcoal: '#2d2c32',
} as const

export const status = {
  successFg: '#0F3D22',
  success: '#1A7A40',
  successBg: '#D8F0E0',
  /**
   * Ochre, not yellow. The CTA is now light yellow, and a yellow "conditions apply"
   * badge beside a yellow button makes both meaningless. Warning is pushed toward
   * orange so the two can never be read as the same signal.
   */
  warningFg: '#6B3A08',
  warning: '#9C570D',
  warningBg: '#FBE8D2',
  dangerFg: '#7A1A1A',
  danger: '#B31B1B',
  dangerBg: '#FBE0E0',
  /** Slate-teal rather than primary blue — a pure blue is a foreign object here. */
  infoFg: '#123A44',
  info: '#1A6273',
  infoBg: '#D6EAEF',
} as const

// ── LAYER 2: SEMANTIC ────────────────────────────────────────────────────────
// What a colour MEANS. Components reference this layer.

export const lightTheme = {
  background: paper.base,
  surface: paper.raised,
  surfaceSunken: graphite[50],
  surfaceData: graphite[100],

  foreground: graphite[950],
  foregroundMuted: graphite[600],
  foregroundSubtle: graphite[500],
  foregroundOnAccent: graphite[950],

  /**
   * Two-tier borders, deliberately.
   * `border` is decorative grouping — WCAG exempts pure decoration and dividers, so
   * it can stay soft. `borderStrong` and `borderData` are load-bearing: they are the
   * only thing identifying an input outline or separating a COA table cell, so they
   * are held to 1.4.11 (3:1) and verified in tests/design/contrast.test.ts.
   */
  border: graphite[200],
  borderStrong: graphite[400],
  borderData: graphite[500],

  /**
   * ONE ACCENT. Read this before adding a second.
   *
   * `primary` used to be moss green and `accent` citron, which meant two saturated
   * colours competing on every page — a green link beside a yellow button, and
   * neither reading as the thing to do next. Every site sampled from Awwwards Sites
   * of the Month ran exactly one saturated colour against a neutral ground; Floema,
   * a botanical studio, carries an entire identity on citron alone.
   *
   * So citron is the accent, and `primary` is now ink. Links, focus and primary
   * buttons are the neutral; the one warm colour on the page is the thing you are
   * meant to click. Green survives where it is SEMANTIC rather than decorative —
   * `successFg`/`successBg` — and in the tint of the dark ground.
   */
  primary: graphite[950],
  primaryHover: graphite[800],
  primaryMuted: graphite[100],
  onPrimary: '#FFFFFF',

  /**
   * CTA only. If it appears twice on a screen, one of them is wrong.
   *
   * `accent` is a FILL. `accentFg` is the same colour at a value that survives being
   * used as TEXT — the split exists because a light-yellow fill and legible
   * yellow-on-yellow text cannot be the same value, and the badge and the button both
   * need one of them. Status colours already work this way (successFg / successBg);
   * the accent simply had not needed it while it was a dark gold.
   */
  accent: citron[300],
  accentHover: citron[400],
  accentMuted: citron[100],
  accentFg: citron[700],
  /** Near-black on light yellow — 12:1. A white-on-yellow button would fail outright. */
  onAccent: graphite[950],

  ring: graphite[700],

  successFg: status.successFg,
  successBg: status.successBg,
  warningFg: status.warningFg,
  warningBg: status.warningBg,
  dangerFg: status.dangerFg,
  dangerBg: status.dangerBg,
  infoFg: status.infoFg,
  infoBg: status.infoBg,
} as const

/**
 * Dark theme.
 * Desaturated tonal variants, not inverted values — inverting a light palette
 * produces vibrating saturated colour on dark and fails contrast independently.
 * Verified separately by the contrast test.
 */
export const darkTheme = {
  background: stone[950],
  surface: stone[900],
  surfaceSunken: '#0B0E09',
  surfaceData: stone[800],

  foreground: '#F6F7F0',
  foregroundMuted: stone[200],
  // stone[400] was tried and failed: 4.4:1 on `surface` and 3.89:1 on `surfaceData`.
  // Dark backgrounds are less forgiving than they look, which is why the contrast
  // matrix is exhaustive rather than spot-checked.
  foregroundSubtle: stone[300],
  foregroundOnAccent: stone[950],

  border: stone[700],
  borderStrong: stone[400],
  borderData: stone[400],

  /* Same single-accent rule as light — see the note there. */
  primary: '#F6F7F0',
  primaryHover: stone[200],
  primaryMuted: stone[800],
  onPrimary: stone[950],

  accent: citron[300],
  accentHover: citron[200],
  accentMuted: citron[900],
  accentFg: citron[300],
  onAccent: stone[950],

  ring: stone[300],

  successFg: '#8FD9AA',
  successBg: '#0A2E19',
  warningFg: '#F0C088',
  warningBg: '#3A2109',
  dangerFg: '#F5A3A3',
  dangerBg: '#3D0F0F',
  infoFg: '#95CEDC',
  infoBg: '#0B2830',
} as const

/**
 * Widened deliberately. `typeof lightTheme` narrows to literal hex strings, which
 * would make darkTheme unassignable — and the point of the type is that both themes
 * satisfy the same contract.
 */
export type SemanticTheme = Record<keyof typeof lightTheme, string>

// ── LAYER 3: SCALES ──────────────────────────────────────────────────────────

/** 4px base rhythm. Every spacing value in the product comes from here. */
export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
} as const

/**
 * Fluid type scale. Body is 16px minimum on mobile — below that iOS auto-zooms on
 * input focus, which throws the user out of the checkout flow.
 */
export const fontSize = {
  xs: 'clamp(0.75rem, 0.73rem + 0.1vw, 0.8125rem)',
  sm: 'clamp(0.875rem, 0.85rem + 0.12vw, 0.9375rem)',
  base: 'clamp(1rem, 0.97rem + 0.15vw, 1.0625rem)',
  lg: 'clamp(1.125rem, 1.08rem + 0.22vw, 1.25rem)',
  xl: 'clamp(1.25rem, 1.18rem + 0.35vw, 1.5rem)',
  '2xl': 'clamp(1.5rem, 1.38rem + 0.6vw, 1.875rem)',
  '3xl': 'clamp(1.875rem, 1.65rem + 1.1vw, 2.5rem)',
  '4xl': 'clamp(2.25rem, 1.9rem + 1.75vw, 3.25rem)',
  '5xl': 'clamp(2.75rem, 2.15rem + 3vw, 4.5rem)',
} as const

export const lineHeight = {
  tight: '1.15',
  snug: '1.3',
  normal: '1.55',
  relaxed: '1.7',
} as const

export const radius = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const

/** Tinted with the ink hue rather than neutral black — black shadows look muddy. */
export const shadow = {
  sm: '0 1px 2px 0 rgb(19 15 27 / 0.05)',
  md: '0 2px 8px -2px rgb(19 15 27 / 0.08), 0 1px 3px -1px rgb(19 15 27 / 0.06)',
  lg: '0 8px 24px -6px rgb(19 15 27 / 0.10), 0 2px 6px -2px rgb(19 15 27 / 0.06)',
  xl: '0 16px 48px -12px rgb(19 15 27 / 0.14)',
} as const

/**
 * Motion. Slow, restrained, expensive.
 * Exit is deliberately faster than enter (~65%) so dismissal feels responsive.
 * Everything here is disabled under prefers-reduced-motion, and NOTHING animates
 * in cart or checkout — motion there reads as instability, and instability reads
 * as scam.
 */
export const motion = {
  duration: {
    instant: '80ms',
    fast: '160ms',
    base: '240ms',
    slow: '360ms',
    /** Ambient gradient drift only. */
    ambient: '6000ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
    exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const

/** Single source for stacking order. Prevents the z-index arms race. */
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20,
  drawer: 40,
  overlay: 50,
  modal: 60,
  toast: 80,
  ageGate: 100,
} as const

export const breakpoint = {
  sm: '375px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

/** Touch targets. 44px is the floor, per Apple HIG and WCAG 2.5.8. */
export const touchTarget = { min: '44px', comfortable: '48px' } as const
