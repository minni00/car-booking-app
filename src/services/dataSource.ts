import { config } from '../config'
import { createSeed, LEGACY_BRANCH_IDS, SEED_CAR_BRANCH, SEED_TRIP_DETAILS, SEED_CAR_PHOTOS, seedBranches, stockPhoto, type Seed } from '../data/mockData'
import { emitChange } from './events'

/**
 * ===========================================================
 *  DATA SOURCE — จุดสลับ MockData ↔ REST API (Azure) จุดเดียว
 * ===========================================================
 *  Service ทุกตัวเรียกผ่าน `db` เท่านั้น ไม่แตะ localStorage/fetch ตรง
 *  - VITE_DATA_SOURCE=mock → LocalDataSource (localStorage)
 *  - VITE_DATA_SOURCE=api  → HttpDataSource (REST: GET/POST/PATCH/DELETE /{collection})
 */

export type Collections = { [K in keyof Seed]: Seed[K][number] }
export type CollectionName = keyof Collections
type Row<K extends CollectionName> = Collections[K]

export interface DataSource {
  list<K extends CollectionName>(collection: K): Promise<Row<K>[]>
  get<K extends CollectionName>(collection: K, id: string): Promise<Row<K> | undefined>
  create<K extends CollectionName>(collection: K, item: Row<K>): Promise<Row<K>>
  update<K extends CollectionName>(collection: K, id: string, patch: Partial<Row<K>>): Promise<Row<K>>
  remove<K extends CollectionName>(collection: K, id: string): Promise<void>
}

// ---------------- Local (mock) ----------------
const STORAGE_KEY = 'fleetgo.db.v1'
const MIGRATION_KEY = 'fleetgo.migrations'

/**
 * Migration ของข้อมูลทดลองที่บันทึกในเครื่องอยู่แล้ว (ไม่ต้องรีเซ็ตข้อมูล)
 * - branches-v1: เพิ่มตารางสาขา และกำหนดสาขาให้รถชุดเริ่มต้น (รถที่เพิ่มเองยังไม่ระบุสาขา)
 * - branches-v2: เปลี่ยนเป็นสาขาจริงขององค์กร 7 สาขา ลบสาขาตัวอย่างเดิม และย้ายรถของสาขาที่ลบไปตามค่าเริ่มต้น
 * - trip-details-v1: เติมตำแหน่ง/รูป/การแจ้งปัญหาให้ทริปตัวอย่างที่คืนรถแล้ว (เฉพาะทริปที่ยังไม่มีข้อมูลตำแหน่ง)
 * - car-photos-v1: ใส่รูปรถตัวอย่างให้รถชุดเริ่มต้นที่ยังไม่มีรูป และปรับสีให้ตรงรูป (ถ้ายังเป็นค่าเดิม)
 */
const MIGRATIONS = ['car-photos-v1', 'no-buffer-v1', 'branches-v1', 'branches-v2', 'trip-details-v1']

function migrationsDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MIGRATION_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** ข้อมูลชุดใหม่จาก createSeed() เป็นเวอร์ชันล่าสุดอยู่แล้ว → ทำเครื่องหมายว่าผ่านทุก migration */
function markAllMigrated(): void {
  localStorage.setItem(MIGRATION_KEY, JSON.stringify(MIGRATIONS))
}

function migrate(db: Seed): boolean {
  const done = migrationsDone()
  let changed = false
  if (!done.includes('car-photos-v1')) {
    for (const car of db.cars) {
      const p = SEED_CAR_PHOTOS[car.id]
      if (!p) continue
      if (!car.image) car.image = stockPhoto(p.file)
      if (car.color === p.oldColor) car.color = p.color
    }
    done.push('car-photos-v1')
    changed = true
  }
  if (!done.includes('no-buffer-v1')) {
    for (const s of db.settings) s.bufferMinutes = 0
    done.push('no-buffer-v1')
    changed = true
  }
  if (!done.includes('branches-v1')) {
    if (!db.branches?.length) db.branches = seedBranches(new Date().toISOString())
    for (const car of db.cars) if (car.branchId === undefined) car.branchId = SEED_CAR_BRANCH[car.id] ?? null
    done.push('branches-v1')
    changed = true
  }
  if (!done.includes('branches-v2')) {
    const now = new Date().toISOString()
    const norm = (s: string) => s.trim().toLowerCase()
    const legacy = new Set(LEGACY_BRANCH_IDS)
    db.branches = (db.branches ?? []).filter((b) => !legacy.has(b.id))
    for (const s of seedBranches(now)) {
      const i = db.branches.findIndex((b) => b.id === s.id)
      if (i >= 0) db.branches[i] = { ...db.branches[i], code: s.code, name: s.name, address: db.branches[i].address && s.id !== 'br-hq' ? db.branches[i].address : s.address, phone: s.id === 'br-hq' ? '' : db.branches[i].phone }
      // ข้ามถ้าแอดมินเพิ่มสาขาชื่อ/รหัสเดียวกันไว้เองแล้ว
      else if (!db.branches.some((b) => norm(b.code) === norm(s.code) || norm(b.name) === norm(s.name))) db.branches.push(s)
    }
    const ids = new Set(db.branches.map((b) => b.id))
    for (const car of db.cars) if (car.branchId && !ids.has(car.branchId)) car.branchId = SEED_CAR_BRANCH[car.id] ?? null
    done.push('branches-v2')
    changed = true
  }
  if (!done.includes('trip-details-v1')) {
    for (const b of db.bookings) {
      const extra = SEED_TRIP_DETAILS[b.id]
      if (extra && b.status === 'completed' && !b.startGps && !b.endGps) Object.assign(b, extra)
    }
    done.push('trip-details-v1')
    changed = true
  }
  if (changed) localStorage.setItem(MIGRATION_KEY, JSON.stringify(done))
  return changed
}

