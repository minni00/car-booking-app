import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { authService, type LoginResult } from '../services/authService'
import { subscribe } from '../services/events'
import type { Session, User } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  ready: boolean
  isAdmin: boolean
  loginEntra: () => Promise<LoginResult>
  loginDemo: (role: 'user' | 'admin') => Promise<LoginResult>
  loginDemoNewEmployee: () => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const res = await authService.resolveUser()
    setUser(res?.user ?? null)
    setSession(res?.session ?? null)
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh()
    // ตรวจซ้ำเมื่อข้อมูลผู้ใช้/อุปกรณ์เปลี่ยน (เช่น ถูกสั่งออกจากระบบระยะไกล หรือถูกเปลี่ยนสิทธิ์)
    const unsub = subscribe((c) => {
      if (c === 'users' || c === 'devices') void refresh()
    })
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      unsub()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const apply = useCallback((r: LoginResult) => {
    setUser(r.user)
    setSession(r.session)
    return r
  }, [])

  const value: AuthState = {
    user,
    session,
    ready,
    isAdmin: user?.role === 'admin',
    loginEntra: async () => apply(await authService.loginWithEntra()),
    loginDemo: async (role) => apply(await authService.loginDemo(role)),
    loginDemoNewEmployee: async () => apply(await authService.loginDemoNewEmployee()),
    logout: async () => {
      await authService.logout()
      setUser(null)
      setSession(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** ใช้ในหน้าที่ล็อกอินแล้วเท่านั้น */
// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('Not signed in')
  return user
}
