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
  const lines = csvText.split('\n')

  if (lines.length < 4) return []

  const columnNames = parseCsvRow(lines[1])

  const results: Record<string, string>[] = []

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trimEnd()
    if (!line) continue

    const values = parseCsvRow(line)
    if (values.length === 0) continue

    const row: Record<string, string> = {}
    for (let j = 0; j < columnNames.length; j++) {
      row[columnNames[j]] = values[j] ?? ''
    }
    results.push(row)
  }

  return results
}

/** Parses a single RFC 4180 CSV row into an array of field strings. */
function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let i = 0

  while (i < line.length) {
    if (line[i] === '"') {
      let value = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"'
            i += 2
          } else {
            i++ // skip closing quote
            break
          }
        } else {
          value += line[i]
          i++
        }
      }
      fields.push(value)
      if (i < line.length && line[i] === ',') i++
    } else {
      const commaIdx = line.indexOf(',', i)
      if (commaIdx === -1) {
        fields.push(line.slice(i))
        break
      } else {
        fields.push(line.slice(i, commaIdx))
        i = commaIdx + 1
      }
    }
  }

  // A trailing comma means the final field is empty.
  if (fields.length > 0 && line.endsWith(',')) {
    fields.push('')
  }

  return fields
}
