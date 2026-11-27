import { FileSpreadsheet, Link2, Pencil, Plus, UserRoundX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AttachmentInput, AttachmentThumb, AttachmentViewer } from '../../components/Attachments'
import { errorMessage, useToast } from '../../components/Toast'
import { Badge, Button, ErrorText, Field, Input, Loading, Modal, Plate, Select, Stat } from '../../components/ui'
import { fmtDateTime, fmtRange, fromLocalInput, toLocalInput } from '../../lib/date'
import { downloadCSV } from '../../lib/download'
import { fmtBaht } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'
import { bookingService } from '../../services/bookingService'
import { carService } from '../../services/carService'
import { TICKET_STATUS_LABEL, ticketService, type TicketInput, type TicketMatch } from '../../services/ticketService'
import { userService } from '../../services/userService'
import type { Booking, Car, Ticket, User } from '../../types'
import { DeleteButton, ExportPreviewModal, MobileCard, MobileMeta, Table, Td, Toolbar } from './shared'

const STATUS_TONE: Record<Ticket['status'], 'neutral' | 'amber' | 'green'> = { pending: 'neutral', notified: 'amber', paid: 'green' }

export function TicketsTab() {
  const [editing, setEditing] = useState<Ticket | 'new' | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFilename, setExportFilename] = useState('')
  const { data, loading } = useQuery(async () => {
    const [tickets, cars, users, bookings] = await Promise.all([ticketService.list(), carService.list(), userService.list(), bookingService.list()])
    return { tickets, cars, users, bookings }
  })

  if (loading || !data) return <Loading />
  const { tickets, cars, users, bookings } = data
  const carOf = (id: string) => cars.find((c) => c.id === id)
  const userOf = (id?: string | null) => users.find((u) => u.id === id)
  const tripOf = (id?: string | null) => bookings.find((b) => b.id === id)

  const exportHeaders = ['เลขที่', 'วันเวลาเกิดเหตุ', 'ทะเบียนรถ', 'ข้อหา', 'สถานที่', 'จำนวนเงิน (บาท)', 'ผู้ขับขี่', 'อีเมลผู้ขับ', 'แผนก', 'ทริป (เวลาใช้จริง)', 'สถานะ', 'ไฟล์แนบ']
  const exportRows = tickets.map((t) => {
    const driver = userOf(t.matchedDriverId)
    const trip = tripOf(t.matchedBookingId)
    return [
      t.id.toUpperCase(),
      fmtDateTime(t.occurredAt),
      carOf(t.carId)?.plate ?? '',
      t.violation,
      t.location,
      t.amount,
      driver?.name ?? 'ไม่พบผู้ขับ',
      driver?.email ?? '',
      driver?.department ?? '',
      trip?.actualStart ? fmtRange(trip.actualStart, trip.actualEnd ?? new Date()) : '',
      TICKET_STATUS_LABEL[t.status],
      t.attachment?.name ?? '',
    ]
  })

  const exportExcel = () => {
    setExportFilename(`fleetgo-tickets-${new Date().toISOString().slice(0, 10)}.csv`)
    setExportOpen(true)
  }
  const confirmExport = () => downloadCSV(exportFilename, exportHeaders, exportRows)

  const total = tickets.reduce((s, t) => s + t.amount, 0)
  const unmatched = tickets.filter((t) => !t.matchedDriverId).length

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <Stat label="ใบสั่งทั้งหมด" value={tickets.length} />
        <Stat label="รอแจ้งผู้ขับ" value={tickets.filter((t) => t.status === 'pending').length} tone="amber" />
        <Stat label="ไม่พบผู้ขับ" value={unmatched} tone={unmatched ? 'red' : undefined} />
        <Stat label="ยอดรวม" value={fmtBaht(total)} />
      </div>

      <Toolbar>
        <h2 className="text-lg font-semibold">ใบสั่งจราจร</h2>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" icon={FileSpreadsheet} onClick={exportExcel} disabled={!tickets.length}>
            Export Excel
          </Button>
          <Button icon={Plus} onClick={() => setEditing('new')}>
            เพิ่มใบสั่ง
          </Button>
        </div>
      </Toolbar>

      <Table
        head={['วันเวลา', 'รถ', 'ข้อหา / สถานที่', 'จำนวนเงิน', 'ผู้ขับ (จับคู่อัตโนมัติ)', 'สถานะ', 'ไฟล์', '']}
        empty={!tickets.length}
        mobile={tickets.map((t) => {
          const car = carOf(t.carId)
          const driver = userOf(t.matchedDriverId)
          return (
            <MobileCard key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t.violation}</p>
                  <p className="text-sm text-muted">{t.location}</p>
                </div>
                <p className="shrink-0 font-display text-lg font-semibold">{fmtBaht(t.amount)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {car && <Plate plate={car.plate} size="sm" />}
                <Badge tone={STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
              </div>
              <MobileMeta
                items={[
                  ['วันเวลา', fmtDateTime(t.occurredAt)],
                  ['ผู้ขับ', driver ? driver.name : <span className="text-red-600">ไม่พบทริป</span>],
                ]}
              />
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                {t.attachment ? (
                  <AttachmentViewer attachment={t.attachment} className="gap-2 text-sm text-accent">
                    <AttachmentThumb attachment={t.attachment} className="size-8" /> ดูไฟล์แนบ
                  </AttachmentViewer>
                ) : (
                  <span className="text-sm text-muted">ไม่มีไฟล์แนบ</span>
                )}
                <div className="flex items-center gap-1"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(t)}>แก้ไข</Button><DeleteButton itemLabel={`${t.violation} · ${fmtBaht(t.amount)}`} title="ลบใบสั่งนี้?" successMessage="ลบใบสั่งแล้ว" onConfirm={() => ticketService.remove(t.id)} /></div>
              </div>
            </MobileCard>
          )
        })}
      >
        {tickets.map((t) => {
          const car = carOf(t.carId)
          const driver = userOf(t.matchedDriverId)
          return (
            <tr key={t.id}>
              <Td className="whitespace-nowrap">{fmtDateTime(t.occurredAt)}</Td>
              <Td>{car && <Plate plate={car.plate} size="sm" />}</Td>
              <Td>
                <p className="font-medium">{t.violation}</p>
                <p className="text-xs text-muted">{t.location}</p>
              </Td>
              <Td className="font-medium whitespace-nowrap">{fmtBaht(t.amount)}</Td>
              <Td>
                {driver ? (
                  <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5 text-accent" />{driver.name}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-red-600"><UserRoundX className="size-3.5" />ไม่พบทริป</span>
                )}
              </Td>
              <Td><Badge tone={STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge></Td>
              <Td>
                {t.attachment ? (
                  <AttachmentViewer attachment={t.attachment}>
                    <AttachmentThumb attachment={t.attachment} className="size-9" />
                  </AttachmentViewer>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td>
                <div className="flex items-center gap-1"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(t)}>แก้ไข</Button><DeleteButton itemLabel={`${t.violation} · ${fmtBaht(t.amount)}`} title="ลบใบสั่งนี้?" successMessage="ลบใบสั่งแล้ว" onConfirm={() => ticketService.remove(t.id)} /></div>
              </Td>
            </tr>
          )
        })}
      </Table>

      <ExportPreviewModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename={exportFilename}
        headers={exportHeaders}
        rows={exportRows}
        onConfirm={confirmExport}
      />
      {editing && <TicketFormModal key={editing === 'new' ? 'new' : editing.id} ticket={editing === 'new' ? null : editing} cars={cars} users={users} bookings={bookings} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TicketFormModal({ ticket, cars, users, bookings, onClose }: { ticket: Ticket | null; cars: Car[]; users: User[]; bookings: Booking[]; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<TicketInput>(() =>
    ticket
      ? { carId: ticket.carId, occurredAt: ticket.occurredAt, location: ticket.location, violation: ticket.violation, amount: ticket.amount, status: ticket.status, attachment: ticket.attachment ?? null }
      : { carId: cars[0]?.id ?? '', occurredAt: new Date().toISOString(), location: '', violation: '', amount: 500, status: 'pending', attachment: null },
  )
  const [match, setMatch] = useState<TicketMatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof TicketInput>(k: K, v: TicketInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  // แสดงผลการจับคู่ผู้ขับแบบสด จาก actual_start – actual_end
  useEffect(() => {
    let alive = true
    void ticketService.matchDriver(form.carId, form.occurredAt).then((m) => alive && setMatch(m))
    return () => {
      alive = false
    }
  }, [form.carId, form.occurredAt])

  const matchedDriver = users.find((u) => u.id === match?.driverId)
  const matchedTrip = bookings.find((b) => b.id === match?.bookingId)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (ticket) await ticketService.update(ticket.id, form)
      else await ticketService.create(form)
      toast(ticket ? 'บันทึกใบสั่งแล้ว' : 'เพิ่มใบสั่งแล้ว')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={ticket ? 'แก้ไขใบสั่ง' : 'เพิ่มใบสั่ง'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => void save()} loading={busy}>บันทึก</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="รถ">
            <Select value={form.carId} onChange={(e) => set('carId', e.target.value)}>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.plate} · {c.brand} {c.model}</option>)}
            </Select>
          </Field>
          <Field label="วันเวลาเกิดเหตุ">
            <Input type="datetime-local" value={toLocalInput(form.occurredAt)} onChange={(e) => e.target.value && set('occurredAt', fromLocalInput(e.target.value))} />
          </Field>
        </div>

        <div className={`rounded-xl border p-3 text-sm ${matchedDriver ? 'border-accent/20 bg-accent-soft' : 'border-red-200 bg-red-50'}`}>
          {matchedDriver ? (
            <>
              <p className="font-medium">จับคู่ผู้ขับอัตโนมัติ: {matchedDriver.name}</p>
              {matchedTrip?.actualStart && <p className="mt-0.5 text-xs text-muted">ทริป "{matchedTrip.purpose}" · ใช้จริง {fmtRange(matchedTrip.actualStart, matchedTrip.actualEnd ?? new Date())}</p>}
            </>
          ) : (
            <p className="text-red-700">ไม่พบทริปที่ใช้รถคันนี้ในเวลาดังกล่าว (ตรวจจาก actual_start – actual_end)</p>
          )}
        </div>

        <Field label="ข้อหา"><Input value={form.violation} onChange={(e) => set('violation', e.target.value)} placeholder="เช่น ขับรถเร็วเกินกำหนด" /></Field>
        <Field label="สถานที่"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="จำนวนเงิน (บาท)"><Input type="number" min={0} value={form.amount} onChange={(e) => set('amount', Number(e.target.value))} /></Field>
          <Field label="สถานะ">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as Ticket['status'])}>
              {(Object.keys(TICKET_STATUS_LABEL) as Ticket['status'][]).map((s) => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}
            </Select>
          </Field>
        </div>
        <AttachmentInput label="แนบรูป/PDF ใบสั่ง" value={form.attachment} onChange={(v) => set('attachment', v)} />
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
