/* ================================================
   AZAR FINANCE — js/ui/sheets.js
   Generic bottom-sheet open/close control. Purely
   structural DOM toggling — no knowledge of what's
   inside any given sheet.
   Extracted from script.js v5.6 — Sprint 3 (see log.md)
   ================================================ */
'use strict';

import { $ } from '../core/utils.js';

// ===================== SHEET CONTROL =====================
export function openSheet(name)  { $(`#${name}-backdrop`)?.classList.add('open');    $(`#sheet-${name}`)?.classList.add('open');    document.body.style.overflow='hidden'; }
export function closeSheet(name) { $(`#${name}-backdrop`)?.classList.remove('open'); $(`#sheet-${name}`)?.classList.remove('open'); document.body.style.overflow=''; }
