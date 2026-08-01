/* ================================================
   AZAR FINANCE v5.5 — script.js
   Multi-Wallet · Analitik · Notes · Photos
   ================================================ */
'use strict';

// Single source of truth for the app version shown in Settings,
// embedded in exports/backups, and used to bust the Service Worker
// cache. Bump this (and sw.js CACHE_NAME + index.html footer text)
// on every release: bump this + sw.js CACHE_NAME + index.html footer text.
const APP_VERSION = '5.5';

// ===================== SECURITY: HTML ESCAPING =====================
// User-supplied text (description, notes, wallet/debt/goal names, etc.)
// is rendered via innerHTML throughout this app. Always pass such text
// through escapeHtml() before interpolating it into a template string.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===================== CATEGORIES =====================
const INCOME_CATS = [
  {id:'salary',name:'Gaji',emoji:'💼'},{id:'freelance',name:'Freelance',emoji:'🔧'},
  {id:'business',name:'Bisnis',emoji:'🏪'},{id:'invest',name:'Investasi',emoji:'📈'},
  {id:'gift',name:'Hadiah',emoji:'🎁'},{id:'other_inc',name:'Lainnya',emoji:'💰'},
];
const EXPENSE_CATS = [
  {id:'food',name:'Makanan',emoji:'🍔'},{id:'transport',name:'Transport',emoji:'🚗'},
  {id:'shopping',name:'Belanja',emoji:'🛍️'},{id:'entertainment',name:'Hiburan',emoji:'🎮'},
  {id:'health',name:'Kesehatan',emoji:'💊'},{id:'education',name:'Pendidikan',emoji:'📚'},
  {id:'bills',name:'Tagihan',emoji:'💡'},{id:'home',name:'Rumah',emoji:'🏠'},
  {id:'savings',name:'Tabungan',emoji:'🐷'},{id:'saving_transfer',name:'Transfer Tabungan',emoji:'🏦'},{id:'debt_transfer',name:'Hutang/Piutang',emoji:'💳'},{id:'other_exp',name:'Lainnya',emoji:'💸'},
];
const WALLET_EMOJIS = ['👛','💼','🏦','💳','📱','💵','🪙','🏧','💎','🏠'];
const CAT_EMOJIS = ['☕','🍕','🍔','🍜','🍿','🍰','🚗','⛽','🎬','🎵','🐾','👶','🎁','💇','👕','📱','💻','✈️','🏋️','⚽','🎨','📖','🧾','🔧','💊','🐕','🌱','🧴','🎯','💸'];

// Combined category list (built-in + user-added custom categories) for a
// given type. ALWAYS use this (not INCOME_CATS/EXPENSE_CATS directly) when
// rendering a category picker or looking up a category by id, so custom
// categories behave identically to built-in ones everywhere in the app.
function getCatList(type) {
  const builtin = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const custom  = APP.customCats.filter(c => c.type === type);
  return [...builtin, ...custom];
}

// ===================== STATE =====================
const APP = {
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
  darkMode:false, notifEnabled:false, notifTime:'20:00', notifTimerId:null,
  txPhoto:null,
};

const KEYS = {
  tx:'azf3_tx', goals:'azf3_goals', debts:'azf3_debts',
  wallets:'azf3_wallets',
  dark:'azf3_dark', notif:'azf3_notif', ntime:'azf3_ntime',
};

