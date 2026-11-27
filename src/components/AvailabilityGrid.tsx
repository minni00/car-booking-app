import { cn } from '../lib/format'
import { combine, pad } from '../lib/date'
import type { BusyBlock } from '../services/bookingService'

interface Props {
  dateKey: string
  startHour: number
  endHour: number
  busy: BusyBlock[]
  selStart: Date | null
  selEnd: Date | null
  onPick: (slot: Date) => void
}

type SlotState = 'free' | 'booked' | 'buffer' | 'past' | 'selected'

/** ตารางว่างรายชั่วโมง (ช่องละ 30 นาที) รวม Buffer Time */
export function AvailabilityGrid({ dateKey, startHour, endHour, busy, selStart, selEnd, onPick }: Props) {
  const now = Date.now()
  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) hours.push(h)

  const stateOf = (slot: Date): SlotState => {
    const s = slot.getTime()
    const e = s + 30 * 60_000
    if (selStart && selEnd && s >= selStart.getTime() && e <= selEnd.getTime()) return 'selected'
    if (busy.some((b) => s < b.end && e > b.start)) return 'booked'
    if (busy.some((b) => s < b.blockedEnd && e > b.blockedStart)) return 'buffer'
    if (e <= now) return 'past'
    return 'free'
  }

  const cls: Record<SlotState, string> = {
    free: 'bg-paper text-ink/40 hover:bg-brand-soft hover:text-brand',
    selected: 'bg-sun text-ink font-medium',
    booked: 'bg-brand text-white/40 cursor-not-allowed',
    buffer: 'bg-[repeating-linear-gradient(135deg,#f6f6f3_0_3px,#d9d8d2_3px_4px)] text-transparent cursor-not-allowed',
    past: 'bg-transparent text-ink/20 cursor-not-allowed ring-1 ring-inset ring-line',
  }

  const freeCount = hours.reduce((n, h) => n + ['00', '30'].filter((m) => stateOf(combine(dateKey, `${pad(h)}:${m}`)) === 'free').length, 0)

  return (
    <div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-7">
        {hours.map((h) => (
          <div key={h}>
            <div className="num mb-1 text-[11px] text-muted">{pad(h)}:00</div>
            <div className="grid grid-cols-2 gap-[3px]">
              {['00', '30'].map((m) => {
                const slot = combine(dateKey, `${pad(h)}:${m}`)
                const st = stateOf(slot)
                const disabled = st === 'booked' || st === 'buffer' || st === 'past'
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(slot)}
                    title={`${pad(h)}:${m}`}
                    aria-label={`${pad(h)}:${m} ${st === 'free' ? 'ว่าง' : st === 'selected' ? 'เลือกแล้ว' : 'ไม่ว่าง'}`}
                    className={cn('num h-10 rounded-[3px] text-[10px] transition-colors', cls[st])}
                  >
                    :{m}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
        <Legend className="bg-paper ring-1 ring-inset ring-line" label="ว่าง" />
        <Legend className="bg-sun" label="ที่เลือก" />
        <Legend className="bg-brand" label="มีคนจอง" />
        {busy.some((b) => b.blockedStart < b.start || b.blockedEnd > b.end) && <Legend className="bg-[repeating-linear-gradient(135deg,#f6f6f3_0_2px,#c9c8c2_2px_3px)]" label="Buffer" />}
        <span className="num ml-auto text-ink">ว่าง {freeCount / 2} ชม.</span>
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block size-2.5 rounded-[2px]', className)} />
      {label}
    </span>
  )
}

/** นับชั่วโมงว่างของวัน (ใช้ในหน้าแรก) */
export function freeHours(dateKey: string, startHour: number, endHour: number, busy: BusyBlock[]): number {
  const now = Date.now()
  let slots = 0
  for (let h = startHour; h < endHour; h++) {
    for (const m of ['00', '30']) {
      const s = combine(dateKey, `${pad(h)}:${m}`).getTime()
      const e = s + 30 * 60_000
      if (e > now && !busy.some((b) => s < b.blockedEnd && e > b.blockedStart)) slots++
    }
  }
  return slots / 2
}
