import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Connect } from 'vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** ส่งไฟล์ .apk พร้อม Content-Type ที่ถูกต้อง เพื่อให้ Android กดลิงก์แล้วติดตั้งได้ทันที */
const apkHeaders: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url?.split('?')[0].endsWith('.apk')) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive')
    res.setHeader('Content-Disposition', 'attachment; filename="FleetGo.apk"')
  }
  next()
}

// https://vite.dev/config/
export default defineConfig({
  // ใช้ path แบบ relative เพื่อให้ไฟล์/รูปโหลดได้เมื่อแพ็กเป็นแอป Android (Capacitor)
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'apk-download-headers',
      configureServer: (server) => void server.middlewares.use(apkHeaders),
      configurePreviewServer: (server) => void server.middlewares.use(apkHeaders),
    },
    // PWA: เพิ่มลงหน้าจอหลักได้ + เก็บไฟล์แอปไว้ในเครื่องให้เปิดเร็ว
    // ลงทะเบียน service worker เองใน src/components/UpdatePrompt.tsx (ข้ามเมื่อเปิดในแอป Android/Capacitor)
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'FleetGo MCS — ระบบจองรถองค์กร',
        short_name: 'FleetGo MCS',
        description: 'จองรถส่วนกลางขององค์กร เริ่มใช้รถ และคืนรถ',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#003D7C',
        theme_color: '#003D7C',
        icons: [
          { src: '/pwa-192x192.png?v=3', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png?v=3', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // เก็บเฉพาะไฟล์ของแอป ไม่เก็บไฟล์ APK (5 MB) และรูปรถ (โหลดเมื่อเปิดดู)
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['downloads/**', 'cars/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/downloads\//, /^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/cars/'),
            handler: 'CacheFirst',
            options: { cacheName: 'car-photos', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: {
    // เปิดให้มือถือ/iPad ในวง Wi-Fi เดียวกันเข้าได้ผ่าน IP ของเครื่อง
    host: true,
  },
  preview: {
    host: true,
    // อนุญาตลิงก์ทดสอบชั่วคราวผ่าน Cloudflare Tunnel (https) สำหรับทดลองติดตั้ง PWA บนมือถือ
    allowedHosts: ['.trycloudflare.com'],
  },
})
