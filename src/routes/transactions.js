/**
 * src/routes/transactions.js
 * CRUD transaksi: catat masuk/keluar, riwayat dengan filter, hapus
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../config/database');

// GET /api/transactions - riwayat dengan filter
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const {
    dateFrom = '',
    dateTo = '',
    jenis = '',
    itemId = '',
    page = 1,
    limit = 20
  } = req.query;

  const conditions = [];
  const params = [];

  if (dateFrom) { conditions.push('t.tanggal >= ?'); params.push(dateFrom); }
  if (dateTo)   { conditions.push('t.tanggal <= ?'); params.push(dateTo); }
  if (jenis && ['masuk', 'keluar'].includes(jenis)) {
    conditions.push('t.jenis = ?'); params.push(jenis);
  }
  if (itemId) { conditions.push('t.item_id = ?'); params.push(parseInt(itemId)); }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const countQuery = `SELECT COUNT(*) as total FROM transactions t ${whereClause}`;
  const totalItems = db.prepare(countQuery).get(...params).total;

  const dataQuery = `
    SELECT t.id, t.jenis, t.jumlah, t.tanggal, t.keterangan, t.created_at,
           i.id as item_id, i.nama as item_nama, i.kategori,
           u.username as created_by_name
    FROM transactions t
    JOIN items i ON t.item_id = i.id
    LEFT JOIN users u ON t.created_by = u.id
    ${whereClause}
    ORDER BY t.tanggal DESC, t.id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(dataQuery).all(...params, limitNum, offset);
  const totalPages = Math.ceil(totalItems / limitNum);

  res.json({
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total: totalItems, totalPages }
  });
});

// POST /api/transactions - catat transaksi baru
router.post('/', requireAuth, (req, res) => {
  const { item_id, jenis, jumlah, tanggal, keterangan } = req.body;

  // Validasi input
  if (!item_id) return res.status(400).json({ error: 'Barang wajib dipilih.' });
  if (!jenis || !['masuk', 'keluar'].includes(jenis)) {
    return res.status(400).json({ error: 'Jenis transaksi harus "masuk" atau "keluar".' });
  }
  const qty = parseInt(jumlah);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Jumlah harus berupa angka positif.' });
  }
  if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    return res.status(400).json({ error: 'Format tanggal tidak valid.' });
  }

  const db = getDb();

  // Validasi barang ada
  const item = db.prepare('SELECT id, nama FROM items WHERE id = ?').get(parseInt(item_id));
  if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan.' });

  // Validasi stok untuk transaksi keluar
  if (jenis === 'keluar') {
    const stokSaatIni = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN jumlah ELSE -jumlah END), 0) as stok
      FROM transactions WHERE item_id = ?
    `).get(parseInt(item_id)).stok;

    if (qty > stokSaatIni) {
      return res.status(400).json({
        error: `Stok tidak mencukupi. Stok tersedia: ${stokSaatIni}, diminta: ${qty}.`
      });
    }
  }

  const result = db.prepare(`
    INSERT INTO transactions (item_id, jenis, jumlah, tanggal, keterangan, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(parseInt(item_id), jenis, qty, tanggal, (keterangan || '').trim(), req.session.userId);

  res.status(201).json({
    success: true,
    id: result.lastInsertRowid,
    message: `Transaksi ${jenis} berhasil dicatat.`
  });
});

// DELETE /api/transactions/:id
router.delete('/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const db = getDb();

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });

  // Validasi: jika ini transaksi masuk, pastikan hapusnya tidak membuat stok negatif
  if (tx.jenis === 'masuk') {
    const stokSaatIni = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN jumlah ELSE -jumlah END), 0) as stok
      FROM transactions WHERE item_id = ?
    `).get(tx.item_id).stok;

    const stokSetelahHapus = stokSaatIni - tx.jumlah;
    if (stokSetelahHapus < 0) {
      return res.status(400).json({
        error: `Tidak bisa menghapus transaksi ini. Stok akan menjadi negatif (${stokSetelahHapus}). Hapus transaksi keluar terlebih dahulu.`
      });
    }
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.json({ success: true, message: 'Transaksi berhasil dihapus.' });
});

module.exports = router;
