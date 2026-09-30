import { db } from './schema'

const SNAPSHOT_DB = 'money-tracker-premigration'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * FR-10.6: before Dexie upgrades an older on-disk schema, copy every object store
 * into a separate database. Must run before the first `db` access (Dexie opens —
 * and migrates — lazily on first use). Keeps only the latest snapshot.
 */
export async function snapshotBeforeMigration(): Promise<boolean> {
  if (!indexedDB.databases) return false
  const existing = (await indexedDB.databases()).find((d) => d.name === db.name)
  // Dexie stores version n as IndexedDB version n × 10.
  if (!existing?.version || existing.version >= db.verno * 10) return false

  const raw = await request(indexedDB.open(db.name))
  const data: Record<string, unknown[]> = {}
  try {
    for (const name of Array.from(raw.objectStoreNames)) {
      data[name] = await request(raw.transaction(name, 'readonly').objectStore(name).getAll())
    }
  } finally {
    raw.close()
  }

  const open = indexedDB.open(SNAPSHOT_DB, 1)
  open.onupgradeneeded = () => open.result.createObjectStore('snapshots')
  const target = await request(open)
  try {
    const tx = target.transaction('snapshots', 'readwrite')
    tx.objectStore('snapshots').put({ takenAt: Date.now(), fromVersion: existing.version / 10, data }, 'latest')
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    target.close()
  }
  return true
}
