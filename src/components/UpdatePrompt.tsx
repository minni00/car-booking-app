import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { isNativeApp } from '../lib/platform'

let updateSW: ((reload?: boolean) => Promise<void>) | null = null
let listeners: Array<() => void> = []
let needRefresh = false

/** ลงทะเบียน service worker ครั้งเดียว (เฉพาะเว็บ/PWA — แอป Android ใช้ไฟล์ในแอปหรือโหลดจากเซิร์ฟเวอร์เอง) */
function ensureRegistered(): void {
  if (updateSW || isNativeApp() || !('serviceWorker' in navigator)) return
  updateSW = registerSW({
    onNeedRefresh() {
      needRefresh = true
      listeners.forEach((l) => l())
    },
    onRegisteredSW(_url, reg) {
      // เช็กเวอร์ชันใหม่ทุก 1 ชั่วโมง สำหรับคนที่เปิดแอปค้างไว้ทั้งวัน
      if (reg) setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000)
    },
  })
}

/**
 * แถบแจ้ง "มีเวอร์ชันใหม่" — ไม่รีโหลดเองอัตโนมัติ เพื่อไม่ให้ข้อมูลที่กำลังกรอก (เช่น ขั้นตอนคืนรถ) หาย
 * ผู้ใช้กด "อัปเดต" เมื่อพร้อม หรือปิดแอปแล้วเปิดใหม่ก็จะได้เวอร์ชันใหม่เอง
 */
export function UpdatePrompt() {
  const [show, setShow] = useState(needRefresh)

  useEffect(() => {
    ensureRegistered()
    const l = () => setShow(true)
    listeners.push(l)
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])

  if (!show) return null
  return (
    <div role="status" className="fixed inset-x-0 top-[calc(max(env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px))+0.75rem)] z-[55] flex justify-center px-4 md:top-auto md:bottom-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-sm text-white">
        <RefreshCw className="size-4 shrink-0 text-sun" strokeWidth={2} />
        <span className="min-w-0 flex-1 leading-snug">FleetGo มีเวอร์ชันใหม่</span>
        <button type="button" onClick={() => setShow(false)} className="shrink-0 rounded-md px-2.5 py-1.5 text-white/70 transition-colors hover:text-white">
          ภายหลัง
        </button>
        <button type="button" onClick={() => void updateSW?.(true)} className="shrink-0 rounded-md bg-sun px-3 py-1.5 font-semibold text-ink transition-colors hover:bg-sun/90">
          อัปเดต
        </button>
      </div>
    </div>
  )
}
