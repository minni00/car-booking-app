const env = import.meta.env

const isPlaceholder = (v?: string) => !v || /^0{8}-/.test(v)

export const config = {
  /** จุดสลับแหล่งข้อมูลจุดเดียว: 'mock' (localStorage) หรือ 'api' (REST) */
  dataSource: env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock',
  apiBaseUrl: env.VITE_API_BASE_URL ?? '',
  /** ลิงก์เว็บจริง (ใช้ในลิงก์ของอีเมล) — ไม่ตั้ง = ใช้โดเมนที่เปิดอยู่ */
  webUrl: ((env.VITE_WEB_URL as string | undefined) ?? '').replace(/\/$/, ''),
  entra: {
    clientId: env.VITE_ENTRA_CLIENT_ID ?? '',
    tenantId: env.VITE_ENTRA_TENANT_ID ?? '',
    enabled: !isPlaceholder(env.VITE_ENTRA_CLIENT_ID) && !isPlaceholder(env.VITE_ENTRA_TENANT_ID),
  },
  /** โหมดทดสอบ: ไม่บังคับแนบรูปก่อน/หลังใช้รถ */
  testMode: true,
} as const
