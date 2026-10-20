/**
 * src/routes/auth.js
 * Route untuk autentikasi: login, logout, info user
 */

const express = require('express');
const router = express.Router();
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { clearLoginAttempts } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { getDb } = require('../config/database');

// POST /api/auth/login
router.post('/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body;

  // Validasi input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Input tidak valid.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());

  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  // Login berhasil - buat session
  req.session.userId = user.id;
  req.session.username = user.username;

  // Hapus record rate limit untuk IP ini
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  clearLoginAttempts(ip);

  res.json({ success: true, username: user.username });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Gagal logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// GET /api/auth/me - cek status login dan info user
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      loggedIn: true,
      userId: req.session.userId,
      username: req.session.username
    });
  }
  res.json({ loggedIn: false });
});

module.exports = router;
