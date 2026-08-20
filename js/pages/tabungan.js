/* ================================================
   AZAR FINANCE — js/pages/tabungan.js
   Tabungan/Impian (saving buckets) page render.

   NOTE: registered under the 'impian' page-name (matching
   the original navigateTo(), which called renderTabungan()
   directly for page==='impian' — there never was a separate
   "Impian" render, just a one-line alias `renderImpian(){
   renderTabungan()}` used by a couple of other call sites,
   which is now equivalently satisfied by registering this
   same function under the 'impian' key). See log.md Sprint 5.

   Also: the bucket-deletion "has transactions" branch used to
   duplicate openDeleteModal()'s 3-line body inline instead of
   calling it. Replaced with an actual call to openDeleteModal()
   here — same resulting state (APP.deleteTarget set, same
   modal shown, same message), zero behavior change, one less
   duplicated code path. See log.md Sprint 5.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, $$, formatRp, formatRpC, todayStr, showToast, emptyState } from '../core/utils.js';
import { persist } from '../core/db.js';
import { registerPage } from '../ui/nav.js';
import { askConfirm, openDeleteModal } from '../ui/modals.js';
import {
  getSavingTotal, getBucketBalance, bucketCardHTML, openSavingTxSheet, openBucketSheet,
} from '../features/saving.js';

export function renderTabungan() {
  const total = getSavingTotal();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const thisMonthDep = APP.savingTxs.filter(t=>t.type==='deposit'&&t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);
  const thisMonthWit = APP.savingTxs.filter(t=>t.type==='withdraw'&&t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);

  const el = $('#saving-total-display'); if(el) el.textContent = formatRp(total);
  const bc = $('#saving-bucket-count'); if(bc) bc.textContent = APP.savingBuckets.length+' kantong';
  const sm = $('#saving-this-month'); if(sm) sm.textContent = formatRpC(thisMonthDep);
  const sw = $('#saving-withdrawn'); if(sw) sw.textContent = formatRpC(thisMonthWit);

  const list = $('#saving-bucket-list');
  if(!list) return;
  if(!APP.savingBuckets.length) {
    list.innerHTML = emptyState('🪣','Belum ada kantong tabungan','Ketuk "+ Buat" untuk mulai');
    return;
  }
  // Buckets created before the "Selesai" status existed have no `status`
  // field — treat those as active.
  const isCompleted = b => b.status === 'completed';
  const activeBuckets    = APP.savingBuckets.filter(b => !isCompleted(b));
  const completedBuckets = APP.savingBuckets.filter(b => isCompleted(b));

  // Tab switcher — active and completed buckets are shown one group at a
  // time (not stacked together), so a finished bucket that's been fully
  // withdrawn (still cosmetically shown at 100%, see bucketCardHTML) can't
  // sit next to real in-progress balances and cause confusion.
  const tab = APP.savingBucketTab === 'completed' ? 'completed' : 'active';
  const tabsHTML = `<div class="saving-tab-switch" style="display:flex;gap:8px;margin-bottom:14px;">
    <button class="saving-tab-btn${tab==='active'?' active':''}" data-tab="active" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(0,0,0,0.08));background:${tab==='active'?'var(--accent,#3b82f6)':'transparent'};color:${tab==='active'?'#fff':'var(--txt-muted)'};font-size:0.78rem;font-weight:600;">🔄 Aktif/Proses (${activeBuckets.length})</button>
    <button class="saving-tab-btn${tab==='completed'?' active':''}" data-tab="completed" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(0,0,0,0.08));background:${tab==='completed'?'var(--accent,#3b82f6)':'transparent'};color:${tab==='completed'?'#fff':'var(--txt-muted)'};font-size:0.78rem;font-weight:600;">🏁 Tercapai (${completedBuckets.length})</button>
  </div>`;

  const shownBuckets = tab==='active' ? activeBuckets : completedBuckets;
  const cardsHTML = shownBuckets.length
    ? shownBuckets.map(b => bucketCardHTML(b)).join('')
    : (tab==='active'
        ? emptyState('🪣','Belum ada kantong aktif','Ketuk "+ Buat" untuk mulai')
        : emptyState('🏁','Belum ada kantong tercapai','Kantong yang ditandai selesai akan muncul di sini'));

  list.innerHTML = tabsHTML + cardsHTML;

  $$('#saving-bucket-list .saving-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.savingBucketTab = btn.dataset.tab;
      renderTabungan();
    });
  });

  // Listeners
  $$('#saving-bucket-list [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const {bid, action} = btn.dataset;
      if (action==='deposit') openSavingTxSheet('deposit', bid);
      else if (action==='withdraw') openSavingTxSheet('withdraw', bid);
      else if (action==='edit') openBucketSheet(bid);
      else if (action==='complete') {
        const b = APP.savingBuckets.find(x=>x.id===bid);
        if (!b) return;
        const bal = getBucketBalance(bid);
        const reachedFull = b.target > 0 && bal >= b.target;
        // Completing below 100% is allowed, but needs an explicit confirm —
        // and its progress bar will keep showing the real percentage
        // (never locked to 100%), since it never actually got there.
        if (b.target > 0 && !reachedFull) {
          const pct = Math.round((bal/b.target)*100);
          const ok = await askConfirm(
            `Progress kantong ini baru ${pct}% dari target. Tetap tandai selesai?`,
            {title:'Yakin tandai selesai?', icon:'🏁'}
          );
          if (!ok) return;
        }
        b.status='completed'; b.completedAt=todayStr(); b.achievedFull=reachedFull;
        persist(); renderTabungan();
        showToast('🏁 Kantong ditandai selesai','success');
      }
      else if (action==='reactivate') {
        const b = APP.savingBuckets.find(x=>x.id===bid);
        if(b){ b.status='active'; delete b.completedAt; delete b.achievedFull; }
        persist(); renderTabungan();
        showToast('🔓 Kantong dibuka lagi, bisa nabung lagi','success');
      }
      else if (action==='del') {
        const hasTxs = APP.savingTxs.some(t=>t.bucketId===bid);
        if(hasTxs) {
          const txCount = APP.savingTxs.filter(t=>t.bucketId===bid).length;
          const bal = getBucketBalance(bid);
          const walletTxCount = APP.transactions.filter(t=>t.bucketId===bid).length;
          let msg = `Kantong ini memiliki ${txCount} transaksi tabungan. Semua transaksi tabungan pada kantong ini akan ikut dihapus. Lanjutkan?`;
          // Old buckets (created before this wallet-link field existed) may have
          // deposits without a matching wallet transaction — warn instead of
          // guessing which transaction to touch, so nothing is deleted wrongly.
          if (bal > 0 && walletTxCount === 0) {
            msg += `\n\n⚠️ Saldo kantong ini ${formatRp(bal)} tapi tidak ditemukan transaksi dompet yang terhubung — kemungkinan data lama. Saldo dompet TIDAK akan otomatis disesuaikan, silakan periksa manual jika perlu.`;
          }
          openDeleteModal('bucket', bid, msg);
          return;
        }
        APP.savingBuckets = APP.savingBuckets.filter(b=>b.id!==bid);
        persist(); renderTabungan(); showToast('Kantong dihapus','info');
      }
    });
  });
}

registerPage('impian', renderTabungan);
