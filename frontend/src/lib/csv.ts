export type CsvValue = string | number | null | undefined

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvCell(value: CsvValue): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
