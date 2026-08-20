/* ================================================
   AZAR FINANCE — js/pages/hutang.js
   Hutang (debts/receivables) page render.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, escapeHtml, formatRp, formatRpC, formatDateShort, daysUntil, emptyState } from '../core/utils.js';
import { registerPage } from '../ui/nav.js';

export function renderHutang() {
  const f = APP.debtFilter || 'all';
  let list = [...APP.debts];
  if      (f === 'unpaid')  list = list.filter(d => !d.paid);
  else if (f === 'paid')    list = list.filter(d =>  d.paid);
  else if (f === 'urgent')  list = list.filter(d => !d.paid && d.dueDate && daysUntil(d.dueDate) <= 7);

  // Header stats
  const totalUnpaid = APP.debts
    .filter(d => !d.paid && d.dtype === 'borrowed')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);
  const htd = $('#hutang-total-display');
  if (htd) htd.textContent = formatRp(totalUnpaid);
  const hcU = $('#hc-unpaid'); if (hcU) hcU.textContent = APP.debts.filter(d => !d.paid).length;
  const hcP = $('#hc-paid');   if (hcP) hcP.textContent = APP.debts.filter(d =>  d.paid).length;
  const nearest = APP.debts.filter(d => !d.paid && d.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const hcN = $('#hc-nearest');
  if (hcN) {
    if (!nearest) { hcN.textContent = '-'; }
    else {
      const nd = daysUntil(nearest.dueDate);
      hcN.textContent = nd < 0 ? 'Lewat' : nd === 0 ? 'Hari ini' : nd + 'h';
    }
  }

  const dl = $('#debt-list'); if (!dl) return;
  if (!list.length) {
    dl.innerHTML = emptyState('💳',
      f === 'urgent' ? 'Tidak ada hutang mendesak' : 'Belum ada hutang',
      'Ketuk + untuk mencatat'); return;
  }

  list.sort((a, b) => {
    if (a.paid && !b.paid) return 1; if (!a.paid && b.paid) return -1;
    if (!a.dueDate) return 1; if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  dl.innerHTML = list.map((d, i) => {
    const remaining = d.amount - (d.paidAmount || 0);
    const pct       = d.amount > 0 ? Math.min(100, Math.round((d.paidAmount || 0) / d.amount * 100)) : 0;
    const days      = d.dueDate ? daysUntil(d.dueDate) : null;
    const isLent    = d.dtype === 'lent';
    const isUrgent  = !d.paid && days !== null && days <= 3;
    const isWarn    = !d.paid && days !== null && days > 3 && days <= 7;
    let dayLabel = '';
    if (days !== null) {
      if (days < 0)       dayLabel = `⚠️ Terlambat ${Math.abs(days)} hari`;
      else if (days === 0) dayLabel = '⚠️ Jatuh tempo hari ini';
      else                 dayLabel = `${formatDateShort(d.dueDate)} (${days} hari lagi)`;
    }
    const typeBadge   = `<span class="debt-type-badge ${d.dtype||'borrowed'}">${isLent?'Dipinjamkan':'Hutang'}</span>`;
    const statusBadge = d.paid
      ? `<span class="debt-badge paid-badge">✅ Lunas</span>`
      : isUrgent ? `<span class="debt-badge urgent-badge">🔴 Mendesak</span>`
      : isWarn   ? `<span class="debt-badge warn-badge">⚠️ Segera</span>`
      :             `<span class="debt-badge unpaid-badge">Belum Lunas</span>`;
    const payments = (d.payments || []).slice(-2).reverse();
    const paymentsHTML = payments.length ? `
      <div class="debt-payments-list">
        <div class="dpl-title">Riwayat Bayar</div>
        ${payments.map(p=>`<div class="dpl-item"><span class="dpl-date">${formatDateShort(p.date)}</span><span class="dpl-amt">-${formatRpC(p.amount)}</span></div>`).join('')}
      </div>` : '';
    return `<div class="debt-card${d.paid?' paid':isUrgent?' urgent':isWarn?' warning-level':''}" style="animation-delay:${i*40}ms">
      <div class="debt-top">
        <div class="debt-left">
          <div class="debt-name">${escapeHtml(d.name)} ${typeBadge}</div>
          ${d.note?`<div class="debt-note">${escapeHtml(d.note)}</div>`:''}
        </div>
        <div class="debt-badges">
          ${statusBadge}
          <span style="font-family:var(--font-mono);font-size:0.82rem;font-weight:700;color:${isLent?'var(--income)':'var(--expense)'}">${isLent?'+':'-'}${formatRpC(d.amount)}</span>
        </div>
      </div>
      <div class="debt-info-row">
        <div class="debt-info-item"><span class="dii-label">Sisa</span><span class="dii-val ${d.paid?'green':'red'}">${d.paid?'Lunas':formatRpC(remaining)}</span></div>
        <div class="debt-info-item"><span class="dii-label">Jatuh Tempo</span><span class="dii-val ${isUrgent?'red':isWarn?'orange':''}">${dayLabel||'-'}</span></div>
      </div>
      ${!d.paid?`<div class="debt-pay-progress">
        <div class="dpp-row"><span class="dpp-label">Terbayar ${formatRpC(d.paidAmount||0)} dari ${formatRpC(d.amount)}</span><span class="dpp-pct" style="color:${pct>=100?'var(--income)':pct>=50?'var(--warn)':'var(--expense)'}">${pct}%</span></div>
        <div class="dpp-bar"><div class="dpp-fill" style="width:${pct}%"></div></div>
      </div>`:''}
      ${paymentsHTML}
      <div class="debt-actions">
        ${!d.paid?`<button class="debt-action-btn lunas-btn" data-debt-pay="${d.id}">${isLent?'💰 Terima':'💳 Bayar'}</button>`:''}
        ${d.paid?`<button class="debt-action-btn unlunas-btn" data-debt-unlunas="${d.id}">↩ Batal Lunas</button>`:''}
        <button class="debt-action-btn edit-btn" data-debt-edit="${d.id}">✏️ Edit</button>
        <button class="debt-action-btn del-btn" data-debt-del="${d.id}">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

registerPage('hutang', renderHutang);
