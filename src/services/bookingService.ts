import { config } from '../config'
import { addMinutes, overlaps, parseDateKey } from '../lib/date'
import type { Attachment, Booking, FuelMethod, GeoPoint, TripIssue } from '../types'
import { db, newId } from './dataSource'
import { notificationService, notifySafely } from './notificationService'
import { settingsService } from './settingsService'

export const ACTIVE_STATUSES: Booking['status'][] = ['upcoming', 'in_progress']

export interface BookingInput {
  carId: string
  bookedById: string
  driverId: string
  purpose: string
  passengers: number
  start: string
  end: string
  pickupPin?: GeoPoint | null
  destination?: GeoPoint | null
}

export interface BusyBlock {
  bookingId: string
  start: number
  end: number
  /** ช่วงรวม buffer ก่อน/หลัง */
  blockedStart: number
  blockedEnd: number
  status: Booking['status']
  driverId: string
}

export interface StartTripInput {
  mileage: number
  gps?: GeoPoint | null
  photos: Attachment[]
  odometerPhoto?: Attachment | null
  issue?: TripIssue | null
}

/** ตรวจรูปเลขไมล์ (บังคับ) และการแจ้งปัญหา (ถ้าแจ้ง ต้องมีรายละเอียดและรูป) */
function validateTripEvidence(input: { odometerPhoto?: Attachment | null; issue?: TripIssue | null }): void {
  if (!input.odometerPhoto) throw new Error('กรุณาถ่ายรูปหน้าปัดเลขไมล์')
  if (input.issue) {
    if (!input.issue.note.trim()) throw new Error('กรุณาระบุรายละเอียดปัญหา/รอยที่พบ')
    if (!input.issue.photos.length) throw new Error('กรุณาแนบรูปปัญหา/รอยที่พบอย่างน้อย 1 รูป')
  }
}

const cleanIssue = (issue?: TripIssue | null): TripIssue | null => (issue ? { note: issue.note.trim(), photos: issue.photos } : null)

export interface ReturnCarInput {
  mileage: number
  parkingSpot: string
  keyLocation: string
  fuelMethod: FuelMethod
  fuelAmount?: number
  fuelSlip?: Attachment | null
  gps?: GeoPoint | null
  photos: Attachment[]
  odometerPhoto?: Attachment | null
  issue?: TripIssue | null
}

/** เวลาสิ้นสุดที่มีผล: ถ้ากำลังใช้รถเกินเวลา ให้นับถึงตอนนี้ */
function effectiveEnd(b: Booking, now = Date.now()): number {
  const end = new Date(b.end).getTime()
  return b.status === 'in_progress' ? Math.max(end, now) : end
}

/** ตัดสิทธิ์ No-Show: ไม่มารับรถภายใน X นาทีหลังเวลาเริ่ม */
async function sweepNoShows(): Promise<void> {
  const { noShowMinutes } = await settingsService.get()
  const now = Date.now()
  const all = await db.list('bookings')
  const late = all.filter((b) => b.status === 'upcoming' && now > addMinutes(b.start, noShowMinutes).getTime())
  for (const b of late) await db.update('bookings', b.id, { status: 'no_show' })
}

async function findConflict(carId: string, start: Date, end: Date, excludeId?: string): Promise<Booking | undefined> {
  const { bufferMinutes } = await settingsService.get()
  const all = await db.list('bookings')
  const buf = bufferMinutes * 60_000
  return all.find(
    (b) =>
      b.carId === carId &&
      b.id !== excludeId &&
      ACTIVE_STATUSES.includes(b.status) &&
      overlaps(start.getTime(), end.getTime(), new Date(b.start).getTime() - buf, effectiveEnd(b) + buf),
  )
}

async function validate(input: BookingInput, excludeId?: string): Promise<void> {
  const start = new Date(input.start)
  const end = new Date(input.end)
  if (!input.purpose.trim()) throw new Error('กรุณาระบุวัตถุประสงค์การใช้รถ')
  if (end <= start) throw new Error('เวลาคืนรถต้องหลังเวลารับรถ')
  if (start.getTime() < Date.now() - 5 * 60_000) throw new Error('ไม่สามารถจองย้อนหลังได้')
  const car = await db.get('cars', input.carId)
  if (!car) throw new Error('ไม่พบรถคันนี้')
  if (car.status !== 'available') throw new Error('รถคันนี้ปิดซ่อมบำรุงอยู่ ไม่เปิดให้จอง')
  if (input.passengers > car.seats) throw new Error(`รถคันนี้รองรับได้ ${car.seats} ที่นั่ง`)
  const conflict = await findConflict(input.carId, start, end, excludeId)
  if (conflict) throw new Error('ช่วงเวลานี้ชนกับการจองอื่น กรุณาเลือกเวลาใหม่')
}

