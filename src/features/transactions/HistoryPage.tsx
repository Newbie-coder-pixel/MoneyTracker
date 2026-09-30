import { ReceiptText } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'

export function HistoryPage() {
  return (
    <>
      <AppHeader title="Riwayat" />
      <main className="p-4">
        {/* Stage 4 (FR-4.2, FR-4.3) adds the day-grouped list, search and filters. */}
        <EmptyState icon={ReceiptText} message="Belum ada transaksi. Ketuk + untuk mencatat yang pertama." />
      </main>
    </>
  )
}
