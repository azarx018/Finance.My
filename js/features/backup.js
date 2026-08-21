/* ================================================
   AZAR FINANCE — js/features/backup.js
   Dark-mode toggle persistence, weekly auto-backup, and
   manual CSV/JSON export + JSON import.

   NOTE on scope: applyDark() isn't "backup" in the literal
   sense, but it's the same kind of thing — a small piece of
   settings-persistence UI wiring that didn't have its own
   dedicated module in the original sprint plan. Grouped here
   rather than left in script.js or forced into an unrelated
   feature file. See log.md Sprint 4.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP, KEYS, APP_VERSION } from '../core/state.js';
import { $, $$, todayStr, showToast, formatRpC } from '../core/utils.js';
import { persist } from '../core/db.js';
import {
  migrateLegacyDebtTransfers, migrateLegacySavingTransfers, migrateLegacyGoalsToBuckets,
} from '../core/migrations.js';
import { refreshPages } from '../ui/nav.js';

// ===================== DARK MODE =====================
export function applyDark() {
  document.body.classList.toggle('dark-mode', APP.darkMode);
  $('#icon-moon').style.display = APP.darkMode ? '' : 'none';
  $('#icon-sun').style.display  = APP.darkMode ? 'none' : '';
  const s = $('#dark-toggle-settings'); if (s) s.checked = APP.darkMode;
}

// ===================== THEME (v5.8 — see log.md) =====================
// Sets body[data-theme] (read by css/base.css's theme blocks) and syncs the
// Settings-page swatch picker + label. Independent of dark mode — a theme
// defines brand/income/expense hue, dark mode toggles background lightness;
// the two combine freely (e.g. Pink + Dark Mode).
export function applyTheme() {
  document.body.setAttribute('data-theme', APP.theme || 'emerald');
  const labels = {emerald:'Emerald', pink:'Pink Elegan', ocean:'Ocean Blue'};
  const lbl = $('#theme-current-label');
  if (lbl) lbl.textContent = labels[APP.theme] || 'Emerald';
  $$('.theme-swatch').forEach(sw => sw.classList.toggle('selected', sw.dataset.theme === APP.theme));
}

// ===================== AUTO BACKUP =====================
const AUTO_BACKUP_INTERVAL_DAYS = 7; // auto backup setiap 7 hari
const BACKUP_LAST_KEY = 'azf3_backup_last';

export function getAutoBackupLastDate() {
  try { return localStorage.getItem(BACKUP_LAST_KEY) || ''; } catch { return ''; }
}
export function setAutoBackupLastDate(d) {
  try { localStorage.setItem(BACKUP_LAST_KEY, d); } catch {}
}

export function doAutoBackup(silent = true) {
  if (!APP.transactions.length && !APP.goals.length && !APP.debts.length) return;
  const data = {
    app: 'My Finance', version: APP_VERSION,
    exported: new Date().toISOString(), autoBackup: true,
    transactions: APP.transactions, goals: APP.goals,
    debts: APP.debts, wallets: APP.wallets,
  };
  dlBlob(JSON.stringify(data, null, 2),
    `my-finance-autobackup-${todayStr()}.json`, 'application/json');
  setAutoBackupLastDate(todayStr());
  if (!silent) showToast('💾 Auto backup berhasil!', 'success');
}

export function checkAutoBackup() {
  const last = getAutoBackupLastDate();
  if (!last) { setAutoBackupLastDate(todayStr()); return; } // first run, tandai hari ini
  const daysSince = Math.floor((new Date(todayStr()) - new Date(last)) / 86400000);
  if (daysSince >= AUTO_BACKUP_INTERVAL_DAYS) {
    showToast(`🔔 Auto backup mingguan dimulai...`, 'info', 2000);
    setTimeout(() => doAutoBackup(false), 2200);
  }
}

// ===================== EXPORT / IMPORT =====================
export function exportCSV() {
  if (!APP.transactions.length) { showToast('⚠️ Tidak ada data','error'); return; }
  const rows = APP.transactions.map(t => [
    t.id, t.type, t.amount, `"${(t.desc||'').replace(/"/g,'""')}"`,
    t.date, t.walletId||'', t.catId||'', `"${(t.note||'').replace(/"/g,'""')}"`
  ]);
  const csv = ['ID,Tipe,Nominal,Deskripsi,Tanggal,Dompet,Kategori,Catatan', ...rows.map(r=>r.join(','))].join('\n');
  dlBlob('\uFEFF'+csv, `my-finance-${todayStr()}.csv`, 'text/csv;charset=utf-8;');
  showToast('📊 CSV diekspor');
}
export function exportJSON() {
  const data = {
    app:'My Finance', version:APP_VERSION, exported:new Date().toISOString(),
    transactions:APP.transactions, goals:APP.goals, debts:APP.debts, wallets:APP.wallets,
    savingBuckets:APP.savingBuckets, savingTxs:APP.savingTxs,
    budgets:APP.budgets, reminders:APP.reminders, customCats:APP.customCats,
  };
  dlBlob(JSON.stringify(data,null,2), `my-finance-backup-${todayStr()}.json`, 'application/json');
  showToast('💾 JSON diekspor');
}
export function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        APP.transactions=[...data]; APP.goals=[]; APP.debts=[];
        APP.wallets=[{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
        APP.savingBuckets=[]; APP.savingTxs=[]; APP.budgets=[]; APP.reminders=[]; APP.customCats=[];
      } else {
        APP.transactions = data.transactions || [];
        APP.goals        = data.goals        || [];
        APP.debts        = data.debts        || [];
        APP.wallets      = data.wallets?.length ? data.wallets : [{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
        // Backups made before v5.5 won't have these keys — fall back to
        // whatever's already loaded instead of wiping it out with [].
        APP.savingBuckets = data.savingBuckets ?? APP.savingBuckets ?? [];
        APP.savingTxs     = data.savingTxs     ?? APP.savingTxs     ?? [];
        APP.budgets       = data.budgets       ?? APP.budgets       ?? [];
        APP.reminders     = data.reminders     ?? APP.reminders     ?? [];
        APP.customCats    = data.customCats    ?? APP.customCats    ?? [];
      }
      migrateLegacySavingTransfers();
      migrateLegacyDebtTransfers();
      const goalMigration = migrateLegacyGoalsToBuckets();
      await persist();
      APP.selectedWalletId = APP.wallets[0]?.id || 'default';
      refreshPages('dashboard','riwayat','impian','laporan');
      showToast(`✅ ${APP.transactions.length} transaksi diimpor`);
      if (goalMigration) {
        const savedNote = goalMigration.totalSaved > 0 ? ` Progress lama (≈${formatRpC(goalMigration.totalSaved)}) tidak ikut pindah — silakan tabung ulang manual kalau perlu.` : '';
        setTimeout(()=>showToast(`⭐ ${goalMigration.count} Impian lama dikonversi jadi Kantong Tabungan.${savedNote}`, 'info', 6000), 2600);
      }
    } catch(err) { showToast('❌ Gagal import: '+err.message,'error',3500); }
  };
  reader.readAsText(file);
}
export function dlBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const a   = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
