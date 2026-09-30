import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'warning' | 'danger'
  action?: { label: string; onClick: () => void }
  /** ms; default 3000. */
  duration: number
}

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function showToast(message: string, options: Partial<Omit<Toast, 'id' | 'message'>> = {}): number {
  const toast: Toast = { id: ++seq, message, tone: 'default', duration: 3000, ...options }
  // Keep at most 3 on screen.
  toasts = [...toasts.slice(-2), toast]
  emit()
  setTimeout(() => dismissToast(toast.id), toast.duration)
  return toast.id
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
}
