/* ================================================
   AZAR FINANCE — js/features/wallet.js
   Wallet balance calculation, wallet CRUD (add/edit),
   wallet-to-wallet transfer, and the reusable wallet-pill
   selector used by transaction/debt/saving sheets.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP, WALLET_EMOJIS } from '../core/state.js';
import { $, $$, escapeHtml, formatRp, formatRpC, parseAmt, genId, todayStr, showToast } from '../core/utils.js';
import { persist } from '../core/db.js';
import { openSheet, closeSheet } from '../ui/sheets.js';
import { refreshPages } from '../ui/nav.js';

// ===================== WALLET BALANCE =====================
export function getWalletBalance(walletId) {
  const w = APP.wallets.find(x => x.id === walletId);
  const init = w?.initialBalance || 0;
  const txBal = APP.transactions
    .filter(t => t.walletId === walletId && t.type !== 'transfer' && t.type !== 'saving_transfer' && t.type !== 'debt_transfer')
    .reduce((s,t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
  const trBal = APP.transactions
    .filter(t => t.type === 'transfer')
    .reduce((s,t) => {
      if (t.toWalletId === walletId) return s + t.amount;
      if (t.walletId   === walletId) return s - t.amount;
      return s;
    }, 0);
  // Savings deposit/withdraw moves money between this wallet and a bucket:
  // deposit takes money OUT of the wallet, withdraw brings it back IN.
  const stBal = APP.transactions
    .filter(t => t.type === 'saving_transfer' && t.walletId === walletId)
    .reduce((s,t) => t.direction === 'withdraw' ? s + t.amount : s - t.amount, 0);
  // Borrowing/lending/repaying/collecting moves cash in/out of this wallet
  // but is never counted as real income/expense.
  const dtBal = APP.transactions
    .filter(t => t.type === 'debt_transfer' && t.walletId === walletId)
    .reduce((s,t) => t.direction === 'in' ? s + t.amount : s - t.amount, 0);
  return init + txBal + trBal + stBal + dtBal;
}

// Computes balance + income/expense/count for EVERY wallet in a single
// pass over APP.transactions, instead of re-filtering the full array
// per wallet (which used to be O(wallets × transactions)). Use this
// whenever more than one wallet's stats are needed at once (dashboard
// totals, dompet list) — use getWalletBalance() above for one-off lookups.
export function computeWalletStats() {
  const stats = {};
  APP.wallets.forEach(w => { stats[w.id] = { balance: w.initialBalance||0, income:0, expense:0, count:0 }; });
  APP.transactions.forEach(t => {
    if (stats[t.walletId]) stats[t.walletId].count++;
    if (t.type === 'transfer') {
      if (stats[t.toWalletId]) stats[t.toWalletId].balance += t.amount;
      if (stats[t.walletId])   stats[t.walletId].balance   -= t.amount;
      return;
    }
    if (t.type === 'saving_transfer') {
      const s = stats[t.walletId]; if (!s) return;
      if (t.direction === 'withdraw') s.balance += t.amount; else s.balance -= t.amount;
      return;
    }
    if (t.type === 'debt_transfer') {
      const s = stats[t.walletId]; if (!s) return;
      if (t.direction === 'in') s.balance += t.amount; else s.balance -= t.amount;
      return;
    }
    const s = stats[t.walletId]; if (!s) return;
    if (t.type === 'income') { s.balance += t.amount; s.income += t.amount; }
    else                     { s.balance -= t.amount; s.expense += t.amount; }
  });
  return stats;
}

// NOTE (see log.md Sprint 1 audit + Sprint 4): this function has no call
// site anywhere in the app — net worth is computed inline at its one usage
// point (dashboard render) using computeWalletStats() directly. Kept here,
// exported, unused, pending your decision to either wire it in (e.g. a
// future "reports" page) or remove it. Not deleted per the dead-code rule
// (flag first, confirm, then remove).
export function getTotalNetWorth() {
  const stats = computeWalletStats();
  return APP.wallets.reduce((s,w) => s + (stats[w.id]?.balance||0), 0);
}

// ===================== WALLET-PILL SELECTOR =====================
// Generic wallet-pill selector builder — shared by the transaction, debt,
// payment, and saving-tx sheets (replaces what used to be several
// near-duplicate builders, one per sheet).
export function buildWalletPillRow(containerId, selectedId, onSelect, opts={}) {
  const c = $(`#${containerId}`); if (!c) return;
  c.innerHTML = APP.wallets.map(w => {
    const bal = opts.showBalance ? ` <span style="font-size:0.65rem;opacity:0.75;">(${formatRpC(getWalletBalance(w.id))})</span>` : '';
    return `<div class="wallet-pill${w.id===selectedId?' selected':''}" data-wid="${escapeHtml(w.id)}">
      <span class="wallet-pill-emoji">${escapeHtml(w.emoji)}</span>
      <span class="wallet-pill-name">${escapeHtml(w.name)}${bal}</span>
    </div>`;
  }).join('');
  c.querySelectorAll('.wallet-pill').forEach(p => {
    p.addEventListener('click', () => {
      onSelect(p.dataset.wid);
      c.querySelectorAll('.wallet-pill').forEach(x => x.classList.remove('selected'));
      p.classList.add('selected');
    });
  });
}

// ===================== WALLET SHEET (add/edit) =====================
export function openWalletSheet(editId=null) {
  APP.editingWalletId = editId;
  const w = editId ? APP.wallets.find(x=>x.id===editId) : null;
  $('#wallet-sheet-title').textContent = editId ? '✏️ Edit Dompet' : '👛 Tambah Dompet';
  $('#wallet-name').value    = w?.name || '';
  $('#wallet-balance').value = w ? w.initialBalance.toLocaleString('id-ID') : '';
  let selEmoji = w?.emoji || '👛';
  $('#wallet-emoji-picker').innerHTML = WALLET_EMOJIS.map(e =>
    `<div class="emoji-opt${e===selEmoji?' selected':''}" data-emoji="${e}">${e}</div>`).join('');
  $$('#wallet-emoji-picker .emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      selEmoji = opt.dataset.emoji;
      $$('#wallet-emoji-picker .emoji-opt').forEach(x=>x.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
  openSheet('wallet'); setTimeout(()=>$('#wallet-name').focus(),300);
}
export function submitWallet() {
  const name    = $('#wallet-name').value.trim();
  const balance = parseAmt($('#wallet-balance').value);
  const emoji   = $('#wallet-emoji-picker .emoji-opt.selected')?.dataset.emoji || '👛';
  if (!name) { showToast('⚠️ Nama dompet tidak boleh kosong','error'); return; }
  if (APP.editingWalletId) {
    const idx = APP.wallets.findIndex(w=>w.id===APP.editingWalletId);
    if (idx!==-1) APP.wallets[idx] = {...APP.wallets[idx], name, emoji, initialBalance:balance};
    showToast('✅ Dompet diperbarui');
  } else {
    APP.wallets.push({id:genId(), name, emoji, initialBalance:balance, createdAt:todayStr()});
    showToast('👛 Dompet ditambahkan');
  }
  persist(); closeSheet('wallet'); APP.editingWalletId=null;
  refreshPages('dompet','dashboard');
}

// ===================== TRANSFER SHEET =====================
export function openTransferSheet(fromId=null) {
  const opts = () => APP.wallets.map(w=>`<option value="${w.id}">${w.emoji} ${escapeHtml(w.name)} (${formatRpC(getWalletBalance(w.id))})</option>`).join('');
  $('#transfer-from').innerHTML = opts();
  $('#transfer-to').innerHTML   = opts();
  if (fromId) $('#transfer-from').value = fromId;
  const other = APP.wallets.find(w=>w.id!==fromId);
  if (other) $('#transfer-to').value = other.id;
  $('#transfer-amount').value = ''; $('#transfer-date').value = todayStr();
  openSheet('transfer'); setTimeout(()=>$('#transfer-amount').focus(),300);
}
export function submitTransfer() {
  const fromId = $('#transfer-from').value;
  const toId   = $('#transfer-to').value;
  const amount = parseAmt($('#transfer-amount').value);
  const date   = $('#transfer-date').value;
  if (fromId===toId) { showToast('⚠️ Dompet asal dan tujuan sama','error'); return; }
  if (!amount)       { showToast('⚠️ Jumlah tidak boleh kosong','error'); return; }
  const toW = APP.wallets.find(w=>w.id===toId);
  APP.transactions.push({id:genId(),type:'transfer',amount,desc:`Transfer → ${toW?.name}`,date,walletId:fromId,toWalletId:toId,catId:'other_exp',note:'',photo:null});
  persist(); closeSheet('transfer');
  showToast(`🔄 Transfer ${formatRp(amount)} berhasil`);
  refreshPages('dompet','dashboard');
}

// ===================== DELETE (see log.md Sprint 4) =====================
// The wallet-deletion branch of the original confirmDelete() dispatcher.
// Extracted here since it's genuinely wallet-feature logic (reassigning
// transactions/debts/savingTxs to a fallback wallet, folding the deleted
// wallet's initialBalance into it). The dispatcher itself (deciding WHICH
// of these delete* functions to call based on APP.deleteTarget.type) still
// lives in script.js, pending Sprint 6 — see js/ui/modals.js for why.
export function deleteWallet(id) {
  const remaining = APP.wallets.filter(w=>w.id!==id);
  if (!remaining.length) {
    showToast('⚠️ Tidak bisa menghapus dompet terakhir','error');
    return;
  }
  // Reassign any transactions/debts still pointing at this wallet to the
  // next remaining wallet, instead of leaving them orphaned (which used
  // to silently exclude their amount from the total net worth).
  const deletedWallet = APP.wallets.find(w=>w.id===id);
  const fallbackId = remaining[0].id;
  let moved = 0;
  APP.transactions.forEach(t => {
    if (t.walletId === id)   { t.walletId = fallbackId; moved++; }
    if (t.toWalletId === id) { t.toWalletId = fallbackId; }
  });
  APP.debts.forEach(d => { if (d.walletId === id) d.walletId = fallbackId; });
  APP.savingTxs.forEach(t => { if (t.walletId === id) t.walletId = fallbackId; });
  // IMPORTANT: the deleted wallet's own "Saldo Awal" (initialBalance) is a
  // property of the wallet object itself — it has no transaction
  // representation, so reassigning transactions alone does NOT preserve it.
  // Fold it into the fallback wallet explicitly so no money is lost.
  const fallbackWallet = remaining.find(w=>w.id===fallbackId);
  if (fallbackWallet && deletedWallet?.initialBalance) {
    fallbackWallet.initialBalance = (fallbackWallet.initialBalance||0) + deletedWallet.initialBalance;
  }
  APP.wallets = remaining;
  persist();
  refreshPages('dompet','dashboard');
  showToast(moved ? `🗑️ Dompet dihapus, ${moved} transaksi & saldo dipindah ke ${remaining[0].name}` : '🗑️ Dompet dihapus','info');
}
