'use client'

import { useActionState, useState } from 'react'
import {
  resetProduct,
  saveProduct,
  type ProductEditState,
} from '@/app/actions/admin-products'
import { Button } from '@/components/ui/button'
import { Select as SiteSelect } from '@/components/ui/select'
import { SIZE_STEPS, sizeOptions, sizeStep } from '@/lib/catalog/sizing'

const INITIAL: ProductEditState = {}

/** What the authored catalogue says, so every field can show its inherited value. */
export interface AuthoredProduct {
  readonly slug: string
  readonly name: string
  readonly shortDescription: string
  readonly description: string
  readonly specs: ReadonlyArray<readonly [string, string]>
  readonly productLine: string
  readonly fulfillmentChannel: string
  readonly notForHumanConsumption: boolean
  readonly ageRestricted: boolean
  readonly pactRegulated: boolean
  readonly directoryStates: readonly string[]
  readonly isActive: boolean
  readonly isFeatured: boolean
  readonly sizing?: {
    /** 0 until a pound price is set. */
    readonly poundPriceCents: number
    readonly defaultKey: string
  }
  readonly variants: ReadonlyArray<{
    readonly sku: string
    readonly name: string
    readonly priceCents: number
  }>
}

/** The current override row, if any. Every field may be null, meaning inherit. */
export interface OverrideValues {
  readonly name: string | null
  readonly shortDescription: string | null
  readonly description: string | null
  readonly specs: ReadonlyArray<readonly [string, string]> | null
  readonly poundPriceCents: number | null
  readonly defaultSizeKey: string | null
  readonly variantPrices: Record<string, number> | null
  readonly notForHumanConsumption: boolean | null
  readonly ageRestricted: boolean | null
  readonly pactRegulated: boolean | null
  readonly fulfillmentChannel: string | null
  readonly directoryStates: readonly string[] | null
  readonly isActive: boolean | null
  readonly isFeatured: boolean | null
  readonly updatedBy: string | null
  readonly updatedAt: string | null
}

const FIELD =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm'
const AREA =
  'mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-[16px] leading-relaxed text-foreground placeholder:text-foreground-subtle md:text-sm'

function money(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** "Price per pound" → "price-per-pound", so a section can be linked to. */
const anchorFor = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    // `scroll-mt-28` clears the phone's admin bar and the jump chips above it.
    <section id={anchorFor(title)} className="scroll-mt-28 rounded-lg border border-border bg-surface p-3.5 md:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-foreground-muted">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

/**
 * Jump chips, on a phone only.
 *
 * This form is one long column on a small screen — around 3,000px for a built-in
 * product — and the part you came to change is usually near the bottom. The chips
 * ride under the admin bar and take a thumb to any section in one tap. On a computer
 * the whole form is visible enough to need none of it.
 */
function SectionNav({ titles }: { titles: readonly string[] }) {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {titles.map((title) => (
        <a
          key={title}
          href={`#${anchorFor(title)}`}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-border-strong bg-surface px-3 text-xs font-medium text-foreground-muted"
        >
          {title}
        </a>
      ))}
    </nav>
  )
}

/**
 * Three states, not two.
 *
 * A checkbox can only say yes or no, and this overlay needs a third answer —
 * "inherit whatever the authored catalogue says". Without it, opening the form and
 * saving would silently freeze every flag at its current value, so a later change to
 * the authored data would stop reaching the site.
 */
