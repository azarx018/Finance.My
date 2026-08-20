/* ================================================
   AZAR FINANCE — js/pages/riwayat.js
   Riwayat (transaction history) page render.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, emptyState, formatRpC } from '../core/utils.js';
import { registerPage } from '../ui/nav.js';
import { filterTx, calcTotals } from '../features/analytics.js';
import { txItemHTML } from '../features/transaction.js';

export function renderRiwayat() {
  const f      = APP.histFilter;
  const typeF  = ['income','expense'].includes(f) ? f : 'all';
  const dateF  = ['today','week','month'].includes(f) ? f : 'all';
  const list   = filterTx(dateF, typeF, APP.histSearch);
  const {income, expense} = calcTotals(list.filter(t=>t.type!=='transfer'));
  $('#hs-count').textContent   = list.length;
  $('#hs-income').textContent  = formatRpC(income);
  $('#hs-expense').textContent = formatRpC(expense);
  $('#history-list').innerHTML = list.length
    ? list.map((t,i) => txItemHTML(t,i*25)).join('')
    : emptyState('🔍','Tidak ada transaksi','Coba ubah filter atau kata kunci');
}

registerPage('riwayat', renderRiwayat);
