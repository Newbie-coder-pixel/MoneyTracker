import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, BellRing, ChevronLeft, NotebookText, Share, ShieldCheck, SquarePlus, WifiOff, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AppLogo } from '../../components/AppLogo'
import { IconBadge } from '../../components/IconBadge'
import { AmountInput, inputClass } from '../../components/Pickers'
import { TimeWheel } from '../../components/TimeWheel'
import { db } from '../../db/schema'
import { CASH_WALLET_ID } from '../../db/seed'
import { setSetting } from '../../db/settings'
import { saveWallet } from '../../db/wallets'
import { todayKey } from '../../lib/dates'
import { formatRupiah } from '../../lib/money'
import { isIOS, isStandalone } from '../../pwa/install-prompt'
import { enablePush } from '../../pwa/push'
import { RestorePanel } from '../backup/RestorePanel'
import { BANK_NAMES, EWALLET_NAMES } from '../wallets/walletTypes'

type Step = 'install' | 'welcome' | 'restore' | 'wallets' | 'reminder'

const finish = () => setSetting('onboarded', true)

type OptionalWalletValue = { on: boolean; name: string; custom: boolean; balance: number }
const OTHER = '__other__'
/** "Lainnya (tulis sendiri)" was chosen but no name typed yet. */
const missingName = (w: OptionalWalletValue) => w.on && w.custom && !w.name.trim()

/** First-run flow (FR-10.4): welcome → wallets & opening balances → reminder. */
export function Onboarding() {
  // iPhone in Safari: installed app and Safari don't share storage, so guide installation first (FR-10.5).
  const [step, setStep] = useState<Step>(isIOS() && !isStandalone() ? 'install' : 'welcome')
  const stepNumber = { install: 0, welcome: 1, restore: 1, wallets: 2, reminder: 3 }[step]
  const back: Partial<Record<Step, Step>> = { restore: 'welcome', wallets: 'welcome', reminder: 'wallets' }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Ledger-style progress: "Langkah 1 dari 3" over three rules, as in the mockup. */}
      <header className="pb-5">
        <div className="flex h-11 items-center gap-2">
          {back[step] && (
            <button type="button" onClick={() => setStep(back[step]!)} aria-label="Kembali" className="-ml-3 grid size-11 place-items-center rounded-full">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
          )}
          <span className="label-caps flex-1">{stepNumber > 0 ? `Langkah ${stepNumber} dari 3` : 'Sebelum mulai'}</span>
          <span className="label-caps">Money Tracker</span>
        </div>
        {stepNumber > 0 && (
          <div className="mt-1 flex gap-2" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1 flex-1 rounded-full ${n <= stepNumber ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        )}
      </header>

      {step === 'install' && <InstallStep onContinue={() => setStep('welcome')} />}
      {step === 'welcome' && <WelcomeStep onNext={() => setStep('wallets')} onRestore={() => setStep('restore')} />}
      {step === 'restore' && (
        <div className="flex-1 space-y-4">
          <h1 className="text-[1.75rem] leading-9 font-bold tracking-tight">Pulihkan data</h1>
          <p className="text-text-muted">Pilih file backup (.json) yang pernah kamu simpan dari Money Tracker.</p>
          <RestorePanel allowMerge={false} onRestored={() => void finish()} />
        </div>
      )}
      {step === 'wallets' && <WalletsStep onNext={() => setStep('reminder')} />}
      {step === 'reminder' && <ReminderStep />}

    </main>
  )
}

