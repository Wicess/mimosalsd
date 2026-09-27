import { createECDH, createPublicKey, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { base64url, encryptPayload, fromBase64url, generateVapidKeys, vapidAuthorization } from '@/lib/push/crypto'

/**
 * RFC 8291 §5 and Appendix A, verbatim. If this passes, every browser's push
 * service can decrypt what we send, because this is the example they test against.
 */
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

describe('encryptPayload (RFC 8291)', () => {
  it('reproduces the RFC example byte for byte', () => {
    const body = encryptPayload({
      p256dh: RFC.uaPublic,
      auth: RFC.auth,
      plaintext: Buffer.from(RFC.plaintext),
      salt: fromBase64url(RFC.salt),
      senderPrivateKey: fromBase64url(RFC.asPrivate),
    })
    expect(base64url(body)).toBe(RFC.body)
    // 86-byte header + 41 plaintext + 1 delimiter + 16 tag. (The RFC's HTTP example
    // says Content-Length 145; the body it prints decodes to 144.)
    expect(body.length).toBe(144)
  })

  it('uses a fresh salt and sender key for every message', () => {
    const input = { p256dh: RFC.uaPublic, auth: RFC.auth, plaintext: Buffer.from('hi') }
    const a = encryptPayload(input)
    const b = encryptPayload(input)
    expect(a.subarray(0, 16).equals(b.subarray(0, 16))).toBe(false)
    expect(a.subarray(21, 86).equals(b.subarray(21, 86))).toBe(false)
  })

  it('refuses a malformed browser key, a short auth secret and an oversized message', () => {
    const ok = { p256dh: RFC.uaPublic, auth: RFC.auth, plaintext: Buffer.from('x') }
    expect(() => encryptPayload({ ...ok, p256dh: base64url(Buffer.alloc(65)) })).toThrow(/p256dh/)
    expect(() => encryptPayload({ ...ok, auth: base64url(Buffer.alloc(8)) })).toThrow(/auth/)
    expect(() => encryptPayload({ ...ok, plaintext: Buffer.alloc(4000) })).toThrow(/too large/)
  })

  it('agrees with an ECDH done from the browser side', () => {
    // The receiver derives the same shared secret from its private key and our public one.
    const browser = createECDH('prime256v1')
    browser.generateKeys()
    const body = encryptPayload({
      p256dh: base64url(browser.getPublicKey()),
      auth: base64url(Buffer.alloc(16, 7)),
      plaintext: Buffer.from('{"title":"x"}'),
    })
    const senderPublic = body.subarray(21, 86)
    expect(body.readUInt32BE(16)).toBe(4096)
    expect(body[20]).toBe(65)
    expect(() => browser.computeSecret(senderPublic)).not.toThrow()
  })
})

describe('VAPID (RFC 8292)', () => {
  it('generates a P-256 key pair in the form browsers subscribe with', () => {
    const keys = generateVapidKeys()
    const raw = fromBase64url(keys.publicKey)
    expect(raw.length).toBe(65)
    expect(raw[0]).toBe(4)
    expect(fromBase64url(keys.privateKey).length).toBe(32)
  })

  it('signs a JWT the push service can verify with the public key', () => {
    const keys = generateVapidKeys()
    const now = Date.UTC(2026, 8, 13, 12)
    const header = vapidAuthorization({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys,
      subject: 'mailto:contact@mimosalsd.com',
      now,
    })
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)
    expect(match).not.toBeNull()
    const [, h = '', c = '', s = '', k = ''] = match!
    expect(k).toBe(keys.publicKey)
    expect(JSON.parse(fromBase64url(h).toString())).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(fromBase64url(c).toString())).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'mailto:contact@mimosalsd.com',
    })
    const raw = fromBase64url(keys.publicKey)
    const publicKey = createPublicKey({
      format: 'jwk',
      key: { kty: 'EC', crv: 'P-256', x: base64url(raw.subarray(1, 33)), y: base64url(raw.subarray(33)) },
    })
    const signature = fromBase64url(s)
    expect(signature.length).toBe(64)
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)).toBe(true)
  })
})
