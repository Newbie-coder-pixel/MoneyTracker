import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, ArrowDown, ArrowUp, Eye, EyeOff, Plus } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { IconBadge } from '../../components/IconBadge'
import { ColorPicker, ConfirmButton, Field, IconPicker, inputClass } from '../../components/Pickers'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/toast'
import { archiveCategory, canDeleteCategory, deleteCategory, isOtherCategory, moveCategory, saveCategory } from '../../db/categories'
import { useCategories } from '../../db/hooks'
import type { Category, CategoryKind } from '../../db/types'
import { PICKER_COLORS } from '../../lib/palette'

export function CategoriesPage() {
  const categories = useCategories()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const ofKind = categories?.filter((c) => c.kind === kind) ?? []
  const active = ofKind.filter((c) => !c.archived)
  const archived = ofKind.filter((c) => c.archived)

  return (
    <>
      <AppHeader
        title="Kategori"
        back
        actions={
          <button type="button" onClick={() => setEditing('new')} className="flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">
            <Plus className="size-4" aria-hidden="true" /> Tambah
          </button>
        }
      />
      <main className="space-y-4 p-4">
        <div role="group" aria-label="Jenis kategori" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-11 rounded-xl font-semibold ${kind === k ? 'bg-primary text-on-primary' : 'text-text-muted'}`}
            >
              {k === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-surface">
          {active.map((c, i) => (
            <li key={c.id} className="flex items-center">
              <button type="button" onClick={() => setEditing(c)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-surface-muted">
                <IconBadge icon={c.icon} color={c.color} />
                <span className="truncate font-semibold">{c.name}</span>
              </button>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => void moveCategory(c.id, kind, -1)}
                aria-label={`Naikkan ${c.name}`}
                className="grid size-11 place-items-center disabled:opacity-25"
              >
                <ArrowUp className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={i === active.length - 1}
                onClick={() => void moveCategory(c.id, kind, 1)}
                aria-label={`Turunkan ${c.name}`}
                className="mr-1 grid size-11 place-items-center disabled:opacity-25"
              >
                <ArrowDown className="size-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <section>
            <button type="button" onClick={() => setShowArchived(!showArchived)} className="flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-text-muted">
              {showArchived ? <EyeOff className="size-4" /> : <Eye className="size-4" />} Diarsipkan ({archived.length})
            </button>
            {showArchived && (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-surface">
                {archived.map((c) => (
                  <li key={c.id} className="flex min-h-16 items-center gap-3 px-4 opacity-80">
                    <IconBadge icon={c.icon} color={c.color} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => void archiveCategory(c.id, false).then(() => showToast('Kategori dipulihkan'))}
                      className="flex min-h-11 items-center gap-1 rounded-full bg-surface-muted px-3 text-sm font-semibold"
                    >
                      <ArchiveRestore className="size-4" aria-hidden="true" /> Pulihkan
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <p className="px-1 text-xs text-text-muted">Kategori yang sudah dipakai hanya bisa diarsipkan; tetap muncul di riwayat dan chart.</p>
      </main>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Kategori baru' : 'Ubah kategori'}>
        {editing !== null && (
          <CategoryForm key={editing === 'new' ? 'new' : editing.id} kind={kind} existing={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </>
  )
}

function CategoryForm({ kind, existing, onDone }: { kind: CategoryKind; existing?: Category; onDone: () => void }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? 'shopping-bag')
  const [color, setColor] = useState(existing?.color ?? PICKER_COLORS[7])
  const [error, setError] = useState<string | null>(null)
  const deletable = useLiveQuery(async () => (existing ? canDeleteCategory(existing.id) : false), [existing?.id])
  const locked = existing ? isOtherCategory(existing) : false

  const act = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      showToast(message)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} color={color} size="lg" />
        <span className="text-sm text-text-muted">{(existing?.kind ?? kind) === 'expense' ? 'Kategori pengeluaran' : 'Kategori pemasukan'}</span>
      </div>
      <Field label="Nama">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Misal: Kopi" className={inputClass} />
      </Field>
      <div>
        <p className="text-sm font-medium">Warna</p>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div>
        <p className="text-sm font-medium">Ikon</p>
        <IconPicker value={icon} color={color} onChange={setIcon} />
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-sm text-expense">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void act(() => saveCategory({ name, icon, color, kind: existing?.kind ?? kind }, existing?.id), existing ? 'Kategori diperbarui' : 'Kategori ditambahkan')}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-on-primary"
      >
        Simpan
      </button>
      {existing && !locked && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void act(() => archiveCategory(existing.id, true), 'Kategori diarsipkan')} className="min-h-12 rounded-2xl bg-surface-muted font-semibold">
            Arsipkan
          </button>
          {deletable ? (
            <ConfirmButton
              label="Hapus"
              confirmLabel="Yakin hapus?"
              onConfirm={() => void act(() => deleteCategory(existing.id), 'Kategori dihapus')}
              className="min-h-12 rounded-2xl bg-expense-soft font-semibold text-expense"
            />
          ) : (
            <p className="self-center text-xs text-text-muted">Sudah dipakai: hanya bisa diarsipkan.</p>
          )}
        </div>
      )}
      {locked && <p className="text-xs text-text-muted">Kategori "Lainnya" selalu tersedia dan tidak bisa diarsipkan.</p>}
    </div>
  )
}
