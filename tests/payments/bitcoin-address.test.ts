import { describe, expect, it } from 'vitest'
import { isValidBitcoinAddress } from '@/lib/payments/bitcoin-address'

/* Valid and invalid vectors from BIP-173 (bech32) and BIP-350 (bech32m), plus well-known addresses. */
describe('isValidBitcoinAddress', () => {
  it.each([
    ['legacy P2PKH (the genesis block address)', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
    ['P2SH', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'],
    ['SegWit v0 P2WPKH, upper case (BIP-173)', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'],
    ['SegWit v0 P2WPKH, lower case', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
    ['SegWit v0 P2WSH (BIP-173)', 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3'],
    ['Taproot bech32m (BIP-350)', 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0'],
  ])('accepts %s', (_label, address) => {
    expect(isValidBitcoinAddress(address)).toBe(true)
  })

  it.each([
    ['one character changed in a legacy address', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb'],
    ['one character changed in a bech32 address (bad checksum)', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5'],
    ['a testnet address', 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'],
    ['Taproot written with the old bech32 checksum (BIP-350 invalid)', 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq5zuyut'],
    ['mixed case', 'bc1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'],
    ['a testnet legacy address', 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'],
    ['an Ethereum address', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'],
    ['empty', ''],
    ['a Cash App tag', '$MIMOSALSD'],
  ])('refuses %s', (_label, address) => {
    expect(isValidBitcoinAddress(address)).toBe(false)
  })

  it('ignores surrounding spaces from a paste', () => {
    expect(isValidBitcoinAddress('  bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 \n')).toBe(true)
  })
})
