'use strict';
// ====== EXPORT DROPDOWN ======
function toggleExportDropdown() { document.getElementById('export-dropdown').classList.toggle('open'); }
function closeExportDropdown() { document.getElementById('export-dropdown').classList.remove('open'); }
function setExportMode(mode) {
  exportMerge = mode==='merge';
  document.getElementById('exp-merge-btn').classList.toggle('active', exportMerge);
  document.getElementById('exp-split-btn').classList.toggle('active', !exportMerge);
}

// ====== EXPORT ======
function compositeAll() {
  const refImg=gameImg||psImg;
  if(!refImg) return null;
  // Get viewport dimensions and layers position
  const vr=viewport.getBoundingClientRect();
  const lr=layers.getBoundingClientRect();
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  // Compute bounding box including layers and all labels
  let minX=lr.left-vr.left, minY=lr.top-vr.top;
  let maxX=minX+lr.width, maxY=minY+lr.height;
  canvasLabels.forEach(lb=>{
    const el=document.getElementById('cl-'+lb.id);
    if(el){
      minX=Math.min(minX,lb.x-4); minY=Math.min(minY,lb.y-4);
      maxX=Math.max(maxX,lb.x+el.offsetWidth+4); maxY=Math.max(maxY,lb.y+el.offsetHeight+4);
    }
    if(lb.sx!=null){ minX=Math.min(minX,Math.min(lb.sx,lb.tx)); minY=Math.min(minY,Math.min(lb.sy,lb.ty)); maxX=Math.max(maxX,Math.max(lb.sx,lb.tx)); maxY=Math.max(maxY,Math.max(lb.sy,lb.ty)); }
    minX=Math.min(minX,lb.tx); minY=Math.min(minY,lb.ty); maxX=Math.max(maxX,lb.tx); maxY=Math.max(maxY,lb.ty);
  });
  // Clamp to viewport and add padding
  minX=Math.max(0,minX-10); minY=Math.max(0,minY-10);
  maxX=Math.min(vw,maxX+10); maxY=Math.min(vh,maxY+10);
  const outW=Math.round(maxX-minX), outH=Math.round(maxY-minY);
  if(outW<1||outH<1) return null;
  const out=document.createElement('canvas'); out.width=outW*2; out.height=outH*2;
  const ctx=out.getContext('2d');
  ctx.scale(2,2);
  // Background
  ctx.fillStyle='#1a1a2a'; ctx.fillRect(0,0,outW,outH);
  // Draw game/ps images at layers position
  const lx=lr.left-vr.left-minX, ly=lr.top-vr.top-minY;
  const lw2=lr.width, lh2=lr.height;
  if(gameImg) ctx.drawImage(gameImg,lx,ly,lw2,lh2);
  if(psImg){ctx.globalAlpha=+document.getElementById('slider-ps').value;ctx.drawImage(psImg,lx,ly,lw2,lh2);ctx.globalAlpha=1;}
  // Draw mark canvas (diff overlays) at layers position
  ctx.drawImage(markCanvas,lx,ly,lw2,lh2);
  // Draw anno canvas (annotations) offset by minX/minY
  ctx.drawImage(annoCanvas,-minX,-minY,vw,vh);
  // Draw canvas labels
  canvasLabels.forEach(lb=>{
    const lc=lb.lineColor||'#ffffff88';
    const sh=lb.shape||'none';
    const lwVal=lb.lw||2;
    ctx.save();
    ctx.strokeStyle=lc; ctx.lineWidth=lwVal; ctx.setLineDash([]);
    const ox=-minX, oy=-minY;
    if(sh==='rect'&&lb.sx!=null){
      ctx.beginPath(); ctx.strokeRect(lb.sx+ox,lb.sy+oy,lb.tx-lb.sx,lb.ty-lb.sy);
    } else if(sh==='circle'&&lb.sx!=null){
      const cx2=(lb.sx+lb.tx)/2+ox, cy2=(lb.sy+lb.ty)/2+oy;
      const rx=Math.abs(lb.tx-lb.sx)/2, ry=Math.abs(lb.ty-lb.sy)/2;
      ctx.beginPath(); ctx.ellipse(cx2,cy2,rx||1,ry||1,0,0,Math.PI*2); ctx.stroke();
    } else if(sh==='arrow'&&lb.sx!=null){
      drawArrow(ctx,lb.sx+ox,lb.sy+oy,lb.tx+ox,lb.ty+oy,lwVal);
    }
    // Connector line
    let fromX,fromY;
    if((sh==='rect'||sh==='circle')&&lb.sx!=null){
      const sMinX=Math.min(lb.sx,lb.tx), sMaxX=Math.max(lb.sx,lb.tx);
      const sMinY=Math.min(lb.sy,lb.ty), sMaxY=Math.max(lb.sy,lb.ty);
      const sMidX=(sMinX+sMaxX)/2, sMidY=(sMinY+sMaxY)/2;
      const elRef2=document.getElementById('cl-'+lb.id);
      const lblCX=lb.x+(elRef2?elRef2.offsetWidth/2:70), lblCY=lb.y+(elRef2?elRef2.offsetHeight/2:15);
      const ddx=Math.abs(lblCX-sMidX), ddy=Math.abs(lblCY-sMidY);
      if(ddy>ddx){ fromX=sMidX+ox; fromY=(lblCY<sMidY?sMinY:sMaxY)+oy; }
      else { fromY=sMidY+oy; fromX=(lblCX<sMidX?sMinX:sMaxX)+ox; }
    }
    else if(sh==='arrow'&&lb.sx!=null){ fromX=lb.sx+ox; fromY=lb.sy+oy; }
    else { fromX=lb.tx+ox; fromY=lb.ty+oy; }
    const toX=lb.x+ox, toY=lb.y+oy;
    const elRef=document.getElementById('cl-'+lb.id);
    const toYc=elRef?(toY+elRef.offsetHeight/2):toY;
    const dist=Math.sqrt((toX-fromX)**2+(toYc-fromY)**2);
    if(dist>5){
      ctx.strokeStyle=lc; ctx.lineWidth=lwVal*0.75; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(fromX,fromY); ctx.lineTo(toX,toYc); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Target dot for shape=none
    if(sh==='none'){
      ctx.fillStyle=lc.length>7?lc.slice(0,7)+'cc':lc;
      ctx.beginPath(); ctx.arc(lb.tx+ox,lb.ty+oy,4,0,Math.PI*2); ctx.fill();
    }
    // Label text
    const text=lb.text||'';
    const fontSize=12;
    ctx.font='600 '+fontSize+'px "PingFang SC","Microsoft YaHei",sans-serif';
    const tm=ctx.measureText(text);
    const pad=5;
    const bgX=lb.x+ox-pad, bgY=lb.y+oy-pad;
    const bgW=tm.width+pad*2, bgH=fontSize+pad*2;
    ctx.fillStyle=lb.bgColor||'#007AFF22'; ctx.fillRect(bgX,bgY,bgW,bgH);
    if(lb.textColor){ ctx.strokeStyle=lb.textColor; ctx.lineWidth=1; ctx.strokeRect(bgX,bgY,bgW,bgH); }
    ctx.fillStyle=lb.textColor||'#007AFF';
    ctx.fillText(text,lb.x+ox,lb.y+oy+fontSize);
    ctx.restore();
  });
  return out;
}
function buildReportCanvas(w) {
  if(!reportData) return null;
  const r=reportData;
  const lines=[];
  lines.push('UI差异报告  '+new Date().toLocaleString());
  lines.push('SSIM: '+(r.ssim*100).toFixed(1)+'%   Delta-E: '+r.avgDE.toFixed(1)+'   差异像素: '+r.diffPercent.toFixed(2)+'%');
  lines.push('差异区域数: '+r.regions.length+'个');
  lines.push('');
  r.regions.slice(0,15).forEach(reg=>{
    const a=reg.analysis;
    lines.push('#'+reg.id+' ['+a.severity.label+'] '+a.issue.label+' — 位置:('+reg.x+','+reg.y+') '+reg.w+'×'+reg.h);
  });
  const lineH=20, pad=16;
  const h=lines.length*lineH+pad*2;
  const out=document.createElement('canvas'); out.width=w; out.height=h;
  const ctx=out.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#222'; ctx.font='12px monospace';
  lines.forEach((l,i)=>ctx.fillText(l,pad,pad+i*lineH+12));
  return out;
}
function doExport() {
  const wantCurrent=document.getElementById('exp-check-current').checked;
  const wantOrigin=document.getElementById('exp-check-origin').checked;
  if(!wantCurrent&&!wantOrigin){ alert('请至少选择一项导出内容'); return; }
  const parts=[];
  if(wantCurrent){ const c=compositeAll(); if(c) parts.push({name:'当前画面',canvas:c}); }
  if(wantOrigin && psImg && gameImg){
    // Build simple stacked origin canvas (design on top, game on bottom)
    const refW=(gameImg||psImg).naturalWidth;
    const halfH=Math.round(refW*0.6);
    const out=document.createElement('canvas'); out.width=refW; out.height=halfH*2+2;
    const octx=out.getContext('2d');
    octx.fillStyle='#0d0d1d'; octx.fillRect(0,0,out.width,out.height);
    if(psImg){const s=Math.min(refW/psImg.naturalWidth,halfH/psImg.naturalHeight);const dw=Math.floor(psImg.naturalWidth*s),dh=Math.floor(psImg.naturalHeight*s);octx.drawImage(psImg,Math.floor((refW-dw)/2),Math.floor((halfH-dh)/2),dw,dh);}
    octx.strokeStyle='#333';octx.lineWidth=1;octx.beginPath();octx.moveTo(0,halfH+1);octx.lineTo(refW,halfH+1);octx.stroke();
    if(gameImg){const s=Math.min(refW/gameImg.naturalWidth,halfH/gameImg.naturalHeight);const dw=Math.floor(gameImg.naturalWidth*s),dh=Math.floor(gameImg.naturalHeight*s);octx.drawImage(gameImg,Math.floor((refW-dw)/2),halfH+2+Math.floor((halfH-dh)/2),dw,dh);}
    parts.push({name:'原图对比',canvas:out});
  }
  if(!parts.length) return;
  if(exportMerge) {
    const totalW=Math.max(...parts.map(p=>p.canvas.width));
    const totalH=parts.reduce((s,p)=>s+p.canvas.height+8,0)-8;
    const out=document.createElement('canvas'); out.width=totalW; out.height=totalH;
    const ctx=out.getContext('2d');
    ctx.fillStyle='#0d0d1d'; ctx.fillRect(0,0,totalW,totalH);
    let y=0;
    parts.forEach(p=>{
      const ox=Math.floor((totalW-p.canvas.width)/2);
      ctx.drawImage(p.canvas,ox,y); y+=p.canvas.height+8;
    });
    const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download='ui-export-'+Date.now()+'.png'; a.click();
  } else {
    parts.forEach((p,i)=>setTimeout(()=>{
      const a=document.createElement('a'); a.href=p.canvas.toDataURL('image/png'); a.download='ui-'+p.name+'-'+Date.now()+'.png'; a.click();
    },i*300));
  }
  closeExportDropdown();
}
function exportReportTxt(){
  const r=reportData; if(!r) return;
  let txt='UI跑查 - 差异分析报告\n'+'='.repeat(40)+'\n';
  txt+='生成时间: '+new Date().toLocaleString()+'\n\n';
  txt+='SSIM: '+(r.ssim*100).toFixed(1)+'%  Delta-E: '+r.avgDE.toFixed(1)+'  差异: '+r.diffPercent.toFixed(2)+'%\n';
  txt+='差异区域: '+r.regions.length+'个\n\n';
  r.regions.forEach(reg=>{
    const a=reg.analysis;
    txt+='#'+reg.id+' ['+a.severity.label+'] '+a.issue.label+' ('+reg.x+','+reg.y+') '+reg.w+'×'+reg.h+'\n';
  });
  const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.download='UI_Report_'+Date.now()+'.txt';a.href=URL.createObjectURL(blob);a.click();
}
