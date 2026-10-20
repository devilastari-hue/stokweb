/**
 * public/js/transactions.js
 * Logic halaman Transaksi: form catat transaksi + riwayat dengan filter
 */

let txPage = 1;
const TX_LIMIT = 20;
let stokCache = {}; // cache stok per item_id

// Load daftar barang untuk select dropdown
async function loadItemsForSelect() {
  try {
    const result = await api.get('/api/items?limit=1000&sort=nama&order=asc');
    const items = result.data;

    const txSelect = document.getElementById('tx-item');
    const filterSelect = document.getElementById('filter-item');

    const opts = items.map(i => {
      stokCache[i.id] = i.stok_akhir;
      return `<option value="${i.id}">${escapeHtml(i.nama)}</option>`;
    }).join('');

    txSelect.innerHTML = '<option value="">-- Pilih Barang --</option>' + opts;
    filterSelect.innerHTML = '<option value="">Semua Barang</option>' + opts;
  } catch(e) {
    console.error('Gagal load items:', e);
  }
}

// Update info stok saat barang dipilih
async function updateStokInfo() {
  const itemId = document.getElementById('tx-item').value;
  const stokInfo = document.getElementById('stok-info');
  const stokEl = document.getElementById('stok-tersedia');

  if (!itemId) { stokInfo.style.display = 'none'; return; }

  try {
    const item = await api.get(`/api/items/${itemId}`);
    const stok = item.stok_akhir;
    stokCache[itemId] = stok;
    stokEl.textContent = formatNumber(stok);
    stokEl.style.color = stok <= 0 ? 'var(--danger)' : stok <= item.stok_minimum ? 'var(--warning)' : 'var(--success)';
    stokInfo.style.display = 'block';
  } catch(e) {
    stokInfo.style.display = 'none';
  }
}

// Submit transaksi
async function submitTransaction() {
  const item_id = document.getElementById('tx-item').value;
  const jenis = document.getElementById('tx-jenis').value;
  const jumlah = parseInt(document.getElementById('tx-jumlah').value);
  const tanggal = document.getElementById('tx-tanggal').value;
  const keterangan = document.getElementById('tx-keterangan').value.trim();
  const btn = document.getElementById('tx-submit');

  // Validasi client-side
  if (!item_id) { showToast('Pilih barang terlebih dahulu.', 'error', 'Validasi'); return; }
  if (!jumlah || jumlah <= 0) { showToast('Jumlah harus berupa angka positif.', 'error', 'Validasi'); return; }
  if (!tanggal) { showToast('Tanggal wajib diisi.', 'error', 'Validasi'); return; }

  // Validasi stok keluar
  if (jenis === 'keluar') {
    const stok = stokCache[item_id] ?? Infinity;
    if (jumlah > stok) {
      showToast(`Stok tidak mencukupi. Tersedia: ${formatNumber(stok)}, diminta: ${formatNumber(jumlah)}`, 'error', 'Validasi');
      return;
    }
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    await api.post('/api/transactions', { item_id, jenis, jumlah, tanggal, keterangan });
    showToast(`Transaksi ${jenis} berhasil dicatat.`, 'success', 'Berhasil');
    // Reset form (kecuali tanggal dan item)
    document.getElementById('tx-jumlah').value = '';
    document.getElementById('tx-keterangan').value = '';
    // Refresh stok cache dan tabel
    updateStokInfo();
    txPage = 1;
    loadTransactions();
  } catch(e) {
    showToast(e.message, 'error', 'Gagal');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Simpan Transaksi';
  }
}

