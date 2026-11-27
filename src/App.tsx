import { lazy, Suspense, type ReactNode } from 'react'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Card, LinkButton, Loading } from './components/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BookingConfirmedPage } from './pages/BookingConfirmedPage'
import { BookingPage } from './pages/BookingPage'
import { FleetPage } from './pages/FleetPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { TripPage } from './pages/TripPage'
import { matchPath, useLocation } from './router'

const AdminPage = lazy(() => import('./pages/admin/AdminPage'))

type Route = { path: string; render: (p: Record<string, string>) => ReactNode }

const ROUTES: Route[] = [
  { path: '/', render: () => <HomePage /> },
  { path: '/fleet', render: () => <FleetPage /> },
  { path: '/book/:carId', render: (p) => <BookingPage carId={p.carId} /> },
  { path: '/bookings', render: () => <MyBookingsPage /> },
  { path: '/bookings/:id/confirmed', render: (p) => <BookingConfirmedPage bookingId={p.id} /> },
  { path: '/trip/:id', render: (p) => <TripPage key={p.id} bookingId={p.id} /> },
  { path: '/profile', render: () => <ProfilePage /> },
  {
    path: '/admin',
    render: () => (
      <Suspense fallback={<Loading />}>
        <AdminPage />
      </Suspense>
    ),
  },
]

function Routes() {
  const { pathname } = useLocation()
  for (const r of ROUTES) {
    const params = matchPath(r.path, pathname)
    if (params) return <>{r.render(params)}</>
  }
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <p className="font-display text-4xl font-semibold">404</p>
      <p className="mt-2 text-muted">ไม่พบหน้าที่ต้องการ</p>
      <LinkButton to="/" variant="secondary" className="mt-5">
        กลับหน้าแรก
      </LinkButton>
    </Card>
  )
}

function Gate() {
  const { user, ready } = useAuth()
  if (!ready) return <Loading />
  if (!user) return <LoginPage />
  return (
    <AppShell>
      <Routes />
    </AppShell>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
        <UpdatePrompt />
      </AuthProvider>
    </ToastProvider>
  )
}