function createLocalDataSource(): DataSource {
  let cache: Seed | null = null

  const load = (): Seed => {
    if (cache) return cache
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) cache = JSON.parse(raw) as Seed
    } catch {
      cache = null
    }
    if (!cache) {
      cache = createSeed()
      markAllMigrated()
      persist()
    } else if (migrate(cache)) {
      persist()
    }
    return cache
  }

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch (err) {
      // ย้อนข้อมูลในหน่วยความจำกลับเป็นค่าที่บันทึกล่าสุด เพื่อไม่ให้หน้าจอแสดงข้อมูลที่ไม่ได้ถูกบันทึกจริง
      cache = null
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        throw new Error('พื้นที่เก็บข้อมูลในเครื่องเต็ม (รูป/ไฟล์แนบมากเกินไป) กรุณารีเซ็ตข้อมูลทดสอบในหน้าโปรไฟล์')
      }
      throw new Error('บันทึกข้อมูลในเครื่องไม่สำเร็จ')
    }
  }

  const table = <K extends CollectionName>(c: K) => load()[c] as Row<K>[]
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))
  const clone = <T,>(v: T): T => structuredClone(v)

  return {
    async list(c) {
      await tick()
      return clone(table(c))
    },
    async get(c, id) {
      await tick()
      const row = table(c).find((r) => r.id === id)
      return row ? clone(row) : undefined
    },
    async create(c, item) {
      await tick()
      table(c).push(clone(item))
      persist()
      emitChange(c)
      return clone(item)
    },
    async update(c, id, patch) {
      await tick()
      const rows = table(c)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx < 0) throw new Error(`ไม่พบข้อมูล ${c}/${id}`)
      const prev = rows[idx]
      rows[idx] = { ...prev, ...clone(patch) }
      try {
        persist()
      } catch (err) {
        rows[idx] = prev
        throw err
      }
      emitChange(c)
      return clone(rows[idx])
    },
    async remove(c, id) {
      await tick()
      const rows = table(c)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx >= 0) rows.splice(idx, 1)
      persist()
      emitChange(c)
    },
  }
}

// ---------------- HTTP (REST / Azure) ----------------
let tokenProvider: () => Promise<string | null> = async () => null

/** authService ตั้งค่าให้ส่ง Bearer token (Entra access token) ไปกับทุก request */
/** token ปัจจุบัน (ใช้กับ API อื่นนอกจากตารางข้อมูล เช่น ส่งอีเมล) */
export const getAuthToken = () => tokenProvider()

export function setTokenProvider(fn: () => Promise<string | null>): void {
  tokenProvider = fn
}

function createHttpDataSource(baseUrl: string): DataSource {
  const request = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await tokenProvider()
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  return {
    list: (c) => request(`/${c}`),
    async get(c, id) {
      try {
        return await request(`/${c}/${encodeURIComponent(id)}`)
      } catch {
        return undefined
      }
    },
    async create(c, item) {
      const row = await request<Row<typeof c>>(`/${c}`, { method: 'POST', body: JSON.stringify(item) })
      emitChange(c)
      return row
    },
    async update(c, id, patch) {
      const row = await request<Row<typeof c>>(`/${c}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
      emitChange(c)
      return row
    },
    async remove(c, id) {
      await request<void>(`/${c}/${encodeURIComponent(id)}`, { method: 'DELETE' })
      emitChange(c)
    },
  }
}

export const db: DataSource =
  config.dataSource === 'api' ? createHttpDataSource(config.apiBaseUrl) : createLocalDataSource()

/** รีเซ็ตข้อมูลทดลอง (เฉพาะโหมด mock) — ลบรถ การจอง ทริป ใบสั่ง ผู้ใช้ และไฟล์แนบ แล้วสร้างชุดเริ่มต้นใหม่ */
export function resetMockData(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(MIGRATION_KEY)
  localStorage.removeItem('fleetgo.outbox')
  location.reload()
}

/** ขนาดข้อมูลทดสอบที่บันทึกในเครื่อง (ไบต์, UTF-16) — localStorage ส่วนใหญ่จำกัดราว 5 MB */
export function localDataSize(): number {
  try {
    return (localStorage.getItem(STORAGE_KEY)?.length ?? 0) * 2
  } catch {
    return 0
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}
