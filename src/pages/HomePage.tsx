import { CalendarPlus, ChevronRight, Search, Users } from 'lucide-react'
import { freeHours } from '../components/AvailabilityGrid'
import { BoardingPass } from '../components/BoardingPass'
import { CarImage } from '../components/CarImage'
import { Loading } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { fmtTime, parseDateKey, toDateKey } from '../lib/date'
import { cn } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { Link } from '../router'
import { bookingService } from '../services/bookingService'
import { carName, carService } from '../services/carService'
import { settingsService } from '../services/settingsService'
import { userService } from '../services/userService'
import type { Booking, Car } from '../types'

/**
 * หน้าแรก (Mobile-first)
 * ลำดับตามความถี่ใช้งาน: ทริปถัดไป → จองรถ → รถว่างวันนี้ → คิวถัดไป
 * ปุ่มหลักทั้งหมดอยู่ครึ่งล่างของจอ ใช้นิ้วโป้งกดได้ด้วยมือเดียว
 */
export function HomePage() {
  const user = useCurrentUser()
  const { data, loading } = useQuery(async () => {
    const today = toDateKey()
    const [cars, settings, mine, users] = await Promise.all([
      carService.list(),
      settingsService.get(),
      bookingService.listForUser(user.id),
      userService.list(),
    ])
    const all = await bookingService.list()
    const next = all.find((b) => b.status === 'in_progress') ?? all.find((b) => b.status === 'upcoming')
    const now = Date.now()
    const inUseIds = new Set(all.filter((b) => b.status === 'in_progress' || (b.status === 'upcoming' && new Date(b.start).getTime() <= now && new Date(b.end).getTime() > now)).map((b) => b.carId))
    const span = settings.dayEndHour - settings.dayStartHour
    const availability = await Promise.all(
      cars.filter((c) => c.status === 'available').map(async (car) => ({ car, hours: freeHours(today, settings.dayStartHour, settings.dayEndHour, await bookingService.busyBlocks(car.id, today)) })),
    )
    availability.sort((a, b) => b.hours - a.hours)
    return { cars, next, mine, users, inUseIds, availability, span, today: new Date() }
  }, [user.id])

  if (loading || !data) return <Loading />

  const { cars, next, mine, users, inUseIds, availability, span, today } = data
  const nextCar = next && cars.find((c) => c.id === next.carId)
  const availableNow = cars.filter((c) => c.status === 'available' && !inUseIds.has(c.id)).length
  const maintenance = cars.filter((c) => c.status === 'maintenance').length
  const laterQueue = mine.filter((b) => b.status === 'upcoming' && b.id !== next?.id).slice(0, 3)
  const firstName = user.name.split(' ')[0]

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-12">
      {/* คอลัมน์หลัก */}
      <div className="lg:col-span-7">
        <header>
          <p className="text-[13px] text-muted">{today.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-0.5 text-[26px] leading-tight font-semibold tracking-[-0.02em] md:text-[34px]">สวัสดี {firstName}</h1>
        </header>

        {/* ทางเข้าการจอง: รูปแบบช่องค้นหาแบบแอปเรียกรถ */}
        <Link
          to="/fleet"
          className="mt-4 flex h-14 items-center gap-3 rounded-2xl border border-line bg-paper px-4 transition-colors active:bg-brand-soft md:mt-6 md:hover:border-brand/30"
        >
          <Search className="size-5 text-brand" strokeWidth={2} />
          <span className="flex-1 text-[15px] text-muted">ต้องการใช้รถวันไหน?</span>
          <span className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-brand shadow-[0_0_0_1px_var(--color-line)]">จองรถ</span>
        </Link>

        {/* สถานะรถโดยรวม (บรรทัดเดียว ไม่ใช่ KPI cards) */}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            ว่างตอนนี้ <b className="num font-semibold text-ink">{availableNow}</b> จาก {cars.length} คัน
          </span>
          {maintenance > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              ซ่อมบำรุง <b className="num font-semibold text-ink">{maintenance}</b>
            </span>
          )}
        </p>

        {/* ทริปถัดไป */}
        <section className="mt-7">
          <SectionHead title={next?.status === 'in_progress' ? 'รายการใช้รถปัจจุบัน' : 'ทริปถัดไป'} />
          {next && nextCar ? (
            <BoardingPass booking={next} car={nextCar} driver={users.find((u) => u.id === next.driverId)} currentUserId={user.id} />
          ) : (
            <Link to="/fleet" className="flex items-center gap-4 rounded-2xl border border-dashed border-brand/25 px-4 py-5 active:bg-brand-soft">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white">
                <CalendarPlus className="size-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">ยังไม่มีทริป</span>
                <span className="block text-[13px] text-muted">แตะเพื่อดูรถว่างและจองล่วงหน้า</span>
              </span>
              <ChevronRight className="size-5 text-muted" />
            </Link>
          )}
        </section>

        {/* รถว่างวันนี้ — มือถือ: เลื่อนแนวนอน (เห็นคันถัดไปบางส่วน) */}
        <section className="mt-8 lg:hidden">
          <SectionHead title="รถว่างวันนี้" action={{ to: '/fleet', label: 'ดูทั้งหมด' }} />
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1">
            {availability.map(({ car, hours }) => (
              <AvailableCarTile key={car.id} car={car} hours={hours} span={span} />
            ))}
          </div>
        </section>

        {/* รายการจองถัดไป */}
        {laterQueue.length > 0 && (
          <section className="mt-8">
            <SectionHead title="รายการจองถัดไป" action={{ to: '/bookings', label: 'ทั้งหมด' }} />
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {laterQueue.map((b) => (
                <QueueRow key={b.id} booking={b} car={cars.find((c) => c.id === b.carId)} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* คอลัมน์ขวา (iPad แนวนอน / คอมพิวเตอร์): รายการรถว่างแนวตั้ง */}
      <aside className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-24">
          <SectionHead title="รถว่างวันนี้" action={{ to: '/fleet', label: 'ดูทั้งหมด' }} />
          <ul className="divide-y divide-line">
            {availability.map(({ car, hours }) => (
              <li key={car.id}>
                <Link to={`/book/${car.id}`} className="group flex items-center gap-4 py-3">
                  <CarImage car={car} className="h-16 w-24 shrink-0 rounded-xl" iconClassName="size-6" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold group-hover:text-brand">{carName(car)}</p>
                    <p className="text-[13px] text-muted">
                      <span className="num">{car.plate}</span> · {car.seats} ที่นั่ง
                    </p>
                    <FreeBar hours={hours} span={span} className="mt-2" />
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

function SectionHead({ title, action }: { title: string; action?: { to: string; label: string } }) {
  return (
    <div className="mb-2 flex min-h-11 items-center justify-between">
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
      {action && (
        <Link to={action.to} className="-mr-3 flex min-h-11 items-center px-3 text-[14px] font-medium text-brand">
          {action.label}
        </Link>
      )}
    </div>
  )
}

function FreeBar({ hours, span, className }: { hours: number; span: number; className?: string }) {
  const pct = Math.min(100, (hours / span) * 100)
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-paper">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', hours > 0 ? 'bg-brand' : 'bg-ink/20')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('num shrink-0 text-[13px] font-medium whitespace-nowrap', hours > 0 ? 'text-ink' : 'text-muted')}>{hours > 0 ? `ว่าง ${hours} ชม.` : 'เต็มวัน'}</span>
    </div>
  )
}

function AvailableCarTile({ car, hours, span }: { car: Car; hours: number; span: number }) {
  return (
    <Link to={`/book/${car.id}`} className="w-[72%] max-w-[300px] shrink-0 snap-start active:opacity-80 sm:w-[45%]">
      <CarImage car={car} full className="aspect-[16/10] w-full rounded-2xl" iconClassName="size-10" />
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-[15px] font-semibold">{carName(car)}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[13px] text-muted">
          <span className="num">{car.plate}</span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" strokeWidth={1.75} />
            {car.seats}
          </span>
        </p>
        <FreeBar hours={hours} span={span} className="mt-2" />
      </div>
    </Link>
  )
}

function QueueRow({ booking: b, car }: { booking: Booking; car?: Car }) {
  const d = parseDateKey(toDateKey(b.start))
  return (
    <li>
      <Link to={`/trip/${b.id}`} className="flex items-center gap-4 px-4 py-3.5 active:bg-paper">
        <div className="w-11 shrink-0 text-center">
          <p className="text-[11px] text-muted">{d.toLocaleDateString('th-TH', { month: 'short' })}</p>
          <p className="num text-[20px] leading-tight font-semibold text-brand">{d.getDate()}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{b.purpose}</p>
          <p className="text-[13px] text-muted">
            <span className="num">
              {fmtTime(b.start)}–{fmtTime(b.end)}
            </span>
            {car && ` · ${car.plate}`}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  )
}
