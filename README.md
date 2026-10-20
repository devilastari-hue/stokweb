# Rekap Stok Barang 📦

Aplikasi web modern untuk manajemen dan rekap stok barang (inventaris), pencatatan barang masuk & keluar, pemantauan batas minimum stok, grafik statistik 30 hari, dan laporan dengan fitur ekspor ke CSV.

Dibangun dengan **Node.js**, **Express**, **SQLite (built-in `node:sqlite`)**, dan antarmuka responsif tanpa framework berat berbasis **HTML, CSS, JavaScript** modern, serta visualisasi grafik menggunakan **Chart.js**.

---

## 🌟 Fitur Utama

- **Autentikasi & Keamanan:**
  - Login username dan password.
  - Password di-hash dengan **bcrypt**.
  - Sesi aman berbasis cookie `httpOnly` (`express-session`).
  - Rate limiting pada endpoint login untuk mencegah brute force attack.
  - Akun admin dibuat secara otomatis (auto-seed) saat pertama kali aplikasi dijalankan.
  - Semua halaman dan API terproteksi wajib login (otomatis redirect ke `/login`).
  - Prepared statement untuk mencegah SQL Injection & sanitasi output untuk mencegah XSS.

- **Dashboard Modern:**
  - 5 Kartu KPI Statistik:
    1. Total Jenis Barang
    2. Total Stok Saat Ini (semua barang)
    3. Total Barang Masuk Bulan Ini
    4. Total Barang Keluar Bulan Ini
    5. Jumlah Barang Stok Menipis ($\le$ Batas Minimum)
  - Grafik batang interaktif "Barang Masuk vs Keluar" 30 hari terakhir (Chart.js).
  - 5 Transaksi terbaru.
  - Daftar peringatan barang dengan stok menipis / habis.
  - Dukungan **Dark Mode** (Mode Gelap) dengan toggle yang tersimpan di `localStorage`.
  - Sidebar responsif untuk perangkat mobile / layar kecil (menu hamburger).

- **Manajemen Data Barang:**
  - Tabel rekapitulasi: Nama, Kategori, Total Masuk, Total Keluar, Stok Akhir, Tanggal Masuk Terakhir, Tanggal Keluar Terakhir, Batas Minimum Stok, Status, dan Aksi.
  - Status stok dengan badge warna:
    - 🟢 **Aman**: Stok di atas batas minimum.
    - 🟡 **Menipis**: Stok $\le$ batas minimum.
    - 🔴 **Habis**: Stok = 0.
  - Tambah, Edit, dan Hapus barang (dengan modal konfirmasi).
  - Pencarian nama barang (real-time debounce).
  - Filter berdasarkan kategori.
  - Sorting interaktif per kolom (nama, kategori, masuk, keluar, stok, min. stok).
  - Pagination dinamis.

- **Pencatatan Transaksi:**
  - Form catat transaksi Masuk & Keluar dengan tanggal (default hari ini) dan keterangan.
  - **Validasi Ketat:** Jumlah harus $> 0$, dan transaksi keluar **tidak boleh melebihi stok yang tersedia**.
  - Info stok tersedia langsung tampil saat barang dipilih di form.
  - Tabel riwayat transaksi dengan filter: rentang tanggal, jenis (masuk/keluar), dan barang.
  - Hapus transaksi dengan perhitungan ulang stok secara instan.
  - Seluruh stok dan total dihitung otomatis dari transaksi (tanpa input manual).

- **Laporan & Ekspor:**
  - Rekapitulasi per barang untuk rentang tanggal yang dipilih.
  - Ringkasan akumulasi (Total Masuk, Total Keluar, Total Stok Akhir).
  - **Export ke format CSV** dengan UTF-8 BOM (langsung rapi saat dibuka di Microsoft Excel).

---

## 📋 Prasyarat Sistem

- **Node.js** versi **>= 22.5.0** (menggunakan modul built-in `node:sqlite`, tidak memerlukan Python / Visual C++ Build Tools).
- **npm** (biasanya sudah terpasang bersama Node.js).

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Clone atau Buka Folder Proyek
```bash
cd /path/to/stokweb
```

### 2. Pasang Dependencies
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
# Di Windows (PowerShell)
Copy-Item .env.example .env

