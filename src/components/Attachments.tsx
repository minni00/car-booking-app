import { Camera, Eye, FileText, Gauge, Loader2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { fmtBytes, cn } from '../lib/format'
import { fileService } from '../services/fileService'
import type { Attachment } from '../types'
import { errorMessage } from './Toast'
import { Modal } from './ui'

interface AttachmentInputProps {
  value: Attachment | null | undefined
  onChange: (v: Attachment | null) => void
  label: string
  accept?: string
  hint?: string
  capture?: boolean
}

/** แนบไฟล์ 1 ไฟล์ (Optional) พร้อมภาพตัวอย่าง */
export function AttachmentInput({ value, onChange, label, accept = 'image/*,application/pdf', hint, capture }: AttachmentInputProps) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await fileService.upload(file))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        {label} <span className="font-normal text-muted">(ไม่บังคับ)</span>
      </div>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5">
          <AttachmentViewer attachment={value} className="min-w-0 flex-1 gap-3 text-left">
            <AttachmentThumb attachment={value} className="size-14" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{value.name}</span>
              <span className="block text-xs text-muted">{fmtBytes(value.size)}</span>
            </span>
          </AttachmentViewer>
          <button type="button" onClick={() => onChange(null)} className="grid size-9 place-items-center rounded-lg text-red-600 hover:bg-red-50" aria-label="ลบไฟล์">
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <label htmlFor={id} className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 bg-paper/60 text-sm text-muted transition hover:border-accent hover:text-accent">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {busy ? 'กำลังอัปโหลด…' : 'แตะเพื่อเลือกไฟล์'}
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        {...(capture ? { capture: 'environment' as const } : {})}
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function AttachmentThumb({ attachment, className }: { attachment: Attachment; className?: string }) {
  return fileService.isImage(attachment) ? (
    <img src={fileService.thumbOf(attachment)} alt={attachment.name} loading="lazy" decoding="async" className={cn('shrink-0 rounded-lg object-cover', className)} />
  ) : (
    <span className={cn('grid shrink-0 place-items-center rounded-lg bg-red-50 text-red-600', className)}>
      <FileText className="size-5" />
    </span>
  )
}

export function AttachmentViewer({ attachment, children, className, title }: { attachment: Attachment; children?: ReactNode; className?: string; title?: string }) {
  const [open, setOpen] = useState(false)
  const label = title ?? `ดูไฟล์แนบ ${attachment.name}`

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex cursor-zoom-in items-center', className)} aria-label={label}>
        {children ?? <AttachmentThumb attachment={attachment} className="size-12" />}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title ?? attachment.name} size="lg">
        {fileService.isImage(attachment) ? (
          <img src={attachment.url} alt={attachment.name} className="mx-auto max-h-[70dvh] max-w-full object-contain" />
        ) : (
          <iframe src={attachment.url} title={attachment.name} className="h-[70dvh] w-full rounded-lg border border-line" />
        )}
      </Modal>
    </>
  )
}

/** ช่องถ่ายรูปรถ 2 ภาพ (ก่อน/หลังใช้) */
export function PhotoSlots({ value, onChange, labels, required }: { value: Attachment[]; onChange: (v: Attachment[]) => void; labels: [string, string]; required?: boolean }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const baseId = useId()

  const setAt = async (i: number, file?: File) => {
    if (!file) return
    setBusy(i)
    setError(null)
    try {
      const a = await fileService.upload(file)
      const next = [...value]
      next[i] = a
      onChange(next.filter(Boolean))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        รูปถ่ายรถ {!required && <span className="font-normal text-muted">(ไม่บังคับ)</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {labels.map((label, i) => {
          const a = value[i]
          const inputId = `${baseId}-${i}`
          return (
            <div key={label} className="relative">
              <label htmlFor={inputId} className={cn('flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border text-xs text-muted transition', a ? 'border-line' : 'border-dashed border-ink/20 bg-paper/60 hover:border-accent hover:text-accent')}>
                {a ? (
                  <img src={fileService.thumbOf(a)} alt={label} decoding="async" className="size-full object-cover" />
                ) : busy === i ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="size-5" />
                    {label}
                  </>
                )}
              </label>
              {a && (
                <>
                  <AttachmentViewer attachment={a} title={`ดูรูป ${label}`} className="absolute top-1.5 left-1.5 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-brand shadow">
                    <Eye className="size-4" />
                  </AttachmentViewer>
                  <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-white/90 text-red-600 shadow" aria-label="ลบรูป">
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
              <input
                id={inputId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  void setAt(i, e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          )
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** อัปโหลดรูปจากกล้อง 1 รูป (ใช้ร่วมกันใน PhotoInput / MultiPhotoInput) */
function usePhotoUpload() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = async (file: File | undefined, done: (a: Attachment) => void) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      done(await fileService.upload(file))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, upload }
}

/** รูปหน้าปัดเลขไมล์ 1 รูป (บังคับ) */
export function PhotoInput({ value, onChange, label, placeholder }: { value: Attachment | null; onChange: (v: Attachment | null) => void; label: string; placeholder: string }) {
  const id = useId()
  const { busy, error, upload } = usePhotoUpload()
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        {label} <span className="font-normal text-red-600">*</span>
      </div>
      <div className="relative">
        <label htmlFor={id} className={cn('flex h-36 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border text-sm text-muted transition sm:h-44', value ? 'border-line' : 'border-dashed border-ink/25 bg-paper/60 hover:border-accent hover:text-accent')}>
          {value ? (
            <img src={value.url} alt={label} className="size-full object-cover" />
          ) : busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Gauge className="size-6" strokeWidth={1.6} />
              {placeholder}
            </>
          )}
        </label>
        {value && (
          <>
            <AttachmentViewer attachment={value} title={`ดูรูป ${label}`} className="absolute top-2 left-2 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-brand shadow">
              <Eye className="size-4" />
            </AttachmentViewer>
            <button type="button" onClick={() => onChange(null)} className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-white/90 text-red-600" aria-label="ลบรูป">
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void upload(e.target.files?.[0], onChange)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** รูปหลายรูป (เช่น รูปรอย/ปัญหา) สูงสุด `max` รูป */
export function MultiPhotoInput({ value, onChange, max = 4 }: { value: Attachment[]; onChange: (v: Attachment[]) => void; max?: number }) {
  const id = useId()
  const { busy, error, upload } = usePhotoUpload()
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {value.map((a, i) => (
          <div key={a.id} className="relative aspect-square overflow-hidden rounded-lg border border-line">
            <img src={fileService.thumbOf(a)} alt={`รูปที่ ${i + 1}`} decoding="async" className="size-full object-cover" />
            <AttachmentViewer attachment={a} title={`ดูรูปที่ ${i + 1}`} className="absolute top-1 left-1 z-10 grid size-7 place-items-center rounded-full bg-white/90 text-brand shadow">
              <Eye className="size-3.5" />
            </AttachmentViewer>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-white/90 text-red-600" aria-label="ลบรูป">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <label htmlFor={id} className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/25 bg-paper/60 text-[12px] text-muted transition hover:border-accent hover:text-accent">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <><Plus className="size-5" />เพิ่มรูป</>}
          </label>
        )}
      </div>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void upload(e.target.files?.[0], (a) => onChange([...value, a]))
          e.target.value = ''
        }}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
