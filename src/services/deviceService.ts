import type { Device } from '../types'
import { db, newId } from './dataSource'

const DEVICE_KEY = 'fleetgo.deviceId'

function describe(): { name: string; platform: string } {
  const ua = navigator.userAgent
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows PC'
            : 'อุปกรณ์อื่น'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return { name: os, platform: `${os} · ${browser}` }
}

export const deviceService = {
  currentId(): string {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = newId('dev')
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  },

  async register(userId: string): Promise<Device> {
    const id = deviceService.currentId()
    const now = new Date().toISOString()
    const existing = await db.get('devices', id)
    if (existing) return db.update('devices', id, { userId, lastActiveAt: now })
    return db.create('devices', { id, userId, ...describe(), lastActiveAt: now, createdAt: now })
  },

  async listByUser(userId: string): Promise<Device[]> {
    const devices = await db.list('devices')
    return devices.filter((d) => d.userId === userId).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  },

  async isActive(deviceId: string, userId: string): Promise<boolean> {
    const d = await db.get('devices', deviceId)
    return !!d && d.userId === userId
  },

  /** สั่งออกจากระบบระยะไกล: ลบ session ของอุปกรณ์นั้น */
  revoke: (deviceId: string) => db.remove('devices', deviceId),
}
