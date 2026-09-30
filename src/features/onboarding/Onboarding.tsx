import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, BellRing, ChevronLeft, Lock, Share, ShieldCheck, SquarePlus, WifiOff, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AppLogo } from '../../components/AppLogo'
import { IconBadge } from '../../components/IconBadge'
import { AmountInput, inputClass } from '../../components/Pickers'
import { db } from '../../db/schema'
import { CASH_WALLET_ID } from '../../db/seed'
import { setSetting } from '../../db/settings'
import { saveWallet } from '../../db/wallets'
import { todayKey } from '../../lib/dates'
import { formatRupiah } from '../../lib/money'
import { isIOS, isStandalone } from '../../pwa/install-prompt'
import { enablePush } from '../../pwa/push'
import { RestorePanel } from '../backup/RestorePanel'

type Step = 'install' | 'welcome' | 'restore' | 'wallets' | 'reminder'

const finish = () => setSetting('onboarded', true)

/** First-run flow (FR-10.4): welcome → wallets & opening balances → reminder. */
export function Onboarding() {
  // iPhone in Safari: installed app and Safari don't share storage, so guide installation first (FR-10.5).
  const [step, setStep] = useState<Step>(isIOS() && !isStandalone() ? 'install' : 'welcome')
  const stepNumber = { install: 0, welcome: 1, restore: 1, wallets: 2, reminder: 3 }[step]
  const back: Partial<Record<Step, Step>> = { restore: 'welcome', wallets: 'welcome', reminder: 'wallets' }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex h-14 items-center gap-2">
        {back[step] ? (
          <button type="button" onClick={() => setStep(back[step]!)} aria-label="Kembali" className="-ml-2 grid size-11 place-items-center rounded-full">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
        ) : (
          <AppLogo className="size-9" />
        )}
        <span className="flex-1 font-bold text-primary">Money Tracker</span>
        {step !== 'install' && (
          <button type="button" onClick={() => void finish()} className="min-h-11 px-2 text-sm font-semibold text-primary">
            Lewati
          </button>
        )}
      </header>

      {step === 'install' && <InstallStep onContinue={() => setStep('welcome')} />}
      {step === 'welcome' && <WelcomeStep onNext={() => setStep('wallets')} onRestore={() => setStep('restore')} />}
      {step === 'restore' && (
        <div className="flex-1 space-y-4 pt-4">
          <h1 className="text-2xl font-bold">Pulihkan data</h1>
          <p className="text-text-muted">Pilih file backup (.json) yang pernah kamu simpan dari Money Tracker.</p>
          <RestorePanel allowMerge={false} onRestored={() => void finish()} />
        </div>
      )}
      {step === 'wallets' && <WalletsStep onNext={() => setStep('reminder')} />}
      {step === 'reminder' && <ReminderStep />}

      {stepNumber > 0 && (
        <div className="mt-6 flex justify-center gap-1.5">
          <span className="sr-only">Langkah {stepNumber} dari 3</span>
          {[1, 2, 3].map((n) => (
            <span key={n} aria-hidden="true" className={`h-2 rounded-full ${n === stepNumber ? 'w-8 bg-primary' : 'w-2 bg-border'}`} />
          ))}
        </div>
      )}
    </main>
  )
}

