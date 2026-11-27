import { Loader2, X, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/format'
import { Link } from '../router'

/*
 * ภาษาภาพ: Editorial / Swiss
 * - เส้นบางคั่นแทนกล่องซ้อนกล่อง, มุมเหลี่ยม, ไม่มีเงา
 * - ตัวเลขทั้งหมดเป็น monospace (utility `num`)
 * - สถานะใช้จุดสี + ข้อความ ไม่ใช้ป้ายพาสเทล
 * - ไอคอนใช้เฉพาะจุดที่มีหน้าที่ (ปุ่ม/นำทาง)
 */

// ---------------- Button ----------------
type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep active:bg-brand-deep',
  secondary: 'bg-white text-brand ring-1 ring-inset ring-line hover:ring-brand/40 hover:bg-brand-soft/40',
  accent: 'bg-sun text-ink hover:bg-[#f0c800]',
  ghost: 'text-ink hover:bg-paper',
  danger: 'bg-white text-red-600 ring-1 ring-inset ring-line hover:ring-red-300 hover:bg-red-50/50',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-md gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-lg gap-2',
  lg: 'h-12 px-5 text-[15px] rounded-lg gap-2',
}

const buttonClass = (variant: Variant, size: Size, block?: boolean, className?: string) =>
  cn(
    'inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-150 disabled:opacity-40 disabled:pointer-events-none select-none',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
    className,
  )

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  loading?: boolean
  icon?: LucideIcon
}

export function Button({ variant = 'primary', size = 'md', block, loading, icon: Icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, block, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.75} /> : null}
      {children}
    </button>
  )
}

export function LinkButton({ to, variant = 'primary', size = 'md', block, icon: Icon, className, children }: { to: string; variant?: Variant; size?: Size; block?: boolean; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={buttonClass(variant, size, block, className)}>
      {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} />}
      {children}
    </Link>
  )
}

// ---------------- Surface ----------------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-line bg-white', className)}>{children}</div>
}

/** หัวข้อส่วน: ตัวหนังสือล้วน + เส้นคั่นด้านล่าง (ไม่มีไอคอนในกล่อง) */
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-[15px] leading-snug font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** หัวข้อส่วนแบบไม่มีกล่อง ใช้คั่นเนื้อหาในหน้า */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <h2 className="text-[13px] font-medium tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  )
}

// ---------------- Status ----------------
type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'dark'
const DOT: Record<Tone, string> = {
  neutral: 'bg-ink/30',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-accent',
  dark: 'bg-sun',
}

/** สถานะ: จุดสี + ข้อความ (tone="dark" = ป้ายทึบสำหรับสถานะที่ต้องสะดุดตา) */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] leading-none font-medium whitespace-nowrap',
        tone === 'dark' ? 'rounded-[4px] bg-brand px-2 py-1 text-white' : 'text-ink/80',
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone], tone === 'dark' && 'animate-pulse')} />
      {children}
    </span>
  )
}

// ---------------- Form controls ----------------
const controlClass =
  // มือถือใช้ 16px เพื่อไม่ให้ iOS Safari ซูมอัตโนมัติตอนแตะช่องกรอก
  'w-full rounded-lg border border-line bg-white px-3 text-base md:text-[15px] text-ink placeholder:text-ink/35 outline-none transition-[border-color,box-shadow] hover:border-ink/30 focus:border-brand focus:ring-3 focus:ring-brand/10 disabled:bg-paper disabled:text-muted'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, 'h-11', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, 'h-11 pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-20 py-2.5', className)} {...rest} />
}

export function Field({ label, hint, optional, children, className }: { label: ReactNode; hint?: ReactNode; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink/80">
        {label}
        {optional && <span className="font-normal text-muted">· ไม่บังคับ</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

// ---------------- Segmented ----------------
export function Segmented<T extends string | number>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex rounded-lg bg-paper p-[3px]', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-md font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-[7px] text-[13px]',
              active ? 'bg-white text-brand shadow-[0_1px_2px_rgba(11,31,58,0.06),0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------- Switch ----------------
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-ink/15')}
    >
      <span className={cn('inline-block size-[18px] rounded-full bg-white transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

// ---------------- Modal (bottom sheet บนมือถือ / กลางจอบน iPad+) ----------------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white md:rounded-xl md:border md:border-line', size === 'lg' ? 'md:max-w-3xl' : 'md:max-w-lg')}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/15 md:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 md:pt-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 grid size-9 place-items-center rounded-md text-muted hover:bg-paper hover:text-ink" aria-label="ปิด">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className={cn('overflow-y-auto overscroll-contain border-t border-line px-5 py-5', !footer && 'pb-safe')}>{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 pb-safe sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------- Page ----------------
export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-10">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] md:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** ว่างเปล่า: ข้อความชิดซ้าย ไม่มีไอคอนประกอบ */
export function EmptyState({ title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 px-5 py-10 md:px-8">
      <p className="text-lg font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-20 text-sm text-muted">
      <span className="h-px w-8 animate-pulse bg-ink/40" />
      {label}
    </div>
  )
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="border-l-2 border-red-500 bg-red-50/60 py-2 pr-3 pl-3 text-sm text-red-700">{children}</p>
}

export function InfoRow({ label, value }: { icon?: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 py-2.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="min-w-0 text-sm font-medium break-words">{value}</span>
    </div>
  )
}

// ---------------- Stats ----------------
/** แถบตัวเลขสรุป: ช่องติดกันคั่นด้วยเส้นบาง */
export function StatGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-px overflow-hidden rounded-xl border border-line bg-line', className)}>{children}</div>
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: 'accent' | 'amber' | 'red' }) {
  return (
    <div className="bg-white px-4 py-4 md:px-5 md:py-5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        {tone && <span className={cn('size-1.5 rounded-full', tone === 'accent' ? 'bg-accent' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-500')} />}
        {label}
      </div>
      <div className="num mt-2 text-[28px] leading-none font-medium md:text-[32px]">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  )
}

/** ป้ายทะเบียนรถแบบไทย */
export function Plate({ plate, province, size = 'md' }: { plate: string; province?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex shrink-0 flex-col items-center rounded-[3px] border-[1.5px] border-ink/85 bg-white leading-none', size === 'lg' ? 'px-3 py-1.5' : size === 'sm' ? 'px-1.5 py-[3px]' : 'px-2 py-1')}>
      <span className={cn('font-semibold tracking-tight whitespace-nowrap', size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-[11px]' : 'text-[13px]')}>{plate}</span>
      {province && size !== 'sm' && <span className={cn('mt-0.5 text-muted', size === 'lg' ? 'text-[10px]' : 'text-[8px]')}>{province}</span>}
    </span>
  )
}
