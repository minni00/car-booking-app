import { config } from '../config'
import { createSeed, SEED_CAR_PHOTOS, stockPhoto, type Seed } from '../data/mockData'
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
 * - car-photos-v1: ใส่รูปรถตัวอย่างให้รถชุดเริ่มต้นที่ยังไม่มีรูป และปรับสีให้ตรงรูป (ถ้ายังเป็นค่าเดิม)
 */
const MIGRATIONS = ['car-photos-v1', 'no-buffer-v1']

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
