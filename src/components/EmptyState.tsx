import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface text-text-muted">
        <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="max-w-60 text-sm text-text-muted">{message}</p>
    </div>
  )
}