function Primary({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-on-primary disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function InstallStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <h1 className="text-[1.75rem] leading-9 font-bold tracking-tight">Pasang dulu ke Layar Utama</h1>
      <p className="text-text-muted">Di iPhone, data di Safari dan di aplikasi yang dipasang itu terpisah. Pasang dulu supaya datamu tersimpan di tempat yang benar dan pengingat bisa jalan.</p>
      <ol className="space-y-3">
        {[
          [<Share key="s" className="size-5" />, 'Ketuk ikon Bagikan', 'Di bilah bawah Safari.'],
          [<SquarePlus key="p" className="size-5" />, 'Tambahkan ke Layar Utama', 'Gulir menu lalu pilih "Add to Home Screen".'],
          [<AppLogo key="l" className="size-5" />, 'Buka dari ikon baru', 'Lanjutkan pengaturan di sana.'],
        ].map(([icon, title, hint], i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted">{icon}</span>
            <span>
              <span className="block font-semibold">
                {i + 1}. {title}
              </span>
              <span className="block text-sm text-text-muted">{hint}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-auto space-y-2">
        <button type="button" onClick={onContinue} className="min-h-12 w-full rounded-full border border-border bg-surface font-semibold">
          Lanjut di Safari
        </button>
        <p className="text-center text-xs text-text-muted">Data yang diisi di Safari tidak ikut ke aplikasi yang dipasang nanti.</p>
      </div>
    </div>
  )
}

function WelcomeStep({ onNext, onRestore }: { onNext: () => void; onRestore: () => void }) {
  const points: [ReactNode, string, string][] = [
    [<Zap key="z" className="size-5" />, 'Tanpa login & registrasi', 'Langsung pakai, tanpa kata sandi atau email.'],
    [<ShieldCheck key="s" className="size-5" />, 'Data hanya milikmu', 'Tersimpan di HP ini saja. Data di tiap perangkat tidak tersinkron.'],
    [<WifiOff key="w" className="size-5" />, 'Tetap jalan offline', 'Catat transaksi kapan saja tanpa kuota.'],
  ]
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="grid size-14 place-items-center rounded-xl border border-border bg-surface-muted">
        <NotebookText className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">
          Catat uangmu,
          <br />
          tanpa ribet.
        </h1>
        <p className="mt-3 text-text-muted">Semua data tersimpan di HP ini, tanpa akun. Data tidak tersinkron antar perangkat.</p>
      </div>
      <ul className="card space-y-4 p-4">
        {points.map(([icon, title, hint]) => (
          <li key={title} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-accent">{icon}</span>
            <span>
              <span className="block text-[15px] font-semibold">{title}</span>
              <span className="block text-[13px] text-text-muted">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-3">
        <Primary onClick={onNext}>
          Mulai <ArrowRight className="size-5" aria-hidden="true" />
        </Primary>
        <p className="text-center text-sm text-text-muted">
          Sudah punya file backup?{' '}
          <button type="button" onClick={onRestore} className="min-h-11 font-semibold text-accent underline underline-offset-2">
            Pulihkan data
          </button>
        </p>
      </div>
    </div>
  )
}

function WalletsStep({ onNext }: { onNext: () => void }) {
  const cash = useLiveQuery(() => db.wallets.get(CASH_WALLET_ID))
  const [cashBalance, setCashBalance] = useState<number | null>(null)
  const [ewallet, setEwallet] = useState<OptionalWalletValue>({ on: true, name: 'GoPay', custom: false, balance: 0 })
  const [bank, setBank] = useState<OptionalWalletValue>({ on: true, name: 'BCA', custom: false, balance: 0 })
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const cashValue = cashBalance ?? cash?.initialBalance ?? 0
  const total = cashValue + (ewallet.on ? ewallet.balance : 0) + (bank.on ? bank.balance : 0)

  const save = async () => {
    if (missingName(ewallet) || missingName(bank)) {
      setShowErrors(true)
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus())
      return
    }
    setSaving(true)
    const today = todayKey()
    if (cash) await db.wallets.update(cash.id, { initialBalance: cashValue, initialDate: today })
    const base = { initialDate: today, includeInTotal: true }
    if (ewallet.on) await saveWallet({ ...base, name: ewallet.name.trim(), type: 'ewallet', color: '#0891b2', icon: 'smartphone', initialBalance: ewallet.balance })
    if (bank.on) await saveWallet({ ...base, name: bank.name.trim(), type: 'bank', color: '#2563eb', icon: 'landmark', initialBalance: bank.balance })
    onNext()
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="label-caps">Langkah 2: Dompet & akun</p>
      <h1 className="text-[1.75rem] leading-9 font-bold tracking-tight">Berapa saldo awalmu?</h1>
      <p className="text-sm text-text-muted">Isi saldo dompet yang sering kamu pakai. Tidak harus pas; nanti bisa disesuaikan.</p>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon="banknote" color="#059669" />
          <span className="font-semibold">Uang tunai (Cash)</span>
        </div>
        <AmountInput value={cashValue} onChange={setCashBalance} />
      </section>
      <OptionalWallet icon="smartphone" color="#0891b2" label="E-wallet" names={EWALLET_NAMES} value={ewallet} showError={showErrors} onChange={setEwallet} />
      <OptionalWallet icon="landmark" color="#2563eb" label="Rekening bank" names={BANK_NAMES} value={bank} showError={showErrors} onChange={setBank} />
      <p className="text-xs text-text-muted">Kartu kredit dan dompet lain bisa ditambah nanti di Lainnya → Dompet.</p>

      <div className="mt-auto space-y-3">
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="label-caps">Total saldo awal</span>
          <span className="text-xl font-bold tracking-tight">{formatRupiah(total)}</span>
        </div>
        <Primary onClick={() => void save()} disabled={saving}>
          Lanjut ke pengingat <ArrowRight className="size-5" aria-hidden="true" />
        </Primary>
      </div>
    </div>
  )
}

function OptionalWallet({
  icon,
  color,
  label,
  names,
  value,
  onChange,
  showError,
}: {
  icon: string
  color: string
  label: string
  names: string[]
  value: OptionalWalletValue
  onChange: (v: OptionalWalletValue) => void
  showError: boolean
}) {
  const invalid = showError && missingName(value)
  const errorId = `${label.replace(/\W+/g, '-').toLowerCase()}-error`
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 ${value.on ? '' : 'opacity-70'}`}>
      <label className="flex items-center gap-3">
        <IconBadge icon={icon} color={color} />
        <span className="flex-1 font-semibold">{label}</span>
        <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} className="size-5 accent-primary" aria-label={`Tambah ${label}`} />
      </label>
      {value.on && (
        <div className="mt-2 space-y-1">
          <select
            value={value.custom ? OTHER : value.name}
            onChange={(e) =>
              onChange(e.target.value === OTHER ? { ...value, custom: true, name: '' } : { ...value, custom: false, name: e.target.value })
            }
            aria-label={`Pilih ${label}`}
            className={inputClass}
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={OTHER}>Lainnya (tulis sendiri)</option>
          </select>
          {value.custom && (
            <input
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              aria-label={`Nama ${label}`}
              placeholder={`Tulis nama ${label.toLowerCase()}`}
              maxLength={40}
              required
              autoFocus
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              className={`${inputClass} ${invalid ? 'border-expense' : ''}`}
            />
          )}
          {invalid && (
            <p id={errorId} className="px-1 text-sm text-expense">
              Nama {label.toLowerCase()} wajib diisi.
            </p>
          )}
          <AmountInput value={value.balance} onChange={(balance) => onChange({ ...value, balance })} />
        </div>
      )}
    </section>
  )
}

function ReminderStep() {
  const [time, setTime] = useState('21:00')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ios = isIOS() && !isStandalone()

  const activate = async () => {
    setBusy(true)
    await setSetting('dailyReminderTime', time)
    const result = await enablePush()
    setBusy(false)
    if (result.ok) return void finish()
    setMessage(
      result.reason === 'denied'
        ? 'Izin notifikasi ditolak. Kamu tetap bisa melihat pengingat lewat ikon lonceng, atau mengaktifkannya nanti.'
        : result.reason === 'ios-install'
          ? 'Di iPhone, notifikasi hanya jalan dari aplikasi yang dipasang di Layar Utama. Aktifkan nanti dari sana.'
          : `Notifikasi belum bisa diaktifkan sekarang (${result.detail ?? result.reason}). Coba lagi nanti di Lainnya → Pengingat.`,
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="label-caps">Langkah terakhir</p>
      <h1 className="text-[1.75rem] leading-9 font-bold tracking-tight">Jangan lupa catat setiap hari</h1>
      <p className="text-sm text-text-muted">Pengingat hanya muncul kalau hari itu kamu belum mencatat apa pun.</p>
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="flex items-center gap-2 font-semibold">
          <BellRing className="size-5" aria-hidden="true" /> Pengingat harian
        </p>
        <p className="mt-1 text-sm text-text-muted">Geser untuk memilih jam. Rekomendasi: 21:00.</p>
        <div className="mt-3">
          <TimeWheel value={time} onChange={setTime} />
        </div>
      </section>
      {ios && (
        <p className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          iPhone mewajibkan aplikasi dipasang di Layar Utama (iOS 16.4+) sebelum notifikasi bisa diizinkan: <b>Bagikan → Tambahkan ke Layar Utama</b>, lalu buka dari ikonnya.
        </p>
      )}
      {message && (
        <p role="alert" className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          {message}
        </p>
      )}
      <div className="mt-auto space-y-2">
        {message ? (
          <Primary onClick={() => void finish()}>Selesai</Primary>
        ) : (
          <Primary onClick={() => void activate()} disabled={busy}>
            Aktifkan pengingat & selesai
          </Primary>
        )}
        {!message && (
          <button
            type="button"
            onClick={() => void setSetting('dailyReminderTime', time).then(finish)}
            className="min-h-12 w-full rounded-full font-semibold text-text-muted"
          >
            Lewati dan langsung ke Beranda
          </button>
        )}
      </div>
    </div>
  )
}
