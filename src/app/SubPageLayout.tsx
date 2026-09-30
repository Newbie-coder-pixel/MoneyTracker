import { Outlet } from 'react-router'

/** Layout for screens opened from Lainnya: back arrow in the header, no bottom nav (as in the mockups). */
export function SubPageLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <Outlet />
    </div>
  )
}
