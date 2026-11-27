import { Mail, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { config } from '../config'
import { fmtDateTime } from '../lib/date'
import { cn } from '../lib/format'
import { useQuery } from '../lib/useQuery'
import { notificationService, type EmailKind, type EmailMessage } from '../services/notificationService'
import { Modal } from './ui'

const STATUS: Record<EmailMessage['status'], { label: string; className: string }> = {
  sent: { label: 'ส่งแล้ว', className: 'bg-emerald-50 text-emerald-700' },
  test: { label: 'โหมดทดสอบ', className: 'bg-brand-soft text-brand' },
  failed: { label: 'ส่งไม่สำเร็จ', className: 'bg-red-50 text-red-700' },
}

/** กล่องอีเมลแจ้งเตือนของผู้ใช้ (ยืนยันการจอง / อนุมัติขยายเวลา) */
export function EmailInbox({ email }: { email: string }) {
  const { data } = useQuery(() => notificationService.inbox(email), [email])
  const [open, setOpen] = useState<EmailMessage | null>(null)
  const list = data ?? []

  return (
    <div>
      {config.dataSource === 'mock' && (
        <p className="mb-3 text-[13px] text-muted">โหมดทดสอบ: ระบบสร้างอีเมลจริงแต่ยังไม่ส่งออก จะส่งจริงเมื่อเชื่อมต่อเซิร์ฟเวอร์</p>
      )}
      {list.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {list.slice(0, 10).map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpen(m)} className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-paper/60">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm leading-snug font-medium">{m.subject.replace('[FleetGo] ', '')}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    <span className="num">{fmtDateTime(m.createdAt)}</span> · ถึง {m.to.join(', ')}
                  </span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[1.5] font-medium whitespace-nowrap', STATUS[m.status].className)}>{STATUS[m.status].label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 border-y border-line py-4 text-sm text-muted">
          <Mail className="size-4" strokeWidth={1.75} /> ยังไม่มีอีเมลแจ้งเตือน
        </p>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title="อีเมลแจ้งเตือน" size="lg">
        {open && (
          <div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">ถึง</dt>
              <dd className="break-words">{open.to.join(', ')}</dd>
              {open.cc.length > 0 && (
                <>
                  <dt className="text-muted">สำเนา</dt>
                  <dd className="break-words">{open.cc.join(', ')}</dd>
                </>
              )}
              <dt className="text-muted">หัวเรื่อง</dt>
              <dd className="font-medium break-words">{open.subject}</dd>
            </dl>
            {/* แสดงเนื้อหา HTML ใน iframe แบบ sandbox (ไม่รันสคริปต์) */}
            <iframe title="ตัวอย่างอีเมล" srcDoc={open.html} sandbox="" className="mt-4 h-[460px] w-full rounded-lg border border-line bg-paper" />
            {open.error && <p className="mt-2 text-[13px] text-red-600">ส่งไม่สำเร็จ: {open.error}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}

/** บรรทัด "ส่งอีเมลแล้ว" สำหรับหน้ายืนยันการจอง */
export function EmailSentNotice({ bookingId, kind }: { bookingId: string; kind: EmailKind }) {
  const { data: mail } = useQuery(() => notificationService.latestFor(bookingId, kind), [bookingId, kind])
  if (!mail) return null
  return (
    <p className="mt-4 flex items-start gap-2 text-[13px] leading-[1.6] text-muted">
      <MailCheck className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} />
      <span>
        {mail.status === 'failed' ? 'ส่งอีเมลยืนยันไม่สำเร็จ' : 'ส่งอีเมลยืนยันการจองไปที่'} <span className="font-medium break-all text-ink">{mail.to.join(', ')}</span>
        {mail.cc.length > 0 && <> (สำเนา {mail.cc.join(', ')})</>}
        {mail.status === 'test' && <> · โหมดทดสอบ ดูอีเมลได้ที่หน้าโปรไฟล์</>}
      </span>
    </p>
  )
}
