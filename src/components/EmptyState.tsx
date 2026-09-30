import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-surface-muted text-text-muted">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <p className="max-w-60 text-sm text-text-muted">{message}</p>
    </div>
  )
}
