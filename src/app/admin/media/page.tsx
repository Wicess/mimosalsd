import { AdminPage } from '@/components/admin/shell'
import { MediaUploader } from '@/components/admin/media-uploader'

export const metadata = {
  title: 'Media',
}

/**
 * Media upload.
 *
 * Deliberately a one-way tool rather than a browsable library.
 *
 * A library implies deletion, and deletion of a content-addressed object is the one
 * dangerous operation here: two pages can legitimately reference the same key,
 * because uploading the same file twice returns the same key by design. A "delete"
 * button that looks like it removes one page's image would silently break every
 * other page using it, and R2 gives no answer to "who references this". Storage is
 * cheap and no-egress; a stray object costs a fraction of a cent a year, and the
 * mistake it prevents costs an afternoon.
 *
 * No listing either, for a related reason: there is nothing useful to show. The keys
 * are hashes, so a grid of them tells an operator nothing they could act on, and the
 * upload result already hands back the URL — which is the only thing they came for.
 */
export default function MediaPage() {
  return (
    <AdminPage
      title="Media"
      description="Upload an image or a PDF and get a permanent URL for it. Files are stored under the hash of their own contents, so the same file always resolves to the same address and a corrected file always gets a new one."
    >
      <div className="max-w-2xl">
        <MediaUploader />
      </div>
    </AdminPage>
  )
}
