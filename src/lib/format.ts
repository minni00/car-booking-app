export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export const fmtNumber = (n: number) => n.toLocaleString('th-TH')
export const fmtBaht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
export const fmtKm = (n: number) => `${n.toLocaleString('th-TH')} กม.`

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function initials(name: string): string {
  return name.trim().slice(0, 2)
}
