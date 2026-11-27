import { useState } from 'react'
import { ALL_BRANCHES } from '../components/BranchSelect'
import type { Branch } from '../types'

const STORAGE_KEY = 'fleetgo.booking.branch'

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ALL_BRANCHES
  } catch {
    return ALL_BRANCHES
  }
}

/**
 * สาขาที่ผู้ใช้เลือกตอนจองรถ — จำไว้ในเครื่อง ใช้ร่วมกันระหว่างหน้าแรก / เลือกรถ / จองรถ
 * ส่ง `branches` มาเพื่อตรวจว่าสาขาที่จำไว้ยังมีอยู่ (ถูกลบแล้ว → ทุกสาขา)
 */
export function useBookingBranch(branches?: Branch[]): [string, (id: string) => void] {
  const [saved, setSaved] = useState(read)
  const value = saved !== ALL_BRANCHES && branches?.length && !branches.some((b) => b.id === saved) ? ALL_BRANCHES : saved
  const set = (id: string) => {
    setSaved(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* จำค่าไม่ได้ก็ยังใช้งานได้ */
    }
  }
  return [value, set]
}
