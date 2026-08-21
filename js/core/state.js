/* ================================================
   AZAR FINANCE — js/core/state.js
   Single source of truth for in-memory app state (APP),
   IndexedDB key names (KEYS), the app version string, and
   the built-in transaction categories.
   Extracted from script.js v5.6 — Sprint 2 (see log.md)
   ================================================ */
'use strict';

import { todayStr } from './utils.js';

// Single source of truth for the app version shown in Settings,
// embedded in exports/backups, and used to bust the Service Worker
// cache. Bump this (and sw.js CACHE_NAME + index.html footer text)
// on every release.
export const APP_VERSION = '5.8';

// ===================== CATEGORIES =====================
export const INCOME_CATS = [
  {id:'salary',name:'Gaji',emoji:'💼'},{id:'freelance',name:'Freelance',emoji:'🔧'},
  {id:'business',name:'Bisnis',emoji:'🏪'},{id:'invest',name:'Investasi',emoji:'📈'},
  {id:'gift',name:'Hadiah',emoji:'🎁'},{id:'other_inc',name:'Lainnya',emoji:'💰'},
];
export const EXPENSE_CATS = [
  {id:'food',name:'Makanan',emoji:'🍔'},{id:'transport',name:'Transport',emoji:'🚗'},
  {id:'shopping',name:'Belanja',emoji:'🛍️'},{id:'entertainment',name:'Hiburan',emoji:'🎮'},
  {id:'health',name:'Kesehatan',emoji:'💊'},{id:'education',name:'Pendidikan',emoji:'📚'},
  {id:'bills',name:'Tagihan',emoji:'💡'},{id:'home',name:'Rumah',emoji:'🏠'},
  {id:'savings',name:'Tabungan',emoji:'🐷'},{id:'saving_transfer',name:'Transfer Tabungan',emoji:'🏦'},{id:'debt_transfer',name:'Hutang/Piutang',emoji:'💳'},{id:'other_exp',name:'Lainnya',emoji:'💸'},
];
export const WALLET_EMOJIS = ['👛','💼','🏦','💳','📱','💵','🪙','🏧','💎','🏠'];
export const CAT_EMOJIS = ['☕','🍕','🍔','🍜','🍿','🍰','🚗','⛽','🎬','🎵','🐾','👶','🎁','💇','👕','📱','💻','✈️','🏋️','⚽','🎨','📖','🧾','🔧','💊','🐕','🌱','🧴','🎯','💸'];
export const BUCKET_EMOJIS = ['🎯','🚗','💻','🏠','✈️','📱','💍','🏋️','📚','🎮','🎸','🌏','💊','👔','🛋️','🐶'];

// Combined category list (built-in + user-added custom categories) for a
// given type. ALWAYS use this (not INCOME_CATS/EXPENSE_CATS directly) when
// rendering a category picker or looking up a category by id, so custom
// categories behave identically to built-in ones everywhere in the app.
export function getCatList(type) {
  const builtin = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const custom  = APP.customCats.filter(c => c.type === type);
  return [...builtin, ...custom];
}

// ===================== STATE =====================
export const APP = {
  transactions:[],goals:[],debts:[],wallets:[],budgets:[],reminders:[],
  savingBuckets:[], savingTxs:[], customCats:[],
  currentPage:'dashboard', prevPage:null,
  editingTxId:null, editingGoalId:null, editingDebtId:null,
  editingWalletId:null, savingGoalId:null,
  debtType:'borrowed', debtWalletId:'', payDebtId:'', payWalletId:'',
  selectedType:'income', selectedCatId:'other_inc', selectedWalletId:'default',
  dashFilter:'month', histFilter:'all', histSearch:'', debtFilter:'all', analitikPeriod:'month',
  deleteTarget:null,
  savingBucketTab:'active', // 'active' | 'completed' — Tabungan page tab
  darkMode:false, theme:'emerald', notifEnabled:false, notifTime:'20:00', notifTimerId:null,
  txPhoto:null,
  // Kalender page state. Originally assigned onto APP after the fact
  // (`APP.calYear = APP.calYear || ...`) right before renderKalender() in
  // script.js; consolidated into the object literal here — same defaults,
  // same values, just declared in one place instead of two.
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelectedDate: todayStr(),
};

export const KEYS = {
  tx:'azf3_tx', goals:'azf3_goals', debts:'azf3_debts',
  wallets:'azf3_wallets',
  dark:'azf3_dark', theme:'azf3_theme', notif:'azf3_notif', ntime:'azf3_ntime',
};