export const bookingService = {
  findConflict,

  async list(): Promise<Booking[]> {
    await sweepNoShows()
    const all = await db.list('bookings')
    return all.sort((a, b) => a.start.localeCompare(b.start))
  },

  async get(id: string): Promise<Booking | undefined> {
    await sweepNoShows()
    return db.get('bookings', id)
  },

  /** การจองที่เกี่ยวกับผู้ใช้ (เป็นคนจอง หรือเป็นผู้ขับขี่จริง) */
  async listForUser(userId: string): Promise<Booking[]> {
    const all = await bookingService.list()
    return all.filter((b) => b.bookedById === userId || b.driverId === userId)
  },

  /** ทริปถัดไป: กำลังใช้อยู่ก่อน แล้วค่อยเป็นคิวที่ใกล้ที่สุด */
  async nextTripFor(userId: string): Promise<Booking | undefined> {
    const mine = (await bookingService.listForUser(userId)).filter((b) => b.driverId === userId || b.bookedById === userId)
    return mine.find((b) => b.status === 'in_progress') ?? mine.find((b) => b.status === 'upcoming')
  },

  /** ช่วงที่ไม่ว่างของรถในวันที่เลือก (รวม Buffer) */
  async busyBlocks(carId: string, dateKey: string, excludeId?: string): Promise<BusyBlock[]> {
    const { bufferMinutes } = await settingsService.get()
    const buf = bufferMinutes * 60_000
    const dayStart = parseDateKey(dateKey).getTime()
    const dayEnd = dayStart + 86_400_000
    const all = await bookingService.list()
    return all
      .filter((b) => b.carId === carId && b.id !== excludeId && ACTIVE_STATUSES.includes(b.status))
      .map((b) => {
        const start = new Date(b.start).getTime()
        const end = effectiveEnd(b)
        return { bookingId: b.id, start, end, blockedStart: start - buf, blockedEnd: end + buf, status: b.status, driverId: b.driverId }
      })
      .filter((b) => overlaps(b.blockedStart, b.blockedEnd, dayStart, dayEnd))
  },

  async create(input: BookingInput): Promise<Booking> {
    await validate(input)
    const booking = await db.create('bookings', {
      ...input,
      purpose: input.purpose.trim(),
      id: newId('bk'),
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    })
    // อีเมลยืนยันการจองถึงผู้จอง (ส่งไม่สำเร็จไม่กระทบการจอง)
    await notifySafely(() => notificationService.bookingConfirmed(booking))
    return booking
  },

  async update(id: string, input: BookingInput): Promise<Booking> {
    const existing = await db.get('bookings', id)
    if (!existing) throw new Error('ไม่พบการจอง')
    if (existing.status !== 'upcoming') throw new Error('แก้ไขได้เฉพาะการจองที่ยังไม่เริ่มใช้รถ')
    await validate(input, id)
    return db.update('bookings', id, { ...input, purpose: input.purpose.trim() })
  },

  async cancel(id: string): Promise<Booking> {
    const existing = await db.get('bookings', id)
    if (existing?.status !== 'upcoming') throw new Error('ยกเลิกได้เฉพาะการจองที่ยังไม่เริ่มใช้รถ')
    return db.update('bookings', id, { status: 'cancelled' })
  },

  /** ขั้นที่ 1: เริ่มใช้รถ */
  async startTrip(id: string, input: StartTripInput): Promise<Booking> {
    const b = await db.get('bookings', id)
    if (!b || b.status !== 'upcoming') throw new Error('การจองนี้ไม่อยู่ในสถานะรอใช้รถ')
    const car = await db.get('cars', b.carId)
    if (!car) throw new Error('ไม่พบรถ')
    if (car.status !== 'available') throw new Error('รถคันนี้ถูกปิดซ่อมบำรุง กรุณาติดต่อแอดมิน')
    const earliest = addMinutes(b.start, -60).getTime()
    if (!config.testMode && Date.now() < earliest) throw new Error('เริ่มใช้รถได้ก่อนเวลาจองไม่เกิน 60 นาที')
    const inUse = (await db.list('bookings')).find((x) => x.carId === b.carId && x.status === 'in_progress')
    if (inUse) throw new Error('รถคันนี้ยังไม่ถูกคืนจากผู้ใช้ก่อนหน้า')
    if (!Number.isFinite(input.mileage) || input.mileage < car.mileage) {
      throw new Error(`เลขไมล์เริ่มต้นต้องไม่น้อยกว่าเลขไมล์ล่าสุด (${car.mileage.toLocaleString('th-TH')} กม.)`)
    }
    validateTripEvidence(input)
    return db.update('bookings', id, {
      status: 'in_progress',
      actualStart: new Date().toISOString(),
      startMileage: input.mileage,
      startGps: input.gps ?? null,
      startPhotos: input.photos,
      startOdometerPhoto: input.odometerPhoto ?? null,
      startIssue: cleanIssue(input.issue),
      extensions: [],
    })
  },

  /** ขั้นที่ 2: ขอขยายเวลาคืนรถ (อนุมัติอัตโนมัติถ้าไม่ชนคิวถัดไป) */
  async requestExtension(id: string, minutes: number): Promise<{ booking: Booking; approved: boolean }> {
    const b = await db.get('bookings', id)
    if (!b || b.status !== 'in_progress') throw new Error('ขยายเวลาได้เฉพาะทริปที่กำลังใช้งาน')
    const base = new Date(Math.max(new Date(b.end).getTime(), Date.now()))
    const newEnd = addMinutes(base, minutes)
    const conflict = await findConflict(b.carId, new Date(b.end), newEnd, b.id)
    const approved = !conflict
    const ext = {
      id: newId('ext'),
      requestedEnd: newEnd.toISOString(),
      requestedAt: new Date().toISOString(),
      status: approved ? ('approved' as const) : ('rejected' as const),
      reason: approved ? undefined : 'มีคิวจองถัดไป',
    }
    const booking = await db.update('bookings', id, {
      end: approved ? newEnd.toISOString() : b.end,
      extensions: [...(b.extensions ?? []), ext],
    })
    // อีเมลแจ้งอนุมัติขยายเวลาถึงผู้จอง
    if (approved) await notifySafely(() => notificationService.extensionApproved(booking, b.end))
    return { booking, approved }
  },

  /** ขั้นที่ 3: คืนรถ → อัปเดตเลขไมล์/จุดจอด/จุดกุญแจของรถ ส่งต่อคนถัดไป */
  async returnCar(id: string, input: ReturnCarInput): Promise<Booking> {
    const b = await db.get('bookings', id)
    if (!b || b.status !== 'in_progress') throw new Error('ทริปนี้ไม่ได้อยู่ระหว่างใช้งาน')
    const startMileage = b.startMileage ?? 0
    if (!Number.isFinite(input.mileage) || input.mileage < startMileage) {
      throw new Error(`เลขไมล์คืนรถต้องไม่น้อยกว่าเลขไมล์เริ่มต้น (${startMileage.toLocaleString('th-TH')} กม.)`)
    }
    if (!input.parkingSpot.trim() || !input.keyLocation.trim()) throw new Error('กรุณาระบุชั้น/เสาจอด และจุดคืนกุญแจ')
    if (input.fuelMethod !== 'none' && !(input.fuelAmount && input.fuelAmount > 0)) throw new Error('กรุณาระบุยอดเติมน้ำมัน')
    validateTripEvidence(input)

    const updated = await db.update('bookings', id, {
      status: 'completed',
      actualEnd: new Date().toISOString(),
      endMileage: input.mileage,
      returnParkingSpot: input.parkingSpot.trim(),
      returnKeyLocation: input.keyLocation.trim(),
      fuelMethod: input.fuelMethod,
      fuelAmount: input.fuelMethod === 'none' ? undefined : input.fuelAmount,
      fuelSlip: input.fuelMethod === 'none' ? null : (input.fuelSlip ?? null),
      endGps: input.gps ?? null,
      endPhotos: input.photos,
      endOdometerPhoto: input.odometerPhoto ?? null,
      endIssue: cleanIssue(input.issue),
    })
    await db.update('cars', b.carId, {
      mileage: input.mileage,
      parkingSpot: input.parkingSpot.trim(),
      keyLocation: input.keyLocation.trim(),
    })
    return updated
  },
}

export const distanceOf = (b: Booking) =>
  b.startMileage != null && b.endMileage != null ? Math.max(0, b.endMileage - b.startMileage) : null
