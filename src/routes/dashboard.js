/**
 * src/routes/dashboard.js
 * API untuk data dashboard: statistik, grafik, transaksi terbaru, barang menipis
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../config/database');

// GET /api/dashboard/stats - kartu statistik
router.get('/stats', requireAuth, (req, res) => {
  const db = getDb();

  // Total jenis barang
  const totalItems = db.prepare('SELECT COUNT(*) as total FROM items').get().total;

  // Total stok saat ini (semua barang)
  const totalStok = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN jumlah ELSE -jumlah END), 0) as total
    FROM transactions
  `).get().total;

  // Bulan ini
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const masukBulanIni = db.prepare(`
    SELECT COALESCE(SUM(jumlah), 0) as total
    FROM transactions
    WHERE jenis = 'masuk' AND tanggal >= ?
  `).get(startOfMonth).total;

  const keluarBulanIni = db.prepare(`
    SELECT COALESCE(SUM(jumlah), 0) as total
    FROM transactions
    WHERE jenis = 'keluar' AND tanggal >= ?
  `).get(startOfMonth).total;

  // Barang stok menipis (stok <= stok_minimum)
  const stokMenipis = db.prepare(`
    SELECT COUNT(*) as total FROM (
      SELECT i.id,
        COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE -t.jumlah END), 0) as stok_akhir,
        i.stok_minimum
      FROM items i
      LEFT JOIN transactions t ON t.item_id = i.id
      GROUP BY i.id
      HAVING stok_akhir <= i.stok_minimum
    )
  `).get().total;

  res.json({ totalItems, totalStok, masukBulanIni, keluarBulanIni, stokMenipis });
});

// GET /api/dashboard/chart - data grafik 30 hari terakhir
router.get('/chart', requireAuth, (req, res) => {
  const db = getDb();

  // Generate 30 hari terakhir
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const masukData = db.prepare(`
    SELECT tanggal, SUM(jumlah) as total
    FROM transactions
    WHERE jenis = 'masuk' AND tanggal >= ?
    GROUP BY tanggal
    ORDER BY tanggal
  `).all(days[0]);

  const keluarData = db.prepare(`
    SELECT tanggal, SUM(jumlah) as total
    FROM transactions
    WHERE jenis = 'keluar' AND tanggal >= ?
    GROUP BY tanggal
    ORDER BY tanggal
  `).all(days[0]);

  // Buat map untuk lookup cepat
  const masukMap = {};
  masukData.forEach(r => { masukMap[r.tanggal] = r.total; });
  const keluarMap = {};
  keluarData.forEach(r => { keluarMap[r.tanggal] = r.total; });

  const labels = days.map(d => {
    const [year, month, day] = d.split('-');
    return `${day}/${month}`;
  });
  const masuk = days.map(d => masukMap[d] || 0);
  const keluar = days.map(d => keluarMap[d] || 0);

  res.json({ labels, masuk, keluar });
});

// GET /api/dashboard/recent-transactions - 5 transaksi terbaru
router.get('/recent-transactions', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.id, t.jenis, t.jumlah, t.tanggal, t.keterangan,
           i.nama as item_nama, i.kategori
    FROM transactions t
    JOIN items i ON t.item_id = i.id
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 5
  `).all();
  res.json(rows);
});

// GET /api/dashboard/low-stock - barang stok menipis
router.get('/low-stock', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.id, i.nama, i.kategori, i.stok_minimum,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE -t.jumlah END), 0) as stok_akhir
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    GROUP BY i.id
    HAVING stok_akhir <= i.stok_minimum
    ORDER BY stok_akhir ASC
    LIMIT 10
  `).all();
  res.json(rows);
});

module.exports = router;
