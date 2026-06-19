import { parse } from 'csv-parse/sync'

/**
 * Parses a CSV file from the xivapi/ffxiv-datamining repository.
 *
 * Supports both known datamining CSV layouts:
 * 1) XIVData Oxidizer format with three header rows:
 *   Row 0 – column indices    (key, 0, 1, 2, …)
 *   Row 1 – column names      (#, Name, Singular, …)
 *   Row 2 – column type hints (int32, str, sbyte, …)
 *   Row 3+ – data rows
 * 2) Flat format with one header row:
 *   Row 0 – column names      (#, Name, Singular, …)
 *   Row 1+ – data rows
 *
 * Returns an array of plain objects keyed by the detected header row.
 * The first column is always stored under the key "#".
 */
export function parseDataminingCsv(csvText: string): Record<string, string>[] {
  const records = parse(csvText, {
    bom: true,
    relax_column_count: true,
    // Preserve blank records so only truly empty data rows are skipped below.
    skip_empty_lines: false,
  })

  if (records.length === 0) return []

  const firstRow = records[0]
  const hasLegacyHeader = firstRow[0] === 'key'
  const hasSingleHeader = firstRow[0] === '#'
  if (!hasLegacyHeader && !hasSingleHeader) {
    return []
  }

  const columnNames = hasSingleHeader ? records[0] : records[1]
  const dataStartIndex = hasSingleHeader ? 1 : 3
  if (records.length <= dataStartIndex) return []

  const results: Record<string, string>[] = []

  for (let i = dataStartIndex; i < records.length; i++) {
    const values = records[i]
    // csv-parse emits an empty line as [''].
    if (values.length === 1 && values[0] === '') continue

    const row: Record<string, string> = {}
    for (let j = 0; j < columnNames.length; j++) {
      row[columnNames[j]] = values[j] ?? ''
    }
    results.push(row)
  }

  return results
}
