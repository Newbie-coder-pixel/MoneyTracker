# PRD Aplikasi Pencatat Keuangan Harian

Sep 30, 2026 · @Kartika

## 1. Ringkasan produk

Aplikasi ini adalah pencatat keuangan pribadi berbentuk PWA (Progressive Web App) yang dibuka di browser lalu dipasang ke homescreen, tanpa login, dengan semua data tersimpan di perangkat. Target utamanya: mencatat satu transaksi dalam kurang dari 10 detik, lalu melihat ke mana uang pergi per minggu dan per bulan.

**Nama kerja:** Money Tracker.

**Pengguna:** pemakaian pribadi oleh pemilik aplikasi saja; tidak dipublikasikan di rilis 1.0. Karena itu server push dibuat sesederhana mungkin dan tidak membutuhkan kebijakan privasi publik.

**Masalah yang diselesaikan.** Pengeluaran harian kecil (makan, bensin, jajan, top up e-wallet) jarang tercatat karena aplikasi keuangan umumnya ribet, wajib daftar akun, atau penuh iklan. Akibatnya pengguna tidak tahu sisa saldo, kategori paling boros, dan tagihan rutin yang akan jatuh tempo.

**Tujuan produk**

- Mencatat pemasukan dan pengeluaran dengan cepat, termasuk kategori dan metode bayar (Cash, e-wallet, bank).
- Menampilkan saldo per dompet/akun dan total saldo secara real time.
- Menyajikan chart mingguan dan bulanan yang mudah dibaca.
- Mengontrol pengeluaran lewat budget bulanan per kategori beserta peringatannya.
- Mengotomatiskan transaksi rutin (kos, langganan, cicilan) dan mengingatkan pengguna sebelum jatuh tempo.
- Menjaga data aman lewat backup dan export, karena tidak ada akun cloud.

**Prinsip desain**

- **Tanpa login.** Aplikasi langsung bisa dipakai saat pertama dibuka.
- **Offline-first.** Semua fitur berjalan tanpa internet; data di IndexedDB perangkat.
- **Mobile-first.** Dirancang untuk layar HP satu tangan, tombol tambah transaksi selalu terjangkau jempol.
- **Bahasa Indonesia dan Rupiah** sebagai default, format angka `Rp 25.000`.
- **Sedikit ketukan.** Nilai default cerdas: tanggal hari ini, metode bayar terakhir, kategori yang paling sering dipakai.

## 2. Ruang lingkup

Semua fitur yang Anda pilih masuk ke rilis 1.0, tetapi dibangun bertahap agar setiap tahap sudah bisa dipakai. Fitur yang butuh server atau akun sengaja ditunda.

| Fitur | Rilis | Catatan |
| --- | --- | --- |
| Catat pemasukan, pengeluaran, transfer antar dompet | MVP | Inti aplikasi |
| Kategori default + tambah/edit/arsip | MVP | Ikon dan warna per kategori |
| Dompet/metode bayar (Cash, e-wallet, bank) dengan saldo | MVP | Saldo awal bisa diisi; kartu kredit dicatat sebagai utang |
| Beranda: saldo total, ringkasan hari ini & bulan ini | MVP |  |
| Riwayat transaksi + pencarian + filter | MVP |  |
| Chart mingguan & bulanan | MVP | Permintaan utama |
| Install ke homescreen (PWA) + offline | MVP |  |
| Budget bulanan per kategori + peringatan 80% dan 100% | 1.0 |  |
| Transaksi rutin otomatis (harian/mingguan/bulanan/tahunan) | 1.0 | Kos, langganan, cicilan |
| Reminder: catat harian, tagihan jatuh tempo, budget | 1.0 | Notifikasi push ke perangkat, lihat bagian 4.8 |
| Backup/restore JSON + export CSV | 1.0 | Wajib karena tanpa akun |
| Kunci aplikasi dengan PIN | 1.0 | Opsional, bukan login |
| Mode gelap | 1.0 | Ikut pengaturan sistem |
| Foto struk pada transaksi | Fase 2 | Butuh kompresi gambar |
| Target tabungan (goals) | Fase 2 |  |
| Sinkronisasi antar perangkat / login cloud | Di luar lingkup | Bertentangan dengan prinsip tanpa login |
| Multi mata uang, scan struk otomatis (OCR), koneksi rekening bank | Di luar lingkup |  |

## 3. Persona dan user stories

Pengguna utama adalah pekerja muda atau fresh graduate di kota besar dengan banyak transaksi kecil setiap hari dan beberapa tagihan tetap tiap bulan.

**Persona: Raka, 23 tahun, karyawan baru di Jakarta.** Gaji masuk tanggal 25, bayar kos tanggal 1, langganan streaming dan cicilan HP bulanan. Sehari bisa 5 sampai 8 transaksi kecil lewat Cash, GoPay, dan debit. Ia ingin tahu sisa uang sampai gajian berikutnya tanpa harus membuka spreadsheet.

| ID | Sebagai pengguna, saya ingin… | Supaya… |
| --- | --- | --- |
| US-01 | mencatat pengeluaran hanya dengan nominal dan kategori | cepat dan tidak malas mencatat |
| US-02 | memilih metode bayar (Cash, GoPay, BCA, dst.) | saldo tiap dompet akurat |
| US-03 | mencatat pemasukan seperti gaji dan transfer masuk | saldo total benar |
| US-04 | mencatat transfer, misal top up GoPay dari BCA | saldo pindah tanpa dihitung sebagai pengeluaran |
| US-05 | melihat chart pengeluaran minggu ini dan bulan ini | tahu pola dan kategori paling boros |
| US-06 | membandingkan dengan minggu/bulan sebelumnya | tahu apakah pengeluaran naik atau turun |
| US-07 | memasang budget per kategori per bulan | pengeluaran terkendali |
| US-08 | diberi peringatan saat budget hampir habis | bisa mengerem sebelum terlambat |
| US-09 | mendaftarkan tagihan rutin seperti kos dan langganan | tidak perlu input manual tiap bulan |
| US-10 | diingatkan sebelum tagihan jatuh tempo | tidak telat bayar |
| US-11 | diingatkan setiap malam jika belum mencatat | kebiasaan mencatat terjaga |
| US-12 | membuat, mengubah, dan mengarsipkan kategori sendiri | kategori sesuai gaya hidup saya |
| US-13 | mencari dan memfilter riwayat transaksi | cepat menemukan transaksi lama |
| US-14 | membackup dan memulihkan data ke file | data tidak hilang saat ganti HP atau hapus cache |
| US-15 | mengexport transaksi ke CSV | bisa diolah di Excel/Google Sheets |
| US-16 | mengunci aplikasi dengan PIN | data keuangan tidak dilihat orang lain |

