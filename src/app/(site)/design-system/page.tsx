import type { Metadata } from 'next'
import { PageSection } from '@/components/layout/page-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CoaBadge } from '@/components/compliance/coa-badge'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { NotForConsumptionBanner } from '@/components/compliance/not-for-consumption-banner'
import { StateAvailability } from '@/components/compliance/state-availability'
import {
  AlertIcon, CartIcon, CheckIcon, ChevronRightIcon, CrossIcon, FlaskIcon,
  InfoIcon, LeafIcon, MapPinIcon, ShieldIcon, TruckIcon,
} from '@/components/ui/icon'
import { citron, clinical, stone, moss, fontSize, radius, spacing } from '@/lib/design/tokens'

export const metadata: Metadata = {
  title: 'Design System',
  // Internal reference surface. It has no search intent and would dilute crawl budget.
  robots: { index: false, follow: false },
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm text-foreground-muted">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Ramp({ name, ramp }: { name: string; ramp: Record<string, string> }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{name}</p>
      <div className="flex flex-wrap gap-1">
        {Object.entries(ramp).map(([step, hex]) => (
          <div key={step} className="w-16">
            <div
              className="h-12 rounded-md border border-border"
              style={{ background: hex }}
            />
            <p className="mt-1 text-xs text-foreground-muted tabular">{step}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const SEMANTIC_SWATCHES = [
  ['background', 'var(--background)'],
  ['surface', 'var(--surface)'],
  ['surface-sunken', 'var(--surface-sunken)'],
  ['surface-data', 'var(--surface-data)'],
  ['primary', 'var(--primary)'],
  ['accent', 'var(--accent)'],
  ['success-bg', 'var(--success-bg)'],
  ['warning-bg', 'var(--warning-bg)'],
  ['danger-bg', 'var(--danger-bg)'],
  ['info-bg', 'var(--info-bg)'],
] as const

export default function DesignSystemPage() {
  return (
    <main>
      {/* Internal reference. One band so it inherits the same container as every public page. */}
      <PageSection first>
      <header>
        <p className="text-sm font-medium tracking-[0.2em] text-foreground-subtle uppercase">
          Step 6
        </p>
        <h1 className="mt-2 font-display text-4xl text-foreground">Design System</h1>
        <p className="mt-3 max-w-2xl text-lg text-foreground-muted">
          Apothecary meets modern science. Deep considered colour, editorial type, and
          clinical clarity exactly where trust is decided. Every foreground/background
          pair on this page is verified against WCAG 2.2 AA in{' '}
          <code className="rounded-sm bg-surface-sunken px-1 text-sm">
            tests/design/contrast.test.ts
          </code>
          , in both themes.
        </p>
        <p className="mt-3 text-sm text-foreground-subtle">
          Toggle your OS appearance to check dark mode — the palette is defined
          independently per theme, not inverted.
        </p>
      </header>

      <Section
        title="Primitives"
        note="Raw values. A component must never reference these directly — it reads the semantic layer."
      >
        <div className="grid gap-6">
          <Ramp name="Ink — warm aubergine-indigo, the base of the system" ramp={stone} />
          <Ramp name="Iris — deep blue-violet, primary accent" ramp={moss} />
          <Ramp name="Amber — CTA only. Scarcity is what makes it work." ramp={citron} />
          <Ramp name="Clinical — cool grey for data surfaces (COA panels, specs)" ramp={clinical} />
        </div>
      </Section>

      <Section title="Semantic layer" note="What a colour means. This is what components consume.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SEMANTIC_SWATCHES.map(([name, value]) => (
            <div key={name}>
              <div
                className="h-16 rounded-md border border-border-strong"
                style={{ background: value }}
              />
              <p className="mt-1 text-xs text-foreground-muted">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Typography"
        note="Newsreader for display and long-form — it is drawn for reading, and the legality pages and guides are where most organic traffic lands. Inter for UI. Both self-hosted."
      >
        <div className="space-y-4">
          <p className="font-display text-5xl text-foreground">Lab-tested.</p>
          <p className="font-display text-4xl text-foreground">State-verified.</p>
          <p className="font-display text-3xl text-foreground">Discreetly delivered.</p>
          <p className="font-display text-2xl text-foreground">Heading level two</p>
          <p className="max-w-2xl text-base text-foreground">
            Body copy at the base scale. Mimosa Hostilis root bark is prized by natural
            dyers for the deep purple it produces on protein fibres and for its high
            tannin content. Sixteen pixels is the floor on mobile — below it, iOS
            auto-zooms on input focus and throws the user out of the flow.
          </p>
          <p className="max-w-2xl text-sm text-foreground-muted">
            Muted small text, for secondary information and metadata.
          </p>
          <p className="tabular text-sm text-foreground">
            Tabular figures: 1,240.00 · 0.05 ppm · $45.00 — used in COA panels and price
            columns so numbers do not jitter between rows.
          </p>
        </div>
      </Section>

      <Section title="Buttons" note="One accent CTA per screen. Every size clears the 44px touch floor.">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="accent">Add to cart</Button>
          <Button variant="primary">Check my state</Button>
          <Button variant="secondary">View lab results</Button>
          <Button variant="ghost">Continue shopping</Button>
          <Button variant="danger">Remove</Button>
          <Button variant="primary" loading>Verifying</Button>
          <Button variant="primary" disabled>Unavailable</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="md" variant="secondary">Medium</Button>
          <Button size="lg" variant="secondary">Large</Button>
        </div>
      </Section>

      <Section title="Badges" note="Status is never colour alone — every meaningful tone carries an icon.">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success" icon={<CheckIcon className="size-3.5" />}>Ships to your state</Badge>
          <Badge tone="warning" icon={<AlertIcon className="size-3.5" />}>Conditions apply</Badge>
          <Badge tone="neutral" icon={<CrossIcon className="size-3.5" />}>Not available in LA</Badge>
          <Badge tone="info" icon={<InfoIcon className="size-3.5" />}>Pending legislation</Badge>
          <Badge tone="accent">Bulk discount available</Badge>
          <Badge tone="neutral">Free shipping over $100</Badge>
        </div>
      </Section>

      <Section
        title="Compliance kit"
        note="Unique to this project, and where every competitor looks amateur. These must look designed, not like browser alerts — in this category a page that looks careful IS the trust signal."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <StateAvailability stateCode="TX" productLine="AMANITA" />
          <StateAvailability stateCode="LA" productLine="AMANITA" />
          <StateAvailability stateCode="FL" productLine="AMANITA" />
          <StateAvailability stateCode="CA" productLine="VAPE" />
          <StateAvailability stateCode="FL" productLine="VAPE" onStateProductDirectory />
          <StateAvailability stateCode="TX" productLine="MIMOSA_HOSTILIS" />
        </div>
        <div className="mt-4 grid gap-4">
          <NotForConsumptionBanner />
          <div className="flex flex-wrap gap-3">
            <CoaBadge batchCode="EXAMPLE-0001" labName="ACS Laboratory" isoAccredited />
            <CoaBadge batchCode="EXAMPLE-0002" labName="ACS Laboratory" isoAccredited />
          </div>
          <FdaDisclaimer />
        </div>
      </Section>

      <Section title="Icons" note="Inline SVG on a 24px grid, 1.5 stroke, currentColor. Never emoji — rendering is font-dependent and cannot be themed.">
        <div className="flex flex-wrap gap-5 text-foreground">
          {[CheckIcon, CrossIcon, AlertIcon, InfoIcon, ShieldIcon, FlaskIcon,
            MapPinIcon, TruckIcon, LeafIcon, CartIcon, ChevronRightIcon].map((Icon, i) => (
            <Icon key={i} className="size-6" />
          ))}
        </div>
      </Section>

      <Section title="Scales" note="4px spacing rhythm, fluid type, and a strict z-index ladder.">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Spacing</p>
            {Object.entries(spacing).slice(1, 9).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 py-0.5">
                <span className="w-6 text-xs text-foreground-muted tabular">{k}</span>
                <div className="h-3 bg-primary" style={{ width: v }} />
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Radius</p>
            {Object.entries(radius).slice(1, 6).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 py-1">
                <span className="w-8 text-xs text-foreground-muted">{k}</span>
                <div
                  className="size-8 border border-border-strong bg-surface-sunken"
                  style={{ borderRadius: v }}
                />
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Type scale</p>
            {Object.keys(fontSize).map((k) => (
              <p key={k} className="text-xs text-foreground-muted">{k}</p>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Motion" note="Slow, restrained, expensive. Exit is ~65% of enter so dismissal feels responsive. Everything is disabled under prefers-reduced-motion — and nothing animates in cart or checkout, because motion there reads as instability, and instability reads as scam.">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-border bg-surface p-4 transition-shadow duration-[240ms] ease-[var(--ease-standard)] hover:shadow-lg motion-reduce:transition-none">
            Hover: elevation
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 transition-colors duration-[160ms] hover:bg-surface-sunken motion-reduce:transition-none">
            Hover: surface
          </div>
        </div>
      </Section>
      </PageSection>
    </main>
  )
}
