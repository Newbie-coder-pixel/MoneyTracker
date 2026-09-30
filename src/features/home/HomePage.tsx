import { ReceiptText } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'

const todayLabel = () =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

export function HomePage() {
  return (
    <>
      <AppHeader title="Beranda" />
      <main className="space-y-4 p-4">
        <section>
          <p className="text-sm text-text-muted">{todayLabel()}</p>
          {/* No name in the greeting: the app has no account (PRD §9). */}
          <p className="text-2xl font-bold">Halo 👋</p>
        </section>
        {/* Stage 4 (FR-4.1) adds total balance, today/month summary, upcoming bills and recent transactions. */}
        <EmptyState icon={ReceiptText} message="Belum ada transaksi. Ketuk + untuk mencatat yang pertama." />
      </main>
    </>
  )
}
