import { ArrowRight, CalendarArrowDown } from 'lucide-react'
import { BookingRules } from '../components/BookingRules'
import { EmailSentNotice } from '../components/EmailInbox'
import { Button, Card, InfoRow, LinkButton, Loading, SectionTitle } from '../components/ui'
import { fmtDateShort, fmtTime } from '../lib/date'
import { downloadICS } from '../lib/download'
import { useQuery } from '../lib/useQuery'
import { bookingService } from '../services/bookingService'
import { branchService } from '../services/branchService'
import { carName, carService } from '../services/carService'
import { settingsService } from '../services/settingsService'
import { userService } from '../services/userService'

export function BookingConfirmedPage({ bookingId }: { bookingId: string }) {
  const { data, loading } = useQuery(async () => {
    const booking = await bookingService.get(bookingId)
    if (!booking) return null
    const [car, driver, settings, branches] = await Promise.all([carService.get(booking.carId), userService.get(booking.driverId), settingsService.get(), branchService.list()])
    return { booking, car, driver, settings, branch: branches.find((b) => b.id === car?.branchId) ?? null }
  }, [bookingId])

  if (loading) return <Loading />
  if (!data?.car) return <Card className="p-8 text-center">ไม่พบการจองนี้</Card>
  const { booking, car, driver, settings } = data

  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-line pb-8">
        <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> ยืนยันการจองแล้ว
        </p>
        <h1 className="num mt-3 text-[40px] leading-none font-medium tracking-tight md:text-[64px]">
          {fmtTime(booking.start)}<span className="text-ink/25">–</span>{fmtTime(booking.end)}
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          {fmtDateShort(booking.start)} · {carName(car)} · <span className="num text-ink">{car.plate}</span>
        </p>
        <EmailSentNotice bookingId={booking.id} kind="booking_confirmed" />
      </header>

      <div className="grid grid-cols-1 gap-10 py-8 md:grid-cols-2">
        <section>
          <SectionTitle>รายละเอียด</SectionTitle>
          <div className="divide-y divide-line border-y border-line">
            <InfoRow label="เลขที่การจอง" value={<span className="num">{booking.id.toUpperCase()}</span>} />
            <InfoRow label="ผู้ขับขี่" value={driver?.name ?? '-'} />
            {data.branch && <InfoRow label="สาขา" value={data.branch.name} />}
            <InfoRow label="จุดจอด" value={car.parkingSpot} />
            <InfoRow label="รับกุญแจ" value={car.keyLocation} />
            <InfoRow label="ปลายทาง" value={booking.destination?.label ?? 'ไม่ระบุ'} />
          </div>
        </section>
        <section>
          <SectionTitle>กติกาที่ต้องทราบ</SectionTitle>
          <BookingRules settings={settings} />
        </section>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row">
        <LinkButton to={`/trip/${booking.id}`}>
          ไปหน้าเริ่มใช้รถ <ArrowRight className="size-4" strokeWidth={1.75} />
        </LinkButton>
        <Button variant="secondary" icon={CalendarArrowDown} onClick={() => downloadICS(booking, car, driver)}>
          เพิ่มลงปฏิทิน (.ics)
        </Button>
        <LinkButton to="/bookings" variant="ghost">
          การจองของฉัน
        </LinkButton>
      </div>
    </div>
  )
}
