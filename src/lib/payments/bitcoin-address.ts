import { createHash } from 'node:crypto'

/**
 * Is this a valid mainnet Bitcoin address? Checks the CHECKSUM, not just the shape.
 *
 * The owner pastes an address into the payment form and it goes to a customer who
 * sends real money to it. Bitcoin cannot be reversed, so one mistyped character
 * means the payment is lost for good. Every address format carries a checksum
 * designed to catch exactly that, so a typo is refused here, before it reaches
 * anyone:
 *
 *  · legacy (1…) and P2SH (3…): Base58Check, a double SHA-256 over the payload
 *  · SegWit v0 (bc1q…): bech32, BIP-173
 *  · Taproot (bc1p…): bech32m, BIP-350
 *
 * Testnet and regtest addresses (tb1…, m…, n…, 2…) are refused: a customer cannot pay
 * a testnet address with real bitcoin.
 */
export function isValidBitcoinAddress(input: string): boolean {
  const address = input.trim()
  if (/^(bc1|BC1)/.test(address)) return isValidSegwit(address)
  if (/^[13]/.test(address)) return isValidBase58Check(address)
  return false
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function isValidBase58Check(address: string): boolean {
  if (address.length < 26 || address.length > 35) return false
  let value = 0n
  for (const ch of address) {
    const digit = BASE58.indexOf(ch)
    if (digit < 0) return false
    value = value * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (value > 0n) {
    bytes.unshift(Number(value % 256n))
    value /= 256n
  }
  for (const ch of address) {
    if (ch !== '1') break
    bytes.unshift(0)
  }
  if (bytes.length !== 25) return false
  const payload = Buffer.from(bytes.slice(0, 21))
  const checksum = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest()
  if (!bytes.slice(21).every((b, i) => b === checksum[i])) return false
  // Version byte: 0x00 pay-to-pubkey-hash (1…), 0x05 pay-to-script-hash (3…).
  return bytes[0] === 0x00 || bytes[0] === 0x05
}

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const BECH32M_CONST = 0x2bc830a3

function polymod(values: readonly number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i]!
  }
  return chk >>> 0
}

function isValidSegwit(input: string): boolean {
  // Mixed case is invalid in bech32; all-upper is allowed and means the same thing.
  if (input !== input.toLowerCase() && input !== input.toUpperCase()) return false
  const address = input.toLowerCase()
  if (address.length < 14 || address.length > 90) return false
  const sep = address.lastIndexOf('1')
  if (sep !== 2 || address.slice(0, sep) !== 'bc') return false
  const data: number[] = []
  for (const ch of address.slice(sep + 1)) {
    const v = BECH32.indexOf(ch)
    if (v < 0) return false
    data.push(v)
  }
  if (data.length < 7) return false
  const hrpExpand = [...'bc'].map((c) => c.charCodeAt(0) >> 5).concat([0], [...'bc'].map((c) => c.charCodeAt(0) & 31))
  const check = polymod([...hrpExpand, ...data])
  const version = data[0]!
  // v0 must use bech32 (constant 1); v1+ must use bech32m.
  if (version === 0 ? check !== 1 : check !== BECH32M_CONST) return false
  if (version > 16) return false
  // Convert the 5-bit program (minus version and 6-char checksum) to bytes.
  const program: number[] = []
  let acc = 0
  let bits = 0
  for (const v of data.slice(1, -6)) {
    acc = (acc << 5) | v
    bits += 5
    while (bits >= 8) {
      bits -= 8
      program.push((acc >> bits) & 0xff)
    }
  }
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff) !== 0) return false
  if (program.length < 2 || program.length > 40) return false
  if (version === 0 && program.length !== 20 && program.length !== 32) return false
  if (version === 1 && program.length !== 32) return false
  return true
}