// ===================== UTILS =====================
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function formatRp(n) {
  if (!n || isNaN(n)) return 'Rp 0';
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}
function formatRpC(n) {
  const sign = (n||0) < 0 ? '-' : '';
  const a = Math.abs(n || 0);
  if (a >= 1e9) return sign + 'Rp ' + (a/1e9).toFixed(1) + ' M';
  if (a >= 1e6) return sign + 'Rp ' + (a/1e6).toFixed(1) + ' Jt';
  if (a >= 1e3) return sign + 'Rp ' + (a/1e3).toFixed(0) + ' Rb';
  return sign + 'Rp ' + a.toLocaleString('id-ID');
}
function formatDate(s) {
  if (!s) return '';
  return new Date(s+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function formatDateShort(s) {
  if (!s) return '-';
  return new Date(s+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function parseAmt(s) { return parseInt((s||'').replace(/\D/g,'')) || 0; }
function daysUntil(d) {
  if (!d) return null;
  const t = new Date(d+'T00:00:00'), n = new Date(); n.setHours(0,0,0,0);
  return Math.floor((t-n)/86400000);
}
function showToast(msg, type='success', ms=2400) {
  const el = $('#toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}
function fmtAmtInput(inp) {
  const raw = inp.value.replace(/\D/g,'');
  if (!raw) { inp.value = ''; return; }
  inp.value = parseInt(raw,10).toLocaleString('id-ID');
}

// ===================== STORAGE (IndexedDB) =====================
const DB_NAME    = 'AzarFinanceDB';
const DB_VERSION = 1;
const STORE_DATA = 'appdata';   // key-value store for all app data
const STORE_SETTINGS = 'settings'; // key-value store for settings
let   _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DATA))     db.createObjectStore(STORE_DATA);
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function idbSet(storeName, key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  }));
}

function idbGet(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

async function _persistAsync() {
  try {
    await Promise.all([
      idbSet(STORE_DATA, KEYS.tx,         APP.transactions),
      idbSet(STORE_DATA, KEYS.goals,      APP.goals),
      idbSet(STORE_DATA, KEYS.debts,      APP.debts),
      idbSet(STORE_DATA, KEYS.wallets,    APP.wallets),
      idbSet(STORE_DATA, 'budgets',       APP.budgets),
      idbSet(STORE_DATA, 'reminders',     APP.reminders),
      idbSet(STORE_DATA, 'savingBuckets', APP.savingBuckets),
      idbSet(STORE_DATA, 'savingTxs',     APP.savingTxs),
      idbSet(STORE_DATA, 'customCats',    APP.customCats),
    ]);
  } catch(e) { showToast('⚠️ Gagal simpan data!','error'); console.error(e); }
}
// Sync-looking wrapper — callers don't need await, but returns Promise for when needed.
// Calls are queued (not run concurrently) so that rapid successive edits can
// never interleave their writes and corrupt state. Storage keys/schema are
// unchanged — this only changes *when* writes run, not *what* is written.
let _persistQueue = Promise.resolve();
function persist() {
  _persistQueue = _persistQueue.then(() => _persistAsync());
  return _persistQueue;
}

async function _saveSettingsAsync() {
  try {
    await Promise.all([
      idbSet(STORE_SETTINGS, KEYS.dark,  APP.darkMode),
      idbSet(STORE_SETTINGS, KEYS.notif, APP.notifEnabled),
      idbSet(STORE_SETTINGS, KEYS.ntime, APP.notifTime),
    ]);
  } catch(e) { console.error('saveSettings error:', e); }
}
function saveSettings() { return _saveSettingsAsync(); }

// v5.4 migration: before this version, borrowing/lending/repaying a debt
// was recorded as a plain type:'income'/'expense' transaction — identifiable
// only via the debtRef link back to APP.debts, the same masquerading
// pattern (and the same "not real income/expense" bug) that saving_transfer
// had. Any transaction carrying a debtRef is unambiguously debt-related, so
// that's used here (instead of catId) to upgrade it to type:'debt_transfer'.
function migrateLegacyDebtTransfers() {
  let migrated = 0;
  APP.transactions.forEach(t => {
    if (t.debtRef && t.type !== 'debt_transfer') {
      t.direction = t.type === 'income' ? 'in' : 'out';
      t.type = 'debt_transfer';
      t.catId = 'debt_transfer';
      migrated++;
    }
  });
  return migrated;
}

// One-time migration (v5.1): before this version, a savings deposit/withdraw
// was stored as a plain type:'income'/'expense' transaction, identifiable
// only via catId==='saving_transfer'. That's exactly what let it slip
// through any code that filtered by type — the root cause of the "fake
// income" bug. From v5.1 it gets its own type:'saving_transfer' with an
// explicit `direction`, so it's excluded from income/expense everywhere
// automatically. This upgrades any transactions saved by an older version
// so old history doesn't quietly regress back into the old bug.
function migrateLegacySavingTransfers() {
  let migrated = 0;
  APP.transactions.forEach(t => {
    if (t.catId === 'saving_transfer' && t.type !== 'saving_transfer') {
      t.direction = t.type === 'expense' ? 'deposit' : 'withdraw';
      t.type = 'saving_transfer';
      migrated++;
    }
  });
  return migrated;
}

// v5.4 migration: an old "Impian" (goal) feature pre-dates the current
// savingBuckets/Tabungan system and was fully superseded by it, but a FAB
// routing bug (fixed in v5.4 — the FAB used to open the old goal sheet
// instead of the bucket sheet on this page) could still create entries in
// APP.goals that were never shown anywhere in the UI. This converts any
// leftover goals into savings buckets so nothing is silently lost.
// The old `saved` progress number is NOT carried over as a real balance —
// it was never linked to an actual wallet transaction in the old system,
// so fabricating one now would inflate net worth with money that never
// really moved. Instead it's reported back to the caller so the app can
// tell the user, rather than discarding it without a word.
function migrateLegacyGoalsToBuckets() {
  if (!APP.goals.length) return null;
  let totalSaved = 0;
  APP.goals.forEach(g => {
    APP.savingBuckets.push({
      id: genId(), name: g.name || 'Impian', emoji: '⭐',
      target: g.target || 0, createdAt: g.createdAt || todayStr(), status: 'active',
    });
    totalSaved += (g.saved || 0);
  });
  const count = APP.goals.length;
  APP.goals = [];
  return { count, totalSaved };
}

async function loadAll() {
  try {
    const [tx, goals, debts, wallets, dark, notif, ntime, budgets, reminders, savingBuckets, savingTxs, customCats] = await Promise.all([
      idbGet(STORE_DATA,     KEYS.tx),
      idbGet(STORE_DATA,     KEYS.goals),
      idbGet(STORE_DATA,     KEYS.debts),
      idbGet(STORE_DATA,     KEYS.wallets),
      idbGet(STORE_SETTINGS, KEYS.dark),
      idbGet(STORE_SETTINGS, KEYS.notif),
      idbGet(STORE_SETTINGS, KEYS.ntime),
      idbGet(STORE_DATA,     'budgets'),
      idbGet(STORE_DATA,     'reminders'),
      idbGet(STORE_DATA,     'savingBuckets'),
      idbGet(STORE_DATA,     'savingTxs'),
      idbGet(STORE_DATA,     'customCats'),
    ]);
    APP.transactions  = tx             || [];
    APP.goals         = goals          || [];
    APP.debts         = debts          || [];
    APP.wallets       = wallets        || [];
    APP.budgets       = budgets        || [];
    APP.reminders     = reminders      || [];
    APP.savingBuckets = savingBuckets  || [];
    APP.savingTxs     = savingTxs      || [];
    APP.customCats    = customCats     || [];
    APP.darkMode     = dark    !== undefined ? dark  : false;
    APP.notifEnabled = notif   !== undefined ? notif : false;
    APP.notifTime    = ntime   || '20:00';
  } catch(e) {
    console.error('loadAll error:', e);
    APP.transactions=[]; APP.goals=[]; APP.debts=[];
    APP.wallets=[]; APP.budgets=[]; APP.reminders=[]; APP.customCats=[];
  }
  if (!APP.wallets.length) {
    APP.wallets = [{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
    await persist();
  }
  if (migrateLegacySavingTransfers() > 0) await persist();
  if (migrateLegacyDebtTransfers() > 0) await persist();
  const goalMigration = migrateLegacyGoalsToBuckets();
  if (goalMigration) { await persist(); APP._goalMigrationResult = goalMigration; }
  APP.selectedWalletId = APP.wallets[0]?.id || 'default';
}

// ===================== AUTO BACKUP =====================
const AUTO_BACKUP_INTERVAL_DAYS = 7; // auto backup setiap 7 hari
const BACKUP_LAST_KEY = 'azf3_backup_last';

function getAutoBackupLastDate() {
  try { return localStorage.getItem(BACKUP_LAST_KEY) || ''; } catch { return ''; }
}
function setAutoBackupLastDate(d) {
  try { localStorage.setItem(BACKUP_LAST_KEY, d); } catch {}
}

function doAutoBackup(silent = true) {
  if (!APP.transactions.length && !APP.goals.length && !APP.debts.length) return;
  const data = {
    app: 'Azar Finance', version: APP_VERSION,
    exported: new Date().toISOString(), autoBackup: true,
    transactions: APP.transactions, goals: APP.goals,
    debts: APP.debts, wallets: APP.wallets,
  };
  dlBlob(JSON.stringify(data, null, 2),
    `azar-finance-autobackup-${todayStr()}.json`, 'application/json');
  setAutoBackupLastDate(todayStr());
  if (!silent) showToast('💾 Auto backup berhasil!', 'success');
}

function checkAutoBackup() {
  const last = getAutoBackupLastDate();
  if (!last) { setAutoBackupLastDate(todayStr()); return; } // first run, tandai hari ini
  const daysSince = Math.floor((new Date(todayStr()) - new Date(last)) / 86400000);
  if (daysSince >= AUTO_BACKUP_INTERVAL_DAYS) {
    showToast(`🔔 Auto backup mingguan dimulai...`, 'info', 2000);
    setTimeout(() => doAutoBackup(false), 2200);
  }
}

// ===================== DARK MODE =====================
function applyDark() {
  document.body.classList.toggle('dark-mode', APP.darkMode);
  $('#icon-moon').style.display = APP.darkMode ? '' : 'none';
  $('#icon-sun').style.display  = APP.darkMode ? 'none' : '';
  const s = $('#dark-toggle-settings'); if (s) s.checked = APP.darkMode;
}

// ===================== WALLET BALANCE =====================
function getWalletBalance(walletId) {
  const w = APP.wallets.find(x => x.id === walletId);
  const init = w?.initialBalance || 0;
  const txBal = APP.transactions
    .filter(t => t.walletId === walletId && t.type !== 'transfer' && t.type !== 'saving_transfer' && t.type !== 'debt_transfer')
    .reduce((s,t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
  const trBal = APP.transactions
    .filter(t => t.type === 'transfer')
    .reduce((s,t) => {
      if (t.toWalletId === walletId) return s + t.amount;
      if (t.walletId   === walletId) return s - t.amount;
      return s;
    }, 0);
  // Savings deposit/withdraw moves money between this wallet and a bucket:
  // deposit takes money OUT of the wallet, withdraw brings it back IN.
  const stBal = APP.transactions
    .filter(t => t.type === 'saving_transfer' && t.walletId === walletId)
    .reduce((s,t) => t.direction === 'withdraw' ? s + t.amount : s - t.amount, 0);
  // Borrowing/lending/repaying/collecting moves cash in/out of this wallet
  // but is never counted as real income/expense.
  const dtBal = APP.transactions
    .filter(t => t.type === 'debt_transfer' && t.walletId === walletId)
    .reduce((s,t) => t.direction === 'in' ? s + t.amount : s - t.amount, 0);
  return init + txBal + trBal + stBal + dtBal;
}
// Computes balance + income/expense/count for EVERY wallet in a single
// pass over APP.transactions, instead of re-filtering the full array
// per wallet (which used to be O(wallets × transactions)). Use this
// whenever more than one wallet's stats are needed at once (dashboard
// totals, dompet list) — use getWalletBalance() above for one-off lookups.
function computeWalletStats() {
  const stats = {};
  APP.wallets.forEach(w => { stats[w.id] = { balance: w.initialBalance||0, income:0, expense:0, count:0 }; });
  APP.transactions.forEach(t => {
    if (stats[t.walletId]) stats[t.walletId].count++;
    if (t.type === 'transfer') {
      if (stats[t.toWalletId]) stats[t.toWalletId].balance += t.amount;
      if (stats[t.walletId])   stats[t.walletId].balance   -= t.amount;
      return;
    }
    if (t.type === 'saving_transfer') {
      // Moves the wallet's balance but is never real income/expense.
      const s = stats[t.walletId]; if (!s) return;
      if (t.direction === 'withdraw') s.balance += t.amount; else s.balance -= t.amount;
      return;
    }
    if (t.type === 'debt_transfer') {
      // Same idea — moves cash, never counts as real income/expense.
      const s = stats[t.walletId]; if (!s) return;
      if (t.direction === 'in') s.balance += t.amount; else s.balance -= t.amount;
      return;
    }
    const s = stats[t.walletId]; if (!s) return;
    if (t.type === 'income') { s.balance += t.amount; s.income += t.amount; }
    else                     { s.balance -= t.amount; s.expense += t.amount; }
  });
  return stats;
}
function getTotalNetWorth() {
  const stats = computeWalletStats();
  return APP.wallets.reduce((s,w) => s + (stats[w.id]?.balance||0), 0);
}

// ===================== FILTER HELPERS =====================
function getDateRange(f) {
  const today = todayStr();
  if (f === 'today')  return { from:today, to:today };
  if (f === 'week')   { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return {from:d.toISOString().split('T')[0],to:today}; }
  if (f === 'month')  { const d = new Date(); return {from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:today}; }
  if (f === '3month') { const d = new Date(); d.setMonth(d.getMonth()-2); return {from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:today}; }
  if (f === '6month') { const d = new Date(); d.setMonth(d.getMonth()-5); return {from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,to:today}; }
  if (f === 'year')   return { from:`${new Date().getFullYear()}-01-01`, to:today };
  return null;
}

function filterTx(dateF, typeF, search) {
  let list = [...APP.transactions];
  const r = getDateRange(dateF);
  if (r) list = list.filter(t => t.date >= r.from && t.date <= r.to);
  if (typeF === 'income')  list = list.filter(t => t.type === 'income');
  if (typeF === 'expense') list = list.filter(t => t.type === 'expense');
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(t => (t.desc||'').toLowerCase().includes(q)||(t.note||'').toLowerCase().includes(q));
  }
  list.sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return list;
}

// Money moved into/out of a savings bucket has its own type:'saving_transfer'
// (see saveSavingTx) instead of masquerading as 'income'/'expense' — so
// every filter below that checks t.type==='income'/'expense' naturally
// excludes it already, with nothing extra to remember at each call site.
function calcTotals(list) {
  let income=0, expense=0;
  list.forEach(t => { if(t.type==='income') income+=t.amount; else if(t.type==='expense') expense+=t.amount; });
  return {income, expense, saldo:income-expense};
}

function getCat(type, id) {
  const arr = getCatList(type);
  return arr.find(c => c.id===id) || arr[arr.length-1];
}

// ===================== ANALYTICS =====================
function getMonthlyData(months=6) {
  const result = [];
  for (let i = months-1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const txs = APP.transactions.filter(t => t.date.startsWith(mk) && t.type!=='transfer' && t.type!=='saving_transfer');
    result.push({
      month: mk,
      label: d.toLocaleDateString('id-ID',{month:'short'}),
      income:  txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
      expense: txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
    });
  }
  return result;
}

function getCategoryBreakdown(dateFilter) {
  const r = getDateRange(dateFilter);
  const list = APP.transactions.filter(t => t.type==='expense' && (!r || (t.date>=r.from && t.date<=r.to)));
  const map = {};
  list.forEach(t => { const c = t.catId||'other_exp'; map[c]=(map[c]||0)+t.amount; });
  return Object.entries(map).map(([id,val]) => {
    const cat = getCatList('expense').find(c=>c.id===id) || {name:'Lainnya',emoji:'💸'};
    return {id, name:cat.name, emoji:cat.emoji, value:val};
  }).sort((a,b) => b.value-a.value);
}

function getDayOfWeekData(dateFilter) {
  const r = getDateRange(dateFilter);
  const days = [0,0,0,0,0,0,0];
  APP.transactions
    .filter(t => t.type==='expense' && (!r || (t.date>=r.from && t.date<=r.to)))
    .forEach(t => { const d = new Date(t.date+'T00:00:00').getDay(); days[d]+=t.amount; });
  return days;
}

function getAvgMonthly(type, n=3) {
  if (!APP.transactions.length) return 0;
  const months = new Set();
  for (let i=0; i<n; i++) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const list = APP.transactions.filter(t => t.type===type && months.has(t.date.slice(0,7)));
  if (!list.length) return 0;
  return Math.round(list.reduce((s,t)=>s+t.amount,0) / months.size);
}

// ===================== CANVAS CHARTS =====================
const Charts = {
  setup(canvas) {
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return null;
    canvas.width  = rect.width*dpr;
    canvas.height = rect.height*dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr,dpr);
    return {ctx, w:rect.width, h:rect.height};
  },
  isDark()    { return document.body.classList.contains('dark-mode'); },
  textCol()   { return this.isDark()?'rgba(136,136,170,0.8)':'rgba(102,102,128,0.8)'; },
  gridCol()   { return this.isDark()?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'; },

  bar(canvas, data) {
    const s = this.setup(canvas); if (!s) return;
    const {ctx,w,h} = s;
    ctx.clearRect(0,0,w,h);
    const ml=48, mr=8, mt=14, mb=28;
    const pw=w-ml-mr, ph=h-mt-mb;
    const n=data.length; if (!n) return;
    const maxV = Math.max(...data.map(d=>Math.max(d.income,d.expense)),1);
    // Grid
    for (let i=0; i<=4; i++) {
      const y = mt + ph*(1-i/4);
      ctx.strokeStyle=this.gridCol(); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ml,y); ctx.lineTo(ml+pw,y); ctx.stroke();
      ctx.fillStyle=this.textCol(); ctx.font='10px DM Mono,monospace'; ctx.textAlign='right';
      ctx.fillText(formatRpC(maxV*i/4).replace('Rp ',''), ml-4, y+3);
    }
    const gw=pw/n, bw=gw*0.32, gap=gw*0.04;
    data.forEach((d,i) => {
      const gx = ml+i*gw+gw*0.1;
      const ih = d.income/maxV*ph;
      ctx.fillStyle='rgba(34,197,94,0.85)';
      ctx.beginPath(); ctx.roundRect(gx, mt+ph-ih, bw, Math.max(ih,1), 3); ctx.fill();
      const eh = d.expense/maxV*ph;
      ctx.fillStyle='rgba(244,63,94,0.85)';
      ctx.beginPath(); ctx.roundRect(gx+bw+gap, mt+ph-eh, bw, Math.max(eh,1), 3); ctx.fill();
      ctx.fillStyle=this.textCol(); ctx.font='10px Sora,sans-serif'; ctx.textAlign='center';
      ctx.fillText(d.label, gx+bw+gap/2, h-4);
    });
  },

  donut(canvas, segments) {
    const s = this.setup(canvas); if (!s) return;
    const {ctx,w,h} = s;
    ctx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2, or=Math.min(w,h)/2-4, ir=or*0.55;
    const total = segments.reduce((s,x)=>s+x.value,0);
    if (!total) {
      ctx.fillStyle=this.isDark()?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)';
      ctx.beginPath(); ctx.arc(cx,cy,or,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=this.isDark()?'#16161f':'#fff';
      ctx.beginPath(); ctx.arc(cx,cy,ir,0,Math.PI*2); ctx.fill();
      return;
    }
    const COLORS=['#22c55e','#f43f5e','#60a5fa','#f97316','#a855f7','#14b8a6','#fbbf24','#e879f9'];
    let angle = -Math.PI/2;
    segments.forEach((seg,i) => {
      const sweep = (seg.value/total)*Math.PI*2;
      ctx.fillStyle = COLORS[i%COLORS.length];
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,or,angle,angle+sweep); ctx.closePath(); ctx.fill();
      angle += sweep;
    });
    ctx.fillStyle = this.isDark()?'#16161f':'#ffffff';
    ctx.beginPath(); ctx.arc(cx,cy,ir,0,Math.PI*2); ctx.fill();
  },
};

// ===================== TX ITEM HTML =====================
const IN_ARR = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 17a1 1 0 01-.707-.293l-5-5a1 1 0 011.414-1.414L9 13.586V3a1 1 0 012 0v10.586l3.293-3.293a1 1 0 011.414 1.414l-5 5A1 1 0 0110 17z" clip-rule="evenodd"/></svg>`;
const EX_ARR = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L11 6.414V17a1 1 0 11-2 0V6.414L5.707 9.707a1 1 0 01-1.414-1.414l5-5A1 1 0 0110 3z" clip-rule="evenodd"/></svg>`;

function txItemHTML(tx, delay=0) {
  const isIn = tx.type==='income', isT = tx.type==='transfer';
  const isST = tx.type==='saving_transfer';
  const isDT = tx.type==='debt_transfer';
  // A saving_transfer/debt_transfer's `direction` decides whether it LOOKS
  // like an income or an expense for display, even though its `type` is
  // neither — that's exactly what keeps it out of real income/expense totals.
  const stIn = (isST && tx.direction === 'withdraw') || (isDT && tx.direction === 'in');
  const cat  = !isT ? getCat(tx.type, tx.catId) : null;
  const displayClass = (isST||isDT) ? (stIn ? 'income' : 'expense') : tx.type;
  const dotContent = isT ? '🔄' : (cat?.emoji || ((isIn||stIn) ? IN_ARR : EX_ARR));
  const wallet = APP.wallets.find(w=>w.id===tx.walletId);
  const sign   = isT ? '→' : (isIn||stIn) ? '+' : '−';
  const catMeta    = cat  ? `<span class="tx-cat-badge">${escapeHtml(cat.name)}</span>` : '';
  const walletMeta = wallet ? ` · ${wallet.emoji}${escapeHtml(wallet.name)}` : '';
  const noteMeta   = tx.note && tx.note!=='[Otomatis dari berulang]' ? ` · ${escapeHtml(tx.note.slice(0,20))}${tx.note.length>20?'…':''}` : '';
  const photoHTML  = tx.photo ? `<img src="${tx.photo}" class="tx-thumb" data-photo="${tx.photo}" alt="struk"/>` : '';
  return `<div class="tx-item ${displayClass}" style="animation-delay:${delay}ms" data-id="${tx.id}">
    <div class="tx-dot">${dotContent}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(tx.desc)||'Tanpa deskripsi'}</div>
      <div class="tx-meta">${formatDate(tx.date)}${catMeta}<span>${walletMeta}${noteMeta}</span></div>
    </div>
    ${photoHTML}
    <div class="tx-right">
      <div class="tx-amount">${sign} ${formatRp(tx.amount)}</div>
      <div class="tx-actions">
        <button class="tx-btn edit" data-id="${tx.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="tx-btn del" data-id="${tx.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </div>
  </div>`;
}

function emptyState(ico, t, s) {
  return `<div class="empty-state"><div class="empty-icon">${ico}</div><p>${t}</p><span>${s}</span></div>`;
}

// ===================== RENDER DASHBOARD =====================
function renderDashboard() {
  const r    = getDateRange(APP.dashFilter);
  const list = APP.transactions.filter(t => (!r || (t.date>=r.from && t.date<=r.to)) && t.type!=='transfer');
  const {income, expense} = calcTotals(list);
  const walletStats = computeWalletStats();
  const nw   = APP.wallets.reduce((s,w) => s + (walletStats[w.id]?.balance||0), 0);
  // "Savings" here means income not spent on real (external) expenses. Money
  // moved into a Tabungan bucket has type:'saving_transfer' so wallet
  // balances stay accurate, but it's still the user's own money — just
  // relocated, not spent. This filter is now belt-and-suspenders (calcTotals
  // already excludes type:'saving_transfer'), kept for clarity/safety.
  const listForSavings = list.filter(t => t.catId !== 'saving_transfer');
  const {income: incSav, expense: expSav} = calcTotals(listForSavings);
  const savings = incSav - expSav;
  const savRate = incSav>0 ? Math.round((savings/incSav)*100) : 0;

  // Balance card
  $('#net-worth-display').textContent = formatRp(nw);
  $('#net-worth-display').style.color = nw>=0 ? '' : 'var(--expense)';
  $('#dash-income').textContent  = formatRpC(income);
  $('#dash-expense').textContent = formatRpC(expense);
  const wc = $('#dash-wallet-count');
  if (wc) wc.textContent = APP.wallets.length + ' dompet';

  // Month summary cards
  const todayTxs = APP.transactions.filter(t=>t.date===todayStr()&&t.type==='expense');
  const todayExp = todayTxs.reduce((s,t)=>s+t.amount,0);
  const dashSav = $('#dash-savings'), dashSavR = $('#dash-savings-rate');
  const dashTodExp = $('#dash-today-exp'), dashTodTx = $('#dash-today-tx');
  if(dashSav){ dashSav.textContent = formatRpC(savings); dashSav.style.color = savings>=0?'var(--income)':'var(--expense)'; }
  if(dashSavR) dashSavR.textContent = 'Savings rate: '+savRate+'%';
  if(dashTodExp) dashTodExp.textContent = formatRpC(todayExp);
  if(dashTodTx) dashTodTx.textContent = todayTxs.length+' transaksi';

  // Savings ring
  const sbcRate = $('#dash-sbc-rate'), sbcDesc = $('#dash-sbc-desc'), ringFill = $('#dash-ring-fill');
  if(sbcRate) sbcRate.textContent = savRate+'%';
  if(sbcRate) sbcRate.style.color = savRate>=30?'var(--income)':savRate>=10?'var(--warn)':'var(--expense)';
  if(sbcDesc) sbcDesc.textContent = savRate>=30?'Bagus! Pertahankan 💪':savRate>=10?'Lumayan, bisa lebih baik':'Perlu perhatian lebih';
  if(ringFill){ const circ=138.2; ringFill.style.strokeDashoffset = circ - (Math.min(savRate,100)/100)*circ; }

  // Quick Insights
  let totalHutang=0, totalPiutang=0;
  APP.debts.forEach(d => {
    const remaining = d.amount - (d.paidAmount||0);
    if (d.dtype==='borrowed') totalHutang += remaining; else totalPiutang += remaining;
  });
  const qiDebtVal = $('#qi-debt-val');
  if (qiDebtVal) qiDebtVal.textContent = (totalHutang||totalPiutang) ? `${formatRpC(totalHutang)} / ${formatRpC(totalPiutang)}` : 'Tidak ada';

  const bMonth = getBudgetMonth();
  const monthBudgets = APP.budgets.filter(b=>b.month===bMonth);
  const monthExpTxs  = APP.transactions.filter(t=>t.date.startsWith(bMonth)&&t.type==='expense');
  const qiBudgetVal = $('#qi-budget-val');
  if (qiBudgetVal) {
    if (!monthBudgets.length) { qiBudgetVal.textContent = 'Belum ada budget'; }
    else {
      const totalLimit = monthBudgets.reduce((s,b)=>s+b.limit,0);
      const totalUsed  = monthBudgets.reduce((s,b)=>s+monthExpTxs.filter(t=>t.catId===b.cat).reduce((ss,t)=>ss+t.amount,0),0);
      const pct = totalLimit>0 ? Math.round((totalUsed/totalLimit)*100) : 0;
      qiBudgetVal.textContent = `${pct}% terpakai`;
      qiBudgetVal.style.color = pct>=100?'var(--expense)':pct>=80?'var(--warn)':'var(--txt-primary)';
    }
  }

  const totalSavingsBuckets = APP.savingBuckets.reduce((s,b)=>s+getBucketBalance(b.id),0);
  const qiSavVal = $('#qi-savings-val');
  if (qiSavVal) qiSavVal.textContent = formatRpC(totalSavingsBuckets);

  const topCatMap = {};
  monthExpTxs.filter(t=>t.catId!=='saving_transfer').forEach(t=>{ topCatMap[t.catId]=(topCatMap[t.catId]||0)+t.amount; });
  let topCatId=null, topCatAmt=0;
  Object.entries(topCatMap).forEach(([id,amt])=>{ if(amt>topCatAmt){topCatAmt=amt; topCatId=id;} });
  const qiTopVal = $('#qi-topcat-val');
  if (qiTopVal) {
    if (!topCatId) qiTopVal.textContent = 'Belum ada data';
    else { const tc=getCatList('expense').find(c=>c.id===topCatId); qiTopVal.textContent = `${tc?.emoji||'💸'} ${tc?.name||'Lainnya'} · ${formatRpC(topCatAmt)}`; }
  }

  // Wallet chips
  const wsr = $('#wallet-scroll-row');
  wsr.innerHTML = APP.wallets.map(w => {
    const bal = walletStats[w.id]?.balance || 0;
    return `<div class="wallet-chip">
      <span class="wc-emoji">${w.emoji}</span>
      <div>
        <div class="wc-name">${escapeHtml(w.name)}</div>
        <div class="wc-bal" style="color:${bal>=0?'var(--income)':'var(--expense)'}">${formatRpC(bal)}</div>
      </div>
    </div>`;
  }).join('') + `<div class="wallet-chip" id="add-wallet-chip" style="border-style:dashed;min-width:54px;justify-content:center;"><span style="font-size:1.3rem;color:var(--txt-muted)">+</span></div>`;
  $('#add-wallet-chip')?.addEventListener('click', () => openWalletSheet());

  // Recent transactions
  const recent = filterTx(APP.dashFilter, 'all', '').slice(0, 12);
  $('#dashboard-list').innerHTML = recent.length
    ? recent.map((t,i) => txItemHTML(t, i*30)).join('')
    : emptyState('💸','Belum ada transaksi','Ketuk + untuk mencatat');
}

// ===================== RENDER ANALITIK =====================
function renderAnalitik() {
  const prd  = APP.analitikPeriod;
  const r    = getDateRange(prd);
  const list = APP.transactions.filter(t => (!r || (t.date>=r.from && t.date<=r.to)) && t.type!=='transfer');
  const {income, expense, saldo} = calcTotals(list);
  const avgInc = getAvgMonthly('income',3);
  const savRate = income>0 ? Math.round((saldo/income)*100) : 0;
  const allTxs = APP.transactions.filter(t => !r || (t.date>=r.from && t.date<=r.to));
  const days = r ? Math.max(1,Math.ceil((new Date(r.to)-new Date(r.from))/86400000)) : 30;
  const avgDay = Math.round(expense/days);

  // Header card
  const anPL=$('#an-period-label'),anSR=$('#an-savrate'),anNet=$('#an-net'),anTx=$('#an-txcount');
  if(anPL) anPL.textContent = prd==='month'?'Bulan Ini':prd==='3month'?'3 Bulan Terakhir':prd==='6month'?'6 Bulan Terakhir':'Tahun Ini';
  if(anSR) anSR.textContent = savRate+'%';
  if(anNet){ anNet.textContent=formatRpC(saldo); anNet.style.color=saldo>=0?'rgba(255,255,255,0.9)':'#fca5a5'; }
  if(anTx) anTx.textContent = allTxs.length;

  // Category breakdown (donut + bar list, digabung)
  const catMap={};
  list.filter(t=>t.type==='expense').forEach(t=>{
    const cat=getCatList("expense").find(c=>c.id===t.catId)||{name:"Lainnya",emoji:"💸"};
    if(!catMap[t.catId]) catMap[t.catId]={name:cat.name,emoji:cat.emoji,total:0};
    catMap[t.catId].total+=t.amount;
  });
  const catBrk=Object.values(catMap).sort((a,b)=>b.total-a.total).slice(0,6);
  const maxCat=catBrk[0]?.total||1;
  const lapCat=$('#lap-cat-items');
  if(lapCat) lapCat.innerHTML=catBrk.length?catBrk.map(c=>`
    <div class="lap-cat-item">
      <span class="lap-cat-emoji">${c.emoji}</span>
      <div class="lap-cat-info">
        <div class="lap-cat-name">${c.name}</div>
        <div class="lap-cat-bar-bg"><div class="lap-cat-bar-fill" style="width:${Math.round((c.total/maxCat)*100)}%"></div></div>
      </div>
      <span class="lap-cat-amt">${formatRpC(c.total)}</span>
    </div>`).join(''):'<div style="color:var(--txt-muted);font-size:0.8rem;padding:6px 0">Belum ada pengeluaran</div>';

  const avgExp = getAvgMonthly('expense',3);

  // Compare this month vs last month expenses
  const now  = new Date();
  const last = new Date(); last.setMonth(last.getMonth()-1);
  const thisKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const lastKey = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}`;
  const thisMExp = APP.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(thisKey)).reduce((s,t)=>s+t.amount,0);
  const lastMExp = APP.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(lastKey)).reduce((s,t)=>s+t.amount,0);
  const expChg   = lastMExp ? Math.round((thisMExp-lastMExp)/lastMExp*100) : 0;
  const expChgTxt= expChg>0 ? `▲ ${expChg}% vs bulan lalu` : expChg<0 ? `▼ ${Math.abs(expChg)}% vs bulan lalu` : 'Sama dgn bulan lalu';
  const expCls   = expChg>0 ? 'down' : expChg<0 ? 'up' : '';
  $('#analitik-stats').innerHTML = `
    <div class="analitik-stat-card"><div class="asc-label">Pemasukan</div><div class="asc-val green">${formatRpC(income)}</div><div class="asc-sub">periode dipilih</div></div>
    <div class="analitik-stat-card"><div class="asc-label">Pengeluaran</div><div class="asc-val red">${formatRpC(expense)}</div><div class="asc-sub ${expCls}">${expChgTxt}</div></div>
    <div class="analitik-stat-card"><div class="asc-label">Net Tabungan</div><div class="asc-val ${saldo>=0?'green':'red'}">${formatRpC(saldo)}</div><div class="asc-sub">pemasukan − pengeluaran</div></div>
    <div class="analitik-stat-card"><div class="asc-label">Rata-rata Pemasukan</div><div class="asc-val">${formatRpC(avgInc)}</div><div class="asc-sub">per bulan (3 bln)</div></div>
  `;

  // Savings rate card
  const rate = income>0 ? Math.round(saldo/income*100) : 0;
  const rEmoji = rate>=30?'🚀':rate>=15?'✅':rate>=0?'⚠️':'❌';
  const rDesc  = rate>=30?'Luar biasa! Kamu menabung dengan sangat baik.':rate>=15?'Bagus! Terus pertahankan.':rate>=0?'Perlu ditingkatkan lagi.':'Pengeluaran melebihi pemasukan!';
  const rColor = rate>=15?'var(--income)':rate>=0?'var(--warn)':'var(--expense)';
  const rFill  = rate>=15?'linear-gradient(90deg,#22c55e,#86efac)':rate>=0?'linear-gradient(90deg,#f97316,#fbbf24)':'linear-gradient(90deg,#f43f5e,#fda4af)';
  $('#savings-rate-card').innerHTML = `
    <div class="src-emoji">${rEmoji}</div>
    <div class="src-info">
      <div class="src-label">Tingkat Tabungan (Savings Rate)</div>
      <div class="src-rate" style="color:${rColor}">${rate}%</div>
      <div class="src-desc">${rDesc}</div>
    </div>
    <div class="src-bar-wrap">
      <div class="src-bar-bg"><div class="src-bar-fill" style="width:${Math.max(0,Math.min(100,rate))}%;background:${rFill}"></div></div>
    </div>`;

  // Bar chart
  const months = prd==='year'?12 : prd==='6month'?6 : prd==='3month'?3 : 6;
  const mdata  = getMonthlyData(months);
  $('#bar-chart-subtitle').textContent = `${months} bulan terakhir`;
  setTimeout(() => { const c=$('#chart-bar'); if(c) Charts.bar(c, mdata); }, 60);

  // Donut chart
  const cats    = getCategoryBreakdown(prd);
  const DCOLORS = ['#22c55e','#f43f5e','#60a5fa','#f97316','#a855f7','#14b8a6','#fbbf24','#e879f9'];
  setTimeout(() => { const c=$('#chart-donut'); if(c) Charts.donut(c, cats.slice(0,8)); }, 60);
  const catTotal = cats.reduce((s,c)=>s+c.value,0);
  $('#donut-legend').innerHTML = cats.slice(0,8).map((c,i)=>
    `<div class="donut-item">
      <div class="donut-dot" style="background:${DCOLORS[i%DCOLORS.length]}"></div>
      <div class="donut-name">${c.emoji} ${c.name}</div>
      <div class="donut-val">${catTotal?Math.round(c.value/catTotal*100):0}%</div>
    </div>`).join('') || `<div style="color:var(--txt-muted);font-size:0.8rem">Belum ada pengeluaran</div>`;
  $('#donut-period-label').textContent = 'periode dipilih';

  // Day heatmap
  const dayData  = getDayOfWeekData(prd);
  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const maxDay   = Math.max(...dayData, 1);
  $('#day-heatmap').innerHTML = dayNames.map((d,i) => {
    const pct   = Math.max(4, dayData[i]/maxDay*100);
    const isMax = dayData[i]===Math.max(...dayData) && dayData[i]>0;
    return `<div class="day-col">
      <div class="day-bar-wrap"><div class="day-bar ${isMax?'max':'active'}" style="height:${pct}%"></div></div>
      <div class="day-label">${d}</div>
      <div class="day-amount">${formatRpC(dayData[i]).replace('Rp ','')}</div>
    </div>`;
  }).join('');

  // Top expenses
  const topExp = APP.transactions
    .filter(t => t.type==='expense' && (!r || (t.date>=r.from && t.date<=r.to)))
    .sort((a,b) => b.amount-a.amount).slice(0,5);
  $('#top-expenses-list').innerHTML = topExp.length
    ? topExp.map((t,i) => `<div class="top-exp-item">
        <div class="top-exp-rank">#${i+1}</div>
        <div class="top-exp-info"><div class="top-exp-desc">${escapeHtml(t.desc)}</div><div class="top-exp-date">${formatDateShort(t.date)}</div></div>
        <div class="top-exp-amt">${formatRp(t.amount)}</div>
      </div>`).join('')
    : `<div style="color:var(--txt-muted);font-size:0.8rem;padding:8px 0">Belum ada pengeluaran</div>`;

}

// ===================== RENDER RIWAYAT =====================
function renderRiwayat() {
  const f      = APP.histFilter;
  const typeF  = ['income','expense'].includes(f) ? f : 'all';
  const dateF  = ['today','week','month'].includes(f) ? f : 'all';
  const list   = filterTx(dateF, typeF, APP.histSearch);
  const {income, expense} = calcTotals(list.filter(t=>t.type!=='transfer'));
  $('#hs-count').textContent   = list.length;
  $('#hs-income').textContent  = formatRpC(income);
  $('#hs-expense').textContent = formatRpC(expense);
  $('#history-list').innerHTML = list.length
    ? list.map((t,i) => txItemHTML(t,i*25)).join('')
    : emptyState('🔍','Tidak ada transaksi','Coba ubah filter atau kata kunci');
}

// ===================== RENDER DOMPET =====================
function renderDompet() {
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

// ===================== RENDER LAINNYA =====================
function renderLainnya() {
  const dompetSub = $('#hub-dompet-sub');
  if(dompetSub) dompetSub.textContent = `${APP.wallets.length} dompet`;
  const hutangSub = $('#hub-hutang-sub');
  if(hutangSub) hutangSub.textContent = formatRpC(APP.debts.filter(d=>!d.paid).reduce((s,d)=>s+d.amount,0));
}

// ===================== RENDER IMPIAN (alias ke Tabungan) =====================
function renderImpian() { renderTabungan(); }

// ===================== RENDER HUTANG =====================
function renderHutang() {
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

// ===================== RENDER TABUNGAN =====================
const BUCKET_EMOJIS = ['🎯','🚗','💻','🏠','✈️','📱','💍','🏋️','📚','🎮','🎸','🌏','💊','👔','🛋️','🐶'];

function getSavingTotal() {
  return APP.savingBuckets.reduce((s,b) => {
    const deposited = APP.savingTxs.filter(t=>t.bucketId===b.id&&t.type==='deposit').reduce((a,t)=>a+t.amount,0);
    const withdrawn = APP.savingTxs.filter(t=>t.bucketId===b.id&&t.type==='withdraw').reduce((a,t)=>a+t.amount,0);
    return s + deposited - withdrawn;
  }, 0);
}

function getBucketBalance(bucketId) {
  const dep = APP.savingTxs.filter(t=>t.bucketId===bucketId&&t.type==='deposit').reduce((s,t)=>s+t.amount,0);
  const wit = APP.savingTxs.filter(t=>t.bucketId===bucketId&&t.type==='withdraw').reduce((s,t)=>s+t.amount,0);
  return dep - wit;
}

function renderTabungan() {
  const total = getSavingTotal();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const thisMonthDep = APP.savingTxs.filter(t=>t.type==='deposit'&&t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);
  const thisMonthWit = APP.savingTxs.filter(t=>t.type==='withdraw'&&t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);

  const el = $('#saving-total-display'); if(el) el.textContent = formatRp(total);
  const bc = $('#saving-bucket-count'); if(bc) bc.textContent = APP.savingBuckets.length+' kantong';
  const sm = $('#saving-this-month'); if(sm) sm.textContent = formatRpC(thisMonthDep);
  const sw = $('#saving-withdrawn'); if(sw) sw.textContent = formatRpC(thisMonthWit);

  const list = $('#saving-bucket-list');
  if(!list) return;
  if(!APP.savingBuckets.length) {
    list.innerHTML = emptyState('🪣','Belum ada kantong tabungan','Ketuk "+ Buat" untuk mulai');
    return;
  }
  // Buckets created before the "Selesai" status existed have no `status`
  // field — treat those as active.
  const isCompleted = b => b.status === 'completed';
  const activeBuckets    = APP.savingBuckets.filter(b => !isCompleted(b));
  const completedBuckets = APP.savingBuckets.filter(b => isCompleted(b));

  // Tab switcher — active and completed buckets are shown one group at a
  // time (not stacked together), so a finished bucket that's been fully
  // withdrawn (still cosmetically shown at 100%, see bucketCardHTML) can't
  // sit next to real in-progress balances and cause confusion.
  const tab = APP.savingBucketTab === 'completed' ? 'completed' : 'active';
  const tabsHTML = `<div class="saving-tab-switch" style="display:flex;gap:8px;margin-bottom:14px;">
    <button class="saving-tab-btn${tab==='active'?' active':''}" data-tab="active" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(0,0,0,0.08));background:${tab==='active'?'var(--accent,#3b82f6)':'transparent'};color:${tab==='active'?'#fff':'var(--txt-muted)'};font-size:0.78rem;font-weight:600;">🔄 Aktif/Proses (${activeBuckets.length})</button>
    <button class="saving-tab-btn${tab==='completed'?' active':''}" data-tab="completed" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(0,0,0,0.08));background:${tab==='completed'?'var(--accent,#3b82f6)':'transparent'};color:${tab==='completed'?'#fff':'var(--txt-muted)'};font-size:0.78rem;font-weight:600;">🏁 Tercapai (${completedBuckets.length})</button>
  </div>`;

  const shownBuckets = tab==='active' ? activeBuckets : completedBuckets;
  const cardsHTML = shownBuckets.length
    ? shownBuckets.map(b => bucketCardHTML(b)).join('')
    : (tab==='active'
        ? emptyState('🪣','Belum ada kantong aktif','Ketuk "+ Buat" untuk mulai')
        : emptyState('🏁','Belum ada kantong tercapai','Kantong yang ditandai selesai akan muncul di sini'));

  list.innerHTML = tabsHTML + cardsHTML;

  $$('#saving-bucket-list .saving-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.savingBucketTab = btn.dataset.tab;
      renderTabungan();
    });
  });

  // Listeners
  $$('#saving-bucket-list [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const {bid, action} = btn.dataset;
      if (action==='deposit') openSavingTxSheet('deposit', bid);
      else if (action==='withdraw') openSavingTxSheet('withdraw', bid);
      else if (action==='edit') openBucketSheet(bid);
      else if (action==='complete') {
        const b = APP.savingBuckets.find(x=>x.id===bid);
        if (!b) return;
        const bal = getBucketBalance(bid);
        const reachedFull = b.target > 0 && bal >= b.target;
        // Completing below 100% is allowed, but needs an explicit confirm —
        // and its progress bar will keep showing the real percentage
        // (never locked to 100%), since it never actually got there.
        if (b.target > 0 && !reachedFull) {
          const pct = Math.round((bal/b.target)*100);
          const ok = await askConfirm(
            `Progress kantong ini baru ${pct}% dari target. Tetap tandai selesai?`,
            {title:'Yakin tandai selesai?', icon:'🏁'}
          );
          if (!ok) return;
        }
        b.status='completed'; b.completedAt=todayStr(); b.achievedFull=reachedFull;
        persist(); renderTabungan();
        showToast('🏁 Kantong ditandai selesai','success');
      }
      else if (action==='reactivate') {
        const b = APP.savingBuckets.find(x=>x.id===bid);
        if(b){ b.status='active'; delete b.completedAt; delete b.achievedFull; }
        persist(); renderTabungan();
        showToast('🔓 Kantong dibuka lagi, bisa nabung lagi','success');
      }
      else if (action==='del') {
        const hasTxs = APP.savingTxs.some(t=>t.bucketId===bid);
        if(hasTxs) {
          const txCount = APP.savingTxs.filter(t=>t.bucketId===bid).length;
          const bal = getBucketBalance(bid);
          const walletTxCount = APP.transactions.filter(t=>t.bucketId===bid).length;
          APP.deleteTarget = {type:'bucket', id:bid};
          let msg = `Kantong ini memiliki ${txCount} transaksi tabungan. Semua transaksi tabungan pada kantong ini akan ikut dihapus. Lanjutkan?`;
          // Old buckets (created before this wallet-link field existed) may have
          // deposits without a matching wallet transaction — warn instead of
          // guessing which transaction to touch, so nothing is deleted wrongly.
          if (bal > 0 && walletTxCount === 0) {
            msg += `\n\n⚠️ Saldo kantong ini ${formatRp(bal)} tapi tidak ditemukan transaksi dompet yang terhubung — kemungkinan data lama. Saldo dompet TIDAK akan otomatis disesuaikan, silakan periksa manual jika perlu.`;
          }
          $('#modal-delete-msg').textContent = msg;
          $('#modal-delete').style.display = 'flex';
          return;
        }
        APP.savingBuckets = APP.savingBuckets.filter(b=>b.id!==bid);
        persist(); renderTabungan(); showToast('Kantong dihapus','info');
      }
    });
  });
}

// Renders a single saving-bucket card. Active buckets get full actions
// (tabung/tarik/edit/selesai/hapus); completed buckets can still be
// withdrawn from (e.g. to cash the goal out) but can no longer receive new
// deposits, and get a "buka lagi" action instead of "tandai selesai".
function bucketCardHTML(b) {
  const done = b.status === 'completed';
  const bal = getBucketBalance(b.id);
  // A bucket that genuinely hit 100% before being marked complete keeps
  // showing 100% forever (the achievement stays even after withdrawing the
  // money) — but one completed early below target just shows its real,
  // unlocked percentage, since it never actually got there.
  const lockedFull = done && b.achievedFull && b.target > 0;
  const pct = lockedFull ? 100 : (b.target > 0 ? Math.min(Math.round((bal/b.target)*100),100) : null);
  // Only shown once the bucket is fully drained to zero — tells the user
  // where the money that the 100% bar implies actually went, instead of
  // just silently showing a full bar next to "Rp 0".
  const fullyWithdrawn = lockedFull && bal === 0;
  const recentTxs = APP.savingTxs.filter(t=>t.bucketId===b.id).slice(-3).reverse();
  // Collect unique wallets used for deposits in this bucket
  const usedWalletIds = [...new Set(APP.savingTxs.filter(t=>t.bucketId===b.id && t.type==='deposit').map(t=>t.walletId))];
  const walletTags = usedWalletIds.map(wid => {
    const w = APP.wallets.find(x=>x.id===wid);
    return w ? `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--card2,#f1f5f9);border-radius:20px;padding:2px 8px;font-size:0.62rem;color:var(--txt-muted);margin-right:4px;margin-top:4px;">${w.emoji} ${escapeHtml(w.name)}</span>` : '';
  }).join('');
  const actionButtons = done
    ? `<button class="wcard-btn transfer" data-bid="${b.id}" data-action="withdraw" style="background:var(--expense-bg);color:var(--expense);border-color:rgba(239,68,68,0.25);">⬇️ Tarik</button>
       <button class="wcard-btn edit" data-bid="${b.id}" data-action="reactivate">🔓 Buka Lagi</button>
       <button class="wcard-btn del" data-bid="${b.id}" data-action="del">🗑️</button>`
    : `<button class="wcard-btn transfer" data-bid="${b.id}" data-action="deposit">⬆️ Tabung</button>
       <button class="wcard-btn transfer" data-bid="${b.id}" data-action="withdraw" style="background:var(--expense-bg);color:var(--expense);border-color:rgba(239,68,68,0.25);">⬇️ Tarik</button>
       <button class="wcard-btn edit" data-bid="${b.id}" data-action="edit">✏️</button>
       <button class="wcard-btn edit" data-bid="${b.id}" data-action="complete" title="Tandai kantong ini selesai">🏁</button>
       <button class="wcard-btn del" data-bid="${b.id}" data-action="del">🗑️</button>`;
  return `<div class="wallet-card" style="margin-bottom:12px;${done?'opacity:0.75;':''}">
      <div class="wcard-top">
        <div class="wcard-emoji">${b.emoji||'🪣'}</div>
        <div style="flex:1;min-width:0;">
          <div class="wcard-name">${escapeHtml(b.name)} ${done?'<span style="font-size:0.62rem;font-weight:600;color:var(--income);background:rgba(34,197,94,0.12);border-radius:10px;padding:2px 8px;margin-left:4px;">✅ Selesai</span>':''}${fullyWithdrawn?' <span style="font-size:0.62rem;font-weight:600;color:var(--expense);background:rgba(239,68,68,0.12);border-radius:10px;padding:2px 8px;margin-left:4px;">💸 Sudah Ditarik</span>':''}</div>
          ${walletTags ? `<div style="margin-top:2px;display:flex;flex-wrap:wrap;">${walletTags}</div>` : ''}
          <div class="wcard-count" style="margin-top:4px;">${recentTxs.length} transaksi terakhir</div>
        </div>
        <div style="text-align:right;">
          <div class="wcard-bal" style="color:var(--info)">${formatRp(bal)}</div>
          ${pct!==null?`<div style="font-size:0.65rem;color:var(--txt-muted);margin-top:2px;">${pct}% dari target</div>`:''}
        </div>
      </div>
      ${b.target>0?`<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--txt-muted);margin-bottom:4px;">
          <span>${formatRpC(bal)} tersimpan</span><span>Target ${formatRpC(b.target)}</span>
        </div>
        <div class="bi-bar"><div class="bi-bar-fill ${pct>=100?'safe':pct>=60?'warn':'safe'}" style="width:${pct}%;background:linear-gradient(90deg,#1d4ed8,#3b82f6)"></div></div>
      </div>`:''}
      <div class="wcard-actions">
        ${actionButtons}
      </div>
    </div>`;
}

