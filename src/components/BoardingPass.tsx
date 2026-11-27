import { ArrowRight, KeyRound, MapPin, SquareParking } from 'lucide-react'
import { fmtDateShort, fmtTime, toDateKey } from '../lib/date'
import { carName } from '../services/carService'
import type { Booking, Car, User } from '../types'
import { CarImage } from './CarImage'
import { Button, LinkButton } from './ui'

/** ข้อความเวลาแบบสัมพัทธ์ เช่น "อีก 45 นาที", "พรุ่งนี้ 09:00" */
function whenLabel(b: Booking, now = Date.now()): string {
  if (b.status === 'in_progress') return `กำลังใช้รถ · คืน ${fmtTime(b.end)} น.`
  const mins = Math.round((new Date(b.start).getTime() - now) / 60_000)
  if (mins <= 0) return 'ถึงเวลารับรถแล้ว'
  if (mins < 60) return `อีก ${mins} นาที`
  const today = toDateKey()
  const tomorrow = toDateKey(new Date(Date.now() + 86_400_000))
  const day = toDateKey(b.start)
  if (day === today) return `วันนี้ อีก ${Math.floor(mins / 60)} ชม.${mins % 60 ? ` ${mins % 60} นาที` : ''}`
  if (day === tomorrow) return `พรุ่งนี้ ${fmtTime(b.start)} น.`
  return fmtDateShort(b.start)
}

/** การ์ดทริปถัดไป (ชื่อคอมโพเนนต์เดิม) — กระชับ, ข้อมูลสำคัญอยู่บนสุด, ปุ่มหลักอยู่ในระยะนิ้วโป้ง */
export function BoardingPass({ booking, car, driver, currentUserId }: { booking: Booking; car: Car; driver?: User; currentUserId: string }) {
  const inProgress = booking.status === 'in_progress'
  const forSomeoneElse = booking.driverId !== currentUserId

  return (
    <article className="overflow-hidden rounded-3xl bg-brand text-white">
      <div className="flex gap-4 p-5 pb-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px] font-medium text-sun">
            <span className={inProgress ? 'size-2 animate-pulse rounded-full bg-sun' : 'size-2 rounded-full bg-sun'} />
            {whenLabel(booking)}
          </p>
          <h2 className="mt-2 truncate text-[19px] leading-tight font-semibold">{carName(car)}</h2>
          <p className="mt-0.5 text-[13px] text-white/65">
            <span className="num font-medium text-white">{car.plate}</span>
            {forSomeoneElse ? ` · ผู้ขับ ${driver?.name ?? '-'}` : ` · ${booking.purpose}`}
          </p>
        </div>
        <CarImage car={car} className="h-[72px] w-[104px] shrink-0 rounded-2xl" iconClassName="size-7 text-white/40" />
      </div>

      {/* เวลา */}
      <div className="mx-5 flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
        <div>
          <p className="text-[11px] text-white/55">รับรถ</p>
          <p className="num text-[26px] leading-tight font-semibold">{fmtTime(booking.start)}</p>
        </div>
        <div className="flex flex-1 items-center gap-1 text-white/35">
          <span className="h-px flex-1 bg-white/25" />
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/55">คืนรถ</p>
          <p className="num text-[26px] leading-tight font-semibold">{fmtTime(booking.end)}</p>
        </div>
      </div>

      {/* จุดรับรถ */}
      <dl className="grid grid-cols-1 gap-2.5 px-5 pt-4 text-[14px] sm:grid-cols-2">
        <Item icon={SquareParking} label="จุดจอด" value={car.parkingSpot} />
        <Item icon={KeyRound} label="รับกุญแจ" value={car.keyLocation} />
        {booking.destination?.label && <Item icon={MapPin} label="ปลายทาง" value={booking.destination.label.split(',')[0]} />}
      </dl>

      <div className="p-5 pt-4">
        {booking.bookedById === currentUserId ? (
          <LinkButton to={`/trip/${booking.id}`} variant="accent" block size="lg" className="h-[52px] rounded-2xl text-base font-semibold">
            {inProgress ? 'ไปหน้าระหว่างขับขี่' : 'เริ่มใช้รถ'}
          </LinkButton>
        ) : (
          <>
            <Button variant="accent" block size="lg" className="h-[52px] rounded-2xl text-base font-semibold" disabled>
              {inProgress ? 'ไปหน้าระหว่างขับขี่' : 'เริ่มใช้รถ'}
            </Button>
            <p className="mt-2 text-center text-xs text-white/65">เฉพาะผู้สร้างการจองเท่านั้นที่ใช้งานได้</p>
          </>
        )}
      </div>
    </article>
  )
}

function Item({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-white/50" strokeWidth={1.75} />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="leading-snug">
          <span className="text-white/55">{label} </span>
          <span className="font-medium">{value}</span>
        </dd>
      </div>
    </div>
  )
}
