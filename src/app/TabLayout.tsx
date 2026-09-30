import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { BottomNav } from '../components/BottomNav'
import { AddTransactionSheet } from '../features/transactions/AddTransactionSheet'
import { ADD_PARAM, parseAddKind, type AddKind } from '../features/transactions/addSheetParam'

/** Marks history entries that the app itself pushed when opening the sheet. */
type SheetHistoryState = { sheetPushed?: boolean } | null

/** Layout for the four bottom-nav tabs: page content, bottom nav, and the add sheet. */
export function TabLayout() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const kind = parseAddKind(params.get(ADD_PARAM))

  const withKind = (next: AddKind | null) => {
    const copy = new URLSearchParams(params)
    if (next) copy.set(ADD_PARAM, next)
    else copy.delete(ADD_PARAM)
    return copy
  }

  // Opening pushes a history entry so the phone's Back button closes the sheet.
  const open = () => setParams(withKind('expense'), { state: { sheetPushed: true } })

  const switchKind = (next: AddKind) => setParams(withKind(next), { replace: true, state: location.state })

  const close = () => {
    // Pop our own entry; a deep link (e.g. from a notification) has none to pop, so replace instead.
    if ((location.state as SheetHistoryState)?.sheetPushed) navigate(-1)
    else setParams(withKind(null), { replace: true })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <BottomNav onAdd={open} />
      <AddTransactionSheet kind={kind} onKindChange={switchKind} onClose={close} />
    </div>
  )
}
