import type { Ticket } from '../types'
import { db, newId } from './dataSource'

export type TicketInput = Omit<Ticket, 'id' | 'createdAt' | 'matchedBookingId' | 'matchedDriverId'>

export interface TicketMatch {
  bookingId: string | null
  driverId: string | null
}

/**
 * จับคู่ผู้ขับอัตโนมัติ: หาทริปของรถคันนั้นที่เวลาเกิดเหตุอยู่ระหว่าง actual_start – actual_end
 * (ทริปที่ยังไม่คืนรถ นับ actual_end = ตอนนี้)
 */
async function matchDriver(carId: string, occurredAt: string): Promise<TicketMatch> {
  const t = new Date(occurredAt).getTime()
  if (!carId || Number.isNaN(t)) return { bookingId: null, driverId: null }
  const bookings = await db.list('bookings')
  const hit = bookings.find((b) => {
    if (b.carId !== carId || !b.actualStart) return false
    const s = new Date(b.actualStart).getTime()
    const e = b.actualEnd ? new Date(b.actualEnd).getTime() : Date.now()
    return t >= s && t <= e
  })
  return { bookingId: hit?.id ?? null, driverId: hit?.driverId ?? null }
}

function validate(input: TicketInput) {
  if (!input.carId) throw new Error('กรุณาเลือกรถ')
  if (!input.violation.trim()) throw new Error('กรุณาระบุข้อหา')
  if (!(input.amount >= 0)) throw new Error('จำนวนเงินไม่ถูกต้อง')
}

export const ticketService = {
  matchDriver,

  async list(): Promise<Ticket[]> {
    const all = await db.list('tickets')
    return all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  },

  async listForDriver(userId: string): Promise<Ticket[]> {
    return (await ticketService.list()).filter((t) => t.matchedDriverId === userId)
  },

  async create(input: TicketInput): Promise<Ticket> {
    validate(input)
    const m = await matchDriver(input.carId, input.occurredAt)
    return db.create('tickets', {
      ...input,
      id: newId('tk'),
      matchedBookingId: m.bookingId,
      matchedDriverId: m.driverId,
      createdAt: new Date().toISOString(),
    })
  },

  async update(id: string, input: TicketInput): Promise<Ticket> {
    validate(input)
    const m = await matchDriver(input.carId, input.occurredAt)
    return db.update('tickets', id, { ...input, matchedBookingId: m.bookingId, matchedDriverId: m.driverId })
  },

  remove: (id: string) => db.remove('tickets', id),
}

export const TICKET_STATUS_LABEL: Record<Ticket['status'], string> = {
  pending: 'รอแจ้งผู้ขับ',
  notified: 'แจ้งผู้ขับแล้ว',
  paid: 'ชำระแล้ว',
}
