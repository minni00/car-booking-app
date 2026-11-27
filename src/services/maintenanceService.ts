import { daysUntil } from '../lib/date'
import type { Car, MaintenanceRecord, MaintenanceType, Settings } from '../types'
import { db, newId } from './dataSource'

export type MaintenanceInput = Omit<MaintenanceRecord, 'id' | 'createdAt'>

export const MAINTENANCE_TYPE_LABEL: Record<MaintenanceType, string> = {
  service: 'เช็กระยะ',
  repair: 'ซ่อม',
  tyre: 'ยาง/ช่วงล่าง',
  act: 'ต่อ พ.ร.บ.',
  insurance: 'ต่อประกันภัย',
  other: 'อื่น ๆ',
}

export interface MaintenanceAlert {
  carId: string
  kind: 'service' | 'act' | 'insurance'
  level: 'overdue' | 'soon'
  title: string
  detail: string
}

/** ผลข้างเคียงต่อข้อมูลรถ เมื่อบันทึกเช็กระยะ / ต่อ พ.ร.บ. / ต่อประกัน */
async function applyToCar(input: MaintenanceInput): Promise<void> {
  const car = await db.get('cars', input.carId)
  if (!car) return
  if (input.type === 'service' && input.mileage > car.lastServiceMileage) {
    await db.update('cars', car.id, { lastServiceMileage: input.mileage, mileage: Math.max(car.mileage, input.mileage) })
  }
  if (input.type === 'act' && input.nextDueDate) {
    await db.update('cars', car.id, { actExpiry: input.nextDueDate })
  }
  if (input.type === 'insurance' && input.nextDueDate) {
    await db.update('cars', car.id, { insurance: { ...car.insurance, expiry: input.nextDueDate } })
  }
}

function validate(input: MaintenanceInput) {
  if (!input.carId) throw new Error('กรุณาเลือกรถ')
  if (!input.description.trim()) throw new Error('กรุณาระบุรายละเอียด')
  if (!(input.cost >= 0)) throw new Error('ค่าใช้จ่ายไม่ถูกต้อง')
  if ((input.type === 'act' || input.type === 'insurance') && !input.nextDueDate) throw new Error('กรุณาระบุวันหมดอายุใหม่')
}

export const maintenanceService = {
  async list(): Promise<MaintenanceRecord[]> {
    const all = await db.list('maintenance')
    return all.sort((a, b) => b.date.localeCompare(a.date))
  },

  async create(input: MaintenanceInput): Promise<MaintenanceRecord> {
    validate(input)
    const rec = await db.create('maintenance', { ...input, id: newId('mt'), createdAt: new Date().toISOString() })
    await applyToCar(input)
    return rec
  },

  async update(id: string, input: MaintenanceInput): Promise<MaintenanceRecord> {
    validate(input)
    const rec = await db.update('maintenance', id, input)
    await applyToCar(input)
    return rec
  },

  /** ลบรายการซ่อม (ไม่ย้อนค่าเลขไมล์เช็กระยะ/วันหมดอายุที่บันทึกในรถไปแล้ว) */
  remove: (id: string) => db.remove('maintenance', id),

  /** เตือนเช็กระยะทุก N กม. และ พ.ร.บ./ประกันล่วงหน้า 30 วัน */
  alerts(cars: Car[], settings: Settings): MaintenanceAlert[] {
    const out: MaintenanceAlert[] = []
    const interval = settings.serviceIntervalKm
    for (const car of cars) {
      const since = car.mileage - car.lastServiceMileage
      const nextAt = car.lastServiceMileage + interval
      if (since >= interval) {
        out.push({ carId: car.id, kind: 'service', level: 'overdue', title: 'เลยกำหนดเช็กระยะ', detail: `ครบ ${nextAt.toLocaleString('th-TH')} กม. แล้ว (เกินมา ${(since - interval).toLocaleString('th-TH')} กม.)` })
      } else if (since >= interval - 1000) {
        out.push({ carId: car.id, kind: 'service', level: 'soon', title: 'ใกล้ถึงระยะเช็ก', detail: `อีก ${(nextAt - car.mileage).toLocaleString('th-TH')} กม. (ที่ ${nextAt.toLocaleString('th-TH')} กม.)` })
      }
      const docs: Array<[MaintenanceAlert['kind'], string, string]> = [
        ['act', 'พ.ร.บ.', car.actExpiry],
        ['insurance', 'ประกันภัย', car.insurance.expiry],
      ]
      for (const [kind, label, expiry] of docs) {
        if (!expiry) continue
        const d = daysUntil(expiry)
        if (d < 0) out.push({ carId: car.id, kind, level: 'overdue', title: `${label}หมดอายุแล้ว`, detail: `หมดอายุมาแล้ว ${Math.abs(d)} วัน` })
        else if (d <= 30) out.push({ carId: car.id, kind, level: 'soon', title: `${label}ใกล้หมดอายุ`, detail: `อีก ${d} วัน` })
      }
    }
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'overdue' ? -1 : 1))
  },
}
