import { config } from '../config'
import { fmtDateShort, fmtTime } from '../lib/date'
import type { Booking, Car, User } from '../types'
import { db, getAuthToken, newId } from './dataSource'
import { emitChange } from './events'

/**
 * แจ้งเตือนทางอีเมล
 * - โหมด mock: สร้างอีเมลจริง (หัวเรื่อง/เนื้อหา/ผู้รับ) แล้วเก็บใน "กล่องอีเมลทดสอบ" ในเครื่อง (ยังไม่ส่งออกจริง)
 * - โหมด api : POST {apiBaseUrl}/notifications/email → เซิร์ฟเวอร์ส่งจริง (เช่น Azure Communication Services / Microsoft Graph)
 * การส่งไม่สำเร็จจะไม่ทำให้การจอง/ขยายเวลาล้มเหลว
 */

export type EmailKind = 'booking_confirmed' | 'extension_approved'

export interface EmailMessage {
  id: string
  kind: EmailKind
  bookingId: string
  to: string[]
  cc: string[]
  subject: string
  text: string
  html: string
  /** sent = เซิร์ฟเวอร์รับส่งแล้ว, test = โหมดทดสอบ (เก็บในเครื่อง), failed = ส่งไม่สำเร็จ */
  status: 'sent' | 'test' | 'failed'
  error?: string
  createdAt: string
}

const OUTBOX_KEY = 'fleetgo.outbox'
const OUTBOX_LIMIT = 50

function readOutbox(): EmailMessage[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as EmailMessage[]
  } catch {
    return []
  }
}

function saveOutbox(msg: EmailMessage): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([msg, ...readOutbox()].slice(0, OUTBOX_LIMIT)))
  } catch {
    // พื้นที่เต็ม — ข้ามการเก็บประวัติ ไม่กระทบการจอง
  }
  emitChange('outbox')
}