// Bucket sheet
APP._editBucketId = null;
function openBucketSheet(editId=null) {
  APP._editBucketId = editId;
  const existing = editId ? APP.savingBuckets.find(b=>b.id===editId) : null;
  const title = $('#bucket-sheet-title'); if(title) title.textContent = editId?'✏️ Edit Kantong':'🪣 Buat Kantong Tabungan';
  const bn = $('#bucket-name'); if(bn) bn.value = existing?.name||'';
  const bt = $('#bucket-target'); if(bt){ bt.value=existing?.target?existing.target.toLocaleString('id'):''; fmtAmtInput(bt); }
  // Emoji picker
  const ep = $('#bucket-emoji-picker');
  if(ep) {
    ep.innerHTML = BUCKET_EMOJIS.map(e=>`<div class="emoji-opt${(existing?.emoji||'🎯')===e?' selected':''}" data-emoji="${e}">${e}</div>`).join('');
    $$('#bucket-emoji-picker .emoji-opt').forEach(o=>o.addEventListener('click',()=>{
      $$('#bucket-emoji-picker .emoji-opt').forEach(x=>x.classList.remove('selected'));
      o.classList.add('selected');
    }));
  }
  openSheet('bucket');
  setTimeout(()=>$('#bucket-name')?.focus(),300);
}

