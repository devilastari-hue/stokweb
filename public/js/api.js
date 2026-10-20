/**
 * public/js/api.js
 * Helper untuk komunikasi dengan API backend
 * Termasuk penanganan error terpusat dan toast notification
 */

// === Toast Notification System ===
(function() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);

  const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  window.showToast = function(message, type = 'success', title = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
        <div class="toast-msg">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };
})();

// === Konfirmasi Dialog ===
function showConfirm({ title = 'Konfirmasi', message, icon = '🗑️', onConfirm }) {
  const existing = document.getElementById('confirm-overlay');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'confirm-overlay';
  el.className = 'confirm-overlay active';
  el.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">${icon}</div>
      <div class="confirm-title">${escapeHtml(title)}</div>
      <div class="confirm-msg">${escapeHtml(message)}</div>
      <div class="confirm-btns">
        <button class="btn btn-outline" id="confirm-cancel">Batal</button>
        <button class="btn btn-danger" id="confirm-ok">Ya, Hapus</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const close = () => el.remove();
  el.querySelector('#confirm-cancel').onclick = close;
  el.querySelector('#confirm-ok').onclick = () => { close(); onConfirm(); };
  el.onclick = (e) => { if (e.target === el) close(); };
}

// === API Helper ===
async function apiRequest(method, url, data = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };
  if (data !== null) opts.body = JSON.stringify(data);

  const res = await fetch(url, opts);

  // Redirect ke login jika tidak terautentikasi
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Tidak terautentikasi');
  }

  let json;
  try { json = await res.json(); } catch(e) { json = {}; }

  if (!res.ok) {
    throw new Error(json.error || `Error ${res.status}`);
  }
  return json;
}

const api = {
  get: (url) => apiRequest('GET', url),
  post: (url, data) => apiRequest('POST', url, data),
  put: (url, data) => apiRequest('PUT', url, data),
  delete: (url) => apiRequest('DELETE', url),
};

// === XSS Protection: Escape HTML ===
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// === Format helpers ===
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch { return dateStr; }
}

function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('id-ID');
}

// === Auth check & Username display ===
async function checkAuth() {
  try {
    const me = await api.get('/api/auth/me');
    if (!me.loggedIn) {
      window.location.href = '/login';
      return null;
    }
    // Tampilkan username di semua elemen .username-display
    document.querySelectorAll('.username-display').forEach(el => {
      el.textContent = escapeHtml(me.username);
    });
    document.querySelectorAll('.user-avatar-initial').forEach(el => {
      el.textContent = me.username.charAt(0).toUpperCase();
    });
    return me;
  } catch (e) {
    window.location.href = '/login';
    return null;
  }
}

// === Logout handler ===
async function logout() {
  try {
    await api.post('/api/auth/logout');
    window.location.href = '/login';
  } catch(e) {
    window.location.href = '/login';
  }
}

// === Dark Mode ===
(function initDarkMode() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.querySelectorAll('.dark-toggle').forEach(btn => {
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

// Set initial icon
document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('theme') || 'light';
  document.querySelectorAll('.dark-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
});

// === Sidebar toggle (mobile) ===
function setupSidebar() {
  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggle || !sidebar) return;

  toggle.onclick = () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('active');
  };
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}
