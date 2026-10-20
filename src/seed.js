/**
 * src/seed.js
 * Script untuk mengisi data contoh realistis
 * Jalankan dengan: npm run seed
 */

require('dotenv').config();
const { initializeDatabase, getDb } = require('./config/database');

initializeDatabase();
const db = getDb();

console.log('🌱 Mulai seeding data contoh...');

// === SEED ITEMS ===
const items = [
  { nama: 'Kertas A4 80gr', kategori: 'Alat Tulis', stok_minimum: 5 },
  { nama: 'Pulpen Pilot G-2', kategori: 'Alat Tulis', stok_minimum: 10 },
  { nama: 'Spidol Whiteboard Hitam', kategori: 'Alat Tulis', stok_minimum: 5 },
  { nama: 'Tinta Printer Hitam', kategori: 'Perlengkapan Kantor', stok_minimum: 2 },
  { nama: 'Tinta Printer Warna', kategori: 'Perlengkapan Kantor', stok_minimum: 2 },
  { nama: 'Staples No. 10', kategori: 'Alat Tulis', stok_minimum: 3 },
  { nama: 'Map Plastik A4', kategori: 'Arsip', stok_minimum: 20 },
  { nama: 'Amplop Coklat Besar', kategori: 'Arsip', stok_minimum: 10 },
  { nama: 'Lakban Bening 48mm', kategori: 'Perlengkapan Kantor', stok_minimum: 5 },
  { nama: 'Gunting Besar', kategori: 'Peralatan', stok_minimum: 2 },
  { nama: 'Penggaris 30cm', kategori: 'Alat Tulis', stok_minimum: 3 },
  { nama: 'Kalkulator Saku', kategori: 'Peralatan', stok_minimum: 2 },
];

// Hapus data lama (kecuali users)
db.exec('DELETE FROM transactions');
db.exec('DELETE FROM items');
db.exec("DELETE FROM sqlite_sequence WHERE name='transactions'");
db.exec("DELETE FROM sqlite_sequence WHERE name='items'");

const insertItem = db.prepare('INSERT INTO items (nama, kategori, stok_minimum) VALUES (?, ?, ?)');
const itemIds = {};
for (const item of items) {
  const result = insertItem.run(item.nama, item.kategori, item.stok_minimum);
  itemIds[item.nama] = result.lastInsertRowid;
}
console.log(`✅ ${items.length} barang berhasil ditambahkan`);

// === SEED TRANSACTIONS ===
// Helper untuk generate tanggal acak dalam N hari terakhir
function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  return d.toISOString().split('T')[0];
}

const insertTx = db.prepare(`
  INSERT INTO transactions (item_id, jenis, jumlah, tanggal, keterangan, created_by)
  VALUES (?, ?, ?, ?, ?, 1)
`);

// Stok barang masuk awal (60 hari lalu)
const stockIn = [
  { item: 'Kertas A4 80gr', jumlah: 50, keterangan: 'Pembelian awal stok' },
  { item: 'Pulpen Pilot G-2', jumlah: 100, keterangan: 'Pembelian awal stok' },
  { item: 'Spidol Whiteboard Hitam', jumlah: 24, keterangan: 'Pembelian awal stok' },
  { item: 'Tinta Printer Hitam', jumlah: 10, keterangan: 'Pembelian awal stok' },
  { item: 'Tinta Printer Warna', jumlah: 8, keterangan: 'Pembelian awal stok' },
  { item: 'Staples No. 10', jumlah: 20, keterangan: 'Pembelian awal stok' },
  { item: 'Map Plastik A4', jumlah: 100, keterangan: 'Pembelian awal stok' },
  { item: 'Amplop Coklat Besar', jumlah: 50, keterangan: 'Pembelian awal stok' },
  { item: 'Lakban Bening 48mm', jumlah: 15, keterangan: 'Pembelian awal stok' },
  { item: 'Gunting Besar', jumlah: 5, keterangan: 'Pembelian awal stok' },
  { item: 'Penggaris 30cm', jumlah: 8, keterangan: 'Pembelian awal stok' },
  { item: 'Kalkulator Saku', jumlah: 4, keterangan: 'Pembelian awal stok' },
];

