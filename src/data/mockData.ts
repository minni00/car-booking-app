import type { Attachment, Booking, Branch, Car, Device, MaintenanceRecord, Settings, Ticket, User } from '../types'

/**
 * Mock data สำหรับพัฒนาในเครื่อง
 * วันที่ทั้งหมดคำนวณจาก "วันนี้" เพื่อให้มีทริปถัดไป/ประวัติให้ทดลองเสมอ
 */

export interface Seed {
  users: User[]
  branches: Branch[]
  devices: Device[]
  cars: Car[]
  bookings: Booking[]
  tickets: Ticket[]
  maintenance: MaintenanceRecord[]
  settings: Settings[]
}

/** รูปรถตัวอย่าง (public/cars, เครดิตใน public/cars/CREDITS.md) และสีตามรูป */
export const SEED_CAR_PHOTOS: Record<string, { file: string; color: string; oldColor: string }> = {
  'car-01': { file: 'camry.jpg', color: 'ขาวมุก', oldColor: 'ขาวมุก' },
  'car-02': { file: 'city.jpg', color: 'น้ำเงิน', oldColor: 'เทา' },
  'car-03': { file: 'commuter.jpg', color: 'ขาว', oldColor: 'เงิน' },
  'car-04': { file: 'atto3.jpg', color: 'เงิน', oldColor: 'น้ำเงิน' },
  'car-05': { file: 'dmax.jpg', color: 'เงิน', oldColor: 'ดำ' },
  'car-06': { file: 'cx5.jpg', color: 'เทา', oldColor: 'แดง' },
}

/** สาขาขององค์กร (ใช้ทั้งข้อมูลชุดใหม่และ migration ของข้อมูลเดิม) — ที่อยู่/เบอร์โทร เพิ่มได้ในแท็บสาขา */
export function seedBranches(createdAt: string): Branch[] {
  return [
    { id: 'br-hq', code: 'HQ', name: 'สำนักงานใหญ่ ปทุมธานี (รังสิต)', address: 'รังสิต จ.ปทุมธานี', phone: '', createdAt },
    { id: 'br-chonburi', code: 'CBI', name: 'สาขาชลบุรี', address: 'จ.ชลบุรี', phone: '', createdAt },
    { id: 'br-khonkaen', code: 'KKN', name: 'สาขาขอนแก่น', address: 'จ.ขอนแก่น', phone: '', createdAt },
    { id: 'br-nakhonsawan', code: 'NSN', name: 'สาขานครสวรรค์', address: 'จ.นครสวรรค์', phone: '', createdAt },
    { id: 'br-udonthani', code: 'UDN', name: 'สาขาอุดรธานี', address: 'จ.อุดรธานี', phone: '', createdAt },
    { id: 'br-chiangrai', code: 'CRI', name: 'สาขาเชียงราย', address: 'จ.เชียงราย', phone: '', createdAt },
    { id: 'br-suratthani', code: 'SNI', name: 'สาขาสุราษฎร์ธานี', address: 'จ.สุราษฎร์ธานี', phone: '', createdAt },
  ]
}

/** สาขาตัวอย่างรุ่นก่อนที่ไม่มีจริง — ลบออกตอน migration */
export const LEGACY_BRANCH_IDS = ['br-bangna']

/** สาขาของรถชุดเริ่มต้น */
export const SEED_CAR_BRANCH: Record<string, string> = { 'car-01': 'br-hq', 'car-02': 'br-hq', 'car-03': 'br-hq', 'car-04': 'br-chonburi', 'car-05': 'br-khonkaen', 'car-06': 'br-chonburi' }

export function stockPhoto(file: string): Attachment {
  return { id: `stock-${file}`, name: file, type: 'image/jpeg', size: 0, url: `/cars/${file}`, uploadedAt: '2026-01-01T00:00:00.000Z' }
}

