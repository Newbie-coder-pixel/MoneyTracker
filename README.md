# Money Tracker

Aplikasi pencatat keuangan harian berbentuk PWA: tanpa login, offline, semua data tersimpan di perangkat (IndexedDB). Spesifikasi lengkap ada di [docs/PRD.md](docs/PRD.md), mockup di [docs/mockups/](docs/mockups/).

## Menjalankan di komputer

```bash
npm install
npm run dev          # buka http://localhost:5173
npm run dev -- --host   # agar bisa dibuka dari HP di Wi-Fi yang sama
```

Perintah lain: `npm test` (unit test), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run preview`.

Catatan: fitur notifikasi push butuh server (`api/`) sehingga hanya berjalan setelah deploy ke Vercel. Semua fitur lain berjalan penuh di `npm run dev`.

## Deploy ke Vercel

1. Di [vercel.com/new](https://vercel.com/new), impor repo GitHub ini. Framework terdeteksi otomatis sebagai Vite; tidak perlu mengubah pengaturan build.
2. Setiap `git push` ke `main` akan otomatis ter-deploy.

Setelah langkah ini aplikasi sudah bisa dipakai dan dipasang ke layar utama. Pengingat lewat ikon lonceng dan ekspor kalender (.ics) juga sudah jalan. Langkah berikut hanya untuk **notifikasi push** saat aplikasi tertutup.

## Mengaktifkan notifikasi push (opsional tapi disarankan)

Server push hanya menyimpan: subscription anonim, jam pengingat, zona waktu, tanggal jatuh tempo (tanpa nominal), dan tanggal terakhir mencatat. Tidak ada data keuangan.

1. **Kunci VAPID.** Jalankan di terminal, lalu simpan kedua kunci:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Database Redis gratis.** Di Vercel → project → **Storage** → **Create** → pilih **Upstash (Redis)** → hubungkan ke project. Variabel URL/token akan terisi otomatis.
3. **CRON_SECRET.** Buat string acak:
   ```bash
   openssl rand -hex 32
   ```
4. **Environment variables** di Vercel → Settings → Environment Variables (lihat [.env.example](.env.example)):
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (misal `mailto:emailanda@gmail.com`), `CRON_SECRET`. Lalu **Redeploy**.
5. **Penjadwal tiap 15 menit.** Paket gratis Vercel hanya mengizinkan cron harian, jadi repo ini memakai GitHub Actions ([.github/workflows/reminders.yml](.github/workflows/reminders.yml)). Di GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**, tambahkan:
   - `APP_URL`: alamat aplikasi, misal `https://money-tracker-xxx.vercel.app` (tanpa `/` di akhir)
   - `CRON_SECRET`: nilai yang sama dengan di Vercel

   Uji dari tab **Actions** → *Reminder cron* → **Run workflow**. GitHub bisa menunda jadwal beberapa menit; server tetap mengirim meski telat.
   Alternatif: [cron-job.org](https://cron-job.org) memanggil `GET https://<app>/api/cron/reminders` dengan header `Authorization: Bearer <CRON_SECRET>`.
6. Di aplikasi: **Lainnya → Pengingat** → nyalakan **Notifikasi di perangkat** → **Kirim notifikasi uji**.

**iPhone:** notifikasi hanya jalan dari aplikasi yang sudah dipasang (Safari → Bagikan → Tambahkan ke Layar Utama) di iOS 16.4 ke atas.

## Data & backup

Tidak ada akun atau cloud. Gunakan **Lainnya → Backup & Ekspor** untuk menyimpan file backup `.json` secara rutin (aplikasi mengingatkan setiap 30 hari) dan untuk memindahkan data ke HP baru.
