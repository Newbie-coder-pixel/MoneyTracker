# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Money Tracker is a personal-use, offline-first PWA for daily expense tracking. It has no login, and all data lives in IndexedDB on the device. UI text is in Bahasa Indonesia and currency is formatted as `Rp 25.000`.

The source of truth is [docs/PRD.md](docs/PRD.md) (Indonesian). Requirements are referenced by FR code, so look up the FR code before changing a feature. All 10 stages of PRD §8.3 are implemented. Older Google Stitch mockups are in `docs/mockups/`; the current visual reference is the Stitch project named under Styling. Take visual style and layout from them, but **the PRD wins** when they disagree (§9): never build mockup-only features such as cloud sync, bank links, biometrics, a profile icon or a named greeting.

The user commits, pushes and deploys themselves (`github.com/Newbie-coder-pixel/MoneyTracker`, public). Never run `git commit`, `git push` or deploy commands. Give them the commands to paste. Never ask for or use their tokens.

## Commands

```bash
npm run dev          # dev server (api/ functions don't run locally; push needs a Vercel deploy)
npm run dev -- --host   # reachable from a phone on the same Wi-Fi
npm run build        # tsc -b + vite build (+ service worker via vite-plugin-pwa)
npm run preview      # serve the build; the service worker isn't built in dev (no devOptions)
npm run lint         # oxlint (the Vite template's linter, used instead of ESLint)
npm run typecheck    # tsc -b across app, sw, api and node configs
npm test             # vitest run: src/**/*.test.ts and api/**/*.test.ts
npm run test:watch   # vitest in watch mode
npx vitest run src/lib/recurring.test.ts   # single file
npx vitest run -t "re-arms after a delete"   # single test by name
```

`tsc -b` covers four project references (`tsconfig.{app,sw,api,node}.json`). `api/**/*.test.ts` is excluded from `tsconfig.api.json`, so those tests run under Vitest but are not typechecked. Vitest only picks up `.test.ts` in the default node environment (no jsdom, no component tests), so logic that needs a test has to live outside `.tsx` files (see `features/transactions/addSheetParam.ts`).

## Stack

React 19, TypeScript, Vite 8, Tailwind v4 (CSS-first config in `src/index.css`), React Router 8, Dexie 4 + `dexie-react-hooks`, Recharts 3 (lazy-loaded Statistik route only), Lucide, Plus Jakarta Sans bundled via `@fontsource-variable`, `vite-plugin-pwa` in `injectManifest` mode, and Vitest 5 with `fake-indexeddb` for DB tests. Dates use native `Intl` with `id-ID`, not date-fns. Server: Vercel functions in `api/` (Web `Request`/`Response` handlers), `web-push`, `@upstash/redis`.

## Architecture

- **`src/lib/`** holds pure, tested logic: `dates` (local `YYYY-MM-DD` math at local noon), `period` (month periods by start day, Monday weeks), `balance`, `stats`, `budget`, `recurring`, `creditCard`, `bills`, `filter`, `csv`, `ics`, `backup`, `pin`, `money`, `validation`. Put new calculations here, with a test.
- **`src/db/`** holds the Dexie schema (`schema.ts`, `SCHEMA_VERSION`) and the write actions that enforce business rules: `transactions.ts`, `budgets.ts`, `recurring.ts`, `wallets.ts`, `categories.ts`, `backup.ts`, `reminders.ts`, `settings.ts` (key/value with `DEFAULT_SETTINGS`), and `hooks.ts` (live queries). UI never writes tables directly for anything with rules. `db.test.ts` covers the cross-table acceptance criteria. There's no Vitest setup file, so a test that touches Dexie must start with `import 'fake-indexeddb/auto'`.
  - `useLiveQuery` callbacks must be **read-only**. Do writes like `ensureBudgetsForPeriod` in effects or actions.
  - Schema change: add `this.version(n+1).stores(...).upgrade(...)` and bump `SCHEMA_VERSION`. `migrationBackup.ts` snapshots the old DB into `money-tracker-premigration` before Dexie opens (FR-10.6), so it must run before the first `db` access (see `app/startup.ts`).
  - Booleans (`archived`, `paused`) can't be IndexedDB keys, so they're filtered in memory. The total budget uses `categoryId = TOTAL_BUDGET_ID` (not null).
