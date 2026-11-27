import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Logo } from '../components/AppShell'
import { errorMessage, useToast } from '../components/Toast'
import { Button } from '../components/ui'
import { config } from '../config'
import { useAuth } from '../context/AuthContext'
import type { LoginResult } from '../services/authService'
import { ApkDownloadLink } from '../components/AppDownload'
import { Link } from '../router'

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-4" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export function LoginPage() {
  const { loginEntra, loginDemo, loginDemoNewEmployee } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<LoginResult>) => {
    setBusy(key)
    try {
      const r = await fn()
      toast(r.provisioned ? `ยินดีต้อนรับ ${r.user.name} — สร้างบัญชีให้อัตโนมัติแล้ว (JIT, สิทธิ์: พนักงาน)` : `ยินดีต้อนรับ ${r.user.name}`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid min-h-dvh bg-white pt-safe pb-safe lg:grid-cols-[1.1fr_1fr]">
      {/* ฝั่งแบรนด์ (คอมพิวเตอร์) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="relative block size-[22px] rounded-[5px] bg-white">
            <span className="absolute right-[4px] bottom-[4px] size-[7px] rounded-[2px] bg-sun" />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.03em]">fleetgo</span>
        </div>

        <div>
          <p className="num text-[13px] text-white/40">FLEET · BOOKING · LOGBOOK</p>
          <h1 className="mt-6 text-[56px] leading-[1.02] font-semibold tracking-[-0.035em] xl:text-[72px]">
            รถองค์กร
            <br />
            จองง่าย
            <br />
            <span className="text-sun">คืนครบ</span>
          </h1>
        </div>

        {/* แถบเวลาตัวอย่าง: สื่อถึงตารางว่างรายชั่วโมง */}
        <div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} className={`h-8 flex-1 rounded-[2px] ${i >= 6 && i < 12 ? 'bg-white' : i >= 16 && i < 20 ? 'bg-sun' : 'bg-white/10'}`} />
            ))}
          </div>
          <div className="num mt-2 flex justify-between text-[11px] text-white/40">
            <span>07:00</span>
            <span>14:00</span>
            <span>21:00</span>
          </div>
        </div>
      </aside>

      {/* ฟอร์มล็อกอิน */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        {/* มือถือ/iPad: แถบแบรนด์ด้านบน */}
        <div className="-mx-6 -mt-8 bg-brand px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-10 text-white sm:-mx-12 sm:px-12 lg:hidden">
          <Logo onDark />
          <p className="mt-10 text-[34px] leading-[1.05] font-semibold tracking-[-0.03em]">
            รถองค์กร จองง่าย
            <br />
            <span className="text-sun">คืนครบ</span>
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.025em]">เข้าสู่ระบบ</h2>
          <p className="mt-2 text-[15px] text-muted">ใช้บัญชี Microsoft ขององค์กร รองรับ Windows Hello, Face ID, Touch ID และ Passkey</p>

          <Button block size="lg" className="mt-8" onClick={() => void run('entra', loginEntra)} loading={busy === 'entra'}>
            {busy !== 'entra' && <MicrosoftLogo />}
            ดำเนินการต่อด้วย Microsoft
          </Button>
          {!config.entra.enabled && <p className="mt-2 text-xs text-muted">ยังไม่ได้ตั้งค่า Entra ID ใน .env ใช้บัญชีทดลองด้านล่างได้</p>}

          <div className="mt-12">
            <p className="text-[12px] font-medium tracking-wide text-muted">บัญชีทดลอง</p>
            <div className="mt-3 divide-y divide-line border-y border-line">
              <DemoRow label="ทดลองเป็นพนักงาน" hint="สมชาย ใจดี · ฝ่ายขาย" loading={busy === 'user'} onClick={() => void run('user', () => loginDemo('user'))} />
              <DemoRow label="ทดลองเป็นแอดมิน" hint="วรรณา ศรีสุข · Fleet Admin" loading={busy === 'admin'} onClick={() => void run('admin', () => loginDemo('admin'))} />
              <DemoRow label="จำลองพนักงานใหม่ล็อกอินครั้งแรก (JIT)" hint="สร้างบัญชีอัตโนมัติ สิทธิ์พนักงาน" loading={busy === 'jit'} onClick={() => void run('jit', loginDemoNewEmployee)} />
            </div>
          </div>

          <ApkDownloadLink className="mt-8" />
        </div>
        <p className="text-center text-[11px] text-muted lg:text-left">
          <span className="num">© FLEETGO</span> ·{' '}
          <Link to="/privacy" className="underline-offset-2 hover:text-ink hover:underline">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </main>
    </div>
  )
}

function DemoRow({ label, hint, loading, onClick }: { label: string; hint: string; loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="group flex w-full items-center gap-3 py-3.5 text-left disabled:opacity-50">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <ArrowRight className={`size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink ${loading ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
    </button>
  )
}