## 4. Kebutuhan fungsional

Setiap kebutuhan diberi kode (FR) agar mudah dirujuk saat memberi instruksi ke Claude Code.

### 4.1 Transaksi

- **FR-1.1** Tiga jenis transaksi: Pengeluaran, Pemasukan, Transfer (antar dompet).
- **FR-1.2** Form tambah transaksi berisi: jenis, nominal (wajib), kategori (wajib kecuali transfer), dompet asal (wajib), dompet tujuan (transfer saja), tanggal dan jam (default sekarang), catatan (opsional, maks. 140 karakter).
- **FR-1.3** Input nominal memakai keypad angka besar di layar, otomatis diformat `Rp 25.000` saat mengetik, mendukung tombol cepat `000`.
- **FR-1.4** Nilai default: dompet terakhir dipakai, kategori ditampilkan urut dari yang paling sering dipakai 30 hari terakhir.
- **FR-1.5** Transfer mengurangi saldo dompet asal dan menambah dompet tujuan, tidak dihitung sebagai pengeluaran atau pemasukan di chart. Biaya admin transfer (opsional) dicatat sebagai pengeluaran kategori "Biaya Admin".
- **FR-1.6** Edit dan hapus transaksi. Hapus menampilkan toast "Transaksi dihapus" dengan tombol Urungkan selama 5 detik.
- **FR-1.7** Tombol Duplikat untuk mengulang transaksi yang sama hari ini.
- **FR-1.8** Validasi: nominal > 0 dan maksimum Rp 999.999.999.999; dompet asal ≠ tujuan pada transfer.

* **FR-1.9 Refund:** uang kembali (pembatalan pesanan, retur) dicatat sebagai jenis Refund yang wajib memilih kategori pengeluaran asal. Refund mengurangi pengeluaran kategori itu di chart dan budget, bukan menambah pemasukan. Refund menambah saldo dompet tujuannya.

### 4.2 Kategori

- **FR-2.1** Kategori terpisah untuk pengeluaran dan pemasukan, masing-masing dengan nama, ikon, dan warna.
- **FR-2.2** Kategori default pengeluaran: Makan & Minum, Transportasi, Belanja Harian, Tempat Tinggal (kos/sewa), Tagihan & Utilitas, Pulsa & Internet, Hiburan & Langganan, Kesehatan, Pendidikan, Perawatan Diri & Pakaian, Sosial & Hadiah, Cicilan & Utang, Biaya Admin, Lainnya.
- **FR-2.3** Kategori default pemasukan: Gaji, Bonus, Freelance & Usaha, Hadiah, Lainnya. Uang kembali tidak dicatat sebagai pemasukan, melainkan Refund (FR-1.9).
- **FR-2.4** Pengguna bisa menambah, mengganti nama/ikon/warna, mengurutkan ulang, dan mengarsipkan kategori.
- **FR-2.5** Kategori yang sudah punya transaksi tidak bisa dihapus permanen, hanya diarsipkan (disembunyikan dari form, tetap muncul di riwayat dan chart). Kategori tanpa transaksi boleh dihapus.
- **FR-2.6** Kategori "Lainnya" tidak bisa dihapus atau diarsipkan.

### 4.3 Dompet dan metode bayar

- **FR-3.1** Tipe dompet: Cash, E-wallet (GoPay, OVO, DANA, ShopeePay, dll.), Bank, Kartu kredit (dicatat sebagai utang, lihat FR-3.7).
- **FR-3.2** Setiap dompet punya nama, tipe, warna, saldo awal, dan tanggal saldo awal.
- **FR-3.3** Saldo dompet = saldo awal + pemasukan − pengeluaran + transfer masuk − transfer keluar. Saldo dihitung dari transaksi, tidak disimpan sebagai angka mentah.
- **FR-3.4** Fitur Sesuaikan Saldo: bila saldo aplikasi berbeda dengan saldo nyata, aplikasi membuat transaksi penyesuaian sebesar selisihnya (tidak masuk chart).
- **FR-3.5** Opsi "Sertakan dalam saldo total" per dompet, misalnya untuk menyembunyikan tabungan.
- **FR-3.6** Dompet default saat pertama buka: Cash. Onboarding menawarkan menambah e-wallet dan bank.

**FR-3.7 Kartu kredit sebagai utang**

- Dompet kartu kredit punya limit, tanggal cetak tagihan (1–28), dan tanggal jatuh tempo (1–28).
- Belanja dengan kartu kredit dicatat sebagai pengeluaran biasa pada tanggal belanja, sehingga masuk chart dan budget. Saldo kartu menjadi negatif; nilai negatif itu adalah utang.
- Membayar tagihan = Transfer dari bank atau e-wallet ke kartu kredit. Pembayaran tidak dihitung sebagai pengeluaran lagi, agar tidak terhitung ganda.
- Layar dompet kartu kredit menampilkan: utang saat ini, sisa limit, tagihan periode terakhir, tanggal jatuh tempo berikutnya, dan status Lunas / Belum lunas.
- Tagihan periode = pengeluaran antara dua tanggal cetak tagihan dikurangi pembayaran yang masuk setelah tanggal cetak.
- Reminder H-3 dan hari-H jatuh tempo bila tagihan belum lunas; peringatan saat pemakaian limit ≥ 80%.

**FR-3.8 Arsip dan hapus dompet**

- Dompet tanpa transaksi boleh dihapus permanen. Dompet yang punya transaksi hanya bisa diarsipkan: hilang dari form dan saldo total, tetap muncul di riwayat dan chart.
- Dompet bersaldo ≠ 0 tidak bisa diarsipkan sebelum saldonya dipindahkan (transfer) atau disesuaikan menjadi 0. Kartu kredit yang masih punya utang tidak bisa diarsipkan.
- Minimal satu dompet aktif harus selalu ada.

