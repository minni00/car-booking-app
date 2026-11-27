import { CarFront } from 'lucide-react'
import { cn } from '../lib/format'
import { fileService } from '../services/fileService'
import type { Car } from '../types'

/**
 * รูปรถ — ถ้าไม่มีรูปแสดงไอคอนรถแทน
 * ค่าเริ่มต้นใช้รูปเล็ก (ประหยัดข้อมูล) · `full` = ใช้รูปเต็ม สำหรับรูปขนาดใหญ่ (การ์ดเต็มความกว้าง/หน้าจอง)
 */
export function CarImage({ car, className, iconClassName, full }: { car: Pick<Car, 'image' | 'brand' | 'model'>; className?: string; iconClassName?: string; full?: boolean }) {
  if (car.image?.url) {
    return <img src={full ? car.image.url : fileService.thumbOf(car.image)} alt={`${car.brand} ${car.model}`} loading="lazy" decoding="async" className={cn('object-cover', className)} />
  }
  return (
    <div className={cn('grid place-items-center bg-paper text-ink/20', className)} aria-label="ไม่มีรูปรถ">
      <CarFront className={cn('size-1/3 max-h-16 max-w-16', iconClassName)} strokeWidth={1} />
    </div>
  )
}
