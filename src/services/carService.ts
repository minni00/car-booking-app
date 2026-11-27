import type { Car, CarStatus } from '../types'
import { db, newId } from './dataSource'

export type CarInput = Omit<Car, 'id'>

const normalizePlate = (p: string) => p.replace(/\s/g, '')

export const carService = {
  async list(): Promise<Car[]> {
    const cars = await db.list('cars')
    return cars.sort((a, b) => a.plate.localeCompare(b.plate, 'th'))
  },

  get: (id: string) => db.get('cars', id),

  async create(input: CarInput): Promise<Car> {
    if (!input.plate.trim()) throw new Error('กรุณากรอกทะเบียนรถ')
    const cars = await db.list('cars')
    if (cars.some((c) => normalizePlate(c.plate) === normalizePlate(input.plate))) throw new Error('ทะเบียนนี้มีในระบบแล้ว')
    return db.create('cars', { ...input, id: newId('car') })
  },

  async update(id: string, patch: Partial<CarInput>): Promise<Car> {
    if (patch.plate !== undefined) {
      const cars = await db.list('cars')
      if (cars.some((c) => c.id !== id && normalizePlate(c.plate) === normalizePlate(patch.plate ?? ''))) throw new Error('ทะเบียนนี้มีในระบบแล้ว')
    }
    return db.update('cars', id, patch)
  },

  /** ลบรถ — ไม่ให้ลบถ้ายังมีคิวรอใช้รถหรือกำลังใช้งาน (ประวัติการใช้รถ/ใบสั่งเดิมยังเก็บไว้) */
  async remove(id: string): Promise<void> {
    const bookings = await db.list('bookings')
    const active = bookings.filter((b) => b.carId === id && (b.status === 'upcoming' || b.status === 'in_progress'))
    if (active.length) throw new Error(`ลบไม่ได้: รถคันนี้ยังมีคิวจอง/กำลังใช้งาน ${active.length} รายการ กรุณายกเลิกหรือรอคืนรถก่อน`)
    await db.remove('cars', id)
  },

  setStatus: (id: string, status: CarStatus) => db.update('cars', id, { status }),
}

export const carName = (car: Pick<Car, 'brand' | 'model'>) => `${car.brand} ${car.model}`
