/**
 * public/js/items.js
 * Logic halaman Data Barang: list, tambah, edit, hapus, search, filter, sort, pagination
 */

let currentPage = 1;
let currentSort = 'nama';
let currentOrder = 'asc';
let searchTimer = null;
let currentItemsList = [];
const LIMIT = 10;

// Load dan render tabel barang
async function loadItems() {
  const search = document.getElementById('search-input').value.trim();
  const kategori = document.getElementById('filter-kategori').value;
  const tbody = document.getElementById('items-tbody');

  tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding:40px;color:var(--text-muted);">⏳ Memuat...</td></tr>`;

  try {
    const params = new URLSearchParams({
      search, kategori,
      sort: currentSort, order: currentOrder,
      page: currentPage, limit: LIMIT
    });
    const result = await api.get(`/api/items?${params}`);
    currentItemsList = result.data || [];
    renderTable(currentItemsList);
    renderPagination(result.pagination);
    document.getElementById('item-count').textContent = formatNumber(result.pagination.total);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding:40px;color:var(--danger);">Gagal memuat data: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// Render baris tabel
function renderTable(items) {
  const tbody = document.getElementById('items-tbody');
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>Tidak Ada Barang</h3>
          <p>Klik "Tambah Barang" untuk menambahkan barang baru</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const stok = item.stok_akhir;
    const min = item.stok_minimum;
    let statusClass, statusText;
    if (stok <= 0) { statusClass = 'stok-habis'; statusText = '🔴 Habis'; }
    else if (stok <= min) { statusClass = 'stok-menipis'; statusText = '🟡 Menipis'; }
    else { statusClass = 'stok-aman'; statusText = '🟢 Aman'; }

    return `
      <tr>
        <td><strong>${escapeHtml(item.nama)}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(item.kategori)}</span></td>
        <td><span style="color:var(--success);font-weight:600;">+${formatNumber(item.total_masuk)}</span></td>
        <td><span style="color:var(--danger);font-weight:600;">-${formatNumber(item.total_keluar)}</span></td>
        <td><strong style="font-size:15px;">${formatNumber(stok)}</strong></td>
        <td>${formatDate(item.last_masuk)}</td>
        <td>${formatDate(item.last_keluar)}</td>
        <td>${formatNumber(min)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm btn-icon" title="Edit" onclick="openEditModal(${item.id})">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" title="Hapus" onclick="confirmDeleteItem(${item.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// Render pagination
function renderPagination(pagination) {
  const { page, totalPages, total, limit } = pagination;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  document.getElementById('pagination-info').textContent = `Menampilkan ${start}-${end} dari ${formatNumber(total)} barang`;

  const btns = document.getElementById('pagination-btns');
  let html = `<button class="page-btn" onclick="goPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>`;

  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, page + 2);
  if (startPage > 1) html += `<button class="page-btn" onclick="goPage(1)">1</button>${startPage > 2 ? '<span style="padding:0 4px;color:var(--text-muted)">...</span>' : ''}`;
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  if (endPage < totalPages) html += `${endPage < totalPages - 1 ? '<span style="padding:0 4px;color:var(--text-muted)">...</span>' : ''}<button class="page-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;
  html += `<button class="page-btn" onclick="goPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>›</button>`;

  btns.innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  loadItems();
}

// Load kategori untuk filter dan datalist
async function loadCategories() {
  try {
    const cats = await api.get('/api/items/categories');
    const select = document.getElementById('filter-kategori');
    const datalist = document.getElementById('kategori-list');
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      select.appendChild(opt.cloneNode(true));
      datalist.appendChild(opt);
    });
  } catch(e) {}
}

// === Modal Tambah/Edit ===
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Tambah Barang Baru';
  document.getElementById('item-id').value = '';
  document.getElementById('item-nama').value = '';
  document.getElementById('item-kategori').value = '';
  document.getElementById('item-stok-min').value = '0';
  document.getElementById('modal-submit-btn').textContent = 'Tambah';
  document.getElementById('item-modal').classList.add('active');
  document.getElementById('item-nama').focus();
}

