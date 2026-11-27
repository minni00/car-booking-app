import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { errorMessage, useToast } from '../components/Toast'
import { Badge, Button, InfoRow, Loading, Modal, SectionTitle } from '../components/ui'
import { config } from '../config'
import { useAuth, useCurrentUser } from '../context/AuthContext'
import { fmtDateTime } from '../lib/date'
import { initials } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { Link, navigate } from '../router'
import { carService } from '../services/carService'
import { ApkDownloadLink, TestDataReset } from '../components/AppDownload'
import { EmailInbox } from '../components/EmailInbox'
import { deviceService } from '../services/deviceService'
import { maintenanceService } from '../services/maintenanceService'
import { settingsService } from '../services/settingsService'
import { ticketService } from '../services/ticketService'
import type { Device } from '../types'

export function ProfilePage() {
  const user = useCurrentUser()
  const { session, isAdmin, logout } = useAuth()
  const toast = useToast()
  const [revokeTarget, setRevokeTarget] = useState<Device | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, loading } = useQuery(async () => {
    const devices = await deviceService.listByUser(user.id)
    if (!isAdmin) return { devices, adminStats: null }
    const [cars, settings, tickets] = await Promise.all([carService.list(), settingsService.get(), ticketService.list()])
    return {
      devices,
      adminStats: {
        alerts: maintenanceService.alerts(cars, settings).length,
        maintenance: cars.filter((c) => c.status === 'maintenance').length,
        pendingTickets: tickets.filter((t) => t.status === 'pending').length,
      },
    }
  }, [user.id, isAdmin])

  const doRevoke = async () => {
    if (!revokeTarget) return
    setBusy(true)
    try {
      if (revokeTarget.id === session?.deviceId) {
        await logout()
        navigate('/', { replace: true })
      } else {
        await deviceService.revoke(revokeTarget.id)
        toast(`สั่งออกจากระบบ ${revokeTarget.name} แล้ว`)
      }
      setRevokeTarget(null)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const doLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div>
      {/* ส่วนหัวโปรไฟล์ */}
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-paper text-xl font-semibold ring-1 ring-line md:size-20 md:text-2xl">{initials(user.name)}</span>
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em] md:text-[40px]">{user.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{user.email}</span>
              {isAdmin ? <Badge tone="blue">Fleet Admin</Badge> : <Badge>พนักงาน</Badge>}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void doLogout()}>
          ออกจากระบบ
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 pt-8 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-5">
          <section>
            <SectionTitle>ข้อมูลบัญชี</SectionTitle>
            <div className="divide-y divide-line border-y border-line">
              <InfoRow label="แผนก" value={user.department || '-'} />
              <InfoRow label="โทรศัพท์" value={user.phone ? <span className="num">{user.phone}</span> : '-'} />
              <InfoRow label="เข้าสู่ระบบด้วย" value={session?.provider === 'entra' ? 'Microsoft Entra ID' : 'บัญชีทดลอง'} />
              <InfoRow label="ล็อกอินล่าสุด" value={user.lastLoginAt ? <span className="num">{fmtDateTime(user.lastLoginAt)}</span> : '-'} />
            </div>
          </section>

          {isAdmin && (
            <section>
              <SectionTitle>เมนูแอดมินด่วน</SectionTitle>
              <nav className="divide-y divide-line border-y border-line">
                <QuickLink to="/admin?tab=cars" label="ข้อมูลรถ & สถานะ" count={data?.adminStats?.maintenance} countLabel="ซ่อม" />
                <QuickLink to="/admin?tab=tickets" label="ใบสั่ง & Export Excel" count={data?.adminStats?.pendingTickets} countLabel="รอแจ้ง" />
                <QuickLink to="/admin?tab=users" label="รายชื่อ & สิทธิ์แอดมิน" />
                <QuickLink to="/admin?tab=maintenance" label="ซ่อมบำรุง & พ.ร.บ." count={data?.adminStats?.alerts} countLabel="เตือน" />
                <QuickLink to="/admin?tab=settings" label="ตั้งค่า Buffer / กติกา" />
              </nav>
            </section>
          )}
        </div>

        <div className="space-y-10 lg:col-span-7">
          <section>
            <SectionTitle>อุปกรณ์ที่ล็อกอินอยู่ · สั่งออกจากระบบระยะไกลได้</SectionTitle>
            {loading || !data ? (
              <Loading />
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {data.devices.map((d) => {
                  const current = d.id === session?.deviceId
                  return (
                    <li key={d.id} className="flex items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                          {d.name} {current && <Badge tone="green">อุปกรณ์นี้</Badge>}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {d.platform} · <span className="num">{fmtDateTime(d.lastActiveAt)}</span>
                        </p>
                      </div>
                      <Button size="sm" variant={current ? 'ghost' : 'danger'} onClick={() => setRevokeTarget(d)}>
                        ออกจากระบบ
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle>อีเมลแจ้งเตือน</SectionTitle>
            <EmailInbox email={user.email} />
          </section>

          <section>
            <SectionTitle>ระบบ</SectionTitle>
            <div className="divide-y divide-line border-y border-line">
              <InfoRow label="แหล่งข้อมูล" value={config.dataSource === 'api' ? `REST API · ${config.apiBaseUrl}` : 'MockData ในเครื่อง'} />
              <InfoRow label="Entra ID" value={config.entra.enabled ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า (.env)'} />
              <InfoRow label="ไฟล์แนบ" value="Data URL · เตรียมย้ายไป Azure Blob" />
            </div>
            <TestDataReset className="mt-4" />
          </section>

          <ApkDownloadLink />
        </div>
      </div>

      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="ออกจากระบบอุปกรณ์นี้?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={() => void doRevoke()} loading={busy}>ยืนยัน</Button>
          </>
        }
      >
        {revokeTarget && (
          <p className="text-muted">
            {revokeTarget.id === session?.deviceId ? 'คุณจะออกจากระบบบนอุปกรณ์ที่ใช้อยู่ตอนนี้' : `${revokeTarget.platform} จะถูกออกจากระบบทันที และต้องล็อกอินใหม่`}
          </p>
        )}
      </Modal>
    </div>
  )
}

function QuickLink({ to, label, count, countLabel }: { to: string; label: string; count?: number; countLabel?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 py-3.5 text-[15px]">
      <span className="flex-1 font-medium">{label}</span>
      {!!count && (
        <span className="flex items-center gap-1.5 text-[12px] text-red-600">
          <span className="size-1.5 rounded-full bg-red-500" />
          <span className="num">{count}</span> {countLabel}
        </span>
      )}
      <ArrowUpRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
    </Link>
  )
}
