import { CalendarCheck, CarFront, House, UserRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { cn, initials } from '../lib/format'
import { Link, useLocation } from '../router'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  match: (path: string) => boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'หน้าแรก', icon: House, match: (p) => p === '/' },
  { to: '/fleet', label: 'จองรถ', icon: CarFront, match: (p) => p.startsWith('/fleet') || p.startsWith('/book/') },
  { to: '/bookings', label: 'การจอง', icon: CalendarCheck, match: (p) => p.startsWith('/bookings') || p.startsWith('/trip') },
  { to: '/profile', label: 'โปรไฟล์', icon: UserRound, match: (p) => p.startsWith('/profile') },
]

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="FleetGo หน้าแรก">
      <span className={cn('relative block size-[26px] rounded-[7px]', onDark ? 'bg-white' : 'bg-brand')}>
        <span className="absolute right-[4px] bottom-[4px] size-[8px] rounded-full bg-sun" />
      </span>
      <span className={cn('text-[18px] font-semibold tracking-[-0.03em]', onDark ? 'text-white' : 'text-brand')}>fleetgo</span>
    </Link>
  )
}

/**
 * โครงหน้าแอป (Design System เดียวกันทุกหน้า)
 * - แถบหัวพื้นขาว: มือถือแสดงโลโก้ + อวาตาร์, iPad/คอมพิวเตอร์แสดงเมนูด้านบน
 * - มือถือ: Bottom Navigation แบบแอปจริง (pill indicator ใต้ไอคอนที่เลือก) รองรับ safe-area ของ iPhone/Android
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const adminActive = pathname.startsWith('/admin')

  const navLink = (active: boolean) =>
    cn(
      'relative flex h-16 items-center text-[15px] transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full',
      active ? 'font-semibold text-brand after:bg-brand' : 'text-muted hover:text-ink',
    )

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-10 px-4 md:h-16 md:px-6 lg:px-8">
          <Logo />
          <nav className="hidden flex-1 items-center gap-8 md:flex">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={navLink(n.match(pathname))}>
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className={cn(navLink(adminActive), 'gap-2')}>
                Admin Console
                <span className="rounded-[4px] bg-sun px-1.5 py-px text-[10px] font-semibold text-ink">ADMIN</span>
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {isAdmin && (
              <Link to="/admin" className={cn('flex h-8 items-center rounded-full px-3 text-[13px] font-semibold md:hidden', adminActive ? 'bg-brand text-white' : 'bg-sun text-ink')}>
                Admin
              </Link>
            )}
            <Link to="/profile" className="flex items-center gap-2.5 rounded-full p-0.5" aria-label="โปรไฟล์">
              <span className="hidden text-right leading-tight lg:block">
                <span className="block text-[13px] font-semibold">{user?.name}</span>
                <span className="block text-[11px] text-muted">{user?.department}</span>
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">{initials(user?.name ?? '')}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:pt-10 md:pb-16 lg:px-8">{children}</main>

      {/* Bottom Navigation (มือถือ) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-white/95 pb-safe shadow-[0_-4px_16px_rgba(11,31,58,0.04)] backdrop-blur-xl md:hidden" aria-label="เมนูหลัก">
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-4 px-2">
          {NAV.map((n) => {
            const active = n.match(pathname)
            return (
              <Link key={n.to} to={n.to} aria-current={active ? 'page' : undefined} className="flex flex-col items-center justify-center gap-1">
                <span className={cn('grid h-8 w-16 place-items-center rounded-full transition-colors duration-200', active ? 'bg-brand-soft text-brand' : 'text-muted')}>
                  <n.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.7} />
                </span>
                <span className={cn('text-[11px] leading-none', active ? 'font-semibold text-brand' : 'text-muted')}>{n.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
