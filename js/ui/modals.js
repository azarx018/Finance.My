/* ================================================
   AZAR FINANCE — js/ui/modals.js
   Generic modal mechanics: a reusable yes/no confirm
   dialog (askConfirm) and the delete-confirmation modal's
   open step (openDeleteModal).

   NOTE — scope decision (see log.md Sprint 3): the original
   confirmDelete() function is intentionally NOT included
   here. It looks like modal UI code (it's wired to the same
   "#modal-delete" element) but its actual job is a per-type
   business-logic dispatcher — it directly mutates
   transactions/goals/debts/wallets/buckets and calls
   6+ different page render functions depending on what was
   deleted. That's a feature/orchestration concern, not a
   generic UI concern, and it can't be extracted correctly
   until the feature modules (Sprint 4) and page render
   modules (Sprint 5) it depends on exist. It stays in
   script.js for now and is planned for Sprint 6, alongside
   app.js, where all of those pieces are finally wired
   together.
   Extracted from script.js v5.6 — Sprint 3 (see log.md)
   ================================================ */
'use strict';

import { $ } from '../core/utils.js';
import { APP } from '../core/state.js';

let _pendingConfirmResolve = null;

// ===================== GENERIC CONFIRM DIALOG =====================
export function askConfirm(message, {title='Konfirmasi', icon='❓'}={}) {
  return new Promise(resolve => {
    _pendingConfirmResolve = resolve;
    $('#modal-generic-title').textContent = title;
    $('#modal-generic-icon').textContent  = icon;
    $('#modal-generic-msg').textContent   = message;
    $('#modal-generic-confirm').style.display = 'flex';
  });
}
export function _resolveConfirm(val) {
  $('#modal-generic-confirm').style.display = 'none';
  if (_pendingConfirmResolve) { _pendingConfirmResolve(val); _pendingConfirmResolve = null; }
}

// ===================== DELETE MODAL (open step only — see note above) =====================
export function openDeleteModal(type, id, msg='Tindakan ini tidak dapat dibatalkan.') {
  APP.deleteTarget = {type,id};
  $('#modal-delete-msg').textContent = msg;
  $('#modal-delete').style.display = 'flex';
}