function TriState({
  name,
  label,
  hint,
  value,
  inherited,
}: {
  name: string
  label: string
  hint?: string
  value: boolean | null
  inherited: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {hint ? <p className="text-xs text-foreground-muted">{hint}</p> : null}
      <SiteSelect
        id={name}
        name={name}
        defaultValue={value === null ? 'inherit' : value ? 'yes' : 'no'}
        placeholder="Inherit"
        options={[
          { value: 'inherit', label: `Inherit (${inherited ? 'yes' : 'no'})` },
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />
    </div>
  )
}

export function ProductEditor({
  authored,
  override,
}: {
  authored: AuthoredProduct
  override: OverrideValues | null
}) {
  const [state, formAction, pending] = useActionState(saveProduct, INITIAL)
  const [resetState, resetAction, resetting] = useActionState(resetProduct, INITIAL)

  // The pound price as typed, so the four sizes can be shown as the owner types it.
  const [poundInput, setPoundInput] = useState(override?.poundPriceCents ? money(override.poundPriceCents) : '')
  const typedCents = Math.round(Number(poundInput.replace(/[$,\s]/g, '')) * 100)
  const livePound =
    Number.isFinite(typedCents) && typedCents > 0 ? typedCents : (authored.sizing?.poundPriceCents ?? 0)

  return (
    <div className="space-y-6">
      {/* Result banner, at the top where a save is looked for. */}
      {(state.error ?? state.ok ?? resetState.error ?? resetState.ok) ? (
        <p
          role="status"
          className={`rounded-md border p-3 text-sm ${
            state.error ?? resetState.error
              ? 'border-danger-fg/40 text-danger-fg'
              : 'border-success-fg/40 text-success-fg'
          }`}
        >
          {state.error ?? state.ok ?? resetState.error ?? resetState.ok}
        </p>
      ) : null}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="slug" value={authored.slug} />
        <SectionNav titles={['Visibility', 'Copy', 'Pricing', 'Compliance']} />

        <Section
          title="Visibility"
          hint="Deactivating hides the product from the shop and its own page returns a 404. The URL is never reused."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TriState
              name="isActive"
              label="Active"
              value={override?.isActive ?? null}
              inherited={authored.isActive}
            />
            <TriState
              name="isFeatured"
              label="Featured"
              hint="Sorts to the front of the shop and the homepage rail."
              value={override?.isFeatured ?? null}
              inherited={authored.isFeatured}
            />
          </div>
        </Section>

        <Section
          title="Copy"
          hint="Leave a field empty to keep the authored wording. Everything here is scanned against the compliance lexicon before it saves — no health claims, and no extraction or consumption language on MHRB."
        >
          <div>
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Product name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={override?.name ?? ''}
              placeholder={authored.name}
              className={FIELD}
              maxLength={120}
            />
          </div>

          <div>
            <label htmlFor="shortDescription" className="text-sm font-medium text-foreground">
              Short description
            </label>
            <p className="text-xs text-foreground-muted">
              One or two lines. Used on cards and in the meta description.
            </p>
            <textarea
              id="shortDescription"
              name="shortDescription"
              rows={2}
              defaultValue={override?.shortDescription ?? ''}
              placeholder={authored.shortDescription}
              className={AREA}
              maxLength={400}
            />
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Full description
            </label>
            <textarea
              id="description"
              name="description"
              rows={6}
              defaultValue={override?.description ?? ''}
              placeholder={authored.description}
              className={AREA}
              maxLength={4000}
            />
          </div>

          <div>
            <label htmlFor="specs" className="text-sm font-medium text-foreground">
              Specification table
            </label>
            <p className="text-xs text-foreground-muted">
              One row per line, as <code>Label | Value</code>. Empty keeps the authored table.
            </p>
            <textarea
              id="specs"
              name="specs"
              rows={5}
              defaultValue={(override?.specs ?? [])
                .map(([label, value]) => `${label} | ${value}`)
                .join('\n')}
              placeholder={authored.specs
                .map(([label, value]) => `${label} | ${value}`)
                .join('\n')}
              className={`${AREA} font-mono md:text-xs`}
            />
          </div>
        </Section>

        <Section
          title="Pricing"
          hint={
            authored.sizing
              ? 'Sold by the pound in 1/4, 1/3, 1/2 and 1 lb. Set the price of a full pound and every size is worked out from it.'
              : 'A disposable is sold by count: set the price of one unit, and the customer picks how many.'
          }
        >
          {authored.sizing ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="poundPriceCents" className="text-sm font-medium text-foreground">
                    Price per pound
                  </label>
                  <input
                    id="poundPriceCents"
                    name="poundPriceCents"
                    inputMode="decimal"
                    value={poundInput}
                    onChange={(event) => setPoundInput(event.target.value)}
                    placeholder={authored.sizing.poundPriceCents ? money(authored.sizing.poundPriceCents) : 'Not set'}
                    className={FIELD}
                  />
                  <p className="mt-1 text-xs text-foreground-subtle">In dollars, e.g. 140 or 140.50.</p>
                </div>

                <div>
                  <label htmlFor="defaultSizeKey" className="text-sm font-medium text-foreground">
                    Size the page opens on
                  </label>
                  <SiteSelect
                    id="defaultSizeKey"
                    name="defaultSizeKey"
                    defaultValue={override?.defaultSizeKey ?? ''}
                    placeholder={`Inherit (${sizeStep(authored.sizing.defaultKey)?.label ?? '1/4 lb'})`}
                    options={[
                      { value: '', label: `Inherit (${sizeStep(authored.sizing.defaultKey)?.label ?? '1/4 lb'})` },
                      ...SIZE_STEPS.map((step) => ({ value: step.key, label: step.label })),
                    ]}
                  />
                </div>
              </div>

              {livePound > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Size prices">
                  {sizeOptions({ poundPriceCents: livePound, defaultKey: authored.sizing.defaultKey }).map((option) => (
                    <li key={option.key} className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm">
                      <span className="block text-xs text-foreground-muted">{option.label}</span>
                      <span className="tabular font-semibold text-foreground">{money(option.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
                  No price per pound yet, so this product is hidden from the shop. Set one to show it.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {authored.variants.map((v) => (
                <div key={v.sku}>
                  <label
                    htmlFor={`variant:${v.sku}`}
                    className="text-sm font-medium text-foreground"
                  >
                    Price per unit
                  </label>
                  <input
                    id={`variant:${v.sku}`}
                    name={`variant:${v.sku}`}
                    inputMode="decimal"
                    defaultValue={
                      override?.variantPrices?.[v.sku]
                        ? money(override.variantPrices[v.sku]!)
                        : ''
                    }
                    placeholder={money(v.priceCents)}
                    className={FIELD}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Compliance"
          hint="These drive cart and checkout behaviour, not just labelling. Changing them changes what the customer must attest to and how the order is fulfilled."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TriState
              name="notForHumanConsumption"
              label="Not for human consumption"
              hint="Non-dismissible banner above Add to Cart, plus an attestation at checkout."
              value={override?.notForHumanConsumption ?? null}
              inherited={authored.notForHumanConsumption}
            />
            <TriState
              name="ageRestricted"
              label="Age restricted"
              value={override?.ageRestricted ?? null}
              inherited={authored.ageRestricted}
            />
            <TriState
              name="pactRegulated"
              label="PACT Act regulated"
              hint="Splits the cart, forces adult signature, and enters the monthly state filing."
              value={override?.pactRegulated ?? null}
              inherited={authored.pactRegulated}
            />
            <div>
              <label
                htmlFor="fulfillmentChannel"
                className="text-sm font-medium text-foreground"
              >
                Fulfilment channel
              </label>
              <SiteSelect
                id="fulfillmentChannel"
                name="fulfillmentChannel"
                defaultValue={override?.fulfillmentChannel ?? 'inherit'}
                placeholder="Inherit"
                options={[
                  { value: 'inherit', label: `Inherit (${authored.fulfillmentChannel})` },
                  { value: 'PARCEL', label: 'PARCEL' },
                  { value: 'PACT_CARRIER', label: 'PACT_CARRIER' },
                  { value: 'LOCAL_COURIER', label: 'LOCAL_COURIER' },
                ]}
              />
            </div>
          </div>

          <div>
            <label htmlFor="directoryStates" className="text-sm font-medium text-foreground">
              State product directory
            </label>
            <p className="text-xs text-foreground-muted">
              Two-letter codes, comma separated. Required before a vape can be sold into
              FL, NC, TN, VA or WI.
            </p>
            <input
              id="directoryStates"
              name="directoryStates"
              defaultValue={(override?.directoryStates ?? []).join(', ')}
              placeholder={authored.directoryStates.join(', ') || 'none'}
              className={FIELD}
            />
          </div>
        </Section>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <Button type="submit" variant="accent" loading={pending} className="w-full sm:w-auto">
            Save and publish
          </Button>
          <p className="mt-2 text-xs text-foreground-subtle">
            Publishes immediately. The product page, the shop and the homepage all update.
          </p>
        </div>
      </form>

      {/* Separate form: a reset must never be a submit button inside the save form. */}
      <form action={resetAction} className="rounded-lg border border-border p-4">
        <input type="hidden" name="slug" value={authored.slug} />
        <h2 className="text-sm font-medium text-foreground">Discard all edits</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Removes every override for this product and restores the authored version.
          {override?.updatedBy ? ` Last edited by ${override.updatedBy}.` : ''}
        </p>
        <Button type="submit" variant="secondary" size="sm" loading={resetting} className="mt-3">
          Reset to authored
        </Button>
      </form>
    </div>
  )
}
