/* ================================================
   AZAR FINANCE — js/core/utils.js
   Pure helper functions: DOM shorthands, formatters,
   HTML escaping, toast notifications, input formatting.
   No dependency on app state or storage — safe to import
   from anywhere.
   Extracted from script.js v5.6 — Sprint 2 (see log.md)
   ================================================ */
'use strict';

// ===================== SECURITY: HTML ESCAPING =====================
// User-supplied text (description, notes, wallet/debt/goal names, etc.)
// is rendered via innerHTML throughout this app. Always pass such text
// through escapeHtml() before interpolating it into a template string.
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===================== DOM SHORTHANDS =====================
export const $  = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);

// ===================== FORMATTERS =====================
export function formatRp(n) {
  if (!n || isNaN(n)) return 'Rp 0';
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}
export function formatRpC(n) {
  const sign = (n||0) < 0 ? '-' : '';
  const a = Math.abs(n || 0);
  if (a >= 1e9) return sign + 'Rp ' + (a/1e9).toFixed(1) + ' M';
  if (a >= 1e6) return sign + 'Rp ' + (a/1e6).toFixed(1) + ' Jt';
  if (a >= 1e3) return sign + 'Rp ' + (a/1e3).toFixed(0) + ' Rb';
  return sign + 'Rp ' + a.toLocaleString('id-ID');
}
export function formatDate(s) {
  if (!s) return '';
  return new Date(s+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
export function formatDateShort(s) {
  if (!s) return '-';
  return new Date(s+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
export function todayStr() { return new Date().toISOString().split('T')[0]; }
export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
export function parseAmt(s) { return parseInt((s||'').replace(/\D/g,'')) || 0; }
export function daysUntil(d) {
  if (!d) return null;
  const t = new Date(d+'T00:00:00'), n = new Date(); n.setHours(0,0,0,0);
  return Math.floor((t-n)/86400000);
}

// ===================== TOAST =====================
export function showToast(msg, type='success', ms=2400) {
  const el = $('#toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ===================== EMPTY STATE =====================
// Small reusable "nothing here yet" block used by every page's list when
// it has no items to show (transactions, wallets, debts, budgets, etc.)
export function emptyState(ico, t, s) {
  return `<div class="empty-state"><div class="empty-icon">${ico}</div><p>${t}</p><span>${s}</span></div>`;
}

// ===================== INPUT FORMATTING =====================
export function fmtAmtInput(inp) {
  const raw = inp.value.replace(/\D/g,'');
  if (!raw) { inp.value = ''; return; }
  inp.value = parseInt(raw,10).toLocaleString('id-ID');
}
