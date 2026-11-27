import { useCallback, useEffect, useState } from 'react'
import { subscribe } from '../services/events'

interface QueryState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
}

/** ดึงข้อมูลจาก Service แบบ async และโหลดใหม่อัตโนมัติเมื่อข้อมูลเปลี่ยน */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({ data: undefined, loading: true, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    let alive = true
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((err: unknown) =>
        alive && setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) })),
      )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
