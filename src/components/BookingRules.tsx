import type { Settings } from '../types'

/** กติกาการใช้รถ (ค่าตัวเลขมาจากหน้าตั้งค่าของแอดมิน) */
export function BookingRules({ settings }: { settings: Settings }) {
  const rules = [
    { title: `No-Show ภายใน ${settings.noShowMinutes} นาที`, text: `ไม่เริ่มใช้รถภายใน ${settings.noShowMinutes} นาทีหลังเวลาจอง ระบบจะตัดสิทธิ์และปล่อยคิวให้ผู้อื่นอัตโนมัติ` },
    settings.bufferMinutes > 0
      ? { title: `Buffer Time ${settings.bufferMinutes} นาที`, text: 'ระบบกันเวลาก่อน-หลังแต่ละคิวไว้สำหรับส่งมอบรถ คืนรถให้ตรงเวลา หากล่าช้าให้กดขอขยายเวลา' }
      : { title: 'คืนรถให้ตรงเวลา', text: 'คิวถัดไปเริ่มต่อได้ทันทีหลังเวลาคืนรถ หากล่าช้าให้กดขอขยายเวลา' },
    { title: 'น้ำมันคืนอย่างน้อยครึ่งถัง', text: 'ถ้าเหลือไม่ถึงครึ่งถัง ให้เติมด้วยบัตรบริษัท หรือสำรองจ่ายแล้วแนบสลิปตอนคืนรถ' },
    { title: 'ความรับผิดชอบใบสั่ง', text: 'ใบสั่งที่เกิดในช่วงเวลาใช้รถจริง ระบบจับคู่กับผู้ขับขี่อัตโนมัติ และผู้ขับขี่เป็นผู้รับผิดชอบ' },
  ]
  return (
    <ol className="divide-y divide-line">
      {rules.map((r, i) => (
        <li key={r.title} className="grid grid-cols-[2rem_1fr] gap-2 py-3 first:pt-0 last:pb-0">
          <span className="num pt-px text-[13px] text-muted">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{r.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
