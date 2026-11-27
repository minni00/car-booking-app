import { ArrowLeft, CalendarDays, Check, ChevronRight, Fuel, Gauge, MapPin, Navigation, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AvailabilityGrid } from '../components/AvailabilityGrid'
import { BookingRules } from '../components/BookingRules'
import { CarImage } from '../components/CarImage'
import { LazyMap } from '../components/LazyMap'
import { errorMessage, useToast } from '../components/Toast'
import { Button, Card, CardHeader, ErrorText, Field, Input, LinkButton, Loading, Modal, Plate, Segmented, Select, Textarea } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { addDays, addMinutes, combine, fmtDateShort, fmtRange, fmtTime, pad, parseDateKey, toDateKey } from '../lib/date'
import { cn, fmtKm } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { Link, navigate, useLocation } from '../router'
import { bookingService, type BookingInput } from '../services/bookingService'
import { carName, carService } from '../services/carService'
import { settingsService } from '../services/settingsService'
import { userService } from '../services/userService'
import type { GeoPoint } from '../types'

export function BookingPage({ carId }: { carId: string }) {
  const user = useCurrentUser()
  const toast = useToast()
  const { search } = useLocation()
  const editId = search.get('edit')

  const [dateKey, setDateKey] = useState(toDateKey())
  const [start, setStart] = useState<string | null>(null) // HH:mm
  const [end, setEnd] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [purpose, setPurpose] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [forOther, setForOther] = useState(false)
  const [driverId, setDriverId] = useState(user.id)
  const [destOn, setDestOn] = useState(false)
  const [destination, setDestination] = useState<GeoPoint | null>(null)
  const [pickupOn, setPickupOn] = useState(false)
  const [pickupPin, setPickupPin] = useState<GeoPoint | null>(null)
  const [carPickerOpen, setCarPickerOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef<string | null>(null)

  const { data, loading } = useQuery(async () => {
    const [car, cars, settings, users, editing] = await Promise.all([
      carService.get(carId),
      carService.list(),
      settingsService.get(),
      userService.list(),
      editId ? bookingService.get(editId) : Promise.resolve(undefined),
    ])
    const busy = await bookingService.busyBlocks(carId, dateKey, editId ?? undefined)
    return { car, cars, settings, users, editing, busy }
  }, [carId, dateKey, editId])

  // โหมดแก้ไข: เติมค่าจากการจองเดิมครั้งเดียว
  useEffect(() => {
    const b = data?.editing
    if (!b || initialized.current === b.id) return
    initialized.current = b.id
    setDateKey(toDateKey(b.start))
    setStart(fmtTime(b.start))
    setEnd(fmtTime(b.end))
    setPurpose(b.purpose)
    setPassengers(b.passengers)
    setForOther(b.driverId !== user.id)
    setDriverId(b.driverId)
    setDestination(b.destination ?? null)
    setDestOn(!!b.destination)
    setPickupPin(b.pickupPin ?? null)
    setPickupOn(!!b.pickupPin)
  }, [data?.editing, user.id])

  const settings = data?.settings
  const timeOptions = useMemo(() => {
    if (!settings) return []
    const out: string[] = []
    for (let h = settings.dayStartHour; h <= settings.dayEndHour; h++) {
      out.push(`${pad(h)}:00`)
      if (h < settings.dayEndHour) out.push(`${pad(h)}:30`)
    }
    return out
  }, [settings])

  if (loading && !data) return <Loading />
  if (data?.car && data.car.id !== carId) return <Loading />
  if (!data?.car) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold">ไม่พบรถคันนี้</p>
        <LinkButton to="/fleet" variant="secondary" className="mt-4">
          กลับไปหน้ารายการรถ
        </LinkButton>
      </Card>
    )
  }

  const { car, cars, users, busy, editing } = data
  const otherAvailableCars = cars.filter((candidate) => candidate.id !== car.id && candidate.status === 'available')
  const cfg = data.settings
  const selStart = start ? combine(dateKey, start) : null
  const selEnd = end ? combine(dateKey, end) : null
  const conflict = selStart && selEnd ? busy.some((b) => selStart.getTime() < b.blockedEnd && selEnd.getTime() > b.blockedStart) : false
  const isPast = selStart ? selStart.getTime() < Date.now() - 5 * 60_000 : false
  const invalidRange = selStart && selEnd ? selEnd <= selStart : false
  const driver = users.find((u) => u.id === (forOther ? driverId : user.id))
  const canReview = !!selStart && !!selEnd && !conflict && !isPast && !invalidRange && purpose.trim().length > 0 && car.status === 'available'
  const dayEndTime = `${pad(cfg.dayEndHour)}:00`

  const onPick = (slot: Date) => {
    const hhmm = fmtTime(slot)
    if (!picking || !selStart || slot < selStart) {
      setStart(hhmm)
      const defEnd = addMinutes(slot, 60)
      setEnd(fmtTime(defEnd) > dayEndTime || toDateKey(defEnd) !== dateKey ? dayEndTime : fmtTime(defEnd))
      setPicking(true)
    } else {
      setEnd(fmtTime(addMinutes(slot, 30)))
      setPicking(false)
    }
  }

  const changeDate = (key: string) => {
    setDateKey(key)
    setStart(null)
    setEnd(null)
    setPicking(false)
  }

  const changeCar = (nextCarId: string) => {
    setCarPickerOpen(false)
    const query = search.toString()
    navigate(`/book/${nextCarId}${query ? `?${query}` : ''}`)
  }

  const submit = async () => {
    if (!selStart || !selEnd) return
    setSubmitting(true)
    setError(null)
    const input: BookingInput = {
      carId: car.id,
      bookedById: editing?.bookedById ?? user.id,
      driverId: forOther ? driverId : user.id,
      purpose,
      passengers,
      start: selStart.toISOString(),
      end: selEnd.toISOString(),
      destination: destOn ? destination : null,
      pickupPin: pickupOn ? pickupPin : null,
    }
    try {
      const saved = editing ? await bookingService.update(editing.id, input) : await bookingService.create(input)
      toast(editing ? 'บันทึกการแก้ไขแล้ว' : 'จองรถสำเร็จ')
      navigate(`/bookings/${saved.id}/confirmed`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(new Date(), i)))

  const ready = canReview && !(forOther && driverId === user.id)
  const openReview = () => {
    setAccepted(false)
    setError(null)
    setReviewOpen(true)
  }

  return (
    <div className="pb-20 md:pb-0">
      <Link to={editing ? '/bookings' : '/fleet'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {editing ? 'การจองของฉัน' : 'รถทั้งหมด'}
      </Link>
      <h1 className="mb-6 text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] md:mb-10 md:text-[44px]">{editing ? 'แก้ไขการจอง' : 'จองรถ'}</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* ซ้าย: ข้อมูลรถ + ตารางว่างทั้งวัน */}
        <div className="space-y-5 lg:col-span-7">
          <Card className="flex overflow-hidden">
            <CarImage car={car} full className="w-24 shrink-0 sm:w-56" iconClassName="size-8 sm:size-14" />
            <div className="min-w-0 flex-1 p-3.5 sm:p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-semibold sm:text-lg">{carName(car)}</p>
                  <p className="text-sm text-muted">{car.color}</p>
                </div>
                <Plate plate={car.plate} province={car.province} size="sm" />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm sm:mt-4 sm:gap-x-5">
                <span className="flex items-center gap-1.5"><Gauge className="size-4 text-muted" />{fmtKm(car.mileage)}</span>
                <span className="flex items-center gap-1.5"><Fuel className="size-4 text-muted" />{car.fuel}</span>
                <span className="flex items-center gap-1.5"><Users className="size-4 text-muted" />{car.seats} ที่นั่ง</span>
                <span className="flex items-center gap-1.5"><MapPin className="size-4 text-muted" />{car.parkingSpot}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setCarPickerOpen(true)}>เปลี่ยนรถ</Button>
              </div>
            </div>
          </Card>

          <Card className="scroll-mt-20">
            <span id="availability" className="block scroll-mt-20" />
            <CardHeader icon={CalendarDays} title="ตารางว่างรายชั่วโมง" subtitle="แตะเวลาเริ่ม แล้วแตะเวลาสิ้นสุด" />
            <div className="p-5">
              <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.map((k) => {
                  const d = parseDateKey(k)
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => changeDate(k)}
                      className={cn('flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors', k === dateKey ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:border-ink/30')}
                    >
                      <span className={cn('text-[11px]', k === dateKey ? 'text-white/70' : 'text-muted')}>{d.toLocaleDateString('th-TH', { weekday: 'short' })}</span>
                      <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                    </button>
                  )
                })}
                <input
                  type="date"
                  value={dateKey}
                  min={toDateKey()}
                  onChange={(e) => e.target.value && changeDate(e.target.value)}
                  className="h-auto shrink-0 rounded-xl border border-line px-2 text-sm"
                  aria-label="เลือกวันอื่น"
                />
              </div>
              <AvailabilityGrid dateKey={dateKey} startHour={cfg.dayStartHour} endHour={cfg.dayEndHour} busy={busy} selStart={selStart} selEnd={selEnd} onPick={onPick} />

              {busy.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-2 text-sm font-medium">คิวที่มีคนจองแล้ว · {fmtDateShort(parseDateKey(dateKey))}</p>
                  <ul className="space-y-1.5 text-sm">
                    {busy.map((b) => (
                      <li key={b.bookingId} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2">
                        <span className="font-medium">{fmtTime(b.start)}–{fmtTime(b.end)}</span>
                        <span className="truncate text-muted">{users.find((u) => u.id === b.driverId)?.name ?? 'พนักงาน'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ขวา: ฟอร์มจอง + ปุ่มยืนยัน */}
        <div className="lg:col-span-5">
          <Card className="scroll-mt-20 lg:sticky lg:top-24">
            <span id="booking-form" className="block scroll-mt-20" />
            <CardHeader title="รายละเอียดการจอง" subtitle={fmtDateShort(parseDateKey(dateKey))} />
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="เวลารับรถ">
                  <Select value={start ?? ''} onChange={(e) => { setStart(e.target.value || null); setPicking(false) }}>
                    <option value="">เลือกเวลา</option>
                    {timeOptions.slice(0, -1).map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="เวลาคืนรถ">
                  <Select value={end ?? ''} onChange={(e) => { setEnd(e.target.value || null); setPicking(false) }}>
                    <option value="">เลือกเวลา</option>
                    {timeOptions.filter((t) => !start || t > start).map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
              </div>
              {conflict && <ErrorText>ช่วงเวลานี้ชนกับคิวอื่น กรุณาเลือกใหม่</ErrorText>}
              {isPast && <ErrorText>ไม่สามารถจองเวลาที่ผ่านมาแล้ว</ErrorText>}
              {invalidRange && <ErrorText>เวลาคืนรถต้องหลังเวลารับรถ</ErrorText>}

              <Field label="วัตถุประสงค์">
                <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="เช่น พบลูกค้า, ส่งเอกสาร" rows={2} />
              </Field>
              <Field label="จำนวนผู้โดยสาร (รวมผู้ขับ)">
                <Input type="number" min={1} max={car.seats} value={passengers} onChange={(e) => setPassengers(Math.max(1, Number(e.target.value) || 1))} />
              </Field>

              <div>
                <p className="mb-1.5 text-sm font-medium">ผู้ขับขี่จริง</p>
                <Segmented
                  value={forOther ? 'other' : 'me'}
                  onChange={(v) => { setForOther(v === 'other'); if (v === 'me') setDriverId(user.id) }}
                  className="w-full"
                  options={[{ value: 'me', label: 'ฉันขับเอง' }, { value: 'other', label: 'จองแทนเพื่อน' }]}
                />
                {forOther && (
                  <Select className="mt-2" value={driverId === user.id ? '' : driverId} onChange={(e) => setDriverId(e.target.value || user.id)}>
                    <option value="">เลือกพนักงานที่จะขับ</option>
                    {users.filter((u) => u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
                  </Select>
                )}
              </div>

              <OptionalSection icon={Navigation} title="ปลายทางบนแผนที่" on={destOn} onToggle={setDestOn}>
                <LazyMap value={destination} onChange={setDestination} height={220} />
              </OptionalSection>
              <OptionalSection icon={MapPin} title="ปักหมุดจุดขึ้นรถล่วงหน้า" on={pickupOn} onToggle={setPickupOn}>
                <LazyMap value={pickupPin} onChange={setPickupPin} height={200} gpsLabel="ใช้ตำแหน่งปัจจุบัน" />
              </OptionalSection>

              <Button block size="lg" disabled={!ready} onClick={openReview}>
                ตรวจสอบและยืนยันการจอง
              </Button>
              {!selStart && <p className="text-center text-xs text-muted">เลือกช่วงเวลาจากตารางว่างหรือช่องเวลาด้านบน</p>}
            </div>
          </Card>
        </div>
      </div>

      {/* มือถือ: แถบสรุปติดด้านล่าง (เหนือ Bottom Tab Bar) */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{fmtDateShort(parseDateKey(dateKey))}</p>
            <p className={cn('truncate font-semibold', conflict || isPast || invalidRange ? 'text-red-600' : '')}>
              {selStart && selEnd ? `${start}–${end} น.` : 'ยังไม่ได้เลือกเวลา'}
              {conflict && ' · ชนคิว'}
            </p>
          </div>
          <Button
            onClick={() => {
              if (ready) openReview()
              else document.getElementById(selStart ? 'booking-form' : 'availability')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {ready ? 'ยืนยันการจอง' : selStart ? 'กรอกรายละเอียด' : 'เลือกเวลา'}
          </Button>
        </div>
      </div>

      <Modal open={carPickerOpen} onClose={() => setCarPickerOpen(false)} title="เลือกรถคันใหม่" size="lg">
        {otherAvailableCars.length > 0 ? (
          <div className="space-y-2">
            <p className="mb-3 text-sm text-muted">วัน เวลา และรายละเอียดที่กรอกไว้จะยังคงอยู่</p>
            {otherAvailableCars.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => changeCar(candidate.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-brand/40 hover:bg-paper"
              >
                <CarImage car={candidate} className="size-16 shrink-0 rounded-lg" iconClassName="size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{carName(candidate)}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    <span className="num">{candidate.plate}</span> · {candidate.fuel} · {candidate.seats} ที่นั่ง
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">ไม่มีรถคันอื่นที่พร้อมให้จอง</p>
        )}
      </Modal>

      {/* ยืนยันการจอง: สรุป + กติกา */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="ยืนยันการจอง"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>แก้ไข</Button>
            <Button onClick={() => void submit()} loading={submitting} disabled={!accepted} icon={Check}>
              {editing ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}
            </Button>
          </>
        }
      >
        {selStart && selEnd && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{carName(car)}</p>
                <Plate plate={car.plate} size="sm" />
              </div>
              <p className="mt-2 font-display text-lg font-semibold">{fmtRange(selStart, selEnd)}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <SummaryRow label="ผู้ขับขี่" value={<span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{driver?.name}{forOther && ' (จองแทน)'}</span>} />
                <SummaryRow label="วัตถุประสงค์" value={purpose} />
                <SummaryRow label="ผู้โดยสาร" value={`${passengers} คน`} />
                <SummaryRow label="ปลายทาง" value={destOn && destination ? destination.label ?? 'ปักหมุดแล้ว' : 'ไม่ระบุ'} />
                <SummaryRow label="จุดจอด / กุญแจ" value={`${car.parkingSpot} · ${car.keyLocation}`} />
              </dl>
            </div>
            <div>
              <p className="mb-3 font-semibold">กติกาการใช้รถ</p>
              <BookingRules settings={cfg} />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 accent-[#141413]" />
              <span className="text-sm">ฉันได้อ่านและยอมรับกติกาการใช้รถ รวมถึงความรับผิดชอบใบสั่งที่เกิดขึ้นระหว่างใช้รถ</span>
            </label>
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Modal>
    </div>
  )
}

function OptionalSection({ icon: Icon, title, on, onToggle, children }: { icon: typeof MapPin; title: string; on: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={() => onToggle(!on)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
        <Icon className="size-4 text-muted" />
        <span className="flex-1 text-sm font-medium">
          {title} <span className="font-normal text-muted">(ไม่บังคับ)</span>
        </span>
        <span className={cn('text-xs font-medium', on ? 'text-accent' : 'text-muted')}>{on ? 'ซ่อน' : 'เพิ่ม'}</span>
      </button>
      {on && <div className="border-t border-line p-3.5">{children}</div>}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words">{value}</dd>
    </div>
  )
}