function Primary({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-on-primary shadow-lg shadow-primary/20 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function InstallStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-5 pt-4">
      <h1 className="text-2xl font-bold">Pasang dulu ke Layar Utama</h1>
      <p className="text-text-muted">Di iPhone, data di Safari dan di aplikasi yang dipasang itu terpisah. Pasang dulu supaya datamu tersimpan di tempat yang benar dan pengingat bisa jalan.</p>
      <ol className="space-y-3">
        {[
          [<Share key="s" className="size-5" />, 'Ketuk ikon Bagikan', 'Di bilah bawah Safari.'],
          [<SquarePlus key="p" className="size-5" />, 'Tambahkan ke Layar Utama', 'Gulir menu lalu pilih "Add to Home Screen".'],
          [<AppLogo key="l" className="size-5" />, 'Buka dari ikon baru', 'Lanjutkan pengaturan di sana.'],
        ].map(([icon, title, hint], i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-surface p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">{icon}</span>
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
        <button type="button" onClick={onContinue} className="min-h-12 w-full rounded-full bg-surface font-semibold">
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
    <div className="flex flex-1 flex-col gap-5 pt-4">
      <div className="mx-auto grid size-24 place-items-center rounded-3xl bg-gradient-to-br from-hero-from to-hero-to text-on-hero shadow-lg">
        <Lock className="size-10" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="mx-auto mb-3 w-fit rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">100% privat & tanpa akun</p>
        <h1 className="text-3xl font-bold">Kelola keuangan harian tanpa ribet</h1>
        <p className="mt-2 text-text-muted">Catat pengeluaran dan pemasukan dalam hitungan detik.</p>
      </div>
      <ul className="space-y-2">
        {points.map(([icon, title, hint]) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-surface p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-primary">{icon}</span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-text-muted">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-3">
        <Primary onClick={onNext}>
          Mulai atur dompet <ArrowRight className="size-5" aria-hidden="true" />
        </Primary>
        <p className="text-center text-sm text-text-muted">
          Sudah punya file backup?{' '}
          <button type="button" onClick={onRestore} className="min-h-11 font-semibold text-primary underline underline-offset-2">
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
  const [ewallet, setEwallet] = useState({ on: true, name: 'GoPay', balance: 0 })
  const [bank, setBank] = useState({ on: true, name: 'BCA', balance: 0 })
  const [saving, setSaving] = useState(false)
  const cashValue = cashBalance ?? cash?.initialBalance ?? 0
  const total = cashValue + (ewallet.on ? ewallet.balance : 0) + (bank.on ? bank.balance : 0)

  const save = async () => {
    setSaving(true)
    const today = todayKey()
    if (cash) await db.wallets.update(cash.id, { initialBalance: cashValue, initialDate: today })
    const base = { initialDate: today, includeInTotal: true }
    if (ewallet.on && ewallet.name.trim())
      await saveWallet({ ...base, name: ewallet.name, type: 'ewallet', color: '#0891b2', icon: 'smartphone', initialBalance: ewallet.balance })
    if (bank.on && bank.name.trim()) await saveWallet({ ...base, name: bank.name, type: 'bank', color: '#2563eb', icon: 'landmark', initialBalance: bank.balance })
    onNext()
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <p className="w-fit rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">Langkah 2: Dompet & akun</p>
      <h1 className="text-2xl font-bold">Berapa saldo awalmu?</h1>
      <p className="text-sm text-text-muted">Isi saldo dompet yang sering kamu pakai. Tidak harus pas; nanti bisa disesuaikan.</p>

      <section className="rounded-3xl bg-surface p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon="banknote" color="#059669" />
          <span className="font-semibold">Uang tunai (Cash)</span>
        </div>
        <AmountInput value={cashValue} onChange={setCashBalance} />
      </section>
      <OptionalWallet icon="smartphone" color="#0891b2" label="E-wallet" value={ewallet} onChange={setEwallet} />
      <OptionalWallet icon="landmark" color="#2563eb" label="Rekening bank" value={bank} onChange={setBank} />
      <p className="text-xs text-text-muted">Kartu kredit dan dompet lain bisa ditambah nanti di Lainnya → Dompet.</p>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-hero-from to-hero-to px-4 py-3 text-on-hero">
          <span className="text-sm">Total saldo awal</span>
          <span className="text-xl font-bold tabular-nums">{formatRupiah(total)}</span>
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
  value,
  onChange,
}: {
  icon: string
  color: string
  label: string
  value: { on: boolean; name: string; balance: number }
  onChange: (v: { on: boolean; name: string; balance: number }) => void
}) {
  return (
    <section className={`rounded-3xl bg-surface p-4 ${value.on ? '' : 'opacity-70'}`}>
      <label className="flex items-center gap-3">
        <IconBadge icon={icon} color={color} />
        <span className="flex-1 font-semibold">{label}</span>
        <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} className="size-5 accent-primary" aria-label={`Tambah ${label}`} />
      </label>
      {value.on && (
        <div className="mt-2 space-y-1">
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            aria-label={`Nama ${label}`}
            placeholder="Nama, misal GoPay / BCA"
            maxLength={40}
            className={inputClass}
          />
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
          : 'Notifikasi belum bisa diaktifkan sekarang. Coba lagi nanti di Lainnya → Pengingat.',
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <p className="w-fit rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">Langkah terakhir</p>
      <h1 className="text-2xl font-bold">Jangan lupa catat setiap hari</h1>
      <p className="text-sm text-text-muted">Pengingat hanya muncul kalau hari itu kamu belum mencatat apa pun.</p>
      <section className="rounded-3xl bg-surface p-4">
        <p className="flex items-center gap-2 font-semibold">
          <BellRing className="size-5 text-warning" aria-hidden="true" /> Pengingat harian
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['20:00', '21:00', '22:00'].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={time === t}
              onClick={() => setTime(t)}
              className={`min-h-14 rounded-full font-semibold ${time === t ? 'bg-primary text-on-primary' : 'bg-surface-muted'}`}
            >
              {t}
              {t === '21:00' && <span className="block text-[10px] font-normal">Rekomendasi</span>}
            </button>
          ))}
        </div>
      </section>
      {ios && (
        <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm">
          iPhone mewajibkan aplikasi dipasang di Layar Utama (iOS 16.4+) sebelum notifikasi bisa diizinkan: <b>Bagikan → Tambahkan ke Layar Utama</b>, lalu buka dari ikonnya.
        </p>
      )}
      {message && (
        <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm">
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
