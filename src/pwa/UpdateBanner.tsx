import { RefreshCw } from 'lucide-react'
import { updateServiceWorker, useNeedRefresh } from './register'

/** "Versi baru tersedia" + "Muat ulang" (FR-10.6); Dexie migrations run on the reload. */
export function UpdateBanner() {
  const needRefresh = useNeedRefresh()
  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 px-4">
      <div className="flex w-full items-center gap-3 rounded-2xl bg-text px-4 py-2 text-sm text-bg shadow-lg">
        <RefreshCw className="size-5 shrink-0" aria-hidden="true" />
        <span className="flex-1 font-medium">Versi baru tersedia</span>
        <button type="button" onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-xl px-2 font-bold underline underline-offset-2">
          Muat ulang
        </button>
      </div>
    </div>
  )
}
