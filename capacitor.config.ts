import type { CapacitorConfig } from '@capacitor/cli'
import { existsSync, readFileSync } from 'node:fs'

/**
 * FleetGo — Android มี 2 โหมด (เลือกอัตโนมัติ)
 *
 * • โหมดทดสอบ (ยังไม่ได้ใส่ลิงก์เว็บ): แอปใช้ไฟล์เว็บที่แพ็กมาใน .apk + เก็บข้อมูลทดสอบในเครื่อง
 *   ใช้งานได้ทันทีไม่ต้องมีเซิร์ฟเวอร์ — แก้โค้ดแล้วต้อง build .apk ใหม่
 * • โหมด Auto-Update Web Shell (ใส่ลิงก์เว็บแล้ว): แอปโหลดหน้าเว็บจาก server.url ทุกครั้งที่เปิด
 *   deploy เว็บใหม่ = ผู้ใช้ได้เวอร์ชันใหม่ทันที ไม่ต้องติดตั้ง .apk ซ้ำ
 *
 * ตั้งลิงก์เว็บได้ 2 แบบ (เลือกอย่างใดอย่างหนึ่ง):
 *   1) ใส่ VITE_WEB_URL=https://... ใน .env.production (ใช้ร่วมกับหน้า Fallback ใน index.html)
 *   2) แก้ค่า WEB_URL_PLACEHOLDER ด้านล่างโดยตรง
 * หลังแก้ ให้รัน: npm run build && npx cap sync android
 */
const WEB_URL_PLACEHOLDER = 'https://ใส่ลิงก์เว็บ_HTTPS_ของคุณตรงนี้'

function readEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  for (const file of ['.env.production.local', '.env.production', '.env.local', '.env']) {
    if (!existsSync(file)) continue
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`))
    const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    if (value) return value
  }
  return undefined
}

const webUrl = readEnv('VITE_WEB_URL') ?? WEB_URL_PLACEHOLDER
/** ใส่ลิงก์ HTTPS จริงแล้วหรือยัง (ยังเป็นข้อความตัวอย่าง = โหมดทดสอบ) */
const useRemote = webUrl !== WEB_URL_PLACEHOLDER && /^https:\/\/[\w.-]+/.test(webUrl)

const config: CapacitorConfig = {
  appId: 'com.company.fleetgo',
  appName: 'FleetGo',
  webDir: 'dist',
  server: useRemote
    ? {
        url: webUrl,
        cleartext: false,
        androidScheme: 'https',
        // โหลดเว็บจากเซิร์ฟเวอร์ไม่สำเร็จ (ไม่มีอินเทอร์เน็ต/เซิร์ฟเวอร์ล่ม) → แสดงหน้า Fallback จากไฟล์ในเครื่อง (dist/index.html)
        errorPath: 'index.html',
      }
    : {
        // โหมดทดสอบ: เปิดไฟล์ใน .apk ที่ https://localhost
        cleartext: false,
        androidScheme: 'https',
      },
  plugins: {
    // ฉีดตัวแปร --safe-area-inset-* ให้ CSS (pt-safe / pb-safe) บน Android แบบ edge-to-edge
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