function saveBucket() {
  const name = $('#bucket-name')?.value?.trim();
  if(!name) return showToast('Isi nama kantong','error');
  const emoji = $('#bucket-emoji-picker .emoji-opt.selected')?.dataset?.emoji||'🎯';
  const raw = $('#bucket-target')?.value?.replace(/\D/g,'')||'0';
  const target = parseInt(raw)||0;
  if(APP._editBucketId) {
    const b = APP.savingBuckets.find(x=>x.id===APP._editBucketId);
    if(b){ b.name=name; b.emoji=emoji; b.target=target; }
  } else {
    APP.savingBuckets.push({id:genId(),name,emoji,target,createdAt:todayStr(),status:'active'});
  }
  persist(); closeSheet('bucket'); renderTabungan();
  showToast(APP._editBucketId?'Kantong diupdate ✅':'Kantong dibuat ✅','success');
  APP._editBucketId=null;
}

// Saving transaction sheet
APP._savingTxMode = 'deposit';
APP._savingTxBucketId = null;

function openSavingTxSheet(mode='deposit', bucketId=null) {
  APP._savingTxMode = mode;
  APP._savingTxBucketId = bucketId;
  APP._savingTxWalletId = APP.selectedWalletId || APP.wallets[0]?.id;
  const title = $('#saving-tx-title');
  if(title) title.textContent = mode==='deposit'?'⬆️ Tabung':'⬇️ Tarik dari Tabungan';
  // Toggle active state
  $('#stx-deposit-btn')?.classList.toggle('active', mode==='deposit');
  $('#stx-withdraw-btn')?.classList.toggle('active', mode==='withdraw');
  // Clear amount
  const amt = $('#saving-tx-amount'); if(amt) amt.value='';
  // Date
  const dt = $('#saving-tx-date'); if(dt) dt.value=todayStr();
  const note = $('#saving-tx-note'); if(note) note.value='';
  // Completed buckets can't receive new deposits — hide them from the
  // picker when depositing, so there's no way to sneak a "Tabung" into a
  // bucket that's already marked finished.
  const pickableBuckets = mode==='deposit'
    ? APP.savingBuckets.filter(b => b.status!=='completed')
    : APP.savingBuckets;
  if (mode==='deposit' && bucketId) {
    const stillValid = pickableBuckets.some(b=>b.id===bucketId);
    if (!stillValid) { bucketId = null; APP._savingTxBucketId = null; }
  }
  // Bucket selector
  const bs = $('#saving-bucket-select');
  if(bs) {
    bs.innerHTML = pickableBuckets.map(b=>`
      <div class="wallet-pill${b.id===bucketId?' selected':''}" data-bucket="${b.id}">
        <span class="wallet-pill-emoji">${b.emoji||'🪣'}</span>
        <span class="wallet-pill-name">${escapeHtml(b.name)}</span>
      </div>`).join('');
    $$('#saving-bucket-select .wallet-pill').forEach(p=>p.addEventListener('click',()=>{
      $$('#saving-bucket-select .wallet-pill').forEach(x=>x.classList.remove('selected'));
      p.classList.add('selected'); APP._savingTxBucketId=p.dataset.bucket;
    }));
  }
  // Wallet selector
  buildWalletPillRow('saving-wallet-select', APP.selectedWalletId, id => APP._savingTxWalletId = id, {showBalance:true});
  openSheet('saving-tx');
  setTimeout(()=>$('#saving-tx-amount')?.focus(),300);
}

function saveSavingTx() {
  const bucketId = APP._savingTxBucketId || $('#saving-bucket-select .wallet-pill.selected')?.dataset?.bucket;
  if(!bucketId) return showToast('Pilih kantong tabungan','error');
  const raw = $('#saving-tx-amount')?.value?.replace(/\D/g,'')||'0';
  const amount = parseInt(raw)||0;
  if(!amount) return showToast('Masukkan jumlah','error');
  const walletId = APP._savingTxWalletId || $('#saving-wallet-select .wallet-pill.selected')?.dataset?.wid || APP.wallets[0]?.id;
  const date = $('#saving-tx-date')?.value||todayStr();
  const note = $('#saving-tx-note')?.value?.trim()||'';
  const mode = APP._savingTxMode;

  const bucket = APP.savingBuckets.find(b=>b.id===bucketId);
  if (mode==='deposit' && bucket?.status==='completed') {
    return showToast('Kantong ini sudah selesai — buka lagi dulu untuk menabung','error');
  }

  // Check wallet balance for deposit
  if(mode==='deposit') {
    const walBal = getWalletBalance(walletId);
    if(walBal < amount) return showToast('Saldo dompet tidak cukup','error');
  } else {
    const bucketBal = getBucketBalance(bucketId);
    if(bucketBal < amount) return showToast('Saldo tabungan tidak cukup','error');
  }

  // Add saving transaction
  const savingTxId = genId();
  APP.savingTxs.push({id:savingTxId, bucketId, walletId, type:mode, amount, date, note});

  // Adjust wallet balance via a dedicated transaction type — 'saving_transfer'
  // with an explicit direction, mirroring how wallet-to-wallet 'transfer' is
  // its own type. This is what makes every income/expense filter in the app
  // exclude it automatically, with nothing to remember at each call site.
  // savingTxRef links back to the savingTxs record above so that deleting
  // this transaction from Riwayat can also remove its paired bucket entry
  // instead of leaving the two out of sync.
  const desc = mode==='deposit'?`Tabung → ${bucket?.name||'Tabungan'}`:`Tarik ← ${bucket?.name||'Tabungan'}`;
  APP.transactions.push({
    id:genId(), type:'saving_transfer', direction: mode,
    amount, catId:'saving_transfer', desc, date, walletId, note, photo:null, bucketId,
    savingTxRef: savingTxId
  });

  persist(); closeSheet('saving-tx'); renderTabungan(); renderDashboard();
  showToast(mode==='deposit'?`✅ Berhasil menabung ${formatRpC(amount)}`:`✅ Berhasil menarik ${formatRpC(amount)}`,'success');
}


// ===================== RENDER BUDGET MANAGER =====================


function getBudgetMonth() {
  const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}

function getBudgetMonthLabel() {
  const mNames=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const n=new Date(); return `${mNames[n.getMonth()]} ${n.getFullYear()}`;
}