**FR-3.9 Saldo negatif**

- Transaksi tetap boleh disimpan walau membuat saldo dompet non-kredit menjadi negatif, agar pencatatan tidak terhambat.
- Form menampilkan peringatan kuning "Saldo Cash akan menjadi -Rp 20.000" sebelum menyimpan; dompet bersaldo negatif ditandai di daftar dompet.

### 4.4 Beranda dan riwayat

- **FR-4.1** Beranda menampilkan: saldo total (bisa disembunyikan dengan ikon mata), pengeluaran dan pemasukan hari ini, sisa budget bulan ini, tagihan rutin 7 hari ke depan, dan 5 transaksi terakhir.
- **FR-4.2** Riwayat dikelompokkan per hari dengan subtotal harian, scroll tanpa batas (muat per 50 transaksi). Urutan pasti: tanggal, lalu jam, lalu waktu input (createdAt), terbaru di atas.
- **FR-4.3** Pencarian berdasarkan catatan dan nama kategori; filter berdasarkan rentang tanggal, jenis, kategori, dompet, dan rentang nominal.

### 4.5 Chart dan statistik

Chart adalah permintaan utama, jadi dua tampilan berikut wajib ada di MVP. Minggu dimulai hari Senin.

- **FR-5.1 Tampilan mingguan:**
  - Bar chart 7 hari (Sen–Min): pengeluaran per hari, pemasukan sebagai bar kedua yang bisa di-toggle.
  - Donut chart pengeluaran per kategori dengan persentase dan nominal.
  - Kartu ringkas: total pengeluaran, rata-rata per hari, hari paling boros, dan perubahan (%) dibanding minggu lalu.
- **FR-5.2 Tampilan bulanan:**
  - Line chart pengeluaran kumulatif harian, dengan garis putus-putus total budget bulan itu dan garis bulan lalu sebagai pembanding.
  - Donut chart per kategori, di bawahnya daftar kategori berurutan dari terbesar dengan progress bar budget.
  - Bar chart tren 6 bulan terakhir: pemasukan vs pengeluaran per bulan, plus selisih (net).
  - Kartu ringkas: total pemasukan, total pengeluaran, selisih, rata-rata harian, dan perubahan dibanding bulan lalu.
- **FR-5.3** Navigasi periode dengan tombol ‹ › dan swipe kiri/kanan; tombol "Minggu ini" / "Bulan ini" untuk kembali.
- **FR-5.4** Filter chart per dompet (semua dompet sebagai default).
- **FR-5.5** Ketuk segmen donut atau bar → membuka riwayat yang sudah terfilter sesuai kategori/tanggal itu.
- **FR-5.6** Pengaturan "Tanggal mulai bulan" (1–28), misalnya 25 untuk mengikuti tanggal gajian. Berlaku untuk chart bulanan dan budget.

### 4.6 Budget

- **FR-6.1** Budget ditetapkan per kategori pengeluaran per bulan, plus budget total bulanan opsional.
- **FR-6.2** Opsi "Salin budget bulan lalu" dan "Ulangi otomatis tiap bulan" (default aktif).
- **FR-6.3** Progress bar dengan tiga warna: aman (< 80%), hampir habis (80–99%), terlampaui (≥ 100%).
- **FR-6.4** Peringatan muncul saat menyimpan transaksi yang membuat budget melewati 80% atau 100%: banner di aplikasi dan, bila diizinkan, notifikasi.
- **FR-6.5** Tampilkan "sisa per hari" = sisa budget ÷ sisa hari dalam periode.
- **FR-6.6** Setiap ambang (80%, 100%) hanya memicu satu peringatan per kategori per periode. Bila pemakaian turun lagi di bawah ambang karena transaksi dihapus atau diedit, penanda ambang itu di-reset sehingga peringatan bisa muncul lagi.
  - **FR-6.7** Setiap tambah, edit, atau hapus transaksi menghitung ulang budget untuk periode tanggal lama dan tanggal baru transaksi tersebut, bukan hanya periode berjalan.

### 4.7 Transaksi rutin

- **FR-7.1** Transaksi rutin menyimpan templat transaksi (jenis, nominal, kategori, dompet, catatan) plus jadwal.
- **FR-7.2** Frekuensi: harian, mingguan (pilih hari), bulanan (pilih tanggal 1–31; tanggal 29–31 jatuh ke hari terakhir bulan bila bulannya lebih pendek), tahunan. Ada tanggal mulai dan tanggal selesai atau jumlah pengulangan opsional.
- **FR-7.3** Mode pencatatan: **Otomatis** (langsung dicatat saat jatuh tempo) atau **Minta konfirmasi** (muncul di daftar "Perlu dikonfirmasi" dengan tombol Catat / Ubah nominal / Lewati). Default: Minta konfirmasi.
- **FR-7.4** Karena web tidak bisa berjalan di latar belakang dengan andal, pembuatan transaksi rutin dilakukan **saat aplikasi dibuka**: aplikasi memeriksa semua jadwal sejak pemeriksaan terakhir dan membuat transaksi yang terlewat (catch-up), tanpa duplikat.
- **FR-7.5** Transaksi yang dibuat dari jadwal diberi penanda ikon ulang dan tautan ke jadwalnya.
- **FR-7.6** Jeda (pause) dan lanjutkan jadwal tanpa menghapusnya.

* **FR-7.7 Status setiap kejadian jadwal** disimpan di tabel `recurringOccurrences` dengan status `pending` (menunggu konfirmasi), `done` (sudah jadi transaksi), atau `skipped` (dilewati). Daftar "Perlu dikonfirmasi" = semua occurrence berstatus pending.
* **FR-7.8** Menghapus transaksi hasil jadwal tidak menghapus occurrence-nya, sehingga catch-up tidak membuatnya ulang. Mengubah templat jadwal hanya berlaku untuk kejadian berikutnya; transaksi yang sudah tercatat tidak ikut berubah.

### 4.8 Reminder

