import { createCipheriv, createECDH, createHmac, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WEB PUSH, THE WIRE FORMAT — no dependency, and tested against the RFC.
 *
 *  Two standards, both small:
 *   · RFC 8291 (with RFC 8188's aes128gcm) encrypts the message for one browser,
 *     using the public key and auth secret that browser handed us when it
 *     subscribed. The push service in the middle (Google, Apple, Mozilla) carries
 *     ciphertext it cannot read.
 *   · RFC 8292 (VAPID) signs each request with the site's own key pair, so a push
 *     service only accepts messages for these subscriptions from this server.
 *
 *  Written here rather than taken from the `web-push` package: the whole of it is
 *  the two functions below, Node's crypto has every primitive, and the test runs
 *  the RFC's own worked example byte for byte, which proves more than a
 *  dependency's changelog would.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export function fromBase64url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function hmac(key: Uint8Array, ...parts: Uint8Array[]): Buffer {
  const mac = createHmac('sha256', key)
  for (const part of parts) mac.update(part)
  return mac.digest()
}

/** HKDF (RFC 5869) with a single output block, which is all 32 bytes or fewer need. */
function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Buffer {
  const prk = hmac(salt, ikm)
  return hmac(prk, info, Uint8Array.of(1)).subarray(0, length)
}

const RECORD_SIZE = 4096

export interface EncryptInput {
  /** The browser's `p256dh` key: a 65-byte uncompressed P-256 point, base64url. */
  readonly p256dh: string
  /** The browser's 16-byte `auth` secret, base64url. */
  readonly auth: string
  readonly plaintext: Uint8Array
  /** Fixed only by the RFC test; random for every real message. */
  readonly salt?: Uint8Array
  /** Fixed only by the RFC test; a fresh key pair for every real message. */
  readonly senderPrivateKey?: Uint8Array
}

/**
 * Encrypt one push message body (RFC 8291 §3.4, a single aes128gcm record).
 *
 * The plaintext must leave room for the 16-byte tag and one delimiter byte inside
 * the 4096-byte record, and push services cap the whole body near 4KB anyway, so
 * anything longer is refused here rather than by a push service later.
 */
export function encryptPayload(input: EncryptInput): Buffer {
  const uaPublic = fromBase64url(input.p256dh)
  const authSecret = fromBase64url(input.auth)
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('Invalid p256dh key')
  if (authSecret.length < 16) throw new Error('Invalid auth secret')
  if (input.plaintext.length > RECORD_SIZE - 16 - 1 - 86) throw new Error('Push payload too large')

  const ecdh = createECDH('prime256v1')
  if (input.senderPrivateKey) ecdh.setPrivateKey(input.senderPrivateKey)
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const ecdhSecret = ecdh.computeSecret(uaPublic)

  // Combine the ECDH secret with the auth secret (§3.3).
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic])
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32)

  // RFC 8188: derive the content key and nonce from a random salt.
  const salt = input.salt ?? randomBytes(16)
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  // 0x02 marks the last (here, only) record. No padding.
  const ciphertext = Buffer.concat([cipher.update(input.plaintext), cipher.update(Uint8Array.of(2)), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(16 + 4 + 1)
  Buffer.from(salt).copy(header, 0)
  header.writeUInt32BE(RECORD_SIZE, 16)
  header.writeUInt8(asPublic.length, 20)
  return Buffer.concat([header, asPublic, ciphertext])
}

export interface VapidKeys {
  /** 65-byte uncompressed P-256 public key, base64url. What browsers subscribe with. */
  readonly publicKey: string
  /** 32-byte private scalar, base64url. */
  readonly privateKey: string
}

export function generateVapidKeys(): VapidKeys {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  const priv = privateKey.export({ format: 'jwk' })
  const raw = Buffer.concat([Uint8Array.of(4), fromBase64url(pub.x!), fromBase64url(pub.y!)])
  return { publicKey: base64url(raw), privateKey: priv.d! }
}

/**
 * The `Authorization` header for one push request (RFC 8292).
 *
 * `aud` is the push service's origin and `exp` at most 24 hours ahead; twelve
 * leaves room for clock skew between this server and the push service.
 */
export function vapidAuthorization(input: {
  readonly endpoint: string
  readonly keys: VapidKeys
  readonly subject: string
  readonly now?: number
}): string {
  const raw = fromBase64url(input.keys.publicKey)
  const key = createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: input.keys.privateKey,
      x: base64url(raw.subarray(1, 33)),
      y: base64url(raw.subarray(33, 65)),
    },
  })
  const now = Math.floor((input.now ?? Date.now()) / 1000)
  const header = base64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = base64url(
    Buffer.from(JSON.stringify({ aud: new URL(input.endpoint).origin, exp: now + 12 * 60 * 60, sub: input.subject })),
  )
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${header}.${claims}.${base64url(signature)}, k=${input.keys.publicKey}`
}
