import { AdminPage } from '@/components/admin/shell'
import { QuickPostForm } from '@/components/admin/quick-post-form'
import { claudeWriterConfigured } from '@/lib/catalog/autowrite'
import { postingOptions } from '@/lib/catalog/posted-admin'

export const metadata = { title: 'Post a product' }

// Posting uploads up to six photos and writes the page: give the action room.
export const maxDuration = 300

export default function PostProductPage() {
  const { categories } = postingOptions()
  return (
    <AdminPage
      title="Post a product"
      // Short on purpose: the detail is one tap away under "What gets written for you",
      // and on a phone a four-line description pushed the first field off the screen.
      description="Name, category, price and photos. The page writes itself and goes live the moment you post."
    >
      <QuickPostForm categories={categories} claudeReady={claudeWriterConfigured()} />
    </AdminPage>
  )
}
