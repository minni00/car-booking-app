import { config } from '../config'
import { DEMO_ADMIN_ID, DEMO_USER_ID } from '../data/mockData'
import type { Session, User } from '../types'
import { db, setTokenProvider } from './dataSource'
import { deviceService } from './deviceService'
import { userService } from './userService'

const SESSION_KEY = 'fleetgo.session'
const API_SCOPES = ['User.Read'] // TODO: เปลี่ยนเป็น api://<client-id>/access_as_user เมื่อมี REST API บน Azure

function saveSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
}

async function startSession(user: User, provider: Session['provider']): Promise<Session> {
  // บันทึก session ก่อน register อุปกรณ์ เพื่อให้ listener ที่ตรวจ session เห็นค่าใหม่เสมอ
  const session: Session = { userId: user.id, deviceId: deviceService.currentId(), provider, signedInAt: new Date().toISOString() }
  saveSession(session)
  await deviceService.register(user.id)
  return session
}

// ---------- Microsoft Entra ID (MSAL) — โหลดเฉพาะเมื่อใช้งาน ----------
type Msal = typeof import('@azure/msal-browser')
let pcaPromise: Promise<InstanceType<Msal['PublicClientApplication']>> | null = null

function getMsal() {
  if (!pcaPromise) {
    pcaPromise = import('@azure/msal-browser').then(async ({ PublicClientApplication }) => {
      const pca = new PublicClientApplication({
        auth: {
          clientId: config.entra.clientId,
          authority: `https://login.microsoftonline.com/${config.entra.tenantId}`,
          redirectUri: window.location.origin,
        },
      })
      await pca.initialize()
      return pca
    })
  }
  return pcaPromise
}

export interface LoginResult {
  user: User
  session: Session
  provisioned: boolean
}

export const authService = {
  getSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as Session) : null
    } catch {
      return null
    }
  },

  /** ตรวจว่า session ยังใช้ได้ (อุปกรณ์อาจถูกสั่งออกจากระบบระยะไกล) */
  async resolveUser(): Promise<{ user: User; session: Session } | null> {
    const session = authService.getSession()
    if (!session) return null
    const [user, active] = await Promise.all([db.get('users', session.userId), deviceService.isActive(session.deviceId, session.userId)])
    if (!user || !active) {
      saveSession(null)
      return null
    }
    if (session.provider === 'entra' && config.entra.enabled) {
      // คืนค่า token provider หลังรีเฟรชหน้า
      setTokenProvider(async () => {
        const pca = await getMsal()
        const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0]
        if (!account) return null
        const r = await pca.acquireTokenSilent({ scopes: API_SCOPES, account })
        return r.accessToken
      })
    }
    return { user, session }
  },

  /**
   * ล็อกอินด้วย Microsoft Entra ID
   * ชีวมาตร (Windows Hello / Face ID / Touch ID / Passkey) จัดการโดยหน้า Entra ตามนโยบาย Passwordless ขององค์กร
   */
  async loginWithEntra(): Promise<LoginResult> {
    if (!config.entra.enabled) {
      throw new Error('ยังไม่ได้ตั้งค่า Entra ID — คัดลอก .env.example เป็น .env แล้วใส่ VITE_ENTRA_CLIENT_ID / VITE_ENTRA_TENANT_ID')
    }
    const pca = await getMsal()
    const result = await pca.loginPopup({ scopes: API_SCOPES, prompt: 'select_account' })
    const account = result.account
    pca.setActiveAccount(account)
    setTokenProvider(async () => {
      const r = await pca.acquireTokenSilent({ scopes: API_SCOPES, account })
      return r.accessToken
    })
    const { user, created } = await userService.provisionOnLogin({
      oid: account.localAccountId,
      email: account.username,
      name: account.name ?? account.username,
    })
    const session = await startSession(user, 'entra')
    return { user, session, provisioned: created }
  },

  /** ปุ่มทดลอง: สลับล็อกอินเป็นพนักงาน / แอดมิน */
  async loginDemo(role: 'user' | 'admin'): Promise<LoginResult> {
    const id = role === 'admin' ? DEMO_ADMIN_ID : DEMO_USER_ID
    let user = await db.get('users', id)
    if (!user) throw new Error('ไม่พบบัญชีทดลอง กรุณารีเซ็ตข้อมูลทดลอง')
    user = await db.update('users', id, { lastLoginAt: new Date().toISOString() })
    const session = await startSession(user, 'demo')
    return { user, session, provisioned: false }
  },

  /** จำลองพนักงานใหม่ล็อกอิน Entra ครั้งแรก เพื่อทดสอบ JIT Provisioning */
  async loginDemoNewEmployee(): Promise<LoginResult> {
    const n = Math.floor(1000 + Math.random() * 9000)
    const { user, created } = await userService.provisionOnLogin({
      oid: crypto.randomUUID(),
      email: `new.employee${n}@fleetgo.co.th`,
      name: `พนักงานใหม่ ${n}`,
    })
    const session = await startSession(user, 'demo')
    return { user, session, provisioned: created }
  },

  async logout(): Promise<void> {
    const session = authService.getSession()
    saveSession(null)
    if (session) await deviceService.revoke(session.deviceId).catch(() => undefined)
    if (session?.provider === 'entra' && config.entra.enabled) {
      const pca = await getMsal()
      pca.setActiveAccount(null)
    }
  },
}
