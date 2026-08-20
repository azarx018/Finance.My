/* ================================================
   AZAR FINANCE — js/pages/analitik.js
   Analitik (analytics/reports) page render.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP, getCatList } from '../core/state.js';
import { $, formatRp, formatRpC, formatDateShort, escapeHtml } from '../core/utils.js';
import { registerPage } from '../ui/nav.js';
import { Charts } from '../charts.js';
import {
  getDateRange, calcTotals, getAvgMonthly, getMonthlyData,
  getCategoryBreakdown, getDayOfWeekData,
} from '../features/analytics.js';

export function renderAnalitik() {
  const prd  = APP.analitikPeriod;
  const r    = getDateRange(prd);
  const list = APP.transactions.filter(t => (!r || (t.date>=r.from && t.date<=r.to)) && t.type!=='transfer');
  const {income, expense, saldo} = calcTotals(list);
  const avgInc = getAvgMonthly('income',3);
  const savRate = income>0 ? Math.round((saldo/income)*100) : 0;
  const allTxs = APP.transactions.filter(t => !r || (t.date>=r.from && t.date<=r.to));
  const days = r ? Math.max(1,Math.ceil((new Date(r.to)-new Date(r.from))/86400000)) : 30;
  const avgDay = Math.round(expense/days);

  // Header card
  const anPL=$('#an-period-label'),anSR=$('#an-savrate'),anNet=$('#an-net'),anTx=$('#an-txcount');
  if(anPL) anPL.textContent = prd==='month'?'Bulan Ini':prd==='3month'?'3 Bulan Terakhir':prd==='6month'?'6 Bulan Terakhir':'Tahun Ini';
  if(anSR) anSR.textContent = savRate+'%';
  if(anNet){ anNet.textContent=formatRpC(saldo); anNet.style.color=saldo>=0?'rgba(255,255,255,0.9)':'#fca5a5'; }
  if(anTx) anTx.textContent = allTxs.length;

  // Category breakdown (donut + bar list, digabung)
  const catMap={};
  list.filter(t=>t.type==='expense').forEach(t=>{
    const cat=getCatList("expense").find(c=>c.id===t.catId)||{name:"Lainnya",emoji:"💸"};
    if(!catMap[t.catId]) catMap[t.catId]={name:cat.name,emoji:cat.emoji,total:0};
    catMap[t.catId].total+=t.amount;
  });
  const catBrk=Object.values(catMap).sort((a,b)=>b.total-a.total).slice(0,6);
  const maxCat=catBrk[0]?.total||1;
  const lapCat=$('#lap-cat-items');
  if(lapCat) lapCat.innerHTML=catBrk.length?catBrk.map(c=>`
    <div class="lap-cat-item">
      <span class="lap-cat-emoji">${c.emoji}</span>
      <div class="lap-cat-info">
        <div class="lap-cat-name">${c.name}</div>
        <div class="lap-cat-bar-bg"><div class="lap-cat-bar-fill" style="width:${Math.round((c.total/maxCat)*100)}%"></div></div>
      </div>
      <span class="lap-cat-amt">${formatRpC(c.total)}</span>
    </div>`).join(''):'<div style="color:var(--txt-muted);font-size:0.8rem;padding:6px 0">Belum ada pengeluaran</div>';

  const avgExp = getAvgMonthly('expense',3);

  // Compare this month vs last month expenses
  const now  = new Date();
  const last = new Date(); last.setMonth(last.getMonth()-1);
  const thisKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const lastKey = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}`;
  const thisMExp = APP.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(thisKey)).reduce((s,t)=>s+t.amount,0);
  const lastMExp = APP.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(lastKey)).reduce((s,t)=>s+t.amount,0);
  const expChg   = lastMExp ? Math.round((thisMExp-lastMExp)/lastMExp*100) : 0;
  const expChgTxt= expChg>0 ? `▲ ${expChg}% vs bulan lalu` : expChg<0 ? `▼ ${Math.abs(expChg)}% vs bulan lalu` : 'Sama dgn bulan lalu';
  const expCls   = expChg>0 ? 'down' : expChg<0 ? 'up' : '';
  $('#analitik-stats').innerHTML = `
    <div class="analitik-stat-card"><div class="asc-label">Pemasukan</div><div class="asc-val green">${formatRpC(income)}</div><div class="asc-sub">periode dipilih</div></div>
    <div class="analitik-stat-card"><div class="asc-label">Pengeluaran</div><div class="asc-val red">${formatRpC(expense)}</div><div class="asc-sub ${expCls}">${expChgTxt}</div></div>
    <div class="analitik-stat-card"><div class="asc-label">Net Tabungan</div><div class="asc-val ${saldo>=0?'green':'red'}">${formatRpC(saldo)}</div><div class="asc-sub">pemasukan − pengeluaran</div></div>
    <div class="analitik-stat-card"><div class="asc-label">Rata-rata Pemasukan</div><div class="asc-val">${formatRpC(avgInc)}</div><div class="asc-sub">per bulan (3 bln)</div></div>
  `;

  // Savings rate card
  const rate = income>0 ? Math.round(saldo/income*100) : 0;
  const rEmoji = rate>=30?'🚀':rate>=15?'✅':rate>=0?'⚠️':'❌';
  const rDesc  = rate>=30?'Luar biasa! Kamu menabung dengan sangat baik.':rate>=15?'Bagus! Terus pertahankan.':rate>=0?'Perlu ditingkatkan lagi.':'Pengeluaran melebihi pemasukan!';
  const rColor = rate>=15?'var(--income)':rate>=0?'var(--warn)':'var(--expense)';
  const rFill  = rate>=15?'linear-gradient(90deg,#22c55e,#86efac)':rate>=0?'linear-gradient(90deg,#f97316,#fbbf24)':'linear-gradient(90deg,#f43f5e,#fda4af)';
  $('#savings-rate-card').innerHTML = `
    <div class="src-emoji">${rEmoji}</div>
    <div class="src-info">
      <div class="src-label">Tingkat Tabungan (Savings Rate)</div>
      <div class="src-rate" style="color:${rColor}">${rate}%</div>
      <div class="src-desc">${rDesc}</div>
    </div>
    <div class="src-bar-wrap">
      <div class="src-bar-bg"><div class="src-bar-fill" style="width:${Math.max(0,Math.min(100,rate))}%;background:${rFill}"></div></div>
    </div>`;

  // Bar chart
  const months = prd==='year'?12 : prd==='6month'?6 : prd==='3month'?3 : 6;
  const mdata  = getMonthlyData(months);
  $('#bar-chart-subtitle').textContent = `${months} bulan terakhir`;
  setTimeout(() => { const c=$('#chart-bar'); if(c) Charts.bar(c, mdata); }, 60);

  // Donut chart
  const cats    = getCategoryBreakdown(prd);
  const DCOLORS = ['#22c55e','#f43f5e','#60a5fa','#f97316','#a855f7','#14b8a6','#fbbf24','#e879f9'];
  setTimeout(() => { const c=$('#chart-donut'); if(c) Charts.donut(c, cats.slice(0,8)); }, 60);
  const catTotal = cats.reduce((s,c)=>s+c.value,0);
  $('#donut-legend').innerHTML = cats.slice(0,8).map((c,i)=>
    `<div class="donut-item">
      <div class="donut-dot" style="background:${DCOLORS[i%DCOLORS.length]}"></div>
      <div class="donut-name">${c.emoji} ${c.name}</div>
      <div class="donut-val">${catTotal?Math.round(c.value/catTotal*100):0}%</div>
    </div>`).join('') || `<div style="color:var(--txt-muted);font-size:0.8rem">Belum ada pengeluaran</div>`;
  $('#donut-period-label').textContent = 'periode dipilih';

  // Day heatmap
  const dayData  = getDayOfWeekData(prd);
  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const maxDay   = Math.max(...dayData, 1);
  $('#day-heatmap').innerHTML = dayNames.map((d,i) => {
    const pct   = Math.max(4, dayData[i]/maxDay*100);
    const isMax = dayData[i]===Math.max(...dayData) && dayData[i]>0;
    return `<div class="day-col">
      <div class="day-bar-wrap"><div class="day-bar ${isMax?'max':'active'}" style="height:${pct}%"></div></div>
      <div class="day-label">${d}</div>
      <div class="day-amount">${formatRpC(dayData[i]).replace('Rp ','')}</div>
    </div>`;
  }).join('');

  // Top expenses
  const topExp = APP.transactions
    .filter(t => t.type==='expense' && (!r || (t.date>=r.from && t.date<=r.to)))
    .sort((a,b) => b.amount-a.amount).slice(0,5);
  $('#top-expenses-list').innerHTML = topExp.length
    ? topExp.map((t,i) => `<div class="top-exp-item">
        <div class="top-exp-rank">#${i+1}</div>
        <div class="top-exp-info"><div class="top-exp-desc">${escapeHtml(t.desc)}</div><div class="top-exp-date">${formatDateShort(t.date)}</div></div>
        <div class="top-exp-amt">${formatRp(t.amount)}</div>
      </div>`).join('')
    : `<div style="color:var(--txt-muted);font-size:0.8rem;padding:8px 0">Belum ada pengeluaran</div>`;
}

registerPage('analitik', renderAnalitik);