function renderBudget() {
  const month = getBudgetMonth();
  const budgets = APP.budgets.filter(b=>b.month===month);
  const monthTxs = APP.transactions.filter(t=>t.date.startsWith(month)&&t.type==='expense');

  // Totals
  const totalLimit = budgets.reduce((s,b)=>s+b.limit,0);
  const totalUsed  = budgets.reduce((s,b)=>{
    const used=monthTxs.filter(t=>t.catId===b.cat).reduce((ss,t)=>ss+t.amount,0);
    return s+Math.min(used,b.limit);
  },0);
  const totalActualUsed = budgets.reduce((s,b)=>{
    return s+monthTxs.filter(t=>t.catId===b.cat).reduce((ss,t)=>ss+t.amount,0);
  },0);
  const totalRemain = totalLimit - totalActualUsed;
  const pct = totalLimit>0 ? Math.round((totalActualUsed/totalLimit)*100) : 0;

  const lbl=$('#budget-month-label'); if(lbl) lbl.textContent=getBudgetMonthLabel();
  const bt=$('#budget-total'),bu=$('#budget-used'),br=$('#budget-remain');
  if(bt) bt.textContent=formatRpC(totalLimit);
  if(bu) bu.textContent=formatRpC(totalActualUsed);
  if(br){ br.textContent=formatRpC(Math.max(0,totalRemain)); br.style.color=totalRemain<0?'var(--expense)':'var(--income)'; }

  // Overall progress card
  const clss = pct>=90?'danger':pct>=70?'warn':'safe';
  const tips = pct>=90?'⚠️ Budget hampir habis! Hemat pengeluaran.':pct>=70?'💡 Sudah lebih dari 70%, perhatikan pengeluaran.':'✅ Budget masih aman, terus pertahankan!';
  const boc=$('#budget-overall-card');
  if(boc) boc.innerHTML=`
    <div class="boc-row"><span class="boc-label">Total terpakai ${pct}%</span><span class="boc-pct" style="color:${pct>=90?'var(--expense)':pct>=70?'var(--warn)':'var(--income)'}">${formatRpC(totalActualUsed)} / ${formatRpC(totalLimit)}</span></div>
    <div class="boc-bar"><div class="boc-fill ${clss}" style="width:${Math.min(pct,100)}%"></div></div>
    <div class="boc-tips">${tips}</div>`;

  // Budget list per category
  const bl=$('#budget-list');
  if(!bl) return;
  if(!budgets.length){
    bl.innerHTML=`<div class="empty-state"><div class="empty-icon">💰</div><p>Belum ada budget</p><span>Ketuk "+ Tambah" untuk mulai</span></div>`;
  } else {
    bl.innerHTML=budgets.map(b=>{
      const cat=getCatList('expense').find(c=>c.id===b.cat)||{name:b.cat,emoji:'💸'};
      const used=monthTxs.filter(t=>t.catId===b.cat).reduce((s,t)=>s+t.amount,0);
      const remain=b.limit-used;
      const bpct=b.limit>0?Math.round((used/b.limit)*100):0;
      const bcls=bpct>=90?'danger':bpct>=70?'warn':'safe';
      const rbadge=bpct>=100?'over':bpct>=70?'warn':'ok';
      const rlabel=bpct>=100?'OVER BUDGET':bpct>=70?'Hampir Habis':'Aman';
      return `<div class="budget-item ${bpct>=90?'over':bpct>=70?'warn':''}">
        <div class="bi-top">
          <div class="bi-emoji">${cat.emoji}</div>
          <div class="bi-info">
            <div class="bi-cat">${cat.name}</div>
            <div class="bi-used">${formatRpC(used)} dari ${formatRpC(b.limit)}</div>
          </div>
          <div class="bi-right">
            <div class="bi-remain ${remain<0?'over':bpct>=70?'warn':'ok'}">${remain<0?'-':''}${formatRpC(Math.abs(remain))}</div>
            <div class="bi-badge ${rbadge}">${rlabel}</div>
          </div>
        </div>
        <div class="bi-bar"><div class="bi-bar-fill ${bcls}" style="width:${Math.min(bpct,100)}%"></div></div>
        <div class="bi-actions">
          <button class="bi-action-btn edit" data-bid="${b.id}">✏️ Edit</button>
          <button class="bi-action-btn del" data-bid="${b.id}">🗑️</button>
        </div>
      </div>`;
    }).join('');
    // listeners
    $$('#budget-list .bi-action-btn.edit').forEach(btn=>btn.addEventListener('click',()=>openBudgetSheet(btn.dataset.bid)));
    $$('#budget-list .bi-action-btn.del').forEach(btn=>btn.addEventListener('click',()=>{
      APP.budgets=APP.budgets.filter(b=>b.id!==btn.dataset.bid);
      persist(); renderBudget(); showToast('Budget dihapus','info');
    }));
  }

  // Untracked spending (expense categories with no budget)
  const budgetedCats=budgets.map(b=>b.cat);
  const catMap={};
  monthTxs.filter(t=>!budgetedCats.includes(t.catId)).forEach(t=>{
    const cat=getCatList("expense").find(c=>c.id===t.catId)||{name:"Lainnya",emoji:"💸"};
    if(!catMap[t.catId]) catMap[t.catId]={name:cat.name,emoji:cat.emoji,total:0};
    catMap[t.catId].total+=t.amount;
  });
  const untracked=Object.values(catMap).sort((a,b)=>b.total-a.total);
  const utl=$('#budget-untracked-list');
  if(utl){
    if(!untracked.length){ utl.innerHTML=`<div style="font-size:0.78rem;color:var(--txt-muted);padding:6px 0">✅ Semua pengeluaran sudah punya budget</div>`; }
    else { utl.innerHTML=untracked.map(c=>`
      <div class="lap-cat-item">
        <span class="lap-cat-emoji">${c.emoji}</span>
        <div class="lap-cat-info">
          <div class="lap-cat-name">${c.name}</div>
          <div class="lap-cat-bar-bg" style="background:var(--warn-bg)"><div class="lap-cat-bar-fill" style="background:linear-gradient(90deg,var(--warn),#fbbf24);width:60%"></div></div>
        </div>
        <span class="lap-cat-amt" style="color:var(--warn)">${formatRpC(c.total)}</span>
      </div>`).join(''); }
  }
}

// Budget sheet
APP._editBudgetId = null;
function openBudgetSheet(editId=null, preselectCat=null) {
  APP._editBudgetId = editId;
  const month = getBudgetMonth();
  const existing = editId ? APP.budgets.find(b=>b.id===editId) : null;
  const title=$('#budget-sheet-title'); if(title) title.textContent=editId?'✏️ Edit Budget':'💰 Tambah Budget';

  // Category pills — only expense cats not yet budgeted (or current cat if editing)
  const budgetedCats=APP.budgets.filter(b=>b.month===month&&b.id!==editId).map(b=>b.cat);
  const avail=getCatList('expense').filter(c=>!budgetedCats.includes(c.id));
  renderBudgetCatPicker(avail, preselectCat || existing?.cat);
  const ba=$('#budget-amount');
  if (ba) {
    // If we're returning here after a detour to "+ Kategori Baru", restore
    // whatever the user had already typed instead of wiping it.
    if (APP._budgetAmountDraft !== undefined) {
      ba.value = APP._budgetAmountDraft;
      APP._budgetAmountDraft = undefined;
    } else {
      ba.value = existing ? existing.limit.toLocaleString('id') : '';
    }
    fmtAmtInput(ba);
  }
  openSheet('budget');
}

// Renders the category picker inside the Budget sheet: built-in + custom
// categories, a "+ Kategori Baru" pill to create one on the spot, and a
// small delete (×) affordance on custom-category pills only.
function renderBudgetCatPicker(avail, selectedCatId) {
  const bcs=$('#budget-cat-scroll'); if(!bcs) return;
  const customIds = new Set(APP.customCats.map(c=>c.id));
  bcs.innerHTML = `<div class="cat-pill add-cat-pill" id="budget-add-cat-btn"><span class="cat-emoji">➕</span><span class="cat-label">Baru</span></div>` + avail.map(c => {
    const isCustom = customIds.has(c.id);
    return `<div class="cat-pill expense-cat${selectedCatId===c.id?' selected':''}" data-cat="${c.id}">
      <span class="cat-emoji">${c.emoji}</span><span class="cat-label">${escapeHtml(c.name)}</span>
      ${isCustom?`<span class="cat-del-x" data-catdel="${c.id}" title="Hapus kategori">✕</span>`:''}
    </div>`;
  }).join('');

  $$('#budget-cat-scroll .cat-pill[data-cat]').forEach(p=>p.addEventListener('click',(e)=>{
    if (e.target.closest('[data-catdel]')) return; // handled separately below
    $$('#budget-cat-scroll .cat-pill').forEach(x=>x.classList.remove('selected'));
    p.classList.add('selected');
  }));
  $$('#budget-cat-scroll [data-catdel]').forEach(x=>x.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteCustomCategory(x.dataset.catdel);
  }));
  // Opening the "Kategori Baru" sheet closes the Budget sheet first (rather
  // than stacking two bottom sheets on top of each other, which would
  // overlap messily since both anchor to the bottom of the screen). The
  // Budget sheet reopens automatically once the new-category flow finishes.
  $('#budget-add-cat-btn')?.addEventListener('click', () => {
    APP._budgetAmountDraft = $('#budget-amount')?.value || '';
    closeSheet('budget');
    openNewCategorySheet();
  });
}

// Deletes a custom category. If any transaction still uses it, deletion is
// blocked and the user is asked to move those transactions to a different
// category first — nothing is auto-reassigned or silently altered.
async function deleteCustomCategory(catId) {
  const cat = APP.customCats.find(c=>c.id===catId);
  if (!cat) return;
  const inUseCount = APP.transactions.filter(t=>t.catId===catId).length;
  if (inUseCount > 0) {
    await askConfirm(
      `Kategori "${cat.name}" masih dipakai di ${inUseCount} transaksi.\n\nUbah dulu kategori transaksi-transaksi tersebut sebelum menghapus kategori ini.`,
      {title:'Kategori masih dipakai', icon:'⚠️'}
    );
    return;
  }
  const ok = await askConfirm(`Hapus kategori "${cat.name}"? Tindakan ini tidak dapat dibatalkan.`, {title:'Hapus Kategori?', icon:'🗑️'});
  if (!ok) return;
  APP.customCats = APP.customCats.filter(c=>c.id!==catId);
  persist();
  showToast('🗑️ Kategori dihapus');
  const month = getBudgetMonth();
  const budgetedCats=APP.budgets.filter(b=>b.month===month&&b.id!==APP._editBudgetId).map(b=>b.cat);
  renderBudgetCatPicker(getCatList('expense').filter(c=>!budgetedCats.includes(c.id)));
}

