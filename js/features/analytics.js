/* ================================================
   AZAR FINANCE — js/features/analytics.js
   Transaction filtering, totals, and aggregation helpers
   shared by the Dashboard, Riwayat, and Analitik pages.
   Not tied to a single UI page — pure data-shaping functions
   over APP.transactions.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   (This module wasn't in the original sprint-plan sketch —
   these helpers turned out not to belong to any single
   feature, so they're grouped here instead of being forced
   into transaction.js or duplicated across page modules.)
   ================================================ */
'use strict';

import { APP, getCatList } from '../core/state.js';
import { todayStr } from '../core/utils.js';

export function getDateRange(f) {
  const today = todayStr();
  if (f === 'today')  return { from:today, to:today };
  if (f === 'week')   { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return {from:d.toISOString().split('T')[0],to:today}; }
  if (f === 'month')  { const d = new Date(); return {from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:today}; }
  if (f === '3month') { const d = new Date(); d.setMonth(d.getMonth()-2); return {from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:today}; }
  if (f === '6month') { const d = new Date(); d.setMonth(d.getMonth()-5); return {from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:today}; }
  if (f === 'year')   return { from:`${new Date().getFullYear()}-01-01`, to:today };
  return null;
}

export function filterTx(dateF, typeF, search) {
  let list = [...APP.transactions];
  const r = getDateRange(dateF);
  if (r) list = list.filter(t => t.date >= r.from && t.date <= r.to);
  if (typeF === 'income')  list = list.filter(t => t.type === 'income');
  if (typeF === 'expense') list = list.filter(t => t.type === 'expense');
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(t => (t.desc||'').toLowerCase().includes(q)||(t.note||'').toLowerCase().includes(q));
  }
  list.sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return list;
}

// Money moved into/out of a savings bucket has its own type:'saving_transfer'
// (see features/saving.js) instead of masquerading as 'income'/'expense' —
// so every filter below that checks t.type==='income'/'expense' naturally
// excludes it already, with nothing extra to remember at each call site.
export function calcTotals(list) {
  let income=0, expense=0;
  list.forEach(t => { if(t.type==='income') income+=t.amount; else if(t.type==='expense') expense+=t.amount; });
  return {income, expense, saldo:income-expense};
}

export function getCat(type, id) {
  const arr = getCatList(type);
  return arr.find(c => c.id===id) || arr[arr.length-1];
}

export function getMonthlyData(months=6) {
  const result = [];
  for (let i = months-1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const txs = APP.transactions.filter(t => t.date.startsWith(mk) && t.type!=='transfer' && t.type!=='saving_transfer');
    result.push({
      month: mk,
      label: d.toLocaleDateString('id-ID',{month:'short'}),
      income:  txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
      expense: txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
    });
  }
  return result;
}

export function getCategoryBreakdown(dateFilter) {
  const r = getDateRange(dateFilter);
  const list = APP.transactions.filter(t => t.type==='expense' && (!r || (t.date>=r.from && t.date<=r.to)));
  const map = {};
  list.forEach(t => { const c = t.catId||'other_exp'; map[c]=(map[c]||0)+t.amount; });
  return Object.entries(map).map(([id,val]) => {
    const cat = getCatList('expense').find(c=>c.id===id) || {name:'Lainnya',emoji:'💸'};
    return {id, name:cat.name, emoji:cat.emoji, value:val};
  }).sort((a,b) => b.value-a.value);
}

export function getDayOfWeekData(dateFilter) {
  const r = getDateRange(dateFilter);
  const days = [0,0,0,0,0,0,0];
  APP.transactions
    .filter(t => t.type==='expense' && (!r || (t.date>=r.from && t.date<=r.to)))
    .forEach(t => { const d = new Date(t.date+'T00:00:00').getDay(); days[d]+=t.amount; });
  return days;
}

export function getAvgMonthly(type, n=3) {
  if (!APP.transactions.length) return 0;
  const months = new Set();
  for (let i=0; i<n; i++) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const list = APP.transactions.filter(t => t.type===type && months.has(t.date.slice(0,7)));
  if (!list.length) return 0;
  return Math.round(list.reduce((s,t)=>s+t.amount,0) / months.size);
}
