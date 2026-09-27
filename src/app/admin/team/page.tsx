import { db } from '@/lib/db/client'
import { ADMIN_AREAS } from '@/lib/admin/areas'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { AlertIcon } from '@/components/ui/icon'
import { Checkbox, CrudPanel, Field, InlineAction, Select } from '@/components/admin/forms'
import { saveTeamMember, toggleTeamMember } from '@/app/actions/admin-crud'

async function Team() {
  const users = await db.adminUser.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <>
      <div className="mb-6 rounded-lg bg-info-bg p-4 text-info-fg">
        <div className="flex gap-3">
          <AlertIcon className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm leading-relaxed">
            <p>
              STAFF users reach <strong>nothing</strong> until an area is granted —
              including the dashboard. Defaulting to &ldquo;everything except the
              dangerous bits&rdquo; is how someone ends up able to change which states we
              ship controlled products to.
            </p>
            <p className="mt-2">
              Compliance is a single grant covering state rules, lab batches, review
              moderation, PACT filings and locations. It is the highest-consequence area
              in the panel.
            </p>
          </div>
        </div>
      </div>

      <CrudPanel summary="+ Add or update a team member" action={saveTeamMember}>
        <Field label="Email" name="email" type="email" required />
        <Field label="Name" name="name" required />
        <Select
          label="Role"
          name="role"
          defaultValue="STAFF"
          options={[
            ['STAFF', 'Staff — only the areas ticked below'],
            ['ADMIN', 'Admin — everything except team management'],
            ['SUPERADMIN', 'Superadmin — everything'],
          ]}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          hint="At least 12 characters. Required for a new user; leave blank to keep the existing one."
        />
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            Areas (staff only)
          </legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {ADMIN_AREAS.map((a) => (
              <Checkbox key={a.slug} label={a.label} name="areas" value={a.slug} />
            ))}
          </div>
        </fieldset>
      </CrudPanel>

      {users.length === 0 ? (
        <EmptyState
          title="No admin users yet"
          hint="You are signed in with the bootstrap environment credential. Create a real user, then retire ADMIN_PASSWORD_HASH."
        />
      ) : (
        <DataTable headers={['User', 'Role', 'Granted areas', 'Last login', 'Status', '']}>
          {users.map((u) => (
            <Row key={u.id}>
              <Cell>
                <span className="font-medium text-foreground">{u.name}</span>
                <span className="mt-0.5 block text-xs text-foreground-muted">{u.email}</span>
              </Cell>
              <Cell>
                <Badge tone={u.role === 'SUPERADMIN' ? 'danger' : u.role === 'ADMIN' ? 'warning' : 'neutral'}>
                  {u.role.toLowerCase()}
                </Badge>
              </Cell>
              <Cell className="max-w-sm">
                {u.role === 'STAFF' ? (
                  u.adminAreas.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.adminAreas.map((a) => (
                        <Badge key={a} tone="neutral">{a}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-warning-fg">no areas granted</span>
                  )
                ) : (
                  <span className="text-xs text-foreground-muted">all areas</span>
                )}
              </Cell>
              <Cell className="tabular text-xs text-foreground-muted">
                {u.lastLoginAt?.toISOString().slice(0, 10) ?? 'never'}
              </Cell>
              <Cell>
                <Badge tone={u.isActive ? 'success' : 'neutral'}>
                  {u.isActive ? 'active' : 'disabled'}
                </Badge>
              </Cell>
              <Cell>
                {/* Disabling the last active superadmin is refused server-side. */}
                <InlineAction
                  action={toggleTeamMember}
                  label={u.isActive ? 'Disable' : 'Enable'}
                  fields={{ id: u.id }}
                  {...(u.isActive ? { variant: 'danger' as const } : {})}
                />
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg text-foreground">Assignable areas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ADMIN_AREAS.map((a) => (
            <div key={a.slug} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-medium text-foreground">{a.label}</p>
              <p className="mt-1 text-xs text-foreground-muted">{a.description}</p>
              <p className="tabular mt-2 text-[10px] text-foreground-subtle">{a.slug}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export default function AdminTeamPage() {
  return (
    <AdminPage
      title="Team & access"
      description="SUPERADMIN only. Roles and per-area grants."
    >
      <Team />
    </AdminPage>
  )
}
