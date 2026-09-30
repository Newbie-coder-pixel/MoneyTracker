import type { WalletType } from '../../db/types'

export const WALLET_TYPES: { type: WalletType; label: string; icon: string; color: string; group: string }[] = [
  { type: 'cash', label: 'Cash', icon: 'banknote', color: '#059669', group: 'Tunai & Dompet Digital' },
  { type: 'ewallet', label: 'E-wallet', icon: 'smartphone', color: '#0891b2', group: 'Tunai & Dompet Digital' },
  { type: 'bank', label: 'Bank', icon: 'landmark', color: '#2563eb', group: 'Rekening Bank' },
  { type: 'credit', label: 'Kartu kredit', icon: 'credit-card', color: '#dc2626', group: 'Kartu Kredit' },
]

/** Common Indonesian providers offered as a dropdown during onboarding; anything else is typed in. */
export const EWALLET_NAMES = ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'AstraPay', 'i.saku', 'Sakuku', 'DOKU']
export const BANK_NAMES = [
  'BCA',
  'BRI',
  'BNI',
  'Mandiri',
  'BSI',
  'BTN',
  'CIMB Niaga',
  'Permata',
  'Danamon',
  'OCBC',
  'Maybank',
  'Panin',
  'Bank Mega',
  'BJB',
  'Bank DKI',
  'Bank Jago',
  'SeaBank',
  'Jenius',
  'blu by BCA Digital',
  'Allo Bank',
  'Superbank',
]

export const walletTypeInfo =(type: WalletType) => WALLET_TYPES.find((t) => t.type === type)!
