import { describe, expect, it } from 'vitest'
import { parseTable } from '@/lib/content/table'

/*
  Article bodies come from the admin panel, so a table in one was typed or pasted by
  a person. The parser renders exactly one well-formed pipe table and refuses
  everything near it, because a guessed table puts a fact in the wrong column — and
  a comparison with a shifted cell says something false in a tidy format.
*/
describe('a pipe table in an article body', () => {
  const table = ['| Method | Solvent | Heat |', '| --- | --- | --- |', '| Rosin | None | Yes |', '| Distillate | Yes | Yes |'].join('\n')

  it('reads the header and every row', () => {
    expect(parseTable(table)).toEqual({
      header: ['Method', 'Solvent', 'Heat'],
      rows: [
        ['Rosin', 'None', 'Yes'],
        ['Distillate', 'Yes', 'Yes'],
      ],
    })
  })

  it('accepts alignment colons in the separator row', () => {
    expect(parseTable('| A | B |\n| :--- | ---: |\n| 1 | 2 |')).not.toBeNull()
  })

  it('keeps inline links and bold inside a cell for the renderer', () => {
    const out = parseTable('| Term | Read |\n| --- | --- |\n| **THCA** | [What THCA is](/blog/what-thca-is) |')
    expect(out?.rows[0]).toEqual(['**THCA**', '[What THCA is](/blog/what-thca-is)'])
  })

  it('tolerates indentation and blank lines around rows', () => {
    expect(parseTable('  | A | B |\n\n  | --- | --- |\n  | 1 | 2 |  ')).not.toBeNull()
  })

  it.each([
    ['a paragraph', 'Rosin is pressed with heat and pressure. It uses no solvent.'],
    ['a list', '- one\n- two\n- three'],
    ['no separator row', '| A | B |\n| 1 | 2 |\n| 3 | 4 |'],
    ['header only', '| A | B |\n| --- | --- |'],
    ['a row with a missing cell', '| A | B |\n| --- | --- |\n| 1 |'],
    ['a row with an extra cell', '| A | B |\n| --- | --- |\n| 1 | 2 | 3 |'],
    ['a separator of the wrong width', '| A | B |\n| --- |\n| 1 | 2 |'],
    ['a single column', '| A |\n| --- |\n| 1 |'],
    ['an empty header cell', '| A |  |\n| --- | --- |\n| 1 | 2 |'],
    ['a line that is not a row', '| A | B |\n| --- | --- |\nloose words'],
    ['a sentence that merely contains pipes', 'Choose one | or the other | then order.'],
  ])('refuses %s and leaves it to render as it was written', (_label, block) => {
    expect(parseTable(block)).toBeNull()
  })
})
