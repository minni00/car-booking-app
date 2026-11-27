import { CarFront } from 'lucide-react'
import { cn } from '../lib/format'
import type { Car } from '../types'

/** รูปรถ — ถ้าไม่มีรูปแสดงไอคอนรถแทน */
export function CarImage({ car, className, iconClassName }: { car: Pick<Car, 'image' | 'brand' | 'model'>; className?: string; iconClassName?: string }) {
  if (car.image?.url) {
    return <img src={car.image.url} alt={`${car.brand} ${car.model}`} className={cn('object-cover', className)} />
  }
  return (
    <div className={cn('grid place-items-center bg-paper text-ink/20', className)} aria-label="ไม่มีรูปรถ">
      <CarFront className={cn('size-1/3 max-h-16 max-w-16', iconClassName)} strokeWidth={1} />
    </div>
  )
}
