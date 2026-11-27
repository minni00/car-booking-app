import type { Booking, Car } from '../types'
import { Badge } from './ui'

const BOOKING: Record<Booking['status'], { label: string; tone: 'blue' | 'green' | 'neutral' | 'red' | 'amber' | 'dark' }> = {
  upcoming: { label: 'รอใช้รถ', tone: 'blue' },
  in_progress: { label: 'กำลังใช้รถ', tone: 'dark' },
  completed: { label: 'คืนรถแล้ว', tone: 'green' },
  cancelled: { label: 'ยกเลิก', tone: 'neutral' },
  no_show: { label: 'No-Show', tone: 'red' },
}

export function BookingStatusBadge({ status }: { status: Booking['status'] }) {
  const s = BOOKING[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function CarStatusBadge({ car, inUse }: { car: Car; inUse?: boolean }) {
  if (car.status === 'maintenance') return <Badge tone="amber">ซ่อมบำรุง</Badge>
  if (inUse) return <Badge tone="dark">กำลังใช้งาน</Badge>
  return <Badge tone="green">ว่าง</Badge>
}

/** ชื่อสถานะการจอง (ใช้ในรายงาน/ไฟล์ส่งออก) */
export const BOOKING_STATUS_LABEL = Object.fromEntries(Object.entries(BOOKING).map(([k, v]) => [k, v.label])) as Record<Booking['status'], string>
