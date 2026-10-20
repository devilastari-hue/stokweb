/**
 * src/routes/items.js
 * CRUD barang: tambah, edit, hapus, list dengan search/filter/sort/pagination
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../config/database');

// GET /api/items - list barang dengan search, filter, sort, pagination
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const {
    search = '',
    kategori = '',
    sort = 'nama',
    order = 'asc',
    page = 1,
    limit = 10
  } = req.query;

  const validSortCols = ['nama', 'kategori', 'stok_minimum', 'stok_akhir', 'total_masuk', 'total_keluar', 'created_at'];
  const validOrders = ['asc', 'desc'];
  const sortCol = validSortCols.includes(sort) ? sort : 'nama';
  const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  // Base query dengan agregasi stok
  const baseQuery = `
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    WHERE i.nama LIKE ? ${kategori ? 'AND i.kategori = ?' : ''}
    GROUP BY i.id
  `;

  const params = [`%${search}%`];
  if (kategori) params.push(kategori);

  // Query untuk total count
  const countQuery = `SELECT COUNT(*) as total FROM (SELECT i.id ${baseQuery})`;
  const totalItems = db.prepare(countQuery).get(...params).total;

  // Query utama dengan kalkulasi stok
  const dataQuery = `
    SELECT i.id, i.nama, i.kategori, i.stok_minimum, i.created_at,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE 0 END), 0) as total_masuk,
      COALESCE(SUM(CASE WHEN t.jenis='keluar' THEN t.jumlah ELSE 0 END), 0) as total_keluar,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE -t.jumlah END), 0) as stok_akhir,
      MAX(CASE WHEN t.jenis='masuk' THEN t.tanggal ELSE NULL END) as last_masuk,
      MAX(CASE WHEN t.jenis='keluar' THEN t.tanggal ELSE NULL END) as last_keluar
    ${baseQuery}
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(dataQuery).all(...params, limitNum, offset);
  const totalPages = Math.ceil(totalItems / limitNum);

  res.json({
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total: totalItems, totalPages }
  });
});

// GET /api/items/categories - list kategori unik
router.get('/categories', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT kategori FROM items ORDER BY kategori').all();
  res.json(rows.map(r => r.kategori));
});

// GET /api/items/:id
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const item = db.prepare(`
    SELECT i.*,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE 0 END), 0) as total_masuk,
      COALESCE(SUM(CASE WHEN t.jenis='keluar' THEN t.jumlah ELSE 0 END), 0) as total_keluar,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE -t.jumlah END), 0) as stok_akhir,
      MAX(CASE WHEN t.jenis='masuk' THEN t.tanggal ELSE NULL END) as last_masuk,
      MAX(CASE WHEN t.jenis='keluar' THEN t.tanggal ELSE NULL END) as last_keluar
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    WHERE i.id = ?
    GROUP BY i.id
  `).get(req.params.id);

  if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan' });
  res.json(item);
});

// POST /api/items - tambah barang
router.post('/', requireAuth, (req, res) => {
  const { nama, kategori, stok_minimum } = req.body;

  // Validasi input
  if (!nama || typeof nama !== 'string' || nama.trim().length === 0) {
    return res.status(400).json({ error: 'Nama barang wajib diisi.' });
  }
  if (!kategori || typeof kategori !== 'string' || kategori.trim().length === 0) {
    return res.status(400).json({ error: 'Kategori wajib diisi.' });
  }
  const minStock = parseInt(stok_minimum);
  if (isNaN(minStock) || minStock < 0) {
    return res.status(400).json({ error: 'Batas minimum stok harus berupa angka >= 0.' });
  }

  const db = getDb();

  // Cek duplikat nama (case-insensitive)
  const existing = db.prepare('SELECT id FROM items WHERE LOWER(nama) = LOWER(?)').get(nama.trim());
  if (existing) {
    return res.status(400).json({ error: 'Barang dengan nama tersebut sudah ada.' });
  }

  const result = db.prepare(
    'INSERT INTO items (nama, kategori, stok_minimum) VALUES (?, ?, ?)'
  ).run(nama.trim(), kategori.trim(), minStock);

  res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Barang berhasil ditambahkan.' });
});

// PUT /api/items/:id - edit barang
router.put('/:id', requireAuth, (req, res) => {
  const { nama, kategori, stok_minimum } = req.body;
  const id = parseInt(req.params.id);

  if (!nama || typeof nama !== 'string' || nama.trim().length === 0) {
    return res.status(400).json({ error: 'Nama barang wajib diisi.' });
  }
  if (!kategori || typeof kategori !== 'string' || kategori.trim().length === 0) {
    return res.status(400).json({ error: 'Kategori wajib diisi.' });
  }
  const minStock = parseInt(stok_minimum);
  if (isNaN(minStock) || minStock < 0) {
    return res.status(400).json({ error: 'Batas minimum stok harus berupa angka >= 0.' });
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Barang tidak ditemukan.' });

  // Cek duplikat nama (kecuali item ini sendiri)
  const duplicate = db.prepare('SELECT id FROM items WHERE LOWER(nama) = LOWER(?) AND id != ?').get(nama.trim(), id);
  if (duplicate) {
    return res.status(400).json({ error: 'Barang dengan nama tersebut sudah ada.' });
  }

  db.prepare('UPDATE items SET nama = ?, kategori = ?, stok_minimum = ? WHERE id = ?')
    .run(nama.trim(), kategori.trim(), minStock, id);

  res.json({ success: true, message: 'Barang berhasil diperbarui.' });
});

// DELETE /api/items/:id
router.delete('/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const db = getDb();

  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Barang tidak ditemukan.' });

  // Transaksi terhapus otomatis karena ON DELETE CASCADE
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.json({ success: true, message: 'Barang dan semua transaksinya berhasil dihapus.' });
});

module.exports = router;