// ===================== NEW CATEGORY SHEET =====================
function openNewCategorySheet() {
  $('#newcat-name').value = '';
  const grid = $('#newcat-emoji-grid');
  grid.innerHTML = CAT_EMOJIS.map((e,i) => `<div class="emoji-opt${i===0?' selected':''}" data-emoji="${e}">${e}</div>`).join('');
  $$('#newcat-emoji-grid .emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('#newcat-emoji-grid .emoji-opt').forEach(x=>x.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
  openSheet('newcat');
  setTimeout(()=>$('#newcat-name').focus(), 300);
}
function closeNewCategorySheet() {
  closeSheet('newcat');
  // Always return to the Budget sheet, preserving whatever add/edit
  // context (APP._editBudgetId) was active before "+ Kategori Baru" was tapped.
  openBudgetSheet(APP._editBudgetId);
}
function submitNewCategory() {
  const name  = $('#newcat-name').value.trim();
  const emoji = $('#newcat-emoji-grid .emoji-opt.selected')?.dataset.emoji || '💸';
  if (!name) { showToast('⚠️ Nama kategori tidak boleh kosong','error'); return; }
  const newCat = {id:'custom_'+genId(), name, emoji, type:'expense'};
  APP.customCats.push(newCat);
  persist();
  closeSheet('newcat');
  showToast(`✅ Kategori "${name}" ditambahkan`);
  openBudgetSheet(APP._editBudgetId, newCat.id);
}

function saveBudget() {
  const month=getBudgetMonth();
  const selCat=$('#budget-cat-scroll .cat-pill.selected');
  if(!selCat) return showToast('Pilih kategori dulu','error');
  const cat=selCat.dataset.cat;
  const raw=$('#budget-amount').value.replace(/\D/g,'');
  const limit=parseInt(raw)||0;
  if(!limit) return showToast('Masukkan nominal budget','error');

  if(APP._editBudgetId){
    const b=APP.budgets.find(x=>x.id===APP._editBudgetId);
    if(b){b.cat=cat;b.limit=limit;}
  } else {
    APP.budgets.push({id:genId(),cat,limit,month});
  }
  persist(); closeSheet('budget'); renderBudget();
  showToast(APP._editBudgetId?'Budget diupdate ✅':'Budget ditambahkan ✅','success');
  APP._editBudgetId=null;
}

// ===================== RENDER KALENDER (UPGRADED) =====================
APP.calYear         = APP.calYear         || new Date().getFullYear();
APP.calMonth        = APP.calMonth        || new Date().getMonth();
APP.calSelectedDate = APP.calSelectedDate || todayStr();


function renderKalender() {
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

function renderKalenderDetail() {
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

function openReminderSheet() {
  if(!APP.calSelectedDate) return showToast('Pilih tanggal dulu','error');
  const dl=$('#reminder-date-label');
  if(dl) dl.textContent='Tanggal: '+formatDate(APP.calSelectedDate);
  const rt=$('#reminder-title'); if(rt) rt.value='';
  const ra=$('#reminder-amount'); if(ra) ra.value='';
  openSheet('reminder');
}

function saveReminder() {
  const title=$('#reminder-title')?.value?.trim();
  if(!title) return showToast('Isi judul pengingat','error');
  const raw=$('#reminder-amount')?.value?.replace(/\D/g,'')||'0';
  const cat=$('#reminder-cat')?.value||'bills';
  APP.reminders.push({ id:genId(), date:APP.calSelectedDate, title, amount:parseInt(raw)||0, cat });
  persist(); closeSheet('reminder'); renderKalender();
  showToast('🔔 Pengingat ditambahkan','success');
}


// Pages that are sub-pages (shown from Lainnya hub — get a back button, no direct nav tab)
const SUB_PAGES = ['dompet', 'hutang', 'settings', 'kalender'];

function navigateTo(page, fromNav=false) {
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

  if      (page==='dashboard') renderDashboard();
  else if (page==='analitik')  renderAnalitik();
  else if (page==='riwayat')   renderRiwayat();
  else if (page==='dompet')    renderDompet();
  else if (page==='lainnya')   renderLainnya();
  else if (page==='impian')    renderTabungan();
  else if (page==='hutang')    renderHutang();
  else if (page==='laporan')   renderBudget();
  else if (page==='kalender')  renderKalender();
  else if (page==='budget')    renderBudget();
  if (page==='settings') {
    const last = getAutoBackupLastDate();
    const el = $('#backup-last-desc');
    if (el) el.textContent = last ? `Backup terakhir: ${last} · auto setiap 7 hari` : 'Auto backup setiap 7 hari';
  }
}

// ===================== SHEET CONTROL =====================
function openSheet(name)  { $(`#${name}-backdrop`)?.classList.add('open');    $(`#sheet-${name}`)?.classList.add('open');    document.body.style.overflow='hidden'; }
function closeSheet(name) { $(`#${name}-backdrop`)?.classList.remove('open'); $(`#sheet-${name}`)?.classList.remove('open'); document.body.style.overflow=''; }

// ===================== TX SHEET =====================
function openTxSheet(editId=null) {
  APP.editingTxId = editId;
  const tx   = editId ? APP.transactions.find(t=>t.id===editId) : null;
  const type = tx?.type || APP.selectedType || 'income';
  $('#addtx-title').textContent = editId ? '✏️ Edit Transaksi' : '➕ Catat Transaksi';
  setTxType(type);
  $('#tx-amount').value = tx ? tx.amount.toLocaleString('id-ID') : '';
  $('#tx-desc').value   = tx?.desc   || '';
  $('#tx-date').value   = tx?.date   || todayStr();
  $('#tx-note').value   = tx?.note   || '';
  APP.txPhoto          = tx?.photo  || null;
  APP.selectedCatId    = tx?.catId  || (type==='income'?'other_inc':'other_exp');
  APP.selectedWalletId = tx?.walletId || APP.wallets[0]?.id || 'default';
  buildCatScroll(type);
  buildWalletPillRow('wallet-select-row', APP.selectedWalletId, id => APP.selectedWalletId = id);
  updatePhotoPreview();
  $('#tx-cancel-edit').style.display = editId ? '' : 'none';
  openSheet('addtx');
  setTimeout(() => $('#tx-amount').focus(), 300);
}

function setTxType(type) {
  APP.selectedType = type;
  $('#type-income').classList.toggle('active', type==='income');
  $('#type-expense').classList.toggle('active', type==='expense');
  const isExp = type==='expense';
  $('#tx-submit-btn').classList.toggle('expense-mode', isExp);
  const act = APP.editingTxId ? 'Update' : 'Simpan';
  $('#tx-submit-label').textContent = `${act} ${isExp?'Pengeluaran':'Pemasukan'}`;
  APP.selectedCatId = type==='income' ? 'other_inc' : 'other_exp';
  buildCatScroll(type);
}

function buildCatScroll(type) {
  const cats = getCatList(type);
  $('#cat-scroll').innerHTML = cats.map(c =>
    `<div class="cat-pill${c.id===APP.selectedCatId?' selected'+(type==='expense'?' expense-cat':''):''}" data-cat="${c.id}">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-label">${escapeHtml(c.name)}</div>
    </div>`).join('');
  $$('#cat-scroll .cat-pill').forEach(p => {
    p.addEventListener('click', () => {
      APP.selectedCatId = p.dataset.cat;
      $$('#cat-scroll .cat-pill').forEach(x => x.classList.remove('selected','expense-cat'));
      p.classList.add('selected');
      if (APP.selectedType==='expense') p.classList.add('expense-cat');
    });
  });
}

// Generic wallet-pill selector builder — replaces the 3 near-duplicate
// builders that used to exist (tx/saving/debt/pay all funnel through this).
function buildWalletPillRow(containerId, selectedId, onSelect, opts={}) {
  const c = $(`#${containerId}`); if (!c) return;
  c.innerHTML = APP.wallets.map(w => {
    const bal = opts.showBalance ? ` <span style="font-size:0.65rem;opacity:0.75;">(${formatRpC(getWalletBalance(w.id))})</span>` : '';
    return `<div class="wallet-pill${w.id===selectedId?' selected':''}" data-wid="${escapeHtml(w.id)}">
      <span class="wallet-pill-emoji">${escapeHtml(w.emoji)}</span>
      <span class="wallet-pill-name">${escapeHtml(w.name)}${bal}</span>
    </div>`;
  }).join('');
  c.querySelectorAll('.wallet-pill').forEach(p => {
    p.addEventListener('click', () => {
      onSelect(p.dataset.wid);
      c.querySelectorAll('.wallet-pill').forEach(x => x.classList.remove('selected'));
      p.classList.add('selected');
    });
  });
}

function submitTx() {
  const amount = parseAmt($('#tx-amount').value);
  const desc   = $('#tx-desc').value.trim();
  const date   = $('#tx-date').value;
  const note   = $('#tx-note').value.trim();
  const type   = APP.selectedType;
  if (!amount || amount<=0) { showToast('⚠️ Nominal tidak boleh kosong','error'); return; }
  if (!desc)                { showToast('⚠️ Deskripsi tidak boleh kosong','error'); return; }
  if (!date)                { showToast('⚠️ Tanggal tidak boleh kosong','error'); return; }
  const obj = {id:genId(),type,amount,desc,date,walletId:APP.selectedWalletId,catId:APP.selectedCatId,note,photo:APP.txPhoto};
  if (APP.editingTxId) {
    const idx = APP.transactions.findIndex(t=>t.id===APP.editingTxId);
    if (idx!==-1) APP.transactions[idx] = {...APP.transactions[idx], ...obj, id:APP.editingTxId};
    showToast('✅ Transaksi diperbarui');
  } else {
    APP.transactions.push(obj);
    showToast(type==='income' ? '✅ Pemasukan dicatat' : '✅ Pengeluaran dicatat');
  }
  persist(); closeSheet('addtx'); APP.editingTxId=null; APP.txPhoto=null;
  refreshCurrentPage();
}

// ===================== PHOTO =====================
function compressPhoto(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX=400; let w=img.width, h=img.height;
      if (w>MAX) { h=Math.round(h*MAX/w); w=MAX; }
      const canvas = document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',0.55));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function updatePhotoPreview() {
  const prev = $('#photo-preview');
  if (APP.txPhoto) {
    prev.style.display = '';
    prev.innerHTML = `<img src="${APP.txPhoto}" alt="struk"/><div class="photo-remove" id="photo-remove-btn">✕</div>`;
    $('#photo-remove-btn')?.addEventListener('click', () => { APP.txPhoto=null; updatePhotoPreview(); });
  } else {
    prev.style.display='none'; prev.innerHTML='';
  }
}

// ===================== WALLET SHEET =====================
function openWalletSheet(editId=null) {
  APP.editingWalletId = editId;
  const w = editId ? APP.wallets.find(x=>x.id===editId) : null;
  $('#wallet-sheet-title').textContent = editId ? '✏️ Edit Dompet' : '👛 Tambah Dompet';
  $('#wallet-name').value    = w?.name || '';
  $('#wallet-balance').value = w ? w.initialBalance.toLocaleString('id-ID') : '';
  let selEmoji = w?.emoji || '👛';
  $('#wallet-emoji-picker').innerHTML = WALLET_EMOJIS.map(e =>
    `<div class="emoji-opt${e===selEmoji?' selected':''}" data-emoji="${e}">${e}</div>`).join('');
  $$('#wallet-emoji-picker .emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      selEmoji = opt.dataset.emoji;
      $$('#wallet-emoji-picker .emoji-opt').forEach(x=>x.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
  openSheet('wallet'); setTimeout(()=>$('#wallet-name').focus(),300);
}
function submitWallet() {
  const name    = $('#wallet-name').value.trim();
  const balance = parseAmt($('#wallet-balance').value);
  const emoji   = $('#wallet-emoji-picker .emoji-opt.selected')?.dataset.emoji || '👛';
  if (!name) { showToast('⚠️ Nama dompet tidak boleh kosong','error'); return; }
  if (APP.editingWalletId) {
    const idx = APP.wallets.findIndex(w=>w.id===APP.editingWalletId);
    if (idx!==-1) APP.wallets[idx] = {...APP.wallets[idx], name, emoji, initialBalance:balance};
    showToast('✅ Dompet diperbarui');
  } else {
    APP.wallets.push({id:genId(), name, emoji, initialBalance:balance, createdAt:todayStr()});
    showToast('👛 Dompet ditambahkan');
  }
  persist(); closeSheet('wallet'); APP.editingWalletId=null;
  renderDompet(); renderDashboard();
}

// ===================== TRANSFER SHEET =====================
function openTransferSheet(fromId=null) {
  const opts = () => APP.wallets.map(w=>`<option value="${w.id}">${w.emoji} ${escapeHtml(w.name)} (${formatRpC(getWalletBalance(w.id))})</option>`).join('');
  $('#transfer-from').innerHTML = opts();
  $('#transfer-to').innerHTML   = opts();
  if (fromId) $('#transfer-from').value = fromId;
  const other = APP.wallets.find(w=>w.id!==fromId);
  if (other) $('#transfer-to').value = other.id;
  $('#transfer-amount').value = ''; $('#transfer-date').value = todayStr();
  openSheet('transfer'); setTimeout(()=>$('#transfer-amount').focus(),300);
}
function submitTransfer() {
  const fromId = $('#transfer-from').value;
  const toId   = $('#transfer-to').value;
  const amount = parseAmt($('#transfer-amount').value);
  const date   = $('#transfer-date').value;
  if (fromId===toId) { showToast('⚠️ Dompet asal dan tujuan sama','error'); return; }
  if (!amount)       { showToast('⚠️ Jumlah tidak boleh kosong','error'); return; }
  const toW = APP.wallets.find(w=>w.id===toId);
  APP.transactions.push({id:genId(),type:'transfer',amount,desc:`Transfer → ${toW?.name}`,date,walletId:fromId,toWalletId:toId,catId:'other_exp',note:'',photo:null});
  persist(); closeSheet('transfer');
  showToast(`🔄 Transfer ${formatRp(amount)} berhasil`);
  renderDompet(); renderDashboard();
}


function markDebtUnpaid(id) {
  const idx = APP.debts.findIndex(d=>d.id===id); if (idx===-1) return;
  APP.debts[idx].paid     = false;
  APP.debts[idx].paidDate = null;
  persist(); renderHutang();
  showToast('↩ Status dikembalikan ke belum lunas');
}
function openGoalSheet(editId=null) {
  APP.editingGoalId = editId;
  const g = editId ? APP.goals.find(x=>x.id===editId) : null;
  $('#goal-sheet-title').textContent = editId ? '✏️ Edit Impian' : '✨ Tambah Impian';
  $('#goal-name').value     = g?.name     || '';
  $('#goal-target').value   = g ? g.target.toLocaleString('id-ID') : '';
  $('#goal-saved').value    = g ? (g.saved||0).toLocaleString('id-ID') : '';
  $('#goal-deadline').value = g?.deadline || '';
  openSheet('goal'); setTimeout(()=>$('#goal-name').focus(),300);
}
function submitGoal() {
  const name     = $('#goal-name').value.trim();
  const target   = parseAmt($('#goal-target').value);
  const saved    = parseAmt($('#goal-saved').value);
  const deadline = $('#goal-deadline').value;
  if (!name)     { showToast('⚠️ Nama impian kosong','error'); return; }
  if (!target)   { showToast('⚠️ Target tidak boleh kosong','error'); return; }
  if (!deadline) { showToast('⚠️ Deadline tidak boleh kosong','error'); return; }
  if (APP.editingGoalId) {
    const idx = APP.goals.findIndex(g=>g.id===APP.editingGoalId);
    if (idx!==-1) APP.goals[idx] = {...APP.goals[idx], name, target, saved, deadline};
    showToast('✅ Impian diperbarui');
  } else {
    APP.goals.push({id:genId(), name, target, saved:saved||0, deadline, createdAt:todayStr()});
    showToast('⭐ Impian ditambahkan!');
  }
  persist(); closeSheet('goal'); APP.editingGoalId=null;
  renderImpian(); renderLainnya();
}

// ===================== SAVING SHEET =====================
function openSavingSheet(goalId) {
  APP.savingGoalId = goalId;
  const g = APP.goals.find(x=>x.id===goalId); if (!g) return;
  $('#saving-goal-name').textContent = `untuk: ${g.name}`;
  $('#saving-amount').value = '';
  openSheet('saving'); setTimeout(()=>$('#saving-amount').focus(),300);
}
function submitSaving() {
  const amount = parseAmt($('#saving-amount').value);
  if (!amount) { showToast('⚠️ Masukkan jumlah tabungan','error'); return; }
  const idx = APP.goals.findIndex(g=>g.id===APP.savingGoalId); if (idx===-1) return;
  APP.goals[idx].saved = (APP.goals[idx].saved||0) + amount;
  persist(); closeSheet('saving');
  showToast(`💰 +${formatRp(amount)} ditabungkan!`);
  renderImpian();
}

// ===================== DEBT SHEET =====================
function setDebtType(dtype) {
  APP.debtType = dtype;
  $$('#debt-type-toggle .debt-type-btn').forEach(b => {
    const isActive = b.dataset.dtype === dtype;
    b.classList.toggle('active', isActive);
    b.classList.remove('borrowed','lent');
    if (isActive) b.classList.add(dtype);
  });
  const isBorrowed = dtype === 'borrowed';
  $('#debt-name-label').textContent   = isBorrowed ? 'Hutang Dari Siapa' : 'Dipinjamkan Kepada';
  $('#debt-wallet-label').textContent = isBorrowed ? 'Dompet Penerima (Saldo Masuk +)' : 'Dompet Sumber (Saldo Keluar −)';
  $('#debt-submit-btn').textContent   = isBorrowed ? 'Simpan — Saldo Bertambah' : 'Simpan — Saldo Berkurang';
  $('#debt-submit-btn').className     = isBorrowed ? 'submit-btn' : 'submit-btn expense-mode';
}

function openDebtSheet(editId=null) {
  APP.editingDebtId = editId;
  const d = editId ? APP.debts.find(x=>x.id===editId) : null;
  $('#debt-sheet-title').textContent = editId ? '✏️ Edit Hutang' : '💳 Tambah Hutang';
  setDebtType(d?.dtype || 'borrowed');
  $('#debt-name').value   = d?.name   || '';
  $('#debt-amount').value = d ? d.amount.toLocaleString('id-ID') : '';
  $('#debt-due').value    = d?.dueDate || '';
  $('#debt-note').value   = d?.note   || '';
  APP.debtWalletId = d?.walletId || APP.wallets[0]?.id || 'default';
  buildWalletPillRow('debt-wallet-row', APP.debtWalletId, id => APP.debtWalletId = id);
  openSheet('debt');
  setTimeout(() => $('#debt-name').focus(), 300);
}

async function submitDebt() {
  const name    = $('#debt-name').value.trim();
  const amount  = parseAmt($('#debt-amount').value);
  const dueDate = $('#debt-due').value;
  const note    = $('#debt-note').value.trim();
  const dtype   = APP.debtType;
  const walletId= APP.debtWalletId || APP.wallets[0]?.id || 'default';
  if (!name)    { showToast('⚠️ Nama tidak boleh kosong','error'); return; }
  if (!amount)  { showToast('⚠️ Jumlah tidak boleh kosong','error'); return; }
  if (!dueDate) { showToast('⚠️ Jatuh tempo tidak boleh kosong','error'); return; }

  if (APP.editingDebtId) {
    const idx = APP.debts.findIndex(d=>d.id===APP.editingDebtId);
    if (idx!==-1) {
      const old = APP.debts[idx];
      const changed = old.amount !== amount || old.walletId !== walletId || old.dtype !== dtype;
      APP.debts[idx] = {...old, name, amount, dueDate, note, dtype, walletId};
      if (changed) {
        // The initial transaction auto-created when this debt was added
        // (linked via debtRef, tagged "[Otomatis]" so it's never confused
        // with a later cicilan/payment transaction that shares the same
        // debtRef) can drift out of sync with the debt if the amount/
        // wallet/type is edited later. We never change it silently — only
        // if the user explicitly confirms, since it affects historical
        // saldo. Declining leaves old history untouched.
        const linkedTx = APP.transactions.find(t => t.debtRef === old.id && t.note?.startsWith('[Otomatis]'));
        const wantSync = linkedTx && await askConfirm(
          'Nominal/dompet/jenis hutang berubah.\n\nSesuaikan juga transaksi awal yang sudah tercatat di histori? Saldo akan ikut disesuaikan.\n\nPilih "Tidak" jika ingin histori lama tetap seperti semula.',
          {title:'Sesuaikan histori transaksi?', icon:'🔄'}
        );
        if (wantSync) {
          const direction = dtype==='borrowed' ? 'in' : 'out';
          linkedTx.type      = 'debt_transfer';
          linkedTx.direction = direction;
          linkedTx.amount    = amount;
          linkedTx.walletId  = walletId;
          linkedTx.catId     = 'debt_transfer';
          linkedTx.desc      = dtype==='borrowed' ? `Hutang dari ${name}` : `Pinjaman ke ${name}`;
          showToast('✅ Hutang & transaksi terkait diperbarui');
        } else {
          showToast('✅ Hutang diperbarui (histori transaksi lama tidak diubah)');
        }
      } else {
        showToast('✅ Hutang diperbarui');
      }
    }
  } else {
    const debt = {
      id:genId(), name, amount, dueDate, note,
      dtype,       // 'borrowed' | 'lent'
      walletId,
      paid:false, paidDate:null,
      paidAmount:0,
      payments:[],
      createdAt:todayStr(),
    };
    APP.debts.push(debt);

    // Auto-create transaction to reflect on saldo. type:'debt_transfer' (not
    // income/expense) means borrowing/lending money moves cash but is never
    // counted as real income/expense — same reasoning as saving_transfer:
    // it's a liability/receivable, not something you earned or spent.
    const txDesc = dtype==='borrowed' ? `Hutang dari ${name}` : `Pinjaman ke ${name}`;
    const direction = dtype==='borrowed' ? 'in' : 'out'; // borrowed = saldo naik, lent = saldo turun
    APP.transactions.push({
      id:genId(), type:'debt_transfer', direction, amount,
      desc:txDesc, date:todayStr(),
      walletId, catId:'debt_transfer',
      note:`[Otomatis] ${note}`, photo:null,
      debtRef: debt.id, // link back
    });

    showToast(dtype==='borrowed' ? '💸 Hutang dicatat — Saldo +' : '🤝 Pinjaman dicatat — Saldo −');
  }

  persist(); closeSheet('debt'); APP.editingDebtId=null;
  renderHutang(); renderLainnya(); renderDashboard();
}

// ===================== PAYMENT SHEET =====================
function openPaymentSheet(debtId) {
  const d = APP.debts.find(x=>x.id===debtId); if (!d) return;
  APP.payDebtId  = debtId;
  APP.payWalletId = d.walletId || APP.wallets[0]?.id || 'default';

  const paidSoFar = d.paidAmount || 0;
  const remaining = d.amount - paidSoFar;
  const pct       = Math.min(100, Math.round(paidSoFar/d.amount*100));
  const isLent    = d.dtype === 'lent';

  $('#pay-sheet-title').textContent  = isLent ? '💰 Terima Kembali' : '💳 Bayar Hutang';
  $('#pay-debt-info').textContent    = isLent ? `Dari: ${d.name}` : `Hutang ke: ${d.name}`;
  $('#pay-total-amt').textContent    = formatRp(d.amount);
  $('#pay-paid-amt').textContent     = formatRp(paidSoFar);
  $('#pay-left-amt').textContent     = formatRp(remaining);
  $('#pay-progress-bar').style.width = `${pct}%`;
  $('#pay-amount').value = '';
  $('#pay-date').value   = todayStr();
  $('#pay-note').value   = '';
  $('#pay-submit').textContent  = isLent ? 'Catat Penerimaan Kembali' : 'Bayar Sekarang';
  $('#pay-submit').className    = isLent ? 'submit-btn' : 'submit-btn expense-mode';

  // Quick fill buttons
  $('#pay-half-btn').onclick = () => {
    const half = Math.ceil(remaining / 2);
    $('#pay-amount').value = half.toLocaleString('id-ID');
  };
  $('#pay-full-btn').onclick = () => {
    $('#pay-amount').value = remaining.toLocaleString('id-ID');
  };

  buildWalletPillRow('pay-wallet-row', APP.payWalletId, id => APP.payWalletId = id);
  openSheet('pay');
  setTimeout(() => $('#pay-amount').focus(), 300);
}

function submitPayment() {
  const amount   = parseAmt($('#pay-amount').value);
  const date     = $('#pay-date').value;
  const note     = $('#pay-note').value.trim();
  const walletId = APP.payWalletId || APP.wallets[0]?.id || 'default';
  if (!amount)   { showToast('⚠️ Masukkan jumlah pembayaran','error'); return; }
  if (!date)     { showToast('⚠️ Tanggal tidak boleh kosong','error'); return; }

  const idx = APP.debts.findIndex(d=>d.id===APP.payDebtId);
  if (idx===-1) return;
  const d = APP.debts[idx];
  const remaining = d.amount - (d.paidAmount||0);
  if (amount > remaining) { showToast(`⚠️ Melebihi sisa hutang (${formatRp(remaining)})`, 'error'); return; }

  const isLent = d.dtype === 'lent';

  // Record payment
  if (!d.payments) d.payments = [];
  d.payments.push({ id:genId(), amount, date, note, walletId });
  d.paidAmount = (d.paidAmount||0) + amount;

  // Auto-mark as paid if fully paid
  if (d.paidAmount >= d.amount) {
    d.paid = true; d.paidDate = date;
    showToast(isLent ? '✅ Piutang lunas diterima kembali!' : '🎉 Hutang lunas!');
  } else {
    showToast(isLent ? `💰 +${formatRp(amount)} diterima kembali` : `✅ Cicilan ${formatRp(amount)} dibayar`);
  }

  // Create transaction to update saldo. Same as debt creation above: this is
  // a debt_transfer, not real income/expense — repaying/collecting a debt
  // isn't spending or earning, it's settling a liability/receivable.
  // borrowed paying back  = cash out (saldo turun)
  // lent receiving back   = cash in  (saldo naik)
  const direction = isLent ? 'in' : 'out';
  const txDesc = isLent ? `Terima kembali dari ${d.name}` : `Bayar hutang ke ${d.name}`;
  APP.transactions.push({
    id:genId(), type:'debt_transfer', direction, amount,
    desc:txDesc, date,
    walletId, catId:'debt_transfer',
    note: note ? `[Cicilan] ${note}` : '[Cicilan hutang]',
    photo:null,
    debtRef: d.id,
  });

  persist(); closeSheet('pay');
  renderHutang(); renderLainnya(); renderDashboard();
}

// ===================== DELETE =====================
// Generic in-app yes/no confirm, used instead of window.confirm() — native
// confirm() dialogs can be unreliable or suppressed in installed/home-screen
// PWA contexts on some platforms. This reuses the app's own modal styling
// and always resolves via explicit button tap, so behavior is consistent
// everywhere the app runs.
let _pendingConfirmResolve = null;
function askConfirm(message, {title='Konfirmasi', icon='❓'}={}) {
  return new Promise(resolve => {
    _pendingConfirmResolve = resolve;
    $('#modal-generic-title').textContent = title;
    $('#modal-generic-icon').textContent  = icon;
    $('#modal-generic-msg').textContent   = message;
    $('#modal-generic-confirm').style.display = 'flex';
  });
}
function _resolveConfirm(val) {
  $('#modal-generic-confirm').style.display = 'none';
  if (_pendingConfirmResolve) { _pendingConfirmResolve(val); _pendingConfirmResolve = null; }
}

function openDeleteModal(type, id, msg='Tindakan ini tidak dapat dibatalkan.') {
  APP.deleteTarget = {type,id};
  $('#modal-delete-msg').textContent = msg;
  $('#modal-delete').style.display = 'flex';
}
function confirmDelete() {
  if (!APP.deleteTarget) return;
  const {type, id} = APP.deleteTarget;
  if (type==='tx') {
    const t = APP.transactions.find(x=>x.id===id);
    if (t?.type === 'saving_transfer') {
      if (t.savingTxRef) {
        APP.savingTxs = APP.savingTxs.filter(st => st.id !== t.savingTxRef);
      } else {
        // Legacy transaction from before this link existed — fall back to
        // matching one savingTxs record by bucket/wallet/amount/date/direction.
        // Removes at most one match so it can't over-delete if two identical
        // tabung/tarik happen to share the same day.
        const stType = t.direction === 'withdraw' ? 'withdraw' : 'deposit';
        const idx = APP.savingTxs.findIndex(st => st.bucketId===t.bucketId && st.walletId===t.walletId && st.amount===t.amount && st.date===t.date && st.type===stType);
        if (idx !== -1) APP.savingTxs.splice(idx,1);
      }
    }
    APP.transactions=APP.transactions.filter(t=>t.id!==id); refreshCurrentPage(); showToast('🗑️ Transaksi dihapus','info');
  }
  else if (type==='goal')   { APP.goals=APP.goals.filter(g=>g.id!==id); renderImpian(); renderLainnya(); showToast('🗑️ Impian dihapus','info'); }
  else if (type==='debt')   { APP.debts=APP.debts.filter(d=>d.id!==id); renderHutang(); renderLainnya(); showToast('🗑️ Hutang dihapus','info'); }
  else if (type==='wallet') {
    const remaining = APP.wallets.filter(w=>w.id!==id);
    if (!remaining.length) {
      showToast('⚠️ Tidak bisa menghapus dompet terakhir','error');
    } else {
      // Reassign any transactions/debts still pointing at this wallet to the
      // next remaining wallet, instead of leaving them orphaned (which used
      // to silently exclude their amount from the total net worth).
      const deletedWallet = APP.wallets.find(w=>w.id===id);
      const fallbackId = remaining[0].id;
      let moved = 0;
      APP.transactions.forEach(t => {
        if (t.walletId === id)   { t.walletId = fallbackId; moved++; }
        if (t.toWalletId === id) { t.toWalletId = fallbackId; }
      });
      APP.debts.forEach(d => { if (d.walletId === id) d.walletId = fallbackId; });
      APP.savingTxs.forEach(t => { if (t.walletId === id) t.walletId = fallbackId; });
      // IMPORTANT: the deleted wallet's own "Saldo Awal" (initialBalance) is
      // a property of the wallet object itself — it has no transaction
      // representation, so reassigning transactions alone does NOT preserve
      // it. Fold it into the fallback wallet explicitly so no money is lost.
      const fallbackWallet = remaining.find(w=>w.id===fallbackId);
      if (fallbackWallet && deletedWallet?.initialBalance) {
        fallbackWallet.initialBalance = (fallbackWallet.initialBalance||0) + deletedWallet.initialBalance;
      }
      APP.wallets = remaining;
      renderDompet(); renderDashboard();
      showToast(moved ? `🗑️ Dompet dihapus, ${moved} transaksi & saldo dipindah ke ${remaining[0].name}` : '🗑️ Dompet dihapus','info');
    }
  }
  else if (type==='bucket') {
    // Remove linked wallet transactions using bucketId field (stored on new entries)
    // This returns saldo back to the wallet
    APP.transactions = APP.transactions.filter(t => t.bucketId !== id);
    // Remove saving transactions for this bucket
    APP.savingTxs = APP.savingTxs.filter(t => t.bucketId !== id);
    // Remove the bucket itself
    APP.savingBuckets = APP.savingBuckets.filter(b => b.id !== id);
    renderTabungan(); renderDashboard(); showToast('🗑️ Kantong dihapus, saldo dikembalikan','info');
  }
  persist(); APP.deleteTarget=null; $('#modal-delete').style.display='none';
}
function refreshCurrentPage() {
  const p = APP.currentPage;
  if      (p==='dashboard') renderDashboard();
  else if (p==='riwayat')   renderRiwayat();
  else if (p==='analitik')  renderAnalitik();
  else if (p==='dompet')    renderDompet();
  else if (p==='impian')    renderImpian();
  else if (p==='hutang')    renderHutang();
  // Budget selalu direfresh karena sinkron dengan transaksi
  if (p==='laporan' || p==='budget') renderBudget();
}

// ===================== EXPORT / IMPORT =====================
function exportCSV() {
  if (!APP.transactions.length) { showToast('⚠️ Tidak ada data','error'); return; }
  const rows = APP.transactions.map(t => [
    t.id, t.type, t.amount, `"${(t.desc||'').replace(/"/g,'""')}"`,
    t.date, t.walletId||'', t.catId||'', `"${(t.note||'').replace(/"/g,'""')}"`
  ]);
  const csv = ['ID,Tipe,Nominal,Deskripsi,Tanggal,Dompet,Kategori,Catatan', ...rows.map(r=>r.join(','))].join('\n');
  dlBlob('\uFEFF'+csv, `azar-finance-${todayStr()}.csv`, 'text/csv;charset=utf-8;');
  showToast('📊 CSV diekspor');
}
function exportJSON() {
  const data = {
    app:'Azar Finance', version:APP_VERSION, exported:new Date().toISOString(),
    transactions:APP.transactions, goals:APP.goals, debts:APP.debts, wallets:APP.wallets,
    savingBuckets:APP.savingBuckets, savingTxs:APP.savingTxs,
    budgets:APP.budgets, reminders:APP.reminders, customCats:APP.customCats,
  };
  dlBlob(JSON.stringify(data,null,2), `azar-finance-backup-${todayStr()}.json`, 'application/json');
  showToast('💾 JSON diekspor');
}
function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        APP.transactions=[...data]; APP.goals=[]; APP.debts=[];
        APP.wallets=[{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
        APP.savingBuckets=[]; APP.savingTxs=[]; APP.budgets=[]; APP.reminders=[]; APP.customCats=[];
      } else {
        APP.transactions = data.transactions || [];
        APP.goals        = data.goals        || [];
        APP.debts        = data.debts        || [];
        APP.wallets      = data.wallets?.length ? data.wallets : [{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
        // Backups made before v5.5 won't have these keys — fall back to
        // whatever's already loaded instead of wiping it out with [].
        APP.savingBuckets = data.savingBuckets ?? APP.savingBuckets ?? [];
        APP.savingTxs     = data.savingTxs     ?? APP.savingTxs     ?? [];
        APP.budgets       = data.budgets       ?? APP.budgets       ?? [];
        APP.reminders     = data.reminders     ?? APP.reminders     ?? [];
        APP.customCats    = data.customCats    ?? APP.customCats    ?? [];
      }
      migrateLegacySavingTransfers();
      migrateLegacyDebtTransfers();
      const goalMigration = migrateLegacyGoalsToBuckets();
      await persist();
      APP.selectedWalletId = APP.wallets[0]?.id || 'default';
      renderDashboard(); renderRiwayat(); renderTabungan(); renderBudget();
      showToast(`✅ ${APP.transactions.length} transaksi diimpor`);
      if (goalMigration) {
        const savedNote = goalMigration.totalSaved > 0 ? ` Progress lama (≈${formatRpC(goalMigration.totalSaved)}) tidak ikut pindah — silakan tabung ulang manual kalau perlu.` : '';
        setTimeout(()=>showToast(`⭐ ${goalMigration.count} Impian lama dikonversi jadi Kantong Tabungan.${savedNote}`, 'info', 6000), 2600);
      }
    } catch(err) { showToast('❌ Gagal import: '+err.message,'error',3500); }
  };
  reader.readAsText(file);
}
function dlBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const a   = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

// ===================== NOTIFICATIONS =====================
function scheduleNotif() {
  if (APP.notifTimerId) clearInterval(APP.notifTimerId);
  if (!APP.notifEnabled || !('Notification' in window)) return;
  if (Notification.permission==='default') {
    Notification.requestPermission().then(p => { if(p==='granted') startNotifLoop(); else { APP.notifEnabled=false; saveSettings(); } });
  } else if (Notification.permission==='granted') {
    startNotifLoop();
  }
}
function startNotifLoop() {
  const check = () => {
    const now  = new Date();
    const [h,m] = APP.notifTime.split(':').map(Number);
    // Use >= instead of an exact minute match — background tabs / mobile
    // browsers can throttle setInterval so the precise minute is sometimes
    // skipped entirely. Checking "have we passed the target time today AND
    // not already notified today" means a late check still catches up.
    const targetMinutes = h*60 + m;
    const nowMinutes     = now.getHours()*60 + now.getMinutes();
    if (nowMinutes >= targetMinutes) {
      const k = 'azf_nlast';
      const _nlast = (() => { try { return localStorage.getItem(k); } catch { return ''; } })();
      if (_nlast !== todayStr()) {
        new Notification('Azar Finance 💰',{body:'Jangan lupa catat pengeluaran hari ini!',icon:'icon-192.svg'});
        try { localStorage.setItem(k, todayStr()); } catch {}
      }
    }
  };
  APP.notifTimerId = setInterval(check, 60000);
  check();
}

// ===================== INIT =====================
async function init() {
  await loadAll();
  checkAutoBackup();
  applyDark();
  $('#notif-toggle').checked          = APP.notifEnabled;
  $('#dark-toggle-settings').checked  = APP.darkMode;
  if (APP.notifEnabled) { $('#notif-time-row').style.display=''; $('#notif-time').value=APP.notifTime; }
  if (APP.notifEnabled) scheduleNotif();
  renderDashboard();
  renderBudget();
  renderTabungan();
  if (APP._goalMigrationResult) {
    const { count, totalSaved } = APP._goalMigrationResult;
    const savedNote = totalSaved > 0 ? ` Progress lama (≈${formatRpC(totalSaved)}) tidak ikut pindah karena gak pernah terhubung ke dompet manapun — silakan tabung ulang manual kalau perlu.` : '';
    showToast(`⭐ ${count} Impian lama dikonversi jadi Kantong Tabungan.${savedNote}`, 'info', 6000);
    delete APP._goalMigrationResult;
  }
  $('#fab-btn').style.display = 'none'; // dashboard page has no FAB
  setTimeout(() => {
    $('#app').style.display='flex';
    // PWA shortcut support: "Tambah Pemasukan/Pengeluaran" launches with #add
    if (location.hash === '#add') { openTxSheet(); history.replaceState(null,'',location.pathname); }
  }, 2250);

  // BOTTOM NAV
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page, true)));

  // BACK BUTTON
  $('#back-btn').addEventListener('click', () => navigateTo(APP.prevPage||'lainnya', true));

  // FAB — context-aware
  $('#fab-btn').addEventListener('click', () => {
    const p = APP.currentPage;
    // NOTE: 'impian' page shows the Tabungan bucket system (see renderImpian
    // → renderTabungan). openGoalSheet() was leftover from the older,
    // pre-bucket "Impian" feature and created data that was never displayed
    // anywhere — fixed in v5.4, see migrateLegacyGoalsToBuckets().
    if (p==='impian')    { openBucketSheet(); return; }
    if (p==='hutang')    { openDebtSheet(); return; }
    if (p==='dompet')    { openWalletSheet(); return; }
    openTxSheet();
  });

  // DARK MODE
  $('#dark-toggle').addEventListener('click', () => {
    APP.darkMode = !APP.darkMode; applyDark(); saveSettings();
    showToast(APP.darkMode?'🌙 Dark mode aktif':'☀️ Light mode aktif','info');
  });
  $('#dark-toggle-settings').addEventListener('change', e => { APP.darkMode=e.target.checked; applyDark(); saveSettings(); });

  // NOTIF
  $('#notif-btn').addEventListener('click', () => navigateTo('settings'));
  $('#notif-toggle').addEventListener('change', e => {
    APP.notifEnabled = e.target.checked;
    $('#notif-time-row').style.display = e.target.checked ? '' : 'none';
    if (e.target.checked) { scheduleNotif(); showToast('🔔 Pengingat aktif'); }
    else { if(APP.notifTimerId) clearInterval(APP.notifTimerId); showToast('🔕 Pengingat nonaktif','info'); }
    saveSettings();
  });
  $('#notif-time').addEventListener('change', e => { APP.notifTime=e.target.value; saveSettings(); if(APP.notifEnabled) scheduleNotif(); });

  // TX TYPE BUTTONS
  $('#type-income').addEventListener('click',  () => setTxType('income'));
  $('#type-expense').addEventListener('click', () => setTxType('expense'));

  // PHOTO — camera + gallery
  $('#photo-btn-cam').addEventListener('click',     () => $('#photo-input-cam').click());
  $('#photo-btn-gallery').addEventListener('click', () => $('#photo-input-gallery').click());
  function handlePhotoFile(file) {
    if (!file) return;
    compressPhoto(file, b64 => { APP.txPhoto = b64; updatePhotoPreview(); });
  }
  $('#photo-input-cam').addEventListener('change',     e => { handlePhotoFile(e.target.files[0]); e.target.value=''; });
  $('#photo-input-gallery').addEventListener('change', e => { handlePhotoFile(e.target.files[0]); e.target.value=''; });

  // AUTO FORMAT AMOUNT INPUTS
  ['tx-amount','goal-target','goal-saved','saving-amount','debt-amount','wallet-balance','transfer-amount'].forEach(id => {
    const el = $(`#${id}`); if (!el) return;
    el.addEventListener('input', () => fmtAmtInput(el));
    el.addEventListener('keydown', e => {
      if (!['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End'].includes(e.key) && !/\d/.test(e.key)) e.preventDefault();
    });
  });

  // TX SUBMIT & CANCEL
  $('#tx-submit-btn').addEventListener('click', submitTx);
  $('#tx-cancel-edit').addEventListener('click', () => { APP.editingTxId=null; closeSheet('addtx'); });
  $('#addtx-backdrop').addEventListener('click', () => { closeSheet('addtx'); APP.editingTxId=null; APP.txPhoto=null; });

  // DASHBOARD FILTER
  $$('#dash-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#dash-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.dashFilter=btn.dataset.filter; renderDashboard();
  }));
  $('#see-all-btn').addEventListener('click', () => navigateTo('riwayat'));

  // QUICK ACTIONS on dashboard
  $('#qa-income')?.addEventListener('click',   () => { APP.selectedType='income';  openTxSheet(); });
  $('#qa-expense')?.addEventListener('click',  () => { APP.selectedType='expense'; openTxSheet(); });
  $('#qa-transfer')?.addEventListener('click', () => openTransferSheet());

  // QUICK INSIGHTS on dashboard — tap a card to jump to its full page
  $$('#dash-insights .qi-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.nav, true));
  });

  // ANALITIK FILTER
  $$('#analitik-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#analitik-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.analitikPeriod=btn.dataset.aperiod; renderAnalitik();
  }));

  // HISTORY FILTER + SEARCH
  $$('#hist-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#hist-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.histFilter=btn.dataset.hfilter; renderRiwayat();
  }));
  const srch=$('#search-input'), clr=$('#clear-search');
  srch.addEventListener('input', () => { APP.histSearch=srch.value; clr.style.display=srch.value?'':'none'; renderRiwayat(); });
  clr.addEventListener('click', () => { srch.value=''; APP.histSearch=''; clr.style.display='none'; srch.focus(); renderRiwayat(); });

  // DEBT FILTER
  $$('#debt-pills .pill').forEach(btn => btn.addEventListener('click', () => {
    $$('#debt-pills .pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); APP.debtFilter=btn.dataset.dfilter; renderHutang();
  }));

  // LAPORAN pills (now inside analitik) — reuse analitik pills
  $('#btn-export-pdf')?.addEventListener('click', exportJSON);

  // BUDGET
  $('#btn-add-budget')?.addEventListener('click', ()=>openBudgetSheet());
  $('#budget-submit')?.addEventListener('click', saveBudget);
  $('#budget-cancel')?.addEventListener('click', ()=>closeSheet('budget'));
  $('#budget-backdrop')?.addEventListener('click', ()=>closeSheet('budget'));

  // NEW CATEGORY SHEET
  $('#newcat-submit')?.addEventListener('click', submitNewCategory);
  $('#newcat-cancel')?.addEventListener('click', closeNewCategorySheet);
  $('#newcat-backdrop')?.addEventListener('click', closeNewCategorySheet);

  // REMINDER (kalender)
  $('#cal-add-reminder-btn')?.addEventListener('click', openReminderSheet);
  $('#reminder-submit')?.addEventListener('click', saveReminder);
  $('#reminder-cancel')?.addEventListener('click', ()=>closeSheet('reminder'));
  $('#reminder-backdrop')?.addEventListener('click', ()=>closeSheet('reminder'));

  // Format amount input for budget & reminder
  ['budget-amount','reminder-amount'].forEach(id=>{
    const el=$('#'+id); if(el) el.addEventListener('input',()=>fmtAmtInput(el));
  });

  // KALENDER
  $('#cal-prev')?.addEventListener('click', () => {
    APP.calMonth--; if(APP.calMonth<0){APP.calMonth=11;APP.calYear--;} renderKalender();
  });
  $('#cal-next')?.addEventListener('click', () => {
    APP.calMonth++; if(APP.calMonth>11){APP.calMonth=0;APP.calYear++;} renderKalender();
  });
  $('#cal-add-tx-btn')?.addEventListener('click', () => {
    if(APP.calSelectedDate){ openTxSheet(); $('#tx-date').value=APP.calSelectedDate; }
  });

  // LAINNYA di top nav
  $('#btn-lainnya-top')?.addEventListener('click', ()=>navigateTo('lainnya', true));

  // TABUNGAN
  $('#qa-saving-deposit')?.addEventListener('click', ()=>openSavingTxSheet('deposit'));
  $('#qa-saving-withdraw')?.addEventListener('click', ()=>openSavingTxSheet('withdraw'));
  $('#btn-add-bucket')?.addEventListener('click', ()=>openBucketSheet());
  $('#bucket-submit')?.addEventListener('click', saveBucket);
  $('#bucket-cancel')?.addEventListener('click', ()=>closeSheet('bucket'));
  $('#bucket-backdrop')?.addEventListener('click', ()=>closeSheet('bucket'));
  $('#bucket-target')?.addEventListener('input', ()=>fmtAmtInput($('#bucket-target')));
  $('#saving-tx-submit')?.addEventListener('click', saveSavingTx);
  $('#saving-tx-cancel')?.addEventListener('click', ()=>closeSheet('saving-tx'));
  $('#saving-tx-backdrop')?.addEventListener('click', ()=>closeSheet('saving-tx'));
  $('#saving-tx-amount')?.addEventListener('input', ()=>fmtAmtInput($('#saving-tx-amount')));
  $('#stx-deposit-btn')?.addEventListener('click', ()=>openSavingTxSheet('deposit', APP._savingTxBucketId));
  $('#stx-withdraw-btn')?.addEventListener('click', ()=>openSavingTxSheet('withdraw', APP._savingTxBucketId));

  // HUB LAINNYA
  $('#hub-dompet')?.addEventListener('click',    () => navigateTo('dompet'));
  $('#hub-kalender')?.addEventListener('click',  () => navigateTo('kalender'));
  $('#hub-hutang').addEventListener('click',     () => navigateTo('hutang'));
  $('#hub-settings').addEventListener('click',   () => navigateTo('settings'));

  // WALLET SHEET
  $('#wallet-submit').addEventListener('click',  submitWallet);
  $('#wallet-cancel').addEventListener('click',  () => { closeSheet('wallet'); APP.editingWalletId=null; });
  $('#wallet-backdrop').addEventListener('click',() => { closeSheet('wallet'); APP.editingWalletId=null; });

  // TRANSFER SHEET
  $('#transfer-submit').addEventListener('click',  submitTransfer);
  $('#transfer-cancel').addEventListener('click',  () => closeSheet('transfer'));
  $('#transfer-backdrop').addEventListener('click',() => closeSheet('transfer'));

  // GOAL SHEET
  $('#goal-submit-btn').addEventListener('click', submitGoal);
  $('#goal-cancel').addEventListener('click',     () => { closeSheet('goal'); APP.editingGoalId=null; });
  $('#goal-backdrop').addEventListener('click',   () => { closeSheet('goal'); APP.editingGoalId=null; });

  // SAVING SHEET
  $('#saving-submit').addEventListener('click', submitSaving);
  $('#saving-cancel').addEventListener('click', () => closeSheet('saving'));
  $('#saving-backdrop').addEventListener('click',() => closeSheet('saving'));

  // DEBT TYPE TOGGLE
  $$('#debt-type-toggle .debt-type-btn').forEach(btn =>
    btn.addEventListener('click', () => setDebtType(btn.dataset.dtype))
  );

  // DEBT SHEET
  $('#debt-submit-btn').addEventListener('click', submitDebt);
  $('#debt-cancel').addEventListener('click',     () => { closeSheet('debt'); APP.editingDebtId=null; });
  $('#debt-backdrop').addEventListener('click',   () => { closeSheet('debt'); APP.editingDebtId=null; });

  // PAYMENT SHEET
  $('#pay-submit').addEventListener('click',   submitPayment);
  $('#pay-cancel').addEventListener('click',   () => closeSheet('pay'));
  $('#pay-backdrop').addEventListener('click', () => closeSheet('pay'));
  // Amount format for pay-amount
  const payAmtEl = $('#pay-amount');
  if (payAmtEl) {
    payAmtEl.addEventListener('input', () => fmtAmtInput(payAmtEl));
    payAmtEl.addEventListener('keydown', e => {
      if (!['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End'].includes(e.key) && !/\d/.test(e.key)) e.preventDefault();
    });
  }

  // DELETE MODAL
  $('#modal-cancel').addEventListener('click',  () => { $('#modal-delete').style.display='none'; APP.deleteTarget=null; });
  $('#modal-confirm').addEventListener('click', confirmDelete);
  $('#modal-delete').addEventListener('click',  e => { if(e.target===$('#modal-delete')){ $('#modal-delete').style.display='none'; APP.deleteTarget=null; } });

  // GENERIC CONFIRM MODAL
  $('#modal-generic-yes').addEventListener('click', () => _resolveConfirm(true));
  $('#modal-generic-no').addEventListener('click',  () => _resolveConfirm(false));
  $('#modal-generic-confirm').addEventListener('click', e => { if(e.target===$('#modal-generic-confirm')) _resolveConfirm(false); });

  // RESET MODAL
  $('#btn-reset').addEventListener('click',    () => $('#modal-reset').style.display='flex');
  $('#reset-cancel').addEventListener('click', () => $('#modal-reset').style.display='none');
  $('#reset-confirm').addEventListener('click', async () => {
    APP.transactions=[]; APP.goals=[]; APP.debts=[];
    APP.budgets=[]; APP.reminders=[]; APP.savingBuckets=[]; APP.savingTxs=[];
    APP.wallets=[{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
    await persist();
    renderDashboard(); renderRiwayat(); renderLainnya(); renderBudget(); renderTabungan();
    $('#modal-reset').style.display='none';
    showToast('🗑️ Semua data direset','info');
  });
  $('#modal-reset').addEventListener('click', e => { if(e.target===$('#modal-reset')) $('#modal-reset').style.display='none'; });

  // PHOTO VIEWER MODAL
  $('#modal-photo').addEventListener('click',  () => $('#modal-photo').style.display='none');
  $('#photo-close').addEventListener('click',  () => $('#modal-photo').style.display='none');

  // SETTINGS EXPORT / IMPORT
  $('#btn-export-csv').addEventListener('click',  exportCSV);
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-backup-now').addEventListener('click',  () => doAutoBackup(false));
  $('#btn-import').addEventListener('click',      () => $('#import-file').click());
  $('#import-file').addEventListener('change',    e => { importJSON(e.target.files[0]); e.target.value=''; });

  // REFRESH APP — the app shell has overflow:hidden (no pull-to-refresh),
  // and installed/standalone PWAs have no browser reload button. This clears
  // only the static-asset Cache Storage (HTML/CSS/JS) so the next load
  // fetches fresh files, then hard-reloads. It never touches IndexedDB, so
  // no financial data is affected.
  $('#btn-refresh-app')?.addEventListener('click', async () => {
    showToast('🔄 Memeriksa update...');
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { /* ignore — still reload below even if this fails */ }
    location.reload();
  });

  // GLOBAL DELEGATION — all clickable data-attributes
  document.addEventListener('click', e => {
    // Photo thumbnail → open viewer
    const thumb = e.target.closest('.tx-thumb');
    if (thumb) { $('#photo-viewer-img').src=thumb.dataset.photo; $('#modal-photo').style.display='flex'; return; }

    // TX edit / delete
    const txEdit = e.target.closest('.tx-btn.edit');
    const txDel  = e.target.closest('.tx-btn.del');
    if (txEdit) {
      const t = APP.transactions.find(x=>x.id===txEdit.dataset.id);
      if (t?.type === 'saving_transfer') {
        showToast('Kelola tabung/tarik dari halaman Tabungan ya','info');
        navigateTo('impian');
        return;
      }
      if (t?.type === 'debt_transfer') {
        showToast('Kelola hutang/piutang dari halaman Hutang ya','info');
        navigateTo('hutang');
        return;
      }
      openTxSheet(txEdit.dataset.id); return;
    }
    if (txDel)  {
      const t = APP.transactions.find(x=>x.id===txDel.dataset.id);
      const msg = t?.type==='saving_transfer'
        ? 'Transaksi ini akan dihapus permanen, dan saldo kantong tabungan terkait akan ikut disesuaikan.'
        : 'Transaksi ini akan dihapus permanen.';
      openDeleteModal('tx', txDel.dataset.id, msg);
      return;
    }

    // Goal actions
    const gSave = e.target.closest('[data-goal-save]');
    const gEdit = e.target.closest('[data-goal-edit]');
    const gDel  = e.target.closest('[data-goal-del]');
    if (gSave) { openSavingSheet(gSave.dataset.goalSave); return; }
    if (gEdit) { openGoalSheet(gEdit.dataset.goalEdit);   return; }
    if (gDel)  { openDeleteModal('goal', gDel.dataset.goalDel, 'Impian ini akan dihapus permanen.'); return; }

    // Debt actions
    const dPay     = e.target.closest('[data-debt-pay]');
    const dUnlunas = e.target.closest('[data-debt-unlunas]');
    const dEdit    = e.target.closest('[data-debt-edit]');
    const dDel     = e.target.closest('[data-debt-del]');
    if (dPay)     { openPaymentSheet(dPay.dataset.debtPay);           return; }
    if (dUnlunas) { markDebtUnpaid(dUnlunas.dataset.debtUnlunas);     return; }
    if (dEdit)    { openDebtSheet(dEdit.dataset.debtEdit);            return; }
    if (dDel)     { openDeleteModal('debt', dDel.dataset.debtDel, 'Hutang ini akan dihapus. Transaksi terkait tetap ada.'); return; }

    // Wallet actions
    const wTransfer = e.target.closest('[data-transfer]');
    const wEdit     = e.target.closest('[data-wallet-edit]');
    const wDel      = e.target.closest('[data-wallet-del]');
    if (wTransfer) { openTransferSheet(wTransfer.dataset.transfer);    return; }
    if (wEdit)     { openWalletSheet(wEdit.dataset.walletEdit);        return; }
    if (wDel)      { openDeleteModal('wallet', wDel.dataset.walletDel, 'Dompet ini akan dihapus. Transaksinya akan dipindahkan ke dompet lain, tidak hilang.'); return; }
  });

  // KEYBOARD ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['addtx','goal','saving','debt','wallet','transfer','pay','budget'].forEach(closeSheet);
      if ($('#sheet-newcat')?.classList.contains('open')) closeNewCategorySheet();
      if ($('#modal-generic-confirm').style.display==='flex') _resolveConfirm(false);
      $('#modal-delete').style.display='none';
      $('#modal-reset').style.display='none';
      $('#modal-photo').style.display='none';
      APP.deleteTarget=null;
    }
  });

  // Resize → redraw charts
  window.addEventListener('resize', () => {
    if (APP.currentPage==='analitik') renderAnalitik();
  });
}

document.addEventListener('DOMContentLoaded', init);
