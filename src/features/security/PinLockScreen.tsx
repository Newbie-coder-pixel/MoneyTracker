import { FingerprintPattern, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppLogo } from '../../components/AppLogo'
import type { Settings } from '../../db/types'
import { PIN_MIN, verifyPin } from '../../lib/pin'
import { verifyBiometric } from './biometric'
import { unlock } from './lockState'
import { PinPad } from './PinPad'

export function PinLockScreen({ settings }: { settings: Settings }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const credentialId = settings.biometricCredentialId

  const unlockWithBiometric = async (id: string) => {
    if (await verifyBiometric(id)) unlock()
  }

  // Offer biometrics straight away. Browsers that insist on a tap first reject this
  // silently, and the button below still works.
  useEffect(() => {
    if (credentialId && document.visibilityState === 'visible') void unlockWithBiometric(credentialId)
  }, [credentialId])

  const submit = async (value: string) => {
    if (settings.pinHash && settings.pinSalt && (await verifyPin(value, settings.pinSalt, settings.pinHash))) {
      unlock()
      return
    }
    setAttempts((a) => a + 1)
    setError('PIN salah')
    setPin('')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <AppLogo className="size-14" />
        <p className="label-caps">Money Tracker</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Lock className="size-5" strokeWidth={1.75} aria-hidden="true" /> Masukkan PIN
        </h1>
      </div>
      <PinPad value={pin} onChange={setPin} onSubmit={(v) => void submit(v)} minLength={PIN_MIN} error={error} />
      {credentialId && (
        <button
          type="button"
          onClick={() => void unlockWithBiometric(credentialId)}
          className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-5 font-semibold active:bg-surface-muted"
        >
          <FingerprintPattern className="size-5" strokeWidth={1.75} aria-hidden="true" /> Buka dengan Face ID / sidik jari
        </button>
      )}
      {attempts >= 3 && (
        <p className="max-w-xs text-center text-xs text-text-muted">
          Lupa PIN? PIN hanya mengunci tampilan. Tanpa PIN, satu-satunya cara adalah menghapus data situs ini di pengaturan browser lalu memulihkan dari file backup.
        </p>
      )}
    </main>
  )
}
