import type { WalletType } from '../../db/types'

export const WALLET_TYPES: { type: WalletType; label: string; icon: string; color: string; group: string }[] = [
  { type: 'cash', label: 'Cash', icon: 'banknote', color: '#059669', group: 'Tunai & Dompet Digital' },
  { type: 'ewallet', label: 'E-wallet', icon: 'smartphone', color: '#0891b2', group: 'Tunai & Dompet Digital' },
  { type: 'bank', label: 'Bank', icon: 'landmark', color: '#2563eb', group: 'Rekening Bank' },
  { type: 'credit', label: 'Kartu kredit', icon: 'credit-card', color: '#dc2626', group: 'Kartu Kredit' },
]

export const walletTypeInfo = (type: WalletType) => WALLET_TYPES.find((t) => t.type === type)!