/** รูปหน้าปัดเลขไมล์ตัวอย่าง (SVG) */
function odometerPhoto(id: string, km: number): Attachment {
  const digits = String(km).padStart(6, '0')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#1f2937"/><stop offset="1" stop-color="#05070b"/></radialGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="320" cy="250" r="230" fill="none" stroke="#334155" stroke-width="6"/><text x="320" y="120" fill="#94a3b8" font-family="Arial" font-size="26" text-anchor="middle">ODO</text><rect x="120" y="160" width="400" height="96" rx="10" fill="#0b1220" stroke="#475569" stroke-width="3"/><text x="320" y="230" fill="#e2e8f0" font-family="Consolas,monospace" font-size="68" letter-spacing="10" text-anchor="middle">${digits}</text><text x="540" y="230" fill="#94a3b8" font-family="Arial" font-size="24">km</text></svg>`
  return { id, name: `odometer-${km}.svg`, type: 'image/svg+xml', size: svg.length, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, uploadedAt: '2026-01-01T00:00:00.000Z' }
}

/** รูปตัวอย่างประกอบการแจ้งปัญหา/รูปรถ (ใช้รูปรถในเครื่อง แยก id ไม่ให้ซ้ำ) */
const samplePhoto = (file: string, id: string): Attachment => ({ ...stockPhoto(file), id })

/**
 * ข้อมูลระหว่างใช้รถของทริปตัวอย่าง: ตำแหน่ง (จุดขึ้นรถ/เริ่ม/ปลายทาง/คืน), รูปเลขไมล์, รูปรถ และการแจ้งปัญหาพร้อมรูป
 * ใช้ทั้งข้อมูลชุดใหม่และ migration ของข้อมูลเดิม
 */
export const SEED_TRIP_DETAILS: Record<string, Partial<Booking>> = {
  'bk-0901': {
    pickupPin: { lat: 13.98935, lng: 100.62012, label: 'หน้าอาคาร B ประตู 2 · สำนักงานใหญ่ รังสิต' },
    startGps: { lat: 13.98762, lng: 100.61793, label: 'ลานจอด B1 · สำนักงานใหญ่ รังสิต' },
    destination: { lat: 13.66941, lng: 100.61003, label: 'ไบเทค บางนา (BITEC)' },
    endGps: { lat: 13.98741, lng: 100.61812, label: 'ลานจอด B1 · สำนักงานใหญ่ รังสิต' },
    startOdometerPhoto: odometerPhoto('odo-0901-s', 47980),
    endOdometerPhoto: odometerPhoto('odo-0901-e', 48210),
    startPhotos: [samplePhoto('camry.jpg', 'car-0901-s1')],
    endIssue: { note: 'รอยขีดข่วนกันชนหลังด้านซ้าย ยาวประมาณ 10 ซม. พบตอนคืนรถ (น่าจะเกิดที่ลานจอดไบเทค)', photos: [samplePhoto('camry.jpg', 'issue-0901-1')] },
  },
  'bk-0903': {
    startGps: { lat: 13.98791, lng: 100.61764, label: 'ลานจอดหน้าอาคาร · สำนักงานใหญ่ รังสิต' },
    destination: { lat: 13.94203, lng: 100.72904, label: 'ไซต์งาน ลำลูกกา คลอง 6' },
    endGps: { lat: 13.98772, lng: 100.61781, label: 'ลานจอดหน้าอาคาร · สำนักงานใหญ่ รังสิต' },
    startOdometerPhoto: odometerPhoto('odo-0903-s', 96700),
    endOdometerPhoto: odometerPhoto('odo-0903-e', 96880),
    startIssue: { note: 'ไฟเบรกหลังด้านขวาไม่ติด แจ้งก่อนออกรถ — ขับได้ แต่ควรเปลี่ยนหลอดก่อนใช้งานครั้งต่อไป', photos: [samplePhoto('commuter.jpg', 'issue-0903-1')] },
  },
}

export const DEMO_USER_ID = 'u-emp-01'
export const DEMO_ADMIN_ID = 'u-admin-01'

