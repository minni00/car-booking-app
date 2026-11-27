import type { Settings } from '../types'
import { db } from './dataSource'

const DEFAULTS: Settings = { id: 'global', bufferMinutes: 0, noShowMinutes: 30, dayStartHour: 7, dayEndHour: 21, serviceIntervalKm: 10000 }

/** ช่วงค่าที่แอดมินพิมพ์เองได้ (นาที) */
export const SETTING_LIMITS = {
  buffer: { min: 0, max: 240 },
  noShow: { min: 5, max: 240 },
} as const

export const settingsService = {
  async get(): Promise<Settings> {
    return (await db.get('settings', 'global')) ?? DEFAULTS
  },
  async update(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
    const check = (v: number | undefined, label: string, min: number, max: number) => {
      if (v === undefined) return
      if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${label}ต้องเป็นจำนวนเต็ม ${min}–${max} นาที`)
    }
    check(patch.bufferMinutes, 'Buffer Time ', SETTING_LIMITS.buffer.min, SETTING_LIMITS.buffer.max)
    check(patch.noShowMinutes, 'เวลาตัดสิทธิ์ No-Show ', SETTING_LIMITS.noShow.min, SETTING_LIMITS.noShow.max)
    const existing = await db.get('settings', 'global')
    if (!existing) return db.create('settings', { ...DEFAULTS, ...patch })
    return db.update('settings', 'global', patch)
  },
}
