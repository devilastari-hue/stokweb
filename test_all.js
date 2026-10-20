/**
 * test_all.js - Otomatisasi pengujian end-to-end semua fitur backend & API
 */

const http = require('http');
const app = require('./server');

let server;
let baseUrl;
let cookie = '';

function request(method, path, body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { ...customHeaders };
    if (cookie) headers['Cookie'] = cookie;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Simpan cookie jika ada
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          cookie = setCookie.map(c => c.split(';')[0]).join('; ');
        }
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🚀 Memulai Pengujian Komprehensif Rekap Stok Barang...\n');

  // Jalankan server di port ephemeral
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Server uji berjalan di port ${port}`);
      resolve();
    });
  });

  try {
    // 1. Uji Proteksi Halaman (Redirect jika belum login)
    console.log('1. Pengujian Proteksi Halaman & API Tanpa Login:');
    const resHome = await request('GET', '/');
    assert(resHome.status === 302 && resHome.headers.location === '/login', 'GET / redirect ke /login');

    const resItemsPage = await request('GET', '/items');
    assert(resItemsPage.status === 302 && resItemsPage.headers.location === '/login', 'GET /items redirect ke /login');

    const resUnauthApi = await request('GET', '/api/dashboard/stats');
    assert(resUnauthApi.status === 401, 'GET /api/dashboard/stats menghasilkan 401 Unauthorized');

    // 2. Uji Autentikasi
    console.log('\n2. Pengujian Autentikasi (Login & Rate Limit):');
    const resBadLogin = await request('POST', '/api/auth/login', { username: process.env.ADMIN_USERNAME, password: 'wrongpassword' });
    assert(resBadLogin.status === 401 && resBadLogin.json.error.includes('salah'), 'Login password salah ditolak dengan pesan yang tepat');

    const resGoodLogin = await request('POST', '/api/auth/login', { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD });
    assert(resGoodLogin.status === 200 && resGoodLogin.json.success === true, 'Login berhasil dengan kredensial benar');
    assert(cookie.includes('connect.sid'), 'Cookie session httpOnly dibuat');

    const resMe = await request('GET', '/api/auth/me');
    assert(resMe.status === 200 && resMe.json.loggedIn === true && resMe.json.username === process.env.ADMIN_USERNAME, 'Cek /api/auth/me mengembalikan status loggedIn true');

    // 3. Uji Halaman Setelah Login
    console.log('\n3. Pengujian Akses Halaman Setelah Login:');
    const resHomeAuthed = await request('GET', '/');
    assert(resHomeAuthed.status === 200 && resHomeAuthed.body.includes('Dashboard'), 'GET / berhasil diakses setelah login');

    const resItemsAuthed = await request('GET', '/items');
    assert(resItemsAuthed.status === 200 && resItemsAuthed.body.includes('Data Barang'), 'GET /items berhasil diakses setelah login');

    // 4. Uji Dashboard API
    console.log('\n4. Pengujian Dashboard API:');
    const resStats = await request('GET', '/api/dashboard/stats');
    assert(resStats.status === 200, 'GET /api/dashboard/stats status 200');
    assert(typeof resStats.json.totalItems === 'number', `Total jenis barang: ${resStats.json.totalItems}`);
    assert(typeof resStats.json.totalStok === 'number', `Total stok saat ini: ${resStats.json.totalStok}`);

    const resChart = await request('GET', '/api/dashboard/chart');
    assert(resChart.status === 200 && Array.isArray(resChart.json.labels) && resChart.json.labels.length === 30, 'Grafik memuat data 30 hari');

    const resRecent = await request('GET', '/api/dashboard/recent-transactions');
    assert(resRecent.status === 200 && Array.isArray(resRecent.json), `Transaksi terbaru dimuat (${resRecent.json.length} data)`);

    const resLowStock = await request('GET', '/api/dashboard/low-stock');
    assert(resLowStock.status === 200 && Array.isArray(resLowStock.json), `Daftar barang stok menipis dimuat (${resLowStock.json.length} data)`);

    // 5. Uji CRUD Data Barang
    console.log('\n5. Pengujian CRUD Data Barang:');
    const uniqueName = 'Barang Test ' + Date.now();
    const resAddItem = await request('POST', '/api/items', {
      nama: uniqueName,
      kategori: 'Uji Coba',
      stok_minimum: 10
    });
    assert(resAddItem.status === 201 && resAddItem.json.success === true, `Tambah barang '${uniqueName}' berhasil`);
    const newId = resAddItem.json.id;

    // Coba tambah duplikat
    const resDupItem = await request('POST', '/api/items', {
      nama: uniqueName,
      kategori: 'Uji Coba',
      stok_minimum: 5
    });
    assert(resDupItem.status === 400, 'Cegah duplikasi nama barang berfungsi (status 400)');

    // Edit barang
    const resEditItem = await request('PUT', `/api/items/${newId}`, {
      nama: uniqueName + ' Edit',
      kategori: 'Uji Coba Edit',
      stok_minimum: 15
    });
    assert(resEditItem.status === 200 && resEditItem.json.success === true, 'Edit barang berhasil');

    // Cek get item
    const resGetItem = await request('GET', `/api/items/${newId}`);
    assert(resGetItem.status === 200 && resGetItem.json.nama === uniqueName + ' Edit', 'Get item detail sesuai setelah diedit');

    // 6. Uji Transaksi & Validasi Stok
    console.log('\n6. Pengujian Transaksi (Barang Masuk, Keluar & Validasi Stok):');
    const today = new Date().toISOString().split('T')[0];

    // Transaksi Masuk
    const resTxMasuk = await request('POST', '/api/transactions', {
      item_id: newId,
      jenis: 'masuk',
      jumlah: 50,
      tanggal: today,
      keterangan: 'Stok masuk awal uji'
    });
    assert(resTxMasuk.status === 201 && resTxMasuk.json.success === true, 'Catat transaksi MASUK 50 unit berhasil');
    const txMasukId = resTxMasuk.json.id;

    // Cek stok terhitung dinamis
    let checkItem = await request('GET', `/api/items/${newId}`);
    assert(checkItem.json.stok_akhir === 50 && checkItem.json.total_masuk === 50, 'Stok akhir terhitung otomatis 50');

    // Coba transaksi Keluar melebihi stok (misal minta 60 padahal ada 50)
    const resTxOver = await request('POST', '/api/transactions', {
      item_id: newId,
      jenis: 'keluar',
      jumlah: 60,
      tanggal: today,
      keterangan: 'Coba kurangi melebihi stok'
    });
    assert(resTxOver.status === 400 && resTxOver.json.error.includes('Stok tidak mencukupi'), 'Validasi pencegahan transaksi keluar melebihi stok berhasil ditolak (status 400)');

    // Transaksi Keluar yang valid (misal 20)
    const resTxKeluar = await request('POST', '/api/transactions', {
      item_id: newId,
      jenis: 'keluar',
      jumlah: 20,
      tanggal: today,
      keterangan: 'Pemakaian 20 unit'
    });
    assert(resTxKeluar.status === 201 && resTxKeluar.json.success === true, 'Catat transaksi KELUAR 20 unit valid berhasil');
    const txKeluarId = resTxKeluar.json.id;

    // Verifikasi stok terhitung ulang: 50 - 20 = 30
    checkItem = await request('GET', `/api/items/${newId}`);
    assert(checkItem.json.stok_akhir === 30 && checkItem.json.total_keluar === 20, 'Stok akhir terhitung ulang dinamis: 30 (50 masuk - 20 keluar)');

    // Hapus transaksi keluar -> stok harus kembali jadi 50
    const resDelTx = await request('DELETE', `/api/transactions/${txKeluarId}`);
    assert(resDelTx.status === 200, 'Hapus transaksi keluar berhasil');

    checkItem = await request('GET', `/api/items/${newId}`);
    assert(checkItem.json.stok_akhir === 50, 'Stok otomatis terhitung ulang kembali ke 50 setelah transaksi keluar dihapus');

    // Hapus item uji
    const resDelItem = await request('DELETE', `/api/items/${newId}`);
    assert(resDelItem.status === 200, 'Hapus barang uji berhasil');

    // 7. Uji Laporan & Export CSV
    console.log('\n7. Pengujian Laporan & Export CSV:');
    const resReport = await request('GET', `/api/reports/summary?dateFrom=${today}&dateTo=${today}`);
    assert(resReport.status === 200 && Array.isArray(resReport.json), 'GET /api/reports/summary menghasilkan array rekap');

    const resCsv = await request('GET', `/api/reports/export-csv?dateFrom=${today}&dateTo=${today}`);
    assert(resCsv.status === 200, 'GET /api/reports/export-csv status 200');
    assert(resCsv.headers['content-type'].includes('text/csv'), 'Header Content-Type adalah text/csv');
    assert(resCsv.body.includes('Nama Barang,Kategori,Batas Minimum,Total Masuk,Total Keluar,Stok Akhir'), 'Header CSV kolom sesuai');

    // 8. Uji Logout
    console.log('\n8. Pengujian Logout:');
    const resLogout = await request('POST', '/api/auth/logout');
    assert(resLogout.status === 200 && resLogout.json.success === true, 'Logout berhasil');

    const resMeAfterLogout = await request('GET', '/api/auth/me');
    assert(resMeAfterLogout.status === 200 && resMeAfterLogout.json.loggedIn === false, 'Setelah logout, loggedIn === false');

    const resHomeAfterLogout = await request('GET', '/');
    assert(resHomeAfterLogout.status === 302 && resHomeAfterLogout.headers.location === '/login', 'Setelah logout, akses / redirect ke /login');

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`HASIL AKHIR: ${passed} PASS, ${failed} FAIL`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
