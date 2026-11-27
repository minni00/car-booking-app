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
