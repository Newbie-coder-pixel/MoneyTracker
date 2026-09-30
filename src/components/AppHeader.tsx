import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AppLogo } from './AppLogo'

type AppHeaderProps = {
  /** Screen name; the mockups sometimes show "Beranda" everywhere, but it must follow the screen (PRD §9). */
  title: string
  /** Sub-pages (opened from Lainnya) get a back arrow instead of the logo. */
  back?: boolean
  actions?: ReactNode
}

export function AppHeader({ title, back = false, actions }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // A sub-page opened directly (refresh, bookmark) has no in-app history; go to Lainnya instead of leaving the app.
  const goBack = () => (location.key === 'default' ? navigate('/lainnya', { replace: true }) : navigate(-1))

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4">
        {back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Kembali"
            className="-ml-2 grid size-11 place-items-center rounded-full text-text hover:bg-surface-muted"
          >
            <ArrowLeft className="size-6" />
          </button>
        ) : (
          <AppLogo className="size-10" />
        )}
        <div className="min-w-0 flex-1">
          {!back && (
            <p className="text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase">Money Tracker</p>
          )}
          <h1 className="truncate text-xl leading-tight font-bold">{title}</h1>
        </div>
        {actions}
      </div>
    </header>
  )
}