// Load riwayat transaksi
async function loadTransactions() {
  const tbody = document.getElementById('tx-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:32px;color:var(--text-muted);">⏳ Memuat...</td></tr>`;

  const params = new URLSearchParams({
    dateFrom: document.getElementById('filter-dari').value,
    dateTo: document.getElementById('filter-sampai').value,
    jenis: document.getElementById('filter-jenis').value,
    itemId: document.getElementById('filter-item').value,
    page: txPage,
    limit: TX_LIMIT
  });

  try {
    const result = await api.get(`/api/transactions?${params}`);
    renderTxTable(result.data);
    renderTxPagination(result.pagination);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:32px;color:var(--danger);">Gagal memuat: ${escapeHtml(e.message)}</td></tr>`;
  }
}

let currentTxList = [];

function renderTxTable(rows) {
  currentTxList = rows || [];
  const tbody = document.getElementById('tx-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Tidak Ada Transaksi</h3>
          <p>Belum ada transaksi yang cocok dengan filter</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(tx => {
    const isMasuk = tx.jenis === 'masuk';
    return `
      <tr>
        <td style="white-space:nowrap;">${formatDate(tx.tanggal)}</td>
        <td><strong>${escapeHtml(tx.item_nama)}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(tx.kategori)}</span></td>
        <td>
          <span class="badge ${isMasuk ? 'badge-success' : 'badge-danger'}">
            ${isMasuk ? '⬆️ Masuk' : '⬇️ Keluar'}
          </span>
        </td>
        <td style="font-weight:700;color:${isMasuk ? 'var(--success)' : 'var(--danger)'};">
          ${isMasuk ? '+' : '-'}${formatNumber(tx.jumlah)}
        </td>
        <td style="font-size:12px;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(tx.keterangan)}">
          ${escapeHtml(tx.keterangan || '-')}
        </td>
        <td>
          <button class="btn btn-danger btn-sm btn-icon" title="Hapus" onclick="confirmDeleteTx(${tx.id})">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

function renderTxPagination(pagination) {
  const { page, totalPages, total, limit } = pagination;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  document.getElementById('tx-pagination-info').textContent = `${start}-${end} dari ${formatNumber(total)} transaksi`;

  const btns = document.getElementById('tx-pagination-btns');
  let html = `<button class="page-btn" onclick="txGoPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>`;
  const start2 = Math.max(1, page - 2);
  const end2 = Math.min(totalPages, page + 2);
  if (start2 > 1) html += `<button class="page-btn" onclick="txGoPage(1)">1</button>${start2 > 2 ? '<span style="padding:0 4px;color:var(--text-muted)">...</span>' : ''}`;
  for (let i = start2; i <= end2; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="txGoPage(${i})">${i}</button>`;
  }
  if (end2 < totalPages) html += `${end2 < totalPages - 1 ? '<span style="padding:0 4px;color:var(--text-muted)">...</span>' : ''}<button class="page-btn" onclick="txGoPage(${totalPages})">${totalPages}</button>`;
  html += `<button class="page-btn" onclick="txGoPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>›</button>`;
  btns.innerHTML = html;
}

function txGoPage(p) {
  txPage = p;
  loadTransactions();
}

// Hapus transaksi
function confirmDeleteTx(id) {
  const tx = currentTxList.find(t => t.id === id);
  const itemNama = tx ? tx.item_nama : 'transaksi ini';
  const jenis = tx ? tx.jenis : '';
  const jumlah = tx ? tx.jumlah : 0;

  showConfirm({
    title: 'Hapus Transaksi',
    message: `Hapus transaksi ${jenis} "${itemNama}" sebanyak ${formatNumber(jumlah)}? Stok akan dihitung ulang.`,
    icon: '🗑️',
    onConfirm: async () => {
      try {
        await api.delete(`/api/transactions/${id}`);
        showToast('Transaksi berhasil dihapus.', 'success', 'Berhasil');
        loadTransactions();
        // Refresh stok info jika item yang dipilih di form sama
        const selectedItem = document.getElementById('tx-item').value;
        if (selectedItem) updateStokInfo();
      } catch(e) {
        showToast(e.message, 'error', 'Gagal Hapus');
      }
    }
  });
}

function resetFilter() {
  document.getElementById('filter-dari').value = '';
  document.getElementById('filter-sampai').value = '';
  document.getElementById('filter-jenis').value = '';
  document.getElementById('filter-item').value = '';
  txPage = 1;
  loadTransactions();
}

// Setup event listeners filter
function setupFilterListeners() {
  ['filter-dari', 'filter-sampai', 'filter-jenis', 'filter-item'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      txPage = 1;
      loadTransactions();
    });
  });
}

// Set tanggal default ke hari ini
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('tx-tanggal').value = today;
}

async function init() {
  const user = await checkAuth();
  if (!user) return;
  setupSidebar();
  setDefaultDate();
  setupFilterListeners();
  await loadItemsForSelect();
  loadTransactions();
}

document.addEventListener('DOMContentLoaded', init);
