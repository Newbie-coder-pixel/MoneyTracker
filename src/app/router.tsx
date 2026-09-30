import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { BackupPage } from '../features/backup/BackupPage'
import { BudgetPage } from '../features/budgets/BudgetPage'
import { CategoriesPage } from '../features/categories/CategoriesPage'
import { HomePage } from '../features/home/HomePage'
import { MorePage } from '../features/more/MorePage'
import { RecurringFormPage } from '../features/recurring/RecurringFormPage'
import { RecurringPage } from '../features/recurring/RecurringPage'
import { RemindersPage } from '../features/reminders/RemindersPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { HistoryPage } from '../features/transactions/HistoryPage'
import { WalletDetailPage } from '../features/wallets/WalletDetailPage'
import { WalletFormPage } from '../features/wallets/WalletFormPage'
import { WalletsPage } from '../features/wallets/WalletsPage'
import { RootLayout } from './RootLayout'
import { SubPageLayout } from './SubPageLayout'
import { TabLayout } from './TabLayout'

// Recharts is heavy; load Statistik on demand to keep the initial bundle small (PRD §7.1).
const StatsPage = lazy(() => import('../features/stats/StatsPage'))

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <TabLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/riwayat', element: <HistoryPage /> },
          {
            path: '/statistik',
            element: (
              <Suspense fallback={null}>
                <StatsPage />
              </Suspense>
            ),
          },
          { path: '/lainnya', element: <MorePage /> },
        ],
      },
      {
        // Opened from Lainnya: back arrow, no bottom nav.
        element: <SubPageLayout />,
        children: [
          { path: '/pengingat', element: <RemindersPage /> },
          { path: '/lainnya/budget', element: <BudgetPage /> },
          { path: '/lainnya/rutin', element: <RecurringPage /> },
          { path: '/lainnya/rutin/baru', element: <RecurringFormPage /> },
          { path: '/lainnya/rutin/:id', element: <RecurringFormPage /> },
          { path: '/lainnya/dompet', element: <WalletsPage /> },
          { path: '/lainnya/dompet/baru', element: <WalletFormPage /> },
          { path: '/lainnya/dompet/:id', element: <WalletDetailPage /> },
          { path: '/lainnya/dompet/:id/ubah', element: <WalletFormPage /> },
          { path: '/lainnya/kategori', element: <CategoriesPage /> },
          { path: '/lainnya/backup', element: <BackupPage /> },
          { path: '/lainnya/pengaturan', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg font-semibold">Halaman tidak ditemukan</p>
      <a href="/" className="min-h-11 rounded-full bg-primary px-5 py-3 font-semibold text-on-primary">
        Ke Beranda
      </a>
    </main>
  )
}
