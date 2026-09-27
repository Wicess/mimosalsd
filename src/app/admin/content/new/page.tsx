import { AdminPage } from '@/components/admin/shell'
import { ContentEditor } from '@/components/admin/content-editor'
import { contentEditorOptions } from '@/lib/content/editor-options'

export const metadata = { title: 'New piece' }

type SearchParams = Promise<{ kind?: string }>

/*
  The query string is read INSIDE AdminPage, whose children sit in a Suspense
  boundary. Awaited at the top of the page it blocked the whole route: Next flagged
  it, and navigating here waited on the server before showing anything.
*/
async function NewContent({ searchParams }: { searchParams: SearchParams }) {
  const { kind: raw } = await searchParams
  const kind = raw === 'guide' ? 'guide' : 'post'
  const options = await contentEditorOptions()
  return (
    <div className="max-w-3xl">
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        {kind === 'guide'
          ? 'A guide is a pillar: the comprehensive answer to a broad question, linking down to the blogs that go deeper.'
          : 'A blog answers one specific question, answer first, and links up to the guide it belongs to.'}
      </p>
      <ContentEditor kind={kind} options={options} />
    </div>
  )
}

export default function NewContentPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage title="New guide or blog" description="Saving never publishes. Every save and every publish runs the compliance lexicon.">
      <NewContent searchParams={searchParams} />
    </AdminPage>
  )
}
