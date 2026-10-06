import { useLiveQuery } from 'dexie-react-hooks'
import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { db } from '../../db/schema'

/** Header bell with a badge of active, due reminders (FR-8.10). */
export function ReminderBell() {
  const count = useLiveQuery(() =>
    db.reminders
      .where('status')
      .equals('active')
      .filter((r) => r.dueAt <= Date.now())
      .count(),
  )
  return (
    <Link
      to="/pengingat"
      aria-label={count ? `Pengingat, ${count} baru` : 'Pengingat'}
      className="relative grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-text active:bg-surface-muted"
    >
      <Bell className="size-5" strokeWidth={1.75} aria-hidden="true" />
      {!!count && (
        <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1 text-[11px] font-bold text-on-expense">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
