import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

type SheetProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}

/** Bottom sheet built on <dialog> so focus trapping, Esc and inert background come from the browser. */
export function Sheet({ open, onClose, title, subtitle, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc fires "cancel"; route it through onClose so URL state stays the source of truth.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose() // backdrop click
      }}
      className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-0 text-text backdrop:bg-black/40 open:motion-safe:animate-[sheet-up_200ms_ease-out]"
    >
      <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" aria-hidden="true" />
        <div className="mb-4 flex items-start gap-3">
          <div className="flex-1">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-11 place-items-center rounded-full bg-surface-muted"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
