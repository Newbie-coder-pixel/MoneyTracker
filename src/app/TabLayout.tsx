import { Outlet } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { useTransactionSheet } from '../features/transactions/useTransactionSheet'

/** Layout for the four bottom-nav tabs. */
export function TabLayout() {
  const { openAdd } = useTransactionSheet()
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <BottomNav onAdd={() => openAdd('expense')} />
    </div>
  )
}
