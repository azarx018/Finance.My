/* ================================================
   AZAR FINANCE — js/charts.js
   Canvas chart-rendering primitives used by the Analitik
   page (bar chart: income vs expense per period; donut
   chart: category breakdown). Pure rendering — takes
   already-computed data in, draws to a <canvas>, has no
   knowledge of transactions/wallets/etc.
   Extracted from script.js v5.6 — Sprint 3 (see log.md)
   ================================================ */
'use strict';

import { formatRpC } from './core/utils.js';

export const Charts = {
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
