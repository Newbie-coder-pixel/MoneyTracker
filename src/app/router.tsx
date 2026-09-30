import { createBrowserRouter } from 'react-router'
import { HomePage } from '../features/home/HomePage'
import { MorePage } from '../features/more/MorePage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { StatsPage } from '../features/stats/StatsPage'
import { HistoryPage } from '../features/transactions/HistoryPage'
import { SubPageLayout } from './SubPageLayout'
import { TabLayout } from './TabLayout'

export const router = createBrowserRouter([
  {
    element: <TabLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/riwayat', element: <HistoryPage /> },
      { path: '/statistik', element: <StatsPage /> },
      { path: '/lainnya', element: <MorePage /> },
    ],
  },
  {
    element: <SubPageLayout />,
    children: [{ path: '/lainnya/pengaturan', element: <SettingsPage /> }],
  },
])
