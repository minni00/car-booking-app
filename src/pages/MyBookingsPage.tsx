import { ArrowRight, CalendarClock, ChevronRight, FileImage, History, Receipt, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { BOOKING_STATUS_LABEL } from '../components/StatusBadge'
import { AttachmentViewer } from '../components/Attachments'
import { errorMessage, useToast } from '../components/Toast'
import { Button, LinkButton, Loading, Modal, PageHeader, Segmented } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { fmtDateShort, fmtDateTime, fmtRange, fmtTime } from '../lib/date'
import { cn, fmtBaht, fmtKm } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { Link, useLocation } from '../router'
import { bookingService, distanceOf } from '../services/bookingService'
import { carName, carService } from '../services/carService'
import { TICKET_STATUS_LABEL, ticketService } from '../services/ticketService'
import { userService } from '../services/userService'
import type { Booking, Car, Ticket, User } from '../types'

type Tab = 'queue' | 'history' | 'tickets'

export function MyBookingsPage() {
  const user = useCurrentUser()
  const toast = useToast()
  const { search } = useLocation()
  const initialTab = search.get('tab')
  const [tab, setTab] = useState<Tab>(initialTab === 'history' || initialTab === 'tickets' ? initialTab : 'queue')
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const { data, loading } = useQuery(async () => {
    const [bookings, cars, users, tickets] = await Promise.all([bookingService.listForUser(user.id), carService.list(), userService.list(), ticketService.listForDriver(user.id)])
    return { bookings, cars, users, tickets }
  }, [user.id])

  if (loading || !data) return <Loading />

  const carOf = (id: string) => data.cars.find((c) => c.id === id)
  const queue = data.bookings.filter((b) => b.status === 'upcoming' || b.status === 'in_progress')
  const history = data.bookings.filter((b) => !queue.includes(b)).reverse()

  const doCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await bookingService.cancel(cancelTarget.id)
      toast('ยกเลิกการจองแล้ว')
      setCancelTarget(null)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setCancelling(false)
    }
  }

  const list = (items: Booking[], withCancel: boolean) => (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((b) => {
        const car = carOf(b.carId)
        return car ? <BookingRow key={b.id} booking={b} car={car} users={data.users} userId={user.id} onCancel={withCancel ? () => setCancelTarget(b) : undefined} /> : null
      })}
    </ul>
  )

  return (
    <div>
      <PageHeader
        title="การจองของฉัน"
        action={
          <div className="hidden md:block">
            <LinkButton to="/fleet" variant="secondary">
              จองรถใหม่ <ArrowRight className="size-4" strokeWidth={1.75} />
            </LinkButton>
          </div>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6 w-full md:w-auto"
        options={[
          { value: 'queue', label: <>คิวจอง <span className="num ml-1 text-muted">{queue.length}</span></> },
          { value: 'history', label: <>ประวัติ <span className="num ml-1 text-muted">{history.length}</span></> },
          { value: 'tickets', label: <>ใบสั่ง <span className="num ml-1 text-muted">{data.tickets.length}</span></> },
        ]}
      />

      {tab === 'queue' && (queue.length ? list(queue, true) : <ListEmpty icon={CalendarClock} title="ยังไม่มีคิวจอง" description="เลือกรถและช่วงเวลาที่ต้องการ การจองที่รอใช้รถจะแสดงที่นี่" action={<LinkButton to="/fleet">จองรถ</LinkButton>} />)}

      {tab === 'history' && (history.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {[...history]
            .sort((a, b) => (b.actualStart ?? b.start).localeCompare(a.actualStart ?? a.start))
            .map((b) => {
              const car = carOf(b.carId)
              return car ? <HistoryRow key={b.id} booking={b} car={car} users={data.users} userId={user.id} /> : null
            })}
        </ul>
      ) : <ListEmpty icon={History} title="ยังไม่มีประวัติการใช้รถ" description="ทริปที่คืนรถแล้ว ยกเลิก หรือ No-Show จะแสดงที่นี่" />)}

      {tab === 'tickets' &&
        (data.tickets.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {[...data.tickets]
              .sort((x, y) => y.occurredAt.localeCompare(x.occurredAt))
              .map((t) => (
                <TicketRow key={t.id} ticket={t} car={carOf(t.carId)} driver={data.users.find((u) => u.id === t.matchedDriverId)} trip={data.bookings.find((b) => b.id === t.matchedBookingId)} />
              ))}
          </ul>
        ) : (
          <ListEmpty icon={Receipt} title="ไม่มีใบสั่ง" description="ใบสั่งที่เกิดระหว่างเวลาใช้รถจริงของคุณจะแสดงที่นี่" />
        ))}

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="ยกเลิกการจอง?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>ไม่ยกเลิก</Button>
            <Button variant="danger" onClick={() => void doCancel()} loading={cancelling}>ยืนยันยกเลิก</Button>
          </>
        }
      >
        {cancelTarget && <p className="text-muted">การจอง {fmtRange(cancelTarget.start, cancelTarget.end)} จะถูกยกเลิกและปล่อยคิวให้ผู้อื่นทันที</p>}
      </Modal>
    </div>
  )
}

