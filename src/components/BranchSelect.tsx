import { MapPin } from 'lucide-react'
import { cn } from '../lib/format'
import type { Branch } from '../types'

/** ค่า "ทุกสาขา" ของตัวเลือกสาขา */
export const ALL_BRANCHES = 'all'

/** ตัวเลือกสาขา (ใช้ทั้งหน้าจองรถและหน้าแอดมิน) */
export function BranchSelect({ branches, value, onChange, allLabel = 'ทุกสาขา', className }: { branches: Branch[]; value: string; onChange: (id: string) => void; allLabel?: string; className?: string }) {
  return (
    <label className={cn('relative flex h-11 items-center gap-2 rounded-xl border border-line bg-white pr-3 pl-3.5 transition-colors focus-within:border-brand hover:border-ink/30', className)}>
      <MapPin className="size-4 shrink-0 text-brand" strokeWidth={1.8} />
      <span className="shrink-0 text-[13px] text-muted">สาขา</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="เลือกสาขา"
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-5 text-[14px] font-medium text-ink outline-none"
      >
        <option value={ALL_BRANCHES}>{allLabel}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-3 size-3 text-muted" aria-hidden>
        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}
