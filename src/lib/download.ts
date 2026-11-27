import type { Booking, Car, User } from '../types'
import { pad } from './date'

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- CSV (เปิดใน Excel ภาษาไทยได้ด้วย UTF-8 BOM) ----------
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCSV(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','))
  const content = '﻿' + lines.join('\r\n')
  downloadBlob(filename, new Blob([content], { type: 'text/csv;charset=utf-8' }))
}

// ---------- iCalendar (.ics) ----------
const icsDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}

const icsText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (m) => `\\${m}`)

export function downloadICS(booking: Booking, car: Car, driver?: User): void {
  const desc = [
    `รถ: ${car.brand} ${car.model} (${car.plate})`,
    `ผู้ขับขี่: ${driver?.name ?? '-'}`,
    `จุดจอด: ${car.parkingSpot}`,
    `รับกุญแจ: ${car.keyLocation}`,
    `วัตถุประสงค์: ${booking.purpose}`,
  ].join('\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FleetGo//Car Booking//TH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@fleetgo`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(booking.start)}`,
    `DTEND:${icsDate(booking.end)}`,
    `SUMMARY:${icsText(`ใช้รถ ${car.plate} · ${booking.purpose}`)}`,
    `DESCRIPTION:${icsText(desc)}`,
    `LOCATION:${icsText(booking.destination?.label ?? car.parkingSpot)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:อีก 30 นาทีถึงเวลาใช้รถ',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  downloadBlob(`fleetgo-${booking.id}.ics`, new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
}
