# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Money Tracker is a personal-use, offline-first PWA for daily expense tracking. It has no login, and all data lives in IndexedDB on the device. UI text is in Bahasa Indonesia and currency is formatted as `Rp 25.000`.

The source of truth is [docs/PRD.md](docs/PRD.md) (Indonesian). Work is done in the 10 stages of PRD §8.3, and the user refers to requirements by FR code (e.g. "stage 3, FR-1.1–FR-1.8"). Look up the FR code in the PRD before you implement it. **Stage 1 (setup, nav, routing, theme) is done.** Placeholder pages contain `Stage N` comments that mark where later stages plug in.

The Google Stitch mockups are in `docs/mockups/` (one PNG per screen). Take the visual style and layout from them. If a mockup and the PRD disagree, **the PRD wins** (§9).

The user commits and pushes to GitHub (`github.com/Newbie-coder-pixel/MoneyTracker`, public) themselves. Never run `git commit`, `git push` or deploy commands. At the end of each stage, give them the git commands to paste.

## Commands

```bash
npm run dev          # dev server
npm run build        # tsc -b + vite build
npm run lint         # oxlint (the Vite template's linter, used instead of ESLint)
npm run typecheck    # tsc -b
npm test             # vitest run (all tests)
npx vitest run src/lib/theme.test.ts   # single test file
```

## Stack

React 19 + TypeScript + Vite 8, Tailwind v4 (CSS-first config in `src/index.css`, no tailwind.config), React Router 8 (`createBrowserRouter`), Lucide icons, Plus Jakarta Sans bundled via `@fontsource-variable` (no Google Fonts CDN, for offline use), Vitest 5.

Planned for later stages (PRD §7.2): Dexie + `dexie-react-hooks`, `vite-plugin-pwa`, Recharts (lazy-loaded), date-fns with the `id` locale, and optionally Zustand. Reminder push uses Vercel serverless functions in `api/`, with `web-push` + VAPID, Upstash Redis, and a cron endpoint protected by the `CRON_SECRET` header. `vercel.json` rewrites every non-`/api/` path to `index.html` for client routing.

## Architecture

- **Styling:** components use only the semantic colour tokens defined in `src/index.css` (`bg-surface`, `text-text-muted`, `bg-primary`, `text-expense`, `on-primary`/`on-expense`, ...). Never use raw colours. Each token has a light value in `:root` and a dark value in `.dark`.
- **Theme:** dark mode is class-driven (`html.dark`). The preference lives in localStorage (`mt-theme`) and is applied before first paint by an inline script in `index.html`, which must stay in sync with `src/lib/theme.ts`. `src/hooks/useTheme.ts` is a module-level store (`useSyncExternalStore`) so all callers share one preference and one system listener. Keep the localStorage mirror even after settings move to Dexie, because IndexedDB is async and too slow to prevent a flash.
- **Routing:** `src/app/router.tsx` has two layouts. `TabLayout` holds the 4 bottom-nav tabs (`/`, `/riwayat`, `/statistik`, `/lainnya`) plus the bottom nav and the add sheet. `SubPageLayout` holds screens opened from Lainnya (`/lainnya/*`), which have a back arrow and no bottom nav. A sub-page's back arrow falls back to `/lainnya` when there is no in-app history.
- **Add-transaction sheet** is driven by `?add=expense|income|transfer` (`src/features/transactions/addSheetParam.ts`) so notifications can deep-link to `/?add=expense` (FR-8.7). Opening pushes a history entry marked `state.sheetPushed`, so Android Back closes the sheet. Closing pops that entry, or replaces the URL for deep links. `Sheet` is built on native `<dialog>`.
- The Lainnya menu lists only screens that exist. Add each screen when its stage is built, with no dead links (PRD §9). The app version shown comes from `package.json` via `__APP_VERSION__` (defined in `vite.config.ts`).
- `src/lib/` holds **all calculation logic as pure functions** (money, period, balance, recurring, budget, backup, ics), tested with Vitest as `*.test.ts` files next to the code. `period.ts` and `recurring.ts` especially must have tests.
- `src/db/` (stage 2) will hold the Dexie schema, the seed (default categories + a Cash wallet), and migrations. Every schema change bumps the Dexie version and adds an upgrade function. Backups store `schemaVersion`, and the app makes an automatic backup to a separate IndexedDB before a structural migration (FR-10.6).
- On every app open: PIN unlock → recurring catch-up (FR-7.4) → refresh reminders/bell badge → backup banner if last backup > 30 days → re-check the push subscription against the server (FR-8.11).

## Data rules that are easy to get wrong (PRD §6)

- Amounts are **integer Rupiah** (no decimals). IDs come from `crypto.randomUUID()`. Dates are stored as local `YYYY-MM-DD` and times as `HH:mm`.
- There are **eight tables**: wallets, categories, transactions, budgets, recurring, recurringOccurrences, reminders, settings. (The PRD says "seven"; the user confirmed eight.)
- **Wallet balances are always derived** from transactions, never stored: initialBalance + income + transfer in + adjustment + refund − expense − transfer out, counting only transactions with date ≥ initialDate.
- Transaction types: `expense`, `income`, `transfer`, `adjustment`, `refund` (the user confirmed `refund` is added to the §6.1 enum). **Charts and budgets count only expense/income, with refunds subtracted from their original expense category** (never below 0 per category/period). Transfers and adjustments are excluded. Credit-card purchases are expenses; paying a card bill is a transfer (so it is not counted twice). A negative card balance is debt.
- **Month period** with start day N (1–28, default 1) is named after the month it *starts* in. With N=25, "September 2026" = 25 Sep – 24 Oct. **Weeks always start Monday.**
- Monthly recurring on days 29–31 falls back to the last day of shorter months.
- **Recurring dedup:** the unique index is `recurringOccurrences [recurringId+date]` (user-confirmed). `transactions.occurrenceDate` is only a back-link to the schedule and is not unique. Any existing occurrence status (pending/done/skipped) means skip. Auto mode creates `done` + a transaction. Confirm mode (the default) creates `pending` with no transaction. Deleting a generated transaction keeps its occurrence.
- **Budget alerts** fire once per threshold (80%, 100%) per category per period. The flags reset if usage drops back below the threshold. Any add/edit/delete recomputes budgets for both the old and the new date's periods.
- Categories/wallets that have transactions can only be archived, never deleted. "Lainnya" can't be archived or deleted. At least one active wallet must exist. A wallet can be archived only when its balance is 0.
- Negative balances on non-credit wallets are allowed, with a yellow warning shown before saving.
- Daily reminder "already logged" means a *manually entered* transaction was created today (by `createdAt`, regardless of transaction date; recurring-generated ones don't count).

## Privacy and scope constraints

- No financial data ever goes to the server. The push server stores only an anonymous subscription, reminder time, timezone, generic due dates ("Tagihan rutin", "Kartu kredit"), and the last-logged date. No analytics.
- Don't build anything shown in the mockups but absent from the PRD (cloud sync, bank connections, biometrics, profile icon, named greeting, "Wawasan Finansial", etc.; see the §9 table). Remove those elements rather than leaving dead buttons. Never hardcode mockup sample data.
- Non-functional targets: initial JS under 300 KB gzip (stage 1: ~104 KB), smooth with 10k transactions, touch targets ≥ 44 px, WCAG AA, respect reduced motion, and Lighthouse ≥ 90.
