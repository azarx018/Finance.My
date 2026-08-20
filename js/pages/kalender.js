/* ================================================
   AZAR FINANCE — js/pages/kalender.js
   Kalender (financial calendar) page render + the
   day-detail agenda sub-render.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP, getCatList } from '../core/state.js';
import { $, $$, escapeHtml, formatDate, formatRpC, todayStr, showToast } from '../core/utils.js';
import { persist } from '../core/db.js';
import { registerPage } from '../ui/nav.js';

export function renderKalender() {
  const y=APP.calYear, m=APP.calMonth;
  const monthNames=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const lbl=$('#cal-month-label'); if(lbl) lbl.textContent=monthNames[m]+' '+y;

  const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay=new Date(y,m+1,0).getDate();
  const to=`${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const monthTxs=APP.transactions.filter(t=>t.date>=from&&t.date<=to);
  const monthRem=APP.reminders.filter(r=>r.date>=from&&r.date<=to);
  const mInc=monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const mExp=monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  const calMI=$('#cal-month-income'),calME=$('#cal-month-expense'),calMC=$('#cal-month-count');
  if(calMI) calMI.textContent=formatRpC(mInc);
  if(calME) calME.textContent=formatRpC(mExp);
  if(calMC) calMC.textContent=monthRem.length; // show reminders count

  // Build maps
  const txByDate={}, remByDate={};
  monthTxs.forEach(t=>{
    if(!txByDate[t.date]) txByDate[t.date]={income:0,expense:0};
    if(t.type==='income') txByDate[t.date].income+=t.amount;
    if(t.type==='expense') txByDate[t.date].expense+=t.amount;
  });
  monthRem.forEach(r=>{
    if(!remByDate[r.date]) remByDate[r.date]=0;
    remByDate[r.date]++;
  });

  const firstDow=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const daysInPrev=new Date(y,m,0).getDate();
  const todayS=todayStr();
  let html='';
  for(let i=firstDow-1;i>=0;i--){
    html+=`<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev-i}</div></div>`;
  }
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayData=txByDate[ds]; const hasRem=remByDate[ds]>0;
    const isToday=ds===todayS, isSel=ds===APP.calSelectedDate;
    let dots='';
    if(dayData){
      if(dayData.income>0)  dots+=`<div class="cal-dot income"></div>`;
      if(dayData.expense>0) dots+=`<div class="cal-dot expense"></div>`;
    }
    if(hasRem) dots+=`<div class="cal-dot reminder"></div>`;
    html+=`<div class="cal-day${isToday?' today':''}${isSel?' selected':''}" data-date="${ds}">
      <div class="cal-day-num">${d}</div>
      <div class="cal-day-dots">${dots}</div>
    </div>`;
  }
  const total=firstDow+daysInMonth;
  const remainder=total%7===0?0:7-(total%7);
  for(let d=1;d<=remainder;d++){
    html+=`<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }
  const calDays=$('#cal-days'); if(calDays) calDays.innerHTML=html;
  $$('#cal-days .cal-day:not(.other-month)').forEach(el=>{
    el.addEventListener('click',()=>{
      APP.calSelectedDate=el.dataset.date;
      $$('#cal-days .cal-day').forEach(e=>e.classList.remove('selected'));
      el.classList.add('selected');
      renderKalenderDetail();
    });
  });
  renderKalenderDetail();
}

export function renderKalenderDetail() {
  const ds=APP.calSelectedDate;
  const label=$('#cal-selected-label');
  if(label) label.textContent = ds ? formatDate(ds) : 'Pilih tanggal';
  const list=$('#cal-agenda-list'); if(!list) return;
  if(!ds){ list.innerHTML=`<div class="empty-state" style="padding:16px 0"><div class="empty-icon">📅</div><p>Pilih tanggal di kalender</p></div>`; return; }

  const dayTxs=APP.transactions.filter(t=>t.date===ds);
  const dayRems=APP.reminders.filter(r=>r.date===ds);
  const total=dayTxs.length+dayRems.length;

  if(!total){ list.innerHTML=`<div class="empty-state" style="padding:14px 0"><div class="empty-icon">📭</div><p>Tidak ada agenda</p><span>Ketuk "+ Pengingat" atau "+ Catat"</span></div>`; return; }

  // Reminders first
  const remHTML=dayRems.map(r=>`
    <div class="cal-reminder-item">
      <div class="cal-reminder-icon">🔔</div>
      <div class="cal-reminder-info">
        <div class="cal-reminder-title">${escapeHtml(r.title)}</div>
        ${r.amount?`<div class="cal-reminder-amt">${formatRpC(r.amount)}</div>`:''}
      </div>
      <button class="cal-reminder-del" data-rid="${r.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
    </div>`).join('');

  // Transactions
  const txHTML=dayTxs.map(t=>{
    // Same display mapping as txItemHTML: a saving_transfer withdraw or a
    // debt_transfer 'in' looks like income; deposit/'out' looks like expense
    // — driven by `direction`, not `type`, so it stays excluded from real
    // income/expense stats.
    const dispType = t.type==='saving_transfer' ? (t.direction==='withdraw'?'income':'expense')
                    : t.type==='debt_transfer'   ? (t.direction==='in'?'income':'expense')
                    : t.type;
    const cats=getCatList(dispType==='income'?'income':'expense');
    const cat=cats.find(c=>c.id===t.catId)||{emoji:'💸',name:t.catId};
    return `<div class="cal-tx-item">
      <div class="cal-tx-dot ${dispType}">${cat.emoji}</div>
      <div class="cal-tx-info">
        <div class="cal-tx-desc">${escapeHtml(t.desc)||'Transaksi'}</div>
        <div class="cal-tx-cat">${cat.name}</div>
      </div>
      <div class="cal-tx-amt ${dispType}">${dispType==='income'?'+':'-'}${formatRpC(t.amount)}</div>
    </div>`;
  }).join('');

  list.innerHTML=remHTML+txHTML;

  $$('#cal-agenda-list .cal-reminder-del').forEach(btn=>btn.addEventListener('click',()=>{
    APP.reminders=APP.reminders.filter(r=>r.id!==btn.dataset.rid);
    persist(); renderKalender(); showToast('Pengingat dihapus','info');
  }));
}

registerPage('kalender', renderKalender);
