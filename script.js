/* ================================================
   AZAR FINANCE v3.0 — script.js
   Multi-Wallet · Analitik · Recurring · Notes · Photos
   ================================================ */
'use strict';

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
  {id:'savings',name:'Tabungan',emoji:'🐷'},{id:'other_exp',name:'Lainnya',emoji:'💸'},
];
const WALLET_EMOJIS = ['👛','💼','🏦','💳','📱','💵','🪙','🏧','💎','🏠'];

// ===================== STATE =====================
const APP = {
  transactions:[],goals:[],debts:[],wallets:[],recurringTx:[],
  currentPage:'dashboard', prevPage:null,
  editingTxId:null, editingGoalId:null, editingDebtId:null,
  editingWalletId:null, editingRecId:null, savingGoalId:null,
  selectedType:'income', selectedCatId:'other_inc', selectedWalletId:'default',
  dashFilter:'month', histFilter:'all', histSearch:'', debtFilter:'all', analitikPeriod:'month',
  deleteTarget:null,
  darkMode:true, notifEnabled:false, notifTime:'20:00', notifTimerId:null,
  recType:'expense', recFreq:'monthly', selectedRecWalletId:'default',
  txPhoto:null,
};

const KEYS = {
  tx:'azf3_tx', goals:'azf3_goals', debts:'azf3_debts',
  wallets:'azf3_wallets', rec:'azf3_rec',
  dark:'azf3_dark', notif:'azf3_notif', ntime:'azf3_ntime',
};

// ===================== UTILS =====================
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function formatRp(n) {
  if (!n || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}
function formatRpC(n) {
  const a = Math.abs(n || 0);
  if (a >= 1e9) return 'Rp ' + (a/1e9).toFixed(1) + ' M';
  if (a >= 1e6) return 'Rp ' + (a/1e6).toFixed(1) + ' Jt';
  if (a >= 1e3) return 'Rp ' + (a/1e3).toFixed(0) + ' Rb';
  return 'Rp ' + a.toLocaleString('id-ID');
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
      idbSet(STORE_DATA, KEYS.tx,      APP.transactions),
      idbSet(STORE_DATA, KEYS.goals,   APP.goals),
      idbSet(STORE_DATA, KEYS.debts,   APP.debts),
      idbSet(STORE_DATA, KEYS.wallets, APP.wallets),
      idbSet(STORE_DATA, KEYS.rec,     APP.recurringTx),
    ]);
  } catch(e) { showToast('⚠️ Gagal simpan data!','error'); console.error(e); }
}
// Sync-looking wrapper — callers don't need await, but returns Promise for when needed
function persist() { return _persistAsync(); }

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

