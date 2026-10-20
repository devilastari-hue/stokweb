/**
 * public/js/dashboard.js
 * Logic halaman dashboard: statistik, chart, recent tx, low stock
 */

let stockChart = null;

// Tampilkan tanggal hari ini
function tampilkanTanggal() {
  const el = document.getElementById('tanggal-hari-ini');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// Load statistik kartu
async function loadStats() {
  try {
    const stats = await api.get('/api/dashboard/stats');
    document.getElementById('stat-total-items').textContent = formatNumber(stats.totalItems);
    document.getElementById('stat-total-stok').textContent = formatNumber(stats.totalStok);
    document.getElementById('stat-masuk').textContent = formatNumber(stats.masukBulanIni);
    document.getElementById('stat-keluar').textContent = formatNumber(stats.keluarBulanIni);
    document.getElementById('stat-menipis').textContent = formatNumber(stats.stokMenipis);
  } catch(e) {
    console.error('Gagal load stats:', e);
  }
}

// Load dan render chart
async function loadChart() {
  try {
    const data = await api.get('/api/dashboard/chart');
    const ctx = document.getElementById('stockChart').getContext('2d');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    if (stockChart) stockChart.destroy();

    stockChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Barang Masuk',
            data: data.masuk,
            backgroundColor: 'rgba(79,70,229,0.7)',
            borderColor: '#4f46e5',
            borderWidth: 1,
            borderRadius: 3,
            borderSkipped: false,
          },
          {
            label: 'Barang Keluar',
            data: data.keluar,
            backgroundColor: 'rgba(239,68,68,0.6)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 3,
            borderSkipped: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: textColor, font: { family: 'Inter', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 15 }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } }
          }
        }
      }
    });
  } catch(e) {
    console.error('Gagal load chart:', e);
  }
}

// Load transaksi terbaru
async function loadRecentTransactions() {
  const container = document.getElementById('recent-tx-list');
  try {
    const rows = await api.get('/api/dashboard/recent-transactions');
    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Belum Ada Transaksi</h3>
          <p>Catat transaksi pertama Anda</p>
        </div>`;
      return;
    }

    container.innerHTML = rows.map(tx => {
      const isMasuk = tx.jenis === 'masuk';
      return `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:${isMasuk ? '#dcfce7' : '#fee2e2'}">
            ${isMasuk ? '⬆️' : '⬇️'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(tx.item_nama)}</div>
            <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(tx.keterangan || '-')}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:13px;font-weight:700;color:${isMasuk ? 'var(--success)' : 'var(--danger)'};">
              ${isMasuk ? '+' : '-'}${formatNumber(tx.jumlah)}
            </div>
            <div style="font-size:11px;color:var(--text-muted);">${formatDate(tx.tanggal)}</div>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data</p></div>`;
  }
}

// Load daftar barang stok menipis
async function loadLowStock() {
  const container = document.getElementById('low-stock-list');
  try {
    const rows = await api.get('/api/dashboard/low-stock');
    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <h3>Semua Stok Aman</h3>
          <p>Tidak ada barang yang stoknya menipis saat ini</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
        ${rows.map(item => {
          const isHabis = item.stok_akhir <= 0;
          const badgeClass = isHabis ? 'badge-danger' : 'badge-warning';
          const badgeText = isHabis ? '🔴 Habis' : '🟡 Menipis';
          return `
            <div style="border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px;background:var(--surface-2);">
              <div style="font-size:28px;">${isHabis ? '❌' : '⚠️'}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.nama)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(item.kategori)}</div>
                <div style="font-size:11px;margin-top:4px;">Min: ${formatNumber(item.stok_minimum)}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div class="badge ${badgeClass}" style="margin-bottom:4px;">${badgeText}</div>
                <div style="font-size:18px;font-weight:700;color:${isHabis ? 'var(--danger)' : 'var(--warning)'};">${formatNumber(item.stok_akhir)}</div>
                <div style="font-size:10px;color:var(--text-muted);">stok</div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data</p></div>`;
  }
}

// Inisialisasi semua
async function init() {
  const user = await checkAuth();
  if (!user) return;

  setupSidebar();
  tampilkanTanggal();

  await Promise.all([
    loadStats(),
    loadChart(),
    loadRecentTransactions(),
    loadLowStock(),
  ]);
}

// Re-render chart saat tema berubah
const origToggle = window.toggleDarkMode;
window.toggleDarkMode = function() {
  origToggle();
  setTimeout(loadChart, 100);
};

document.addEventListener('DOMContentLoaded', init);
