import { describe, expect, it } from 'vitest'
import {
  ADMIN_AREAS,
  ADMIN_AREA_SLUGS,
  areaForPath,
  canAccessAdminPath,
  firstAllowedAdminPath,
} from '@/lib/admin/areas'

describe('area resolution', () => {
  it('maps bare /admin to the dashboard', () => {
    expect(areaForPath('/admin')).toBe('dashboard')
  })

  it('resolves each area from its own prefix', () => {
    expect(areaForPath('/admin/orders')).toBe('orders')
    expect(areaForPath('/admin/orders/abc123')).toBe('orders')
    expect(areaForPath('/admin/state-rules')).toBe('compliance')
    expect(areaForPath('/admin/reports')).toBe('compliance')
    expect(areaForPath('/admin/products/new')).toBe('catalog')
    expect(areaForPath('/admin/messages')).toBe('messages')
    expect(areaForPath('/admin/audit')).toBe('audit')
    expect(areaForPath('/admin/media')).toBe('content')
  })

  /*
    A nested route must resolve to its parent's area, not fall through to the
    dashboard default. `areaForPath` returns 'dashboard' for anything it cannot
    place — which is a SAFE default for display and a dangerous one for a route
    that should have been gated, so the nesting is asserted rather than assumed.
  */
  it('places nested order routes in the orders area', () => {
    expect(areaForPath('/admin/orders/SG-1001/invoice')).toBe('orders')
  })

  it('gives the longest matching prefix, not the first', () => {
    // /admin/settings must not swallow a longer, more specific prefix.
    expect(areaForPath('/admin/settings')).toBe('settings')
  })

  it('has unique slugs and no overlapping prefixes across areas', () => {
    expect(new Set(ADMIN_AREA_SLUGS).size).toBe(ADMIN_AREA_SLUGS.length)
    const all = ADMIN_AREAS.flatMap((a) => a.prefixes)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('SUPERADMIN', () => {
  it('reaches everything including team management', () => {
    for (const path of ['/admin', '/admin/orders', '/admin/state-rules', '/admin/team']) {
      expect(canAccessAdminPath('SUPERADMIN', [], path), path).toBe(true)
    }
  })
})

describe('ADMIN', () => {
  it('reaches everything except team management', () => {
    expect(canAccessAdminPath('ADMIN', [], '/admin/state-rules')).toBe(true)
    expect(canAccessAdminPath('ADMIN', [], '/admin/team')).toBe(false)
    expect(canAccessAdminPath('ADMIN', [], '/admin/team/abc')).toBe(false)
  })
})

describe('STAFF', () => {
  it('reaches nothing by default — not even the dashboard', () => {
    // Defaulting STAFF to "everything except the dangerous bits" is how someone ends
    // up able to change which states we ship controlled products to.
    for (const path of ['/admin', '/admin/orders', '/admin/state-rules']) {
      expect(canAccessAdminPath('STAFF', [], path), path).toBe(false)
    }
  })

  it('reaches only granted areas', () => {
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin/orders')).toBe(true)
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin/orders/abc')).toBe(true)
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin/state-rules')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin')).toBe(false)
  })

  it('never reaches team management, however many areas are granted', () => {
    expect(canAccessAdminPath('STAFF', [...ADMIN_AREA_SLUGS], '/admin/team')).toBe(false)
  })

  it('treats compliance as one grant covering every compliance surface', () => {
    const areas = ['compliance']
    for (const p of ['/admin/state-rules', '/admin/reports', '/admin/reviews', '/admin/lab-batches', '/admin/locations']) {
      expect(canAccessAdminPath('STAFF', areas, p), p).toBe(true)
    }
    expect(canAccessAdminPath('STAFF', areas, '/admin/orders')).toBe(false)
  })
})

describe('unknown roles', () => {
  it('are refused everywhere', () => {
    for (const role of [undefined, '', 'CUSTOMER', 'OWNER', 'READ_ONLY']) {
      expect(canAccessAdminPath(role, ADMIN_AREA_SLUGS, '/admin'), String(role)).toBe(false)
    }
  })
})

describe('landing path', () => {
  it('sends privileged roles to the dashboard', () => {
    expect(firstAllowedAdminPath('SUPERADMIN', [])).toBe('/admin')
    expect(firstAllowedAdminPath('ADMIN', [])).toBe('/admin')
  })

  it('sends STAFF to their first granted area', () => {
    expect(firstAllowedAdminPath('STAFF', ['dashboard', 'orders'])).toBe('/admin')
    expect(firstAllowedAdminPath('STAFF', ['orders'])).toBe('/admin/orders')
    expect(firstAllowedAdminPath('STAFF', ['compliance'])).toBe('/admin/state-rules')
  })

  it('sends a STAFF user with no grants to the storefront', () => {
    expect(firstAllowedAdminPath('STAFF', [])).toBe('/')
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE THREE ROUTES ADDED WITH THE AUDIT TRAIL, MEDIA UPLOAD AND REFUNDS.
 *
 *  Each one reads or writes something a STAFF user should not reach by default.
 *  `canAccessAdminPath` is what the PROXY enforces, so these assertions are the
 *  access control itself rather than a description of it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('STAFF reach the new surfaces only when granted', () => {
  it('cannot read the audit trail without the audit grant', () => {
    // It records privilege grants, credential rotations and burned payment handles.
    // Arriving free with any other area would make every other grant leakier.
    expect(canAccessAdminPath('STAFF', [], '/admin/audit')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin/audit')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['compliance'], '/admin/audit')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['errors'], '/admin/audit')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['audit'], '/admin/audit')).toBe(true)
  })

  it('cannot upload media without the content grant', () => {
    expect(canAccessAdminPath('STAFF', [], '/admin/media')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin/media')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['content'], '/admin/media')).toBe(true)
  })

  /*
    The invoice carries the customer's full delivery address and every price on the
    order. It is nested under an order, so it must be gated by the ORDERS grant and
    not merely by being signed in.
  */
  it('cannot open an invoice without the orders grant', () => {
    expect(canAccessAdminPath('STAFF', [], '/admin/orders/SG-1001/invoice')).toBe(false)
    expect(canAccessAdminPath('STAFF', ['content'], '/admin/orders/SG-1001/invoice')).toBe(
      false,
    )
    expect(canAccessAdminPath('STAFF', ['orders'], '/admin/orders/SG-1001/invoice')).toBe(
      true,
    )
  })
})

/*
  A coupon is a price change, so it sits behind the CATALOGUE grant. Filed under
  marketing, somebody trusted only with the newsletter could mint a 100%-off code.
*/
describe('coupons need the catalogue grant', () => {
  it('refuses a marketing-only operator', () => {
    expect(canAccessAdminPath('STAFF', ['marketing'], '/admin/coupons')).toBe(false)
  })

  it('admits an operator who can already reprice products', () => {
    expect(canAccessAdminPath('STAFF', ['catalog'], '/admin/coupons')).toBe(true)
    expect(areaForPath('/admin/coupons')).toBe('catalog')
  })
})
