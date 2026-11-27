# FleetGo — ระบบจองรถและบันทึกการใช้รถองค์กร

React 19 + TypeScript + Vite + Tailwind CSS v4 · lucide-react · Leaflet (OpenStreetMap) · MSAL (Microsoft Entra ID)

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env   # ถ้ายังไม่มี Entra ID ข้ามได้ ใช้ปุ่มทดลองในหน้า Login
npm run dev
```

- **ทดลองเป็นพนักงาน / แอดมิน**: ปุ่มในหน้า Login
- **ทดสอบ JIT Provisioning**: ปุ่ม "จำลองพนักงานใหม่ล็อกอินครั้งแรก"
- **รีเซ็ตข้อมูลทดลอง**: หน้าโปรไฟล์ > ระบบ

## สถาปัตยกรรม 3 ชั้น

```
UI (src/pages, src/components)
   │  เรียกผ่าน service เท่านั้น
   ▼
Service / Repository (src/services/*Service.ts)   ← business logic: Buffer, No-Show, จับคู่ใบสั่ง, เตือน พ.ร.บ.
   │  เรียกผ่าน `db` เท่านั้น
   ▼
DataSource (src/services/dataSource.ts)           ← จุดสลับจุดเดียว
   ├─ LocalDataSource → MockData (src/data/mockData.ts) + localStorage
   └─ HttpDataSource  → REST API: GET/POST/PATCH/DELETE {VITE_API_BASE_URL}/{collection}
```

### สลับไปใช้ REST API + Azure

1. ตั้ง `VITE_DATA_SOURCE=api` และ `VITE_API_BASE_URL` ใน `.env`
2. API ต้องมี collection: `users`, `devices`, `cars`, `bookings`, `tickets`, `maintenance`, `settings` (โครงสร้างตาม `src/types.ts`)
3. Bearer token มาจาก Entra ID อัตโนมัติ เปลี่ยน scope ได้ที่ `API_SCOPES` ใน `src/services/authService.ts`
4. ไฟล์แนบ: แก้ `fileService.upload()` ใน `src/services/fileService.ts` ให้อัปโหลดขึ้น Azure Blob Storage ผ่าน SAS URL แล้วเก็บ URL แทน Data URL
5. ควรย้าย business logic ที่สำคัญ (ตรวจคิวชน, No-Show, จับคู่ใบสั่ง) ไปทำซ้ำฝั่ง server ด้วย

### Deploy บน Azure Static Web Apps

`public/staticwebapp.config.json` ตั้งค่า SPA fallback ให้แล้ว (รองรับ deep link เช่น `/admin`)

## โครงสร้างโฟลเดอร์

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `src/pages` | หน้าจอพนักงาน: Home, Fleet, Booking, Confirmed, My Bookings, Trip (3 ขั้นตอน), Profile |
| `src/pages/admin` | Admin Console 5 แท็บ (route `/admin` เฉพาะ `role === "admin"`) |
| `src/components` | UI กลาง, AppShell (Top Navbar / Bottom Tab Bar), แผนที่, ตารางว่าง, ไฟล์แนบ |
| `src/services` | Service / Repository layer + DataSource |
| `src/lib` | ฟังก์ชันวันที่, CSV (UTF-8 BOM), .ics, useQuery |
