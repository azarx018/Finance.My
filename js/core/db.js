/* ================================================
   AZAR FINANCE — js/core/db.js
   IndexedDB access layer: low-level open/get/put helpers,
   and the app-level persist()/saveSettings() functions that
   write the full APP state.
   Extracted from script.js v5.6 — Sprint 2 (see log.md)
   ================================================ */
'use strict';

import { APP, KEYS } from './state.js';
import { showToast } from './utils.js';

// ===================== STORAGE (IndexedDB) =====================
const DB_NAME    = 'AzarFinanceDB';
const DB_VERSION = 1;
export const STORE_DATA     = 'appdata';   // key-value store for all app data
export const STORE_SETTINGS = 'settings';  // key-value store for settings
let   _db = null;

export function openDB() {
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

export function idbSet(storeName, key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  }));
}

export function idbGet(storeName, key) {
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
export function persist() {
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
export function saveSettings() { return _saveSettingsAsync(); }
