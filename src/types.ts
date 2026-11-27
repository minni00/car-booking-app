// ---------- Domain types (ตรงกับตารางในฐานข้อมูลจริงภายหลัง) ----------

export type Role = 'user' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  department: string
  phone: string
  role: Role
  entraOid?: string
  createdAt: string
  lastLoginAt?: string
}

export interface Device {
  id: string
  userId: string
  name: string
  platform: string
  lastActiveAt: string
  createdAt: string
}

/** ไฟล์แนบ: ตอนนี้เก็บ Data URL, ภายหลังเปลี่ยนเป็น URL ของ Azure Blob Storage */
export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  uploadedAt: string
}

export interface GeoPoint {
  lat: number
  lng: number
  label?: string
}

export type CarStatus = 'available' | 'maintenance'
export type FuelType = 'เบนซิน' | 'ดีเซล' | 'ไฮบริด' | 'ไฟฟ้า'

export interface Insurance {
  company: string
  policyNo: string
  type: string
  phone: string
  expiry: string // YYYY-MM-DD
}

export interface Car {
  id: string
  plate: string
  province: string
  brand: string
  model: string
  color: string
  seats: number
  fuel: FuelType
  mileage: number
  status: CarStatus
  /** ชั้น/เสาจอดล่าสุด */
  parkingSpot: string
  /** จุดรับกุญแจล่าสุด (ส่งต่อจากคนก่อน) */
  keyLocation: string
  image?: Attachment | null
  insurance: Insurance
  actExpiry: string // พ.ร.บ. YYYY-MM-DD
  lastServiceMileage: number
}

export type BookingStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type FuelMethod = 'none' | 'company_card' | 'reimburse'

export interface ExtensionRequest {
  id: string
  requestedEnd: string
  requestedAt: string
  status: 'approved' | 'rejected'
  reason?: string
}

export interface Booking {
  id: string
  carId: string
  bookedById: string
  driverId: string
  purpose: string
  passengers: number
  start: string // ISO
  end: string // ISO
  pickupPin?: GeoPoint | null
  destination?: GeoPoint | null
  status: BookingStatus
  createdAt: string

  // --- ระหว่าง/หลังใช้รถ ---
  actualStart?: string
  actualEnd?: string
  startGps?: GeoPoint | null
  endGps?: GeoPoint | null
  startMileage?: number
  endMileage?: number
  startPhotos?: Attachment[]
  endPhotos?: Attachment[]
  returnParkingSpot?: string
  returnKeyLocation?: string
  fuelMethod?: FuelMethod
  fuelAmount?: number
  fuelSlip?: Attachment | null
  extensions?: ExtensionRequest[]
  /** รูปหน้าปัดเลขไมล์ (บังคับ) */
  startOdometerPhoto?: Attachment | null
  endOdometerPhoto?: Attachment | null
  /** แจ้งปัญหา/รอยบนรถ (ไม่บังคับ) */
  startIssue?: TripIssue | null
  endIssue?: TripIssue | null
}

/** ปัญหาหรือรอยที่พบบนรถ พร้อมรูปประกอบ */
export interface TripIssue {
  note: string
  photos: Attachment[]
}

export type TicketStatus = 'pending' | 'notified' | 'paid'

export interface Ticket {
  id: string
  carId: string
  occurredAt: string // ISO
  location: string
  violation: string
  amount: number
  status: TicketStatus
  matchedBookingId?: string | null
  matchedDriverId?: string | null
  attachment?: Attachment | null
  createdAt: string
}

export type MaintenanceType = 'service' | 'repair' | 'tyre' | 'act' | 'insurance' | 'other'

export interface MaintenanceRecord {
  id: string
  carId: string
  date: string // YYYY-MM-DD
  type: MaintenanceType
  description: string
  vendor: string
  cost: number
  mileage: number
  /** สำหรับ พ.ร.บ./ประกัน: วันหมดอายุใหม่ */
  nextDueDate?: string
  attachment?: Attachment | null
  createdAt: string
}

export interface Settings {
  id: 'global'
  /** นาทีกันก่อน-หลังแต่ละคิว (0–240) */
  bufferMinutes: number
  /** นาทีหลังเวลาจองที่ยังไม่เริ่มใช้รถ แล้วจะตัดสิทธิ์ (5–240) */
  noShowMinutes: number
  dayStartHour: number
  dayEndHour: number
  serviceIntervalKm: number
}

export interface Session {
  userId: string
  deviceId: string
  provider: 'entra' | 'demo'
  signedInAt: string
}
