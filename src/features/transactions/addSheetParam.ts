/**
 * The transaction sheet is driven by search params so it can be deep-linked from a
 * notification (`/?add=expense`, FR-8.7) and closed with the phone's Back button:
 * `?add=expense|income|transfer` for a new transaction, `?edit=<id>` to edit one.
 */
export const ADD_PARAM = 'add'
export const EDIT_PARAM = 'edit'
/** Optional prefill for a new transaction: source / destination wallet ids. */
export const FROM_PARAM = 'from_wallet'
export const TO_PARAM = 'to_wallet'

export const ADD_KINDS = ['expense', 'income', 'transfer'] as const
export type AddKind = (typeof ADD_KINDS)[number]

export function parseAddKind(value: string | null): AddKind | null {
  return ADD_KINDS.find((k) => k === value) ?? null
}
