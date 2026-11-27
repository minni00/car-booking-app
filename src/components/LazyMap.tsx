import { lazy, Suspense, type ComponentProps } from 'react'
import { Loading } from './ui'

/** โหลด Leaflet เฉพาะตอนที่ต้องใช้แผนที่ เพื่อให้หน้าแรกเปิดเร็ว */
const MapPicker = lazy(() => import('./MapPicker'))

export function LazyMap(props: ComponentProps<typeof MapPicker>) {
  return (
    <Suspense fallback={<Loading label="กำลังโหลดแผนที่…" />}>
      <MapPicker {...props} />
    </Suspense>
  )
}

const TripMap = lazy(() => import('./TripMap'))

/** แผนที่ตำแหน่งของทริป (ดูอย่างเดียว) — โหลด Leaflet เมื่อแสดงเท่านั้น */
export function LazyTripMap(props: ComponentProps<typeof TripMap>) {
  return (
    <Suspense fallback={<div className="grid place-items-center rounded-xl border border-line bg-paper text-sm text-muted" style={{ height: props.height ?? 220 }}>กำลังโหลดแผนที่…</div>}>
      <TripMap {...props} />
    </Suspense>
  )
}
