import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { ADD_PARAM, EDIT_PARAM, FROM_PARAM, parseAddKind, TO_PARAM, type AddKind } from './addSheetParam'

/** Marks history entries the app pushed when opening the sheet. */
type SheetHistoryState = { sheetPushed?: boolean } | null

export function useTransactionSheet() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const addKind = parseAddKind(params.get(ADD_PARAM))
  const editId = params.get(EDIT_PARAM)

  const withParams = (key: string | null, value?: string, prefill: { from?: string; to?: string } = {}) => {
    const copy = new URLSearchParams(params)
    for (const k of [ADD_PARAM, EDIT_PARAM, FROM_PARAM, TO_PARAM]) copy.delete(k)
    if (key && value) copy.set(key, value)
    if (prefill.from) copy.set(FROM_PARAM, prefill.from)
    if (prefill.to) copy.set(TO_PARAM, prefill.to)
    return copy
  }

  return {
    addKind,
    editId,
    prefillFrom: params.get(FROM_PARAM) ?? undefined,
    prefillTo: params.get(TO_PARAM) ?? undefined,
    isOpen: addKind !== null || editId !== null,
    // Opening pushes a history entry so the phone's Back button closes the sheet.
    openAdd: (kind: AddKind = 'expense', prefill?: { from?: string; to?: string }) =>
      setParams(withParams(ADD_PARAM, kind, prefill), { state: { sheetPushed: true } }),
    openEdit: (id: string) => setParams(withParams(EDIT_PARAM, id), { state: { sheetPushed: true } }),
    close: () => {
      // Pop our own entry; a deep link (e.g. from a notification) has none to pop, so replace instead.
      if ((location.state as SheetHistoryState)?.sheetPushed) navigate(-1)
      else setParams(withParams(null), { replace: true })
    },
  }
}
