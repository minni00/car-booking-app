import { FileSpreadsheet, ImageIcon, MapPin } from 'lucide-react'
import { useState } from 'react'
import { BOOKING_STATUS_LABEL, BookingStatusBadge } from '../../components/StatusBadge'
import { TripDetails } from '../../components/TripDetails'
import { Button, Field, Input, Loading, Modal, Plate, Select, Stat } from '../../components/ui'
import { addDays, fmtDateTime, fmtDuration, parseDateKey, toDateKey } from '../../lib/date'
import { downloadCSV } from '../../lib/download'
import { fmtBaht, fmtKm } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'
import { bookingService } from '../../services/bookingService'
import { carService } from '../../services/carService'
import { userService } from '../../services/userService'
import type { Booking, Car, FuelMethod, User } from '../../types'
import { useBranchScope } from './branchScope'
import { SavingsInsights } from './SavingsInsights'
import { ExportPreviewModal, MobileCard, MobileMeta, Table, Td } from './shared'

/** วันเวลาเต็มสำหรับไฟล์ส่งออก เช่น 26/11/2569 15:00 */
const fmtExport = (v: string) => new Date(v).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const FUEL_LABEL: Record<FuelMethod, string> = { none: 'ไม่ได้เติม', company_card: 'บัตรบริษัท', reimburse: 'สำรองจ่าย' }

/** ทริปนี้มีการแจ้งปัญหา/รอยหรือไม่ */
const hasIssue = (b: Booking) => !!(b.startIssue || b.endIssue)

const IssueTag = () => <span className="inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" />แจ้งปัญหา/รอย</span>

/** จำนวนจุดตำแหน่ง / รูปถ่าย ที่บันทึกในทริป */
const pointCount = (b: Booking) => [b.pickupPin, b.startGps, b.destination, b.endGps].filter(Boolean).length
const photoCount = (b: Booking) =>
  [b.startOdometerPhoto, b.endOdometerPhoto, b.fuelSlip].filter(Boolean).length + (b.startPhotos?.length ?? 0) + (b.endPhotos?.length ?? 0) + (b.startIssue?.photos.length ?? 0) + (b.endIssue?.photos.length ?? 0)

