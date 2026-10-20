/**
 * src/routes/reports.js
 * Laporan rekap per barang dengan filter rentang tanggal + export CSV
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../config/database');

// GET /api/reports/summary - rekap per barang untuk rentang tanggal
router.get('/summary', requireAuth, (req, res) => {
  const db = getDb();
  const { dateFrom = '', dateTo = '', kategori = '' } = req.query;

  const conditions = [];
  const txParams = [];
  if (dateFrom) { conditions.push('t.tanggal >= ?'); txParams.push(dateFrom); }
  if (dateTo)   { conditions.push('t.tanggal <= ?'); txParams.push(dateTo); }

  const txWhere = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
  const itemWhere = kategori ? 'WHERE i.kategori = ?' : '';
  const itemParams = kategori ? [kategori] : [];

  const query = `
    SELECT
      i.id, i.nama, i.kategori, i.stok_minimum,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' ${txWhere} THEN t.jumlah ELSE 0 END), 0) as total_masuk,
      COALESCE(SUM(CASE WHEN t.jenis='keluar' ${txWhere} THEN t.jumlah ELSE 0 END), 0) as total_keluar,
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE -t.jumlah END), 0) as stok_akhir_global
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    ${itemWhere}
    GROUP BY i.id
    ORDER BY i.nama ASC
  `;

  // Params: txParams diulang 2x (untuk masuk dan keluar dalam CASE), ditambah itemParams
  const rows = db.prepare(query).all(...txParams, ...txParams, ...itemParams);
  res.json(rows);
});

// GET /api/reports/export-csv - export rekap ke CSV
router.get('/export-csv', requireAuth, (req, res) => {
  const db = getDb();
  const { dateFrom = '', dateTo = '', kategori = '' } = req.query;

  const conditions = [];
  const txParams = [];
  if (dateFrom) { conditions.push('t.tanggal >= ?'); txParams.push(dateFrom); }
  if (dateTo)   { conditions.push('t.tanggal <= ?'); txParams.push(dateTo); }

  const txWhere = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
  const itemWhere = kategori ? 'WHERE i.kategori = ?' : '';
  const itemParams = kategori ? [kategori] : [];

  const query = `
    SELECT
      i.nama as "Nama Barang", i.kategori as "Kategori", i.stok_minimum as "Batas Minimum",
      COALESCE(SUM(CASE WHEN t.jenis='masuk' ${txWhere} THEN t.jumlah ELSE 0 END), 0) as "Total Masuk",
      COALESCE(SUM(CASE WHEN t.jenis='keluar' ${txWhere} THEN t.jumlah ELSE 0 END), 0) as "Total Keluar",
      COALESCE(SUM(CASE WHEN t.jenis='masuk' THEN t.jumlah ELSE -t.jumlah END), 0) as "Stok Akhir"
    FROM items i
    LEFT JOIN transactions t ON t.item_id = i.id
    ${itemWhere}
    GROUP BY i.id
    ORDER BY i.nama ASC
  `;

  const rows = db.prepare(query).all(...txParams, ...txParams, ...itemParams);

  // Build CSV
  const headers = ['Nama Barang', 'Kategori', 'Batas Minimum', 'Total Masuk', 'Total Keluar', 'Stok Akhir'];
  const csvLines = [headers.join(',')];

  rows.forEach(row => {
    const line = [
      `"${String(row['Nama Barang']).replace(/"/g, '""')}"`,
      `"${String(row['Kategori']).replace(/"/g, '""')}"`,
      row['Batas Minimum'],
      row['Total Masuk'],
      row['Total Keluar'],
      row['Stok Akhir']
    ].join(',');
    csvLines.push(line);
  });

  const csv = '\uFEFF' + csvLines.join('\r\n'); // BOM untuk Excel

  const filename = `rekap-stok-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// GET /api/reports/categories
router.get('/categories', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT kategori FROM items ORDER BY kategori').all();
  res.json(rows.map(r => r.kategori));
});

module.exports = router;
