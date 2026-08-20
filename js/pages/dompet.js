/* ================================================
   AZAR FINANCE — js/pages/dompet.js
   Dompet (wallets) page render.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, escapeHtml, formatRp, formatRpC, emptyState } from '../core/utils.js';
import { registerPage } from '../ui/nav.js';
import { computeWalletStats } from '../features/wallet.js';

export function renderDompet() {
  const stats = computeWalletStats();
  const total = APP.wallets.reduce((s,w) => s + (stats[w.id]?.balance||0), 0);
  $('#dompet-total').textContent = formatRp(total);
  $('#dompet-total').style.color = total>=0 ? 'var(--income)' : 'var(--expense)';
  $('#dompet-count-label').textContent = `${APP.wallets.length} dompet`;

  $('#wallet-list').innerHTML = APP.wallets.length
    ? APP.wallets.map((w,i) => {
        const st       = stats[w.id] || {balance:0,income:0,expense:0,count:0};
        const bal      = st.balance, txCount = st.count, inc = st.income, exp = st.expense;
        const isMain   = i===0;
        return `<div class="wallet-card" style="animation-delay:${i*50}ms">
          <div class="wcard-top">
            <div class="wcard-emoji">${w.emoji}</div>
            <div class="wcard-info">
              <div class="wcard-name">${escapeHtml(w.name)} ${isMain?'<span class="wcard-default-badge">Utama</span>':''}</div>
              <div class="wcard-count">${txCount} transaksi</div>
            </div>
            <div class="wcard-bal" style="color:${bal>=0?'var(--income)':'var(--expense)'}">${formatRp(bal)}</div>
          </div>
          <div class="wcard-stats">
            <div class="wcs-item"><div class="wcs-val income">+${formatRpC(inc)}</div><div class="wcs-label">Masuk</div></div>
            <div class="wcs-item"><div class="wcs-val expense">−${formatRpC(exp)}</div><div class="wcs-label">Keluar</div></div>
            <div class="wcs-item"><div class="wcs-val" style="color:${bal>=0?'var(--income)':'var(--expense)'}">=${formatRpC(bal)}</div><div class="wcs-label">Saldo</div></div>
          </div>
          <div class="wcard-actions">
            <button class="wcard-btn transfer" data-transfer="${w.id}">🔄 Transfer</button>
            <button class="wcard-btn edit" data-wallet-edit="${w.id}">✏️</button>
            ${!isMain?`<button class="wcard-btn del" data-wallet-del="${w.id}">🗑️</button>`:''}
          </div>
        </div>`;
      }).join('')
    : emptyState('👛','Belum ada dompet','Ketuk + untuk menambah dompet');
}

registerPage('dompet', renderDompet);