async function loadAll() {
  try {
    const [tx, goals, debts, wallets, rec, dark, notif, ntime] = await Promise.all([
      idbGet(STORE_DATA,     KEYS.tx),
      idbGet(STORE_DATA,     KEYS.goals),
      idbGet(STORE_DATA,     KEYS.debts),
      idbGet(STORE_DATA,     KEYS.wallets),
      idbGet(STORE_DATA,     KEYS.rec),
      idbGet(STORE_SETTINGS, KEYS.dark),
      idbGet(STORE_SETTINGS, KEYS.notif),
      idbGet(STORE_SETTINGS, KEYS.ntime),
    ]);
    APP.transactions = tx      || [];
    APP.goals        = goals   || [];
    APP.debts        = debts   || [];
    APP.wallets      = wallets || [];
    APP.recurringTx  = rec     || [];
    APP.darkMode     = dark    !== undefined ? dark  : true;
    APP.notifEnabled = notif   !== undefined ? notif : false;
    APP.notifTime    = ntime   || '20:00';
  } catch(e) {
    console.error('loadAll error:', e);
    APP.transactions = []; APP.goals = []; APP.debts = [];
    APP.wallets = []; APP.recurringTx = [];
  }
  if (!APP.wallets.length) {
    APP.wallets = [{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
    await persist();
  }
  APP.selectedWalletId    = APP.wallets[0]?.id || 'default';
  APP.selectedRecWalletId = APP.wallets[0]?.id || 'default';
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
    app: 'Azar Finance', version: '3.0',
    exported: new Date().toISOString(), autoBackup: true,
    transactions: APP.transactions, goals: APP.goals,
    debts: APP.debts, wallets: APP.wallets, recurringTx: APP.recurringTx,
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
    .filter(t => t.walletId === walletId && t.type !== 'transfer')
    .reduce((s,t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
  const trBal = APP.transactions
    .filter(t => t.type === 'transfer')
    .reduce((s,t) => {
      if (t.toWalletId === walletId) return s + t.amount;
      if (t.walletId   === walletId) return s - t.amount;
      return s;
    }, 0);
  return init + txBal + trBal;
}
function getTotalNetWorth() {
  return APP.wallets.reduce((s,w) => s + getWalletBalance(w.id), 0);
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

function calcTotals(list) {
  let income=0, expense=0;
  list.forEach(t => { if(t.type==='income') income+=t.amount; else if(t.type==='expense') expense+=t.amount; });
  return {income, expense, saldo:income-expense};
}

function getCat(type, id) {
  const arr = type==='income' ? INCOME_CATS : EXPENSE_CATS;
  return arr.find(c => c.id===id) || arr[arr.length-1];
}

// ===================== ANALYTICS =====================
function getMonthlyData(months=6) {
  const result = [];
  for (let i = months-1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const txs = APP.transactions.filter(t => t.date.startsWith(mk) && t.type!=='transfer');
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
    const cat = EXPENSE_CATS.find(c=>c.id===id) || EXPENSE_CATS[EXPENSE_CATS.length-1];
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

// ===================== RECURRING =====================
function checkRecurring() {
  const today = todayStr();
  const due = APP.recurringTx.filter(r => r.active && r.nextRun <= today);
  if (!due.length) return;
  let added = 0;
  due.forEach(r => {
    APP.transactions.push({
      id:genId(), type:r.type, amount:r.amount, desc:r.desc, date:today,
      walletId:r.walletId||APP.wallets[0]?.id||'default',
      catId:r.type==='income'?'other_inc':'other_exp',
      note:'[Otomatis dari berulang]', photo:null,
    });
    r.lastRun = today;
    const nd = new Date(today+'T00:00:00');
    if      (r.freq==='daily')   nd.setDate(nd.getDate()+1);
    else if (r.freq==='weekly')  nd.setDate(nd.getDate()+7);
    else if (r.freq==='monthly') nd.setMonth(nd.getMonth()+1);
    r.nextRun = nd.toISOString().split('T')[0];
    added++;
  });
  if (added) { persist(); showToast(`🔁 ${added} transaksi berulang ditambahkan`); }
}

// ===================== TX ITEM HTML =====================
const IN_ARR = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 17a1 1 0 01-.707-.293l-5-5a1 1 0 011.414-1.414L9 13.586V3a1 1 0 012 0v10.586l3.293-3.293a1 1 0 011.414 1.414l-5 5A1 1 0 0110 17z" clip-rule="evenodd"/></svg>`;
const EX_ARR = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L11 6.414V17a1 1 0 11-2 0V6.414L5.707 9.707a1 1 0 01-1.414-1.414l5-5A1 1 0 0110 3z" clip-rule="evenodd"/></svg>`;

function txItemHTML(tx, delay=0) {
  const isIn = tx.type==='income', isT = tx.type==='transfer';
  const cat  = !isT ? getCat(tx.type, tx.catId) : null;
  const dotContent = isT ? '🔄' : (cat?.emoji || (isIn?IN_ARR:EX_ARR));
  const wallet = APP.wallets.find(w=>w.id===tx.walletId);
  const sign   = isIn ? '+' : isT ? '→' : '−';
  const catMeta    = cat  ? `<span class="tx-cat-badge">${cat.name}</span>` : '';
  const walletMeta = wallet ? ` · ${wallet.emoji}${wallet.name}` : '';
  const noteMeta   = tx.note && tx.note!=='[Otomatis dari berulang]' ? ` · ${tx.note.slice(0,20)}${tx.note.length>20?'…':''}` : '';
  const photoHTML  = tx.photo ? `<img src="${tx.photo}" class="tx-thumb" data-photo="${tx.photo}" alt="struk"/>` : '';
  return `<div class="tx-item ${tx.type}" style="animation-delay:${delay}ms" data-id="${tx.id}">
    <div class="tx-dot">${dotContent}</div>
    <div class="tx-info">
      <div class="tx-desc">${tx.desc||'Tanpa deskripsi'}</div>
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
  const nw   = getTotalNetWorth();

  $('#net-worth-display').textContent = formatRp(nw);
  $('#net-worth-display').style.color = nw>=0 ? 'var(--clr-income)' : 'var(--clr-expense)';
  $('#dash-income').textContent  = formatRpC(income);
  $('#dash-expense').textContent = formatRpC(expense);

  const savings = income - expense;
  $('#qc-savings').textContent   = formatRpC(savings);
  $('#qc-savings').style.color   = savings>=0 ? 'var(--clr-income)' : 'var(--clr-expense)';
  $('#qc-impian-n').textContent  = APP.goals.filter(g=>g.saved<g.target).length;

  // Wallet chips
  const wsr = $('#wallet-scroll-row');
  wsr.innerHTML = APP.wallets.map(w => {
    const bal = getWalletBalance(w.id);
    return `<div class="wallet-chip">
      <span class="wc-emoji">${w.emoji}</span>
      <div class="wc-info">
        <div class="wc-name">${w.name}</div>
        <div class="wc-bal" style="color:${bal>=0?'var(--clr-income)':'var(--clr-expense)'}">${formatRpC(bal)}</div>
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
  const rColor = rate>=15?'var(--clr-income)':rate>=0?'var(--clr-warn)':'var(--clr-expense)';
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
        <div class="top-exp-info"><div class="top-exp-desc">${t.desc}</div><div class="top-exp-date">${formatDateShort(t.date)}</div></div>
        <div class="top-exp-amt">${formatRp(t.amount)}</div>
      </div>`).join('')
    : `<div style="color:var(--txt-muted);font-size:0.8rem;padding:8px 0">Belum ada pengeluaran</div>`;

  // Averages row
  const avgExpD = Math.round(avgExp/30);
  $('#avg-stats').innerHTML = `<div class="avg-stats-row">
    <div class="avg-item"><div class="avg-val green">${formatRpC(avgInc)}</div><div class="avg-label">Pemasukan/bln</div></div>
    <div class="avg-item"><div class="avg-val red">${formatRpC(avgExp)}</div><div class="avg-label">Pengeluaran/bln</div></div>
    <div class="avg-item"><div class="avg-val orange">${formatRpC(avgExpD)}</div><div class="avg-label">Pengeluaran/hari</div></div>
  </div>`;
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
  const total = getTotalNetWorth();
  $('#dompet-total').textContent = formatRp(total);
  $('#dompet-total').style.color = total>=0 ? 'var(--clr-income)' : 'var(--clr-expense)';
  $('#dompet-count-label').textContent = `${APP.wallets.length} dompet`;

  $('#wallet-list').innerHTML = APP.wallets.length
    ? APP.wallets.map((w,i) => {
        const bal      = getWalletBalance(w.id);
        const txCount  = APP.transactions.filter(t=>t.walletId===w.id).length;
        const inc      = APP.transactions.filter(t=>t.walletId===w.id&&t.type==='income').reduce((s,t)=>s+t.amount,0);
        const exp      = APP.transactions.filter(t=>t.walletId===w.id&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const isMain   = i===0;
        return `<div class="wallet-card" style="animation-delay:${i*50}ms">
          <div class="wcard-top">
            <div class="wcard-emoji">${w.emoji}</div>
            <div class="wcard-info">
              <div class="wcard-name">${w.name} ${isMain?'<span class="wcard-default-badge">Utama</span>':''}</div>
              <div class="wcard-count">${txCount} transaksi</div>
            </div>
            <div class="wcard-bal" style="color:${bal>=0?'var(--clr-income)':'var(--clr-expense)'}">${formatRp(bal)}</div>
          </div>
          <div class="wcard-stats">
            <div class="wcs-item"><div class="wcs-val income">+${formatRpC(inc)}</div><div class="wcs-label">Masuk</div></div>
            <div class="wcs-item"><div class="wcs-val expense">−${formatRpC(exp)}</div><div class="wcs-label">Keluar</div></div>
            <div class="wcs-item"><div class="wcs-val" style="color:${bal>=0?'var(--clr-income)':'var(--clr-expense)'}">=${formatRpC(bal)}</div><div class="wcs-label">Saldo</div></div>
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
  $('#hub-impian-sub').textContent    = `${APP.goals.filter(g=>g.saved<g.target).length} aktif`;
  $('#hub-hutang-sub').textContent    = formatRpC(APP.debts.filter(d=>!d.paid).reduce((s,d)=>s+d.amount,0));
  $('#hub-recurring-sub').textContent = `${APP.recurringTx.filter(r=>r.active).length} aktif`;
}

// ===================== RENDER IMPIAN =====================
function renderImpian() {
  $('#is-active').textContent    = APP.goals.filter(g=>g.saved<g.target).length;
  $('#is-reached').textContent   = APP.goals.filter(g=>g.saved>=g.target).length;
  $('#is-total-saved').textContent = formatRpC(APP.goals.reduce((s,g)=>s+(g.saved||0),0));
  const c = $('#goals-list');
  c.innerHTML = APP.goals.length
    ? APP.goals.map((g,i) => goalCardHTML(g,i)).join('')
    : emptyState('⭐','Belum ada impian','Ketuk + untuk menambah impian');
}

function goalCardHTML(g, idx) {
  const adv   = getGoalAdvice(g);
  const pct   = adv.progress;
  const isR   = g.saved >= g.target;
  const isO   = !isR && adv.daysLeft === 0;
  const left  = Math.max(0, g.target - g.saved);
  const perBlock = (!isR && !isO && adv.perMonth) ? `
    <div class="goal-save-stats">
      <div class="gss-item"><div class="gss-val">${formatRpC(adv.perDay)}</div><div class="gss-lbl">/hari</div></div>
      <div class="gss-item"><div class="gss-val">${formatRpC(adv.perMonth)}</div><div class="gss-lbl">/bulan</div></div>
      <div class="gss-item"><div class="gss-val">${adv.daysLeft} hari</div><div class="gss-lbl">tersisa</div></div>
    </div>` : '';
  return `<div class="goal-card ${isR?'reached':isO?'overdue':''}" style="animation-delay:${idx*50}ms">
    <div class="goal-header">
      <div><div class="goal-name">${g.name}</div><div class="goal-meta">Deadline: ${formatDateShort(g.deadline)}</div></div>
      <span class="goal-badge ${isR?'reached':isO?'overdue':'active'}">${isR?'🎉 Tercapai':isO?'⏰ Overdue':'⭐ Aktif'}</span>
    </div>
    <div class="goal-progress-row">
      <div class="goal-progress-label">Progress Tabungan</div>
      <div class="goal-progress-pct" style="color:${isR?'var(--clr-income)':isO?'var(--clr-expense)':'var(--txt-primary)'}">${pct}%</div>
    </div>
    <div class="goal-progress-bar"><div class="goal-progress-fill ${isO?'overdue':''}" style="width:${pct}%"></div></div>
    <div class="goal-amounts">
      <div class="goal-amount-item saved"><div class="goal-amount-val">${formatRpC(g.saved)}</div><div class="goal-amount-lbl">Ditabung</div></div>
      <div class="goal-amount-item"><div class="goal-amount-val">${formatRpC(g.target)}</div><div class="goal-amount-lbl">Target</div></div>
      <div class="goal-amount-item left"><div class="goal-amount-val">${formatRpC(left)}</div><div class="goal-amount-lbl">Kurang</div></div>
    </div>
    <div class="goal-advice ${adv.type}"><div class="goal-advice-title">${adv.title}</div><div>${adv.msg}</div></div>
    ${perBlock}
    <div class="goal-actions">
      <button class="goal-btn save-btn" data-goal-save="${g.id}">💰 Tambah Tabungan</button>
      <button class="goal-btn edit-btn" data-goal-edit="${g.id}">✏️ Edit</button>
      <button class="goal-btn del-btn"  data-goal-del="${g.id}">🗑️</button>
    </div>
  </div>`;
}

function getGoalAdvice(g) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const deadline = new Date(g.deadline+'T00:00:00');
  const daysLeft = Math.max(0, Math.floor((deadline-today)/86400000));
  const mLeft    = Math.max(0.033, daysLeft/30.44);
  const amtLeft  = Math.max(0, g.target - g.saved);
  const progress = g.target>0 ? Math.min(100,Math.round(g.saved/g.target*100)) : 0;
  if (!amtLeft)  return {type:'reached',title:'🎉 Impian Tercapai!',msg:'Selamat! Kamu berhasil!',perMonth:0,perDay:0,progress,daysLeft};
  if (!daysLeft) return {type:'overdue',title:'⏰ Deadline Terlewat',msg:`Masih kurang ${formatRp(amtLeft)}. Perbarui deadline.`,perMonth:0,perDay:0,progress,daysLeft};
  const perDay   = Math.ceil(amtLeft/daysLeft);
  const perMonth = Math.ceil(amtLeft/mLeft);
  const avgInc   = getAvgMonthly('income',3);
  const avgExp   = getAvgMonthly('expense',3);
  const surplus  = avgInc - avgExp;
  let type, title, msg;
  if (!avgInc) {
    type='info'; title='💡 Saran Menabung'; msg=`Sisihkan ${formatRp(perMonth)}/bulan agar tepat waktu.`;
  } else if (surplus<=0) {
    type='warning'; title='⚠️ Keuangan Perlu Diperbaiki'; msg='Pengeluaranmu melebihi pendapatan! Kurangi pengeluaran dulu.';
  } else {
    const pct = Math.round(perMonth/surplus*100);
    if      (pct>100) { type='hard';   title='💪 Target Cukup Berat';     msg=`Butuh ${formatRp(perMonth)}/bln, surplus-mu hanya ${formatRp(surplus)}/bln. Pertimbangkan perpanjang deadline.`; }
    else if (pct>60)  { type='medium'; title='🎯 Butuh Komitmen Tinggi';  msg=`Perlu ${formatRp(perMonth)}/bln (${pct}% dari sisa). Kurangi pengeluaran tidak perlu!`; }
    else if (pct>25)  { type='good';   title='✅ Target Realistis';        msg=`Sisihkan ${formatRp(perMonth)}/bln (${pct}% dari sisa penghasilan). Kamu pasti bisa!`; }
    else              { type='easy';   title='🚀 Sangat Terjangkau!';     msg=`Hanya ${formatRp(perMonth)}/bln (${pct}% dari sisa). Mudah dicapai!`; }
  }
  return {type,title,msg,perMonth,perDay,progress,daysLeft};
}

// ===================== RENDER HUTANG =====================
function renderHutang() {
  const f    = APP.debtFilter;
  let list   = [...APP.debts];
  if (f==='unpaid') list = list.filter(d=>!d.paid);
  if (f==='paid')   list = list.filter(d=>d.paid);
  if (f==='urgent') list = list.filter(d=>!d.paid && (daysUntil(d.dueDate)??999)<=7);
  list.sort((a,b) => a.paid!==b.paid ? (a.paid?1:-1) : (a.dueDate||'').localeCompare(b.dueDate||''));

  const unpaid      = APP.debts.filter(d=>!d.paid);
  const unpaidTotal = unpaid.reduce((s,d)=>s+d.amount,0);
  $('#hutang-total-display').textContent = formatRp(unpaidTotal);
  $('#hc-unpaid').textContent = unpaid.length;
  $('#hc-paid').textContent   = APP.debts.filter(d=>d.paid).length;
  const nearest = unpaid.filter(d=>d.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
  if (nearest) { const d=daysUntil(nearest.dueDate); $('#hc-nearest').textContent=d<=0?'Hari ini!':`${d}h lagi`; }
  else $('#hc-nearest').textContent = '-';

  $('#debt-list').innerHTML = list.length
    ? list.map((d,i) => debtCardHTML(d,i)).join('')
    : emptyState('💳', f==='urgent'?'Tidak ada hutang mendesak':'Tidak ada hutang', 'Bagus! Tetap bijak berhutang.');
}

function debtCardHTML(d, idx) {
  const days     = daysUntil(d.dueDate);
  const isLent   = d.dtype === 'lent';
  const paidAmt  = d.paidAmount || 0;
  const remaining= d.amount - paidAmt;
  const pct      = Math.min(100, Math.round(paidAmt / d.amount * 100));

  let urgClass='', urgBadge='', daysText='', daysColor='';
  if (!d.paid) {
    if      (days!==null && days<=0) { urgClass='urgent';       urgBadge=`<span class="debt-badge urgent-badge">🔴 Jatuh Tempo!</span>`;    daysText='Hari ini!';    daysColor='red'; }
    else if (days!==null && days<=3) { urgClass='urgent';       urgBadge=`<span class="debt-badge urgent-badge">🔴 ${days}h lagi</span>`;    daysText=`${days} hari`; daysColor='red'; }
    else if (days!==null && days<=7) { urgClass='warning-level';urgBadge=`<span class="debt-badge warn-badge">⚠️ ${days}h lagi</span>`;       daysText=`${days} hari`; daysColor='orange'; }
    else if (days!==null)            { daysText=`${days} hari`; }
  }

  // Payment history (last 3)
  const recentPayments = (d.payments||[]).slice(-3).reverse();
  const payHistHTML = recentPayments.length ? `
    <div class="debt-payments-list">
      <div class="dpl-title">${isLent?'Riwayat Penerimaan':'Riwayat Cicilan'}</div>
      ${recentPayments.map(p=>`
        <div class="dpl-item">
          <span class="dpl-date">${formatDateShort(p.date)}${p.note?` · ${p.note}`:''}</span>
          <span class="dpl-amt">${isLent?'+':'-'} ${formatRp(p.amount)}</span>
        </div>`).join('')}
    </div>` : '';

  const typeBadge = `<span class="debt-type-badge ${isLent?'lent':'borrowed'}">${isLent?'🤝 Piutang':'💸 Hutang'}</span>`;
  const statusBadge = d.paid
    ? '<span class="debt-badge paid-badge">✅ Lunas</span>'
    : '<span class="debt-badge unpaid-badge">⏳ Belum Lunas</span>';

  const progressBlock = !d.paid ? `
    <div class="debt-pay-progress">
      <div class="dpp-row">
        <div class="dpp-label">${isLent?'Diterima Kembali':'Sudah Dibayar'}: ${formatRp(paidAmt)} / ${formatRp(d.amount)}</div>
        <div class="dpp-pct" style="color:${pct>=100?'var(--clr-income)':'var(--txt-secondary)'}">${pct}%</div>
      </div>
      <div class="dpp-bar"><div class="dpp-fill" style="width:${pct}%"></div></div>
    </div>` : '';

  // Main action buttons
  const mainAction = d.paid
    ? `<button class="debt-action-btn unlunas-btn" data-debt-unlunas="${d.id}">↩ Tandai Belum Lunas</button>`
    : `<button class="debt-action-btn lunas-btn" data-debt-pay="${d.id}">${isLent?'💰 Catat Penerimaan':'💳 Bayar / Cicil'}</button>`;

  return `<div class="debt-card ${d.paid?'paid':''} ${urgClass}" style="animation-delay:${idx*40}ms">
    <div class="debt-top">
      <div class="debt-left">
        <div class="debt-name">${d.name}</div>
        ${d.note?`<div class="debt-note">${d.note}</div>`:''}
        ${d.paid&&d.paidDate?`<div class="debt-note">Lunas: ${formatDateShort(d.paidDate)}</div>`:''}
      </div>
      <div class="debt-badges">
        ${typeBadge} ${statusBadge} ${urgBadge}
      </div>
    </div>
    <div class="debt-info-row">
      <div class="debt-info-item"><div class="dii-label">Total</div><div class="dii-val red">${formatRp(d.amount)}</div></div>
      <div class="debt-info-item"><div class="dii-label">Sisa</div><div class="dii-val ${remaining>0?'red':'green'}">${formatRp(remaining)}</div></div>
      <div class="debt-info-item"><div class="dii-label">Jatuh Tempo</div><div class="dii-val">${formatDateShort(d.dueDate)}</div></div>
      ${!d.paid&&daysText?`<div class="debt-info-item"><div class="dii-label">Waktu</div><div class="dii-val ${daysColor}">${daysText}</div></div>`:''}
    </div>
    ${progressBlock}
    ${payHistHTML}
    <div class="debt-actions">
      ${mainAction}
      <button class="debt-action-btn edit-btn" data-debt-edit="${d.id}">✏️</button>
      <button class="debt-action-btn del-btn"  data-debt-del="${d.id}">🗑️</button>
    </div>
  </div>`;
}

// ===================== RENDER RECURRING =====================
function renderRecurring() {
  const active = APP.recurringTx.filter(r=>r.active);
  const toMonthly = r => r.freq==='daily'?r.amount*30 : r.freq==='weekly'?r.amount*4.3 : r.amount;
  const monthExp  = active.filter(r=>r.type==='expense').reduce((s,r)=>s+toMonthly(r),0);
  const monthInc  = active.filter(r=>r.type==='income').reduce((s,r)=>s+toMonthly(r),0);
  $('#rec-active-count').textContent  = active.length;
  $('#rec-monthly-expense').textContent = formatRpC(monthExp);
  $('#rec-monthly-income').textContent  = formatRpC(monthInc);

  const freqLabel = {daily:'Harian',weekly:'Mingguan',monthly:'Bulanan'};
  const sorted    = [...APP.recurringTx].sort((a,b) => Number(b.active)-Number(a.active));
  $('#recurring-list').innerHTML = sorted.length
    ? sorted.map((r,i) => {
        const isIn = r.type==='income';
        return `<div class="rec-card ${r.active?'':'inactive'}" style="animation-delay:${i*40}ms">
          <div class="rec-top">
            <div class="rec-dot ${r.type}">${isIn?'💰':'💸'}</div>
            <div class="rec-info">
              <div class="rec-desc">${r.desc}</div>
              <div class="rec-meta">${freqLabel[r.freq]||r.freq} · mulai ${formatDateShort(r.startDate)}</div>
            </div>
            <div class="rec-amount ${r.type}">${isIn?'+':'−'} ${formatRp(r.amount)}</div>
          </div>
          <div class="rec-bottom">
            <div class="rec-next">Berikutnya: ${formatDateShort(r.nextRun)}</div>
            <div class="rec-actions">
              <label class="rec-toggle">
                <input type="checkbox" ${r.active?'checked':''} data-rec-toggle="${r.id}"/>
                <span class="rec-slider"></span>
              </label>
              <button class="rec-edit-btn" data-rec-edit="${r.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="rec-del-btn"  data-rec-del="${r.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
            </div>
          </div>
        </div>`;
      }).join('')
    : emptyState('🔁','Belum ada transaksi berulang','Ketuk + untuk menambah');
}

// ===================== NAVIGATION =====================
const SUB_PAGES = ['impian','hutang','recurring','settings'];

function navigateTo(page, fromNav=false) {
  if (APP.currentPage === page) return;
  $(`#page-${APP.currentPage}`)?.classList.remove('active');
  APP.prevPage = fromNav ? null : APP.currentPage;
  APP.currentPage = page;
  $(`#page-${page}`)?.classList.add('active');

  const isSubPage = SUB_PAGES.includes(page);
  $$('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page===page || (isSubPage && n.dataset.page==='lainnya'));
  });

  const titles = {dashboard:'Dashboard',analitik:'Analitik',riwayat:'Riwayat',dompet:'Dompet',lainnya:'Lainnya',impian:'Impian',hutang:'Hutang',recurring:'Transaksi Berulang',settings:'Pengaturan'};
  $('#page-title').textContent = titles[page] || '';

  const showBack = isSubPage;
  $('#back-btn').style.display    = showBack ? '' : 'none';
  $('#header-logo').style.display = showBack ? 'none' : '';

  const fab = $('#fab-btn');
  fab.className = 'fab';
  if      (page==='settings' || page==='lainnya') fab.style.display = 'none';
  else if (page==='dompet')  { fab.style.display=''; fab.classList.add('wallet-fab'); }
  else if (page==='hutang')  { fab.style.display=''; fab.classList.add('expense-fab'); }
  else    { fab.style.display=''; }

  if      (page==='dashboard') renderDashboard();
  else if (page==='analitik')  renderAnalitik();
  else if (page==='riwayat')   renderRiwayat();
  else if (page==='dompet')    renderDompet();
  else if (page==='lainnya')   renderLainnya();
  else if (page==='impian')    renderImpian();
  else if (page==='hutang')    renderHutang();
  else if (page==='recurring') renderRecurring();
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
  const type = tx?.type || 'income';
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
  buildWalletSelectRow('wallet-select-row', APP.selectedWalletId);
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
  const cats = type==='income' ? INCOME_CATS : EXPENSE_CATS;
  $('#cat-scroll').innerHTML = cats.map(c =>
    `<div class="cat-pill${c.id===APP.selectedCatId?' selected'+(type==='expense'?' expense-cat':''):''}" data-cat="${c.id}">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-label">${c.name}</div>
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

function buildWalletSelectRow(containerId, selectedId) {
  const c = $(`#${containerId}`); if (!c) return;
  c.innerHTML = APP.wallets.map(w =>
    `<div class="wallet-pill${w.id===selectedId?' selected':''}" data-wid="${w.id}">
      <span class="wallet-pill-emoji">${w.emoji}</span>
      <span class="wallet-pill-name">${w.name}</span>
    </div>`).join('');
  c.querySelectorAll('.wallet-pill').forEach(p => {
    p.addEventListener('click', () => {
      if (containerId==='wallet-select-row') APP.selectedWalletId    = p.dataset.wid;
      else                                   APP.selectedRecWalletId = p.dataset.wid;
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
  const opts = () => APP.wallets.map(w=>`<option value="${w.id}">${w.emoji} ${w.name} (${formatRpC(getWalletBalance(w.id))})</option>`).join('');
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

// ===================== RECURRING SHEET =====================
function setRecType(type) {
  APP.recType = type;
  $('#rec-type-income').classList.toggle('active', type==='income');
  $('#rec-type-expense').classList.toggle('active', type==='expense');
  $('#rec-submit').classList.toggle('expense-mode', type==='expense');
}
function openRecSheet(editId=null) {
  APP.editingRecId = editId;
  const r = editId ? APP.recurringTx.find(x=>x.id===editId) : null;
  $('#rec-sheet-title').textContent = editId ? '✏️ Edit Berulang' : '🔁 Tambah Berulang';
  setRecType(r?.type||'expense');
  $('#rec-amount').value = r ? r.amount.toLocaleString('id-ID') : '';
  $('#rec-desc').value   = r?.desc || '';
  $('#rec-start').value  = r?.startDate || todayStr();
  APP.recFreq = r?.freq || 'monthly';
  $$('#freq-pills .pill').forEach(p => p.classList.toggle('active', p.dataset.freq===APP.recFreq));
  APP.selectedRecWalletId = r?.walletId || APP.wallets[0]?.id || 'default';
  buildWalletSelectRow('rec-wallet-row', APP.selectedRecWalletId);
  openSheet('rec'); setTimeout(()=>$('#rec-amount').focus(),300);
}
function submitRec() {
  const amount    = parseAmt($('#rec-amount').value);
  const desc      = $('#rec-desc').value.trim();
  const startDate = $('#rec-start').value;
  if (!amount)    { showToast('⚠️ Nominal tidak boleh kosong','error'); return; }
  if (!desc)      { showToast('⚠️ Deskripsi tidak boleh kosong','error'); return; }
  if (!startDate) { showToast('⚠️ Tanggal mulai tidak boleh kosong','error'); return; }
  let nextRun = startDate;
  const today = new Date(); today.setHours(0,0,0,0);
  while (new Date(nextRun+'T00:00:00') < today) {
    const nd = new Date(nextRun+'T00:00:00');
    if      (APP.recFreq==='daily')   nd.setDate(nd.getDate()+1);
    else if (APP.recFreq==='weekly')  nd.setDate(nd.getDate()+7);
    else if (APP.recFreq==='monthly') nd.setMonth(nd.getMonth()+1);
    nextRun = nd.toISOString().split('T')[0];
  }
  if (APP.editingRecId) {
    const idx = APP.recurringTx.findIndex(x=>x.id===APP.editingRecId);
    if (idx!==-1) APP.recurringTx[idx] = {...APP.recurringTx[idx],type:APP.recType,amount,desc,freq:APP.recFreq,startDate,nextRun,walletId:APP.selectedRecWalletId};
    showToast('✅ Berulang diperbarui');
  } else {
    APP.recurringTx.push({id:genId(),type:APP.recType,amount,desc,freq:APP.recFreq,startDate,nextRun,walletId:APP.selectedRecWalletId,active:true,lastRun:null});
    showToast('🔁 Transaksi berulang ditambahkan');
  }
  persist(); closeSheet('rec'); APP.editingRecId=null;
  renderRecurring(); renderLainnya();
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
let APP_debtType = 'borrowed'; // 'borrowed' | 'lent'
let APP_debtWalletId = '';

function setDebtType(dtype) {
  APP_debtType = dtype;
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
  APP_debtWalletId = d?.walletId || APP.wallets[0]?.id || 'default';
  buildDebtWalletRow(APP_debtWalletId);
  openSheet('debt');
  setTimeout(() => $('#debt-name').focus(), 300);
}

function buildDebtWalletRow(selectedId) {
  const c = $('#debt-wallet-row'); if (!c) return;
  c.innerHTML = APP.wallets.map(w =>
    `<div class="wallet-pill${w.id===selectedId?' selected':''}" data-dwid="${w.id}">
      <span class="wallet-pill-emoji">${w.emoji}</span>
      <span class="wallet-pill-name">${w.name}</span>
    </div>`).join('');
  c.querySelectorAll('.wallet-pill').forEach(p => {
    p.addEventListener('click', () => {
      APP_debtWalletId = p.dataset.dwid;
      c.querySelectorAll('.wallet-pill').forEach(x=>x.classList.remove('selected'));
      p.classList.add('selected');
    });
  });
}

function submitDebt() {
  const name    = $('#debt-name').value.trim();
  const amount  = parseAmt($('#debt-amount').value);
  const dueDate = $('#debt-due').value;
  const note    = $('#debt-note').value.trim();
  const dtype   = APP_debtType;
  const walletId= APP_debtWalletId || APP.wallets[0]?.id || 'default';
  if (!name)    { showToast('⚠️ Nama tidak boleh kosong','error'); return; }
  if (!amount)  { showToast('⚠️ Jumlah tidak boleh kosong','error'); return; }
  if (!dueDate) { showToast('⚠️ Jatuh tempo tidak boleh kosong','error'); return; }

  if (APP.editingDebtId) {
    // Edit — don't re-create transaction, just update metadata
    const idx = APP.debts.findIndex(d=>d.id===APP.editingDebtId);
    if (idx!==-1) APP.debts[idx] = {...APP.debts[idx], name, amount, dueDate, note, dtype, walletId};
    showToast('✅ Hutang diperbarui');
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

    // Auto-create transaction to reflect on saldo
    const txDesc = dtype==='borrowed' ? `Hutang dari ${name}` : `Pinjaman ke ${name}`;
    const txType = dtype==='borrowed' ? 'income' : 'expense'; // borrowed = saldo naik, lent = saldo turun
    APP.transactions.push({
      id:genId(), type:txType, amount,
      desc:txDesc, date:todayStr(),
      walletId, catId: txType==='income'?'other_inc':'other_exp',
      note:`[Otomatis] ${note}`, photo:null,
      debtRef: debt.id, // link back
    });

    showToast(dtype==='borrowed' ? '💸 Hutang dicatat — Saldo +' : '🤝 Pinjaman dicatat — Saldo −');
  }

  persist(); closeSheet('debt'); APP.editingDebtId=null;
  renderHutang(); renderLainnya(); renderDashboard();
}

// ===================== PAYMENT SHEET =====================
let APP_payDebtId = '';
let APP_payWalletId = '';

function openPaymentSheet(debtId) {
  const d = APP.debts.find(x=>x.id===debtId); if (!d) return;
  APP_payDebtId  = debtId;
  APP_payWalletId = d.walletId || APP.wallets[0]?.id || 'default';

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

  buildPayWalletRow(APP_payWalletId);
  openSheet('pay');
  setTimeout(() => $('#pay-amount').focus(), 300);
}

function buildPayWalletRow(selectedId) {
  const c = $('#pay-wallet-row'); if (!c) return;
  c.innerHTML = APP.wallets.map(w =>
    `<div class="wallet-pill${w.id===selectedId?' selected':''}" data-pwid="${w.id}">
      <span class="wallet-pill-emoji">${w.emoji}</span>
      <span class="wallet-pill-name">${w.name}</span>
    </div>`).join('');
  c.querySelectorAll('.wallet-pill').forEach(p => {
    p.addEventListener('click', () => {
      APP_payWalletId = p.dataset.pwid;
      c.querySelectorAll('.wallet-pill').forEach(x=>x.classList.remove('selected'));
      p.classList.add('selected');
    });
  });
}

function submitPayment() {
  const amount   = parseAmt($('#pay-amount').value);
  const date     = $('#pay-date').value;
  const note     = $('#pay-note').value.trim();
  const walletId = APP_payWalletId || APP.wallets[0]?.id || 'default';
  if (!amount)   { showToast('⚠️ Masukkan jumlah pembayaran','error'); return; }
  if (!date)     { showToast('⚠️ Tanggal tidak boleh kosong','error'); return; }

  const idx = APP.debts.findIndex(d=>d.id===APP_payDebtId);
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

  // Create transaction to update saldo
  // borrowed paying back  = expense (saldo turun)
  // lent receiving back   = income  (saldo naik)
  const txType = isLent ? 'income' : 'expense';
  const txDesc = isLent ? `Terima kembali dari ${d.name}` : `Bayar hutang ke ${d.name}`;
  APP.transactions.push({
    id:genId(), type:txType, amount,
    desc:txDesc, date,
    walletId, catId: txType==='income'?'other_inc':'other_exp',
    note: note ? `[Cicilan] ${note}` : '[Cicilan hutang]',
    photo:null,
    debtRef: d.id,
  });

  persist(); closeSheet('pay');
  renderHutang(); renderLainnya(); renderDashboard();
}

// ===================== DELETE =====================
function openDeleteModal(type, id, msg='Tindakan ini tidak dapat dibatalkan.') {
  APP.deleteTarget = {type,id};
  $('#modal-delete-msg').textContent = msg;
  $('#modal-delete').style.display = 'flex';
}
function confirmDelete() {
  if (!APP.deleteTarget) return;
  const {type, id} = APP.deleteTarget;
  if      (type==='tx')     { APP.transactions=APP.transactions.filter(t=>t.id!==id); refreshCurrentPage(); showToast('🗑️ Transaksi dihapus','info'); }
  else if (type==='goal')   { APP.goals=APP.goals.filter(g=>g.id!==id); renderImpian(); renderLainnya(); showToast('🗑️ Impian dihapus','info'); }
  else if (type==='debt')   { APP.debts=APP.debts.filter(d=>d.id!==id); renderHutang(); renderLainnya(); showToast('🗑️ Hutang dihapus','info'); }
  else if (type==='wallet') { APP.wallets=APP.wallets.filter(w=>w.id!==id); renderDompet(); renderDashboard(); showToast('🗑️ Dompet dihapus','info'); }
  else if (type==='rec')    { APP.recurringTx=APP.recurringTx.filter(r=>r.id!==id); renderRecurring(); showToast('🗑️ Dihapus','info'); }
  persist(); APP.deleteTarget=null; $('#modal-delete').style.display='none';
}
function refreshCurrentPage() {
  const p = APP.currentPage;
  if      (p==='dashboard') renderDashboard();
  else if (p==='riwayat')   renderRiwayat();
  else if (p==='analitik')  renderAnalitik();
  else if (p==='dompet')    renderDompet();
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
  const data = {app:'Azar Finance',version:'3.0',exported:new Date().toISOString(),transactions:APP.transactions,goals:APP.goals,debts:APP.debts,wallets:APP.wallets,recurringTx:APP.recurringTx};
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
        APP.recurringTx=[];
      } else {
        APP.transactions = data.transactions || [];
        APP.goals        = data.goals        || [];
        APP.debts        = data.debts        || [];
        APP.wallets      = data.wallets?.length ? data.wallets : [{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
        APP.recurringTx  = data.recurringTx  || [];
      }
      await persist();
      APP.selectedWalletId    = APP.wallets[0]?.id || 'default';
      APP.selectedRecWalletId = APP.wallets[0]?.id || 'default';
      renderDashboard(); renderRiwayat();
      showToast(`✅ ${APP.transactions.length} transaksi diimpor`);
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
    if (now.getHours()===h && now.getMinutes()===m) {
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
  checkRecurring();
  renderDashboard();
  setTimeout(() => { $('#app').style.display='flex'; }, 2250);

  // BOTTOM NAV
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page, true)));

  // BACK BUTTON
  $('#back-btn').addEventListener('click', () => navigateTo(APP.prevPage||'lainnya', true));

  // FAB — context-aware
  $('#fab-btn').addEventListener('click', () => {
    const p = APP.currentPage;
    if (p==='impian')    { openGoalSheet(); return; }
    if (p==='hutang')    { openDebtSheet(); return; }
    if (p==='recurring') { openRecSheet();  return; }
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
  ['tx-amount','goal-target','goal-saved','saving-amount','debt-amount','wallet-balance','transfer-amount','rec-amount'].forEach(id => {
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
  $('#see-all-btn').addEventListener('click',    () => navigateTo('riwayat'));
  $('#qc-analitik').addEventListener('click',    () => navigateTo('analitik'));
  $('#qc-impian-dash').addEventListener('click', () => navigateTo('impian'));

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

  // LAINNYA HUB
  $('#hub-impian').addEventListener('click',    () => navigateTo('impian'));
  $('#hub-hutang').addEventListener('click',    () => navigateTo('hutang'));
  $('#hub-recurring').addEventListener('click', () => navigateTo('recurring'));
  $('#hub-settings').addEventListener('click',  () => navigateTo('settings'));

  // WALLET SHEET
  $('#wallet-submit').addEventListener('click',  submitWallet);
  $('#wallet-cancel').addEventListener('click',  () => { closeSheet('wallet'); APP.editingWalletId=null; });
  $('#wallet-backdrop').addEventListener('click',() => { closeSheet('wallet'); APP.editingWalletId=null; });

  // TRANSFER SHEET
  $('#transfer-submit').addEventListener('click',  submitTransfer);
  $('#transfer-cancel').addEventListener('click',  () => closeSheet('transfer'));
  $('#transfer-backdrop').addEventListener('click',() => closeSheet('transfer'));

  // RECURRING TYPE + FREQ + SHEET
  $('#rec-type-income').addEventListener('click',  () => setRecType('income'));
  $('#rec-type-expense').addEventListener('click', () => setRecType('expense'));
  $$('#freq-pills .pill').forEach(p => p.addEventListener('click', () => {
    APP.recFreq=p.dataset.freq; $$('#freq-pills .pill').forEach(x=>x.classList.remove('active')); p.classList.add('active');
  }));
  $('#rec-submit').addEventListener('click',  submitRec);
  $('#rec-cancel').addEventListener('click',  () => { closeSheet('rec'); APP.editingRecId=null; });
  $('#rec-backdrop').addEventListener('click',() => { closeSheet('rec'); APP.editingRecId=null; });

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

  // RESET MODAL
  $('#btn-reset').addEventListener('click',    () => $('#modal-reset').style.display='flex');
  $('#reset-cancel').addEventListener('click', () => $('#modal-reset').style.display='none');
  $('#reset-confirm').addEventListener('click',() => {
    APP.transactions=[]; APP.goals=[]; APP.debts=[]; APP.recurringTx=[];
    APP.wallets=[{id:'default',name:'Dompet Tunai',emoji:'👛',initialBalance:0,createdAt:todayStr()}];
    persist();
    renderDashboard(); renderRiwayat(); renderLainnya();
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

  // GLOBAL DELEGATION — all clickable data-attributes
  document.addEventListener('click', e => {
    // Photo thumbnail → open viewer
    const thumb = e.target.closest('.tx-thumb');
    if (thumb) { $('#photo-viewer-img').src=thumb.dataset.photo; $('#modal-photo').style.display='flex'; return; }

    // TX edit / delete
    const txEdit = e.target.closest('.tx-btn.edit');
    const txDel  = e.target.closest('.tx-btn.del');
    if (txEdit) { openTxSheet(txEdit.dataset.id); return; }
    if (txDel)  { openDeleteModal('tx', txDel.dataset.id, 'Transaksi ini akan dihapus permanen.'); return; }

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
    if (wDel)      { openDeleteModal('wallet', wDel.dataset.walletDel, 'Dompet ini akan dihapus. Transaksinya tetap ada.'); return; }

    // Recurring actions
    const rEdit = e.target.closest('[data-rec-edit]');
    const rDel  = e.target.closest('[data-rec-del]');
    if (rEdit) { openRecSheet(rEdit.dataset.recEdit); return; }
    if (rDel)  { openDeleteModal('rec', rDel.dataset.recDel, 'Transaksi berulang ini akan dihapus.'); return; }
  });

  // Recurring toggle (change event)
  document.addEventListener('change', e => {
    const tog = e.target.closest('[data-rec-toggle]');
    if (tog) {
      const idx = APP.recurringTx.findIndex(r=>r.id===tog.dataset.recToggle);
      if (idx!==-1) { APP.recurringTx[idx].active = e.target.checked; persist(); renderRecurring(); }
    }
  });

  // KEYBOARD ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['addtx','goal','saving','debt','wallet','transfer','rec','pay'].forEach(closeSheet);
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
