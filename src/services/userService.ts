import type { Role, User } from '../types'
import { db, newId } from './dataSource'

export type UserInput = Pick<User, 'name' | 'email' | 'department' | 'phone' | 'role'>

export interface EntraProfile {
  oid: string
  email: string
  name: string
  department?: string
}

async function findByEmail(email: string): Promise<User | undefined> {
  const users = await db.list('users')
  return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
}

export const userService = {
  async list(): Promise<User[]> {
    const users = await db.list('users')
    return users.sort((a, b) => a.name.localeCompare(b.name, 'th'))
  },

  get: (id: string) => db.get('users', id),

  findByEmail,

  async create(input: UserInput): Promise<User> {
    if (!input.name.trim() || !input.email.trim()) throw new Error('กรุณากรอกชื่อและอีเมล')
    if (await findByEmail(input.email)) throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว')
    return db.create('users', { ...input, email: input.email.trim().toLowerCase(), id: newId('u'), createdAt: new Date().toISOString() })
  },

  async update(id: string, patch: Partial<UserInput>): Promise<User> {
    if (patch.email) {
      const dup = await findByEmail(patch.email)
      if (dup && dup.id !== id) throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว')
      patch = { ...patch, email: patch.email.trim().toLowerCase() }
    }
    if (patch.role === 'user') await ensureAnotherAdmin(id)
    return db.update('users', id, patch)
  },

  /**
   * ลบรายชื่อ — ห้ามลบตัวเอง ห้ามลบแอดมินคนสุดท้าย และห้ามลบถ้ายังมีคิวรอใช้รถ/กำลังใช้รถ
   * ลบอุปกรณ์ที่ล็อกอินของผู้ใช้นั้นด้วย (ประวัติการใช้รถเดิมยังเก็บไว้)
   */
  async remove(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) throw new Error('ลบบัญชีของตัวเองไม่ได้')
    const user = await db.get('users', id)
    if (!user) return
    if (user.role === 'admin') await ensureAnotherAdmin(id)
    const bookings = await db.list('bookings')
    const active = bookings.filter((b) => (b.driverId === id || b.bookedById === id) && (b.status === 'upcoming' || b.status === 'in_progress'))
    if (active.length) throw new Error(`ลบไม่ได้: ผู้ใช้นี้ยังมีคิวจอง/กำลังใช้รถ ${active.length} รายการ กรุณายกเลิกหรือรอคืนรถก่อน`)
    const devices = await db.list('devices')
    for (const d of devices.filter((x) => x.userId === id)) await db.remove('devices', d.id)
    await db.remove('users', id)
  },

  async setRole(id: string, role: Role): Promise<User> {
    if (role === 'user') await ensureAnotherAdmin(id)
    return db.update('users', id, { role })
  },

  /**
   * JIT Provisioning: พนักงานล็อกอิน Entra ID ครั้งแรก → สร้างแถวในตาราง users อัตโนมัติ (role: "user")
   * ถ้ามีอยู่แล้ว (จับคู่ด้วย oid หรืออีเมล) → อัปเดตเวลาล็อกอินล่าสุด
   */
  async provisionOnLogin(profile: EntraProfile): Promise<{ user: User; created: boolean }> {
    const now = new Date().toISOString()
    const users = await db.list('users')
    const existing =
      users.find((u) => u.entraOid && u.entraOid === profile.oid) ??
      users.find((u) => u.email.toLowerCase() === profile.email.toLowerCase())
    if (existing) {
      const user = await db.update('users', existing.id, { lastLoginAt: now, entraOid: existing.entraOid ?? profile.oid })
      return { user, created: false }
    }
    const user = await db.create('users', {
      id: newId('u'),
      entraOid: profile.oid,
      email: profile.email.toLowerCase(),
      name: profile.name,
      department: profile.department ?? 'ยังไม่ระบุแผนก',
      phone: '',
      role: 'user',
      createdAt: now,
      lastLoginAt: now,
    })
    return { user, created: true }
  },
}

async function ensureAnotherAdmin(id: string): Promise<void> {
  const target = await db.get('users', id)
  if (target?.role !== 'admin') return
  const admins = (await db.list('users')).filter((u) => u.role === 'admin')
  if (admins.length <= 1) throw new Error('ต้องมี Fleet Admin อย่างน้อย 1 คน')
}