for (const tx of stockIn) {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  insertTx.run(itemIds[tx.item], 'masuk', tx.jumlah, d.toISOString().split('T')[0], tx.keterangan);
}

// Transaksi 30 hari terakhir (acak, campuran masuk & keluar)
const recentTx = [
  { item: 'Kertas A4 80gr', jenis: 'keluar', jumlah: 5, keterangan: 'Pemakaian divisi HRD' },
  { item: 'Kertas A4 80gr', jenis: 'keluar', jumlah: 3, keterangan: 'Pemakaian divisi Keuangan' },
  { item: 'Kertas A4 80gr', jenis: 'masuk', jumlah: 20, keterangan: 'Pembelian restok' },
  { item: 'Kertas A4 80gr', jenis: 'keluar', jumlah: 8, keterangan: 'Pemakaian meeting' },
  { item: 'Pulpen Pilot G-2', jenis: 'keluar', jumlah: 20, keterangan: 'Distribusi ke semua divisi' },
  { item: 'Pulpen Pilot G-2', jenis: 'keluar', jumlah: 15, keterangan: 'Tambahan stok divisi Sales' },
  { item: 'Pulpen Pilot G-2', jenis: 'masuk', jumlah: 50, keterangan: 'Pembelian restok bulanan' },
  { item: 'Spidol Whiteboard Hitam', jenis: 'keluar', jumlah: 12, keterangan: 'Distribusi ke ruang meeting' },
  { item: 'Spidol Whiteboard Hitam', jenis: 'masuk', jumlah: 12, keterangan: 'Pembelian restok' },
  { item: 'Tinta Printer Hitam', jenis: 'keluar', jumlah: 3, keterangan: 'Pengisian printer lobby' },
  { item: 'Tinta Printer Hitam', jenis: 'keluar', jumlah: 4, keterangan: 'Pengisian printer lantai 2' },
  { item: 'Tinta Printer Warna', jenis: 'keluar', jumlah: 3, keterangan: 'Pengisian printer marketing' },
  { item: 'Tinta Printer Warna', jenis: 'keluar', jumlah: 3, keterangan: 'Pengisian printer direktur' },
  { item: 'Staples No. 10', jenis: 'keluar', jumlah: 8, keterangan: 'Distribusi ke divisi Keuangan' },
  { item: 'Staples No. 10', jenis: 'keluar', jumlah: 5, keterangan: 'Pemakaian divisi HRD' },
  { item: 'Map Plastik A4', jenis: 'keluar', jumlah: 30, keterangan: 'Arsip dokumen keuangan Q3' },
  { item: 'Map Plastik A4', jenis: 'keluar', jumlah: 25, keterangan: 'Arsip kontrak baru' },
  { item: 'Map Plastik A4', jenis: 'masuk', jumlah: 50, keterangan: 'Pembelian tambahan' },
  { item: 'Amplop Coklat Besar', jenis: 'keluar', jumlah: 15, keterangan: 'Pengiriman dokumen klien' },
  { item: 'Amplop Coklat Besar', jenis: 'keluar', jumlah: 20, keterangan: 'Pengiriman laporan bulanan' },
  { item: 'Lakban Bening 48mm', jenis: 'keluar', jumlah: 5, keterangan: 'Pemakaian gudang' },
  { item: 'Lakban Bening 48mm', jenis: 'keluar', jumlah: 3, keterangan: 'Pemakaian pengiriman barang' },
  { item: 'Gunting Besar', jenis: 'keluar', jumlah: 1, keterangan: 'Rusak - penggantian' },
  { item: 'Kalkulator Saku', jenis: 'keluar', jumlah: 2, keterangan: 'Distribusi ke divisi Keuangan' },
];

for (const tx of recentTx) {
  insertTx.run(itemIds[tx.item], tx.jenis, tx.jumlah, randomDate(30), tx.keterangan);
}

console.log(`✅ ${recentTx.length + stockIn.length} transaksi berhasil ditambahkan`);
console.log('');
console.log('✨ Seeding selesai! Buka http://localhost:' + (process.env.PORT || 3000) + ' dan login.');
console.log('   Username:', process.env.ADMIN_USERNAME);
console.log('   Password: (lihat ADMIN_PASSWORD di file .env)');
