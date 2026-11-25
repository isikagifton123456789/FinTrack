import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('CSV export', () => {
  it('quotes delimiters and quotes and prefixes a UTF-8 BOM', () => {
    expect(toCsv(['Name', 'Note'], [['Portfolio, one', 'A "quoted" note']]))
      .toBe('\uFEFF"Name","Note"\r\n"Portfolio, one","A ""quoted"" note"\r\n')
  })

  it('neutralizes spreadsheet formulas and formats empty cells', () => {
    expect(toCsv(['Name', 'Value'], [['=HYPERLINK("https://example.com")', null]]))
      .toBe('\uFEFF"Name","Value"\r\n"\'=HYPERLINK(""https://example.com"")",""\r\n')
  })

  it('preserves negative numeric values as numbers', () => {
    expect(toCsv(['Gain / loss'], [[-12.5]])).toBe('\uFEFF"Gain / loss"\r\n"-12.5"\r\n')
  })
})
