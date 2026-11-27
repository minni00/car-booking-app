/** แจ้งเตือน UI เมื่อข้อมูลเปลี่ยน (ใช้กับ useQuery) */
type Listener = (collection: string) => void

const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emitChange(collection: string): void {
  listeners.forEach((fn) => fn(collection))
}
