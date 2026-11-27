import { createContext, useContext, useState, type ReactNode } from 'react'
import { ALL_BRANCHES, BranchSelect } from '../../components/BranchSelect'
import { useQuery } from '../../lib/useQuery'
import { branchService } from '../../services/branchService'
import type { Branch, Car } from '../../types'

const STORAGE_KEY = 'fleetgo.admin.branch'

interface BranchScope {
  branches: Branch[]
  branchId: string
  setBranchId: (id: string) => void
}

const Ctx = createContext<BranchScope>({ branches: [], branchId: ALL_BRANCHES, setBranchId: () => {} })

function readSaved(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ALL_BRANCHES
  } catch {
    return ALL_BRANCHES
  }
}

/** สาขาที่เลือกในหน้าแอดมิน — ใช้กรองข้อมูลทุกแท็บ (จำค่าไว้ในเครื่อง) */
export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const { data: branches = [] } = useQuery(() => branchService.list())
  const [saved, setSaved] = useState(readSaved)
  // สาขาที่เลือกไว้ถูกลบไปแล้ว → กลับเป็นทุกสาขา
  const branchId = saved !== ALL_BRANCHES && branches.length && !branches.some((b) => b.id === saved) ? ALL_BRANCHES : saved

  const setBranchId = (id: string) => {
    setSaved(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ไม่จำค่าได้ก็ยังใช้งานได้ */
    }
  }

  return <Ctx.Provider value={{ branches, branchId, setBranchId }}>{children}</Ctx.Provider>
}

export function useBranchScope() {
  const { branches, branchId, setBranchId } = useContext(Ctx)
  const all = branchId === ALL_BRANCHES
  return {
    branches,
    branchId,
    setBranchId,
    /** true = แสดงทุกสาขา */
    all,
    current: branches.find((b) => b.id === branchId) ?? null,
    /** รถในสาขาที่เลือก */
    scopeCars: <T extends Pick<Car, 'branchId'>>(cars: T[]) => (all ? cars : cars.filter((c) => c.branchId === branchId)),
    /** รายการ (การจอง/ใบสั่ง/งานซ่อม) ของรถในสาขาที่เลือก */
    scopeByCar: <T extends { carId: string }>(rows: T[], cars: Pick<Car, 'id'>[]) => {
      if (all) return rows
      const ids = new Set(cars.map((c) => c.id))
      return rows.filter((r) => ids.has(r.carId))
    },
    branchName: (car: Pick<Car, 'branchId'>) => branches.find((b) => b.id === car.branchId)?.name ?? 'ไม่ระบุสาขา',
  }
}

/** ตัวเลือกสาขา (หัวหน้าแอดมิน) */
export function BranchPicker({ className }: { className?: string }) {
  const { branches, branchId, setBranchId } = useBranchScope()
  return <BranchSelect branches={branches} value={branchId} onChange={setBranchId} className={className} />
}
