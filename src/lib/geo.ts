import type { GeoPoint } from '../types'

export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: `GPS ±${Math.round(pos.coords.accuracy)} ม.` }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง' : 'ดึงตำแหน่ง GPS ไม่สำเร็จ')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}
