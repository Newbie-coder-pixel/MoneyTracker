/**
 * The add-transaction sheet is driven by the `?add=` search param so it can be
 * deep-linked from a notification (`/?add=expense`, FR-8.7) and closed with the
 * phone's Back button.
 */
export const ADD_PARAM = 'add'

export const ADD_KINDS = ['expense', 'income', 'transfer'] as const
export type AddKind = (typeof ADD_KINDS)[number]

export function parseAddKind(value: string | null): AddKind | null {
  return ADD_KINDS.find((k) => k === value) ?? null
}
