/* ================================================
   AZAR FINANCE — js/features/reminder.js
   Calendar-page bill/payment reminders, and the daily
   browser-notification scheduler ("don't forget to log
   today's spending").
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP } from '../core/state.js';
import { $, formatDate, genId, todayStr, showToast } from '../core/utils.js';
import { persist, saveSettings } from '../core/db.js';
import { openSheet, closeSheet } from '../ui/sheets.js';
import { refreshPages } from '../ui/nav.js';

// ===================== REMINDER SHEET =====================
export function openReminderSheet() {
  if(!APP.calSelectedDate) return showToast('Pilih tanggal dulu','error');
  const dl=$('#reminder-date-label');
  if(dl) dl.textContent='Tanggal: '+formatDate(APP.calSelectedDate);
  const rt=$('#reminder-title'); if(rt) rt.value='';
  const ra=$('#reminder-amount'); if(ra) ra.value='';
  openSheet('reminder');
}

export function saveReminder() {
  const title=$('#reminder-title')?.value?.trim();
  if(!title) return showToast('Isi judul pengingat','error');
  const raw=$('#reminder-amount')?.value?.replace(/\D/g,'')||'0';
  const cat=$('#reminder-cat')?.value||'bills';
  APP.reminders.push({ id:genId(), date:APP.calSelectedDate, title, amount:parseInt(raw)||0, cat });
  persist(); closeSheet('reminder'); refreshPages('kalender');
  showToast('🔔 Pengingat ditambahkan','success');
}

// ===================== DAILY NOTIFICATION =====================
export function scheduleNotif() {
  if (APP.notifTimerId) clearInterval(APP.notifTimerId);
  if (!APP.notifEnabled || !('Notification' in window)) return;
  if (Notification.permission==='default') {
    Notification.requestPermission().then(p => { if(p==='granted') startNotifLoop(); else { APP.notifEnabled=false; saveSettings(); } });
  } else if (Notification.permission==='granted') {
    startNotifLoop();
  }
}
export function startNotifLoop() {
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
        new Notification('My Finance 💰',{body:'Jangan lupa catat pengeluaran hari ini!',icon:'icon-192.svg'});
        try { localStorage.setItem(k, todayStr()); } catch {}
      }
    }
  };
  APP.notifTimerId = setInterval(check, 60000);
  check();
}
