import { Download, RotateCcw, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { config } from '../config'
import { cn } from '../lib/format'
import { APK_URL, isNativeApp } from '../lib/platform'
import { localDataSize, resetMockData } from '../services/dataSource'
import { Button, Modal } from './ui'

/** ปุ่มดาวน์โหลดแอป Android (.apk) — ซ่อนเมื่อเปิดอยู่ในแอปแล้ว */
export function ApkDownloadLink({ className }: { className?: string }) {
  if (isNativeApp()) return null
  return (
    <a
      href={APK_URL}
      download="FleetGo.apk"
      className={cn('flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/50', className)}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white">
        <Smartphone className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">ดาวน์โหลดแอป FleetGo MCS (.apk)</span>
        <span className="block text-[13px] text-muted">สำหรับมือถือ Android</span>
      </span>
      <Download className="size-5 shrink-0 text-brand" strokeWidth={1.75} />
    </a>
  )
}

/** รีเซ็ตข้อมูลทดสอบในเครื่อง (เฉพาะโหมด mock) + แสดงพื้นที่ที่ใช้ */
export function TestDataReset({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  if (config.dataSource !== 'mock') return null
  const mb = localDataSize() / 1024 / 1024
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-medium">ข้อมูลทดสอบในเครื่อง</p>
          <p className="num text-[13px] text-muted">ใช้พื้นที่ {mb.toFixed(2)} MB จากประมาณ 5 MB</p>
        </div>
        <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setOpen(true)} className="shrink-0">
          รีเซ็ตข้อมูลทดสอบ
        </Button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper">
        <div className={cn('h-full rounded-full', mb > 4 ? 'bg-red-500' : mb > 3 ? 'bg-amber-500' : 'bg-brand')} style={{ width: `${Math.min(100, (mb / 5) * 100)}%` }} />
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="รีเซ็ตข้อมูลทดสอบ?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button variant="danger" icon={RotateCcw} onClick={resetMockData}>รีเซ็ตข้อมูล</Button>
          </>
        }
      >
        <p className="text-muted">ข้อมูลรถ การจอง ทริป ใบสั่ง รายชื่อผู้ใช้ และรูป/ไฟล์แนบทั้งหมดในเครื่องนี้จะถูกลบ และกลับเป็นข้อมูลตัวอย่างเริ่มต้น</p>
      </Modal>
    </div>
  )
}
