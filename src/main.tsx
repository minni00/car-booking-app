import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ออฟไลน์ → index.html แสดงหน้า Fallback "กรุณาเชื่อมต่ออินเทอร์เน็ต" แทน ไม่ต้องเริ่มแอป
const offline = (window as unknown as { __FLEETGO_OFFLINE__?: boolean }).__FLEETGO_OFFLINE__

if (!offline) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
