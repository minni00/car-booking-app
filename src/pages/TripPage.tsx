import { ArrowLeft, Check, Clock, Flag, Fuel, KeyRound, ParkingSquare, Phone, PhoneCall, Play, ShieldCheck, TimerReset } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AttachmentInput, MultiPhotoInput, PhotoInput, PhotoSlots } from '../components/Attachments'
import { LocationCapture } from '../components/LocationCapture'
import { TripDetails } from '../components/TripDetails'
import { BookingStatusBadge } from '../components/StatusBadge'
import { errorMessage, useToast } from '../components/Toast'
import { Badge, Button, Card, CardHeader, ErrorText, Field, InfoRow, Input, LinkButton, Loading, Modal, Plate, Segmented, Textarea } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { addMinutes, fmtDate, fmtDateTime, fmtDuration, fmtRange, fmtTime, pad } from '../lib/date'
import { cn, fmtBaht, fmtKm } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { Link, useLocation } from '../router'
import { bookingService, distanceOf } from '../services/bookingService'
import { carName, carService } from '../services/carService'
import { userService } from '../services/userService'
import type { Attachment, Booking, Car, FuelMethod, GeoPoint, TripIssue } from '../types'

const STEPS = ['เริ่มใช้รถ', 'ระหว่างขับขี่', 'คืนรถ'] as const

