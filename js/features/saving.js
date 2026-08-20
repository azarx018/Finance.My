/* ================================================
   AZAR FINANCE — js/features/saving.js
   Saving-bucket balance calculation, bucket CRUD, and the
   deposit/withdraw sheet. Also carries forward 4 legacy
   "Impian" (goal) functions — see the dead-code note below.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP, BUCKET_EMOJIS } from '../core/state.js';
import { $, $$, escapeHtml, formatRp, formatRpC, parseAmt, genId, todayStr, showToast, fmtAmtInput } from '../core/utils.js';
import { persist } from '../core/db.js';
import { openSheet, closeSheet } from '../ui/sheets.js';
import { refreshPages } from '../ui/nav.js';
import { buildWalletPillRow, getWalletBalance } from './wallet.js';

// ===================== BALANCE HELPERS =====================
export function getSavingTotal() {
  return APP.savingBuckets.reduce((s,b) => {
    const deposited = APP.savingTxs.filter(t=>t.bucketId===b.id&&t.type==='deposit').reduce((a,t)=>a+t.amount,0);
    const withdrawn = APP.savingTxs.filter(t=>t.bucketId===b.id&&t.type==='withdraw').reduce((a,t)=>a+t.amount,0);
    return s + deposited - withdrawn;
  }, 0);
}

export function getBucketBalance(bucketId) {
  const dep = APP.savingTxs.filter(t=>t.bucketId===bucketId&&t.type==='deposit').reduce((s,t)=>s+t.amount,0);
  const wit = APP.savingTxs.filter(t=>t.bucketId===bucketId&&t.type==='withdraw').reduce((s,t)=>s+t.amount,0);
  return dep - wit;
}

// Renders a single saving-bucket card. Active buckets get full actions
// (tabung/tarik/edit/selesai/hapus); completed buckets can still be
// withdrawn from (e.g. to cash the goal out) but can no longer receive new
// deposits, and get a "buka lagi" action instead of "tandai selesai".
export function bucketCardHTML(b) {
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

// ===================== BUCKET SHEET (add/edit) =====================
APP._editBucketId = null;
export function openBucketSheet(editId=null) {
  APP._editBucketId = editId;
  const existing = editId ? APP.savingBuckets.find(b=>b.id===editId) : null;
  const title = $('#bucket-sheet-title'); if(title) title.textContent = editId?'✏️ Edit Kantong':'🪣 Buat Kantong Tabungan';
  const bn = $('#bucket-name'); if(bn) bn.value = existing?.name||'';
  const bt = $('#bucket-target'); if(bt){ bt.value=existing?.target?existing.target.toLocaleString('id'):''; fmtAmtInput(bt); }
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

export function saveBucket() {
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
  persist(); closeSheet('bucket'); refreshPages('impian');
  showToast(APP._editBucketId?'Kantong diupdate ✅':'Kantong dibuat ✅','success');
  APP._editBucketId=null;
}

// ===================== SAVING TX SHEET (deposit/withdraw) =====================
APP._savingTxMode = 'deposit';
APP._savingTxBucketId = null;

export function openSavingTxSheet(mode='deposit', bucketId=null) {
  APP._savingTxMode = mode;
  APP._savingTxBucketId = bucketId;
  APP._savingTxWalletId = APP.selectedWalletId || APP.wallets[0]?.id;
  const title = $('#saving-tx-title');
  if(title) title.textContent = mode==='deposit'?'⬆️ Tabung':'⬇️ Tarik dari Tabungan';
  $('#stx-deposit-btn')?.classList.toggle('active', mode==='deposit');
  $('#stx-withdraw-btn')?.classList.toggle('active', mode==='withdraw');
  const amt = $('#saving-tx-amount'); if(amt) amt.value='';
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
  buildWalletPillRow('saving-wallet-select', APP.selectedWalletId, id => APP._savingTxWalletId = id, {showBalance:true});
  openSheet('saving-tx');
  setTimeout(()=>$('#saving-tx-amount')?.focus(),300);
}

export function saveSavingTx() {
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

  if(mode==='deposit') {
    const walBal = getWalletBalance(walletId);
    if(walBal < amount) return showToast('Saldo dompet tidak cukup','error');
  } else {
    const bucketBal = getBucketBalance(bucketId);
    if(bucketBal < amount) return showToast('Saldo tabungan tidak cukup','error');
  }

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

  persist(); closeSheet('saving-tx'); refreshPages('impian','dashboard');
  showToast(mode==='deposit'?`✅ Berhasil menabung ${formatRpC(amount)}`:`✅ Berhasil menarik ${formatRpC(amount)}`,'success');
}

// ===================== DELETE (see log.md Sprint 4) =====================
export function deleteSavingBucket(id) {
  // Remove linked wallet transactions using bucketId field (stored on new
  // entries) — this returns saldo back to the wallet.
  APP.transactions = APP.transactions.filter(t => t.bucketId !== id);
  APP.savingTxs = APP.savingTxs.filter(t => t.bucketId !== id);
  APP.savingBuckets = APP.savingBuckets.filter(b => b.id !== id);
  persist();
  refreshPages('impian','dashboard');
  showToast('🗑️ Kantong dihapus, saldo dikembalikan','info');
}

// ===================== LEGACY "IMPIAN" GOAL SHEETS =====================
// DEAD-CODE CANDIDATE (see log.md Sprint 4 + Sprint 1 audit): these 4
// functions pre-date the savingBuckets system and were fully superseded by
// it in v5.4 — the FAB on the Impian page now opens openBucketSheet(), not
// openGoalSheet(). script.js itself has a comment confirming this
// (originally right above the FAB handler). The #sheet-goal and
// #sheet-saving DOM blocks in index.html are similarly orphaned — nothing
// reachable from the current UI opens them anymore.
// Kept here, unmodified and unwired, rather than deleted, per the dead-code
// rule (flag → confirm with you → only then remove). If you confirm they're
// safe to drop, removing this whole section plus the two orphaned
// bottom-sheet blocks in index.html is a clean, isolated PATCH-level change.
export function openGoalSheet(editId=null) {
  APP.editingGoalId = editId;
  const g = editId ? APP.goals.find(x=>x.id===editId) : null;
  $('#goal-sheet-title').textContent = editId ? '✏️ Edit Impian' : '✨ Tambah Impian';
  $('#goal-name').value     = g?.name     || '';
  $('#goal-target').value   = g ? g.target.toLocaleString('id-ID') : '';
  $('#goal-saved').value    = g ? (g.saved||0).toLocaleString('id-ID') : '';
  $('#goal-deadline').value = g?.deadline || '';
  openSheet('goal'); setTimeout(()=>$('#goal-name').focus(),300);
}
export function submitGoal() {
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
  refreshPages('impian','lainnya');
}
export function openSavingSheet(goalId) {
  APP.savingGoalId = goalId;
  const g = APP.goals.find(x=>x.id===goalId); if (!g) return;
  $('#saving-goal-name').textContent = `untuk: ${g.name}`;
  $('#saving-amount').value = '';
  openSheet('saving'); setTimeout(()=>$('#saving-amount').focus(),300);
}
export function submitSaving() {
  const amount = parseAmt($('#saving-amount').value);
  if (!amount) { showToast('⚠️ Masukkan jumlah tabungan','error'); return; }
  const idx = APP.goals.findIndex(g=>g.id===APP.savingGoalId); if (idx===-1) return;
  APP.goals[idx].saved = (APP.goals[idx].saved||0) + amount;
  persist(); closeSheet('saving');
  showToast(`💰 +${formatRp(amount)} ditabungkan!`);
  refreshPages('impian');
}
