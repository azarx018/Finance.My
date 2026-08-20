/* ================================================
   AZAR FINANCE — js/app.js
   Entry point. Loaded as <script type="module"> from
   index.html (replacing the old single script.js).

   Responsibilities, in order:
   1. Import every core/ui/features module (for direct use
      below) and every pages/*.js module (for its
      registerPage() side effect — see js/ui/nav.js).
   2. Assemble the confirmDelete() dispatcher — the one piece
      deliberately left out of every earlier sprint, because
      it needs every feature's deleteX() (Sprint 4) and every
      page's render function (Sprint 5) to exist first.
   3. Bind every event listener that used to live in
      script.js's init() — unchanged in behavior, just now
      calling into imported functions instead of file-local
      ones.
   4. Boot the app on DOMContentLoaded: loadAll() → restore
      settings → render the initial (dashboard) page → reveal
      the UI → wire up listeners.

   This file intentionally mirrors script.js's original init()
   order and structure closely — this is a wiring sprint, not
   a redesign. See log.md Sprint 6 for the handful of small,
   deliberate, behavior-preserving differences (documented
   inline below where they occur).
   ================================================ */
'use strict';

import { APP } from './core/state.js';
import { loadAll } from './core/migrations.js';
import { persist, saveSettings } from './core/db.js';
import { $, $$, fmtAmtInput, showToast, todayStr, formatRpC } from './core/utils.js';

import { openSheet, closeSheet } from './ui/sheets.js';
import { askConfirm, _resolveConfirm, openDeleteModal } from './ui/modals.js';
import { navigateTo, refreshCurrentPage, refreshPages } from './ui/nav.js';

import { openWalletSheet, submitWallet, openTransferSheet, submitTransfer, deleteWallet } from './features/wallet.js';
import {
  openTxSheet, setTxType, submitTx, compressPhoto, updatePhotoPreview, deleteTransaction,
} from './features/transaction.js';
import {
  setDebtType, openDebtSheet, submitDebt, openPaymentSheet, submitPayment, deleteDebt, markDebtUnpaid,
} from './features/debt.js';
import {
  openBucketSheet, saveBucket, openSavingTxSheet, saveSavingTx, deleteSavingBucket,
  openGoalSheet, submitGoal, openSavingSheet, submitSaving,
} from './features/saving.js';
import {
  openBudgetSheet, saveBudget, submitNewCategory, closeNewCategorySheet,
} from './features/budget.js';
import { openReminderSheet, saveReminder, scheduleNotif } from './features/reminder.js';
import {
  applyDark, checkAutoBackup, doAutoBackup, exportCSV, exportJSON, importJSON,
} from './features/backup.js';

// Importing these registers each page with the router (see the
// registerPage() call at the bottom of every file in js/pages/) — the
// imports are otherwise unused here, which is expected and intentional.
import './pages/dashboard.js';
import './pages/analitik.js';
import './pages/riwayat.js';
import './pages/dompet.js';
import './pages/lainnya.js';
import './pages/tabungan.js';
import './pages/hutang.js';
import './pages/budget.js';
import './pages/kalender.js';
import './pages/settings.js';

// ===================== DELETE DISPATCHER (see log.md Sprint 6) =====================
// The one piece deferred all the way from Sprint 3: reads what the user
// confirmed deleting and calls the matching feature's deleteX(). Each
// deleteX() already handles its own persist()+refresh+toast (Sprint 4), so
// this dispatcher's only remaining job is picking the right one and
// closing the modal — exactly what the original confirmDelete() did,
// minus the mutation logic that now lives with each feature.
function confirmDelete() {
  if (!APP.deleteTarget) return;
  const {type, id} = APP.deleteTarget;
  if      (type==='tx')     deleteTransaction(id);
  else if (type==='debt')   deleteDebt(id);
  else if (type==='wallet') deleteWallet(id);
  else if (type==='bucket') deleteSavingBucket(id);
  else if (type==='goal') {
    // Legacy "Impian" goal deletion (see js/features/saving.js's dead-code
    // note — this branch is unreachable from the current UI, but kept
    // exactly as the original for the same reason those functions were
    // kept: flagged, not removed, pending your confirmation).
    APP.goals = APP.goals.filter(g=>g.id!==id);
    persist();
    refreshPages('impian','lainnya');
    showToast('🗑️ Impian dihapus','info');
  }
  APP.deleteTarget = null;
  $('#modal-delete').style.display = 'none';
}

