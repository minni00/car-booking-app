import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { parseDateKey } from '../../lib/date'
import { cn, fmtBaht } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'
import { Link } from '../../router'
import { bookingService } from '../../services/bookingService'
import { carService } from '../../services/carService'
import { maintenanceService } from '../../services/maintenanceService'
import { settingsService } from '../../services/settingsService'
import { ticketService } from '../../services/ticketService'
import type { Booking } from '../../types'
import { useBranchScope } from './branchScope'

/** ใช้งานต่ำกว่านี้ (% ของเวลาทำการ) = รถใช้น้อย ควรพิจารณา */
const LOW_UTILIZATION = 20
const HOUR = 3_600_000

/** จำนวนวันทำการ (จ.–ศ.) ในช่วง [from, to) */
function weekdays(fromMs: number, toMs: number): number {
  let n = 0
  for (let t = fromMs; t < toMs; t += 86_400_000) {
    const d = new Date(t).getDay()
    if (d !== 0 && d !== 6) n++
  }
  return n
}

/** ชั่วโมงที่รถถูกใช้/จองไว้ภายในช่วงที่เลือก (ไม่นับยกเลิก/ไม่มาใช้รถ) */
function usedHours(b: Booking, fromMs: number, toMs: number): number {
  if (b.status === 'cancelled' || b.status === 'no_show') return 0
  const start = new Date(b.actualStart ?? b.start).getTime()
  const end = new Date(b.status === 'completed' && b.actualEnd ? b.actualEnd : b.end).getTime()
  return Math.max(0, Math.min(end, toMs) - Math.max(start, fromMs)) / HOUR
}

const bookedHours = (b: Booking) => (new Date(b.end).getTime() - new Date(b.start).getTime()) / HOUR

/**
 * ข้อเสนอแนะลดค่าใช้จ่าย — คำนวณจากข้อมูลที่มีอยู่แล้ว (ไม่มีข้อมูลใหม่/ไม่เรียก API เพิ่ม)
 * - รถที่ใช้น้อย → พิจารณาลดจำนวนรถ/ยกเลิกเช่า
 * - คิวที่ไม่มาใช้รถ → ระบบปล่อยคิวคืนให้คนอื่นแล้ว
 * - ใบสั่งที่ยังไม่ชำระ → เรียกเก็บจากผู้ขับขี่ที่ระบบจับคู่ได้
 * - ซ่อมบำรุง/พ.ร.บ./ประกัน ที่ใกล้ครบ → ทำก่อนเสียหนักหรือโดนปรับ
 */
