import { AlertTriangle, CircleAlert, FileSpreadsheet, Pencil, Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { AttachmentInput, AttachmentThumb, AttachmentViewer } from '../../components/Attachments'
import { errorMessage, useToast } from '../../components/Toast'
import { Badge, Button, Card, CardHeader, ErrorText, Field, Input, Loading, Modal, Plate, Select, Stat, Textarea } from '../../components/ui'
import { fmtDate, fmtDateTime, toDateKey } from '../../lib/date'
import { downloadCSV } from '../../lib/download'
import { cn, fmtBaht, fmtKm } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'
import { carService } from '../../services/carService'
import { MAINTENANCE_TYPE_LABEL, maintenanceService, type MaintenanceAlert, type MaintenanceInput } from '../../services/maintenanceService'
import { settingsService } from '../../services/settingsService'
import type { Car, MaintenanceRecord, MaintenanceType } from '../../types'
import { useBranchScope } from './branchScope'
import { DeleteButton, ExportPreviewModal, MobileCard, MobileMeta, Table, Td, Toolbar } from './shared'

type Editing = { record: MaintenanceRecord | null; preset?: Partial<MaintenanceInput> }

export function MaintenanceTab() {
  const { scopeCars, scopeByCar } = useBranchScope()
  const toast = useToast()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const { data, loading } = useQuery(async () => {
    const [records, cars, settings] = await Promise.all([maintenanceService.list(), carService.list(), settingsService.get()])
    return { records, cars, settings, alerts: maintenanceService.alerts(cars, settings) }
  })

  if (loading || !data) return <Loading />
  const { settings } = data
  const cars = scopeCars(data.cars)
  const records = scopeByCar(data.records, cars)
  const alerts = scopeByCar(data.alerts, cars)
  const carOf = (id: string) => cars.find((c) => c.id === id)
  const year = new Date().getFullYear()
  const yearCost = records.filter((r) => r.date.startsWith(String(year))).reduce((s, r) => s + r.cost, 0)
  const exportFilename = `fleetgo-maintenance-${toDateKey()}.csv`
  const exportHeaders = ['รหัสรายการ', 'วันที่', 'ทะเบียนรถ', 'ประเภท', 'รายละเอียด', 'อู่ / ผู้ให้บริการ', 'ค่าใช้จ่าย (บาท)', 'เลขไมล์', 'หมดอายุใหม่', 'ไฟล์แนบ', 'สร้างรายการเมื่อ']
  const exportRows = records.map((r) => [
    r.id,
    r.date,
    carOf(r.carId)?.plate ?? '',
    MAINTENANCE_TYPE_LABEL[r.type],
    r.description,
    r.vendor,
    r.cost,
    r.mileage,
    r.nextDueDate ?? '',
    r.attachment?.name ?? '',
    fmtDateTime(r.createdAt),
  ])
  const confirmExport = () => downloadCSV(exportFilename, exportHeaders, exportRows)

  const quickFix = (a: MaintenanceAlert) => {
    const car = carOf(a.carId)
    const type: MaintenanceType = a.kind === 'service' ? 'service' : a.kind
    setEditing({ record: null, preset: { carId: a.carId, type, mileage: car?.mileage ?? 0, description: a.kind === 'service' ? `เช็กระยะ ${(((car?.lastServiceMileage ?? 0) + settings.serviceIntervalKm)).toLocaleString('th-TH')} กม.` : MAINTENANCE_TYPE_LABEL[type] } })
  }

  const setMaintenance = async (car: Car) => {
    try {
      await carService.setStatus(car.id, 'maintenance')
      toast(`${car.plate} ปิดซ่อมบำรุงแล้ว`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <Stat label={`ค่าใช้จ่ายปี ${year + 543}`} value={fmtBaht(yearCost)} />
        <Stat label="รายการซ่อมทั้งหมด" value={records.length} />
        <Stat label="เลยกำหนด" value={alerts.filter((a) => a.level === 'overdue').length} icon={CircleAlert} tone="red" />
        <Stat label="ใกล้ถึงกำหนด" value={alerts.filter((a) => a.level === 'soon').length} icon={AlertTriangle} tone="amber" />
      </div>

      <Card>
        <CardHeader icon={AlertTriangle} title="การแจ้งเตือน" subtitle={`เช็กระยะทุก ${settings.serviceIntervalKm.toLocaleString('th-TH')} กม. · พ.ร.บ./ประกัน ล่วงหน้า 30 วัน`} />
        {alerts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">ไม่มีรายการที่ต้องดำเนินการ</p>
        ) : (
          <ul className="grid gap-x-8 gap-y-6 p-5 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((a, i) => {
              const car = carOf(a.carId)
              return (
                <li key={`${a.carId}-${a.kind}-${i}`} className={cn('flex flex-col border-l-2 py-1 pl-4', a.level === 'overdue' ? 'border-red-500' : 'border-amber-500')}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn('font-semibold', a.level === 'overdue' ? 'text-red-700' : 'text-ink')}>{a.title}</p>
                      <p className="text-sm text-muted">{a.detail}</p>
                    </div>
                    {car && <Plate plate={car.plate} size="sm" />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={Plus} onClick={() => quickFix(a)}>บันทึกรายการ</Button>
                    {car && a.kind === 'service' && car.status === 'available' && (
                      <Button size="sm" variant="ghost" icon={Wrench} onClick={() => void setMaintenance(car)}>ปิดซ่อม</Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div>
        <Toolbar>
          <h2 className="text-lg font-semibold">ประวัติซ่อมบำรุง</h2>
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setExportOpen(true)} disabled={!records.length}>Export Excel</Button>
            <Button icon={Plus} onClick={() => setEditing({ record: null })}>บันทึกซ่อมใหม่</Button>
          </div>
        </Toolbar>
        <Table
          head={['วันที่', 'รถ', 'ประเภท', 'รายละเอียด', 'อู่ / ผู้ให้บริการ', 'เลขไมล์', 'ค่าใช้จ่าย', 'ไฟล์', '']}
          empty={!records.length}
          mobile={records.map((r) => {
            const car = carOf(r.carId)
            return (
              <MobileCard key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{MAINTENANCE_TYPE_LABEL[r.type]}</Badge>
                      {car && <Plate plate={car.plate} size="sm" />}
                    </div>
                    <p className="mt-2 font-medium">{r.description}</p>
                  </div>
                  <p className="shrink-0 font-display text-lg font-semibold">{fmtBaht(r.cost)}</p>
                </div>
                <MobileMeta
                  items={[
                    ['วันที่', fmtDate(r.date)],
                    ['เลขไมล์', fmtKm(r.mileage)],
                    ['อู่ / ผู้ให้บริการ', r.vendor || '—'],
                    ...(r.nextDueDate ? ([['หมดอายุใหม่', fmtDate(r.nextDueDate)]] as Array<[string, string]>) : []),
                  ]}
                />
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                  {r.attachment ? (
                    <AttachmentViewer attachment={r.attachment} className="gap-2 text-sm text-accent">
                      <AttachmentThumb attachment={r.attachment} className="size-8" /> ดูไฟล์แนบ
                    </AttachmentViewer>
                  ) : (
                    <span className="text-sm text-muted">ไม่มีไฟล์แนบ</span>
                  )}
                  <div className="flex items-center gap-1"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing({ record: r })}>แก้ไข</Button><DeleteButton itemLabel={`${MAINTENANCE_TYPE_LABEL[r.type]} · ${carOf(r.carId)?.plate ?? ''} · ${r.description}`} title="ลบรายการซ่อมนี้?" detail="ข้อมูลเลขไมล์เช็กระยะหรือวันหมดอายุที่อัปเดตในรถไปแล้วจะไม่ถูกย้อนกลับ ไม่สามารถกู้คืนได้" successMessage="ลบรายการซ่อมแล้ว" onConfirm={() => maintenanceService.remove(r.id)} /></div>
                </div>
              </MobileCard>
            )
          })}
        >
          {records.map((r) => {
            const car = carOf(r.carId)
            return (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                <Td>{car && <Plate plate={car.plate} size="sm" />}</Td>
                <Td><Badge>{MAINTENANCE_TYPE_LABEL[r.type]}</Badge></Td>
                <Td className="max-w-64">
                  <p>{r.description}</p>
                  {r.nextDueDate && <p className="text-xs text-muted">หมดอายุใหม่ {fmtDate(r.nextDueDate)}</p>}
                </Td>
                <Td className="whitespace-nowrap text-muted">{r.vendor || '—'}</Td>
                <Td className="whitespace-nowrap">{fmtKm(r.mileage)}</Td>
                <Td className="font-medium whitespace-nowrap">{fmtBaht(r.cost)}</Td>
                <Td>
                  {r.attachment ? (
                    <AttachmentViewer attachment={r.attachment}>
                      <AttachmentThumb attachment={r.attachment} className="size-9" />
                    </AttachmentViewer>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-1"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing({ record: r })}>แก้ไข</Button><DeleteButton itemLabel={`${MAINTENANCE_TYPE_LABEL[r.type]} · ${carOf(r.carId)?.plate ?? ''} · ${r.description}`} title="ลบรายการซ่อมนี้?" detail="ข้อมูลเลขไมล์เช็กระยะหรือวันหมดอายุที่อัปเดตในรถไปแล้วจะไม่ถูกย้อนกลับ ไม่สามารถกู้คืนได้" successMessage="ลบรายการซ่อมแล้ว" onConfirm={() => maintenanceService.remove(r.id)} /></div>
                </Td>
              </tr>
            )
          })}
        </Table>
      </div>

      <ExportPreviewModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename={exportFilename}
        headers={exportHeaders}
        rows={exportRows}
        onConfirm={confirmExport}
      />
      {editing && <MaintenanceFormModal key={editing.record?.id ?? 'new'} editing={editing} cars={cars} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MaintenanceFormModal({ editing, cars, onClose }: { editing: Editing; cars: Car[]; onClose: () => void }) {
  const toast = useToast()
  const r = editing.record
  const [form, setForm] = useState<MaintenanceInput>(() =>
    r
      ? { carId: r.carId, date: r.date, type: r.type, description: r.description, vendor: r.vendor, cost: r.cost, mileage: r.mileage, nextDueDate: r.nextDueDate, attachment: r.attachment ?? null }
      : { carId: cars[0]?.id ?? '', date: toDateKey(), type: 'service', description: '', vendor: '', cost: 0, mileage: cars[0]?.mileage ?? 0, attachment: null, ...editing.preset },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof MaintenanceInput>(k: K, v: MaintenanceInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const needsDue = form.type === 'act' || form.type === 'insurance'

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const input = { ...form, nextDueDate: needsDue ? form.nextDueDate : undefined }
      if (r) await maintenanceService.update(r.id, input)
      else await maintenanceService.create(input)
      toast(r ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกซ่อมบำรุงแล้ว')
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
      title={r ? 'แก้ไขรายการซ่อม' : 'บันทึกซ่อมใหม่'}
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
            <Select
              value={form.carId}
              onChange={(e) => {
                const car = cars.find((c) => c.id === e.target.value)
                setForm((f) => ({ ...f, carId: e.target.value, mileage: r ? f.mileage : (car?.mileage ?? f.mileage) }))
              }}
            >
              {cars.map((c) => <option key={c.id} value={c.id}>{c.plate} · {c.brand} {c.model}</option>)}
            </Select>
          </Field>
          <Field label="ประเภท">
            <Select value={form.type} onChange={(e) => set('type', e.target.value as MaintenanceType)}>
              {(Object.keys(MAINTENANCE_TYPE_LABEL) as MaintenanceType[]).map((t) => <option key={t} value={t}>{MAINTENANCE_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="วันที่"><Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="เลขไมล์ (กม.)" hint={form.type === 'service' ? 'บันทึกเช็กระยะจะรีเซ็ตรอบเตือน 10,000 กม.' : undefined}>
            <Input type="number" min={0} value={form.mileage} onChange={(e) => set('mileage', Number(e.target.value))} />
          </Field>
        </div>
        {needsDue && (
          <Field label={form.type === 'act' ? 'วันหมดอายุ พ.ร.บ. ใหม่' : 'วันหมดอายุกรมธรรม์ใหม่'} hint="ระบบจะอัปเดตวันหมดอายุในข้อมูลรถให้อัตโนมัติ">
            <Input type="date" value={form.nextDueDate ?? ''} onChange={(e) => set('nextDueDate', e.target.value)} />
          </Field>
        )}
        <Field label="รายละเอียด"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="อู่ / ผู้ให้บริการ"><Input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
          <Field label="ค่าใช้จ่าย (บาท)"><Input type="number" min={0} value={form.cost} onChange={(e) => set('cost', Number(e.target.value))} /></Field>
        </div>
        <AttachmentInput label="แนบรูปใบเสร็จ / กรมธรรม์ PDF" value={form.attachment} onChange={(v) => set('attachment', v)} />
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