async function deliver(draft: Omit<EmailMessage, 'id' | 'status' | 'createdAt'>): Promise<EmailMessage> {
  const msg: EmailMessage = { ...draft, id: newId('mail'), status: 'test', createdAt: new Date().toISOString() }
  if (config.dataSource === 'api') {
    try {
      const token = await getAuthToken()
      const res = await fetch(`${config.apiBaseUrl}/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to: msg.to, cc: msg.cc, subject: msg.subject, text: msg.text, html: msg.html, kind: msg.kind, bookingId: msg.bookingId }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      msg.status = 'sent'
    } catch (err) {
      msg.status = 'failed'
      msg.error = err instanceof Error ? err.message : String(err)
    }
  }
  saveOutbox(msg)
  return msg
}

// ---------- เนื้อหาอีเมล ----------
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c])
const tripUrl = (id: string) => `${config.webUrl || location.origin}/trip/${id}`
const range = (b: Booking) => `${fmtDateShort(b.start)} · ${fmtTime(b.start)}–${fmtTime(b.end)} น.`

function render(opts: { heading: string; intro: string; rows: Array<[string, string]>; note?: string; bookingId: string }): { html: string; text: string } {
  const td = 'padding:10px 0;border-bottom:1px solid #e2e7ee;font-size:14px;vertical-align:top'
  const rows = opts.rows.map(([k, v]) => `<tr><td style="${td};color:#5b6678;width:38%">${esc(k)}</td><td style="${td};color:#0b1f3a;font-weight:600">${esc(v)}</td></tr>`).join('')
  const html = `<!doctype html><html lang="th"><body style="margin:0;padding:0;background:#f3f5f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e7ee;border-radius:12px;font-family:'IBM Plex Sans Thai',Tahoma,Arial,sans-serif">
<tr><td style="background:#003d7c;border-radius:12px 12px 0 0;padding:18px 24px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#fad407;vertical-align:middle"></span><span style="color:#ffffff;font-size:17px;font-weight:700;vertical-align:middle;margin-left:8px">FleetGo MCS</span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0;color:#0b1f3a;font-size:20px;line-height:1.4">${esc(opts.heading)}</h1>
<p style="margin:8px 0 16px;color:#5b6678;font-size:14px;line-height:1.6">${esc(opts.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e7ee">${rows}</table>
${opts.note ? `<p style="margin:16px 0 0;color:#5b6678;font-size:13px;line-height:1.6">${esc(opts.note)}</p>` : ''}
<p style="margin:24px 0 0"><a href="${esc(tripUrl(opts.bookingId))}" style="display:inline-block;background:#003d7c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:10px">ดูรายละเอียดการจอง</a></p>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e2e7ee;color:#8a94a6;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบจองรถองค์กร FleetGo MCS · เลขที่จอง ${esc(opts.bookingId.toUpperCase())}</td></tr>
</table></td></tr></table></body></html>`
  const text = [opts.heading, '', opts.intro, '', ...opts.rows.map(([k, v]) => `${k}: ${v}`), ...(opts.note ? ['', opts.note] : []), '', `ดูรายละเอียด: ${tripUrl(opts.bookingId)}`].join('\n')
  return { html, text }
}

async function context(b: Booking): Promise<{ car?: Car; booker?: User; driver?: User }> {
  const [car, booker, driver] = await Promise.all([db.get('cars', b.carId), db.get('users', b.bookedById), db.get('users', b.driverId)])
  return { car, booker, driver }
}

/** ผู้รับ: ผู้จอง (to) + ผู้ขับขี่ถ้าเป็นคนละคน (cc) */
function recipients(booker?: User, driver?: User): { to: string[]; cc: string[] } | null {
  const to = booker?.email ? [booker.email] : []
  const cc = driver?.email && driver.email !== booker?.email ? [driver.email] : []
  if (!to.length && !cc.length) return null
  return to.length ? { to, cc } : { to: cc, cc: [] }
}

const carLabel = (car?: Car) => (car ? `${car.brand} ${car.model} · ${car.plate}` : '-')

export const notificationService = {
  /** ยืนยันการจองรถ → ส่งถึงผู้จอง (สำเนาถึงผู้ขับขี่ถ้าจองแทน) */
  async bookingConfirmed(b: Booking): Promise<EmailMessage | null> {
    const { car, booker, driver } = await context(b)
    const r = recipients(booker, driver)
    if (!r) return null
    const { html, text } = render({
      heading: 'ยืนยันการจองรถเรียบร้อย',
      intro: `เรียน คุณ${booker?.name ?? ''} ระบบได้รับการจองรถของคุณแล้ว รายละเอียดดังนี้`,
      rows: [
        ['เลขที่จอง', b.id.toUpperCase()],
        ['รถ', carLabel(car)],
        ['วันเวลา', range(b)],
        ['ผู้ขับขี่', driver?.name ?? '-'],
        ['วัตถุประสงค์', b.purpose],
        ['จุดจอดรถ', car?.parkingSpot ?? '-'],
        ['จุดรับกุญแจ', car?.keyLocation ?? '-'],
      ],
      note: 'กรุณาเริ่มใช้รถตามเวลาที่จอง หากไม่เริ่มใช้รถภายในเวลาที่กำหนด ระบบจะตัดสิทธิ์และปล่อยคิวอัตโนมัติ',
      bookingId: b.id,
    })
    return deliver({ kind: 'booking_confirmed', bookingId: b.id, ...r, subject: `[FleetGo MCS] ยืนยันการจองรถ ${car?.plate ?? ''} · ${range(b)}`, html, text })
  },

  /** อนุมัติขยายเวลาคืนรถ → ส่งถึงผู้จอง */
  async extensionApproved(b: Booking, previousEnd: string): Promise<EmailMessage | null> {
    const { car, booker, driver } = await context(b)
    const r = recipients(booker, driver)
    if (!r) return null
    const { html, text } = render({
      heading: 'อนุมัติขยายเวลาคืนรถแล้ว',
      intro: `เรียน คุณ${booker?.name ?? ''} คำขอขยายเวลาคืนรถได้รับการอนุมัติแล้ว`,
      rows: [
        ['เลขที่จอง', b.id.toUpperCase()],
        ['รถ', carLabel(car)],
        ['เวลาคืนเดิม', `${fmtTime(previousEnd)} น.`],
        ['เวลาคืนใหม่', `${fmtDateShort(b.end)} · ${fmtTime(b.end)} น.`],
        ['ผู้ขับขี่', driver?.name ?? '-'],
      ],
      note: 'กรุณาคืนรถภายในเวลาใหม่ และระบุจุดจอด/จุดคืนกุญแจให้ครบตอนคืนรถ',
      bookingId: b.id,
    })
    return deliver({ kind: 'extension_approved', bookingId: b.id, ...r, subject: `[FleetGo MCS] อนุมัติขยายเวลาคืนรถ ${car?.plate ?? ''} ถึง ${fmtTime(b.end)} น.`, html, text })
  },

  /** อีเมลที่ส่งถึงผู้ใช้ (ล่าสุดก่อน) */
  async inbox(email: string): Promise<EmailMessage[]> {
    const e = email.toLowerCase()
    return readOutbox().filter((m) => [...m.to, ...m.cc].some((x) => x.toLowerCase() === e))
  },

  /** อีเมลล่าสุดของการจองนี้ (ใช้แสดง "ส่งอีเมลแล้ว") */
  async latestFor(bookingId: string, kind: EmailKind): Promise<EmailMessage | undefined> {
    return readOutbox().find((m) => m.bookingId === bookingId && m.kind === kind)
  },
}

/** ส่งแจ้งเตือนแบบไม่ให้ล้มงานหลัก */
export async function notifySafely(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    console.warn('ส่งอีเมลแจ้งเตือนไม่สำเร็จ', err)
  }
}