/** สีสถานะการจอง (เฉพาะหน้านี้ — ไม่แก้ Badge กลาง) */
const STATUS_STYLE: Record<Booking['status'], string> = {
  upcoming: 'bg-brand-soft text-brand',
  in_progress: 'bg-sun text-brand',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-paper text-muted',
  no_show: 'bg-red-50 text-red-700',
}

function StatusPill({ status, size = 'md' }: { status: Booking['status']; size?: 'md' | 'sm' }) {
  return (
    <span className={cn('inline-flex items-center rounded-full font-medium whitespace-nowrap', size === 'sm' ? 'h-5 px-2 text-[11px] leading-[1.5]' : 'h-6 px-2.5 text-[12px] leading-[1.5]', STATUS_STYLE[status])}>
      {status === 'in_progress' && <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-brand" />}
      {BOOKING_STATUS_LABEL[status]}
    </span>
  )
}

function ListEmpty({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border-y border-line px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-6" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function BookingRow({ booking: b, car, users, userId, onCancel }: { booking: Booking; car: Car; users: User[]; userId: string; onCancel?: () => void }) {
  const driver = users.find((u) => u.id === b.driverId)
  const booker = users.find((u) => u.id === b.bookedById)
  const distance = distanceOf(b)
  const muted = b.status === 'cancelled' || b.status === 'no_show'
  const proxy = b.driverId !== b.bookedById ? (b.bookedById === userId ? `จองแทน ${driver?.name ?? '-'}` : `${booker?.name ?? '-'} จองให้คุณ`) : null

  return (
    <li className="grid grid-cols-[5rem_1fr] gap-x-3 py-4 md:grid-cols-[7rem_1fr] md:gap-x-6">
      {/* ซ้าย: เวลาเริ่ม–สิ้นสุด */}
      <div className={cn('pt-0.5', muted && 'opacity-50')}>
        <p className="num text-[20px] leading-tight font-semibold md:text-2xl">{fmtTime(b.start)}</p>
        <p className="num text-[13px] leading-[1.6] text-muted">ถึง {fmtTime(b.end)}</p>
        <p className="mt-1 text-[12px] leading-[1.5] whitespace-nowrap text-muted">{fmtDateShort(b.start)}</p>
      </div>

      {/* ขวา: รุ่นรถ / ทะเบียน / รายละเอียด / สถานะ */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <p className={cn('line-clamp-2 min-w-0 flex-1 leading-snug font-semibold break-words', muted && 'text-muted')}>{carName(car)}</p>
          <Link
            to={`/trip/${b.id}`}
            data-detail
            aria-label="ดูรายละเอียด"
            className="-mt-1.5 -mr-2 inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            <span className="hidden md:inline">รายละเอียด</span>
            <ChevronRight className="size-5 md:size-4" strokeWidth={1.75} />
          </Link>
        </div>
        <p className="mt-0.5 truncate text-[13px] leading-[1.6] text-muted">
          <span className="num font-medium text-ink/80">{car.plate}</span>
          <span className="mx-1.5">·</span>
          {b.purpose}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusPill status={b.status} />
          {proxy && <span className="text-[12px] text-muted">{proxy}</span>}
          {b.status === 'completed' && <span className="num text-[12px] text-muted">{distance != null ? fmtKm(distance) : '-'}</span>}
        </div>

        {(b.status === 'upcoming' || b.status === 'in_progress') && (
          <div className="mt-3 flex flex-wrap gap-2">
            {b.status === 'upcoming' && (
              <>
                {b.driverId === userId && <LinkButton to={`/trip/${b.id}`} size="sm">เริ่มใช้รถ</LinkButton>}
                <LinkButton to={`/book/${b.carId}?edit=${b.id}`} size="sm" variant="secondary">แก้ไข</LinkButton>
                {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} className="text-red-600 hover:bg-red-50">ยกเลิก</Button>}
              </>
            )}
            {b.status === 'in_progress' && <LinkButton to={`/trip/${b.id}`} size="sm">ไปหน้าระหว่างขับขี่</LinkButton>}
          </div>
        )}
      </div>
    </li>
  )
}

/** Tab ประวัติ: รายการกระชับ เวลาซ้าย ข้อมูลรถขวา (ไม่มีปุ่มดำเนินการ) */
function HistoryRow({ booking: b, car, users, userId }: { booking: Booking; car: Car; users: User[]; userId: string }) {
  const driver = users.find((u) => u.id === b.driverId)
  const booker = users.find((u) => u.id === b.bookedById)
  const distance = distanceOf(b)
  const muted = b.status === 'cancelled' || b.status === 'no_show'
  const proxy = b.driverId !== b.bookedById ? (b.bookedById === userId ? `จองแทน ${driver?.name ?? '-'}` : `${booker?.name ?? '-'} จองให้คุณ`) : null

  return (
    <li>
      <Link to={`/trip/${b.id}?from=history`} className="grid grid-cols-[5rem_1fr_auto] items-start gap-x-3 py-3.5 transition-colors hover:bg-paper/60 md:grid-cols-[7rem_1fr_auto] md:gap-x-6">
        <div className={cn(muted && 'opacity-60')}>
          <p className="num text-[15px] leading-[1.5] font-semibold">{fmtTime(b.start)}</p>
          <p className="num text-[12px] leading-[1.5] text-muted">ถึง {fmtTime(b.end)}</p>
          <p className="text-[12px] leading-[1.5] whitespace-nowrap text-muted">{fmtDateShort(b.start)}</p>
        </div>
        <div className="min-w-0">
          <p className={cn('line-clamp-2 leading-snug font-semibold break-words', muted && 'text-ink/60')}>{carName(car)}</p>
          <p className="truncate text-[13px] leading-[1.6] text-muted">
            <span className="num font-medium text-ink/80">{car.plate}</span>
            <span className="mx-1.5">·</span>
            {b.purpose}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <StatusPill status={b.status} size="sm" />
            {b.status === 'completed' && distance != null && <span className="num text-[12px] text-muted">{fmtKm(distance)}</span>}
            {proxy && <span className="text-[12px] text-muted">{proxy}</span>}
            {(b.startIssue || b.endIssue) && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-700">
                <span className="size-1.5 rounded-full bg-amber-500" />
                แจ้งปัญหา/รอย
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-0.5 size-4 text-muted" strokeWidth={1.75} aria-hidden />
      </Link>
    </li>
  )
}

const TICKET_STYLE: Record<Ticket['status'], string> = {
  pending: 'bg-red-50 text-red-700',
  notified: 'bg-amber-50 text-amber-800',
  paid: 'bg-emerald-50 text-emerald-700',
}

/** Tab ใบสั่ง: วันที่+ทะเบียน → ข้อหา → รายละเอียด → หลักฐาน → ยอดเงิน+สถานะ */
function TicketRow({ ticket: t, car, driver, trip }: { ticket: Ticket; car?: Car; driver?: User; trip?: Booking }) {
  return (
    <li className="py-4">
      <div className="md:grid md:grid-cols-[1fr_auto] md:gap-x-8">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-[1.6] text-muted">
            <span className="num">{fmtDateTime(t.occurredAt)}</span>
            {car && (
              <>
                <span>·</span>
                <span className="num font-medium text-ink/80">{car.plate}</span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-[16px] leading-snug font-semibold break-words">{t.violation}</p>
          <p className="mt-0.5 text-sm leading-[1.6] break-words text-ink/80">{t.location}</p>

          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] leading-[1.6]">
            <dt className="text-muted">ผู้ขับ</dt>
            <dd className="min-w-0 break-words">{driver?.name ?? 'ไม่พบผู้ขับ'}</dd>
            {trip && (
              <>
                <dt className="text-muted">ทริป</dt>
                <dd className="min-w-0 break-words">
                  <span className="num">{fmtRange(trip.actualStart ?? trip.start, trip.actualEnd ?? trip.end)}</span>
                  <span className="text-muted"> · {trip.purpose}</span>
                </dd>
              </>
            )}
          </dl>

          {t.attachment && (
            <AttachmentViewer attachment={t.attachment} title="ดูหลักฐาน" className="mt-3 h-9 gap-2 rounded-lg border border-line px-3 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft">
              <span className="inline-flex items-center gap-2">
                <FileImage className="size-4" strokeWidth={1.75} />
                ดูหลักฐาน
              </span>
            </AttachmentViewer>
          )}
        </div>

        {/* ท้ายรายการ: ยอดเงิน + สถานะการชำระ */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 md:mt-0 md:flex-col md:items-end md:justify-start md:border-t-0 md:pt-0">
          <p className="num text-[20px] leading-tight font-semibold">{fmtBaht(t.amount)}</p>
          <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] leading-[1.5] font-medium whitespace-nowrap', TICKET_STYLE[t.status])}>{TICKET_STATUS_LABEL[t.status]}</span>
        </div>
      </div>
    </li>
  )
}
