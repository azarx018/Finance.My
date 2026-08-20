/* ================================================
   AZAR FINANCE — js/pages/budget.js
   Budget Manager page render.

   NOTE: the original app has TWO page names for this same
   screen — 'laporan' and 'budget' — both dispatching to the
   same renderBudget(). Registered under both keys here so
   navigateTo('laporan')/navigateTo('budget') and
   refreshCurrentPage() all resolve correctly regardless of
   which name is showing. See js/ui/nav.js and log.md Sprint 5.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, $$, formatRpC, showToast, emptyState } from '../core/utils.js';
import { persist } from '../core/db.js';
import { registerPage } from '../ui/nav.js';
import { getCatList } from '../core/state.js';
import { getBudgetMonth, getBudgetMonthLabel, openBudgetSheet } from '../features/budget.js';

export function renderBudget() {
  const month = getBudgetMonth();
  const budgets = APP.budgets.filter(b=>b.month===month);
  const monthTxs = APP.transactions.filter(t=>t.date.startsWith(month)&&t.type==='expense');

  // Totals
  const totalLimit = budgets.reduce((s,b)=>s+b.limit,0);
  const totalUsed  = budgets.reduce((s,b)=>{
    const used=monthTxs.filter(t=>t.catId===b.cat).reduce((ss,t)=>ss+t.amount,0);
    return s+Math.min(used,b.limit);
  },0);
  const totalActualUsed = budgets.reduce((s,b)=>{
    return s+monthTxs.filter(t=>t.catId===b.cat).reduce((ss,t)=>ss+t.amount,0);
  },0);
  const totalRemain = totalLimit - totalActualUsed;
  const pct = totalLimit>0 ? Math.round((totalActualUsed/totalLimit)*100) : 0;

  const lbl=$('#budget-month-label'); if(lbl) lbl.textContent=getBudgetMonthLabel();
  const bt=$('#budget-total'),bu=$('#budget-used'),br=$('#budget-remain');
  if(bt) bt.textContent=formatRpC(totalLimit);
  if(bu) bu.textContent=formatRpC(totalActualUsed);
  if(br){ br.textContent=formatRpC(Math.max(0,totalRemain)); br.style.color=totalRemain<0?'var(--expense)':'var(--income)'; }

  // Overall progress card
  const clss = pct>=90?'danger':pct>=70?'warn':'safe';
  const tips = pct>=90?'⚠️ Budget hampir habis! Hemat pengeluaran.':pct>=70?'💡 Sudah lebih dari 70%, perhatikan pengeluaran.':'✅ Budget masih aman, terus pertahankan!';
  const boc=$('#budget-overall-card');
  if(boc) boc.innerHTML=`
    <div class="boc-row"><span class="boc-label">Total terpakai ${pct}%</span><span class="boc-pct" style="color:${pct>=90?'var(--expense)':pct>=70?'var(--warn)':'var(--income)'}">${formatRpC(totalActualUsed)} / ${formatRpC(totalLimit)}</span></div>
    <div class="boc-bar"><div class="boc-fill ${clss}" style="width:${Math.min(pct,100)}%"></div></div>
    <div class="boc-tips">${tips}</div>`;

  // Budget list per category
  const bl=$('#budget-list');
  if(!bl) return;
  if(!budgets.length){
    bl.innerHTML=`<div class="empty-state"><div class="empty-icon">💰</div><p>Belum ada budget</p><span>Ketuk "+ Tambah" untuk mulai</span></div>`;
  } else {
    bl.innerHTML=budgets.map(b=>{
      const cat=getCatList('expense').find(c=>c.id===b.cat)||{name:b.cat,emoji:'💸'};
      const used=monthTxs.filter(t=>t.catId===b.cat).reduce((s,t)=>s+t.amount,0);
      const remain=b.limit-used;
      const bpct=b.limit>0?Math.round((used/b.limit)*100):0;
      const bcls=bpct>=90?'danger':bpct>=70?'warn':'safe';
      const rbadge=bpct>=100?'over':bpct>=70?'warn':'ok';
      const rlabel=bpct>=100?'OVER BUDGET':bpct>=70?'Hampir Habis':'Aman';
      return `<div class="budget-item ${bpct>=90?'over':bpct>=70?'warn':''}">
        <div class="bi-top">
          <div class="bi-emoji">${cat.emoji}</div>
          <div class="bi-info">
            <div class="bi-cat">${cat.name}</div>
            <div class="bi-used">${formatRpC(used)} dari ${formatRpC(b.limit)}</div>
          </div>
          <div class="bi-right">
            <div class="bi-remain ${remain<0?'over':bpct>=70?'warn':'ok'}">${remain<0?'-':''}${formatRpC(Math.abs(remain))}</div>
            <div class="bi-badge ${rbadge}">${rlabel}</div>
          </div>
        </div>
        <div class="bi-bar"><div class="bi-bar-fill ${bcls}" style="width:${Math.min(bpct,100)}%"></div></div>
        <div class="bi-actions">
          <button class="bi-action-btn edit" data-bid="${b.id}">✏️ Edit</button>
          <button class="bi-action-btn del" data-bid="${b.id}">🗑️</button>
        </div>
      </div>`;
    }).join('');
    // listeners
    $$('#budget-list .bi-action-btn.edit').forEach(btn=>btn.addEventListener('click',()=>openBudgetSheet(btn.dataset.bid)));
    $$('#budget-list .bi-action-btn.del').forEach(btn=>btn.addEventListener('click',()=>{
      APP.budgets=APP.budgets.filter(b=>b.id!==btn.dataset.bid);
      persist(); renderBudget(); showToast('Budget dihapus','info');
    }));
  }

  // Untracked spending (expense categories with no budget)
  const budgetedCats=budgets.map(b=>b.cat);
  const catMap={};
  monthTxs.filter(t=>!budgetedCats.includes(t.catId)).forEach(t=>{
    const cat=getCatList("expense").find(c=>c.id===t.catId)||{name:"Lainnya",emoji:"💸"};
    if(!catMap[t.catId]) catMap[t.catId]={name:cat.name,emoji:cat.emoji,total:0};
    catMap[t.catId].total+=t.amount;
  });
  const untracked=Object.values(catMap).sort((a,b)=>b.total-a.total);
  const utl=$('#budget-untracked-list');
  if(utl){
    if(!untracked.length){ utl.innerHTML=`<div style="font-size:0.78rem;color:var(--txt-muted);padding:6px 0">✅ Semua pengeluaran sudah punya budget</div>`; }
    else { utl.innerHTML=untracked.map(c=>`
      <div class="lap-cat-item">
        <span class="lap-cat-emoji">${c.emoji}</span>
        <div class="lap-cat-info">
          <div class="lap-cat-name">${c.name}</div>
          <div class="lap-cat-bar-bg" style="background:var(--warn-bg)"><div class="lap-cat-bar-fill" style="background:linear-gradient(90deg,var(--warn),#fbbf24);width:60%"></div></div>
        </div>
        <span class="lap-cat-amt" style="color:var(--warn)">${formatRpC(c.total)}</span>
      </div>`).join(''); }
  }
}

registerPage('laporan', renderBudget);
registerPage('budget', renderBudget);
