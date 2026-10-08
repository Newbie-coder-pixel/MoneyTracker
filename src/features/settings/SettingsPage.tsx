import { Bell, ChevronRight, FingerprintPattern, KeyRound, Monitor, Moon, Shapes, Sun, TriangleAlert, Wallet, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { inputClass } from '../../components/Pickers'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/toast'
import { deleteAllData } from '../../db/backup'
import { checkBudgets } from '../../db/budgets'
import { setSetting, useSettings } from '../../db/settings'
import type { Settings } from '../../db/types'
import { useTheme } from '../../hooks/useTheme'
import { todayKey } from '../../lib/dates'
import { hashPin, newSalt, PIN_MIN, verifyPin } from '../../lib/pin'
import type { ThemePreference } from '../../lib/theme'
import { syncPushOnOpen } from '../../pwa/push'
import { refreshReminders } from '../reminders/refresh'
import { isBiometricAvailable, registerBiometric } from '../security/biometric'
import { unlock } from '../security/lockState'
import { PinPad } from '../security/PinPad'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
  { value: 'system', label: 'Sistem', icon: Monitor },
]

export function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const settings = useSettings()
  const navigate = useNavigate()
  const [pinFlow, setPinFlow] = useState<'set' | 'change' | 'remove' | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  useEffect(() => {
    void isBiometricAvailable().then(setBiometricAvailable)
  }, [])

  if (!settings) return <AppHeader title="Pengaturan" back />

  const deleteAll = async () => {
    await deleteAllData()
    await checkBudgets([todayKey()])
    await refreshReminders()
    void syncPushOnOpen()
    showToast('Semua data dihapus')
    navigate('/', { replace: true })
  }

  const toggleBiometric = async (enable: boolean) => {
    if (!enable) {
      await setSetting('biometricCredentialId', undefined)
      return showToast('Face ID / sidik jari dimatikan')
    }
    const credentialId = await registerBiometric()
    if (!credentialId) return showToast('Face ID / sidik jari tidak jadi diaktifkan')
    await setSetting('biometricCredentialId', credentialId)
    showToast('Face ID / sidik jari aktif')
  }

  // Biometrics sit on top of the PIN, so the switch is shown but locked until a PIN exists.
  const biometricOn = !!settings.pinHash && !!settings.biometricCredentialId
  const biometricUsable = !!settings.pinHash && (biometricAvailable || biometricOn)
  const biometricHint = !settings.pinHash
    ? 'Atur PIN dulu. PIN tetap dipakai sebagai cadangan.'
    : biometricUsable
      ? 'Memakai kunci layar perangkat ini. PIN tetap bisa dipakai.'
      : 'Tidak tersedia di perangkat atau browser ini.'

  return (
    <>
      <AppHeader title="Pengaturan" back />
      <main className="space-y-5 p-4">
        <Section title="Preferensi keuangan">
          <label className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="block font-medium">Tanggal mulai bulan</span>
              <span className="block text-xs text-text-muted">Misal 25 untuk mengikuti tanggal gajian. Berlaku untuk statistik bulanan dan budget.</span>
            </span>
            <select
              value={settings.monthStartDay}
              onChange={async (e) => {
                await setSetting('monthStartDay', Number(e.target.value))
                await checkBudgets([todayKey()])
              }}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 font-semibold"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Tgl {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="block font-medium">Sembunyikan saldo</span>
              <span className="block text-xs text-text-muted">Saldo di Beranda tampil sebagai •••• sampai ikon mata diketuk.</span>
            </span>
            <input type="checkbox" checked={settings.hideBalance} onChange={(e) => void setSetting('hideBalance', e.target.checked)} className="size-5 accent-primary" />
          </label>
          <NavRow to="/lainnya/dompet" icon={Wallet} label="Kelola dompet" />
          <NavRow to="/lainnya/kategori" icon={Shapes} label="Kelola kategori" />
        </Section>

        <Section title="Tampilan">
          <div className="p-4">
            <p id="theme-heading" className="mb-3 font-medium">
              Tema aplikasi
            </p>
            <div role="radiogroup" aria-labelledby="theme-heading" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-muted p-1">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const selected = preference === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreference(value)}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-[13px] ${selected ? 'border-border bg-surface font-semibold text-text' : 'border-transparent font-medium text-text-muted'}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="Keamanan">
          {settings.pinHash ? (
            <>
              <button type="button" onClick={() => setPinFlow('change')} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
                <KeyRound className="size-5" aria-hidden="true" />
                <span className="flex-1 font-medium">Ubah PIN</span>
                <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setPinFlow('remove')} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
                <KeyRound className="size-5 text-text-muted" aria-hidden="true" />
                <span className="flex-1 font-medium">Matikan kunci PIN</span>
                <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setPinFlow('set')} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
              <KeyRound className="size-5" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-medium">Kunci dengan PIN</span>
                <span className="block text-xs text-text-muted">4–6 digit. Terkunci otomatis setelah 1 menit di latar belakang. Hanya mengunci tampilan, bukan mengenkripsi data.</span>
              </span>
              <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
            </button>
          )}
          <label className="flex min-h-16 items-center gap-3 px-4 py-3">
            <FingerprintPattern className={`size-5 ${biometricUsable ? '' : 'text-text-muted'}`} aria-hidden="true" />
            <span className="flex-1">
              <span className="block font-medium">Buka dengan Face ID / sidik jari</span>
              <span className="block text-xs text-text-muted">{biometricHint}</span>
            </span>
            <input
              type="checkbox"
              checked={biometricOn}
              disabled={!biometricUsable}
              onChange={(e) => void toggleBiometric(e.target.checked)}
              className="size-5 accent-primary"
            />
          </label>
        </Section>

        <Section title="Pengingat">
          <NavRow to="/pengingat" icon={Bell} label="Notifikasi & pengingat" hint={`Pengingat harian jam ${settings.dailyReminderTime}`} />
        </Section>

        <section className="space-y-3 rounded-xl border border-expense/30 bg-surface p-4">
          <h2 className="flex items-center gap-2 font-semibold text-expense">
            <TriangleAlert className="size-5" aria-hidden="true" /> Zona berbahaya
          </h2>
          <p className="text-sm text-text-muted">Hapus seluruh transaksi, dompet, budget, dan jadwal di perangkat ini. Tidak bisa dibatalkan. Backup dulu jika perlu.</p>
          {deleting ? (
            <>
              <label className="block text-sm">
                Ketik <b>HAPUS</b> untuk konfirmasi
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeleting(false)} className="min-h-12 rounded-full border border-border font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  disabled={confirmText.trim() !== 'HAPUS'}
                  onClick={() => void deleteAll()}
                  className="min-h-12 rounded-full bg-expense font-semibold text-on-expense disabled:opacity-40"
                >
                  Hapus semua
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setDeleting(true)} className="min-h-12 w-full rounded-full border border-expense/30 font-semibold text-expense">
              Hapus semua data
            </button>
          )}
        </section>

        <p className="text-center text-xs text-text-muted">Money Tracker v{__APP_VERSION__}</p>
      </main>

      <Sheet open={pinFlow !== null} onClose={() => setPinFlow(null)} title={pinFlow === 'remove' ? 'Matikan PIN' : pinFlow === 'change' ? 'Ubah PIN' : 'Atur PIN'}>
        {pinFlow && <PinFlow key={pinFlow} flow={pinFlow} settings={settings} onDone={() => setPinFlow(null)} />}
      </Sheet>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 label-caps">{title}</h2>
      <div className="card divide-y divide-border overflow-hidden">{children}</div>
    </section>
  )
}