- **`src/app/`**: `RootLayout` runs `startup.ts` once (migration snapshot → seed → recurring catch-up → budget carry-over → reminders → `storage.persist()` → push re-sync), then gates on PIN lock → onboarding → routes. `TabLayout` holds the 4 bottom-nav tabs. `SubPageLayout` holds screens under `/lainnya/*` and `/pengingat` (back arrow, no nav). Route paths are Indonesian (`/riwayat`, `/statistik`, `/lainnya/dompet/:id/ubah`), all declared in `router.tsx`.
- **`src/features/`** holds one folder per screen area, named in English while routes and UI text are Indonesian (`more` = Lainnya, `transactions/HistoryPage` = Riwayat, `stats` = Statistik, `recurring` = Rutin, `wallets` = Dompet). Shared primitives (`Sheet`, `AmountKeypad`, `Pickers`, `TimeWheel`) are in `src/components/`.
- **Module-level UI stores:** toasts (`components/toast.ts`) and the PIN lock (`features/security/lockState.ts`) are plain module state read through `useSyncExternalStore`, not context. `showToast()` can therefore be called from non-React code (see `features/budgets/announce.ts`). Deleting a transaction shows a 5 s "Urungkan" toast that calls `restoreTransactions`. The lock starts locked on every page load and re-locks after `AUTO_LOCK_MS` (60 s) in the background.
- **Icons** are stored in the DB by name and resolved through the explicit registry in `components/icons.ts` (unknown names fall back to `Ellipsis`). Add new pickable icons there, not with `import *`, so Lucide stays tree-shaken.
- **Transaction sheet** is global (in `RootLayout`), driven by search params: `?add=expense|income|transfer`, `?edit=<id>`, and optional `from_wallet`/`to_wallet` prefill. Notifications deep-link to `/?add=expense`. The form (`TransactionForm`) is a list of one-line fields and shows only one picker at a time (keypad, category grid or wallet grid) below them; a new entry opens on the keypad. This was requested by the user, so don't go back to showing every picker at once. Riwayat filters also live in the URL (`q,type,cat,wallet,from,to,min,max`), which is how Statistik drills down (FR-5.5).
- **Cross-module events:** `db/events.ts` fires on manual saves. `features/reminders/refresh.ts` and `pwa/push.ts` subscribe, so the data layer doesn't import push code.
- **Reminders have two channels.** The in-app reminder center (`features/reminders/refresh.ts` → `reminders` table → `ReminderBell`) is rebuilt at startup, on manual saves and every 5 min while open. It works without push and may show amounts, since it never leaves the device. Push (below) is the separate server path and only ever carries generic text.
- **PWA:** `src/sw/sw.ts` (own tsconfig, WebWorker lib) does precaching, SPA navigation fallback, push display and notification clicks. Both the service worker's navigation route and the `vercel.json` rewrite exclude `/api/`. `pwa/register.ts` registers it at startup, independent of any screen. `UpdateBanner` shows "Versi baru tersedia" (`registerType: 'prompt'`).
- **Push server (`api/`)**: `_lib/schedule.ts` is the pure, tested "what to send now" logic (daily only if nothing was logged manually today; bills H-1/H and cards H-3/H from 08:00 local; generic titles, never amounts). Endpoints are `push/{key,subscribe,update,logged,unsubscribe,test}` and `cron/reminders` (Bearer `CRON_SECRET`). Relative imports in `api/` must use `.js` extensions (Node ESM on Vercel). The scheduler is `.github/workflows/reminders.yml`, every 15 min, because Vercel Hobby only allows daily crons. Env vars are listed in `.env.example`, setup steps in README. Redis accepts either the `UPSTASH_REDIS_REST_*` or the Vercel Marketplace `KV_REST_API_*` names. `_lib/config.ts` reports missing env var *names* so the app can show the exact setup error. `_lib/http.ts` only accepts subscription endpoints on known push-service hosts, and `_lib/store.ts` caps registrations at `MAX_CLIENTS`.
- **Theme:** class-driven `html.dark`. The preference lives only in localStorage (`mt-theme`) and is applied pre-paint by the inline script in `index.html` (keep it in sync with `src/lib/theme.ts`).
- **Styling:** the look is the "Paper & Ink Ledger" design system from the Stitch project `14471323437096892262` (warm paper canvas, white cards, ink-black primary, one forest accent). Use only the semantic tokens in `src/index.css` (`bg-surface`, `text-text-muted`, `text-expense`, `text-accent`, `--chart-*`, ...), never raw colours. The one exception is the user-pickable category/wallet colours in `lib/palette.ts` (`PICKER_COLORS`), which are stored hex values. Each token has a light value and a `.dark` value. `primary` is ink (buttons, active chips, the "+"); `accent` is for links, the active tab and positive status. Depth comes from paper layers and 1px `border-border` hairlines: **no shadows, gradients or backdrop blur**. Cards are `card` (12px radius), buttons and chips are pills (`rounded-full`), section headings and field labels use `label-caps`; both utilities are defined in `index.css`. Chart series colours were validated for colour-blind safety: bars use `--chart-expense` (red) and `--chart-income` (blue), not green. Recharts gets resolved colours via `useChartColors()`, because SVG attributes can't use `var()`.
- **App version** shown in Lainnya is `__APP_VERSION__`, injected from `package.json` by `vite.config.ts`.
- **No dead UI:** the Lainnya menu and all buttons only point at screens that exist (PRD §9). Touch targets are ≥ 44 px.

