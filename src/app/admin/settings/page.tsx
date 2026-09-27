import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { BRAND } from '@/lib/brand'
import { CrudPanel, Field, TextArea } from '@/components/admin/forms'
import { saveSetting } from '@/app/actions/admin-crud'
import { saveCompanyEmail, savePostalAddress } from '@/app/actions/admin-settings'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { getPostalAddress } from '@/lib/site/postal-address.server'
import { changeAdminEmail, changeAdminPassword } from '@/app/actions/admin-account'
import { getAdminIdentity, BOOTSTRAP_USER_ID } from '@/lib/admin/auth'

/**
 * The operator's own credential.
 *
 * First on the page because it is the only thing here that is a security control
 * rather than configuration, and because the account most likely to still be on a
 * generated bootstrap password is the one reading this.
 */
async function SignIn() {
  const identity = await getAdminIdentity()
  if (!identity) return null
  const isBootstrap = identity.userId === BOOTSTRAP_USER_ID

  return (
    <section className="mb-8 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-foreground">Sign-in</h2>

      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-foreground-muted md:w-36">Signed in as</dt>
          <dd className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{identity.email}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-foreground-muted md:w-36">Role</dt>
          <dd className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{identity.role}</dd>
        </div>
      </dl>

      {isBootstrap ? (
        <p className="mt-4 rounded-md border border-warning-fg/30 bg-warning-bg p-3 text-sm leading-relaxed text-warning-fg">
          You are signed in with the bootstrap credential from{' '}
          <code className="rounded bg-surface-sunken px-1">ADMIN_PASSWORD_HASH</code>.
          It lives in the environment, so it cannot be changed from here — and it grants
          SUPERADMIN. Create a real account under Team, sign in as that, then remove the
          variable.
        </p>
      ) : (
        <>
          <div className="mt-5">
            <CrudPanel summary="Change password" action={changeAdminPassword}>
              <Field
                label="Current password"
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
              <Field
                label="New password"
                name="next"
                type="password"
                required
                autoComplete="new-password"
                hint="At least 12 characters. Stored as a scrypt hash — never in plain text."
              />
              <Field
                label="Repeat new password"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
              />
            </CrudPanel>
          </div>

          <div className="mt-3">
            <CrudPanel summary="Change sign-in email" action={changeAdminEmail}>
              <Field
                label="New sign-in email"
                name="email"
                type="email"
                required
                autoComplete="username"
                hint="A username, not a mailbox — nothing is ever sent to it."
              />
              <Field
                label="Current password"
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
            </CrudPanel>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
            Changing your password does not sign other devices out — the session cookie
            carries no password material. To end every outstanding session at once,
            rotate <code className="rounded bg-surface-sunken px-1">ADMIN_SESSION_SECRET</code>.
          </p>
        </>
      )}
    </section>
  )
}

/**
 * The company's one email address. Shown on every contact link, in the footer of
 * every email, in the policies, the FAQ and the structured data, and it is where the
 * contact and bulk forms deliver. Set here, used everywhere.
 */
async function CompanyEmail() {
  const email = await getCompanyEmail()
  return (
    <section className="mb-8 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-foreground">Company email</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        The one address the whole site uses: contact and bulk pages, the footer of every
        email, policies, FAQ and search results. Contact and bulk enquiries are delivered
        here too. Change it once and it changes everywhere.
      </p>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="text-foreground-muted">In use now</span>
        <a href={`mailto:${email}`} className="inline-block py-1 font-medium text-foreground underline underline-offset-4">
          {email}
        </a>
      </p>
      <div className="mt-4">
        <CrudPanel summary="Change company email" action={saveCompanyEmail}>
          <Field
            label="Company email"
            name="email"
            type="email"
            required
            defaultValue={email}
            autoComplete="off"
            hint="It must be a mailbox someone reads: customer mail and form enquiries are delivered to it."
          />
        </CrudPanel>
      </div>
    </section>
  )
}

/**
 * The postal address in the footer of every marketing email. CAN-SPAM requires one,
 * so blasts refuse to send until it is set — which used to take a code change.
 */
async function PostalAddress() {
  const address = await getPostalAddress()
  return (
    <section className="mb-8 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-foreground">Postal address</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        US law (CAN-SPAM) requires a real postal address in every marketing email, so email
        blasts cannot be sent until one is saved here. A street address, a USPS PO Box or a
        registered private mailbox all qualify. It appears only in email footers, not on the
        site.
      </p>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="text-foreground-muted">In use now</span>
        {address ? (
          <span className="font-medium text-foreground">{address}</span>
        ) : (
          <span className="font-medium text-warning-fg">Not set — email blasts are blocked</span>
        )}
      </p>
      <div className="mt-4">
        <CrudPanel summary={address ? 'Change postal address' : 'Add postal address'} action={savePostalAddress}>
          <TextArea
            label="Postal address"
            name="address"
            required
            rows={3}
            defaultValue={address}
            hint="Include the ZIP code. Several lines are fine; they are joined into one line in the email."
          />
        </CrudPanel>
      </div>
    </section>
  )
}

async function Settings() {
  const rows = await db.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] })

  return (
    <>
      <SignIn />

      <CompanyEmail />

      <PostalAddress />

      <section className="mb-8 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-lg text-foreground">Brand</h2>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {[
            ['Name', BRAND.name],
            ['Legal name', BRAND.legalName],
            ['Domain', BRAND.domain],
            ['Minimum age', String(BRAND.minimumAge)],
            ['Free shipping', `$${BRAND.freeShippingThresholdCents / 100} (parcel only)`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-28 shrink-0 text-foreground-muted md:w-36">{k}</dt>
              <dd className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-foreground-muted">
          These live in <code className="rounded bg-surface-sunken px-1">src/lib/brand.ts</code>,
          so naming the company is a one-line change rather than a find-and-replace.
        </p>
      </section>

      <CrudPanel summary="+ Add or update a setting" action={saveSetting}>
        <Field label="Key" name="key" required placeholder="shipping.cutoff_time" />
        <Field label="Label" name="label" required placeholder="Same-day cut-off time" />
        <TextArea
          label="Value"
          name="value"
          hint="Shown to customers where used, so it goes through the compliance lexicon."
          rows={3}
        />
        <Field label="Group" name="group" placeholder="general" />
      </CrudPanel>

      {rows.length === 0 ? (
        <EmptyState
          title="No editable settings yet"
          hint="Operational copy and thresholds land here, editable without a deploy — the same principle as the state rules."
        />
      ) : (
        <DataTable headers={['Setting', 'Value', 'Group', 'Updated']}>
          {rows.map((s) => (
            <Row key={s.key}>
              <Cell>
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="tabular mt-0.5 block text-xs text-foreground-subtle">{s.key}</span>
              </Cell>
              <Cell className="max-w-sm text-foreground-muted">{s.value}</Cell>
              <Cell className="text-xs text-foreground-muted">{s.group}</Cell>
              <Cell className="tabular text-xs text-foreground-muted">
                {s.updatedAt.toISOString().slice(0, 10)}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </>
  )
}

export default function AdminSettingsPage() {
  return (
    <AdminPage title="Settings" description="Operational configuration.">
      <Settings />
    </AdminPage>
  )
}
