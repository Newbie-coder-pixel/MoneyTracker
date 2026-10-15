/**
 * Whether the browser may evict this device's data (FR-9.5). Everything lives in
 * IndexedDB only, so the Pengaturan screen says plainly how safe it is.
 */
export interface StorageFacts {
  /** `navigator.storage.persisted` exists. */
  supported: boolean
  /** The browser granted persistent storage. */
  persisted: boolean
  /** Running as an installed app (home screen). */
  standalone: boolean
  ios: boolean
}

export interface StorageStatus {
  safe: boolean
  label: string
  hint: string
  /** Offer a button that asks the browser for persistent storage. */
  canRequest: boolean
}

export function storageStatus({ supported, persisted, standalone, ios }: StorageFacts): StorageStatus {
  if (persisted) return { safe: true, label: 'Terlindungi', hint: 'Browser tidak akan menghapus data ini saat memori penuh. Tetap backup berkala.', canRequest: false }
  // Safari deletes script-written data of sites not opened for 7 days, unless installed.
  if (ios && !standalone)
    return {
      safe: false,
      label: 'Bisa terhapus',
      hint: 'Di iPhone, data di Safari bisa dihapus jika aplikasi tidak dibuka 7 hari. Tambahkan ke Layar Utama dan backup berkala.',
      canRequest: supported,
    }
  return {
    safe: false,
    label: 'Belum terlindungi',
    hint: supported
      ? 'Browser boleh menghapus data saat memori perangkat penuh. Minta perlindungan dan backup berkala.'
      : 'Browser ini tidak mendukung penyimpanan permanen. Backup berkala.',
    canRequest: supported,
  }
}
