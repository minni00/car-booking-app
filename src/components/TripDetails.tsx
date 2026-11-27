import { AlertTriangle, ExternalLink, ImageIcon, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmtDateTime } from '../lib/date'
import { cn } from '../lib/format'
import type { Attachment, Booking, GeoPoint, TripIssue } from '../types'
import { AttachmentThumb, AttachmentViewer } from './Attachments'
import { LazyTripMap } from './LazyMap'

/** สีหมุดแต่ละจุด (ใช้ทั้งบนแผนที่และรายการ) */
const COLORS = { pickup: '#0EA5E9', start: '#059669', destination: '#E0A800', end: '#003D7C' }

const sameSpot = (a?: GeoPoint | null, b?: GeoPoint | null) => !!a && !!b && Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lng - b.lng) < 0.0002
const coords = (p: GeoPoint) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
const mapsUrl = (p: GeoPoint) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

interface Spot {
  key: keyof typeof COLORS
  label: string
  point: GeoPoint
  time?: string
  note?: string
}

/** จุดต่าง ๆ ของทริป เรียงตามลำดับเวลา — ข้ามจุดขึ้นรถถ้าเป็นที่เดียวกับจุดเริ่มใช้รถ */
function tripSpots(b: Booking): Spot[] {
  const out: Spot[] = []
  if (b.pickupPin && !sameSpot(b.pickupPin, b.startGps)) out.push({ key: 'pickup', label: 'จุดขึ้นรถ (ปักหมุดตอนจอง)', point: b.pickupPin })
  if (b.startGps) out.push({ key: 'start', label: 'จุดเริ่มใช้รถ (GPS)', point: b.startGps, time: b.actualStart })
  if (b.destination) out.push({ key: 'destination', label: 'ปลายทาง', point: b.destination })
  if (b.endGps) out.push({ key: 'end', label: 'จุดคืนรถ (GPS)', point: b.endGps, time: b.actualEnd, note: b.returnParkingSpot ? `จอด ${b.returnParkingSpot}` : undefined })
  return out
}

function Section({ icon: Icon, title, children, empty }: { icon: typeof MapPin; title: string; children?: ReactNode; empty?: string }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold">
        <Icon className="size-4 text-brand" strokeWidth={1.8} />
        {title}
      </h3>
      {children || <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">{empty}</p>}
    </section>
  )
}

function Photo({ attachment, label }: { attachment: Attachment; label: string }) {
  return (
    <figure className="min-w-0">
      <AttachmentViewer attachment={attachment} title={label} className="block w-full">
        <AttachmentThumb attachment={attachment} className="aspect-[4/3] h-auto w-full border border-line" />
      </AttachmentViewer>
      <figcaption className="mt-1 truncate text-[12px] text-muted">{label}</figcaption>
    </figure>
  )
}

function IssueCard({ issue, when, time }: { issue: TripIssue; when: string; time?: string }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm font-semibold text-amber-900">
        {when}
        {time && <span className="num text-[12px] font-normal text-amber-800/80">{fmtDateTime(time)}</span>}
      </p>
      <p className="mt-1 text-sm leading-[1.65] break-words whitespace-pre-line text-ink/90">{issue.note || '—'}</p>
      {issue.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {issue.photos.map((p, i) => (
            <AttachmentViewer key={p.id} attachment={p} title={`${when} · รูปที่ ${i + 1}`} className="block w-full">
              <AttachmentThumb attachment={p} className="aspect-square h-auto w-full border border-amber-200" />
            </AttachmentViewer>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * รายละเอียดการใช้รถ: ตำแหน่ง (จุดขึ้นรถ / เริ่ม / ปลายทาง / คืนรถ) + แผนที่, ปัญหาที่แจ้งพร้อมรูป และรูปถ่าย
 * ใช้ทั้งหน้าสรุปทริปของผู้ใช้ และหน้าบันทึกการใช้รถของแอดมิน
 */
export function TripDetails({ booking: b, className }: { booking: Booking; className?: string }) {
  const spots = tripSpots(b)
  const issues: Array<[string, TripIssue, string | undefined]> = []
  if (b.startIssue) issues.push(['แจ้งตอนเริ่มใช้รถ', b.startIssue, b.actualStart])
  if (b.endIssue) issues.push(['แจ้งตอนคืนรถ', b.endIssue, b.actualEnd])
  const photos: Array<[Attachment, string]> = [
    ...(b.startOdometerPhoto ? [[b.startOdometerPhoto, 'เลขไมล์ตอนเริ่ม'] as [Attachment, string]] : []),
    ...(b.endOdometerPhoto ? [[b.endOdometerPhoto, 'เลขไมล์ตอนคืน'] as [Attachment, string]] : []),
    ...(b.startPhotos ?? []).map((p, i) => [p, `รูปรถก่อนใช้ ${i + 1}`] as [Attachment, string]),
    ...(b.endPhotos ?? []).map((p, i) => [p, `รูปรถหลังใช้ ${i + 1}`] as [Attachment, string]),
    ...(b.fuelSlip ? [[b.fuelSlip, 'สลิปน้ำมัน'] as [Attachment, string]] : []),
  ]

  return (
    <div className={cn('space-y-6', className)}>
      <Section icon={MapPin} title="ตำแหน่ง" empty="ไม่ได้บันทึกตำแหน่งในทริปนี้">
        {spots.length > 0 && (
          <div className="space-y-3">
            <LazyTripMap points={spots.map((s) => ({ point: s.point, label: s.label, color: COLORS[s.key] }))} />
            <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {spots.map((s) => (
                <li key={s.key} className="flex items-start gap-3 px-3.5 py-3">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ background: COLORS[s.key], boxShadow: `0 0 0 1px ${COLORS[s.key]}` }} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted">
                      {s.label}
                      {s.time && <span className="num">{fmtDateTime(s.time)}</span>}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug font-medium break-words">{s.point.label && !s.point.label.startsWith('ปักหมุด ') ? s.point.label : coords(s.point)}</p>
                    {s.note && <p className="mt-0.5 text-[13px] text-muted">{s.note}</p>}
                  </div>
                  <a href={mapsUrl(s.point)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand hover:bg-brand-soft" aria-label={`เปิด${s.label}ใน Google Maps`}>
                    แผนที่ <ExternalLink className="size-3.5" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Section>

      <Section icon={AlertTriangle} title="แจ้งปัญหา / รอยบนรถ" empty="ไม่มีการแจ้งปัญหาในทริปนี้">
        {issues.length > 0 && (
          <div className="space-y-3">
            {issues.map(([when, issue, time]) => (
              <IssueCard key={when} issue={issue} when={when} time={time} />
            ))}
          </div>
        )}
      </Section>

      <Section icon={ImageIcon} title="รูปถ่าย" empty="ไม่มีรูปถ่ายในทริปนี้">
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map(([p, label]) => (
              <Photo key={p.id + label} attachment={p} label={label} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

