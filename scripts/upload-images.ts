import 'dotenv/config'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

/**
 * Push local imagery to R2 and print the public URLs.
 *
 *   npm run images:upload            # everything in public/samples
 *   npm run images:upload -- ./shots # any other directory
 *
 * The house rule is that images live in object storage, not in the repository:
 * a photograph committed to /public is baked into every build, served from the
 * application origin instead of the CDN, and cannot be replaced without a
 * deploy. Uploading here means new photography is live the moment it lands, and
 * the storefront picks it up with no code change — `sample-images.ts` resolves
 * `products/<id>.jpg` against `R2_PUBLIC_HOST` whenever that is configured.
 *
 * The key is derived from the FILE NAME, so replacing a product's photograph is
 * a matter of uploading a file with the same name. Keys are stable on purpose;
 * R2 objects are written with a one-year immutable cache header, so a changed
 * image needs a cache purge or a new name — which is a deliberate trade for
 * never paying for a cache miss on the other 99.9% of requests.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

async function main() {
  const dir = process.argv[2] ?? 'public/samples'
  // Imported lazily: r2.ts is `server-only`, and the AWS client reads env that
  // dotenv has only just populated.
  const { putObject, publicUrl } = await import('../src/lib/storage/r2')

  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    console.error(`No such directory: ${dir}`)
    process.exit(1)
  }

  const images = files.filter((f) => extname(f).toLowerCase() in CONTENT_TYPES)
  if (images.length === 0) {
    console.error(`No images in ${dir}`)
    process.exit(1)
  }

  console.log(`Uploading ${images.length} image(s) from ${dir}\n`)
  let failed = 0

  for (const file of images) {
    const key = `products/${file}`
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()]!
    try {
      await putObject(key, await readFile(join(dir, file)), contentType)
      console.log(`  ✓ ${key}\n    ${publicUrl(key)}`)
    } catch (error) {
      failed += 1
      console.error(`  ✗ ${key} — ${(error as Error).message}`)
    }
  }

  console.log(
    `\n${images.length - failed} uploaded, ${failed} failed.` +
      (failed === 0
        ? '\nNothing else to do — the storefront reads these keys already.'
        : ''),
  )
  process.exit(failed === 0 ? 0 : 1)
}

void main()
