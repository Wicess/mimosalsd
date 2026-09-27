/**
 * Inline SVG icon set.
 *
 * Deliberately hand-rolled rather than pulling an icon library: this project needs
 * about a dozen glyphs, and shipping a whole package for that costs bundle weight we
 * have budgeted elsewhere (LCP < 2.0s). Consistent 1.5 stroke, 24px grid, currentColor.
 *
 * Never use emoji as a structural icon — rendering is font- and platform-dependent
 * and cannot be themed.
 */
import { cn } from '@/lib/utils'

type IconProps = {
  className?: string
  /** Decorative by default. Pass a label only when the icon is the sole meaning. */
  label?: string
}

function Svg({
  children,
  className,
  label,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 13 4 4L19 7" /></Svg>
)

export const CrossIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </Svg>
)

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>
)

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4 6v6c0 4.5 3.2 8.3 8 9 4.8-.7 8-4.5 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)

export const FlaskIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3" />
    <path d="M7.5 14h9" />
  </Svg>
)

export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
)

export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 7h11v10H2zM13 10h4l4 4v3h-8z" />
    <circle cx="6.5" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" />
  </Svg>
)

export const LeafIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20c0-8 6-14 16-14 0 10-6 15-13 15-1.5 0-3-.4-3-1Z" />
    <path d="M8 20c1.5-5 4.5-8.5 9-11" />
  </Svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
)

export const CartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 7H5.6" />
    <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
  </Svg>
)

/*
 * Theme control glyphs. Sun / moon / monitor is the one place a cliché earns its
 * keep — it is the shared vocabulary for this control, and inventing a cleverer
 * metaphor would only make people guess.
 */
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Svg>
)

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Svg>
)

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Svg>
)

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Svg>
)

export const MonitorIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
)

/** A speech bubble — live chat. Same grid and stroke as the rest of the set. */
export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16.5H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
    <path d="M8 10.5h8M8 13h5" />
  </Svg>
)

/** Attach a file. */
export const PaperclipIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1L13 4.4a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7-7" />
  </Svg>
)

/** Send a message. */
export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12 20 4l-6 16-3-7-7-1Z" />
    <path d="m11 13 9-9" />
  </Svg>
)

/*
 * Chat inbox glyphs — the operator's side of live chat. Same grid and stroke.
 */

/** Two ticks: the customer has seen it. Operator-only (see lib/chat/rules). */
export const CheckCheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m2 13 4 4L16 7" />
    <path d="m12 16 1 1L23 7" />
  </Svg>
)

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></Svg>
)

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="18.5" r="1" />
  </Svg>
)

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
    <path d="m14.5 5.5 3 3" />
  </Svg>
)

/** Block — a ring with a bar through it. */
export const BanIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" /></Svg>
)

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.75" />
  </Svg>
)

export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.9 5.7A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.3 7.2A15.6 15.6 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.3-1.1" />
    <path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9M3 3l18 18" />
  </Svg>
)

export const SmileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
  </Svg>
)

/** Multi-select mode. */
export const ListCheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3.5 6.5 1.5 1.5 3-3M3.5 13.5 5 15l3-3" />
    <path d="M11.5 7h9M11.5 14h9M11.5 20h9" />
  </Svg>
)

export const SquareIcon = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /></Svg>
)

export const CheckSquareIcon = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
)

/** The customer's details panel. */
export const IdCardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16a3 3 0 0 1 6 0M14.5 10h4M14.5 13.5h3" />
  </Svg>
)

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
)

/** Busy. Spins under `motion-safe:animate-spin`; static otherwise. */
export const SpinnerIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3a9 9 0 1 0 9 9" /></Svg>
)

/** Pause / play — the hero film's control (WCAG 2.2.2: moving content can be stopped). */
export const PauseIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 5.5v13M15 5.5v13" /></Svg>
)

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></Svg>
)

/** Notifications turned on. */
export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
)

/** Subscribed to email. */
export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
)

/** Installed the site as an app. */
export const AppInstallIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
    <path d="M12 7.5v6m-2.5-2.5L12 13.5l2.5-2.5M10.5 18.5h3" />
  </Svg>
)

/** Placed an order. */
export const PackageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.25l8 4.5" />
  </Svg>
)

/** Apple's Share glyph: a tray with an arrow leaving it. Drawn to match what the iPhone shows. */
export const IosShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v11M8.25 7.25 12 3.5l3.75 3.75" />
    <path d="M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
  </Svg>
)

/** "Add to Home Screen": a plus in a rounded square, as in the iPhone's share sheet. */
export const AddSquareIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="M12 8.5v7M8.5 12h7" />
  </Svg>
)

/** The horizontal "•••" button Safari puts beside its address bar. */
export const MoreHorizontalIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18.5" cy="12" r="1" />
  </Svg>
)

/** Analytics: rising bars. */
export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 16.5v-5M12 16.5V7M17 16.5v-8" />
  </Svg>
)

/** Visitors: people on the site. */
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.75a3 3 0 0 1 0 5.5M17.5 14.25A5.5 5.5 0 0 1 20.5 19" />
  </Svg>
)

/** Categories: a price tag. */
export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l7.7 7.7a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-7.7-7.7a1 1 0 0 1-.3-.7Z" />
    <circle cx="8" cy="8" r="1.25" />
  </Svg>
)

/** Payment handles: a card. */
export const CardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 14.5h3" />
  </Svg>
)

/** Reviews: a star. */
export const StarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.75 2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.55 6.99 19.2l.96-5.6L3.9 9.65l5.6-.8L12 3.75Z" />
  </Svg>
)

/** Announcements: a megaphone. */
export const MegaphoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M8 15l1 4.5" />
  </Svg>
)

/** Guides and blogs: an open book. */
export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.5c-1.6-1.3-4.1-2-7.5-2v13c3.4 0 5.9.7 7.5 2 1.6-1.3 4.1-2 7.5-2v-13c-3.4 0-5.9.7-7.5 2Z" />
    <path d="M12 6.5v13" />
  </Svg>
)

/** Tracking links: two chain links. */
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Svg>
)

/** Settings: a gear. */
export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Svg>
)

/** View the site: a box with an arrow leaving it. */
export const ExternalLinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4.5" />
  </Svg>
)

/** Sign out: a door with an arrow leaving it. */
export const SignOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5h3.5" />
    <path d="M15.5 16.5 20 12l-4.5-4.5M20 12H9.5" />
  </Svg>
)

/** Take a photo: a camera body with a lens. */
export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.5h2.8l1.3-2h7.8l1.3 2H20a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
    <circle cx="12" cy="13.5" r="3.25" />
  </Svg>
)
