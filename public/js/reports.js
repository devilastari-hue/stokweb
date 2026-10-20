/**
 * public/js/reports.js
 * Logic halaman Laporan: filter, rekap per barang, export CSV
 */

let lastFilterParams = null;

// Load laporan
async function loadReport() {
  const tbody = document.getElementById('report-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:40px;color:var(--text-muted);">⏳ Memuat laporan...</td></tr>`;

  const dateFrom = document.getElementById('laporan-dari').value;
  const dateTo = document.getElementById('laporan-sampai').value;
  const kategori = document.getElementById('laporan-kategori').value;

  // Simpan filter untuk export
  lastFilterParams = { dateFrom, dateTo, kategori };

  // Tampilkan info filter
  const infoEl = document.getElementById('filter-info');
  let infoText = 'Menampilkan ';
  if (dateFrom && dateTo) infoText += `periode ${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  else if (dateFrom) infoText += `dari ${formatDate(dateFrom)}`;
  else if (dateTo) infoText += `sampai ${formatDate(dateTo)}`;
  else infoText += 'semua periode';
  if (kategori) infoText += ` | Kategori: ${escapeHtml(kategori)}`;
  infoEl.textContent = infoText;

  try {
    const params = new URLSearchParams({ dateFrom, dateTo, kategori });
    const rows = await api.get(`/api/reports/summary?${params}`);

    renderReportTable(rows);
    document.getElementById('export-btn').disabled = rows.length === 0;
    document.getElementById('report-count').textContent = `${rows.length} barang`;
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:40px;color:var(--danger);">Gagal memuat: ${escapeHtml(e.message)}</td></tr>`;
    document.getElementById('export-btn').disabled = true;
  }
}

function renderReportTable(rows) {
  const tbody = document.getElementById('report-tbody');
  const summary = document.getElementById('report-summary');

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>Tidak Ada Data</h3>
          <p>Tidak ada barang yang cocok dengan filter yang dipilih</p>
        </div>
      </td></tr>`;
    summary.style.display = 'none';
    return;
  }

  let totalMasuk = 0, totalKeluar = 0, totalStok = 0;

  tbody.innerHTML = rows.map(row => {
    totalMasuk += row.total_masuk;
    totalKeluar += row.total_keluar;
    totalStok += row.stok_akhir_global;

    const stok = row.stok_akhir_global;
    const min = row.stok_minimum;
    let statusClass, statusText;
    if (stok <= 0) { statusClass = 'stok-habis'; statusText = '🔴 Habis'; }
    else if (stok <= min) { statusClass = 'stok-menipis'; statusText = '🟡 Menipis'; }
    else { statusClass = 'stok-aman'; statusText = '🟢 Aman'; }

    return `
      <tr>
        <td><strong>${escapeHtml(row.nama)}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(row.kategori)}</span></td>
        <td><span style="color:var(--success);font-weight:600;">+${formatNumber(row.total_masuk)}</span></td>
        <td><span style="color:var(--danger);font-weight:600;">-${formatNumber(row.total_keluar)}</span></td>
        <td><strong style="font-size:15px;">${formatNumber(stok)}</strong></td>
        <td>${formatNumber(min)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
      </tr>`;
  }).join('');

  // Tampilkan summary
  document.getElementById('sum-masuk').textContent = formatNumber(totalMasuk);
  document.getElementById('sum-keluar').textContent = formatNumber(totalKeluar);
  document.getElementById('sum-stok').textContent = formatNumber(totalStok);
  summary.style.display = 'block';
}

// Export CSV
function exportCsv() {
  if (!lastFilterParams) { showToast('Tampilkan laporan terlebih dahulu.', 'warning', 'Info'); return; }
  const { dateFrom, dateTo, kategori } = lastFilterParams;
  const params = new URLSearchParams({ dateFrom, dateTo, kategori });
  window.location.href = `/api/reports/export-csv?${params}`;
  showToast('File CSV sedang diunduh...', 'info', 'Export');
}

// Load kategori untuk filter
async function loadCategories() {
  try {
    const cats = await api.get('/api/reports/categories');
    const select = document.getElementById('laporan-kategori');
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      select.appendChild(opt);
    });
  } catch(e) {}
}

// Event listener Enter pada filter
function setupFilterListeners() {
  ['laporan-dari', 'laporan-sampai', 'laporan-kategori'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {});
  });
}

async function init() {
  const user = await checkAuth();
  if (!user) return;
  setupSidebar();
  setupFilterListeners();
  await loadCategories();

  // Auto-load laporan bulan ini
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];
  document.getElementById('laporan-dari').value = startOfMonth;
  document.getElementById('laporan-sampai').value = today;
  loadReport();
}

document.addEventListener('DOMContentLoaded', init);
