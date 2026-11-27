import { Check, Crosshair, Loader2, MapPin, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { getCurrentPosition } from '../lib/geo'
import { cn } from '../lib/format'
import type { GeoPoint } from '../types'
import { LazyMap, LazyTripMap } from './LazyMap'
import { Button } from './ui'

const coords = (p: GeoPoint) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`

/**
 * บันทึกตำแหน่ง (บังคับกด) — แบบแอปเรียกรถ: กดปุ่มเดียวดึง GPS แล้วแสดงแผนที่ย่อ
 * ถ้าดึง GPS ไม่ได้ (ในอาคาร/ลานจอดใต้ดิน) ปักหมุดบนแผนที่เองได้
 */
export function LocationCapture({ value, onChange, pinColor = '#059669', reference }: { value: GeoPoint | null; onChange: (v: GeoPoint | null) => void; pinColor?: string; reference?: string }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState(false)

  const locate = async () => {
    setLocating(true)
    setError(null)
    try {
      onChange(await getCurrentPosition())
      setManual(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดึงตำแหน่งไม่สำเร็จ')
    } finally {
      setLocating(false)
    }
  }

  // ปักหมุดเอง: ใช้แผนที่แบบแตะเพื่อปักหมุด
  if (manual) {
    return (
      <div className="space-y-2.5">
        <LazyMap value={value} onChange={onChange} searchable={false} gpsLabel="ลองดึง GPS อีกครั้ง" height={220} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted">{value ? <>ปักหมุดแล้ว · <span className="num">{coords(value)}</span></> : 'แตะบนแผนที่ตรงจุดที่รถจอดอยู่'}</p>
          <Button size="sm" variant="ghost" onClick={() => setManual(false)} disabled={!value}>
            เสร็จแล้ว
          </Button>
        </div>
      </div>
    )
  }

  if (value) {
    const accuracy = value.label?.startsWith('GPS') ? value.label.replace('GPS ', 'ความแม่นยำ ') : 'ปักหมุดบนแผนที่'
    return (
      <div className="overflow-hidden rounded-2xl border border-line">
        <LazyTripMap points={[{ point: value, label: 'ตำแหน่งที่บันทึก', color: pinColor }]} height={132} />
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">บันทึกตำแหน่งแล้ว</p>
            <p className="truncate text-[12px] text-muted">
              <span className="num">{coords(value)}</span> · {accuracy}
            </p>
          </div>
          <button type="button" onClick={() => void locate()} disabled={locating} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-soft disabled:opacity-50">
            {locating ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            ใหม่
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl border border-dashed p-4', error ? 'border-red-300 bg-red-50/40' : 'border-brand/30 bg-brand-soft/40')}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand shadow-[0_0_0_1px_var(--color-line)]">
          <MapPin className="size-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">ยังไม่ได้บันทึกตำแหน่ง</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{reference ? `จุดที่ปักไว้ตอนจอง: ${reference}` : 'กดปุ่มด้านล่างตอนอยู่ที่รถ ระบบจะบันทึกตำแหน่งปัจจุบัน'}</p>
        </div>
      </div>
      <Button block className="mt-3.5" icon={locating ? undefined : Crosshair} loading={locating} onClick={() => void locate()}>
        บันทึกตำแหน่งตอนนี้
      </Button>
      {error && (
        <p className="mt-2.5 text-center text-[13px] text-red-600">
          {error} ·{' '}
          <button type="button" onClick={() => setManual(true)} className="font-medium underline underline-offset-2">
            ปักหมุดบนแผนที่เอง
          </button>
        </p>
      )}
    </div>
  )
}
