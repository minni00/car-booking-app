import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { GeoPoint } from '../types'
import { getCurrentPosition } from '../lib/geo'
import { Button, Input } from './ui'

/**
 * แผนที่ OpenStreetMap (ฟรี) — ค้นหาสถานที่ด้วย Nominatim, แตะแผนที่เพื่อปักหมุด, ดึง GPS จริงจากอุปกรณ์
 */

interface MapPickerProps {
  value: GeoPoint | null | undefined
  onChange: (v: GeoPoint | null) => void
  /** ซ่อนช่องค้นหา (เช่นโหมดดึง GPS ตอนใช้รถ) */
  searchable?: boolean
  gpsLabel?: string
  height?: number
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

const BANGKOK: L.LatLngTuple = [13.7563, 100.5018]

export default function MapPicker({ value, onChange, searchable = true, gpsLabel = 'ใช้ตำแหน่งปัจจุบัน (GPS)', height = 260 }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const onChangeRef = useRef(onChange)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(BANGKOK, 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng, label: `ปักหมุด ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}` })
    })
    mapRef.current = map
    // แก้ปัญหาขนาดแผนที่เมื่ออยู่ใน modal / layout ที่เพิ่ง render
    const t = setTimeout(() => map.invalidateSize(), 150)
    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // ซิงก์หมุดกับ value
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const ll: L.LatLngTuple = [value.lat, value.lng]
    if (markerRef.current) markerRef.current.setLatLng(ll)
    else markerRef.current = L.circleMarker(ll, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#0F62FE', fillOpacity: 1 }).addTo(map)
    map.setView(ll, Math.max(map.getZoom(), 15))
  }, [value])

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=th&accept-language=th&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as NominatimResult[]
      setResults(data)
      if (!data.length) setError('ไม่พบสถานที่ ลองพิมพ์คำอื่น หรือแตะบนแผนที่เพื่อปักหมุดเอง')
    } catch {
      setError('ค้นหาไม่สำเร็จ (ตรวจสอบอินเทอร์เน็ต) — แตะบนแผนที่เพื่อปักหมุดเองได้')
    } finally {
      setSearching(false)
    }
  }

  const locateMe = async () => {
    setLocating(true)
    setError(null)
    try {
      onChange(await getCurrentPosition())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดึงตำแหน่งไม่สำเร็จ')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="space-y-2.5">
      {searchable && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void search()
                  }
                }}
                placeholder="ค้นหาสถานที่ เช่น สยามพารากอน"
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={() => void search()} loading={searching}>
              ค้นหา
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-12 z-[1000] max-h-60 overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg">
              {results.map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-paper"
                    onClick={() => {
                      onChange({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name })
                      setResults([])
                      setQuery('')
                    }}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div ref={containerRef} style={{ height }} className="overflow-hidden rounded-xl border border-line" />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={locating ? Loader2 : Crosshair} onClick={() => void locateMe()} disabled={locating}>
          {gpsLabel}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" icon={X} onClick={() => onChange(null)}>
            ล้างหมุด
          </Button>
        )}
      </div>
      {value && (
        <p className="flex items-start gap-1.5 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
          <span className="line-clamp-2">{value.label ?? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</span>
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