/** ตัวนับตำแหน่ง/รูป (บอกว่าทริปนี้มีหลักฐานอะไรบ้าง) */
function TripCounts({ b }: { b: Booking }) {
  const pts = pointCount(b), pics = photoCount(b)
  if (!pts && !pics) return null
  return (
    <span className="inline-flex items-center gap-2.5 text-[12px] whitespace-nowrap text-muted">
      {pts > 0 && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" strokeWidth={1.8} /><span className="num">{pts}</span> จุด</span>}
      {pics > 0 && <span className="inline-flex items-center gap-1"><ImageIcon className="size-3.5" strokeWidth={1.8} /><span className="num">{pics}</span> รูป</span>}
    </span>
  )
}

/** ระยะทางของทริป (กม.) ถ้ามีเลขไมล์ครบ */
const distanceOf = (b: Booking) => (b.startMileage != null && b.endMileage != null ? Math.max(0, b.endMileage - b.startMileage) : null)

/** บันทึกการใช้รถ (Car Usage Log) + ส่งออก Excel */
export function UsageTab() {
  const today = toDateKey()
  const [from, setFrom] = useState(() => toDateKey(addDays(new Date(), -30)))
  const [to, setTo] = useState(today)
  const [pickedCarId, setCarId] = useState('all')
  const { all, current, scopeCars, scopeByCar } = useBranchScope()
  const [status, setStatus] = useState<'all' | Booking['status']>('all')
  const [exportOpen, setExportOpen] = useState(false)
  const [detail, setDetail] = useState<Booking | null>(null)

  const { data, loading } = useQuery(async () => {
    const [bookings, cars, users] = await Promise.all([bookingService.list(), carService.list(), userService.list()])
    return { bookings, cars, users }
  })

  if (loading || !data) return <Loading />
  const { users } = data
  const cars = scopeCars(data.cars)
  const bookings = scopeByCar(data.bookings, cars)
  // รถที่เลือกไว้ไม่อยู่ในสาขาปัจจุบัน → ทุกคัน
  const carId = cars.some((c) => c.id === pickedCarId) ? pickedCarId : 'all'
  const carOf = (id: string) => cars.find((c) => c.id === id)
  const userOf = (id: string) => users.find((u) => u.id === id)

  // กรองตามวันเริ่มใช้ (ใช้เวลาจริงถ้ามี ไม่มีใช้เวลาจอง) — ใหม่สุดก่อน
  const fromMs = parseDateKey(from).getTime()
  const toMs = parseDateKey(to).getTime() + 86_400_000
  const rows = bookings
    .filter((b) => {
      const t = new Date(b.actualStart ?? b.start).getTime()
      return t >= fromMs && t < toMs && (carId === 'all' || b.carId === carId) && (status === 'all' || b.status === status)
    })
    .sort((a, b) => (b.actualStart ?? b.start).localeCompare(a.actualStart ?? a.start))

  const totalKm = rows.reduce((s, b) => s + (distanceOf(b) ?? 0), 0)
  const totalFuel = rows.reduce((s, b) => s + (b.fuelAmount ?? 0), 0)
  const done = rows.filter((b) => b.status === 'completed').length

  const exportFilename = `fleetgo-usage-${all ? '' : `${current?.code ?? ''}-`}${from}_${to}.csv`
  const exportHeaders = ['เลขที่จอง', 'สถานะ', 'ทะเบียนรถ', 'ยี่ห้อ/รุ่น', 'ผู้ขับขี่', 'อีเมลผู้ขับ', 'แผนก', 'ผู้จอง', 'วัตถุประสงค์', 'ผู้โดยสาร', 'ปลายทาง', 'เวลาจอง (เริ่ม)', 'เวลาจอง (สิ้นสุด)', 'เริ่มใช้จริง', 'คืนรถจริง', 'ระยะเวลาใช้จริง', 'ไมล์เริ่ม', 'ไมล์คืน', 'ระยะทาง (กม.)', 'การเติมน้ำมัน', 'ค่าน้ำมัน (บาท)', 'จุดจอดตอนคืน', 'จุดเก็บกุญแจ', 'ขยายเวลา (ครั้ง)', 'รูปเลขไมล์ (เริ่ม)', 'รูปเลขไมล์ (คืน)', 'ปัญหา/รอย ตอนเริ่ม', 'ปัญหา/รอย ตอนคืน', 'จำนวนรูปปัญหา']
  const exportRows = rows.map((b) => {
    const car = carOf(b.carId)
    const driver = userOf(b.driverId)
    return [
      b.id.toUpperCase(),
      BOOKING_STATUS_LABEL[b.status],
      car?.plate ?? '',
      car ? `${car.brand} ${car.model}` : '',
      driver?.name ?? '',
      driver?.email ?? '',
      driver?.department ?? '',
      userOf(b.bookedById)?.name ?? '',
      b.purpose,
      b.passengers,
      b.destination?.label ?? '',
      fmtExport(b.start),
      fmtExport(b.end),
      b.actualStart ? fmtExport(b.actualStart) : '',
      b.actualEnd ? fmtExport(b.actualEnd) : '',
      b.actualStart && b.actualEnd ? fmtDuration(new Date(b.actualEnd).getTime() - new Date(b.actualStart).getTime()) : '',
      b.startMileage ?? '',
      b.endMileage ?? '',
      distanceOf(b) ?? '',
      b.fuelMethod ? FUEL_LABEL[b.fuelMethod] : '',
      b.fuelAmount ?? '',
      b.returnParkingSpot ?? '',
      b.returnKeyLocation ?? '',
      b.extensions?.filter((e) => e.status === 'approved').length ?? 0,
      b.startOdometerPhoto ? 'มี' : '',
      b.endOdometerPhoto ? 'มี' : '',
      b.startIssue?.note ?? '',
      b.endIssue?.note ?? '',
      (b.startIssue?.photos.length ?? 0) + (b.endIssue?.photos.length ?? 0) || '',
    ]
  })

  const exportExcel = () => setExportOpen(true)
  const confirmExport = () => downloadCSV(exportFilename, exportHeaders, exportRows)

  const usedTime = (b: Booking) => (b.actualStart ? `${fmtDateTime(b.actualStart)}${b.actualEnd ? ` – ${fmtDateTime(b.actualEnd)}` : ' (กำลังใช้)'}` : `จอง ${fmtDateTime(b.start)}`)

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:mb-8 md:grid-cols-4">
        <Stat label="ทริปในช่วงที่เลือก" value={rows.length} />
        <Stat label="คืนรถแล้ว" value={done} tone="accent" />
        <Stat label="ระยะทางรวม" value={fmtKm(totalKm)} />
        <Stat label="ค่าน้ำมันรวม" value={fmtBaht(totalFuel)} />
      </div>

      <SavingsInsights from={from} to={to} />

      {/* ตัวกรอง + ส่งออก */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          รายการใช้รถ <span className="num text-sm font-normal text-muted">{rows.length} รายการ</span>
        </h2>
        <Button variant="secondary" icon={FileSpreadsheet} onClick={exportExcel} disabled={!rows.length} className="shrink-0">
          Export Excel
        </Button>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="ตั้งแต่วันที่">
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <Field label="ถึงวันที่">
          <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </Field>
        <Field label="รถ">
          <Select value={carId} onChange={(e) => setCarId(e.target.value)}>
            <option value="all">ทุกคัน</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.plate} · {c.brand} {c.model}</option>)}
          </Select>
        </Field>
        <Field label="สถานะ">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">ทุกสถานะ</option>
            {(Object.keys(BOOKING_STATUS_LABEL) as Booking['status'][]).map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
          </Select>
        </Field>
      </div>

      <Table
        head={['เวลาใช้รถ', 'รถ', 'ผู้ขับ / วัตถุประสงค์', 'ไมล์ (เริ่ม → คืน)', 'ระยะทาง', 'น้ำมัน', 'สถานะ', '']}
        empty={!rows.length}
        mobile={rows.map((b) => {
          const car = carOf(b.carId)
          const driver = userOf(b.driverId)
          const km = distanceOf(b)
          return (
            <MobileCard key={b.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="leading-snug font-semibold">{driver?.name ?? '—'}</p>
                  <p className="line-clamp-2 text-sm text-muted">{b.purpose}</p>
                </div>
                <BookingStatusBadge status={b.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {car && <Plate plate={car.plate} size="sm" />}
                {hasIssue(b) && <IssueTag />}
                <TripCounts b={b} />
              </div>
              {hasIssue(b) && <p className="mt-2 text-sm text-amber-800">{[b.startIssue?.note, b.endIssue?.note].filter(Boolean).join(' · ')}</p>}
              <MobileMeta
                items={[
                  ['เวลาใช้รถ', usedTime(b)],
                  ['ระยะทาง', km != null ? fmtKm(km) : '—'],
                  ['ไมล์', b.startMileage != null ? `${b.startMileage.toLocaleString('th-TH')} → ${b.endMileage?.toLocaleString('th-TH') ?? '…'}` : '—'],
                  ['น้ำมัน', b.fuelMethod ? `${FUEL_LABEL[b.fuelMethod]}${b.fuelAmount ? ` · ${fmtBaht(b.fuelAmount)}` : ''}` : '—'],
                ]}
              />
              <Button size="sm" variant="secondary" block className="mt-4" onClick={() => setDetail(b)}>
                ดูรายละเอียด · ตำแหน่ง · รูป
              </Button>
            </MobileCard>
          )
        })}
      >
        {rows.map((b) => {
          const car = carOf(b.carId)
          const driver = userOf(b.driverId)
          const km = distanceOf(b)
          return (
            <tr key={b.id}>
              <Td className="text-[13px]">{usedTime(b)}</Td>
              <Td>{car && <Plate plate={car.plate} size="sm" />}</Td>
              <Td className="min-w-[200px]">
                <p className="font-medium">{driver?.name ?? '—'}</p>
                <p className="line-clamp-2 text-xs text-muted">{b.purpose}</p>
                <div className="mt-1"><TripCounts b={b} /></div>
                {hasIssue(b) && <p className="mt-1 line-clamp-2 text-xs text-amber-800" title={[b.startIssue?.note, b.endIssue?.note].filter(Boolean).join(' · ')}><IssueTag /> {[b.startIssue?.note, b.endIssue?.note].filter(Boolean).join(' · ')}</p>}
              </Td>
              <Td className="num whitespace-nowrap">{b.startMileage != null ? `${b.startMileage.toLocaleString('th-TH')} → ${b.endMileage?.toLocaleString('th-TH') ?? '…'}` : '—'}</Td>
              <Td className="num whitespace-nowrap">{km != null ? fmtKm(km) : '—'}</Td>
              <Td className="whitespace-nowrap">{b.fuelMethod ? <>{FUEL_LABEL[b.fuelMethod]}{b.fuelAmount ? <span className="block text-xs text-muted">{fmtBaht(b.fuelAmount)}</span> : null}</> : '—'}</Td>
              <Td className="whitespace-nowrap"><BookingStatusBadge status={b.status} /></Td>
              <Td className="w-px pl-2 text-right whitespace-nowrap">
                <Button size="sm" variant="secondary" onClick={() => setDetail(b)}>รายละเอียด</Button>
              </Td>
            </tr>
          )
        })}
      </Table>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="รายละเอียดการใช้รถ" size="lg">
        {detail && <UsageDetail booking={detail} car={carOf(detail.carId)} driver={userOf(detail.driverId)} usedTime={usedTime(detail)} />}
      </Modal>
      <ExportPreviewModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename={exportFilename}
        headers={exportHeaders}
        rows={exportRows}
        onConfirm={confirmExport}
      />
    </div>
  )
}

/** รายละเอียดการใช้รถ 1 ทริป (ในหน้าต่าง) */
function UsageDetail({ booking: b, car, driver, usedTime }: { booking: Booking; car?: Car; driver?: User; usedTime: string }) {
  const km = distanceOf(b)
  const meta = [car ? `${car.brand} ${car.model}` : '', km != null ? fmtKm(km) : '', b.fuelMethod ? `น้ำมัน ${FUEL_LABEL[b.fuelMethod]}${b.fuelAmount ? ` ${fmtBaht(b.fuelAmount)}` : ''}` : ''].filter(Boolean).join(' · ')
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="font-semibold break-words">
            {driver?.name ?? '—'} <span className="font-normal text-muted">· {b.purpose}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted">{usedTime}</p>
          {meta && <p className="mt-0.5 text-[13px] text-muted">{meta}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {car && <Plate plate={car.plate} size="sm" />}
          <BookingStatusBadge status={b.status} />
        </div>
      </div>
      <TripDetails booking={b} />
    </div>
  )
}
