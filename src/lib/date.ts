export const pad = (n: number) => String(n).padStart(2, '0')

type DateInput = string | number | Date

const toDate = (v: DateInput) => (v instanceof Date ? v : new Date(v))

/** YYYY-MM-DD ตามเวลาท้องถิ่น */
export function toDateKey(v: DateInput = new Date()): string {
  const d = toDate(v)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** รวมวันที่ + เวลา "HH:mm" เป็น Date */
export function combine(dateKey: string, hhmm: string): Date {
  const d = parseDateKey(dateKey)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export function addMinutes(v: DateInput, minutes: number): Date {
  return new Date(toDate(v).getTime() + minutes * 60_000)
}

export function addDays(v: DateInput, days: number): Date {
  const d = new Date(toDate(v))
  d.setDate(d.getDate() + days)
  return d
}

export function fmtTime(v: DateInput): string {
  const d = toDate(v)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtDate(v: DateInput): string {
  return toDate(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateShort(v: DateInput): string {
  return toDate(v).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtDateTime(v: DateInput): string {
  return `${fmtDateShort(v)} ${fmtTime(v)}`
}

export function fmtRange(start: DateInput, end: DateInput): string {
  const sameDay = toDateKey(start) === toDateKey(end)
  return sameDay
    ? `${fmtDateShort(start)} · ${fmtTime(start)}–${fmtTime(end)}`
    : `${fmtDateTime(start)} – ${fmtDateTime(end)}`
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h} ชม. ${m} นาที`
  if (h) return `${h} ชม.`
  return `${m} นาที`
}

/** จำนวนวันจากวันนี้ถึงวันที่ (YYYY-MM-DD) ติดลบ = เลยมาแล้ว */
export function daysUntil(dateKey: string): number {
  const today = parseDateKey(toDateKey())
  return Math.round((parseDateKey(dateKey).getTime() - today.getTime()) / 86_400_000)
}

/** สำหรับ <input type="datetime-local"> */
export function toLocalInput(v: DateInput): string {
  const d = toDate(v)
  return `${toDateKey(d)}T${fmtTime(d)}`
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString()
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}
