/**
 * src/middleware/auth.js
 * Middleware untuk memproteksi route API - wajib login
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // Kembalikan 401 untuk API, redirect untuk halaman
  return res.status(401).json({ error: 'Tidak terautentikasi. Silakan login.' });
}

module.exports = { requireAuth };