function NavRow({ to, icon: Icon, label, hint }: { to: string; icon: LucideIcon; label: string; hint?: string }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-surface-muted">
      <Icon className="size-5" aria-hidden="true" />
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
      <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
    </Link>
  )
}

/** set: new → confirm. change: current → new → confirm. remove: current. */
function PinFlow({ flow, settings, onDone }: { flow: 'set' | 'change' | 'remove'; settings: Settings; onDone: () => void }) {
  const [stage, setStage] = useState<'current' | 'new' | 'confirm'>(flow === 'set' ? 'new' : 'current')
  const [value, setValue] = useState('')
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (pin: string) => {
    setError(null)
    if (pin.length < PIN_MIN) return
    if (stage === 'current') {
      const ok = !!settings.pinHash && !!settings.pinSalt && (await verifyPin(pin, settings.pinSalt, settings.pinHash))
      setValue('')
      if (!ok) return setError('PIN salah')
      if (flow === 'remove') {
        await setSetting('pinHash', undefined)
        await setSetting('pinSalt', undefined)
        await setSetting('biometricCredentialId', undefined)
        showToast('Kunci PIN dimatikan')
        return onDone()
      }
      return setStage('new')
    }
    if (stage === 'new') {
      setFirst(pin)
      setValue('')
      return setStage('confirm')
    }
    if (pin !== first) {
      setValue('')
      setStage('new')
      return setError('PIN tidak sama, ulangi')
    }
    // A leftover credential (e.g. kept through a restore) must not switch itself on with a new PIN.
    if (flow === 'set') await setSetting('biometricCredentialId', undefined)
    const salt = newSalt()
    await setSetting('pinSalt', salt)
    await setSetting('pinHash', await hashPin(pin, salt))
    unlock() // don't lock the user out right after setting it
    showToast('PIN disimpan')
    onDone()
  }

  const prompt = { current: 'Masukkan PIN saat ini', new: 'Masukkan PIN baru (4–6 digit)', confirm: 'Ulangi PIN baru' }[stage]
  return (
    <div className="space-y-2 pb-2">
      <p className="text-center font-medium">{prompt}</p>
      <PinPad value={value} onChange={setValue} onSubmit={(v) => void submit(v)} minLength={PIN_MIN} error={error} />
    </div>
  )
}
