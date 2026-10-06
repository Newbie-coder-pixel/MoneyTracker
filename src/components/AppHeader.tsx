import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

type AppHeaderProps = {
  /** Screen name; the mockups sometimes show "Beranda" everywhere, but it must follow the screen (PRD §9). */
  title: string
  /** Small caps line above the title (a ledger-style index marker). */
  eyebrow?: string
  /** Sub-pages (opened from Lainnya) get a back arrow. */
  back?: boolean
  actions?: ReactNode
}

export function AppHeader({ title, eyebrow, back = false, actions }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // A sub-page opened directly (refresh, bookmark) has no in-app history; go to Lainnya instead of leaving the app.
  const goBack = () => (location.key === 'default' ? navigate('/lainnya', { replace: true }) : navigate(-1))

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex h-16 items-center gap-3 px-4">
        {back && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Kembali"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-text active:bg-surface-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="label-caps truncate">{eyebrow}</p>}
          <h1 className="truncate text-xl leading-tight font-bold">{title}</h1>
        </div>
        {actions}
      </div>
    </header>
  )
}
