import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { IconBadge } from '../../components/IconBadge'
import { AmountInput, ColorPicker, Field, IconPicker, inputClass } from '../../components/Pickers'
import { showToast } from '../../components/toast'
import { db } from '../../db/schema'
import type { Wallet, WalletType } from '../../db/types'
import { saveWallet } from '../../db/wallets'
import { todayKey } from '../../lib/dates'
import { walletTypeInfo, WALLET_TYPES } from './walletTypes'

export function WalletFormPage() {
  const { id } = useParams()
  const existing = useLiveQuery(async () => (id ? ((await db.wallets.get(id)) ?? null) : null), [id])
  if (id && existing === undefined) return <AppHeader title="Ubah Dompet" back />
  return <WalletForm key={id ?? 'new'} existing={existing ?? undefined} />
}

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

function WalletForm({ existing }: { existing?: Wallet }) {
  const navigate = useNavigate()
  const [type, setType] = useState<WalletType>(existing?.type ?? 'ewallet')
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? walletTypeInfo('ewallet').color)
  const [icon, setIcon] = useState(existing?.icon ?? walletTypeInfo('ewallet').icon)
  // Credit cards: the user types the debt as a positive number; it's stored negative.
  const [initial, setInitial] = useState(existing ? (existing.type === 'credit' ? -existing.initialBalance : existing.initialBalance) : 0)
  const [initialDate, setInitialDate] = useState(existing?.initialDate ?? todayKey())
  const [includeInTotal, setIncludeInTotal] = useState(existing?.includeInTotal ?? true)
  const [creditLimit, setCreditLimit] = useState(existing?.creditLimit ?? 0)
  const [statementDay, setStatementDay] = useState(existing?.statementDay ?? 25)
  const [dueDay, setDueDay] = useState(existing?.dueDay ?? 15)
  const [error, setError] = useState<string | null>(null)
  const touchedLook = existing !== undefined

  const pickType = (t: WalletType) => {
    setType(t)
    // Follow the type's default look until the user customises it.
    if (!touchedLook) {
      setColor(walletTypeInfo(t).color)
      setIcon(walletTypeInfo(t).icon)
    }
  }

  const save = async () => {
    try {
      const id = await saveWallet(
        {
          name,
          type,
          color,
          icon,
          initialBalance: type === 'credit' ? -Math.abs(initial) : initial,
          initialDate,
          includeInTotal,
          creditLimit: type === 'credit' ? creditLimit : undefined,
          statementDay: type === 'credit' ? statementDay : undefined,
          dueDay: type === 'credit' ? dueDay : undefined,
        },
        existing?.id,
      )
      showToast(existing ? 'Dompet diperbarui' : 'Dompet ditambahkan')
      navigate(`/lainnya/dompet/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <AppHeader title={existing ? 'Ubah Dompet' : 'Tambah Dompet'} back />
      <main className="space-y-5 p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={icon} color={color} size="lg" />
          <p className="text-lg font-semibold">{name || 'Dompet baru'}</p>
        </div>

        <fieldset>
          <legend className="label-caps">Tipe</legend>
          <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-full border border-border bg-surface-muted p-1">
            {WALLET_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                aria-pressed={type === t.type}
                disabled={!!existing && existing.type !== t.type && (existing.type === 'credit' || t.type === 'credit')}
                onClick={() => pickType(t.type)}
                className={`min-h-11 rounded-full text-xs font-semibold disabled:opacity-40 ${type === t.type ? 'bg-primary text-on-primary' : 'text-text-muted'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Nama">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: GoPay, BCA" maxLength={40} className={inputClass} />
        </Field>

        <Field label={type === 'credit' ? 'Utang awal' : 'Saldo awal'} hint={type === 'credit' ? 'Tagihan yang sudah ada saat mulai mencatat.' : undefined}>
          <AmountInput value={initial} onChange={setInitial} signed={type !== 'credit'} />
        </Field>

        <Field label="Tanggal saldo awal" hint="Transaksi sebelum tanggal ini tidak mengubah saldo dompet.">
          <input type="date" value={initialDate} onChange={(e) => e.target.value && setInitialDate(e.target.value)} className={inputClass} />
        </Field>

        {type === 'credit' && (
          <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <Field label="Limit kartu">
              <AmountInput value={creditLimit} onChange={setCreditLimit} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tanggal cetak tagihan">
                <select value={statementDay} onChange={(e) => setStatementDay(Number(e.target.value))} className={inputClass}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      Tgl {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Jatuh tempo">
                <select value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} className={inputClass}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      Tgl {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
        )}

        <label className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4">
          <span>
            <span className="block font-medium">Sertakan dalam saldo total</span>
            <span className="block text-xs text-text-muted">Matikan untuk menyembunyikan tabungan dari saldo total.</span>
          </span>
          <input type="checkbox" checked={includeInTotal} onChange={(e) => setIncludeInTotal(e.target.checked)} className="size-5 accent-primary" />
        </label>

        <div>
          <p className="label-caps">Warna</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div>
          <p className="label-caps">Ikon</p>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-expense/30 bg-expense-soft px-4 py-3 text-sm text-expense">
            {error}
          </p>
        )}
        <button type="button" onClick={save} className="min-h-13 w-full rounded-full bg-primary text-base font-semibold text-on-primary">
          Simpan
        </button>
      </main>
    </>
  )
}