Reminder mencatat harian wajib muncul sebagai notifikasi di perangkat meskipun aplikasi tertutup. Web tidak bisa menjadwalkan notifikasi sendiri, jadi rilis 1.0 memakai **Web Push dengan server kecil** yang tidak menyimpan data keuangan dan tidak butuh login.

- **FR-8.1** Jenis reminder: (a) catat harian pada jam pilihan, default 21.00, dikirim hanya jika hari itu belum ada transaksi yang diinput manual (dihitung dari waktu input, bukan tanggal transaksi; transaksi bertanggal mundur tetap dihitung; transaksi yang dibuat otomatis oleh jadwal rutin tidak dihitung); (b) tagihan rutin H-1 dan hari-H; (c) jatuh tempo kartu kredit H-3 dan hari-H; (d) budget 80% dan 100%.
- **FR-8.2 Alur aktivasi:** pengguna mengaktifkan reminder → aplikasi meminta izin notifikasi → `PushManager.subscribe()` dengan kunci publik VAPID → kirim subscription, jam reminder, dan zona waktu (misal `Asia/Jakarta`) ke server → server memberi `pushClientId` acak yang disimpan di settings. Izin hanya diminta setelah pengguna menekan tombol, tidak saat pertama buka.
- **FR-8.3 Menandai sudah mencatat:** setiap kali transaksi disimpan, aplikasi mengirim `POST /api/push/logged` berisi pushClientId dan tanggal hari ini saja (tanpa nominal atau kategori). Bila offline, dikirim ulang saat online.
- **FR-8.4 Endpoint server:** `POST /api/push/subscribe`, `POST /api/push/update` (jam, zona waktu, daftar jadwal), `POST /api/push/logged`, `POST /api/push/unsubscribe`, dan `GET /api/cron/reminders` yang dipanggil penjadwal tiap 15 menit. Cron mengirim reminder harian ke subscription yang jam reminder-nya masuk jendela 15 menit itu dan belum mencatat hari ini. Subscription yang dibalas 404/410 oleh layanan push dihapus.
- **FR-8.5 Tagihan dan kartu kredit:** aplikasi mengirim daftar tanggal jatuh tempo ke server dengan judul generik ("Tagihan rutin", "Kartu kredit"), tanpa nominal, sehingga reminder H-1/H-3 tetap muncul walau aplikasi tidak dibuka. Nominal hanya tampil di dalam aplikasi.
- **FR-8.6 Budget:** peringatan budget dipicu saat transaksi disimpan, jadi cukup notifikasi lokal lewat `registration.showNotification()` tanpa server.
- **FR-8.7 Isi dan aksi notifikasi:** judul "Money Tracker", isi "Sudah catat pengeluaran hari ini?", tombol aksi "Catat sekarang". Mengetuk notifikasi membuka aplikasi langsung ke sheet tambah transaksi (`/?add=expense`).
- **FR-8.8 Syarat perangkat:** Android (Chrome) mendukung push di browser maupun PWA terpasang. iPhone hanya mendukung push untuk PWA yang sudah ditambahkan ke Layar Utama pada iOS 16.4 ke atas, jadi onboarding di iPhone wajib memandu pemasangan sebelum reminder bisa diaktifkan.
- **FR-8.9 Status dan uji:** Pengaturan menampilkan status notifikasi (Aktif / Diblokir / Tidak didukung) dan tombol "Kirim notifikasi uji". Jika izin diblokir, tampilkan cara membukanya di pengaturan browser.
- **FR-8.10 Cadangan:** pusat reminder di dalam aplikasi (ikon lonceng dengan badge) selalu aktif. Jika push ditolak atau tidak didukung, tawarkan export `.ics` berisi alarm harian dan jadwal tagihan untuk diimpor ke Google Calendar atau Kalender iPhone.

* **FR-8.11 Daftar ulang otomatis:** setelah restore backup, hapus semua data, atau saat subscription di browser berubah atau hilang, aplikasi otomatis mendaftar ulang ke server dan menghapus pushClientId lama. Setiap aplikasi dibuka, aplikasi mencocokkan subscription di browser dengan yang terdaftar di server.

### 4.9 Backup, restore, dan export

- **FR-9.1** Backup penuh ke file JSON (semua tabel + versi skema + tanggal backup), nama file `money-tracker-backup-YYYY-MM-DD.json`.
- **FR-9.2** Restore dari file JSON dengan dua mode: Ganti semua data, atau Gabungkan (lewati ID yang sudah ada). Validasi versi skema dan tampilkan ringkasan sebelum konfirmasi.
- **FR-9.3** Export transaksi ke CSV dengan rentang tanggal pilihan. Kolom: tanggal, jam, jenis, kategori, dompet, dompet tujuan, nominal, catatan. Pemisah titik koma agar rapi di Excel berbahasa Indonesia. File diawali BOM UTF-8 agar emoji dan karakter khusus terbaca benar. Nominal ditulis sebagai angka polos positif (25000, bukan Rp 25.000); arah uang dibaca dari kolom jenis.
- **FR-9.4** Pengingat backup: jika backup terakhir > 30 hari, tampilkan banner di beranda.
- **FR-9.5** Minta `navigator.storage.persist()` agar browser tidak menghapus data saat penyimpanan penuh.

### 4.10 Pengaturan dan keamanan

- **FR-10.1** Pengaturan: tanggal mulai bulan, tema (terang/gelap/ikuti sistem), sembunyikan saldo default, jam reminder harian, kelola kategori, kelola dompet.
- **FR-10.2** Kunci PIN 4–6 digit (opsional), disimpan sebagai hash (SHA-256 + salt), dengan kunci otomatis setelah 1 menit di latar belakang. PIN hanya melindungi tampilan, bukan enkripsi data.
- **FR-10.3** Hapus semua data dengan konfirmasi dua langkah (ketik "HAPUS").
- **FR-10.4** Onboarding 3 layar untuk pengguna baru: sambutan → atur dompet dan saldo awal → aktifkan reminder (bisa dilewati). Layar sambutan punya tautan "Pulihkan data" untuk restore backup, dan menjelaskan bahwa data di tiap perangkat tidak tersinkron.

