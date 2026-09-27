import 'server-only'
import { listMergedProducts } from '@/lib/catalog/merged'
import { listAllGuides, listAllPosts, listAuthors } from './merged-content'
import type { ContentOptions } from '@/components/admin/content-editor'

/**
 * What the post and guide editor may offer.
 *
 * The same sets `saveContent` validates against, so the editor can only present a
 * choice the action will accept. Pillars and clusters are PUBLISHED pieces only: a
 * link to a draft is a link to a page that 404s for everyone who is not signed in.
 */
export async function contentEditorOptions(): Promise<ContentOptions> {
  /*
    The merged catalogue, not the authored one: it already includes products posted
    from the admin panel, with their names — which live inside a JSON document on
    that table rather than in a column. Reading it here keeps that parsing in the
    one module that owns it.
  */
  const [guides, posts, products] = await Promise.all([
    listAllGuides(),
    listAllPosts(),
    listMergedProducts(),
  ])

  return {
    products: products.map((p) => ({ slug: p.slug, name: p.name })),
    guides: guides.map((g) => ({ slug: g.slug, title: g.title })),
    posts: posts.map((p) => ({ slug: p.slug, title: p.title })),
    authors: listAuthors().map((a) => ({ slug: a.slug, name: a.name })),
  }
}