export function SavingsInsights({ from, to }: { from: string; to: string }) {
  const { scopeCars, scopeByCar } = useBranchScope()
  const { data } = useQuery(async () => {
    const [bookings, cars, tickets, settings] = await Promise.all([bookingService.list(), carService.list(), ticketService.list(), settingsService.get()])
    return { bookings, cars, tickets, settings, alerts: maintenanceService.alerts(cars, settings) }
  })
  if (!data) return null
  const { settings } = data
  const cars = scopeCars(data.cars)
  const bookings = scopeByCar(data.bookings, cars)
  const tickets = scopeByCar(data.tickets, cars)
  const alerts = scopeByCar(data.alerts, cars)

  const fromMs = parseDateKey(from).getTime()
  const toMs = Math.min(parseDateKey(to).getTime() + 86_400_000, Date.now())
  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= fromMs && t < toMs
  }

  // 1) อัตราการใช้รถ (เทียบเวลาทำการ จ.–ศ. ตามชั่วโมงที่ตั้งค่าไว้)
  const workHours = weekdays(fromMs, toMs) * Math.max(1, settings.dayEndHour - settings.dayStartHour)
  const usage = cars
    .filter((c) => c.status === 'available')
    .map((car) => {
      const hours = bookings.filter((b) => b.carId === car.id).reduce((s, b) => s + usedHours(b, fromMs, toMs), 0)
      return { car, pct: workHours ? Math.min(100, Math.round((hours / workHours) * 100)) : 0 }
    })
    .sort((a, b) => a.pct - b.pct)
  const low = usage.filter((u) => u.pct < LOW_UTILIZATION)
  const avg = usage.length ? Math.round(usage.reduce((s, u) => s + u.pct, 0) / usage.length) : 0

  // 2) คิวที่ไม่มาใช้รถ (ระบบตัดสิทธิ์และปล่อยคิวอัตโนมัติ)
  const noShows = bookings.filter((b) => b.status === 'no_show' && inPeriod(b.start))
  const freedHours = Math.round(noShows.reduce((s, b) => s + bookedHours(b), 0))

  // 3) ใบสั่งที่ยังไม่ชำระ (ทุกช่วงเวลา — เป็นยอดค้าง)
  const unpaid = tickets.filter((t) => t.status !== 'paid')
  const unpaidMatched = unpaid.filter((t) => t.matchedDriverId)
  const unpaidAmount = unpaid.reduce((s, t) => s + t.amount, 0)

  // 4) ซ่อมบำรุง / พ.ร.บ. / ประกัน
  const overdue = alerts.filter((a) => a.level === 'overdue').length
  const soon = alerts.length - overdue

  return (
    <section className="mb-8" aria-labelledby="savings-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="savings-title" className="text-lg font-semibold">ลดค่าใช้จ่าย</h2>
        <span className="text-[12px] text-muted">คำนวณจากช่วงวันที่ที่เลือกด้านล่าง</span>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        <Insight
          label="อัตราการใช้รถเฉลี่ย"
          value={`${avg}%`}
          tone={low.length ? 'amber' : 'ok'}
          detail={
            low.length ? (
              <>
                รถใช้น้อยกว่า {LOW_UTILIZATION}% ของเวลาทำการ {low.length} คัน:{' '}
                {low.slice(0, 3).map((u, i) => (
                  <span key={u.car.id} className="whitespace-nowrap">
                    {i > 0 && ', '}
                    <span className="num font-medium text-ink">{u.car.plate}</span>{' '}
                    <span className="num">{u.pct}%</span>
                  </span>
                ))}
                {low.length > 3 && ` และอีก ${low.length - 3} คัน`} — พิจารณาลดจำนวนรถ ยกเลิกเช่า หรือย้ายไปแผนกที่ใช้มากกว่า
              </>
            ) : (
              'รถทุกคันถูกใช้งานเกิน 20% ของเวลาทำการ'
            )
          }
          to="/admin?tab=cars"
          action="ดูรถทั้งหมด"
        />
        <Insight
          label="คิวที่ไม่มาใช้รถ (ระบบปล่อยคืนแล้ว)"
          value={`${noShows.length} คิว`}
          tone={noShows.length ? 'amber' : 'ok'}
          detail={
            noShows.length
              ? `คืนเวลารถให้คนอื่นจองได้ ${freedHours} ชั่วโมง — ถ้าเกิดซ้ำกับคนเดิม ควรแจ้งเตือนหรือปรับเวลาตัดสิทธิ์ในหน้าตั้งค่า`
              : `ไม่มีคิวที่จองแล้วไม่มาใช้รถ (ตัดสิทธิ์อัตโนมัติหลังเลยเวลา ${settings.noShowMinutes} นาที)`
          }
          to="/admin?tab=settings"
          action="ตั้งเวลาตัดสิทธิ์"
        />
        <Insight
          label="ใบสั่งที่ยังไม่ชำระ"
          value={fmtBaht(unpaidAmount)}
          tone={unpaid.length ? 'red' : 'ok'}
          detail={
            unpaid.length
              ? `${unpaid.length} ใบ · ระบบจับคู่ผู้ขับขี่ได้ ${unpaidMatched.length} ใบ เรียกเก็บจากผู้ขับขี่ได้ทันที${unpaid.length > unpaidMatched.length ? ` · ต้องตรวจสอบเอง ${unpaid.length - unpaidMatched.length} ใบ` : ''}`
              : 'ไม่มีใบสั่งค้างชำระ'
          }
          to="/admin?tab=tickets"
          action="จัดการใบสั่ง"
        />
        <Insight
          label="ซ่อมบำรุง / พ.ร.บ. / ประกัน"
          value={`${alerts.length} รายการ`}
          tone={overdue ? 'red' : soon ? 'amber' : 'ok'}
          detail={
            alerts.length
              ? `เลยกำหนด ${overdue} · ใกล้ครบ ${soon} — ทำตามกำหนดช่วยกันค่าซ่อมใหญ่ และค่าปรับต่อทะเบียน/ประกันขาด`
              : 'ทุกคันอยู่ในกำหนด'
          }
          to="/admin?tab=maintenance"
          action="ดูงานซ่อม"
        />
      </ul>
    </section>
  )
}

const TONE = { ok: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }

function Insight({ label, value, detail, tone, to, action }: { label: string; value: string; detail: ReactNode; tone: keyof typeof TONE; to: string; action: string }) {
  return (
    <li className="grid gap-x-6 gap-y-1.5 px-4 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] md:items-center md:px-5">
      <div>
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className={cn('size-1.5 shrink-0 rounded-full', TONE[tone])} />
          {label}
        </div>
        <div className="num mt-1 text-[22px] leading-tight font-medium">{value}</div>
      </div>
      <p className="text-[13px] leading-[1.6] text-muted">{detail}</p>
      <Link to={to} className="inline-flex items-center gap-0.5 justify-self-start text-[13px] font-medium whitespace-nowrap text-brand hover:underline md:justify-self-end">
        {action}
        <ChevronRight className="size-3.5" />
      </Link>
    </li>
  )
}