* **FR-10.5 Onboarding khusus iPhone:** di iOS, penyimpanan Safari dan aplikasi yang dipasang di Layar Utama terpisah. Bila aplikasi dibuka di Safari (bukan mode standalone), onboarding dimulai dengan panduan "Tambahkan ke Layar Utama" dan belum menyimpan data apa pun. Ada tombol "Lanjut di Safari" dengan peringatan bahwa data tidak akan ikut ke aplikasi yang dipasang nanti.
* **FR-10.6 Pembaruan aplikasi:** saat versi baru ter-deploy, service worker baru menunggu, lalu aplikasi menampilkan banner "Versi baru tersedia" dengan tombol "Muat ulang". Migrasi skema Dexie berjalan saat aplikasi dimuat ulang. Sebelum migrasi yang mengubah struktur data, aplikasi membuat backup otomatis ke IndexedDB terpisah.

## 5. Layar, navigasi, dan alur

Navigasi memakai bottom bar lima slot dengan tombol tambah (+) besar di tengah, sehingga mencatat transaksi selalu satu ketukan dari layar mana pun.

| Slot bottom bar | Layar | Isi utama |
| --- | --- | --- |
| 1 | Beranda | Saldo total, hari ini, sisa budget, tagihan mendatang, transaksi terakhir, lonceng reminder |
| 2 | Riwayat | Daftar per hari, pencarian, filter |
| 3 (tengah) | Tambah transaksi | Bottom sheet: tab Pengeluaran / Pemasukan / Transfer |
| 4 | Statistik | Segmen Mingguan / Bulanan, chart, ringkasan |
| 5 | Lainnya | Budget, Transaksi Rutin, Dompet, Kategori, Backup & Export, Pengaturan |

### 5.1 Wireframe teks: Beranda

```
┌─────────────────────────────┐
│ Money Tracker         🔔(2) │
│ Saldo total        👁        │
│ Rp 4.250.000                │
│ [Cash 350rb][GoPay 120rb]…  │  ← chip dompet, geser samping
├─────────────────────────────┤
│ Hari ini   − Rp 87.000      │
│ Bulan ini  − Rp 2.140.000   │
│ Budget ███████░░ 72%        │
│ Sisa per hari Rp 95.000     │
├─────────────────────────────┤
│ Tagihan 7 hari ke depan     │
│ Kos · 1 Okt · Rp 1.500.000  │
├─────────────────────────────┤
│ Transaksi terakhir     Semua│
│ 🍜 Makan siang   − 25.000   │
│ 🛵 Ojol          − 18.000   │
├─────────────────────────────┤
│ Beranda Riwayat (+) Stat ⋯  │
└─────────────────────────────┘
```

### 5.2 Wireframe teks: Tambah transaksi

```
┌─────────────────────────────┐
│ [Pengeluaran|Pemasukan|Trf] │
│        Rp 25.000            │
│ Kategori: 🍜🛵🛒🏠📱 …        │  ← urut paling sering dipakai
│ Dompet: [Cash ▾]  Hari ini ▾│
│ Catatan (opsional)          │
│ ┌───┬───┬───┐               │
│ │ 1 │ 2 │ 3 │               │
│ │ 4 │ 5 │ 6 │               │
│ │ 7 │ 8 │ 9 │               │
│ │000│ 0 │ ⌫ │               │
│ └───┴───┴───┘               │
│ [        Simpan         ]   │
└─────────────────────────────┘
```

### 5.3 Alur utama

**Mencatat pengeluaran (target < 10 detik, 3 ketukan + angka):**

1. Ketuk (+).
2. Ketik nominal di keypad.
3. Ketuk ikon kategori.
4. Ketuk Simpan → toast "Tersimpan", sheet tertutup, beranda ter-update, cek budget berjalan.

**Pertama kali membuka aplikasi:**

1. Layar sambutan dan penjelasan singkat bahwa data hanya tersimpan di HP ini.
2. Isi saldo awal Cash, tambah e-wallet/bank (bisa dilewati).
3. Tawaran aktifkan reminder harian.
4. Banner "Pasang ke layar utama" (Android: prompt install; iPhone: petunjuk Bagikan → Tambahkan ke Layar Utama).

Di iPhone yang membuka aplikasi lewat Safari, langkah 4 dipindah ke paling depan (FR-10.5), karena data yang diisi di Safari tidak ikut ke aplikasi yang dipasang.

**Setiap kali aplikasi dibuka:**

1. Buka kunci PIN bila aktif.
2. Jalankan pemrosesan transaksi rutin yang jatuh tempo (FR-7.4).
3. Perbarui daftar reminder dan badge lonceng.
4. Tampilkan banner backup bila perlu (FR-9.4).

**Status kosong:** Riwayat kosong menampilkan "Belum ada transaksi. Ketuk + untuk mencatat yang pertama." Statistik kosong menampilkan chart abu-abu dengan ajakan yang sama.

## 6. Model data dan aturan bisnis

Semua data disimpan di IndexedDB (lewat Dexie.js) dalam tujuh tabel. Nominal disimpan sebagai **bilangan bulat Rupiah** (tanpa desimal) untuk menghindari galat pembulatan; ID memakai `crypto.randomUUID()`.

### 6.1 Skema tabel

| Tabel | Field | Index |
| --- | --- | --- |
| `wallets` | id, name, type (`cash`/`ewallet`/`bank`/`credit`), color, icon, initialBalance, initialDate, includeInTotal, creditLimit, statementDay, dueDay, archived, order, createdAt | id, archived |
| `categories` | id, name, kind (`expense`/`income`), icon, color, isDefault, archived, order, createdAt | id, kind, archived |
| `transactions` | id, type (`expense`/`income`/`transfer`/`adjustment`), amount, categoryId, walletId, toWalletId, date (`YYYY-MM-DD`), time (`HH:mm`), note, recurringId, occurrenceDate, createdAt, updatedAt | id, date, \[type+date\], categoryId, walletId, recurringId, \[recurringId+occurrenceDate\] |
| `budgets` | id, categoryId (null = total), period (`YYYY-MM` sesuai tanggal mulai bulan), amount, autoRepeat, alerted80, alerted100 | id, period, \[period+categoryId\] |
| `recurring` | id, template {type, amount, categoryId, walletId, toWalletId, note}, frequency (`daily`/`weekly`/`monthly`/`yearly`), interval, dayOfWeek, dayOfMonth, startDate, endDate, maxCount, mode (`auto`/`confirm`), paused, lastProcessedDate, createdAt | id, paused |
| `reminders` | id, kind (`daily`/`bill`/`budget`/`backup`), refId, title, body, dueAt, status (`active`/`done`/`dismissed`), createdAt | id, status, dueAt |
| `settings` | key, value (pasangan kunci-nilai: monthStartDay, theme, hideBalance, dailyReminderTime, pinHash, pinSalt, lastBackupAt, schemaVersion, onboarded, pushEnabled, pushClientId) | key |
| recurringOccurrences | id, recurringId, date (YYYY-MM-DD), status (pending/done/skipped), transactionId, amountOverride, createdAt, updatedAt | id, status, \[recurringId+date\] unik |