# Di Linux / macOS
cp .env.example .env
```

Isi konfigurasi dalam file `.env`:
```env
PORT=3000
SESSION_SECRET=ganti_dengan_string_acak_panjang
ADMIN_USERNAME=ganti_username_admin
ADMIN_PASSWORD=ganti_password_admin_yang_kuat
```

### 4. (Opsional) Mengisi Data Contoh (Seed)
Agar dashboard langsung terisi dengan data contoh realistis (12 barang & 36 transaksi 60 hari terakhir):
```bash
npm run seed
```

### 5. Jalankan Aplikasi
```bash
npm start
```

Buka browser dan akses:
👉 **http://localhost:3000**

---

## 🔑 Akun Login Default

Login menggunakan nilai `ADMIN_USERNAME` dan `ADMIN_PASSWORD` yang Anda atur di file `.env` (lokal) atau di Environment Variables Netlify.

*Catatan: Akun admin dibuat otomatis saat server pertama kali dijalankan.*

---

## 📁 Struktur Direktori

```
stokweb/
├── .env.example              # Template variabel lingkungan
├── .env                      # File konfigurasi lokal
├── package.json              # Definisi dependensi & skrip
├── server.js                 # Entry point Express, session, & middleware
├── test_all.js               # Pengujian otomatis end-to-end (34 test cases)
├── data/
│   └── stokweb.db            # Database SQLite (dibuat otomatis)
├── src/
│   ├── config/
│   │   └── database.js       # Inisialisasi node:sqlite, skema tabel & auto-seed
│   ├── middleware/
│   │   ├── auth.js           # Guard autentikasi API
│   │   └── rateLimiter.js    # Proteksi brute-force login
│   ├── routes/
│   │   ├── auth.js           # Endpoint login, logout, me
│   │   ├── dashboard.js      # Endpoint KPI stats, chart 30 hari, low stock
│   │   ├── items.js          # CRUD barang, search, filter, sort, pagination
│   │   ├── transactions.js   # Catat tx masuk/keluar, validasi, riwayat
│   │   └── reports.js        # Rekap per periode & export CSV
│   └── seed.js               # Generator data contoh realistis
└── public/
    ├── index.html            # Halaman Dashboard
    ├── login.html            # Halaman Login
    ├── items.html            # Halaman Data Barang
    ├── transactions.html     # Halaman Transaksi
    ├── reports.html          # Halaman Laporan
    ├── css/
    │   └── style.css         # Desain modern, dark mode, responsif
    └── js/
        ├── api.js            # Fetch helper, auth checker, toast, confirm dialog
        ├── dashboard.js      # Logika dashboard & Chart.js
        ├── items.js          # Logika data barang
        ├── transactions.js   # Logika pencatatan & filter riwayat
        └── reports.js        # Logika laporan & download CSV
```

---

## 🧪 Menjalankan Pengujian Otomatis

Aplikasi dilengkapi dengan tes terintegrasi menyeluruh yang menguji seluruh alur autentikasi, proteksi redirect, CRUD barang, validasi pengurangan stok, perhitungan dinamis, dan ekspor CSV:

```bash
node test_all.js
```

Hasil uji: **34 PASS, 0 FAIL**.

---

## 🌐 Panduan Deploy ke Hosting Web

Aplikasi ini siap dideploy ke berbagai layanan hosting:

### A. Deploy ke Render (render.com)
1. Buat **Web Service** baru di Render dari repositori Git Anda.
2. Atur konfigurasi:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Tambahkan **Environment Variables** di dashboard Render:
   - `SESSION_SECRET`: Masukkan string acak panjang.
   - `ADMIN_USERNAME`: Username admin yang diinginkan.
   - `ADMIN_PASSWORD`: Password admin yang kuat.
4. *(Disarankan untuk persistensi database)* Tambahkan **Disk** (Persistent Storage) di mount path `/data` agar file database SQLite tidak hilang saat redeploy.

### B. Deploy ke Railway (railway.app)
1. Hubungkan repo ke Railway project baru.
2. Tambahkan Environment Variables (`SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`). Railway otomatis mengatur variable `PORT`.
3. Tambahkan **Volume** pada folder `data/` untuk menyimpan database SQLite secara persisten.

### C. Deploy ke VPS (Ubuntu / Debian / AlmaLinux)
1. Install Node.js 22+:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. Salin kode aplikasi ke server.
3. Jalankan `npm install` dan siapkan file `.env`.
4. Jalankan dengan PM2 agar berjalan di background dan otomatis restart saat server reboot:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "stokweb"
   pm2 startup
   pm2 save
   ```
5. Konfigurasikan Nginx sebagai reverse proxy ke `http://localhost:3000` dengan SSL gratis dari Let's Encrypt (`certbot`).

---

## 📄 Lisensi
MIT License. Bebas digunakan untuk keperluan komersial maupun pribadi.
