/* ================================================
   AZAR FINANCE — js/pages/dashboard.js
   Dashboard page render. Registers itself with the router
   (js/ui/nav.js) so navigateTo('dashboard') and
   refreshCurrentPage() reach it without nav.js importing
   this file directly (see log.md Sprint 3 for why).
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP, getCatList } from '../core/state.js';
import { $, formatRp, formatRpC, todayStr, escapeHtml, emptyState } from '../core/utils.js';
import { registerPage } from '../ui/nav.js';
import { getDateRange, filterTx, calcTotals } from '../features/analytics.js';
import { computeWalletStats } from '../features/wallet.js';
import { getBucketBalance } from '../features/saving.js';
import { getBudgetMonth } from '../features/budget.js';
import { txItemHTML } from '../features/transaction.js';
import { openWalletSheet } from '../features/wallet.js';

export function renderDashboard() {
  const r    = getDateRange(APP.dashFilter);
  const list = APP.transactions.filter(t => (!r || (t.date>=r.from && t.date<=r.to)) && t.type!=='transfer');
  const {income, expense} = calcTotals(list);
  const walletStats = computeWalletStats();
  const nw   = APP.wallets.reduce((s,w) => s + (walletStats[w.id]?.balance||0), 0);
  // "Savings" here means income not spent on real (external) expenses. Money
  // moved into a Tabungan bucket has type:'saving_transfer' so wallet
  // balances stay accurate, but it's still the user's own money — just
  // relocated, not spent. This filter is now belt-and-suspenders (calcTotals
  // already excludes type:'saving_transfer'), kept for clarity/safety.
  const listForSavings = list.filter(t => t.catId !== 'saving_transfer');
  const {income: incSav, expense: expSav} = calcTotals(listForSavings);
  const savings = incSav - expSav;
  const savRate = incSav>0 ? Math.round((savings/incSav)*100) : 0;

  // Balance card
  $('#net-worth-display').textContent = formatRp(nw);
  $('#net-worth-display').style.color = nw>=0 ? '' : 'var(--expense)';
  $('#dash-income').textContent  = formatRpC(income);
  $('#dash-expense').textContent = formatRpC(expense);
  const wc = $('#dash-wallet-count');
  if (wc) wc.textContent = APP.wallets.length + ' dompet';

  // Month summary cards
  const todayTxs = APP.transactions.filter(t=>t.date===todayStr()&&t.type==='expense');
  const todayExp = todayTxs.reduce((s,t)=>s+t.amount,0);
  const dashSav = $('#dash-savings'), dashSavR = $('#dash-savings-rate');
  const dashTodExp = $('#dash-today-exp'), dashTodTx = $('#dash-today-tx');
  if(dashSav){ dashSav.textContent = formatRpC(savings); dashSav.style.color = savings>=0?'var(--income)':'var(--expense)'; }
  if(dashSavR) dashSavR.textContent = 'Savings rate: '+savRate+'%';
  if(dashTodExp) dashTodExp.textContent = formatRpC(todayExp);
  if(dashTodTx) dashTodTx.textContent = todayTxs.length+' transaksi';

  // Savings ring
  const sbcRate = $('#dash-sbc-rate'), sbcDesc = $('#dash-sbc-desc'), ringFill = $('#dash-ring-fill');
  if(sbcRate) sbcRate.textContent = savRate+'%';
  if(sbcRate) sbcRate.style.color = savRate>=30?'var(--income)':savRate>=10?'var(--warn)':'var(--expense)';
  if(sbcDesc) sbcDesc.textContent = savRate>=30?'Bagus! Pertahankan 💪':savRate>=10?'Lumayan, bisa lebih baik':'Perlu perhatian lebih';
  if(ringFill){ const circ=138.2; ringFill.style.strokeDashoffset = circ - (Math.min(savRate,100)/100)*circ; }

  // Quick Insights
  let totalHutang=0, totalPiutang=0;
  APP.debts.forEach(d => {
    const remaining = d.amount - (d.paidAmount||0);
    if (d.dtype==='borrowed') totalHutang += remaining; else totalPiutang += remaining;
  });
  const qiDebtVal = $('#qi-debt-val');
  if (qiDebtVal) qiDebtVal.textContent = (totalHutang||totalPiutang) ? `${formatRpC(totalHutang)} / ${formatRpC(totalPiutang)}` : 'Tidak ada';

  const bMonth = getBudgetMonth();
  const monthBudgets = APP.budgets.filter(b=>b.month===bMonth);
  const monthExpTxs  = APP.transactions.filter(t=>t.date.startsWith(bMonth)&&t.type==='expense');
  const qiBudgetVal = $('#qi-budget-val');
  if (qiBudgetVal) {
    if (!monthBudgets.length) { qiBudgetVal.textContent = 'Belum ada budget'; }
    else {
      const totalLimit = monthBudgets.reduce((s,b)=>s+b.limit,0);
      const totalUsed  = monthBudgets.reduce((s,b)=>s+monthExpTxs.filter(t=>t.catId===b.cat).reduce((ss,t)=>ss+t.amount,0),0);
      const pct = totalLimit>0 ? Math.round((totalUsed/totalLimit)*100) : 0;
      qiBudgetVal.textContent = `${pct}% terpakai`;
      qiBudgetVal.style.color = pct>=100?'var(--expense)':pct>=80?'var(--warn)':'var(--txt-primary)';
    }
  }

  const totalSavingsBuckets = APP.savingBuckets.reduce((s,b)=>s+getBucketBalance(b.id),0);
  const qiSavVal = $('#qi-savings-val');
  if (qiSavVal) qiSavVal.textContent = formatRpC(totalSavingsBuckets);

  const topCatMap = {};
  monthExpTxs.filter(t=>t.catId!=='saving_transfer').forEach(t=>{ topCatMap[t.catId]=(topCatMap[t.catId]||0)+t.amount; });
  let topCatId=null, topCatAmt=0;
  Object.entries(topCatMap).forEach(([id,amt])=>{ if(amt>topCatAmt){topCatAmt=amt; topCatId=id;} });
  const qiTopVal = $('#qi-topcat-val');
  if (qiTopVal) {
    if (!topCatId) qiTopVal.textContent = 'Belum ada data';
    else { const tc=getCatList('expense').find(c=>c.id===topCatId); qiTopVal.textContent = `${tc?.emoji||'💸'} ${tc?.name||'Lainnya'} · ${formatRpC(topCatAmt)}`; }
  }

  // Wallet chips
  const wsr = $('#wallet-scroll-row');
  wsr.innerHTML = APP.wallets.map(w => {
    const bal = walletStats[w.id]?.balance || 0;
    return `<div class="wallet-chip">
      <span class="wc-emoji">${w.emoji}</span>
      <div>
        <div class="wc-name">${escapeHtml(w.name)}</div>
        <div class="wc-bal" style="color:${bal>=0?'var(--income)':'var(--expense)'}">${formatRpC(bal)}</div>
      </div>
    </div>`;
  }).join('') + `<div class="wallet-chip" id="add-wallet-chip" style="border-style:dashed;min-width:54px;justify-content:center;"><span style="font-size:1.3rem;color:var(--txt-muted)">+</span></div>`;
  $('#add-wallet-chip')?.addEventListener('click', () => openWalletSheet());

  // Recent transactions
  const recent = filterTx(APP.dashFilter, 'all', '').slice(0, 12);
  $('#dashboard-list').innerHTML = recent.length
    ? recent.map((t,i) => txItemHTML(t, i*30)).join('')
    : emptyState('💸','Belum ada transaksi','Ketuk + untuk mencatat');
}

registerPage('dashboard', renderDashboard);
