/* ================================================
   AZAR FINANCE — js/core/migrations.js
   One-time legacy-data migrations, plus loadAll() which
   bootstraps APP state from IndexedDB on startup and runs
   any pending migrations.
   Extracted from script.js v5.6 — Sprint 2 (see log.md)
   ================================================ */
'use strict';

import { APP, KEYS } from './state.js';
import { idbGet, STORE_DATA, STORE_SETTINGS, persist } from './db.js';
import { todayStr, genId } from './utils.js';

// v5.4 migration: before this version, borrowing/lending/repaying a debt
// was recorded as a plain type:'income'/'expense' transaction — identifiable
// only via the debtRef link back to APP.debts, the same masquerading
// pattern (and the same "not real income/expense" bug) that saving_transfer
// had. Any transaction carrying a debtRef is unambiguously debt-related, so
// that's used here (instead of catId) to upgrade it to type:'debt_transfer'.
export function migrateLegacyDebtTransfers() {
  let migrated = 0;
  APP.transactions.forEach(t => {
    if (t.debtRef && t.type !== 'debt_transfer') {
      t.direction = t.type === 'income' ? 'in' : 'out';
      t.type = 'debt_transfer';
      t.catId = 'debt_transfer';
      migrated++;
    }
  });
  return migrated;
}

// One-time migration (v5.1): before this version, a savings deposit/withdraw
// was stored as a plain type:'income'/'expense' transaction, identifiable
// only via catId==='saving_transfer'. That's exactly what let it slip
// through any code that filtered by type — the root cause of the "fake
// income" bug. From v5.1 it gets its own type:'saving_transfer' with an
// explicit `direction`, so it's excluded from income/expense everywhere
// automatically. This upgrades any transactions saved by an older version
// so old history doesn't quietly regress back into the old bug.
export function migrateLegacySavingTransfers() {
  let migrated = 0;
  APP.transactions.forEach(t => {
    if (t.catId === 'saving_transfer' && t.type !== 'saving_transfer') {
      t.direction = t.type === 'expense' ? 'deposit' : 'withdraw';
      t.type = 'saving_transfer';
      migrated++;
    }
  });
  return migrated;
}

// v5.4 migration: an old "Impian" (goal) feature pre-dates the current
// savingBuckets/Tabungan system and was fully superseded by it, but a FAB
// routing bug (fixed in v5.4 — the FAB used to open the old goal sheet
// instead of the bucket sheet on this page) could still create entries in
// APP.goals that were never shown anywhere in the UI. This converts any
// leftover goals into savings buckets so nothing is silently lost.
// The old `saved` progress number is NOT carried over as a real balance —
// it was never linked to an actual wallet transaction in the old system,
// so fabricating one now would inflate net worth with money that never
// really moved. Instead it's reported back to the caller so the app can
// tell the user, rather than discarding it without a word.
export function migrateLegacyGoalsToBuckets() {
  if (!APP.goals.length) return null;
  let totalSaved = 0;
  APP.goals.forEach(g => {
    APP.savingBuckets.push({
      id: genId(), name: g.name || 'Impian', emoji: '⭐',
      target: g.target || 0, createdAt: g.createdAt || todayStr(), status: 'active',
    });
    totalSaved += (g.saved || 0);
  });
  const count = APP.goals.length;
  APP.goals = [];
  return { count, totalSaved };
}

export async function loadAll() {
  try {
    const [tx, goals, debts, wallets, dark, theme, notif, ntime, budgets, reminders, savingBuckets, savingTxs, customCats] = await Promise.all([
      idbGet(STORE_DATA,     KEYS.tx),
      idbGet(STORE_DATA,     KEYS.goals),
      idbGet(STORE_DATA,     KEYS.debts),
      idbGet(STORE_DATA,     KEYS.wallets),
      idbGet(STORE_SETTINGS, KEYS.dark),
      idbGet(STORE_SETTINGS, KEYS.theme),
      idbGet(STORE_SETTINGS, KEYS.notif),
      idbGet(STORE_SETTINGS, KEYS.ntime),
      idbGet(STORE_DATA,     'budgets'),
      idbGet(STORE_DATA,     'reminders'),
      idbGet(STORE_DATA,     'savingBuckets'),
      idbGet(STORE_DATA,     'savingTxs'),
      idbGet(STORE_DATA,     'customCats'),
    ]);
    APP.transactions  = tx             || [];
    APP.goals         = goals          || [];
    APP.debts         = debts          || [];
    APP.wallets       = wallets        || [];
    APP.budgets       = budgets        || [];
    APP.reminders     = reminders      || [];
    APP.savingBuckets = savingBuckets  || [];
    APP.savingTxs     = savingTxs      || [];
    APP.customCats    = customCats     || [];
    APP.darkMode     = dark    !== undefined ? dark  : false;
    APP.theme        = theme  || 'emerald';
    APP.notifEnabled = notif   !== undefined ? notif : false;
    APP.notifTime    = ntime   || '20:00';
  } catch(e) {
    console.error('loadAll error:', e);
    APP.transactions=[]; APP.goals=[]; APP.debts=[];
    APP.wallets=[]; APP.budgets=[]; APP.reminders=[]; APP.customCats=[];
  }
  if (!APP.wallets.length) {
    APP.wallets = [{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
    await persist();
  }
  if (migrateLegacySavingTransfers() > 0) await persist();
  if (migrateLegacyDebtTransfers() > 0) await persist();
  const goalMigration = migrateLegacyGoalsToBuckets();
  if (goalMigration) { await persist(); APP._goalMigrationResult = goalMigration; }
  APP.selectedWalletId = APP.wallets[0]?.id || 'default';
}