### 6.2 Aturan bisnis

- **Saldo dompet** = initialBalance + Σ income + Σ transfer masuk + Σ adjustment − Σ expense − Σ transfer keluar, untuk transaksi dengan date ≥ initialDate.
- **Saldo total** = jumlah saldo dompet dengan includeInTotal = true dan archived = false. Saldo kartu kredit yang negatif ikut mengurangi saldo total; beranda juga menampilkan total utang kartu kredit secara terpisah.
- **Chart dan budget** hanya menghitung type `expense` dan `income`; `transfer` dan `adjustment` tidak dihitung.
- **Periode bulan** dengan tanggal mulai N: periode "Oktober" = N Oktober sampai (N−1) November. Default N = 1. Periode dinamai menurut bulan tanggal mulainya: dengan N = 25, periode "September 2026" = 25 September s.d. 24 Oktober 2026, jadi gaji yang masuk 25 September termasuk periode September. Chart dan budget selalu menampilkan rentangnya, misalnya "September 2026 (25 Sep – 24 Okt)".
- **Periode minggu** = Senin 00.00 sampai Minggu 23.59 waktu lokal perangkat.
- **Persentase perubahan** = (periode ini − periode lalu) ÷ periode lalu × 100%; bila periode lalu 0, tampilkan "Baru" alih-alih persen.
- **Sisa per hari** = max(0, budget − terpakai) ÷ jumlah hari tersisa termasuk hari ini.
- **Anti-duplikat transaksi rutin:** sebelum membuat transaksi dari jadwal, cek tabel recurringOccurrences pada \[recurringId+date\]; bila sudah ada dengan status apa pun (pending, done, skipped), lewati. Mode Otomatis membuat occurrence berstatus done beserta transaksinya; mode Konfirmasi membuat occurrence berstatus pending tanpa transaksi. Setelah selesai, perbarui lastProcessedDate.
- **Budget otomatis:** saat periode baru dimulai dan belum ada budget, salin dari periode sebelumnya untuk budget dengan autoRepeat = true, reset alerted80/alerted100.
- **Migrasi skema:** setiap perubahan tabel menaikkan versi Dexie dengan fungsi upgrade; file backup menyimpan schemaVersion untuk validasi restore.

* **Refund** (type `refund`, lihat FR-1.9) mengurangi pengeluaran kategori asalnya di chart dan budget pada tanggal refund, dan menambah saldo dompet. Total pengeluaran kategori pada suatu periode tidak ditampilkan di bawah 0.

## 7. Kebutuhan non-fungsional dan tech stack

Stack yang direkomendasikan adalah React + TypeScript di atas Vite, dengan Dexie untuk database lokal dan vite-plugin-pwa untuk mode offline; semuanya gratis dan bisa di-deploy ke Vercel.

### 7.1 Kebutuhan non-fungsional

| Aspek | Target |
| --- | --- |
| Kecepatan | Buka pertama < 2 detik di 4G; buka berikutnya < 1 detik dari cache |
| Skala data | Tetap lancar dengan 10.000 transaksi (± 5 tahun pemakaian) |
| Offline | Semua fitur jalan tanpa internet setelah kunjungan pertama |
| Ukuran bundle | < 300 KB gzip untuk JS awal; chart dimuat lazy |
| Kompatibilitas | Chrome Android 100+, Safari iOS 16.4+, Chrome/Edge desktop |
| Aksesibilitas | Target sentuh ≥ 44 px, kontras WCAG AA, label untuk pembaca layar, hormati reduced motion |
| Privasi | Tidak ada data keuangan yang dikirim ke server; server push hanya menyimpan subscription anonim, jam reminder, zona waktu, tanggal jatuh tempo, dan tanggal terakhir mencatat; tanpa analytics pihak ketiga |
| Lighthouse | Skor Performance, Accessibility, Best Practices ≥ 90; lolos kriteria installable |

### 7.2 Tech stack

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Framework | React + TypeScript + Vite | Ekosistem besar, cepat, mudah dipandu Claude Code |
| Styling | Tailwind CSS | Cepat membuat UI mobile-first dan mode gelap |
| Database lokal | Dexie.js (IndexedDB) + `dexie-react-hooks` | Query berindex, reaktif lewat `useLiveQuery`, mendukung migrasi |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, dan cache otomatis |
| Chart | Recharts | Bar, line, donut, responsif, berbasis React |
| Tanggal | date-fns + locale `id` | Ringan, mendukung minggu mulai Senin |
| State UI | Zustand (opsional) | Untuk state kecil seperti filter dan sheet |
| Routing | React Router | Navigasi antar tab |
| Ikon | Lucide | Ikon kategori dan navigasi |
| Pengujian | Vitest untuk logika perhitungan; Playwright opsional untuk alur utama | Rumus saldo, periode, dan rutin harus teruji |
| Deploy | Vercel | Gratis, HTTPS otomatis (wajib untuk PWA) |

Tambahan sisi server untuk reminder (satu repo dengan frontend):

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| API | Vercel Serverless Functions di folder `api/` | Deploy bersama frontend |
| Penyimpanan | Upstash Redis atau Neon Postgres (paket gratis) | Hanya data reminder, tanpa data keuangan |
| Pengirim push | Library `web-push` + pasangan kunci VAPID | Standar Web Push untuk Android dan iPhone |
| Penjadwal | Vercel Cron; bila paket gratis tidak mengizinkan interval 15 menit, pakai cron-job.org atau GitHub Actions yang memanggil `/api/cron/reminders` | Cek batas paket terbaru saat implementasi |
| Keamanan | Endpoint cron dilindungi header rahasia (`CRON_SECRET`); cukup untuk pemakaian pribadi | Mencegah penyalahgunaan |

