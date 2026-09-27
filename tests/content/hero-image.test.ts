import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { heroAlt, isHeroKey } from '@/lib/content/hero-image'
import { postCardImage } from '@/lib/content/post-images'

/*
  `Post.heroImageKey` had been in the schema since the content models were added and
  nothing read it, so an article's picture was always a product photograph chosen by
  matching a regular expression against the title. The owner generates an image per
  article (2026-09-17); these cover the piece that was missing.
*/
describe('alt text for an article image', () => {
  it('derives it from the title when none was typed', () => {
    expect(heroAlt('What Is Mimosa Hostilis Root Bark?')).toBe(
      'Illustration for the article What Is Mimosa Hostilis Root Bark',
    )
  })

  it('prefers what was typed, sanitised the same way as a meta tag', () => {
    expect(heroAlt('Ignored', 'Skeins of wool dyed with root bark | close up')).toBe(
      'Skeins of wool dyed with root bark, close up',
    )
  })

  it('treats a blank or whitespace field as untyped', () => {
    for (const typed of ['', '   ', null, undefined]) {
      expect(heroAlt('Dyeing With Bark', typed)).toBe('Illustration for the article Dyeing With Bark')
    }
  })

  it('never returns an empty string, whatever the title', () => {
    for (const title of ['?', '...', 'A']) expect(heroAlt(title).length).toBeGreaterThan(10)
  })
})

describe('keys this site wrote', () => {
  it('accepts the key prepareProductPhoto produces', () => {
    expect(isHeroKey('media/3f1c9a7e5b2d4086af13c25e7d9b0412.jpg')).toBe(true)
    expect(isHeroKey('content/post-hero.webp')).toBe(true)
  })

  it('refuses anything that is not a plain key under the bucket', () => {
    for (const key of [
      'https://evil.example/x.jpg',
      '//evil.example/x.jpg',
      '/media/x.jpg',
      '../../../etc/passwd',
      'media/../../secret.jpg',
      'media/x.svg',
      'media/x',
      '',
      'javascript:alert(1)',
    ]) {
      expect(isHeroKey(key), key).toBe(false)
    }
  })
})

/*
  The "More blogs" strip at the foot of an article read the topic photograph directly,
  so three cards in one category showed the same stock picture and never the article's
  own (owner, 2026-09-27: "they are all using one image and the image there is not
  right"). Both the strip and the blog index now resolve a card's picture here.
*/
describe('the picture on an article card', () => {
  // heroSrc needs the image host; without it every card correctly falls back.
  const previous = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST
  beforeAll(() => { process.env.NEXT_PUBLIC_R2_PUBLIC_HOST = 'images.test' })
  afterAll(() => { process.env.NEXT_PUBLIC_R2_PUBLIC_HOST = previous })

  const post = { slug: 'why-a-cartridge-clogs-and-what-to-do', title: 'Why a Cartridge Clogs', category: 'devices' }

  it('uses the article own image when it has one', () => {
    const card = postCardImage({ ...post, heroImageKey: 'media/88ff4fe5b5232fda9564a74a7b1e8dea.jpg' })
    expect(card.src).toContain('media/88ff4fe5b5232fda9564a74a7b1e8dea.jpg')
    expect(card.alt).toBe('Illustration for the article Why a Cartridge Clogs')
  })

  it('falls back to the topic photograph when it has none', () => {
    const card = postCardImage(post)
    expect(card.src).not.toContain('media/')
    expect(card.src.length).toBeGreaterThan(0)
    expect(card.alt.length).toBeGreaterThan(0)
  })

  it('ignores a key that is not a safe image path', () => {
    const card = postCardImage({ ...post, heroImageKey: '../secrets/key.txt' })
    expect(card.src).not.toContain('secrets')
  })

  it('gives two articles in one category different pictures once each has its own', () => {
    const a = postCardImage({ ...post, heroImageKey: 'media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg' })
    const b = postCardImage({ slug: 'what-a-510-cartridge-is', title: 'What a 510 Cartridge Is', category: 'devices', heroImageKey: 'media/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg' })
    expect(a.src).not.toBe(b.src)
  })
})
