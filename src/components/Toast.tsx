import { CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '../lib/format'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs, { id, message, tone }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'error' ? 5000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(max(env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px))+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? CircleAlert : Info
          return (
            <div key={t.id} className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg bg-ink px-4 py-3 text-sm text-white">
              <Icon className={cn('mt-0.5 size-4 shrink-0', t.tone === 'success' ? 'text-emerald-400' : t.tone === 'error' ? 'text-red-400' : 'text-sky-300')} />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)

// eslint-disable-next-line react-refresh/only-export-components
export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))
