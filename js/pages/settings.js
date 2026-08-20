/* ================================================
   AZAR FINANCE — js/pages/settings.js
   The Settings page itself has no dedicated render function
   in the original app (its toggles are wired once in init()).
   The only per-visit behavior is refreshing the "last backup"
   label, which originally lived inline inside navigateTo()'s
   `if (page==='settings')` branch. Moved here and wired
   through setOnSettingsShown() (added to js/ui/nav.js in
   Sprint 3 for exactly this purpose), so nav.js still never
   has to import a feature module directly.
   Extracted from script.js v5.6 — Sprint 5 (see log.md)
   ================================================ */
'use strict';

import { $ } from '../core/utils.js';
import { setOnSettingsShown } from '../ui/nav.js';
import { getAutoBackupLastDate } from '../features/backup.js';

function refreshBackupLabel() {
  const last = getAutoBackupLastDate();
  const el = $('#backup-last-desc');
  if (el) el.textContent = last ? `Backup terakhir: ${last} · auto setiap 7 hari` : 'Auto backup setiap 7 hari';
}

setOnSettingsShown(refreshBackupLabel);