// ===================== INIT =====================
async function init() {
  await loadAll();
  checkAutoBackup();
  applyDark();
  $('#notif-toggle').checked          = APP.notifEnabled;
  $('#dark-toggle-settings').checked  = APP.darkMode;
  if (APP.notifEnabled) { $('#notif-time-row').style.display=''; $('#notif-time').value=APP.notifTime; }
  if (APP.notifEnabled) scheduleNotif();
  // Dashboard is the default page (APP.currentPage==='dashboard' from
  // state.js), so navigateTo('dashboard') would no-op (it early-returns
  // when already on that page) — same as the original, which rendered
  // these 3 pages directly rather than through navigateTo. Using
  // refreshPages() here (instead of importing render functions directly)
  // reaches the exact same 3 functions via the registry populated by the
  // page-module imports above.
  refreshPages('dashboard','laporan','impian');
  if (APP._goalMigrationResult) {
    const { count, totalSaved } = APP._goalMigrationResult;
    const savedNote = totalSaved > 0 ? ` Progress lama (≈${formatRpC(totalSaved)}) tidak ikut pindah karena gak pernah terhubung ke dompet manapun — silakan tabung ulang manual kalau perlu.` : '';
    showToast(`⭐ ${count} Impian lama dikonversi jadi Kantong Tabungan.${savedNote}`, 'info', 6000);
    delete APP._goalMigrationResult;
  }
  $('#fab-btn').style.display = 'none'; // dashboard page has no FAB
  setTimeout(() => {
    $('#app').style.display='flex';
    // PWA shortcut support: "Tambah Pemasukan/Pengeluaran" launches with #add
    if (location.hash === '#add') { openTxSheet(); history.replaceState(null,'',location.pathname); }
  }, 2250);

  // BOTTOM NAV
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page, true)));

  // BACK BUTTON
  $('#back-btn').addEventListener('click', () => navigateTo(APP.prevPage||'lainnya', true));

  // FAB — context-aware
  $('#fab-btn').addEventListener('click', () => {
    const p = APP.currentPage;
    // NOTE: 'impian' page shows the Tabungan bucket system. openGoalSheet()
    // was leftover from the older, pre-bucket "Impian" feature and created
    // data that was never displayed anywhere — fixed in v5.4.
    if (p==='impian')    { openBucketSheet(); return; }
    if (p==='hutang')    { openDebtSheet(); return; }
    if (p==='dompet')    { openWalletSheet(); return; }
    openTxSheet();
  });

  // DARK MODE
  $('#dark-toggle').addEventListener('click', () => {
    APP.darkMode = !APP.darkMode; applyDark(); saveSettings();
    showToast(APP.darkMode?'🌙 Dark mode aktif':'☀️ Light mode aktif','info');
  });
  $('#dark-toggle-settings').addEventListener('change', e => { APP.darkMode=e.target.checked; applyDark(); saveSettings(); });

  // NOTIF
  $('#notif-btn').addEventListener('click', () => navigateTo('settings'));
  $('#notif-toggle').addEventListener('change', e => {
    APP.notifEnabled = e.target.checked;
    $('#notif-time-row').style.display = e.target.checked ? '' : 'none';
    if (e.target.checked) { scheduleNotif(); showToast('🔔 Pengingat aktif'); }
    else { if(APP.notifTimerId) clearInterval(APP.notifTimerId); showToast('🔕 Pengingat nonaktif','info'); }
    saveSettings();
  });
  $('#notif-time').addEventListener('change', e => { APP.notifTime=e.target.value; saveSettings(); if(APP.notifEnabled) scheduleNotif(); });

  // TX TYPE BUTTONS
  $('#type-income').addEventListener('click',  () => setTxType('income'));
  $('#type-expense').addEventListener('click', () => setTxType('expense'));

  // PHOTO — camera + gallery
  $('#photo-btn-cam').addEventListener('click',     () => $('#photo-input-cam').click());
  $('#photo-btn-gallery').addEventListener('click', () => $('#photo-input-gallery').click());
  function handlePhotoFile(file) {
    if (!file) return;
    compressPhoto(file, b64 => { APP.txPhoto = b64; updatePhotoPreview(); });
  }
  $('#photo-input-cam').addEventListener('change',     e => { handlePhotoFile(e.target.files[0]); e.target.value=''; });
  $('#photo-input-gallery').addEventListener('change', e => { handlePhotoFile(e.target.files[0]); e.target.value=''; });

  // AUTO FORMAT AMOUNT INPUTS
  ['tx-amount','goal-target','goal-saved','saving-amount','debt-amount','wallet-balance','transfer-amount'].forEach(id => {
    const el = $(`#${id}`); if (!el) return;
    el.addEventListener('input', () => fmtAmtInput(el));
    el.addEventListener('keydown', e => {
      if (!['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End'].includes(e.key) && !/\d/.test(e.key)) e.preventDefault();
    });
  });

  // TX SUBMIT & CANCEL
  $('#tx-submit-btn').addEventListener('click', submitTx);
  $('#tx-cancel-edit').addEventListener('click', () => { APP.editingTxId=null; closeSheet('addtx'); });
  $('#addtx-backdrop').addEventListener('click', () => { closeSheet('addtx'); APP.editingTxId=null; APP.txPhoto=null; });

  // DASHBOARD FILTER
  $$('#dash-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#dash-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.dashFilter=btn.dataset.filter; refreshCurrentPage();
  }));
  $('#see-all-btn').addEventListener('click', () => navigateTo('riwayat'));

  // QUICK ACTIONS on dashboard
  $('#qa-income')?.addEventListener('click',   () => { APP.selectedType='income';  openTxSheet(); });
  $('#qa-expense')?.addEventListener('click',  () => { APP.selectedType='expense'; openTxSheet(); });
  $('#qa-transfer')?.addEventListener('click', () => openTransferSheet());

  // QUICK INSIGHTS on dashboard — tap a card to jump to its full page
  $$('#dash-insights .qi-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.nav, true));
  });

  // ANALITIK FILTER
  $$('#analitik-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#analitik-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.analitikPeriod=btn.dataset.aperiod; refreshCurrentPage();
  }));

  // HISTORY FILTER + SEARCH
  $$('#hist-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#hist-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.histFilter=btn.dataset.hfilter; refreshCurrentPage();
  }));
  const srch=$('#search-input'), clr=$('#clear-search');
  srch.addEventListener('input', () => { APP.histSearch=srch.value; clr.style.display=srch.value?'':'none'; refreshCurrentPage(); });
  clr.addEventListener('click', () => { srch.value=''; APP.histSearch=''; clr.style.display='none'; srch.focus(); refreshCurrentPage(); });

  // DEBT FILTER
  $$('#debt-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#debt-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.debtFilter=btn.dataset.dfilter; refreshCurrentPage();
  }));

  // LAPORAN pills (now inside analitik) — reuse analitik pills
  $('#btn-export-pdf')?.addEventListener('click', exportJSON);

  // BUDGET
  $('#btn-add-budget')?.addEventListener('click', ()=>openBudgetSheet());
  $('#budget-submit')?.addEventListener('click', saveBudget);
  $('#budget-cancel')?.addEventListener('click', ()=>closeSheet('budget'));
  $('#budget-backdrop')?.addEventListener('click', ()=>closeSheet('budget'));

  // NEW CATEGORY SHEET
  $('#newcat-submit')?.addEventListener('click', submitNewCategory);
  $('#newcat-cancel')?.addEventListener('click', closeNewCategorySheet);
  $('#newcat-backdrop')?.addEventListener('click', closeNewCategorySheet);

  // REMINDER (kalender)
  $('#cal-add-reminder-btn')?.addEventListener('click', openReminderSheet);
  $('#reminder-submit')?.addEventListener('click', saveReminder);
  $('#reminder-cancel')?.addEventListener('click', ()=>closeSheet('reminder'));
  $('#reminder-backdrop')?.addEventListener('click', ()=>closeSheet('reminder'));

  // Format amount input for budget & reminder
  ['budget-amount','reminder-amount'].forEach(id=>{
    const el=$('#'+id); if(el) el.addEventListener('input',()=>fmtAmtInput(el));
  });

  // KALENDER
  $('#cal-prev')?.addEventListener('click', () => {
    APP.calMonth--; if(APP.calMonth<0){APP.calMonth=11;APP.calYear--;} refreshCurrentPage();
  });
  $('#cal-next')?.addEventListener('click', () => {
    APP.calMonth++; if(APP.calMonth>11){APP.calMonth=0;APP.calYear++;} refreshCurrentPage();
  });
  $('#cal-add-tx-btn')?.addEventListener('click', () => {
    if(APP.calSelectedDate){ openTxSheet(); $('#tx-date').value=APP.calSelectedDate; }
  });

  // LAINNYA di top nav
  $('#btn-lainnya-top')?.addEventListener('click', ()=>navigateTo('lainnya', true));

  // TABUNGAN
  $('#qa-saving-deposit')?.addEventListener('click', ()=>openSavingTxSheet('deposit'));
  $('#qa-saving-withdraw')?.addEventListener('click', ()=>openSavingTxSheet('withdraw'));
  $('#btn-add-bucket')?.addEventListener('click', ()=>openBucketSheet());
  $('#bucket-submit')?.addEventListener('click', saveBucket);
  $('#bucket-cancel')?.addEventListener('click', ()=>closeSheet('bucket'));
  $('#bucket-backdrop')?.addEventListener('click', ()=>closeSheet('bucket'));
  $('#bucket-target')?.addEventListener('input', ()=>fmtAmtInput($('#bucket-target')));
  $('#saving-tx-submit')?.addEventListener('click', saveSavingTx);
  $('#saving-tx-cancel')?.addEventListener('click', ()=>closeSheet('saving-tx'));
  $('#saving-tx-backdrop')?.addEventListener('click', ()=>closeSheet('saving-tx'));
  $('#saving-tx-amount')?.addEventListener('input', ()=>fmtAmtInput($('#saving-tx-amount')));
  $('#stx-deposit-btn')?.addEventListener('click', ()=>openSavingTxSheet('deposit', APP._savingTxBucketId));
  $('#stx-withdraw-btn')?.addEventListener('click', ()=>openSavingTxSheet('withdraw', APP._savingTxBucketId));

  // HUB LAINNYA
  $('#hub-dompet')?.addEventListener('click',    () => navigateTo('dompet'));
  $('#hub-kalender')?.addEventListener('click',  () => navigateTo('kalender'));
  $('#hub-hutang').addEventListener('click',     () => navigateTo('hutang'));
  $('#hub-settings').addEventListener('click',   () => navigateTo('settings'));

  // WALLET SHEET
  $('#wallet-submit').addEventListener('click',  submitWallet);
  $('#wallet-cancel').addEventListener('click',  () => { closeSheet('wallet'); APP.editingWalletId=null; });
  $('#wallet-backdrop').addEventListener('click',() => { closeSheet('wallet'); APP.editingWalletId=null; });

  // TRANSFER SHEET
  $('#transfer-submit').addEventListener('click',  submitTransfer);
  $('#transfer-cancel').addEventListener('click',  () => closeSheet('transfer'));
  $('#transfer-backdrop').addEventListener('click',() => closeSheet('transfer'));

  // GOAL SHEET (legacy — see js/features/saving.js dead-code note; wired
  // identically to the original despite being unreachable via the FAB)
  $('#goal-submit-btn').addEventListener('click', submitGoal);
  $('#goal-cancel').addEventListener('click',     () => { closeSheet('goal'); APP.editingGoalId=null; });
  $('#goal-backdrop').addEventListener('click',   () => { closeSheet('goal'); APP.editingGoalId=null; });

  // SAVING SHEET (legacy — same note as GOAL SHEET above)
  $('#saving-submit').addEventListener('click', submitSaving);
  $('#saving-cancel').addEventListener('click', () => closeSheet('saving'));
  $('#saving-backdrop').addEventListener('click',() => closeSheet('saving'));

  // DEBT TYPE TOGGLE
  $$('#debt-type-toggle .debt-type-btn').forEach(btn =>
    btn.addEventListener('click', () => setDebtType(btn.dataset.dtype))
  );

  // DEBT SHEET
  $('#debt-submit-btn').addEventListener('click', submitDebt);
  $('#debt-cancel').addEventListener('click',     () => { closeSheet('debt'); APP.editingDebtId=null; });
  $('#debt-backdrop').addEventListener('click',   () => { closeSheet('debt'); APP.editingDebtId=null; });

  // PAYMENT SHEET
  $('#pay-submit').addEventListener('click',   submitPayment);
  $('#pay-cancel').addEventListener('click',   () => closeSheet('pay'));
  $('#pay-backdrop').addEventListener('click', () => closeSheet('pay'));
  // Amount format for pay-amount
  const payAmtEl = $('#pay-amount');
  if (payAmtEl) {
    payAmtEl.addEventListener('input', () => fmtAmtInput(payAmtEl));
    payAmtEl.addEventListener('keydown', e => {
      if (!['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End'].includes(e.key) && !/\d/.test(e.key)) e.preventDefault();
    });
  }

  // DELETE MODAL
  $('#modal-cancel').addEventListener('click',  () => { $('#modal-delete').style.display='none'; APP.deleteTarget=null; });
  $('#modal-confirm').addEventListener('click', confirmDelete);
  $('#modal-delete').addEventListener('click',  e => { if(e.target===$('#modal-delete')){ $('#modal-delete').style.display='none'; APP.deleteTarget=null; } });

  // GENERIC CONFIRM MODAL
  $('#modal-generic-yes').addEventListener('click', () => _resolveConfirm(true));
  $('#modal-generic-no').addEventListener('click',  () => _resolveConfirm(false));
  $('#modal-generic-confirm').addEventListener('click', e => { if(e.target===$('#modal-generic-confirm')) _resolveConfirm(false); });

  // RESET MODAL
  $('#btn-reset').addEventListener('click',    () => $('#modal-reset').style.display='flex');
  $('#reset-cancel').addEventListener('click', () => $('#modal-reset').style.display='none');
  $('#reset-confirm').addEventListener('click', async () => {
    APP.transactions=[]; APP.goals=[]; APP.debts=[];
    APP.budgets=[]; APP.reminders=[]; APP.savingBuckets=[]; APP.savingTxs=[];
    APP.wallets=[{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
    await persist();
    refreshPages('dashboard','riwayat','lainnya','laporan','impian');
    $('#modal-reset').style.display='none';
    showToast('🗑️ Semua data direset','info');
  });
  $('#modal-reset').addEventListener('click', e => { if(e.target===$('#modal-reset')) $('#modal-reset').style.display='none'; });

  // PHOTO VIEWER MODAL
  $('#modal-photo').addEventListener('click',  () => $('#modal-photo').style.display='none');
  $('#photo-close').addEventListener('click',  () => $('#modal-photo').style.display='none');

  // SETTINGS EXPORT / IMPORT
  $('#btn-export-csv').addEventListener('click',  exportCSV);
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-backup-now').addEventListener('click',  () => doAutoBackup(false));
  $('#btn-import').addEventListener('click',      () => $('#import-file').click());
  $('#import-file').addEventListener('change',    e => { importJSON(e.target.files[0]); e.target.value=''; });

  // REFRESH APP — the app shell has overflow:hidden (no pull-to-refresh),
  // and installed/standalone PWAs have no browser reload button. This clears
  // only the static-asset Cache Storage (HTML/CSS/JS) so the next load
  // fetches fresh files, then hard-reloads. It never touches IndexedDB, so
  // no financial data is affected.
  $('#btn-refresh-app')?.addEventListener('click', async () => {
    showToast('🔄 Memeriksa update...');
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { /* ignore — still reload below even if this fails */ }
    location.reload();
  });

  // GLOBAL DELEGATION — all clickable data-attributes
  document.addEventListener('click', e => {
    // Photo thumbnail → open viewer
    const thumb = e.target.closest('.tx-thumb');
    if (thumb) { $('#photo-viewer-img').src=thumb.dataset.photo; $('#modal-photo').style.display='flex'; return; }

    // TX edit / delete
    const txEdit = e.target.closest('.tx-btn.edit');
    const txDel  = e.target.closest('.tx-btn.del');
    if (txEdit) {
      const t = APP.transactions.find(x=>x.id===txEdit.dataset.id);
      if (t?.type === 'saving_transfer') {
        showToast('Kelola tabung/tarik dari halaman Tabungan ya','info');
        navigateTo('impian');
        return;
      }
      if (t?.type === 'debt_transfer') {
        showToast('Kelola hutang/piutang dari halaman Hutang ya','info');
        navigateTo('hutang');
        return;
      }
      openTxSheet(txEdit.dataset.id); return;
    }
    if (txDel)  {
      const t = APP.transactions.find(x=>x.id===txDel.dataset.id);
      const msg = t?.type==='saving_transfer'
        ? 'Transaksi ini akan dihapus permanen, dan saldo kantong tabungan terkait akan ikut disesuaikan.'
        : 'Transaksi ini akan dihapus permanen.';
      openDeleteModal('tx', txDel.dataset.id, msg);
      return;
    }

    // Goal actions (legacy — see dead-code note in js/features/saving.js)
    const gSave = e.target.closest('[data-goal-save]');
    const gEdit = e.target.closest('[data-goal-edit]');
    const gDel  = e.target.closest('[data-goal-del]');
    if (gSave) { openSavingSheet(gSave.dataset.goalSave); return; }
    if (gEdit) { openGoalSheet(gEdit.dataset.goalEdit);   return; }
    if (gDel)  { openDeleteModal('goal', gDel.dataset.goalDel, 'Impian ini akan dihapus permanen.'); return; }

    // Debt actions
    const dPay     = e.target.closest('[data-debt-pay]');
    const dUnlunas = e.target.closest('[data-debt-unlunas]');
    const dEdit    = e.target.closest('[data-debt-edit]');
    const dDel     = e.target.closest('[data-debt-del]');
    if (dPay)     { openPaymentSheet(dPay.dataset.debtPay);           return; }
    if (dUnlunas) { markDebtUnpaid(dUnlunas.dataset.debtUnlunas);     return; }
    if (dEdit)    { openDebtSheet(dEdit.dataset.debtEdit);            return; }
    if (dDel)     { openDeleteModal('debt', dDel.dataset.debtDel, 'Hutang ini akan dihapus. Transaksi terkait tetap ada.'); return; }

    // Wallet actions
    const wTransfer = e.target.closest('[data-transfer]');
    const wEdit     = e.target.closest('[data-wallet-edit]');
    const wDel      = e.target.closest('[data-wallet-del]');
    if (wTransfer) { openTransferSheet(wTransfer.dataset.transfer);    return; }
    if (wEdit)     { openWalletSheet(wEdit.dataset.walletEdit);        return; }
    if (wDel)      { openDeleteModal('wallet', wDel.dataset.walletDel, 'Dompet ini akan dihapus. Transaksinya akan dipindahkan ke dompet lain, tidak hilang.'); return; }
  });

  // KEYBOARD ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['addtx','goal','saving','debt','wallet','transfer','pay','budget'].forEach(closeSheet);
      if ($('#sheet-newcat')?.classList.contains('open')) closeNewCategorySheet();
      if ($('#modal-generic-confirm').style.display==='flex') _resolveConfirm(false);
      $('#modal-delete').style.display='none';
      $('#modal-reset').style.display='none';
      $('#modal-photo').style.display='none';
      APP.deleteTarget=null;
    }
  });

  // Resize → redraw charts
  window.addEventListener('resize', () => {
    if (APP.currentPage==='analitik') refreshCurrentPage();
  });
}

document.addEventListener('DOMContentLoaded', init);
