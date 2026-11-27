import { ArrowUpRight, FileSpreadsheet, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { errorMessage, useToast } from '../../components/Toast'
import { Button, ErrorText, Field, Input, Loading, Modal } from '../../components/ui'
import { toDateKey } from '../../lib/date'
import { downloadCSV } from '../../lib/download'
import { useQuery } from '../../lib/useQuery'
import { navigate } from '../../router'
import { bookingService } from '../../services/bookingService'
import { branchService, type BranchInput } from '../../services/branchService'
import { carService } from '../../services/carService'
import type { Branch } from '../../types'
import { useBranchScope } from './branchScope'
import { DeleteButton, ExportPreviewModal, MobileCard, MobileMeta, Table, Td } from './shared'

const emptyBranch = (): BranchInput => ({ code: '', name: '', address: '', phone: '' })

/** จัดการสาขา — เพิ่ม/แก้ไข/ลบ และดูจำนวนรถของแต่ละสาขา */
export function BranchesTab() {
  const { setBranchId } = useBranchScope()
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const { data, loading } = useQuery(async () => {
    const [branches, cars, bookings] = await Promise.all([branchService.list(), carService.list(), bookingService.list()])
    return { branches, cars, bookings }
  })

  if (loading || !data) return <Loading />
  const { branches, cars, bookings } = data

  const stats = (id: string | null) => {
    const own = cars.filter((c) => (c.branchId ?? null) === id)
    const ids = new Set(own.map((c) => c.id))
    return {
      cars: own.length,
      available: own.filter((c) => c.status === 'available').length,
      upcoming: bookings.filter((b) => ids.has(b.carId) && (b.status === 'upcoming' || b.status === 'in_progress')).length,
    }
  }
  const unassigned = stats(null).cars

  const openCars = (id: string) => {
    setBranchId(id)
    navigate('/admin?tab=cars', { replace: true })
  }

  const exportFilename = `fleetgo-branches-${toDateKey()}.csv`
  const exportHeaders = ['รหัสสาขา', 'ชื่อสาขา', 'ที่อยู่', 'โทรศัพท์', 'จำนวนรถ', 'เปิดจอง', 'คิวจอง/กำลังใช้']
  const exportRows = branches.map((b) => {
    const s = stats(b.id)
    return [b.code, b.name, b.address, b.phone, s.cars, s.available, s.upcoming]
  })

  const deleteDetail = (b: Branch) => {
    const n = stats(b.id).cars
    return n ? `ยังมีรถสังกัด ${n} คัน ต้องย้ายรถไปสาขาอื่นก่อนจึงจะลบได้` : 'ข้อมูลสาขานี้จะถูกลบถาวร ไม่สามารถกู้คืนได้'
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
        <h2 className="text-[17px] font-semibold md:text-lg">
          สาขาทั้งหมด <span className="num text-[14px] font-normal text-muted">{branches.length} สาขา</span>
        </h2>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setExportOpen(true)} disabled={!branches.length}>
            Export Excel
          </Button>
          <Button icon={Plus} onClick={() => setEditing('new')}>
            เพิ่มสาขา
          </Button>
        </div>
      </div>

      {unassigned > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          มีรถที่ยังไม่ระบุสาขา <span className="num font-semibold">{unassigned}</span> คัน — แก้ไขได้ที่แท็บรถ
        </p>
      )}

      <Table
        head={['รหัส', 'ชื่อสาขา', 'ที่อยู่', 'โทรศัพท์', 'รถ', 'คิวจอง', '']}
        empty={!branches.length}
        mobile={branches.map((b) => {
          const s = stats(b.id)
          return (
            <MobileCard key={b.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="leading-snug font-semibold">{b.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{b.address || '—'}</p>
                </div>
                <BranchCode code={b.code} />
              </div>
              <MobileMeta
                items={[
                  ['รถ', `${s.cars} คัน · เปิดจอง ${s.available}`],
                  ['คิวจอง / กำลังใช้', `${s.upcoming} คิว`],
                  ['โทรศัพท์', b.phone ? <span className="num">{b.phone}</span> : '—'],
                ]}
              />
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                <Button size="sm" variant="ghost" icon={ArrowUpRight} onClick={() => openCars(b.id)} className="text-brand">
                  ดูรถสาขานี้
                </Button>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(b)}>
                    แก้ไข
                  </Button>
                  <DeleteButton itemLabel={`${b.code} · ${b.name}`} title="ลบสาขานี้?" detail={deleteDetail(b)} successMessage="ลบสาขาแล้ว" onConfirm={() => branchService.remove(b.id)} />
                </div>
              </div>
            </MobileCard>
          )
        })}
      >
        {branches.map((b) => {
          const s = stats(b.id)
          return (
            <tr key={b.id}>
              <Td className="w-[90px]"><BranchCode code={b.code} /></Td>
              <Td className="min-w-[160px] font-medium">{b.name}</Td>
              <Td className="min-w-[220px] text-muted"><span className="line-clamp-2 leading-snug">{b.address || '—'}</span></Td>
              <Td className="num whitespace-nowrap">{b.phone || '—'}</Td>
              <Td className="whitespace-nowrap">
                <button type="button" onClick={() => openCars(b.id)} className="group inline-flex items-center gap-1 text-left hover:text-brand">
                  <span className="num font-medium">{s.cars}</span> คัน
                  <span className="text-xs text-muted">· เปิดจอง {s.available}</span>
                  <ArrowUpRight className="size-3.5 text-muted group-hover:text-brand" />
                </button>
              </Td>
              <Td className="num whitespace-nowrap">{s.upcoming}</Td>
              <Td className="w-px pl-2 text-right whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(b)}>
                    แก้ไข
                  </Button>
                  <DeleteButton itemLabel={`${b.code} · ${b.name}`} title="ลบสาขานี้?" detail={deleteDetail(b)} successMessage="ลบสาขาแล้ว" onConfirm={() => branchService.remove(b.id)} />
                </div>
              </Td>
            </tr>
          )
        })}
      </Table>

      <ExportPreviewModal open={exportOpen} onClose={() => setExportOpen(false)} filename={exportFilename} headers={exportHeaders} rows={exportRows} onConfirm={() => downloadCSV(exportFilename, exportHeaders, exportRows)} />
      {editing && <BranchFormModal key={editing === 'new' ? 'new' : editing.id} branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BranchCode({ code }: { code: string }) {
  return <span className="num inline-flex h-6 shrink-0 items-center rounded-md bg-brand/[0.07] px-2 text-[12px] font-semibold tracking-wide text-brand">{code}</span>
}

function BranchFormModal({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<BranchInput>(() => (branch ? { code: branch.code, name: branch.name, address: branch.address, phone: branch.phone } : emptyBranch()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof BranchInput>(k: K, v: BranchInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (branch) await branchService.update(branch.id, form)
      else await branchService.create(form)
      toast(branch ? 'บันทึกข้อมูลสาขาแล้ว' : 'เพิ่มสาขาใหม่แล้ว')
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
      title={branch ? 'แก้ไขสาขา' : 'เพิ่มสาขา'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => void save()} loading={busy}>บันทึก</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field label="รหัสสาขา" hint="เช่น HQ, BN">
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={8} placeholder="BN" className="num uppercase" />
          </Field>
          <Field label="ชื่อสาขา">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="สาขาบางนา" />
          </Field>
        </div>
        <Field label="ที่อยู่" optional>
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="โทรศัพท์" optional>
          <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="02-123-4567" />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