function at(base: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function dateOnly(base: Date, dayOffset: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function createSeed(now = new Date()): Seed {
  const created = at(now, -60, 9)
  // ให้ทริปถัดไปของพนักงานเริ่มชั่วโมงถัดไป (หรือพรุ่งนี้ 09:00 ถ้าดึกแล้ว)
  const nextHour = now.getHours() + 1
  const tripDay = nextHour >= 19 ? 1 : 0
  const tripHour = nextHour >= 19 ? 9 : Math.max(nextHour, 8)

  const users: User[] = [
    { id: DEMO_ADMIN_ID, email: 'admin@fleetgo.co.th', name: 'วรรณา ศรีสุข', department: 'ฝ่ายบริหารยานพาหนะ', phone: '081-234-5678', role: 'admin', createdAt: created },
    { id: DEMO_USER_ID, email: 'somchai@fleetgo.co.th', name: 'สมชาย ใจดี', department: 'ฝ่ายขาย', phone: '089-111-2233', role: 'user', createdAt: created },
    { id: 'u-emp-02', email: 'napat@fleetgo.co.th', name: 'ณภัทร วงศ์ทอง', department: 'ฝ่ายวิศวกรรม', phone: '086-555-0101', role: 'user', createdAt: created },
    { id: 'u-emp-03', email: 'kanya@fleetgo.co.th', name: 'กัญญา ประเสริฐ', department: 'ฝ่ายบัญชี', phone: '087-222-9090', role: 'user', createdAt: created },
    { id: 'u-emp-04', email: 'thanakorn@fleetgo.co.th', name: 'ธนกร มีสุข', department: 'ฝ่ายขาย', phone: '085-777-3131', role: 'user', createdAt: created },
  ]

  const devices: Device[] = [
    { id: 'dev-seed-01', userId: DEMO_USER_ID, name: 'iPhone 15', platform: 'iOS · Safari', lastActiveAt: at(now, -1, 18, 20), createdAt: created },
    { id: 'dev-seed-02', userId: DEMO_ADMIN_ID, name: 'MacBook Pro', platform: 'macOS · Chrome', lastActiveAt: at(now, -2, 10, 5), createdAt: created },
  ]

  const ins = (company: string, policyNo: string, phone: string, expiry: string) => ({ company, policyNo, phone, expiry, type: 'ชั้น 1' })

  const baseCars: Car[] = [
    { id: 'car-01', plate: '1กข 1234', province: 'กรุงเทพมหานคร', brand: 'Toyota', model: 'Camry 2.5 HEV', color: 'ขาวมุก', seats: 5, fuel: 'ไฮบริด', mileage: 48210, status: 'available', parkingSpot: 'B1 · เสา A3', keyLocation: 'ตู้กุญแจ ชั้น 1 ช่อง 01', insurance: ins('วิริยะประกันภัย', 'VR-6612-0099', '1557', dateOnly(now, 210)), actExpiry: dateOnly(now, 18), lastServiceMileage: 40000 },
    { id: 'car-02', plate: '2กค 5678', province: 'กรุงเทพมหานคร', brand: 'Honda', model: 'City e:HEV', color: 'น้ำเงิน', seats: 5, fuel: 'ไฮบริด', mileage: 22340, status: 'available', parkingSpot: 'B1 · เสา C1', keyLocation: 'ตู้กุญแจ ชั้น 1 ช่อง 02', insurance: ins('ทิพยประกันภัย', 'TP-2201-4410', '1736', dateOnly(now, 120)), actExpiry: dateOnly(now, 140), lastServiceMileage: 20000 },
    { id: 'car-03', plate: '3กง 9012', province: 'กรุงเทพมหานคร', brand: 'Toyota', model: 'Commuter 2.8', color: 'ขาว', seats: 12, fuel: 'ดีเซล', mileage: 96880, status: 'available', parkingSpot: 'ลานจอดหน้าอาคาร · ช่อง V2', keyLocation: 'ป้อม รปภ. ประตู 1', insurance: ins('กรุงเทพประกันภัย', 'BKI-7788-1200', '1620', dateOnly(now, 25)), actExpiry: dateOnly(now, 300), lastServiceMileage: 80000 },
    { id: 'car-04', plate: '4กจ 3456', province: 'กรุงเทพมหานคร', brand: 'BYD', model: 'Atto 3', color: 'เงิน', seats: 5, fuel: 'ไฟฟ้า', mileage: 15420, status: 'available', parkingSpot: 'B2 · ช่องชาร์จ EV-04', keyLocation: 'ตู้กุญแจ ชั้น 1 ช่อง 04', insurance: ins('วิริยะประกันภัย', 'VR-6612-0310', '1557', dateOnly(now, 330)), actExpiry: dateOnly(now, 260), lastServiceMileage: 10000 },
    { id: 'car-05', plate: '5กฉ 7890', province: 'กรุงเทพมหานคร', brand: 'Isuzu', model: 'D-Max Cab4', color: 'เงิน', seats: 4, fuel: 'ดีเซล', mileage: 128900, status: 'maintenance', parkingSpot: 'ศูนย์บริการ Isuzu พระราม 9', keyLocation: 'อยู่ที่ศูนย์บริการ', insurance: ins('ทิพยประกันภัย', 'TP-2201-9001', '1736', dateOnly(now, 90)), actExpiry: dateOnly(now, 75), lastServiceMileage: 120000 },
    { id: 'car-06', plate: '6กช 2468', province: 'กรุงเทพมหานคร', brand: 'Mazda', model: 'CX-5 2.0', color: 'เทา', seats: 5, fuel: 'เบนซิน', mileage: 61200, status: 'available', parkingSpot: 'B1 · เสา D2', keyLocation: 'ตู้กุญแจ ชั้น 1 ช่อง 06', insurance: ins('กรุงเทพประกันภัย', 'BKI-7788-5521', '1620', dateOnly(now, 160)), actExpiry: dateOnly(now, 190), lastServiceMileage: 60000 },
  ]
  const cars: Car[] = baseCars.map((c) => ({ ...c, image: SEED_CAR_PHOTOS[c.id] ? stockPhoto(SEED_CAR_PHOTOS[c.id].file) : null, branchId: SEED_CAR_BRANCH[c.id] ?? null }))
  const branches = seedBranches(created)

  const bookings: Booking[] = [
    // ทริปถัดไปของพนักงานทดลอง
    { id: 'bk-1001', carId: 'car-02', bookedById: DEMO_USER_ID, driverId: DEMO_USER_ID, purpose: 'พบลูกค้า บจก. สยามเทค', passengers: 2, start: at(now, tripDay, tripHour), end: at(now, tripDay, tripHour + 3), destination: { lat: 13.7466, lng: 100.5393, label: 'สยามพารากอน, ปทุมวัน กรุงเทพฯ' }, status: 'upcoming', createdAt: at(now, -2, 14) },
    // คิวในอนาคต
    { id: 'bk-1002', carId: 'car-04', bookedById: DEMO_USER_ID, driverId: 'u-emp-04', purpose: 'ส่งเอกสารสรรพากร (จองแทนธนกร)', passengers: 1, start: at(now, 2, 13), end: at(now, 2, 15), status: 'upcoming', createdAt: at(now, -1, 10) },
    // ประวัติ
    { id: 'bk-0901', carId: 'car-01', bookedById: DEMO_USER_ID, driverId: DEMO_USER_ID, purpose: 'ออกบูธงานแสดงสินค้า ไบเทค', passengers: 3, start: at(now, -3, 8), end: at(now, -3, 17), status: 'completed', createdAt: at(now, -6, 9), actualStart: at(now, -3, 8, 10), actualEnd: at(now, -3, 16, 45), startMileage: 47980, endMileage: 48210, returnParkingSpot: 'B1 · เสา A3', returnKeyLocation: 'ตู้กุญแจ ชั้น 1 ช่อง 01', fuelMethod: 'company_card', fuelAmount: 1200, startPhotos: [], endPhotos: [] },
    { id: 'bk-0902', carId: 'car-06', bookedById: DEMO_USER_ID, driverId: DEMO_USER_ID, purpose: 'ประชุมสาขาบางนา', passengers: 1, start: at(now, -8, 13), end: at(now, -8, 16), status: 'cancelled', createdAt: at(now, -10, 9) },
    // คนอื่นจองไว้วันนี้ (ให้ตารางว่างมีช่องไม่ว่าง)
    { id: 'bk-1003', carId: 'car-01', bookedById: 'u-emp-02', driverId: 'u-emp-02', purpose: 'ตรวจหน้างานโครงการ', passengers: 2, start: at(now, 0, 9), end: at(now, 0, 12), status: 'upcoming', createdAt: at(now, -1, 9) },
    { id: 'bk-1004', carId: 'car-01', bookedById: 'u-emp-03', driverId: 'u-emp-03', purpose: 'ไปธนาคาร', passengers: 1, start: at(now, 0, 14), end: at(now, 0, 16), status: 'upcoming', createdAt: at(now, -1, 11) },
    { id: 'bk-1005', carId: 'car-03', bookedById: 'u-emp-04', driverId: 'u-emp-04', purpose: 'รับ-ส่งทีมสัมมนา', passengers: 10, start: at(now, 1, 7), end: at(now, 1, 18), status: 'upcoming', createdAt: at(now, -3, 9) },
    { id: 'bk-0903', carId: 'car-03', bookedById: 'u-emp-02', driverId: 'u-emp-02', purpose: 'ขนอุปกรณ์ไซต์งาน', passengers: 4, start: at(now, -5, 9), end: at(now, -5, 15), status: 'completed', createdAt: at(now, -7, 9), actualStart: at(now, -5, 9, 5), actualEnd: at(now, -5, 15, 20), startMileage: 96700, endMileage: 96880, fuelMethod: 'reimburse', fuelAmount: 900, startPhotos: [], endPhotos: [] },
  ]

  for (const b of bookings) if (SEED_TRIP_DETAILS[b.id]) Object.assign(b, SEED_TRIP_DETAILS[b.id])

  const tickets: Ticket[] = [
    { id: 'tk-001', carId: 'car-01', occurredAt: at(now, -3, 11, 32), location: 'ถ.บางนา-ตราด กม.3 ขาออก', violation: 'ขับรถเร็วเกินกำหนด (กล้องตรวจจับ)', amount: 500, status: 'notified', matchedBookingId: 'bk-0901', matchedDriverId: DEMO_USER_ID, createdAt: at(now, -1, 9) },
    { id: 'tk-002', carId: 'car-03', occurredAt: at(now, -5, 10, 2), location: 'ถ.พระราม 4 แยกคลองเตย', violation: 'ฝ่าสัญญาณไฟแดง', amount: 1000, status: 'pending', matchedBookingId: 'bk-0903', matchedDriverId: 'u-emp-02', createdAt: at(now, -2, 9) },
  ]

  const maintenance: MaintenanceRecord[] = [
    { id: 'mt-001', carId: 'car-01', date: dateOnly(now, -150), type: 'service', description: 'เช็กระยะ 40,000 กม. เปลี่ยนน้ำมันเครื่อง+กรอง', vendor: 'Toyota บางนา', cost: 4850, mileage: 40000, createdAt: created },
    { id: 'mt-002', carId: 'car-05', date: dateOnly(now, -2), type: 'repair', description: 'เปลี่ยนคลัตช์ + ผ้าเบรกหน้า (กำลังซ่อม)', vendor: 'Isuzu พระราม 9', cost: 18500, mileage: 128900, createdAt: at(now, -2, 10) },
    { id: 'mt-003', carId: 'car-03', date: dateOnly(now, -40), type: 'tyre', description: 'เปลี่ยนยาง 4 เส้น', vendor: 'B-Quik ศรีนครินทร์', cost: 14200, mileage: 95100, createdAt: at(now, -40, 10) },
    { id: 'mt-004', carId: 'car-02', date: dateOnly(now, -60), type: 'service', description: 'เช็กระยะ 20,000 กม.', vendor: 'Honda รามอินทรา', cost: 3200, mileage: 20000, createdAt: at(now, -60, 10) },
  ]

  const settings: Settings[] = [
    { id: 'global', bufferMinutes: 0, noShowMinutes: 30, dayStartHour: 7, dayEndHour: 21, serviceIntervalKm: 10000 },
  ]

  return { users, branches, devices, cars, bookings, tickets, maintenance, settings }
}