## Deliberate deviations from the PRD

These were requested by the user after the PRD was written. Don't "fix" them back.

- **Onboarding wallet step is mandatory.** The PRD says it can be skipped, but the "Lewati" button was removed. Only the reminder step can be skipped.
- **Wallet names in onboarding** come from the dropdowns in `features/wallets/walletTypes.ts` (`EWALLET_NAMES`, `BANK_NAMES`). Choosing "Lainnya (tulis sendiri)" requires a typed name.
- **Picking "Lainnya" in the transaction form requires naming a new category**, typed inline in the sheet (`findOrCreateCategory` in `db/categories.ts`; a matching name is reused, and the new category is rolled back if the save is rejected). Refunds and edits that leave an existing "Lainnya" untouched are exempt. "Lainnya" itself stays protected (FR-2.6) and is still used by old transactions.
- **Reminder time** uses the custom `TimeWheel` (5-minute steps), not `<input type="time">`, which overflowed on iOS.

## Data rules that are easy to get wrong (PRD §6)

- Amounts are **integer Rupiah**. IDs come from `crypto.randomUUID()`, except seed rows, which have fixed ids (`cat-food`, `wallet-cash`, ...) so seeding is idempotent.
- There are eight tables: wallets, categories, transactions, budgets, recurring, recurringOccurrences, reminders, settings.
- **Balances are always derived** (`lib/balance.ts`), counting only transactions with date ≥ the wallet's `initialDate`. `adjustment` amounts are signed. All others are > 0.
- **Charts and budgets:** only expense/income count, with refunds subtracted from their category (clamped ≥ 0). Transfers and adjustments are excluded. A transfer's admin fee is a separate `expense` in "Biaya Admin" with `linkedId` pointing at the transfer. Credit-card purchases are expenses, and paying the card is a transfer.
- **Month period** with start day N is named after the month it starts in (N=25: "September" = 25 Sep – 24 Oct). Weeks run Monday–Sunday.
- **Recurring dedup:** unique `recurringOccurrences [recurringId+date]`. Any existing status means skip. Deleting a generated transaction keeps its occurrence. Resuming a paused schedule skips the paused dates. Days 29–31 clamp to the month's end.
- **Budget alerts:** once per threshold per period, re-armed below the threshold. Every change re-checks both the old and the new date's periods. Only the current period raises toasts and notifications.
- Archive-only for used categories and wallets. "Lainnya" is protected. A wallet can be archived only at balance 0, and at least one active wallet must remain.
- "Logged today" for the daily reminder means a manual transaction (no `recurringId`) was *created* today.
- Backups exclude device-only settings (`DEVICE_ONLY_SETTINGS`: push ids, snooze, install hint). Restore and "hapus semua" keep this device's push registration.