### 7.3 Struktur folder yang disarankan

```
src/
  db/          schema.ts, seed.ts (kategori default), migrations
  lib/         money.ts (format Rp), period.ts, balance.ts,
               recurring.ts, budget.ts, backup.ts, ics.ts
  features/    home/, transactions/, stats/, budgets/,
               recurring/, wallets/, categories/, settings/
  components/  BottomNav, AmountKeypad, CategoryGrid, Sheet, Toast
  pwa/         notifications.ts, install-prompt.ts
```

Semua logika perhitungan ditempatkan di `src/lib` sebagai fungsi murni agar mudah diuji dengan Vitest, terpisah dari komponen UI.

## 8. Penerimaan, roadmap, dan risiko

Pengerjaan dibagi menjadi 10 tahap kecil; setiap tahap diakhiri aplikasi yang bisa dijalankan dan diuji, sehingga cocok dikerjakan satu per satu dengan Claude Code.

### 8.1 Kriteria penerimaan utama

- [ ] Pengeluaran bisa dicatat dalam ≤ 4 ketukan plus angka, dan langsung mengubah saldo, beranda, dan chart.
- [ ] Transfer GoPay ← BCA Rp 100.000 mengurangi BCA, menambah GoPay, dan tidak muncul di chart pengeluaran.
- [ ] Chart mingguan menampilkan Senin–Minggu dengan total yang sama dengan jumlah riwayat minggu itu.
- [ ] Chart bulanan mengikuti tanggal mulai bulan di pengaturan (uji dengan N = 25).
- [ ] Budget Rp 1.000.000 memicu peringatan tepat sekali di Rp 800.000 dan sekali di Rp 1.000.000.
- [ ] Jadwal kos bulanan tanggal 31 tercatat di tanggal 30 September dan 28/29 Februari.
- [ ] Aplikasi tidak dibuka 3 bulan → saat dibuka, 3 transaksi kos terbuat tanpa duplikat.
- [ ] Backup → hapus semua data → restore menghasilkan data identik (jumlah transaksi dan saldo sama).
- [ ] CSV terbuka rapi di Excel dan Google Sheets.
- [ ] Aplikasi bisa dipasang ke homescreen Android dan iPhone serta berjalan dalam mode pesawat.

* [ ] Aplikasi ditutup penuh, belum ada transaksi hari itu → notifikasi "Sudah catat pengeluaran hari ini?" muncul di HP Android dan iPhone (PWA terpasang) dalam 15 menit dari jam yang dipilih.
* [ ] Sudah ada transaksi hari itu → notifikasi harian tidak dikirim.
* [ ] Belanja Rp 500.000 dengan kartu kredit masuk chart pengeluaran; pembayaran tagihan Rp 500.000 dari BCA tidak masuk chart dan membuat utang kartu menjadi 0.

### 8.2 Metrik sukses (pemakaian pribadi)

- Mencatat transaksi minimal 25 dari 30 hari dalam bulan pertama.
- Selisih saldo aplikasi vs saldo nyata < 2% di akhir bulan.
- Rata-rata waktu mencatat satu transaksi < 10 detik.

### 8.3 Roadmap pengerjaan dengan Claude Code

1. **Setup proyek:** Vite + React + TS + Tailwind + ESLint, bottom nav, routing, tema terang/gelap.
2. **Database:** skema Dexie (bagian 6.1), seed kategori default dan dompet Cash, fungsi `src/lib` beserta unit test.
3. **Transaksi:** sheet tambah/edit, keypad nominal, pilih kategori & dompet, transfer, hapus dengan Urungkan (FR-1).
4. **Beranda & riwayat:** saldo, ringkasan, daftar per hari, pencarian, filter (FR-4).
5. **Statistik:** tampilan mingguan dan bulanan, navigasi periode, drill-down ke riwayat (FR-5).
6. **PWA:** manifest, ikon, service worker, prompt install, `storage.persist()`. Deploy perdana ke Vercel dan mulai dipakai harian.
7. **Kategori & dompet:** kelola, arsip, sesuaikan saldo (FR-2, FR-3).
8. **Budget:** pengaturan, progress, peringatan, salin otomatis (FR-6).
9. **Transaksi rutin & reminder:** jadwal, catch-up, konfirmasi, pusat reminder, server Web Push (Vercel + web-push + cron), notifikasi uji, export `.ics` (FR-7, FR-8).
10. **Backup, PIN, dan poles:** backup/restore/CSV, kunci PIN, onboarding, status kosong, uji Lighthouse (FR-9, FR-10).

Tips: simpan PRD ini di repo sebagai `docs/PRD.md`, rangkum aturan penting di `CLAUDE.md`, lalu beri instruksi per tahap dengan merujuk kode FR, misalnya "Kerjakan tahap 3 sesuai FR-1.1 sampai FR-1.8, tulis unit test untuk balance.ts".

### 8.4 Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Browser menghapus data (clear cache, Safari menghapus data situs yang tidak dibuka lama) | Semua catatan hilang | `storage.persist()`, pengingat backup 30 hari, PWA terpasang di homescreen |
| Notifikasi tidak muncul saat aplikasi tertutup | Reminder terlewat | Pusat reminder di aplikasi, export `.ics` ke kalender, server Web Push sejak rilis 1.0, cadangan alarm kalender harian |
| Ganti HP | Data tidak ikut pindah | Backup JSON lalu restore di HP baru |
| Perhitungan tanggal dan zona waktu keliru | Chart dan saldo salah | Simpan tanggal lokal `YYYY-MM-DD`, uji unit untuk period.ts dan recurring.ts |
| Transaksi rutin dobel | Saldo salah | Index unik \[recurringId+occurrenceDate\] |

### 8.5 Keputusan