export function TripPage({ bookingId }: { bookingId: string }) {
  const user = useCurrentUser()
  const { search } = useLocation()
  const returnToHistory = search.get('from') === 'history'
  const [returning, setReturning] = useState(false)
  const { data, loading } = useQuery(async () => {
    const booking = await bookingService.get(bookingId)
    if (!booking) return null
    const [car, driver, users] = await Promise.all([carService.get(booking.carId), userService.get(booking.driverId), userService.list()])
    return { booking, car, driver, users }
  }, [bookingId])

  if (loading) return <Loading />
  if (!data?.car) return <Card className="p-8 text-center">ไม่พบทริปนี้</Card>

  const { booking, car, driver, users } = data
  const canOperate = booking.bookedById === user.id
  const step = booking.status === 'upcoming' ? 0 : booking.status === 'in_progress' ? (returning ? 2 : 1) : 3
  const admin = users.find((u) => u.role === 'admin')

  return (
    <div>
      <Link to={returnToHistory ? '/bookings?tab=history' : '/bookings'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> การจองของฉัน
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 md:mb-7">
        <div>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] md:text-[44px]">ใช้รถ</h1>
          <p className="text-muted">{booking.purpose}</p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      {(booking.status === 'upcoming' || booking.status === 'in_progress') && <Stepper step={step} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          {!canOperate ? (
            <Card className="p-6 text-center text-muted">ดูรายละเอียดได้ แต่เฉพาะผู้สร้างการจองเท่านั้นที่บันทึกการใช้รถได้</Card>
          ) : booking.status === 'upcoming' ? (
            <StartStep booking={booking} car={car} />
          ) : booking.status === 'in_progress' && !returning ? (
            <DrivingStep booking={booking} car={car} adminPhone={admin?.phone} onReturn={() => setReturning(true)} />
          ) : booking.status === 'in_progress' ? (
            <ReturnStep booking={booking} car={car} onBack={() => setReturning(false)} />
          ) : (
            <TripSummary booking={booking} />
          )}
        </div>

        <div className="space-y-5 lg:col-span-5">
          <Card>
            <CardHeader title={carName(car)} subtitle={fmtRange(booking.start, booking.end)} action={<Plate plate={car.plate} size="sm" />} />
            <div className="divide-y divide-line px-5 pt-2 pb-4">
              <InfoRow label="ผู้ขับขี่" value={driver?.name ?? '-'} />
              <InfoRow label="เลขไมล์ล่าสุด" value={fmtKm(car.mileage)} />
              <InfoRow label="เชื้อเพลิง" value={car.fuel} />
              {booking.destination && booking.status !== 'in_progress' && <InfoRow label="ปลายทาง" value={booking.destination.label ?? 'ปักหมุดไว้'} />}
            </div>
          </Card>
          {/* ระหว่างขับขี่บนมือถือ แสดงการ์ดประกันในขั้นตอนแล้ว — ซ่อนตัวนี้เพื่อไม่ให้ซ้ำ */}
          <div className={booking.status === 'in_progress' && !returning ? 'hidden lg:block' : undefined}>
            <InsuranceCard car={car} adminPhone={admin?.phone} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-5 grid grid-cols-3 gap-2 md:mb-6">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-col gap-2">
          <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-brand' : 'bg-line')} />
          <span className={cn('flex items-center gap-1.5 text-xs font-medium md:text-sm', i <= step ? 'text-ink' : 'text-muted')}>
            <span className={cn('grid size-5 place-items-center rounded-full text-[11px]', i < step ? 'bg-brand text-white' : i === step ? 'bg-sun text-ink' : 'bg-line text-muted')}>{i < step ? <Check className="size-3" /> : i + 1}</span>
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

// ---------------- ขั้นที่ 1: เริ่มใช้รถ ----------------
function StartStep({ booking, car }: { booking: Booking; car: Car }) {
  const toast = useToast()
  const [mileage, setMileage] = useState(String(car.mileage))
  // ต้องกดบันทึกตำแหน่งเอง (ไม่ใช้หมุดตอนจองแทน)
  const [gps, setGps] = useState<GeoPoint | null>(null)
  const [photos, setPhotos] = useState<Attachment[]>([])
  const [odometerPhoto, setOdometerPhoto] = useState<Attachment | null>(null)
  const [issue, setIssue] = useState<TripIssue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mileageOk = mileage !== '' && Number(mileage) >= car.mileage
  const missing = [!gps && 'ตำแหน่งจุดขึ้นรถ', !mileageOk && 'เลขไมล์', !odometerPhoto && 'รูปเลขไมล์', issueMissing(issue)].filter(Boolean) as string[]

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      await bookingService.startTrip(booking.id, { mileage: Number(mileage), gps, photos, odometerPhoto, issue })
      toast('เริ่มใช้รถแล้ว ขับขี่ปลอดภัย')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={Play} title="เริ่มใช้รถ" subtitle="ทำให้ครบก่อนออกรถ" />
      <div className="grid grid-cols-2 gap-3 border-b border-line bg-paper/60 px-5 py-4">
        <Handover icon={ParkingSquare} label="รถจอดอยู่ที่" value={car.parkingSpot} />
        <Handover icon={KeyRound} label="รับกุญแจที่" value={car.keyLocation} />
      </div>
      <div className="divide-y divide-line">
        <Task n={1} title="ตำแหน่งจุดขึ้นรถ" done={!!gps}>
          <LocationCapture value={gps} onChange={setGps} reference={booking.pickupPin?.label} />
        </Task>
        <Task n={2} title="เลขไมล์เริ่มต้น" done={mileageOk && !!odometerPhoto}>
          <div className="space-y-3">
            <Field label="เลขไมล์บนหน้าปัด (กม.)" hint={`ล่าสุดในระบบ ${fmtKm(car.mileage)}`}>
              <Input type="number" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
            </Field>
            <PhotoInput value={odometerPhoto} onChange={setOdometerPhoto} label="รูปหน้าปัดเลขไมล์" placeholder="แตะเพื่อถ่ายรูปเลขไมล์" />
          </div>
        </Task>
        <Task n={3} title="สภาพรถก่อนใช้" optional done={photos.length > 0 || !!issue}>
          <div className="space-y-3">
            <PhotoSlots value={photos} onChange={setPhotos} labels={['ด้านหน้า', 'ด้านหลัง']} />
            <IssueReport value={issue} onChange={setIssue} />
          </div>
        </Task>
      </div>
      <TaskFooter missing={missing} error={error} note={`เวลาเริ่มจะบันทึกอัตโนมัติ (ตอนนี้ ${fmtTime(new Date())} น.)`}>
        <Button block size="lg" icon={Play} onClick={() => void start()} loading={busy} disabled={missing.length > 0}>
          เริ่มใช้รถ
        </Button>
      </TaskFooter>
    </Card>
  )
}

/** ข้อความที่ยังขาดของการแจ้งปัญหา (ถ้าติ๊กแจ้งไว้) */
const issueMissing = (issue: TripIssue | null) => (issue && (!issue.note.trim() || !issue.photos.length) ? 'รายละเอียด/รูปปัญหา' : false)

/** หัวข้อสิ่งที่ต้องทำ — วงกลมตัวเลขเปลี่ยนเป็นเครื่องหมายถูกเมื่อทำครบ */
function Task({ n, title, done, optional, children }: { n: number; title: string; done: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <section className="px-5 py-5">
      <h3 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold">
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[12px] transition-colors', done ? 'bg-emerald-500 text-white' : 'bg-paper text-muted ring-1 ring-line')}>
          {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
        </span>
        {title}
        {optional && <span className="text-[12px] font-normal text-muted">ไม่บังคับ</span>}
      </h3>
      {children}
    </section>
  )
}

/** ท้ายฟอร์ม: บอกสิ่งที่ยังขาด + ปุ่มหลัก */
function TaskFooter({ missing, error, note, children }: { missing: string[]; error: string | null; note?: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5 border-t border-line bg-paper/50 px-5 py-4">
      <ErrorText>{error}</ErrorText>
      {children}
      <p className="text-center text-[12px] text-muted">{missing.length ? <>ยังขาด: <span className="font-medium text-ink/80">{missing.join(' · ')}</span></> : note}</p>
    </div>
  )
}

// ---------------- ขั้นที่ 2: ระหว่างขับขี่ ----------------
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function DrivingStep({ booking, car, adminPhone, onReturn }: { booking: Booking; car: Car; adminPhone?: string; onReturn: () => void }) {
  const toast = useToast()
  const now = useNow()
  const [busy, setBusy] = useState<number | null>(null)
  const startedAt = new Date(booking.actualStart ?? booking.start).getTime()
  const endAt = new Date(booking.end).getTime()
  const elapsed = Math.max(0, now - startedAt)
  const remaining = endAt - now
  const h = Math.floor(elapsed / 3_600_000)
  const m = Math.floor((elapsed % 3_600_000) / 60_000)
  const s = Math.floor((elapsed % 60_000) / 1000)

  /** ตัวเลือกที่กดไว้ รอผู้ใช้ยืนยัน/ยกเลิก */
  const [pending, setPending] = useState<number | null>(null)

  // ตรวจล่วงหน้าว่าแต่ละตัวเลือกขยายได้ไหม + คิวถัดไปของรถคันนี้ (ใช้เงื่อนไขเดียวกับ requestExtension)
  const { data: preview } = useQuery(async () => {
    const base = Math.max(new Date(booking.end).getTime(), Date.now())
    const options = await Promise.all(
      EXTEND_OPTIONS.map(async (min) => {
        const newEnd = addMinutes(base, min)
        const conflict = await bookingService.findConflict(booking.carId, new Date(booking.end), newEnd, booking.id)
        return { min, newEnd, conflict }
      }),
    )
    const [all, users] = await Promise.all([bookingService.list(), userService.list()])
    const queue = all
      .filter((b) => b.carId === booking.carId && b.id !== booking.id && (b.status === 'upcoming' || b.status === 'in_progress') && new Date(b.end).getTime() > new Date(booking.end).getTime())
      .slice(0, 3)
      .map((b) => ({ booking: b, driver: users.find((u) => u.id === b.driverId) }))
    return { options, queue }
  }, [booking.end, booking.carId, booking.id, pending])

  const extend = async (minutes: number) => {
    setBusy(minutes)
    try {
      const r = await bookingService.requestExtension(booking.id, minutes)
      toast(r.approved ? `อนุมัติขยายเวลาถึง ${fmtTime(r.booking.end)} น. · ส่งอีเมลแจ้งผู้จองแล้ว` : 'ขยายเวลาไม่ได้ เพราะมีคิวจองถัดไป', r.approved ? 'success' : 'error')
      setPending(null)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const label = (min: number) => (min >= 60 ? `${min / 60} ชม.` : `${min} นาที`)
  const chosen = preview?.options.find((o) => o.min === pending)
  const conflictDriver = chosen?.conflict && preview?.queue.find((q) => q.booking.id === chosen.conflict?.id)?.driver

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-brand p-6 text-white md:p-8">
        <p className="flex items-center gap-2 text-[12px] text-white/60"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />กำลังใช้รถ · เวลาที่ใช้ไป</p>
        <p className="num mt-4 text-[56px] leading-none font-medium md:text-[80px]">
          {pad(h)}:{pad(m)}:{pad(s)}
        </p>
        <p className="num mt-4 text-sm text-white/60">เริ่ม {fmtTime(startedAt)} · คืน {fmtTime(endAt)}</p>
        <div className="mt-3">
          {remaining >= 0 ? <span className="text-sm text-white/90">เหลือเวลา <span className="num">{fmtDuration(remaining)}</span></span> : <span className="text-sm font-medium text-red-400">เกินเวลาคืน <span className="num">{fmtDuration(-remaining)}</span></span>}
        </div>
      </div>

      <StartInfo booking={booking} />

      <Card>
        <CardHeader icon={TimerReset} title="ขอขยายเวลาคืนรถ" subtitle="อนุมัติอัตโนมัติหากไม่ชนคิวถัดไป" />
        <div className="grid grid-cols-3 gap-2 px-5 pt-5">
          {EXTEND_OPTIONS.map((min) => {
            const o = preview?.options.find((x) => x.min === min)
            return (
              <div key={min} className="flex flex-col items-center gap-1.5">
                <Button block variant="secondary" onClick={() => setPending(min)} disabled={busy !== null}>
                  +{label(min)}
                </Button>
                <span className={cn('text-[12px] leading-[1.5]', !o ? 'text-muted' : o.conflict ? 'text-red-600' : 'text-emerald-700')}>
                  {!o ? 'กำลังตรวจ…' : o.conflict ? 'ติดคิวถัดไป' : `ว่าง · ถึง ${fmtTime(o.newEnd)}`}
                </span>
              </div>
            )
          })}
        </div>

        {/* คิวถัดไปของรถคันนี้ */}
        <div className="px-5 pt-4 pb-5">
          <p className="text-[12px] font-medium text-muted">คิวจองถัดไปของรถคันนี้</p>
          {!preview ? null : preview.queue.length ? (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
              {preview.queue.map(({ booking: q, driver }) => (
                <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate leading-[1.6]">{driver?.name ?? 'ผู้ใช้'}</span>
                  <span className="num shrink-0 text-muted">{fmtRange(q.start, q.end)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-lg bg-paper px-3 py-2.5 text-sm">ไม่มีคนจองต่อจากคุณ ขยายเวลาได้ทุกตัวเลือก</p>
          )}
        </div>
        {!!booking.extensions?.length && (
          <ul className="space-y-1.5 px-5 pb-5 text-sm">
            {booking.extensions.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
                <span>ขอถึง {fmtTime(x.requestedEnd)} น.</span>
                <Badge tone={x.status === 'approved' ? 'green' : 'red'}>{x.status === 'approved' ? 'อนุมัติ' : x.reason ?? 'ไม่อนุมัติ'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Button block size="lg" icon={Flag} onClick={onReturn}>
        ไปขั้นตอนคืนรถ
      </Button>

      <div className="lg:hidden">
        <InsuranceCard car={car} adminPhone={adminPhone} />
      </div>

      {/* ยืนยัน / ยกเลิก การขอขยายเวลา */}
      <Modal
        open={pending !== null}
        onClose={() => busy === null && setPending(null)}
        title={`ขอขยายเวลา +${pending ? label(pending) : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy !== null}>ยกเลิก</Button>
            <Button onClick={() => pending && void extend(pending)} loading={busy !== null} disabled={!chosen || !!chosen.conflict}>ยืนยันขยายเวลา</Button>
          </>
        }
      >
        {!chosen ? (
          <p className="text-sm text-muted">กำลังตรวจสอบคิว…</p>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-line">
              <InfoRow label="เวลาคืนเดิม" value={`${fmtTime(booking.end)} น.`} />
              <InfoRow label="เวลาคืนใหม่" value={`${fmtTime(chosen.newEnd)} น.`} />
            </div>
            {chosen.conflict ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
                <p className="font-semibold text-red-700">ขยายเวลาไม่ได้ — มีคนจองรถคันนี้ต่อ</p>
                <p className="mt-1 text-red-700/80">
                  {conflictDriver?.name ?? 'ผู้ใช้อื่น'} จองไว้ {fmtRange(chosen.conflict.start, chosen.conflict.end)} ลองเลือกเวลาที่สั้นลง หรือคืนรถตามเวลาเดิม
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <p className="font-semibold text-emerald-800">ขยายเวลาได้ — ไม่มีคนจองในช่วงนี้</p>
                <p className="mt-1 text-emerald-800/80">กดยืนยันเพื่อขยายเวลาคืนรถเป็น {fmtTime(chosen.newEnd)} น.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const EXTEND_OPTIONS = [30, 60, 120] as const

/** ชื่อสถานที่ หรือพิกัด (ถ้าเป็นหมุด GPS) */
const placeOf = (p?: GeoPoint | null) => (p ? (p.label && !p.label.startsWith('GPS') && !p.label.startsWith('ปักหมุด ') ? p.label : `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`) : '—')

/** ระหว่างขับขี่: สรุปข้อมูลที่กรอกตอนเริ่ม (เฉพาะที่จำเป็น) */
function StartInfo({ booking: b }: { booking: Booking }) {
  return (
    <Card>
      <p className="px-5 pt-4 text-[12px] font-medium text-muted">การเดินทางนี้</p>
      <ol className="relative px-5 pt-1 pb-3">
        <span className="absolute top-[20px] bottom-[28px] left-[25px] w-px bg-line" aria-hidden />
        <li className="relative flex items-start gap-3 py-2">
          <span className="mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-emerald-500 ring-1 ring-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-muted">ขึ้นรถ{b.actualStart && <span className="num"> · {fmtTime(b.actualStart)} น.</span>}</p>
            <p className="text-sm leading-snug font-medium break-words">{placeOf(b.startGps)}</p>
          </div>
        </li>
        <li className="relative flex items-start gap-3 py-2">
          <span className="mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-sun ring-1 ring-sun" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-muted">ปลายทาง</p>
            <p className="text-sm leading-snug font-medium break-words">{b.destination ? placeOf(b.destination) : <span className="font-normal text-muted">ไม่ได้ระบุ</span>}</p>
          </div>
        </li>
      </ol>
      <dl className="grid grid-cols-2 divide-x divide-line border-t border-line">
        <div className="px-5 py-3">
          <dt className="text-[12px] text-muted">เลขไมล์ตอนเริ่ม</dt>
          <dd className="num mt-0.5 font-medium">{b.startMileage != null ? fmtKm(b.startMileage) : '—'}</dd>
        </div>
        <div className="px-5 py-3">
          <dt className="text-[12px] text-muted">ผู้โดยสาร</dt>
          <dd className="num mt-0.5 font-medium">{b.passengers} คน</dd>
        </div>
      </dl>
      {b.startIssue && (
        <div className="flex gap-2.5 border-t border-line bg-amber-50/60 px-5 py-3 text-[13px]">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
          <p className="min-w-0 leading-snug break-words">
            <span className="font-medium text-amber-800">แจ้งไว้ตอนเริ่ม · </span>
            {b.startIssue.note}
            {b.startIssue.photos.length > 0 && <span className="text-muted"> ({b.startIssue.photos.length} รูป)</span>}
          </p>
        </div>
      )}
    </Card>
  )
}

function InsuranceCard({ car, adminPhone }: { car: Car; adminPhone?: string }) {
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="ประกันภัยประจำรถ" subtitle={`${car.insurance.company} · ${car.insurance.type}`} />
      <div className="divide-y divide-line px-5 pt-2">
        <InfoRow label="เลขกรมธรรม์" value={car.insurance.policyNo} />
        <InfoRow label="หมดอายุ" value={fmtDate(car.insurance.expiry)} />
        <InfoRow label="พ.ร.บ. หมดอายุ" value={fmtDate(car.actExpiry)} />
      </div>
      <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <a href={`tel:${car.insurance.phone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-[15px] font-medium text-white hover:bg-red-700">
          <PhoneCall className="size-4" /> โทรฉุกเฉินประกัน {car.insurance.phone}
        </a>
        {adminPhone && (
          <a href={`tel:${adminPhone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-[15px] font-medium hover:bg-paper">
            <Phone className="size-4" /> ฝ่ายยานพาหนะ
          </a>
        )}
      </div>
    </Card>
  )
}

// ---------------- ขั้นที่ 3: คืนรถ ----------------
function ReturnStep({ booking, car, onBack }: { booking: Booking; car: Car; onBack: () => void }) {
  const toast = useToast()
  const startMileage = booking.startMileage ?? car.mileage
  const [parkingSpot, setParkingSpot] = useState(car.parkingSpot)
  const [keyLocation, setKeyLocation] = useState(car.keyLocation)
  const [fuelMethod, setFuelMethod] = useState<FuelMethod>('none')
  const [fuelAmount, setFuelAmount] = useState('')
  const [fuelSlip, setFuelSlip] = useState<Attachment | null>(null)
  const [mileage, setMileage] = useState('')
  const [gps, setGps] = useState<GeoPoint | null>(null)
  const [photos, setPhotos] = useState<Attachment[]>([])
  const [odometerPhoto, setOdometerPhoto] = useState<Attachment | null>(null)
  const [issue, setIssue] = useState<TripIssue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const end = Number(mileage)
  const distance = mileage && end >= startMileage ? end - startMileage : null
  const parkingOk = !!parkingSpot.trim() && !!keyLocation.trim()
  const fuelOk = fuelMethod === 'none' || Number(fuelAmount) > 0
  const missing = [
    !gps && 'ตำแหน่งจุดคืนรถ',
    !parkingOk && 'จุดจอด/กุญแจ',
    distance == null && 'เลขไมล์',
    !odometerPhoto && 'รูปเลขไมล์',
    !fuelOk && 'ยอดเติมน้ำมัน',
    issueMissing(issue),
  ].filter(Boolean) as string[]

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await bookingService.returnCar(booking.id, {
        mileage: end,
        parkingSpot,
        keyLocation,
        fuelMethod,
        fuelAmount: fuelAmount ? Number(fuelAmount) : undefined,
        fuelSlip,
        gps,
        photos,
        odometerPhoto,
        issue,
      })
      toast('คืนรถเรียบร้อย ขอบคุณที่ใช้บริการ')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={Flag} title="คืนรถ" subtitle="จุดจอดและกุญแจจะส่งต่อให้คนถัดไป" action={<Button size="sm" variant="ghost" onClick={onBack}>ย้อนกลับ</Button>} />
      <div className="divide-y divide-line">
        <Task n={1} title="ตำแหน่งจุดคืนรถ" done={!!gps}>
          <LocationCapture value={gps} onChange={setGps} pinColor="#003D7C" />
        </Task>
        <Task n={2} title="จุดจอดและกุญแจ" done={parkingOk}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชั้น/เสาจอด">
              <Input value={parkingSpot} onChange={(e) => setParkingSpot(e.target.value)} placeholder="เช่น B1 · เสา A3" />
            </Field>
            <Field label="คืนกุญแจที่">
              <Input value={keyLocation} onChange={(e) => setKeyLocation(e.target.value)} placeholder="เช่น ตู้กุญแจ ชั้น 1 ช่อง 01" />
            </Field>
          </div>
        </Task>
        <Task n={3} title="เลขไมล์คืนรถ" done={distance != null && !!odometerPhoto}>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <Field label="เลขไมล์บนหน้าปัด (กม.)" hint={`ตอนเริ่ม ${fmtKm(startMileage)}`}>
                <Input type="number" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder={String(startMileage)} />
              </Field>
              <div className="min-w-20 pt-[26px] text-right">
                <p className="text-[12px] text-muted">ระยะทาง</p>
                <p className="num text-lg leading-tight font-semibold">{distance != null ? fmtKm(distance) : '—'}</p>
              </div>
            </div>
            <PhotoInput value={odometerPhoto} onChange={setOdometerPhoto} label="รูปหน้าปัดเลขไมล์" placeholder="แตะเพื่อถ่ายรูปเลขไมล์" />
          </div>
        </Task>
        <Task n={4} title="การเติมน้ำมัน" done={fuelOk}>
          <Segmented
            value={fuelMethod}
            onChange={setFuelMethod}
            className="w-full"
            options={[
              { value: 'none', label: 'ไม่ได้เติม' },
              { value: 'company_card', label: 'บัตรบริษัท' },
              { value: 'reimburse', label: 'สำรองจ่าย' },
            ]}
          />
          {fuelMethod !== 'none' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="ยอดเติม (บาท)">
                <Input type="number" inputMode="decimal" value={fuelAmount} onChange={(e) => setFuelAmount(e.target.value)} placeholder="0" />
              </Field>
              <AttachmentInput label="สลิปน้ำมัน" value={fuelSlip} onChange={setFuelSlip} accept="image/*,application/pdf" capture />
            </div>
          )}
        </Task>
        <Task n={5} title="สภาพรถหลังใช้" optional done={photos.length > 0 || !!issue}>
          <div className="space-y-3">
            <PhotoSlots value={photos} onChange={setPhotos} labels={['ด้านหน้า', 'ด้านหลัง']} />
            <IssueReport value={issue} onChange={setIssue} />
          </div>
        </Task>
      </div>
      <TaskFooter missing={missing} error={error} note="ตรวจของในรถก่อนกดยืนยัน">
        <Button block size="lg" icon={Check} onClick={() => void submit()} loading={busy} disabled={missing.length > 0}>
          ยืนยันคืนรถ
        </Button>
      </TaskFooter>
    </Card>
  )
}

/** แจ้งปัญหา/รอยบนรถ (ไม่บังคับ) — ถ้าติ๊ก ต้องใส่รายละเอียดพร้อมรูป */
function IssueReport({ value, onChange }: { value: TripIssue | null; onChange: (v: TripIssue | null) => void }) {
  const on = value !== null
  return (
    <div className={cn('rounded-xl border p-4 transition-colors', on ? 'border-amber-300 bg-amber-50/60' : 'border-line')}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? { note: '', photos: [] } : null)} className="mt-0.5 size-5 shrink-0 accent-brand" />
        <span>
          <span className="block text-sm font-medium">พบปัญหาหรือรอยบนรถ <span className="font-normal text-muted">(ไม่บังคับ)</span></span>
          <span className="block text-[13px] text-muted">เช่น รอยขีดข่วน บุบ ไฟเตือน ยางอ่อน — แจ้งไว้เพื่อไม่ต้องรับผิดชอบความเสียหายเดิม</span>
        </span>
      </label>
      {on && (
        <div className="mt-4 space-y-3">
          <Field label="รายละเอียดที่พบ">
            <Textarea rows={3} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="เช่น รอยขีดข่วนประตูหลังซ้าย ยาว ~10 ซม." />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">รูปปัญหา/รอย <span className="font-normal text-red-600">*</span> <span className="font-normal text-muted">อย่างน้อย 1 รูป</span></p>
            <MultiPhotoInput value={value.photos} onChange={(photos) => onChange({ ...value, photos })} />
          </div>
        </div>
      )}
    </div>
  )
}

function Handover({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: string }) {
  return (
    <div className="border-l-[3px] border-sun pl-3.5">
      <p className="flex items-center gap-1.5 text-[12px] text-muted"><Icon className="size-3.5" strokeWidth={1.75} />{label}</p>
      <p className="mt-1 text-lg leading-snug font-semibold">{value}</p>
    </div>
  )
}

// ---------------- สรุปทริป ----------------
const FUEL_LABEL: Record<FuelMethod, string> = { none: 'ไม่ได้เติม', company_card: 'บัตรบริษัท', reimburse: 'สำรองจ่าย' }

function TripSummary({ booking }: { booking: Booking }) {
  const distance = distanceOf(booking)
  if (booking.status !== 'completed') {
    return (
      <Card className="p-6 text-center">
        <p className="font-semibold">{booking.status === 'cancelled' ? 'การจองนี้ถูกยกเลิกแล้ว' : 'การจองนี้ถูกตัดสิทธิ์ No-Show'}</p>
        <LinkButton to="/fleet" variant="secondary" className="mt-4">จองรถใหม่</LinkButton>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader icon={Check} title="สรุปการใช้รถ" subtitle="คืนรถเรียบร้อยแล้ว" />
      <div className="m-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <SummaryTile icon={Clock} label="ระยะเวลา" value={booking.actualStart && booking.actualEnd ? fmtDuration(new Date(booking.actualEnd).getTime() - new Date(booking.actualStart).getTime()) : '-'} />
        <SummaryTile icon={Flag} label="ระยะทาง" value={distance != null ? fmtKm(distance) : '-'} />
        <SummaryTile icon={Fuel} label="น้ำมัน" value={booking.fuelMethod ? `${FUEL_LABEL[booking.fuelMethod]}${booking.fuelAmount ? ` · ${fmtBaht(booking.fuelAmount)}` : ''}` : '-'} />
      </div>
      <div className="divide-y divide-line px-5 pb-5">
        <InfoRow label="เริ่มใช้จริง" value={booking.actualStart ? fmtDateTime(booking.actualStart) : '-'} />
        <InfoRow label="คืนรถจริง" value={booking.actualEnd ? fmtDateTime(booking.actualEnd) : '-'} />
        <InfoRow label="เลขไมล์" value={`${booking.startMileage?.toLocaleString('th-TH') ?? '-'} → ${booking.endMileage?.toLocaleString('th-TH') ?? '-'}`} />
        <InfoRow label="จุดจอดคืน" value={booking.returnParkingSpot ?? '-'} />
        <InfoRow label="จุดคืนกุญแจ" value={booking.returnKeyLocation ?? '-'} />
      </div>
      <TripDetails booking={booking} className="border-t border-line px-5 pt-5 pb-6" />
    </Card>
  )
}

function SummaryTile({ label, value }: { icon?: typeof Clock; label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num mt-1.5 text-lg font-medium">{value}</p>
    </div>
  )
}
