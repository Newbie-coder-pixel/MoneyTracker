import { Download, Share, SquarePlus, X } from 'lucide-react'
import { setSetting, useSettings } from '../db/settings'
import { isIOS, isStandalone, promptInstall, useCanPromptInstall } from './install-prompt'

/** "Pasang ke layar utama" (PRD §5.3 step 4): Android gets the install prompt, iPhone gets instructions. */
export function InstallBanner() {
  const settings = useSettings()
  const canPrompt = useCanPromptInstall()
  if (!settings || settings.installHintDismissed || isStandalone()) return null
  const ios = isIOS()
  if (!ios && !canPrompt) return null

  const dismiss = () => void setSetting('installHintDismissed', true)

  return (
    <section className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted p-4">
      <Download className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Pasang ke layar utama</p>
        {ios ? (
          <p className="mt-1 text-text-muted">
            Ketuk <Share className="inline size-4 align-text-bottom" aria-label="Bagikan" /> di Safari, lalu pilih{' '}
            <b className="text-text">
              Tambahkan ke Layar Utama <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" />
            </b>
            . Pengingat harian di iPhone hanya jalan dari aplikasi yang dipasang.
          </p>
        ) : (
          <>
            <p className="mt-1 text-text-muted">Buka lebih cepat dan tetap jalan tanpa internet.</p>
            <button
              type="button"
              onClick={() => void promptInstall().then((ok) => ok && dismiss())}
              className="mt-2 min-h-11 rounded-full bg-primary px-4 font-semibold text-on-primary"
            >
              Pasang aplikasi
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Tutup" className="-mt-2 -mr-2 grid size-11 place-items-center rounded-full">
        <X className="size-5" aria-hidden="true" />
      </button>
    </section>
  )
}
