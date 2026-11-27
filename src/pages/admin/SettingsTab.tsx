import { FileSpreadsheet, Save, Timer, TimerOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TestDataReset } from '../../components/AppDownload'
import { BookingRules } from '../../components/BookingRules'
import { errorMessage, useToast } from '../../components/Toast'
import { Button, Card, CardHeader, Input, Loading, Segmented } from '../../components/ui'
import { pad, toDateKey } from '../../lib/date'
import { cn } from '../../lib/format'
import { downloadCSV } from '../../lib/download'
import { useQuery } from '../../lib/useQuery'
import { SETTING_LIMITS, settingsService } from '../../services/settingsService'
import type { Settings } from '../../types'
import { ExportPreviewModal } from './shared'

/** เวลาที่บวกนาทีจาก 12:00 (ใช้แสดงตัวอย่าง) */
const after12 = (min: number) => {
  const t = 12 * 60 + Math.max(0, min)
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`
}

export function SettingsTab() {
  const toast = useToast()
  const { data, loading } = useQuery(() => settingsService.get())
  const [buffer, setBuffer] = useState<Settings['bufferMinutes']>(0)
  const [noShow, setNoShow] = useState<Settings['noShowMinutes']>(30)
  const [busy, setBusy] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    if (!data) return
    setBuffer(data.bufferMinutes)
    setNoShow(data.noShowMinutes)
  }, [data])

  if (loading || !data) return <Loading />
  const bufferValid = inRange(buffer, SETTING_LIMITS.buffer)
  const noShowValid = inRange(noShow, SETTING_LIMITS.noShow)
  const dirty = buffer !== data.bufferMinutes || noShow !== data.noShowMinutes
  const exportFilename = `fleetgo-settings-${toDateKey()}.csv`
  const exportHeaders = ['รหัสการตั้งค่า', 'Buffer Time (นาที)', 'ตัดสิทธิ์ No-Show (นาที)', 'เวลาเริ่มวัน', 'เวลาสิ้นสุดวัน', 'รอบเช็กระยะ (กม.)']
  const exportRows = [[data.id, data.bufferMinutes, data.noShowMinutes, data.dayStartHour, data.dayEndHour, data.serviceIntervalKm]]
  const confirmExport = () => downloadCSV(exportFilename, exportHeaders, exportRows)

  const save = async () => {
    setBusy(true)
    try {
      await settingsService.update({ bufferMinutes: buffer, noShowMinutes: noShow })
      toast('บันทึกการตั้งค่าแล้ว มีผลกับการจองใหม่ทันที')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
      <div className="space-y-5">
        <Card>
          <CardHeader icon={Timer} title="Buffer Time" subtitle="เวลากันก่อน-หลังแต่ละคิว สำหรับส่งมอบรถ/ทำความสะอาด" />
          <div className="p-5">
            <MinutesField value={buffer} onChange={setBuffer} presets={[0, 15, 30, 45]} zeroLabel="ไม่เว้น" limits={SETTING_LIMITS.buffer} />
            {bufferValid && (
              <p className="mt-3 text-sm text-muted">
                ตัวอย่าง: มีคิว 09:00–12:00 → คิวถัดไปเริ่มได้ตั้งแต่ <span className="num font-medium text-ink">{after12(buffer)}</span> น.
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader icon={TimerOff} title="ตัดสิทธิ์ No-Show" subtitle="หากไม่เริ่มใช้รถภายในเวลาที่กำหนดหลังเวลาจอง ระบบจะปล่อยคิวอัตโนมัติ" />
          <div className="p-5">
            <MinutesField value={noShow} onChange={setNoShow} presets={[15, 30, 60]} limits={SETTING_LIMITS.noShow} />
            {noShowValid && (
              <p className="mt-3 text-sm text-muted">
                ตัวอย่าง: จองไว้ 12:00 ถ้ายังไม่เริ่มใช้รถภายใน <span className="num font-medium text-ink">{after12(noShow)}</span> น. ระบบจะตัดสิทธิ์
              </p>
            )}
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button icon={Save} onClick={() => void save()} loading={busy} disabled={!dirty || !bufferValid || !noShowValid}>
            บันทึกการตั้งค่า
          </Button>
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setExportOpen(true)}>
            Export Excel
          </Button>
        </div>

        <Card>
          <CardHeader title="ข้อมูลทดสอบ" subtitle="ข้อมูลทั้งหมดเก็บในเครื่องนี้ (localStorage) จนกว่าจะเชื่อมต่อฐานข้อมูลจริง" />
          <TestDataReset className="p-5" />
        </Card>
      </div>

      <Card>
        <CardHeader title="ตัวอย่างกติกาที่พนักงานจะเห็น" subtitle="แสดงในหน้ายืนยันการจอง" />
        <div className="p-5">
          <BookingRules settings={{ ...data, bufferMinutes: bufferValid ? buffer : data.bufferMinutes, noShowMinutes: noShowValid ? noShow : data.noShowMinutes }} />
        </div>
      </Card>
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

const inRange = (v: number, l: { min: number; max: number }) => Number.isInteger(v) && v >= l.min && v <= l.max

/** ปุ่มค่าที่ใช้บ่อย + ช่องพิมพ์จำนวนนาทีเอง */
function MinutesField({ value, onChange, presets, zeroLabel, limits }: { value: number; onChange: (v: number) => void; presets: number[]; zeroLabel?: string; limits: { min: number; max: number } }) {
  const [text, setText] = useState(String(value))
  // ค่าเปลี่ยนจากปุ่มลัด/โหลดข้อมูล → อัปเดตช่องพิมพ์ (ถ้าไม่ตรงกับที่พิมพ์อยู่)
  useEffect(() => {
    setText((t) => (Number(t) === value && t.trim() !== '' ? t : String(value)))
  }, [value])

  const invalid = !inRange(value, limits)

  return (
    <div>
      <Segmented<number>
        value={value}
        onChange={onChange}
        className="w-full"
        options={presets.map((v) => ({ value: v, label: v === 0 && zeroLabel ? zeroLabel : `${v} นาที` }))}
      />
      <label className="mt-3 flex items-center gap-3">
        <span className="shrink-0 text-sm text-muted">หรือกำหนดเอง</span>
        <span className="relative w-36">
          <Input
            type="number"
            inputMode="numeric"
            min={limits.min}
            max={limits.max}
            step={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              onChange(e.target.value.trim() === '' ? Number.NaN : Number(e.target.value))
            }}
            aria-invalid={invalid}
            className={cn('num pr-14', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/10')}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">นาที</span>
        </span>
      </label>
      {invalid && <p className="mt-1.5 text-[13px] text-red-600">กรุณาใส่จำนวนเต็ม {limits.min}–{limits.max} นาที</p>}
    </div>
  )
}
