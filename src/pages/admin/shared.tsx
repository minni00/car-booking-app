import { FileSpreadsheet, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { errorMessage, useToast } from '../../components/Toast'
import { Button, ErrorText, Modal } from '../../components/ui'
import { cn } from '../../lib/format'

/**
 * ตารางข้อมูลแอดมิน
 * - คอมพิวเตอร์ (xl ≥1280px): ตารางเต็มความกว้าง ไม่มีเลื่อนแนวนอน
 * - มือถือ / iPad / จอเล็ก (<1280px): แสดง `mobile` เป็นรายการการ์ด (iPad 2 คอลัมน์)
 *   ถ้าไม่ส่ง `mobile` มา จะใช้ตารางเลื่อนแนวนอนแทน
 */
export function Table({ head, children, empty, mobile }: { head: ReactNode[]; children: ReactNode; empty?: boolean; mobile?: ReactNode }) {
  return (
    <>
      {mobile != null && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
          {mobile}
          {empty && <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-muted md:col-span-2">ไม่มีข้อมูล</p>}
        </div>
      )}
      <div className={cn('overflow-x-auto rounded-2xl border border-line bg-white', mobile != null && 'hidden xl:block')}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-paper/70 text-xs text-muted">
            <tr>
              {head.map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {/* hover พื้นอ่อนทุกแถว (ใช้ร่วมทุกแท็บ) */}
          <tbody className="divide-y divide-line [&>tr]:transition-colors [&>tr:hover]:bg-paper">
            {children}
            {empty && (
              <tr>
                <td colSpan={head.length} className="px-4 py-10 text-center text-muted">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{children}</div>
}

export function ExportPreviewModal({ open, onClose, filename, headers, rows, onConfirm }: { open: boolean; onClose: () => void; filename: string; headers: string[]; rows: unknown[][]; onConfirm: () => void }) {
  const previewRows = rows.slice(0, 10)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ตัวอย่างข้อมูลก่อนส่งออก"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>กลับไปแก้ไข</Button>
          <Button icon={FileSpreadsheet} onClick={() => { onConfirm(); onClose() }}>ยืนยันและดาวน์โหลด</Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        ไฟล์ <span className="font-medium text-ink">{filename}</span> · แสดงตัวอย่าง {previewRows.length} จาก {rows.length} รายการ
      </p>
      <div className="mt-4 max-h-[55dvh] overflow-auto rounded-xl border border-line">
        <table className="min-w-max text-left text-xs">
          <thead className="sticky top-0 bg-paper text-muted">
            <tr>
              {headers.map((header, i) => <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {previewRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((_, colIndex) => (
                  <td key={colIndex} className="max-w-64 px-3 py-2 whitespace-pre-wrap break-words">
                    {String(row[colIndex] ?? '') || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > previewRows.length && <p className="mt-2 text-xs text-muted">ยืนยันแล้วจะดาวน์โหลดข้อมูลทั้งหมด {rows.length} รายการ</p>}
    </Modal>
  )
}

/** การ์ด 1 แถวสำหรับมือถือ / iPad */
export function MobileCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-line bg-white p-4', className)}>{children}</div>
}

/** คู่ป้ายกำกับ-ค่า ในการ์ดมือถือ (ข้อความยาวขึ้นบรรทัดใหม่ได้ ไม่ถูกตัดทิ้ง) */
export function MobileMeta({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="mt-0.5 leading-snug font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * ปุ่มลบ + หน้าต่างยืนยัน (ใช้คู่กับปุ่มแก้ไขทุกแท็บ)
 * ถ้าลบไม่ได้ (เช่น ยังมีคิวจองค้าง) จะแสดงเหตุผลในหน้าต่าง ไม่ปิดเอง
 */
export function DeleteButton({ itemLabel, title = 'ลบรายการนี้?', detail, onConfirm, successMessage = 'ลบแล้ว' }: { itemLabel: ReactNode; title?: string; detail?: ReactNode; onConfirm: () => Promise<void>; successMessage?: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setError(null)
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      toast(successMessage)
      setOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setOpen(true)} className="text-red-600 hover:bg-red-50">
        ลบ
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>ยกเลิก</Button>
            <Button variant="danger" icon={Trash2} onClick={() => void confirm()} loading={busy}>ยืนยันลบ</Button>
          </>
        }
      >
        <p className="font-medium break-words">{itemLabel}</p>
        <p className="mt-1 text-sm text-muted">{detail ?? 'ข้อมูลนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้'}</p>
        {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}
      </Modal>
    </>
  )
}