async function openEditModal(id) {
  try {
    const item = await api.get(`/api/items/${id}`);
    document.getElementById('modal-title').textContent = 'Edit Barang';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-nama').value = item.nama;
    document.getElementById('item-kategori').value = item.kategori;
    document.getElementById('item-stok-min').value = item.stok_minimum;
    document.getElementById('modal-submit-btn').textContent = 'Simpan Perubahan';
    document.getElementById('item-modal').classList.add('active');
    document.getElementById('item-nama').focus();
  } catch(e) {
    showToast(e.message, 'error', 'Gagal');
  }
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('active');
}

// Submit form tambah/edit
async function submitItem() {
  const id = document.getElementById('item-id').value;
  const nama = document.getElementById('item-nama').value.trim();
  const kategori = document.getElementById('item-kategori').value.trim();
  const stok_minimum = parseInt(document.getElementById('item-stok-min').value) || 0;
  const btn = document.getElementById('modal-submit-btn');

  if (!nama) { showToast('Nama barang wajib diisi.', 'error', 'Validasi'); return; }
  if (!kategori) { showToast('Kategori wajib diisi.', 'error', 'Validasi'); return; }
  if (stok_minimum < 0) { showToast('Batas minimum tidak boleh negatif.', 'error', 'Validasi'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    if (id) {
      await api.put(`/api/items/${id}`, { nama, kategori, stok_minimum });
      showToast('Barang berhasil diperbarui.', 'success', 'Berhasil');
    } else {
      await api.post('/api/items', { nama, kategori, stok_minimum });
      showToast('Barang berhasil ditambahkan.', 'success', 'Berhasil');
    }
    closeModal();
    loadItems();
    loadCategories(); // Refresh kategori dropdown
  } catch(e) {
    showToast(e.message, 'error', 'Gagal');
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Simpan Perubahan' : 'Tambah';
  }
}

// Hapus barang
function confirmDeleteItem(id) {
  const item = currentItemsList.find(i => i.id === id);
  const nama = item ? item.nama : 'barang ini';
  showConfirm({
    title: 'Hapus Barang',
    message: `Apakah Anda yakin ingin menghapus "${nama}"? Semua transaksi terkait juga akan ikut dihapus.`,
    icon: '🗑️',
    onConfirm: async () => {
      try {
        await api.delete(`/api/items/${id}`);
        showToast('Barang berhasil dihapus.', 'success', 'Berhasil');
        loadItems();
      } catch(e) {
        showToast(e.message, 'error', 'Gagal Hapus');
      }
    }
  });
}

// === Event Listeners ===
function setupEventListeners() {
  // Search dengan debounce
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; loadItems(); }, 400);
  });

  // Filter kategori
  document.getElementById('filter-kategori').addEventListener('change', () => {
    currentPage = 1;
    loadItems();
  });

  // Sorting kolom
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortCol = th.dataset.sort;
      if (currentSort === sortCol) {
        currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = sortCol;
        currentOrder = 'asc';
      }
      currentPage = 1;
      // Update header visual
      document.querySelectorAll('th.sortable').forEach(h => {
        const base = h.textContent.replace(/ [↕↑↓]$/, '');
        h.textContent = base + ' ↕';
      });
      const arrow = currentOrder === 'asc' ? ' ↑' : ' ↓';
      th.textContent = th.textContent.replace(/ [↕↑↓]$/, '') + arrow;
      loadItems();
    });
  });

  // Tutup modal saat klik overlay
  document.getElementById('item-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Tutup modal dengan Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// Inisialisasi
async function init() {
  const user = await checkAuth();
  if (!user) return;
  setupSidebar();
  setupEventListeners();
  await Promise.all([loadItems(), loadCategories()]);
}

document.addEventListener('DOMContentLoaded', init);
