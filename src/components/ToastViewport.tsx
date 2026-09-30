import { dismissToast, useToasts } from './toast'

const TONES = {
  default: 'bg-text text-bg',
  warning: 'bg-warning-soft text-text border border-warning/40',
  danger: 'bg-expense text-on-expense',
}

/** Sits above the bottom nav; aria-live so screen readers announce "Tersimpan" etc. */
export function ToastViewport() {
  const toasts = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2 text-sm font-medium shadow-lg motion-safe:animate-[toast-in_150ms_ease-out] ${TONES[t.tone]}`}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick()
                dismissToast(t.id)
              }}
              className="-mr-2 min-h-11 rounded-xl px-3 font-bold underline underline-offset-2"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
