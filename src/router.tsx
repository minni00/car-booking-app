import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

/** Router ขนาดเล็กบน History API (ไม่ต้องพึ่งไลบรารีเพิ่ม) */

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

window.addEventListener('popstate', notify)

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const getSnapshot = () => window.location.pathname + window.location.search

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (to === getSnapshot()) return
  if (opts.replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  notify()
  window.scrollTo({ top: 0 })
}

export function useLocation(): { pathname: string; search: URLSearchParams } {
  const href = useSyncExternalStore(subscribe, getSnapshot)
  const url = new URL(href, window.location.origin)
  return { pathname: url.pathname, search: url.searchParams }
}

/** จับคู่ path เช่น "/book/:carId" → { carId: "car-01" } */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const s = pathname.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handle} {...rest} />
}
