import { describe, expect, it } from 'vitest'
import { parseDataminingCsv } from './parseDataminingCsv.ts'

/**
 * Sample Item.csv excerpt following the xivapi/ffxiv-datamining format:
 *   Row 0 – column indices
 *   Row 1 – column names
 *   Row 2 – type hints
 *   Row 3+ – data rows
 */
const SAMPLE_ITEM_CSV = `key,0,1,2,3,4,5,6,7,8,9,10,11,12,13
#,Singular,Adjective,Plural,PossessivePronoun,StartsWithVowel,Pronoun,Article,Description,Name,UICategory,IconID,Level{Item},Rarity
int32,str,sbyte,str,sbyte,sbyte,sbyte,sbyte,str,str,ItemUICategory,uint16,uint8,uint8
0,,0,,0,0,0,0,,,,0,0,1
1,Bronze Sword,0,Bronze Swords,0,0,0,0,A simple blade.,Bronze Sword,2,20000,1,1
2,Bronze Shield,0,Bronze Shields,0,0,0,0,A simple shield.,Bronze Shield,3,20001,1,1`

const SAMPLE_SINGLE_HEADER_ITEM_CSV = `#,Name,UICategory,IconID,Level{Item},Rarity
1,Bronze Sword,2,20000,1,1
2,Bronze Shield,3,20001,1,1`

describe('parseDataminingCsv', () => {
  it('returns an empty array for empty or invalid CSV text', () => {
    expect(parseDataminingCsv('')).toEqual([])
    expect(parseDataminingCsv('a\nb\nc')).toEqual([])
  })

  it('parses column names from row 1', () => {
    const rows = parseDataminingCsv(SAMPLE_ITEM_CSV)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toHaveProperty('#')
    expect(rows[0]).toHaveProperty('Name')
    expect(rows[0]).toHaveProperty('IconID')
  })

  it('skips the type-hint row (row 2) and starts data at row 3', () => {
    const rows = parseDataminingCsv(SAMPLE_ITEM_CSV)
    // Row 3 of the CSV is the id=0 placeholder row
    expect(rows[0]['#']).toBe('0')
  })

  it('parses all data rows', () => {
    const rows = parseDataminingCsv(SAMPLE_ITEM_CSV)
    expect(rows).toHaveLength(3)
  })

  it('maps each field to its column name', () => {
    const rows = parseDataminingCsv(SAMPLE_ITEM_CSV)
    expect(rows[1]['#']).toBe('1')
    expect(rows[1].Name).toBe('Bronze Sword')
    expect(rows[1].UICategory).toBe('2')
    expect(rows[1].IconID).toBe('20000')
    expect(rows[1]['Level{Item}']).toBe('1')
    expect(rows[1].Rarity).toBe('1')
  })

  it('handles quoted fields containing commas', () => {
    const csv = `key,0,1
#,Name,Description
str,str,str
1,"Sword, Iron","A sword, forged of iron."`
    const rows = parseDataminingCsv(csv)
    expect(rows[0].Name).toBe('Sword, Iron')
    expect(rows[0].Description).toBe('A sword, forged of iron.')
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    const csv = `key,0
#,Name
str,str
1,"Hero""s Blade"`
    const rows = parseDataminingCsv(csv)
    expect(rows[0].Name).toBe('Hero"s Blade')
  })

  it('handles embedded newlines inside quoted fields', () => {
    const csv = `key,0,1
#,Name,Description
str,str,str
1,Sword,"Line one
Line two"`
    const rows = parseDataminingCsv(csv)
    expect(rows[0].Description).toBe('Line one\nLine two')
  })

  it('fills missing columns with empty string when row has fewer fields', () => {
    const csv = `key,0,1,2
#,A,B,C
str,str,str,str
1,hello`
    const rows = parseDataminingCsv(csv)
    expect(rows[0].A).toBe('hello')
    expect(rows[0].B).toBe('')
    expect(rows[0].C).toBe('')
  })

  it('skips blank lines within the data section', () => {
    const csv = `key,0
#,Name
str,str
1,Sword

2,Shield`
    const rows = parseDataminingCsv(csv)
    expect(rows).toHaveLength(2)
  })

  it('parses CRLF files without adding carriage returns to keys', () => {
    const csv = ['key,0,1', '#,Name,Rarity', 'str,str,str', '1,Sword,2'].join(
      '\r\n',
    )
    const rows = parseDataminingCsv(csv)
    expect(rows[0]).toHaveProperty('Rarity')
    expect(rows[0]).not.toHaveProperty('Rarity\r')
    expect(rows[0].Rarity).toBe('2')
  })

  it('parses single-header CSV format from current upstream paths', () => {
    const rows = parseDataminingCsv(SAMPLE_SINGLE_HEADER_ITEM_CSV)
    expect(rows).toHaveLength(2)
    expect(rows[0]['#']).toBe('1')
    expect(rows[0].Name).toBe('Bronze Sword')
    expect(rows[1].IconID).toBe('20001')
  })

  it('parses single-header CSV format without a Name column', () => {
    const csv = `#,ItemResult,AmountResult
1,5056,1`
    const rows = parseDataminingCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].ItemResult).toBe('5056')
    expect(rows[0].AmountResult).toBe('1')
  })

  it('preserves trailing whitespace in field values', () => {
    const csv = `key,0
#,Name
str,str
1,"Sword  "`
    const rows = parseDataminingCsv(csv)
    expect(rows[0].Name).toBe('Sword  ')
  })
})
