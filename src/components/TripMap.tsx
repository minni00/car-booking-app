import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { GeoPoint } from '../types'

export interface TripMapPoint {
  point: GeoPoint
  label: string
  /** สีหมุด */
  color: string
}

/** แผนที่แสดงตำแหน่งของทริป (ดูอย่างเดียว) — ซูมให้เห็นทุกหมุด */
export default function TripMap({ points, height = 220 }: { points: TripMapPoint[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  // สร้างแผนที่ใหม่เฉพาะเมื่อหมุดเปลี่ยนจริง (ไม่ใช่ทุกครั้งที่ render)
  const key = JSON.stringify(points)

  useEffect(() => {
    if (!ref.current || !points.length) return
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    const lls = points.map(({ point, label, color }) => {
      const ll: L.LatLngTuple = [point.lat, point.lng]
      L.circleMarker(ll, { radius: 9, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 })
        .addTo(map)
        .bindTooltip(label, { direction: 'top', offset: [0, -8] })
      return ll
    })
    if (lls.length === 1) map.setView(lls[0], 15)
    else map.fitBounds(L.latLngBounds(lls), { padding: [28, 28], maxZoom: 15 })
    // แก้ขนาดแผนที่ใน modal / layout ที่เพิ่ง render
    const t = setTimeout(() => map.invalidateSize(), 150)
    return () => {
      clearTimeout(t)
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return <div ref={ref} style={{ height }} className="z-0 w-full overflow-hidden rounded-xl border border-line" />
}
