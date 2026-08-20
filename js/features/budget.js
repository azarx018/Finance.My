/* ================================================
   AZAR FINANCE — js/features/budget.js
   Budget Manager: add/edit budget sheet, category picker
   (built-in + custom), and custom-category create/delete.
   Extracted from script.js v5.6 — Sprint 4 (see log.md)
   ================================================ */
'use strict';

import { APP, getCatList, CAT_EMOJIS } from '../core/state.js';
import { $, $$, escapeHtml, genId, showToast, fmtAmtInput } from '../core/utils.js';
import { persist } from '../core/db.js';
import { openSheet, closeSheet } from '../ui/sheets.js';
import { refreshCurrentPage } from '../ui/nav.js';
import { askConfirm } from '../ui/modals.js';

export function getBudgetMonth() {
  const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}

export function getBudgetMonthLabel() {
  const mNames=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const n=new Date(); return `${mNames[n.getMonth()]} ${n.getFullYear()}`;
}

// ===================== BUDGET SHEET (add/edit) =====================
export function openBudgetSheet(editId=null, preselectCat=null) {
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
export function renderBudgetCatPicker(avail, selectedCatId) {
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
export async function deleteCustomCategory(catId) {
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
export function openNewCategorySheet() {
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
export function closeNewCategorySheet() {
  closeSheet('newcat');
  // Always return to the Budget sheet, preserving whatever add/edit
  // context (APP._editBudgetId) was active before "+ Kategori Baru" was tapped.
  openBudgetSheet(APP._editBudgetId);
}
export function submitNewCategory() {
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

// NOTE: uses refreshCurrentPage() (assumes this sheet is only ever opened
// from the 'laporan'/'budget' page, which is true for every path in this
// app today) rather than the original's unconditional renderBudget() call,
// to avoid double-rendering once both page names register the same
// function in Sprint 5. See log.md Sprint 4.
export function saveBudget() {
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
  persist(); closeSheet('budget'); refreshCurrentPage();
  showToast(APP._editBudgetId?'Budget diupdate ✅':'Budget ditambahkan ✅','success');
  APP._editBudgetId=null;
}
