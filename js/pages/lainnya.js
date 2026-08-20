/* ================================================
   AZAR FINANCE — js/pages/lainnya.js
   Lainnya (hub/more menu) page render.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, formatRpC } from '../core/utils.js';
import { registerPage } from '../ui/nav.js';

export function renderLainnya() {
  const dompetSub = $('#hub-dompet-sub');
  if(dompetSub) dompetSub.textContent = `${APP.wallets.length} dompet`;
  const hutangSub = $('#hub-hutang-sub');
  if(hutangSub) hutangSub.textContent = formatRpC(APP.debts.filter(d=>!d.paid).reduce((s,d)=>s+d.amount,0));
}

registerPage('lainnya', renderLainnya);
