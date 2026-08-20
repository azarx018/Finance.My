/* ================================================
   AZAR FINANCE — js/features/transaction.js
   Add/edit-transaction bottom sheet, receipt-photo capture,
   and the transaction list-item HTML renderer used by
   Dashboard/Riwayat/Kalender.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP, getCatList } from '../core/state.js';
import { $, $$, escapeHtml, formatRp, formatDate, parseAmt, genId, todayStr, showToast } from '../core/utils.js';
import { persist } from '../core/db.js';
import { openSheet, closeSheet } from '../ui/sheets.js';
import { refreshCurrentPage } from '../ui/nav.js';
import { buildWalletPillRow } from './wallet.js';
import { getCat } from './analytics.js';

// ===================== ADD/EDIT TX SHEET =====================
export function openTxSheet(editId=null) {
  APP.editingTxId = editId;
  const tx   = editId ? APP.transactions.find(t=>t.id===editId) : null;
  const type = tx?.type || APP.selectedType || 'income';
  $('#addtx-title').textContent = editId ? '✏️ Edit Transaksi' : '➕ Catat Transaksi';
  setTxType(type);
  $('#tx-amount').value = tx ? tx.amount.toLocaleString('id-ID') : '';
  $('#tx-desc').value   = tx?.desc   || '';
  $('#tx-date').value   = tx?.date   || todayStr();
  $('#tx-note').value   = tx?.note   || '';
  APP.txPhoto          = tx?.photo  || null;
  APP.selectedCatId    = tx?.catId  || (type==='income'?'other_inc':'other_exp');
  APP.selectedWalletId = tx?.walletId || APP.wallets[0]?.id || 'default';
  buildCatScroll(type);
  buildWalletPillRow('wallet-select-row', APP.selectedWalletId, id => APP.selectedWalletId = id);
  updatePhotoPreview();
  $('#tx-cancel-edit').style.display = editId ? '' : 'none';
  openSheet('addtx');
  setTimeout(() => $('#tx-amount').focus(), 300);
}

export function setTxType(type) {
  APP.selectedType = type;
  $('#type-income').classList.toggle('active', type==='income');
  $('#type-expense').classList.toggle('active', type==='expense');
  const isExp = type==='expense';
  $('#tx-submit-btn').classList.toggle('expense-mode', isExp);
  const act = APP.editingTxId ? 'Update' : 'Simpan';
  $('#tx-submit-label').textContent = `${act} ${isExp?'Pengeluaran':'Pemasukan'}`;
  APP.selectedCatId = type==='income' ? 'other_inc' : 'other_exp';
  buildCatScroll(type);
}

export function buildCatScroll(type) {
  const cats = getCatList(type);
  $('#cat-scroll').innerHTML = cats.map(c =>
    `<div class="cat-pill${c.id===APP.selectedCatId?' selected'+(type==='expense'?' expense-cat':''):''}" data-cat="${c.id}">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-label">${escapeHtml(c.name)}</div>
    </div>`).join('');
  $$('#cat-scroll .cat-pill').forEach(p => {
    p.addEventListener('click', () => {
      APP.selectedCatId = p.dataset.cat;
      $$('#cat-scroll .cat-pill').forEach(x => x.classList.remove('selected','expense-cat'));
      p.classList.add('selected');
      if (APP.selectedType==='expense') p.classList.add('expense-cat');
    });
  });
}

export function submitTx() {
  const amount = parseAmt($('#tx-amount').value);
  const desc   = $('#tx-desc').value.trim();
  const date   = $('#tx-date').value;
  const note   = $('#tx-note').value.trim();
  const type   = APP.selectedType;
  if (!amount || amount<=0) { showToast('⚠️ Nominal tidak boleh kosong','error'); return; }
  if (!desc)                { showToast('⚠️ Deskripsi tidak boleh kosong','error'); return; }
  if (!date)                { showToast('⚠️ Tanggal tidak boleh kosong','error'); return; }
  const obj = {id:genId(),type,amount,desc,date,walletId:APP.selectedWalletId,catId:APP.selectedCatId,note,photo:APP.txPhoto};
  if (APP.editingTxId) {
    const idx = APP.transactions.findIndex(t=>t.id===APP.editingTxId);
    if (idx!==-1) APP.transactions[idx] = {...APP.transactions[idx], ...obj, id:APP.editingTxId};
    showToast('✅ Transaksi diperbarui');
  } else {
    APP.transactions.push(obj);
    showToast(type==='income' ? '✅ Pemasukan dicatat' : '✅ Pengeluaran dicatat');
  }
  persist(); closeSheet('addtx'); APP.editingTxId=null; APP.txPhoto=null;
  refreshCurrentPage();
}

// ===================== PHOTO =====================
export function compressPhoto(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX=400; let w=img.width, h=img.height;
      if (w>MAX) { h=Math.round(h*MAX/w); w=MAX; }
      const canvas = document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',0.55));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
export function updatePhotoPreview() {
  const prev = $('#photo-preview');
  if (APP.txPhoto) {
    prev.style.display = '';
    prev.innerHTML = `<img src="${APP.txPhoto}" alt="struk"/><div class="photo-remove" id="photo-remove-btn">✕</div>`;
    $('#photo-remove-btn')?.addEventListener('click', () => { APP.txPhoto=null; updatePhotoPreview(); });
  } else {
    prev.style.display='none'; prev.innerHTML='';
  }
}

// ===================== TX ITEM HTML =====================
const IN_ARR = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 17a1 1 0 01-.707-.293l-5-5a1 1 0 011.414-1.414L9 13.586V3a1 1 0 012 0v10.586l3.293-3.293a1 1 0 011.414 1.414l-5 5A1 1 0 0110 17z" clip-rule="evenodd"/></svg>`;
const EX_ARR = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L11 6.414V17a1 1 0 11-2 0V6.414L5.707 9.707a1 1 0 01-1.414-1.414l5-5A1 1 0 0110 3z" clip-rule="evenodd"/></svg>`;

export function txItemHTML(tx, delay=0) {
  const isIn = tx.type==='income', isT = tx.type==='transfer';
  const isST = tx.type==='saving_transfer';
  const isDT = tx.type==='debt_transfer';
  // A saving_transfer/debt_transfer's `direction` decides whether it LOOKS
  // like an income or an expense for display, even though its `type` is
  // neither — that's exactly what keeps it out of real income/expense totals.
  const stIn = (isST && tx.direction === 'withdraw') || (isDT && tx.direction === 'in');
  const cat  = !isT ? getCat(tx.type, tx.catId) : null;
  const displayClass = (isST||isDT) ? (stIn ? 'income' : 'expense') : tx.type;
  const dotContent = isT ? '🔄' : (cat?.emoji || ((isIn||stIn) ? IN_ARR : EX_ARR));
  const wallet = APP.wallets.find(w=>w.id===tx.walletId);
  const sign   = isT ? '→' : (isIn||stIn) ? '+' : '−';
  const catMeta    = cat  ? `<span class="tx-cat-badge">${escapeHtml(cat.name)}</span>` : '';
  const walletMeta = wallet ? ` · ${wallet.emoji}${escapeHtml(wallet.name)}` : '';
  const noteMeta   = tx.note && tx.note!=='[Otomatis dari berulang]' ? ` · ${escapeHtml(tx.note.slice(0,20))}${tx.note.length>20?'…':''}` : '';
  const photoHTML  = tx.photo ? `<img src="${tx.photo}" class="tx-thumb" data-photo="${tx.photo}" alt="struk"/>` : '';
  return `<div class="tx-item ${displayClass}" style="animation-delay:${delay}ms" data-id="${tx.id}">
    <div class="tx-dot">${dotContent}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(tx.desc)||'Tanpa deskripsi'}</div>
      <div class="tx-meta">${formatDate(tx.date)}${catMeta}<span>${walletMeta}${noteMeta}</span></div>
    </div>
    ${photoHTML}
    <div class="tx-right">
      <div class="tx-amount">${sign} ${formatRp(tx.amount)}</div>
      <div class="tx-actions">
        <button class="tx-btn edit" data-id="${tx.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="tx-btn del" data-id="${tx.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </div>
  </div>`;
}

// ===================== DELETE (see log.md Sprint 4) =====================
// The transaction-deletion branch of the original confirmDelete()
// dispatcher — extracted since removing a transaction is fundamentally a
// transaction-feature concern (it also has to clean up the paired
// savingTxs record if the transaction was a saving_transfer). The
// type-dispatch itself is still pending Sprint 6 — see js/ui/modals.js.
export function deleteTransaction(id) {
  const t = APP.transactions.find(x=>x.id===id);
  if (t?.type === 'saving_transfer') {
    if (t.savingTxRef) {
      APP.savingTxs = APP.savingTxs.filter(st => st.id !== t.savingTxRef);
    } else {
      // Legacy transaction from before this link existed — fall back to
      // matching one savingTxs record by bucket/wallet/amount/date/direction.
      // Removes at most one match so it can't over-delete if two identical
      // tabung/tarik happen to share the same day.
      const stType = t.direction === 'withdraw' ? 'withdraw' : 'deposit';
      const idx = APP.savingTxs.findIndex(st => st.bucketId===t.bucketId && st.walletId===t.walletId && st.amount===t.amount && st.date===t.date && st.type===stType);
      if (idx !== -1) APP.savingTxs.splice(idx,1);
    }
  }
  APP.transactions = APP.transactions.filter(t=>t.id!==id);
  persist();
  refreshCurrentPage();
  showToast('🗑️ Transaksi dihapus','info');
}
