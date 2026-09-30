import { ChartSpline } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'

export function StatsPage() {
  return (
    <>
      <AppHeader title="Statistik" />
      <main className="p-4">
        {/* Stage 5 (FR-5) adds the weekly/monthly charts. */}
        <EmptyState icon={ChartSpline} message="Belum ada transaksi. Ketuk + untuk mencatat yang pertama." />
      </main>
    </>
  )
}
