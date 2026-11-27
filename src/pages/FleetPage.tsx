import { ArrowRight, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { ALL_BRANCHES, BranchSelect } from '../components/BranchSelect'
import { CarImage } from '../components/CarImage'
import { CarStatusBadge } from '../components/StatusBadge'
import { EmptyState, Input, Loading, PageHeader, Segmented } from '../components/ui'
import { daysUntil, fmtTime } from '../lib/date'
import { cn } from '../lib/format'
import { useBookingBranch } from '../lib/bookingBranch'
import { useQuery } from '../lib/useQuery'
import { Link } from '../router'
import { bookingService } from '../services/bookingService'
import { branchService } from '../services/branchService'
import { carName, carService } from '../services/carService'
import { settingsService } from '../services/settingsService'
import type { Car } from '../types'

type Filter = 'all' | 'available' | 'maintenance'

export function FleetPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const { data, loading } = useQuery(async () => {
    const [cars, bookings, branches, settings] = await Promise.all([carService.list(), bookingService.list(), branchService.list(), settingsService.get()])
    const now = Date.now()
    const current = new Map(
      bookings
        .filter((b) => b.status === 'in_progress' || (b.status === 'upcoming' && new Date(b.start).getTime() <= now && new Date(b.end).getTime() > now))
        .map((b) => [b.carId, b] as const),
    )
    return { cars, current, branches, serviceIntervalKm: settings.serviceIntervalKm }
  })
  const [branchId, setBranchId] = useBookingBranch(data?.branches)

  if (loading || !data) return <Loading />

  const allBranches = branchId === ALL_BRANCHES
  const branchName = (id?: string | null) => data.branches.find((b) => b.id === id)?.name
  // รถในสาขาที่เลือก
  const branchCars = allBranches ? data.cars : data.cars.filter((c) => c.branchId === branchId)
  const counts = {
    all: branchCars.length,
    available: branchCars.filter((c) => c.status === 'available').length,
    maintenance: branchCars.filter((c) => c.status === 'maintenance').length,
  }
  const term = q.trim().toLowerCase()
  const cars = branchCars
    .filter((c) => filter === 'all' || c.status === filter)
    .filter((c) => !term || `${c.plate} ${c.brand} ${c.model}`.toLowerCase().includes(term))

  return (
    <div>
      <PageHeader title="เลือกรถ" subtitle="แตะรถเพื่อดูตารางว่างรายชั่วโมงและจอง" />

      <div className="mb-5 flex flex-col gap-2.5 border-b border-line pb-5 sm:mb-6 sm:gap-3 sm:pb-6 lg:flex-row lg:items-center lg:justify-between">
        <BranchSelect branches={data.branches} value={branchId} onChange={setBranchId} className="w-full lg:order-2 lg:w-72" />
        <Segmented
          value={filter}
          onChange={setFilter}
          className="w-full lg:order-1 lg:w-auto"
          options={[
            { value: 'all', label: <>ทั้งหมด <span className="num ml-1 text-muted">{counts.all}</span></> },
            { value: 'available', label: <>ว่าง <span className="num ml-1 text-muted">{counts.available}</span></> },
            { value: 'maintenance', label: <>ซ่อมบำรุง <span className="num ml-1 text-muted">{counts.maintenance}</span></> },
          ]}
        />
        <div className="relative lg:order-3 lg:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ทะเบียน หรือรุ่นรถ" className="pl-9" />
        </div>
      </div>

      {cars.length === 0 ? (
        branchCars.length === 0 ? (
          <EmptyState title="สาขานี้ยังไม่มีรถให้จอง" description="เลือกสาขาอื่น หรือเลือก “ทุกสาขา” เพื่อดูรถทั้งหมด" />
        ) : (
          <EmptyState title="ไม่พบรถตามเงื่อนไข" description="ลองเปลี่ยนตัวกรองหรือคำค้นหา" />
        )
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
          {cars.map((car) => {
            const cur = data.current.get(car.id)
            const bookable = car.status === 'available'
            const body = (
              <>
                {/* รูปรถ: มือถือสูงคงที่ 132px (Compact Card) เต็มความกว้าง / iPad+ ใช้สัดส่วน 16:9 */}
                <div className="relative overflow-hidden rounded-2xl bg-paper">
                  <CarImage
                    car={car}
                    full
                    className={cn('h-[132px] w-full object-cover object-center transition-transform duration-300 sm:aspect-[16/9] sm:h-auto', bookable && 'group-hover:scale-[1.03]')}
                    iconClassName="size-10"
                  />
                  <span className="num absolute top-2 left-2 rounded-[4px] border-[1.5px] border-ink bg-white px-1.5 py-0.5 text-[12px] font-semibold">{car.plate}</span>
                </div>

                {/* รายละเอียด: 3 บรรทัดกระชับ */}
                <div className="mt-2 px-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[16px] font-semibold">{carName(car)}</p>
                    <CarStatusBadge car={car} inUse={!!cur} />
                  </div>
                  <p className="num mt-0.5 text-[13px] text-muted">
                    {car.mileage.toLocaleString('th-TH')} กม. · {car.fuel} · {car.seats} ที่นั่ง
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-1 text-muted">
                      <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{bookable && cur ? `ใช้งานถึง ${fmtTime(cur.end)} น.` : allBranches && branchName(car.branchId) ? `${branchName(car.branchId)} · ${car.parkingSpot}` : car.parkingSpot}</span>
                    </span>
                    {bookable ? (
                      <span className="flex shrink-0 items-center gap-1 font-semibold text-brand">
                        จอง <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-muted">ปิดจองชั่วคราว</span>
                    )}
                  </div>
                  <CarHealth car={car} intervalKm={data.serviceIntervalKm} />
                </div>
              </>
            )
            return bookable ? (
              <Link key={car.id} to={`/book/${car.id}`} className="group block">
                {body}
              </Link>
            ) : (
              <div key={car.id} className="opacity-60">
                {body}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Level = 'ok' | 'soon' | 'overdue'
const LEVEL_DOT: Record<Level, string> = { ok: 'bg-emerald-500', soon: 'bg-amber-500', overdue: 'bg-red-500' }
const LEVEL_TEXT: Record<Level, string> = { ok: 'text-ink/80', soon: 'text-amber-700', overdue: 'text-red-600' }

/** วันหมดอายุแบบสั้น เช่น 12 มี.ค. 70 */
const fmtExpiry = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

/** สถานะเอกสาร: หมดอายุแล้ว / ภายใน 30 วัน / ปกติ (เกณฑ์เดียวกับการแจ้งเตือนในหน้าแอดมิน) */
function docStatus(expiry: string): { level: Level; text: string } {
  if (!expiry) return { level: 'ok', text: '—' }
  const d = daysUntil(expiry)
  if (d < 0) return { level: 'overdue', text: `หมดแล้ว ${fmtExpiry(expiry)}` }
  if (d <= 30) return { level: 'soon', text: `อีก ${d} วัน` }
  return { level: 'ok', text: fmtExpiry(expiry) }
}

/** เช็กระยะ / พ.ร.บ. / ประกัน ของรถแต่ละคัน */
function CarHealth({ car, intervalKm }: { car: Car; intervalKm: number }) {
  const left = car.lastServiceMileage + intervalKm - car.mileage
  const service: { level: Level; text: string } =
    left <= 0 ? { level: 'overdue', text: `เลย ${Math.abs(left).toLocaleString('th-TH')} กม.` } : { level: left <= 1000 ? 'soon' : 'ok', text: `อีก ${left.toLocaleString('th-TH')} กม.` }
  const items: Array<[string, { level: Level; text: string }]> = [
    ['เช็กระยะ', service],
    ['พ.ร.บ.', docStatus(car.actExpiry)],
    ['ประกัน', docStatus(car.insurance.expiry)],
  ]
  return (
    <dl className="mt-2.5 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-paper/60">
      {items.map(([label, st]) => (
        <div key={label} className="min-w-0 px-2.5 py-2">
          <dt className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('size-1.5 shrink-0 rounded-full', LEVEL_DOT[st.level])} />
            {label}
          </dt>
          <dd className={cn('num mt-0.5 truncate text-[12px] font-medium', LEVEL_TEXT[st.level])} title={st.text}>
            {st.text}
          </dd>
        </div>
      ))}
    </dl>
  )
}
