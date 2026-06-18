import { parse } from 'csv-parse/sync'

/**
 * Parses a CSV file from the xivapi/ffxiv-datamining repository.
 *
 * The datamining CSV format produced by XIVData Oxidizer has three header rows
 * followed by data rows:
 *   Row 0 – column indices    (key, 0, 1, 2, …)
 *   Row 1 – column names      (#, Name, Singular, …)
 *   Row 2 – column type hints (int32, str, sbyte, …)
 *   Row 3+ – data rows
 *
 * Returns an array of plain objects keyed by the column names from row 1.
 * The first column is always stored under the key "#".
 */
export function parseDataminingCsv(csvText: string): Record<string, string>[] {
  const records = parse(csvText, {
    bom: true,
    relax_column_count: true,
    // Preserve blank records so only truly empty data rows are skipped below.
    skip_empty_lines: false,
  })

  if (records.length < 4) return []
  const columnNames = records[1]

  const results: Record<string, string>[] = []

  for (let i = 3; i < records.length; i++) {
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
