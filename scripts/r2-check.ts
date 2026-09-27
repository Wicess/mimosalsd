#!/usr/bin/env tsx
/** R2 connectivity + public/private separation smoke test. `npm run r2:check` */
import 'dotenv/config'
import {
  checkConnection,
  isPrivateKey,
  keys,
  publicUrl,
  putObject,
  signedUrl,
  deleteObject,
} from '../src/lib/storage/r2'

async function main() {
  await checkConnection()
  console.log('✓ bucket reachable:', process.env.R2_BUCKET)

  const testKey = 'diagnostics/connection-test.txt'
  await putObject(testKey, `ok ${new Date().toISOString()}`, 'text/plain')
  console.log('✓ upload succeeded')
  console.log('  public URL:', publicUrl(testKey))

  const receiptKey = keys.paymentReceipt('testtoken', 1, 'diagnostic', 'jpg')
  console.log('✓ private key detected:', isPrivateKey(receiptKey))
  try {
    publicUrl(receiptKey)
    console.error('✗ publicUrl() did NOT refuse a private key')
    process.exit(1)
  } catch {
    console.log('✓ publicUrl() refuses private keys')
  }

  const signed = await signedUrl(receiptKey, 60)
  console.log('✓ signed URL issued:', signed.slice(0, 70) + '…')

  await deleteObject(testKey)
  console.log('✓ cleanup done')
}

main().catch((e: Error) => {
  console.error('✗ FAILED:', e.message.split('\n')[0])
  process.exit(1)
})
