import { Building2, CarFront, ClipboardList, Receipt, Settings2, Users, Wrench, type LucideIcon } from 'lucide-react'
import { LinkButton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/format'
import { navigate, useLocation } from '../../router'
import { BranchesTab } from './BranchesTab'
import { BranchPicker, BranchScopeProvider } from './branchScope'
import { CarsTab } from './CarsTab'
import { MaintenanceTab } from './MaintenanceTab'
import { SettingsTab } from './SettingsTab'
import { TicketsTab } from './TicketsTab'
import { UsageTab } from './UsageTab'
import { UsersTab } from './UsersTab'

const TABS: Array<{ key: string; label: string; short: string; icon: LucideIcon }> = [
  { key: 'cars', label: 'ข้อมูลรถ & สถานะ', short: 'รถ', icon: CarFront },
  { key: 'usage', label: 'บันทึกการใช้รถ', short: 'การใช้รถ', icon: ClipboardList },
  { key: 'tickets', label: 'ใบสั่ง & Export Excel', short: 'ใบสั่ง', icon: Receipt },
  { key: 'users', label: 'รายชื่อ & สิทธิ์แอดมิน', short: 'รายชื่อ', icon: Users },
  { key: 'maintenance', label: 'ซ่อมบำรุง & พ.ร.บ.', short: 'ซ่อม', icon: Wrench },
  { key: 'branches', label: 'สาขา', short: 'สาขา', icon: Building2 },
  { key: 'settings', label: 'ตั้งค่า Buffer / กติกา', short: 'ตั้งค่า', icon: Settings2 },
]

/** แท็บที่กรองข้อมูลตามสาขาที่เลือก */
const BRANCH_SCOPED = new Set(['cars', 'usage', 'tickets', 'maintenance'])

/** Admin Console — route /admin เฉพาะ role === "admin" */
export default function AdminPage() {
  const { isAdmin } = useAuth()
  const { search } = useLocation()
  const tab = TABS.some((t) => t.key === search.get('tab')) ? (search.get('tab') as string) : 'cars'

  if (!isAdmin) {
    return (
      <div className="max-w-md border-l-2 border-ink py-2 pl-5">
        <p className="text-xl font-semibold">เฉพาะ Fleet Admin เท่านั้น</p>
        <p className="mt-1 text-sm text-muted">บัญชีของคุณไม่มีสิทธิ์เข้าถึง Admin Console</p>
        <LinkButton to="/" variant="secondary" className="mt-5">
          กลับหน้าแรก
        </LinkButton>
      </div>
    )
  }

  return (
    <BranchScopeProvider>
      {/* หัวข้อ: มือถือเล็กลง (24px) / iPad+ ใช้ขนาดเดียวกับ PageHeader */}
      <header className="mb-4 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0">
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] md:text-[44px] md:leading-[1.1] md:tracking-[-0.025em]">Admin Console</h1>
        <p className="mt-1 text-[14px] text-muted md:mt-2 md:text-[15px]">จัดการรถ สาขา ใบสั่ง ผู้ใช้ ซ่อมบำรุง และกติกาการจอง</p>
        </div>
        {BRANCH_SCOPED.has(tab) && <BranchPicker className="w-full md:w-64 md:shrink-0" />}
      </header>

      {/* มือถือ: แท็บไอคอน + ชื่อสั้น 7 ช่องเท่ากัน */}
      <nav className="-mx-4 mb-5 grid grid-cols-7 gap-0 border-b border-line px-2 md:hidden" aria-label="เมนูแอดมิน">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(`/admin?tab=${t.key}`, { replace: true })}
              className={cn('-mb-px flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-0.5 pt-1.5 pb-2 transition-colors', active ? 'border-brand text-brand' : 'border-transparent text-muted')}
            >
              <t.icon className="size-5 shrink-0" strokeWidth={active ? 2 : 1.6} />
              {/* ไม่ใช้ truncate/leading-none เพราะจะตัดวรรณยุกต์ไทย (ั ้ ื) ด้านบนทิ้ง */}
              <span className={cn('text-center text-[12px] leading-[1.5] whitespace-nowrap', active && 'font-semibold')}>{t.short}</span>
            </button>
          )
        })}
      </nav>
      <h2 className="mb-3 text-[17px] font-semibold md:hidden">{TABS.find((t) => t.key === tab)?.label}</h2>

      {/* iPad / จอเล็ก (<1280px) ใช้ชื่อสั้น, จอใหญ่ใช้ชื่อเต็ม */}
      <nav className="mb-6 hidden border-b border-line md:flex md:gap-1 lg:gap-2" aria-label="เมนูแอดมิน">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => navigate(`/admin?tab=${t.key}`, { replace: true })}
            className={cn('-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors', tab === t.key ? 'border-brand font-medium text-brand' : 'border-transparent text-muted hover:text-ink')}
          >
            <span className="num text-[11px] text-muted">0{i + 1}</span>
            <span className="xl:hidden">{t.short}</span>
            <span className="hidden xl:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'cars' && <CarsTab />}
      {tab === 'usage' && <UsageTab />}
      {tab === 'tickets' && <TicketsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'maintenance' && <MaintenanceTab />}
      {tab === 'branches' && <BranchesTab />}
      {tab === 'settings' && <SettingsTab />}
    </BranchScopeProvider>
  )
}
