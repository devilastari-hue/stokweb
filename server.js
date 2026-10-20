/**
 * server.js - Entry point utama aplikasi Rekap Stok Barang
 * Mengatur middleware, session, static files, dan routing
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

// Inisialisasi database (buat tabel jika belum ada, seed admin)
const { initializeDatabase } = require('./src/config/database');
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi session dengan cookie httpOnly
app.use(session({
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,       // Tidak bisa diakses dari JavaScript client
    secure: false,        // Set true jika menggunakan HTTPS
    maxAge: 24 * 60 * 60 * 1000  // 24 jam
  }
}));

// Serve file statis (CSS, JS, gambar, icon) tanpa auto-serve index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Middleware proteksi halaman HTML: jika belum login, redirect ke /login
function requirePageAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
}

// === API Routes ===
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const itemRoutes = require('./src/routes/items');
const transactionRoutes = require('./src/routes/transactions');
const reportRoutes = require('./src/routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

// === Page Routes (dengan redirect auth) ===
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/items', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'items.html'));
});

app.get('/transactions', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'transactions.html'));
});

app.get('/reports', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
  }
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.redirect('/login');
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
  res.status(500).send('Terjadi kesalahan server');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server Rekap Stok Barang berjalan di http://localhost:${PORT}`);
    console.log(`   Admin: ${process.env.ADMIN_USERNAME || 'admin'}`);
  });
}

module.exports = app;
