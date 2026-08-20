/* ================================================
   AZAR FINANCE — js/ui/nav.js
   Page router: switches the active .page, updates the
   bottom-nav highlight/back-button/FAB, sets the header
   title, and triggers that page's render.

   NOTE — architecture decision (see log.md Sprint 3): the
   original navigateTo() directly called renderDashboard(),
   renderAnalitik(), etc. by name. Those functions don't
   exist as importable modules yet (planned for Sprint 5),
   and won't be initialized until Sprint 6 — importing them
   here now would either break (files don't exist) or create
   a circular dependency later (pages would need to import
   nav.js for openSheet/closeSheet, while nav.js would import
   pages to render them).

   Fix: a small registry. Each page module will call
   registerPage('dashboard', renderDashboard) once, when it's
   created in Sprint 5. nav.js only ever calls through the
   registry, never imports a page module directly. Behavior
   is identical to the original once every page has
   registered — this is a wiring-order change, not a logic
   change.

   The same problem applies to the one non-page side effect
   navigateTo had (refreshing the "last backup" label when the
   Settings page is shown, via getAutoBackupLastDate() from
   the future features/backup.js). That's handled the same
   way, via setOnSettingsShown().
   Extracted from script.js v5.6 — Sprint 3 (see log.md)
   ================================================ */
'use strict';

import { $, $$ } from '../core/utils.js';
import { APP } from '../core/state.js';

export const SUB_PAGES = ['dompet', 'hutang', 'settings', 'kalender'];

const pageRenderers = {};
// Called by each page module (Sprint 5) to register its render function,
// e.g. registerPage('dashboard', renderDashboard).
export function registerPage(name, renderFn) { pageRenderers[name] = renderFn; }

let _onSettingsShown = null;
// Called once by features/backup.js (Sprint 4) to hook the Settings-page
// "last backup" label refresh, without nav.js needing to import backup.js.
export function setOnSettingsShown(fn) { _onSettingsShown = fn; }

export function navigateTo(page, fromNav=false) {
  if (APP.currentPage === page) return;
  $(`#page-${APP.currentPage}`)?.classList.remove('active');
  APP.prevPage = fromNav ? null : APP.currentPage;
  APP.currentPage = page;
  $(`#page-${page}`)?.classList.add('active');

  const isSubPage = SUB_PAGES.includes(page);
  $$('.nav-item').forEach(n => {
    const np = n.dataset.page;
    const isActive = np===page
      || (isSubPage && np==='lainnya' && !['laporan','kalender','budget'].includes(page));
    n.classList.toggle('active', isActive);
  });
  const titles = {dashboard:'Dashboard',analitik:'Analitik & Laporan',riwayat:'Transaksi',dompet:'Dompet',lainnya:'Lainnya',impian:'Tabungan',hutang:'Hutang',settings:'Pengaturan',laporan:'Budget Manager',kalender:'Kalender Keuangan',budget:'Budget Manager'};
  $('#page-title').textContent = titles[page] || '';

  const showBack = isSubPage;
  $('#back-btn').style.display    = showBack ? '' : 'none';
  $('#header-logo').style.display = showBack ? 'none' : '';

  const fab = $('#fab-btn');
  fab.className = 'fab';
  if (page==='settings'||page==='lainnya'||page==='laporan'||page==='kalender'||page==='dashboard'||page==='budget'||page==='impian') fab.style.display='none';
  else if (page==='dompet') { fab.style.display=''; fab.classList.add('wallet-fab'); }
  else if (page==='hutang') { fab.style.display=''; fab.classList.add('expense-fab'); }
  else fab.style.display='';

  pageRenderers[page]?.();

  if (page==='settings') _onSettingsShown?.();
}

// Re-runs the currently-visible page's render function — used after an edit/
// delete that only affects data the current page shows. Uses the same
// registry as navigateTo(), so it requires no separate wiring: whatever
// registerPage() calls a page module made are reused here automatically.
// NOTE: the original refreshCurrentPage() special-cased 'laporan'/'budget'
// to always call renderBudget() together. That's preserved for free here IF
// the future pages/budget.js module registers renderBudget under BOTH
// 'laporan' and 'budget' keys (both page names route to the same Budget
// Manager UI) — see Sprint 5 notes in log.md.
export function refreshCurrentPage() { pageRenderers[APP.currentPage]?.(); }

// Re-runs one or more specific pages' render functions regardless of which
// page is currently visible — used when a change (e.g. editing a wallet)
// needs to update more than one page's cached view at once, matching what
// several of the original script.js handlers did (e.g. `renderDompet();
// renderDashboard();` after a wallet edit).
export function refreshPages(...names) { names.forEach(n => pageRenderers[n]?.()); }
