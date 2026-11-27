import { CalendarCheck, CarFront, CircleCheck, FileSpreadsheet, Pencil, Plus, Route, Wrench } from 'lucide-react'
import { useState } from 'react'
import { AttachmentInput } from '../../components/Attachments'
import { CarImage } from '../../components/CarImage'
import { CarStatusBadge } from '../../components/StatusBadge'
import { errorMessage, useToast } from '../../components/Toast'
import { Button, ErrorText, Field, Input, Loading, Modal, Plate, Select, Stat, Switch } from '../../components/ui'
import { addDays, toDateKey } from '../../lib/date'
import { downloadCSV } from '../../lib/download'
import { fmtKm } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'
import { bookingService } from '../../services/bookingService'
import { carName, carService, type CarInput } from '../../services/carService'
import type { Branch, Car, FuelType } from '../../types'
import { useBranchScope } from './branchScope'
import { DeleteButton, ExportPreviewModal, MobileCard, MobileMeta, Table, Td } from './shared'

const FUELS: FuelType[] = ['เบนซิน', 'ดีเซล', 'ไฮบริด', 'ไฟฟ้า']

const emptyCar = (): CarInput => ({
  plate: '',
  province: 'กรุงเทพมหานคร',
  brand: '',
  model: '',
  color: '',
  seats: 5,
  fuel: 'เบนซิน',
  mileage: 0,
  status: 'available',
  parkingSpot: '',
  keyLocation: '',
  image: null,
  insurance: { company: '', policyNo: '', type: 'ชั้น 1', phone: '', expiry: toDateKey(addDays(new Date(), 365)) },
  actExpiry: toDateKey(addDays(new Date(), 365)),
  lastServiceMileage: 0,
  branchId: null,
})

function toInput(car: Car): CarInput {
  const { id, ...rest } = car
  void id
  return structuredClone(rest)
}

