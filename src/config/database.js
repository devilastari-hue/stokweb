/**
 * src/config/database.js
 * Inisialisasi database SQLite dengan node:sqlite (built-in Node.js >= 22.5)
 * Tidak memerlukan kompilasi native / build tools
 */

const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Pastikan direktori data ada
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'stokweb.db');
let db;

/**
 * Mendapatkan instance database (singleton pattern)
 */
function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    // Aktifkan WAL mode dan foreign keys
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

/**
 * Inisialisasi database: buat tabel dan seed admin
 */
function initializeDatabase() {
  const database = getDb();

  // Buat tabel users
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // Buat tabel items (barang)
  database.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kategori TEXT NOT NULL DEFAULT 'Umum',
      stok_minimum INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // Buat tabel transactions
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      jenis TEXT NOT NULL CHECK(jenis IN ('masuk', 'keluar')),
      jumlah INTEGER NOT NULL CHECK(jumlah > 0),
      tanggal TEXT NOT NULL,
      keterangan TEXT DEFAULT '',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Seed akun admin dari environment variable
  seedAdmin(database);

  console.log('✅ Database siap:', DB_PATH);
}

/**
 * Buat akun admin jika belum ada
 */
function seedAdmin(database) {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = database.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    database.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(adminUsername, hash);
    console.log(`✅ Akun admin '${adminUsername}' berhasil dibuat`);
  }
}

module.exports = { getDb, initializeDatabase };
