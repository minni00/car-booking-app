import type { Branch, Car } from '../types'
import { db, newId } from './dataSource'

export type BranchInput = Omit<Branch, 'id' | 'createdAt'>

const norm = (s: string) => s.trim().toLowerCase()

async function validate(input: BranchInput, id?: string): Promise<void> {
  if (!input.name.trim()) throw new Error('กรุณากรอกชื่อสาขา')
  if (!input.code.trim()) throw new Error('กรุณากรอกรหัสสาขา')
  const branches = await db.list('branches')
  const others = branches.filter((b) => b.id !== id)
  if (others.some((b) => norm(b.code) === norm(input.code))) throw new Error('รหัสสาขานี้มีในระบบแล้ว')
  if (others.some((b) => norm(b.name) === norm(input.name))) throw new Error('ชื่อสาขานี้มีในระบบแล้ว')
}

const clean = (input: BranchInput): BranchInput => ({ code: input.code.trim().toUpperCase(), name: input.name.trim(), address: input.address.trim(), phone: input.phone.trim() })

export const branchService = {
  async list(): Promise<Branch[]> {
    const rows = await db.list('branches')
    // สำนักงานใหญ่ก่อน แล้วตามลำดับที่เพิ่ม
    return rows.map((b, i) => ({ b, i })).sort((x, y) => Number(y.b.code === 'HQ') - Number(x.b.code === 'HQ') || x.b.createdAt.localeCompare(y.b.createdAt) || x.i - y.i).map((x) => x.b)
  },

  async create(input: BranchInput): Promise<Branch> {
    await validate(input)
    return db.create('branches', { ...clean(input), id: newId('br'), createdAt: new Date().toISOString() })
  },

  async update(id: string, input: BranchInput): Promise<Branch> {
    await validate(input, id)
    return db.update('branches', id, clean(input))
  },

  /** ลบสาขา — ไม่ให้ลบถ้ายังมีรถสังกัดอยู่ */
  async remove(id: string): Promise<void> {
    const cars = await db.list('cars')
    const n = cars.filter((c) => c.branchId === id).length
    if (n) throw new Error(`ลบไม่ได้: ยังมีรถสังกัดสาขานี้ ${n} คัน กรุณาย้ายรถไปสาขาอื่นก่อน`)
    await db.remove('branches', id)
  },
}

export const branchLabel = (branches: Branch[], car: Pick<Car, 'branchId'>) => branches.find((b) => b.id === car.branchId)?.name ?? 'ไม่ระบุสาขา'