export function CarsTab() {
  const toast = useToast()
  const [editing, setEditing] = useState<{ id: string | null; form: CarInput } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const { branches, branchId, all, scopeCars, scopeByCar, branchName } = useBranchScope()

  const { data, loading } = useQuery(async () => {
    const [cars, bookings] = await Promise.all([carService.list(), bookingService.list()])
    return { cars, bookings }
  })

  if (loading || !data) return <Loading />

  const cars = scopeCars(data.cars)
  const bookings = scopeByCar(data.bookings, cars)
  const today = toDateKey()
  const inUse = new Set(bookings.filter((b) => b.status === 'in_progress').map((b) => b.carId))
  const todayCount = bookings.filter((b) => toDateKey(b.start) === today && b.status !== 'cancelled').length
  const exportFilename = `fleetgo-cars-${all ? '' : `${branches.find((b) => b.id === branchId)?.code ?? ''}-`}${today}.csv`
  const exportHeaders = ['รหัสรถ', 'สาขา', 'ทะเบียน', 'จังหวัด', 'ยี่ห้อ', 'รุ่น', 'สี', 'ที่นั่ง', 'เชื้อเพลิง', 'เลขไมล์', 'สถานะการจอง', 'สถานะการใช้', 'จุดจอด', 'จุดรับกุญแจ', 'บริษัทประกัน', 'เลขกรมธรรม์', 'ประเภทประกัน', 'โทรศัพท์ประกัน', 'หมดอายุประกัน', 'หมดอายุ พ.ร.บ.', 'ไมล์เช็กระยะล่าสุด', 'รูปภาพ']
  const exportRows = cars.map((car) => [
    car.id,
    branchName(car),
    car.plate,
    car.province,
    car.brand,
    car.model,
    car.color,
    car.seats,
    car.fuel,
    car.mileage,
    car.status === 'available' ? 'เปิดจอง' : 'ปิดซ่อม',
    car.status === 'maintenance' ? 'ซ่อมบำรุง' : inUse.has(car.id) ? 'กำลังใช้' : 'ว่าง',
    car.parkingSpot,
    car.keyLocation,
    car.insurance.company,
    car.insurance.policyNo,
    car.insurance.type,
    car.insurance.phone,
    car.insurance.expiry,
    car.actExpiry,
    car.lastServiceMileage,
    car.image?.name ?? '',
  ])
  const confirmExport = () => downloadCSV(exportFilename, exportHeaders, exportRows)

  const toggle = async (car: Car, open: boolean) => {
    try {
      await carService.setStatus(car.id, open ? 'available' : 'maintenance')
      toast(open ? `${car.plate} เปิดให้จองแล้ว` : `${car.plate} ปิดซ่อมบำรุงแล้ว`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      {/* สถิติ: มือถือ 2 คอลัมน์ (ช่องสุดท้ายเต็มความกว้าง) / iPad+ 5 คอลัมน์แถวเดียว */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:mb-8 md:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
        <Stat label="รถทั้งหมด" value={cars.length} icon={CarFront} />
        <Stat label="พร้อมใช้" value={cars.filter((c) => c.status === 'available' && !inUse.has(c.id)).length} icon={CircleCheck} tone="accent" />
        <Stat label="กำลังใช้งาน" value={inUse.size} icon={Route} />
        <Stat label="ซ่อมบำรุง" value={cars.filter((c) => c.status === 'maintenance').length} icon={Wrench} tone="amber" />
        <Stat label="การจองวันนี้" value={todayCount} icon={CalendarCheck} />
      </div>

      {/* หัวรายการ: มือถือวางหัวข้อกับปุ่มแถวเดียวกัน ประหยัดพื้นที่ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
        <h2 className="text-[17px] font-semibold md:text-lg">
          รายการรถ <span className="num text-[14px] font-normal text-muted">{cars.length} คัน</span>
        </h2>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setExportOpen(true)} disabled={!cars.length}>
            Export Excel
          </Button>
          <Button icon={Plus} onClick={() => setEditing({ id: null, form: { ...emptyCar(), branchId: all ? (branches[0]?.id ?? null) : branchId } })}>
            เพิ่มข้อมูลรถ
          </Button>
        </div>
      </div>

      <Table
        head={['รูป', 'ทะเบียน', 'รุ่น', 'เลขไมล์', 'เชื้อเพลิง / ที่นั่ง', 'จุดจอด', 'สถานะ', 'เปิดจอง / ปิดซ่อม', '']}
        empty={!cars.length}
        mobile={cars.map((car) => (
          <MobileCard key={car.id}>
            <div className="flex gap-3">
              <CarImage car={car} className="h-16 w-24 shrink-0 rounded-xl" iconClassName="size-6" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 leading-snug font-semibold">{carName(car)}</p>
                  <CarStatusBadge car={car} inUse={inUse.has(car.id)} />
                </div>
                <div className="mt-1.5">
                  <Plate plate={car.plate} size="sm" />
                </div>
              </div>
            </div>
            <MobileMeta
              items={[
                ['เลขไมล์', fmtKm(car.mileage)],
                ['เชื้อเพลิง / ที่นั่ง', `${car.fuel} · ${car.seats} ที่`],
                ['จุดจอด', car.parkingSpot],
                ['รับกุญแจ', car.keyLocation],
                ...(all ? [['สาขา', branchName(car)] as [string, string]] : []),
              ]}
            />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <label className="flex items-center gap-2.5">
                <Switch checked={car.status === 'available'} onChange={(v) => void toggle(car, v)} label="เปิดจอง" />
                <span className="text-sm">{car.status === 'available' ? 'เปิดจอง' : 'ปิดซ่อม'}</span>
              </label>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing({ id: car.id, form: toInput(car) })}>
                แก้ไข
              </Button>
                <DeleteButton itemLabel={`${car.plate} · ${car.brand} ${car.model}`} title="ลบรถคันนี้?" detail="ลบออกจากรายการรถและปิดการจอง ประวัติการใช้รถและใบสั่งเดิมยังเก็บไว้ ไม่สามารถกู้คืนได้" successMessage="ลบรถแล้ว" onConfirm={() => carService.remove(car.id)} />
              </div>
            </div>
          </MobileCard>
        ))}
      >
        {cars.map((car) => (
          <tr key={car.id}>
            {/* รูป 64×48 คงที่ */}
            <Td className="w-[96px] py-2.5">
              <CarImage car={car} className="h-12 w-16 shrink-0 rounded-lg object-cover" iconClassName="size-5" />
            </Td>
            <Td className="w-[110px]">
              <Plate plate={car.plate} size="sm" />
            </Td>
            {/* รุ่น: กว้าง 180–240px ชื่อสูงสุด 2 บรรทัด */}
            <Td className="min-w-[180px] xl:w-[240px]">
              <p className="line-clamp-2 leading-snug font-medium" title={carName(car)}>
                {carName(car)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {car.color}
                {all && <> · {branchName(car)}</>}
              </p>
            </Td>
            <Td className="num whitespace-nowrap">{fmtKm(car.mileage)}</Td>
            <Td className="whitespace-nowrap">
              {car.fuel} · {car.seats} ที่
            </Td>
            {/* จุดจอด: กว้าง 160–260px ขึ้นบรรทัดใหม่ได้ (ไม่ตัดทิ้ง) */}
            <Td className="min-w-[160px] max-w-[260px] text-muted">
              <span className="line-clamp-2 leading-snug" title={car.parkingSpot}>
                {car.parkingSpot}
              </span>
            </Td>
            <Td className="whitespace-nowrap">
              <CarStatusBadge car={car} inUse={inUse.has(car.id)} />
            </Td>
            <Td className="whitespace-nowrap">
              <div className="flex items-center gap-2">
                <Switch checked={car.status === 'available'} onChange={(v) => void toggle(car, v)} label="เปิดจอง" />
                <span className="w-12 text-xs text-muted">{car.status === 'available' ? 'เปิดจอง' : 'ปิดซ่อม'}</span>
              </div>
            </Td>
            <Td className="w-px pl-2 text-right whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing({ id: car.id, form: toInput(car) })}>
                แก้ไข
              </Button>
                <DeleteButton itemLabel={`${car.plate} · ${car.brand} ${car.model}`} title="ลบรถคันนี้?" detail="ลบออกจากรายการรถและปิดการจอง ประวัติการใช้รถและใบสั่งเดิมยังเก็บไว้ ไม่สามารถกู้คืนได้" successMessage="ลบรถแล้ว" onConfirm={() => carService.remove(car.id)} />
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <ExportPreviewModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename={exportFilename}
        headers={exportHeaders}
        rows={exportRows}
        onConfirm={confirmExport}
      />
      {editing && <CarFormModal key={editing.id ?? 'new'} id={editing.id} initial={editing.form} branches={branches} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CarFormModal({ id, initial, branches, onClose }: { id: string | null; initial: CarInput; branches: Branch[]; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<CarInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof CarInput>(k: K, v: CarInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setIns = (k: keyof CarInput['insurance'], v: string) => setForm((f) => ({ ...f, insurance: { ...f.insurance, [k]: v } }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!form.brand.trim() || !form.model.trim()) throw new Error('กรุณากรอกยี่ห้อและรุ่น')
      if (id) await carService.update(id, form)
      else await carService.create(form)
      toast(id ? 'บันทึกข้อมูลรถแล้ว' : 'เพิ่มรถใหม่แล้ว')
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
      size="lg"
      title={id ? 'แก้ไขข้อมูลรถ' : 'เพิ่มข้อมูลรถ'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => void save()} loading={busy}>บันทึก</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <p className="mb-1.5 text-sm font-medium">ภาพตัวอย่าง</p>
            <CarImage car={{ ...form }} full className="aspect-[16/10] w-full rounded-xl border border-line" />
          </div>
          <AttachmentInput label="แนบรูปรถ" value={form.image} onChange={(v) => set('image', v)} accept="image/*" hint="ถ้าไม่แนบ ระบบจะแสดงไอคอนรถแทน" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="สาขา" className="sm:col-span-3">
            <Select value={form.branchId ?? ''} onChange={(e) => set('branchId', e.target.value || null)}>
              <option value="">ไม่ระบุสาขา</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </Select>
          </Field>
          <Field label="ทะเบียน"><Input value={form.plate} onChange={(e) => set('plate', e.target.value)} placeholder="1กข 1234" /></Field>
          <Field label="จังหวัด"><Input value={form.province} onChange={(e) => set('province', e.target.value)} /></Field>
          <Field label="สี"><Input value={form.color} onChange={(e) => set('color', e.target.value)} /></Field>
          <Field label="ยี่ห้อ"><Input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Toyota" /></Field>
          <Field label="รุ่น" className="sm:col-span-2"><Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Camry 2.5 HEV" /></Field>
          <Field label="เชื้อเพลิง">
            <Select value={form.fuel} onChange={(e) => set('fuel', e.target.value as FuelType)}>
              {FUELS.map((f) => <option key={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="ที่นั่ง"><Input type="number" min={1} value={form.seats} onChange={(e) => set('seats', Number(e.target.value))} /></Field>
          <Field label="สถานะ">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as Car['status'])}>
              <option value="available">เปิดจอง</option>
              <option value="maintenance">ปิดซ่อมบำรุง</option>
            </Select>
          </Field>
          <Field label="เลขไมล์ปัจจุบัน (กม.)"><Input type="number" min={0} value={form.mileage} onChange={(e) => set('mileage', Number(e.target.value))} /></Field>
          <Field label="เช็กระยะล่าสุดที่ (กม.)"><Input type="number" min={0} value={form.lastServiceMileage} onChange={(e) => set('lastServiceMileage', Number(e.target.value))} /></Field>
          <Field label="พ.ร.บ. หมดอายุ"><Input type="date" value={form.actExpiry} onChange={(e) => set('actExpiry', e.target.value)} /></Field>
          <Field label="ชั้น/เสาจอดประจำ" className="sm:col-span-2"><Input value={form.parkingSpot} onChange={(e) => set('parkingSpot', e.target.value)} placeholder="B1 · เสา A3" /></Field>
          <Field label="จุดรับกุญแจ"><Input value={form.keyLocation} onChange={(e) => set('keyLocation', e.target.value)} /></Field>
        </div>

        <div>
          <p className="mb-2 font-semibold">ประกันภัย</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="บริษัทประกัน"><Input value={form.insurance.company} onChange={(e) => setIns('company', e.target.value)} /></Field>
            <Field label="เลขกรมธรรม์"><Input value={form.insurance.policyNo} onChange={(e) => setIns('policyNo', e.target.value)} /></Field>
            <Field label="ประเภท"><Input value={form.insurance.type} onChange={(e) => setIns('type', e.target.value)} /></Field>
            <Field label="เบอร์ฉุกเฉิน"><Input value={form.insurance.phone} onChange={(e) => setIns('phone', e.target.value)} /></Field>
            <Field label="หมดอายุ"><Input type="date" value={form.insurance.expiry} onChange={(e) => setIns('expiry', e.target.value)} /></Field>
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
