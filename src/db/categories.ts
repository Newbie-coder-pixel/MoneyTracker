import { PICKER_COLORS } from '../lib/palette'
import { newId } from './ids'
import { db } from './schema'
import type { Category, CategoryKind } from './types'

export type CategoryDraft = Pick<Category, 'name' | 'kind' | 'icon' | 'color'>

export const isOtherCategory = (c: Pick<Category, 'systemKey'>) => c.systemKey === 'other-expense' || c.systemKey === 'other-income'

export async function saveCategory(draft: CategoryDraft, existingId?: string): Promise<string> {
  const name = draft.name.trim()
  if (!name) throw new Error('Nama kategori wajib diisi')
  if (existingId) {
    // Kind never changes: existing transactions depend on it.
    await db.categories.update(existingId, { name, icon: draft.icon, color: draft.color })
    return existingId
  }
  const id = newId()
  const last = (await db.categories.where('kind').equals(draft.kind).toArray()).reduce((m, c) => Math.max(m, c.order), 0)
  await db.categories.add({ ...draft, name, id, isDefault: false, archived: false, order: last + 1, createdAt: Date.now() })
  return id
}

/**
 * Category typed in the transaction form after picking "Lainnya": reuses an active
 * category of the same kind with that name (case-insensitive), otherwise creates one.
 */
export async function findOrCreateCategory(name: string, kind: CategoryKind): Promise<{ id: string; created: boolean }> {
  const wanted = name.trim().toLowerCase()
  if (!wanted) throw new Error('Nama kategori baru wajib diisi')
  const ofKind = await db.categories.where('kind').equals(kind).toArray()
  const match = ofKind.find((c) => !c.archived && c.name.trim().toLowerCase() === wanted)
  if (match && isOtherCategory(match)) throw new Error('Tulis nama kategori selain "Lainnya"')
  if (match) return { id: match.id, created: false }
  const color = PICKER_COLORS[ofKind.length % PICKER_COLORS.length]
  return { id: await saveCategory({ name, kind, icon: 'sparkles', color }), created: true }
}

async function isUsed(id: string): Promise<boolean> {
  if ((await db.transactions.where('categoryId').equals(id).count()) > 0) return true
  return (await db.recurring.filter((r) => r.template.categoryId === id).count()) > 0
}

/** "Lainnya" can't be archived or deleted (FR-2.6). */
export async function archiveCategory(id: string, archived: boolean): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) return
  if (archived && isOtherCategory(category)) throw new Error('Kategori "Lainnya" tidak bisa diarsipkan')
  await db.categories.update(id, { archived })
}

/** Only unused categories can be deleted; used ones are archived instead (FR-2.5). */
export async function canDeleteCategory(id: string): Promise<boolean> {
  const category = await db.categories.get(id)
  return !!category && !isOtherCategory(category) && !(await isUsed(id))
}

export async function deleteCategory(id: string): Promise<void> {
  if (!(await canDeleteCategory(id))) throw new Error('Kategori sudah dipakai; arsipkan saja')
  await db.transaction('rw', db.categories, db.budgets, async () => {
    await db.budgets.filter((b) => b.categoryId === id).delete()
    await db.categories.delete(id)
  })
}

/** Moves a category one step up/down among the active ones of its kind (FR-2.4). */
export async function moveCategory(id: string, kind: CategoryKind, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const list = (await db.categories.where('kind').equals(kind).toArray())
      .filter((c) => !c.archived)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    const index = list.findIndex((c) => c.id === id)
    if (index < 0 || !list[index + direction]) return
    const [moved] = list.splice(index, 1)
    list.splice(index + direction, 0, moved)
    await Promise.all(list.map((c, i) => db.categories.update(c.id, { order: i })))
  })
}
