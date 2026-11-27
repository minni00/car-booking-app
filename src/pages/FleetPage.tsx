import { ArrowRight, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { CarImage } from '../components/CarImage'
import { CarStatusBadge } from '../components/StatusBadge'
import { EmptyState, Input, Loading, PageHeader, Segmented } from '../components/ui'
import { fmtTime } from '../lib/date'
import { cn } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { Link } from '../router'
import { bookingService } from '../services/bookingService'
import { carName, carService } from '../services/carService'

type Filter = 'all' | 'available' | 'maintenance'

export function FleetPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const { data, loading } = useQuery(async () => {
    const [cars, bookings] = await Promise.all([carService.list(), bookingService.list()])
    const now = Date.now()
    const current = new Map(
      bookings
        .filter((b) => b.status === 'in_progress' || (b.status === 'upcoming' && new Date(b.start).getTime() <= now && new Date(b.end).getTime() > now))
        .map((b) => [b.carId, b] as const),
    )
    return { cars, current }
  })

  if (loading || !data) return <Loading />

  const counts = {
    all: data.cars.length,
    available: data.cars.filter((c) => c.status === 'available').length,
    maintenance: data.cars.filter((c) => c.status === 'maintenance').length,
  }
  const term = q.trim().toLowerCase()
  const cars = data.cars
    .filter((c) => filter === 'all' || c.status === filter)
    .filter((c) => !term || `${c.plate} ${c.brand} ${c.model}`.toLowerCase().includes(term))

  return (
    <div>
      <PageHeader title="เลือกรถ" subtitle="แตะรถเพื่อดูตารางว่างรายชั่วโมงและจอง" />

      <div className="mb-5 flex flex-col gap-2.5 border-b border-line pb-5 sm:mb-6 sm:gap-3 sm:pb-6 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          className="w-full sm:w-auto"
          options={[
            { value: 'all', label: <>ทั้งหมด <span className="num ml-1 text-muted">{counts.all}</span></> },
            { value: 'available', label: <>ว่าง <span className="num ml-1 text-muted">{counts.available}</span></> },
            { value: 'maintenance', label: <>ซ่อมบำรุง <span className="num ml-1 text-muted">{counts.maintenance}</span></> },
          ]}
        />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ทะเบียน หรือรุ่นรถ" className="pl-9" />
        </div>
      </div>

      {cars.length === 0 ? (
        <EmptyState title="ไม่พบรถตามเงื่อนไข" description="ลองเปลี่ยนตัวกรองหรือคำค้นหา" />
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
                      <span className="truncate">{bookable && cur ? `ใช้งานถึง ${fmtTime(cur.end)} น.` : car.parkingSpot}</span>
                    </span>
                    {bookable ? (
                      <span className="flex shrink-0 items-center gap-1 font-semibold text-brand">
                        จอง <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    ) : (
                      <span className="shrink-0 text-muted">ปิดจองชั่วคราว</span>
                    )}
                  </div>
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
