/* ================================================
   AZAR FINANCE — js/features/debt.js
   Debt (hutang/piutang) add/edit sheet, mark-unpaid, and
   the payment/collection sheet with its auto-created
   debt_transfer transaction bookkeeping.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, $$, formatRp, parseAmt, genId, todayStr, showToast } from '../core/utils.js';
import { persist } from '../core/db.js';
import { openSheet, closeSheet } from '../ui/sheets.js';
import { refreshPages } from '../ui/nav.js';
import { askConfirm } from '../ui/modals.js';
import { buildWalletPillRow } from './wallet.js';

// ===================== DEBT SHEET =====================
export function setDebtType(dtype) {
  APP.debtType = dtype;
  $$('#debt-type-toggle .debt-type-btn').forEach(b => {
    const isActive = b.dataset.dtype === dtype;
    b.classList.toggle('active', isActive);
    b.classList.remove('borrowed','lent');
    if (isActive) b.classList.add(dtype);
  });
  const isBorrowed = dtype === 'borrowed';
  $('#debt-name-label').textContent   = isBorrowed ? 'Hutang Dari Siapa' : 'Dipinjamkan Kepada';
  $('#debt-wallet-label').textContent = isBorrowed ? 'Dompet Penerima (Saldo Masuk +)' : 'Dompet Sumber (Saldo Keluar −)';
  $('#debt-submit-btn').textContent   = isBorrowed ? 'Simpan — Saldo Bertambah' : 'Simpan — Saldo Berkurang';
  $('#debt-submit-btn').className     = isBorrowed ? 'submit-btn' : 'submit-btn expense-mode';
}

export function openDebtSheet(editId=null) {
  APP.editingDebtId = editId;
  const d = editId ? APP.debts.find(x=>x.id===editId) : null;
  $('#debt-sheet-title').textContent = editId ? '✏️ Edit Hutang' : '💳 Tambah Hutang';
  setDebtType(d?.dtype || 'borrowed');
  $('#debt-name').value   = d?.name   || '';
  $('#debt-amount').value = d ? d.amount.toLocaleString('id-ID') : '';
  $('#debt-due').value    = d?.dueDate || '';
  $('#debt-note').value   = d?.note   || '';
  APP.debtWalletId = d?.walletId || APP.wallets[0]?.id || 'default';
  buildWalletPillRow('debt-wallet-row', APP.debtWalletId, id => APP.debtWalletId = id);
  openSheet('debt');
  setTimeout(() => $('#debt-name').focus(), 300);
}

export async function submitDebt() {
  const name    = $('#debt-name').value.trim();
  const amount  = parseAmt($('#debt-amount').value);
  const dueDate = $('#debt-due').value;
  const note    = $('#debt-note').value.trim();
  const dtype   = APP.debtType;
  const walletId= APP.debtWalletId || APP.wallets[0]?.id || 'default';
  if (!name)    { showToast('⚠️ Nama tidak boleh kosong','error'); return; }
  if (!amount)  { showToast('⚠️ Jumlah tidak boleh kosong','error'); return; }
  if (!dueDate) { showToast('⚠️ Jatuh tempo tidak boleh kosong','error'); return; }

  if (APP.editingDebtId) {
    const idx = APP.debts.findIndex(d=>d.id===APP.editingDebtId);
    if (idx!==-1) {
      const old = APP.debts[idx];
      const changed = old.amount !== amount || old.walletId !== walletId || old.dtype !== dtype;
      APP.debts[idx] = {...old, name, amount, dueDate, note, dtype, walletId};
      if (changed) {
        // The initial transaction auto-created when this debt was added
        // (linked via debtRef, tagged "[Otomatis]" so it's never confused
        // with a later cicilan/payment transaction that shares the same
        // debtRef) can drift out of sync with the debt if the amount/
        // wallet/type is edited later. We never change it silently — only
        // if the user explicitly confirms, since it affects historical
        // saldo. Declining leaves old history untouched.
        const linkedTx = APP.transactions.find(t => t.debtRef === old.id && t.note?.startsWith('[Otomatis]'));
        const wantSync = linkedTx && await askConfirm(
          'Nominal/dompet/jenis hutang berubah.\n\nSesuaikan juga transaksi awal yang sudah tercatat di histori? Saldo akan ikut disesuaikan.\n\nPilih "Tidak" jika ingin histori lama tetap seperti semula.',
          {title:'Sesuaikan histori transaksi?', icon:'🔄'}
        );
        if (wantSync) {
          const direction = dtype==='borrowed' ? 'in' : 'out';
          linkedTx.type      = 'debt_transfer';
          linkedTx.direction = direction;
          linkedTx.amount    = amount;
          linkedTx.walletId  = walletId;
          linkedTx.catId     = 'debt_transfer';
          linkedTx.desc      = dtype==='borrowed' ? `Hutang dari ${name}` : `Pinjaman ke ${name}`;
          showToast('✅ Hutang & transaksi terkait diperbarui');
        } else {
          showToast('✅ Hutang diperbarui (histori transaksi lama tidak diubah)');
        }
      } else {
        showToast('✅ Hutang diperbarui');
      }
    }
  } else {
    const debt = {
      id:genId(), name, amount, dueDate, note,
      dtype,       // 'borrowed' | 'lent'
      walletId,
      paid:false, paidDate:null,
      paidAmount:0,
      payments:[],
      createdAt:todayStr(),
    };
    APP.debts.push(debt);

    // Auto-create transaction to reflect on saldo. type:'debt_transfer' (not
    // income/expense) means borrowing/lending money moves cash but is never
    // counted as real income/expense — same reasoning as saving_transfer:
    // it's a liability/receivable, not something you earned or spent.
    const txDesc = dtype==='borrowed' ? `Hutang dari ${name}` : `Pinjaman ke ${name}`;
    const direction = dtype==='borrowed' ? 'in' : 'out'; // borrowed = saldo naik, lent = saldo turun
    APP.transactions.push({
      id:genId(), type:'debt_transfer', direction, amount,
      desc:txDesc, date:todayStr(),
      walletId, catId:'debt_transfer',
      note:`[Otomatis] ${note}`, photo:null,
      debtRef: debt.id, // link back
    });

    showToast(dtype==='borrowed' ? '💸 Hutang dicatat — Saldo +' : '🤝 Pinjaman dicatat — Saldo −');
  }

  persist(); closeSheet('debt'); APP.editingDebtId=null;
  refreshPages('hutang','lainnya','dashboard');
}

export function markDebtUnpaid(id) {
  const idx = APP.debts.findIndex(d=>d.id===id); if (idx===-1) return;
  APP.debts[idx].paid     = false;
  APP.debts[idx].paidDate = null;
  persist(); refreshPages('hutang');
  showToast('↩ Status dikembalikan ke belum lunas');
}

// ===================== PAYMENT SHEET =====================
export function openPaymentSheet(debtId) {
  const d = APP.debts.find(x=>x.id===debtId); if (!d) return;
  APP.payDebtId  = debtId;
  APP.payWalletId = d.walletId || APP.wallets[0]?.id || 'default';

  const paidSoFar = d.paidAmount || 0;
  const remaining = d.amount - paidSoFar;
  const pct       = Math.min(100, Math.round(paidSoFar/d.amount*100));
  const isLent    = d.dtype === 'lent';

  $('#pay-sheet-title').textContent  = isLent ? '💰 Terima Kembali' : '💳 Bayar Hutang';
  $('#pay-debt-info').textContent    = isLent ? `Dari: ${d.name}` : `Hutang ke: ${d.name}`;
  $('#pay-total-amt').textContent    = formatRp(d.amount);
  $('#pay-paid-amt').textContent     = formatRp(paidSoFar);
  $('#pay-left-amt').textContent     = formatRp(remaining);
  $('#pay-progress-bar').style.width = `${pct}%`;
  $('#pay-amount').value = '';
  $('#pay-date').value   = todayStr();
  $('#pay-note').value   = '';
  $('#pay-submit').textContent  = isLent ? 'Catat Penerimaan Kembali' : 'Bayar Sekarang';
  $('#pay-submit').className    = isLent ? 'submit-btn' : 'submit-btn expense-mode';

  // Quick fill buttons
  $('#pay-half-btn').onclick = () => {
    const half = Math.ceil(remaining / 2);
    $('#pay-amount').value = half.toLocaleString('id-ID');
  };
  $('#pay-full-btn').onclick = () => {
    $('#pay-amount').value = remaining.toLocaleString('id-ID');
  };

  buildWalletPillRow('pay-wallet-row', APP.payWalletId, id => APP.payWalletId = id);
  openSheet('pay');
  setTimeout(() => $('#pay-amount').focus(), 300);
}

export function submitPayment() {
  const amount   = parseAmt($('#pay-amount').value);
  const date     = $('#pay-date').value;
  const note     = $('#pay-note').value.trim();
  const walletId = APP.payWalletId || APP.wallets[0]?.id || 'default';
  if (!amount)   { showToast('⚠️ Masukkan jumlah pembayaran','error'); return; }
  if (!date)     { showToast('⚠️ Tanggal tidak boleh kosong','error'); return; }

  const idx = APP.debts.findIndex(d=>d.id===APP.payDebtId);
  if (idx===-1) return;
  const d = APP.debts[idx];
  const remaining = d.amount - (d.paidAmount||0);
  if (amount > remaining) { showToast(`⚠️ Melebihi sisa hutang (${formatRp(remaining)})`, 'error'); return; }

  const isLent = d.dtype === 'lent';

  // Record payment
  if (!d.payments) d.payments = [];
  d.payments.push({ id:genId(), amount, date, note, walletId });
  d.paidAmount = (d.paidAmount||0) + amount;

  // Auto-mark as paid if fully paid
  if (d.paidAmount >= d.amount) {
    d.paid = true; d.paidDate = date;
    showToast(isLent ? '✅ Piutang lunas diterima kembali!' : '🎉 Hutang lunas!');
  } else {
    showToast(isLent ? `💰 +${formatRp(amount)} diterima kembali` : `✅ Cicilan ${formatRp(amount)} dibayar`);
  }

  // Create transaction to update saldo. Same as debt creation above: this is
  // a debt_transfer, not real income/expense — repaying/collecting a debt
  // isn't spending or earning, it's settling a liability/receivable.
  // borrowed paying back  = cash out (saldo turun)
  // lent receiving back   = cash in  (saldo naik)
  const direction = isLent ? 'in' : 'out';
  const txDesc = isLent ? `Terima kembali dari ${d.name}` : `Bayar hutang ke ${d.name}`;
  APP.transactions.push({
    id:genId(), type:'debt_transfer', direction, amount,
    desc:txDesc, date,
    walletId, catId:'debt_transfer',
    note: note ? `[Cicilan] ${note}` : '[Cicilan hutang]',
    photo:null,
    debtRef: d.id,
  });

  persist(); closeSheet('pay');
  refreshPages('hutang','lainnya','dashboard');
}

// ===================== DELETE (see log.md Sprint 4) =====================
// The debt-deletion branch of the original confirmDelete() dispatcher.
export function deleteDebt(id) {
  APP.debts = APP.debts.filter(d=>d.id!==id);
  persist();
  refreshPages('hutang','lainnya');
  showToast('🗑️ Hutang dihapus','info');
}
