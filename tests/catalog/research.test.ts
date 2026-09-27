import { describe, expect, it } from 'vitest'
import { acceptResearch } from '@/lib/catalog/autowrite/research'

const searched = [
  { label: 'Maker — Juice Man 2g', url: 'https://maker.example/juice-man' },
  { label: 'Retailer listing', url: 'https://shop.example/p/juice-man' },
  { label: 'Retailer listing (again)', url: 'https://shop.example/p/juice-man' },
]

describe('researched notes are held to the pages the search returned', () => {
  it('keeps notes citing a searched page, and each source once', () => {
    const research = acceptResearch(
      'Capacity: 2 g (https://maker.example/juice-man)\nFlavor: tropical fruit punch (https://shop.example/p/juice-man)',
      searched,
    )
    expect(research?.notes.split('\n')).toHaveLength(2)
    expect(research?.sources.map((s) => s.url)).toEqual(['https://maker.example/juice-man', 'https://shop.example/p/juice-man'])
  })

  it('drops a note that cites an address no search returned', () => {
    const research = acceptResearch(
      'Battery: 280 mAh (https://maker.example/juice-man)\nAward: best of 2026 (https://invented.example/award)',
      searched,
    )
    expect(research?.notes).toBe('Battery: 280 mAh (https://maker.example/juice-man)')
  })

  it('gives nothing when the search returned no pages, whatever the notes say', () => {
    expect(acceptResearch('Capacity: 2 g (https://maker.example/juice-man)', [])).toBeNull()
  })

  it('gives nothing when no note survives', () => {
    expect(acceptResearch('Could not find this exact product. (https://invented.example/x)', searched)).toBeNull()
  })
})
