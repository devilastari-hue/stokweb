/**
 * src/middleware/rateLimiter.js
 * Rate limiter sederhana untuk endpoint login
 * Mencegah brute-force attack dengan membatasi percobaan login
 */

// Map: IP -> { count, resetTime }
const loginAttempts = new Map();

const MAX_ATTEMPTS = 10;          // Maks percobaan
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  const record = loginAttempts.get(ip);

  if (!record || now > record.resetTime) {
    // Reset atau buat record baru
    loginAttempts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_ATTEMPTS) {
    const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
    return res.status(429).json({
      error: `Terlalu banyak percobaan login. Coba lagi dalam ${waitSeconds} detik.`
    });
  }

  record.count += 1;
  next();
}

// Hapus record saat login berhasil
function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Bersihkan map setiap jam agar tidak memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (now > record.resetTime) {
      loginAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);

module.exports = { loginRateLimiter, clearLoginAttempts };
