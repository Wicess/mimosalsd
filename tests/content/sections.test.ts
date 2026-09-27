import { describe, expect, it } from 'vitest'
import { BLOG_SECTIONS, groupPostsIntoSections } from '@/lib/content/sections'
import { publishedPosts } from '@/lib/content/content.data'
import type { Post } from '@/lib/content/content.data'

const post = (slug: string, category: string): Post =>
  ({
    slug,
    title: slug,
    summary: 'x',
    body: ['x'],
    category,
    authorSlug: 'editorial-team',
    publishedAt: '2026-09-17',
    updatedAt: '2026-09-17',
    recommendedProductSlugs: [],
    isPublished: true,
  }) as Post

/*
  The index rendered fifty-seven articles in one grid. Sections come from
  Post.category so a topic lives in one place, which means the grouping has to cope
  with a category nobody has defined a section for yet — otherwise the day somebody
  adds one in the admin, those articles vanish from the index entirely.
*/
describe('grouping articles into sections', () => {
  it('keeps the declared order rather than sorting alphabetically', () => {
    const sections = groupPostsIntoSections([
      post('a', 'ordering'),
      post('b', 'botanical'),
      post('c', 'dyeing'),
    ])
    expect(sections.map((s) => s.slug)).toEqual(['botanical', 'dyeing', 'ordering'])
  })

  it('drops a section with nothing in it', () => {
    const sections = groupPostsIntoSections([post('a', 'dyeing')])
    expect(sections).toHaveLength(1)
    expect(sections[0]!.slug).toBe('dyeing')
  })

  it('still renders a category that has no section defined', () => {
    const sections = groupPostsIntoSections([post('a', 'dyeing'), post('b', 'brand-new-topic')])
    const extra = sections.find((s) => s.slug === 'brand-new-topic')
    expect(extra, 'an undeclared category must not silently disappear').toBeDefined()
    expect(extra!.title).toBe('Brand New Topic')
    expect(extra!.posts).toHaveLength(1)
  })

  it('puts undeclared categories after the declared ones', () => {
    const sections = groupPostsIntoSections([post('a', 'zzz-unknown'), post('b', 'botanical')])
    expect(sections.map((s) => s.slug)).toEqual(['botanical', 'zzz-unknown'])
  })

  it('loses no post, whatever its category', () => {
    const posts = [
      post('a', 'dyeing'), post('b', 'dyeing'), post('c', 'devices'),
      post('d', 'not-a-section'), post('e', ''),
    ]
    const total = groupPostsIntoSections(posts).reduce((n, s) => n + s.posts.length, 0)
    expect(total).toBe(posts.length)
  })

  it('files a post with no category rather than dropping it', () => {
    const sections = groupPostsIntoSections([post('a', '')])
    expect(sections).toHaveLength(1)
    expect(sections[0]!.posts[0]!.slug).toBe('a')
  })

  it('gives every declared section a real intro', () => {
    for (const section of BLOG_SECTIONS) {
      expect(section.title.length, section.slug).toBeGreaterThan(3)
      expect(section.intro.length, section.slug).toBeGreaterThan(40)
    }
  })

  it('declares no section slug twice', () => {
    const slugs = BLOG_SECTIONS.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('files every authored post into a declared section', () => {
    // Authored posts live in code, so a category left behind by a rename shows up here
    // rather than as a lonely one-post heading at the bottom of the index.
    const declared = new Set(BLOG_SECTIONS.map((s) => s.slug))
    for (const p of publishedPosts()) {
      expect(declared.has(p.category), `${p.slug} is filed under "${p.category}"`).toBe(true)
    }
  })
})
