import { describe, expect, it } from 'vitest'
import { normalisePostalAddress } from '@/lib/site/postal-address'

/**
 * The postal address is a legal statement at the foot of every marketing email
 * (CAN-SPAM), not decoration. So the form refuses anything that could not be a real
 * US address, rather than letting "TBD" go out to the whole list.
 */
describe('normalisePostalAddress', () => {
  it('keeps a street address, a PO Box and a private mailbox', () => {
    expect(normalisePostalAddress('1200 Congress Ave, Austin, TX 78701')).toBe('1200 Congress Ave, Austin, TX 78701')
    expect(normalisePostalAddress('PO Box 4410, Tulsa, OK 74159-0410')).toBe('PO Box 4410, Tulsa, OK 74159-0410')
    expect(normalisePostalAddress('548 Market St PMB 12345, San Francisco, CA 94104')).not.toBeNull()
  })

  it('joins a pasted multi-line address into one line', () => {
    expect(normalisePostalAddress('  1200 Congress Ave,\n  Suite 5\r\nAustin,   TX 78701 \n')).toBe(
      '1200 Congress Ave, Suite 5, Austin, TX 78701',
    )
  })

  it('refuses a placeholder or anything without a ZIP code', () => {
    for (const bad of ['', '   ', 'TBD', 'coming soon', '123', '1200 Congress Ave, Austin, TX', 'Austin 787']) {
      expect(normalisePostalAddress(bad), bad).toBeNull()
    }
  })

  it('refuses what is not text, and what is far too long', () => {
    expect(normalisePostalAddress(null)).toBeNull()
    expect(normalisePostalAddress(78701)).toBeNull()
    expect(normalisePostalAddress(`${'x'.repeat(200)} TX 78701`)).toBeNull()
  })
})