- **Nama aplikasi:** Money Tracker.
- **Kartu kredit:** diperlakukan sebagai utang sejak rilis 1.0 (FR-3.7).
- **Reminder:** notifikasi di perangkat wajib, sehingga server Web Push masuk rilis 1.0 (bagian 4.8); `.ics` hanya cadangan.
- **Identitas visual:** sudah dibuat di Google Stitch; screenshot hasilnya diberikan langsung ke Claude Code sebagai acuan UI.

* **Pengguna:** pemakaian pribadi, tidak dipublikasikan di rilis 1.0.
* **Definisi sudah mencatat:** ada transaksi yang diinput manual hari itu, apa pun tanggal transaksinya (FR-8.1).
* **Penamaan periode:** menurut bulan tanggal mulainya; dengan tanggal mulai 25, periode 25 Sep – 24 Okt disebut September (bagian 6.2).
* **Hari mulai minggu:** selalu Senin, tidak bisa diubah.
* **Saldo negatif:** diizinkan dengan peringatan (FR-3.9).
* **Refund:** jenis transaksi tersendiri yang mengurangi pengeluaran, bukan pemasukan (FR-1.9).

## 9. Aturan jika mockup berbeda dengan PRD

PRD ini adalah sumber kebenaran: bila mockup Google Stitch berbeda dengan PRD, yang dibangun adalah versi PRD. Mockup hanya acuan gaya visual dan tata letak; penyempurnaan UI dilakukan belakangan.

**Aturan umum untuk Claude Code**

- Ambil dari mockup: palet warna, tipografi, jarak, bentuk kartu dan tombol, ikon, serta susunan elemen di tiap layar.
- Jangan membangun fitur, tombol, atau integrasi yang terlihat di mockup tetapi tidak ada di PRD. Hilangkan elemennya, jangan dibuat tombol mati.
- Semua angka, nama, tanggal, dan transaksi di mockup adalah data contoh. Jangan di-hardcode; semua tampilan diisi dari database lokal, dan layar kosong memakai status kosong (bagian 5.3).
- Tahun di mockup tercampur (2024, 2025, 2026); abaikan dan pakai tanggal perangkat.
- Bila ragu, ikuti kode FR di bagian 4.

**Perbedaan yang sudah diputuskan**

| Elemen di mockup | Layar | Yang dibangun sesuai PRD |
| --- | --- | --- |
| Tombol "Hubungkan Kalender" ke Google Calendar | Transaksi Rutin | Tombol "Tambahkan ke Kalender" yang mengunduh file `.ics` (FR-8.10), tanpa login Google |
| Backup ke Google Drive, "sinkron cloud", "Backup Data Cloud" | Lainnya, Pengaturan | Backup file JSON dan export CSV ke perangkat (FR-9); ganti semua teks "cloud" |
| "Terakhir sinkron", nomor rekening/telepon, label Payroll/Premier/Terverifikasi | Dompet | Hanya nama, tipe, warna, dan saldo hasil hitungan (FR-3); tidak ada koneksi bank atau e-wallet |
| Kartu visual bergaya kartu fisik (nomor, pemilik, EXP, logo Visa) | Detail kartu kredit | Kartu ringkas berisi nama dan warna dompet saja; aplikasi tidak menyimpan data kartu |
| Tombol "Blokir Sementara" | Detail kartu kredit | Dihapus; aplikasi tidak terhubung ke bank |
| Tombol "Ubah Limit" | Detail kartu kredit | Membuka form edit dompet untuk mengubah angka limit di aplikasi |
| Status "Pending" / "Tercatat" per transaksi, "Pembayaran Minimum", "Autodebet Status" | Detail kartu kredit | Dihapus; semua transaksi langsung tercatat. Status tagihan hanya Lunas / Belum lunas (FR-3.7) |
| Label "Auto Debit BCA" / "Auto-debit GoPay" | Beranda, Transaksi Rutin | Diganti mode jadwal "Otomatis" atau "Konfirmasi" (FR-7.3) |
| "Kunci PIN & Biometrik", PIN 6 digit + fingerprint | Pengaturan | Kunci PIN 4–6 digit saja (FR-10.2) |
| Sapaan bernama ("Halo, Dimas", "Halo, Fajar") dan ikon profil di header | Beranda, Lainnya, semua header | Sapaan tanpa nama ("Halo 👋") dan ikon profil dihapus, karena aplikasi tanpa akun |
| Label paket "Gratis", nomor versi "v2.4.0 (Build 384)" | Lainnya, Pengaturan | Label paket dihapus; versi diambil dari `package.json` |
| Tab "Dompet" menggantikan "Statistik" di bottom nav | Dompet | Bottom nav selalu sama: Beranda, Riwayat, +, Statistik, Lainnya. Dompet dibuka dari Lainnya |
| Header "Beranda" di layar Statistik, Transaksi Rutin, dan Dompet | Beberapa layar | Judul header mengikuti nama layar yang sedang dibuka |
| Header "Tambah Transaksi" di layar Pengingat | Pusat Reminder | Judul "Pengingat" |
| Kartu "Wawasan Finansial", "Kondisi Finansial Prima/Sehat", badge "Sehat Finansial", "Surplus Sehat" | Beranda, Statistik, Dompet | Dihapus dari rilis 1.0 (tidak ada di PRD) |
| Tombol mikrofon di pencarian | Riwayat | Dihapus; pencarian teks saja (FR-4.3) |
| Toggle "Laporan Mingguan & Bulanan" | Pengaturan notifikasi | Dihapus dari rilis 1.0 |
| "Pusat Bantuan & FAQ" | Lainnya | Dihapus dari rilis 1.0 |
| Tombol "Mode Offline Siap", "Instan • 0 dtk", "Biaya Admin Rp 0 (Bebas Biaya)" | Tambah Transaksi (transfer) | Hanya kolom opsional biaya admin (FR-1.5); label status lainnya dihapus |
| Tombol cepat +10rb/+50rb/+100rb dan +100rb s.d. +1jt | Tambah Transaksi | Boleh dipakai: menambah nominal, sejalan dengan FR-1.3 |
| Target harian "≤ 100rb" di chart mingguan | Statistik mingguan | Ditampilkan hanya jika ada budget total; nilainya = budget total ÷ jumlah hari periode |
| Tombol share/export di Statistik dan Riwayat | Statistik, Riwayat | Membuka export CSV untuk periode yang sedang dilihat (FR-9.3) |
