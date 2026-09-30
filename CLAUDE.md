# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Money Tracker is a personal-use, offline-first PWA for daily expense tracking. It has no login, and all data lives in IndexedDB on the device. UI text is in Bahasa Indonesia and currency is formatted as `Rp 25.000`.

The source of truth is [docs/PRD.md](docs/PRD.md) (Indonesian). Requirements are referenced by FR code, so look up the FR code before changing a feature. All 10 stages of PRD §8.3 are implemented. Google Stitch mockups are in `docs/mockups/`. Take visual style and layout from them, but **the PRD wins** when they disagree (§9): never build mockup-only features such as cloud sync, bank links, biometrics, a profile icon or a named greeting.

The user commits, pushes and deploys themselves (`github.com/Newbie-coder-pixel/MoneyTracker`, public). Never run `git commit`, `git push` or deploy commands. Give them the commands to paste. Never ask for or use their tokens.

## Commands

```bash
npm run dev          # dev server (api/ functions don't run locally; push needs a Vercel deploy)
npm run build        # tsc -b + vite build (+ service worker via vite-plugin-pwa)
npm run lint         # oxlint (the Vite template's linter, used instead of ESLint)
npm run typecheck    # tsc -b across app, sw, api and node configs
npm test             # vitest run: src/**/*.test.ts and api/**/*.test.ts
npx vitest run src/lib/recurring.test.ts   # single file
```

## Stack

React 19, TypeScript, Vite 8, Tailwind v4 (CSS-first config in `src/index.css`), React Router 8, Dexie 4 + `dexie-react-hooks`, Recharts 3 (lazy-loaded Statistik route only), Lucide, Plus Jakarta Sans bundled via `@fontsource-variable`, `vite-plugin-pwa` in `injectManifest` mode, and Vitest 5 with `fake-indexeddb` for DB tests. Dates use native `Intl` with `id-ID`, not date-fns. Server: Vercel functions in `api/` (Web `Request`/`Response` handlers), `web-push`, `@upstash/redis`.

## Architecture

- **`src/lib/`** holds pure, tested logic: `dates` (local `YYYY-MM-DD` math at local noon), `period` (month periods by start day, Monday weeks), `balance`, `stats`, `budget`, `recurring`, `creditCard`, `bills`, `filter`, `csv`, `ics`, `backup`, `pin`, `money`, `validation`. Put new calculations here, with a test.
- **`src/db/`** holds the Dexie schema (`schema.ts`, `SCHEMA_VERSION`) and the write actions that enforce business rules: `transactions.ts`, `budgets.ts`, `recurring.ts`, `wallets.ts`, `categories.ts`, `backup.ts`, `reminders.ts`, `settings.ts` (key/value with `DEFAULT_SETTINGS`), and `hooks.ts` (live queries). UI never writes tables directly for anything with rules. `db.test.ts` covers the cross-table acceptance criteria.
  - `useLiveQuery` callbacks must be **read-only**. Do writes like `ensureBudgetsForPeriod` in effects or actions.
  - Schema change: add `this.version(n+1).stores(...).upgrade(...)` and bump `SCHEMA_VERSION`. `migrationBackup.ts` snapshots the old DB into `money-tracker-premigration` before Dexie opens (FR-10.6), so it must run before the first `db` access (see `app/startup.ts`).
  - Booleans (`archived`, `paused`) can't be IndexedDB keys, so they're filtered in memory. The total budget uses `categoryId = TOTAL_BUDGET_ID` (not null).
- **`src/app/`**: `RootLayout` runs `startup.ts` once (migration snapshot → seed → recurring catch-up → budget carry-over → reminders → `storage.persist()` → push re-sync), then gates on PIN lock → onboarding → routes. `TabLayout` holds the 4 bottom-nav tabs. `SubPageLayout` holds screens under `/lainnya/*` and `/pengingat` (back arrow, no nav).
- **Transaction sheet** is global (in `RootLayout`), driven by search params: `?add=expense|income|transfer`, `?edit=<id>`, and optional `from_wallet`/`to_wallet` prefill. Notifications deep-link to `/?add=expense`. Riwayat filters also live in the URL (`q,type,cat,wallet,from,to,min,max`), which is how Statistik drills down (FR-5.5).
- **Cross-module events:** `db/events.ts` fires on manual saves. `features/reminders/refresh.ts` and `pwa/push.ts` subscribe, so the data layer doesn't import push code.
- **PWA:** `src/sw/sw.ts` (own tsconfig, WebWorker lib) does precaching, SPA navigation fallback, push display and notification clicks. `pwa/register.ts` registers it at startup, independent of any screen. `UpdateBanner` shows "Versi baru tersedia" (`registerType: 'prompt'`).
- **Push server (`api/`)**: `_lib/schedule.ts` is the pure, tested "what to send now" logic (daily only if nothing was logged manually today; bills H-1/H and cards H-3/H from 08:00 local; generic titles, never amounts). Endpoints are `push/{key,subscribe,update,logged,unsubscribe,test}` and `cron/reminders` (Bearer `CRON_SECRET`). Relative imports in `api/` must use `.js` extensions (Node ESM on Vercel). The scheduler is `.github/workflows/reminders.yml`, every 15 min, because Vercel Hobby only allows daily crons. Env vars are listed in `.env.example`, setup steps in README.
- **Theme:** class-driven `html.dark`. The preference lives only in localStorage (`mt-theme`) and is applied pre-paint by the inline script in `index.html` (keep it in sync with `src/lib/theme.ts`).
- **Styling:** use only the semantic tokens in `src/index.css` (`bg-surface`, `text-text-muted`, `text-expense`, `from-hero-from`, `--chart-*`, ...), never raw colours. Each token has a light value and a `.dark` value. Chart series colours were validated for colour-blind safety: bars use `--chart-expense` (red) and `--chart-income` (blue), not green. Recharts gets resolved colours via `useChartColors()`, because SVG attributes can't use `var()`.
- **No dead UI:** the Lainnya menu and all buttons only point at screens that exist (PRD §9). Touch targets are ≥ 44 px.

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
