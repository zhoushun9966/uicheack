'use strict';
// ====== EXPORT DROPDOWN ======
function toggleExportDropdown() { document.getElementById('export-dropdown').classList.toggle('open'); }
function closeExportDropdown() { document.getElementById('export-dropdown').classList.remove('open'); }
function setExportMode(mode) {
  exportMerge = mode === 'merge';
  document.getElementById('exp-merge-btn').classList.toggle('active', exportMerge);
  document.getElementById('exp-split-btn').classList.toggle('active', !exportMerge);
}

// ====== CANVAS COMPOSITE (标注画面) ======
function compositeAll() {
  const refImg = gameImg || psImg;
  if (!refImg) return null;
  const vr = viewport.getBoundingClientRect();
  const lr = layers.getBoundingClientRect();
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  // Compute bounding box including layers and all labels
  let minX = lr.left - vr.left, minY = lr.top - vr.top;
  let maxX = minX + lr.width, maxY = minY + lr.height;
  canvasLabels.forEach(lb => {
    const el = document.getElementById('cl-' + lb.id);
    if (el) {
      minX = Math.min(minX, lb.x - 4); minY = Math.min(minY, lb.y - 4);
      maxX = Math.max(maxX, lb.x + el.offsetWidth + 4); maxY = Math.max(maxY, lb.y + el.offsetHeight + 4);
    }
    if (lb.sx != null) {
      minX = Math.min(minX, Math.min(lb.sx, lb.tx)); minY = Math.min(minY, Math.min(lb.sy, lb.ty));
      maxX = Math.max(maxX, Math.max(lb.sx, lb.tx)); maxY = Math.max(maxY, Math.max(lb.sy, lb.ty));
    }
    minX = Math.min(minX, lb.tx); minY = Math.min(minY, lb.ty);
    maxX = Math.max(maxX, lb.tx); maxY = Math.max(maxY, lb.ty);
  });
  minX = Math.max(0, minX - 10); minY = Math.max(0, minY - 10);
  maxX = Math.min(vw, maxX + 10); maxY = Math.min(vh, maxY + 10);
  const outW = Math.round(maxX - minX), outH = Math.round(maxY - minY);
  if (outW < 1 || outH < 1) return null;
  const out = document.createElement('canvas'); out.width = outW * 2; out.height = outH * 2;
  const ctx = out.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#1a1a2a'; ctx.fillRect(0, 0, outW, outH);
  const lx = lr.left - vr.left - minX, ly = lr.top - vr.top - minY;
  const lw2 = lr.width, lh2 = lr.height;
  if (gameImg) ctx.drawImage(gameImg, lx, ly, lw2, lh2);
  if (psImg) { ctx.globalAlpha = +document.getElementById('slider-ps').value; ctx.drawImage(psImg, lx, ly, lw2, lh2); ctx.globalAlpha = 1; }
  ctx.drawImage(markCanvas, lx, ly, lw2, lh2);
  ctx.drawImage(annoCanvas, -minX, -minY, vw, vh);
  // Draw canvas labels (shapes + connectors + label cards)
  canvasLabels.forEach(lb => {
    const lc = lb.lineColor || '#ffffff88';
    const sh = lb.shape || 'none';
    const lwVal = lb.lw || 2;
    const shapeAlpha = lb.opacity != null ? lb.opacity : 0.35;
    ctx.save();
    ctx.strokeStyle = lc; ctx.lineWidth = lwVal;
    const ox = -minX, oy = -minY;
    // Draw shape
    ctx.setLineDash([6, 3]); ctx.globalAlpha = shapeAlpha;
    if (sh === 'rect' && lb.sx != null) {
      ctx.beginPath(); ctx.strokeRect(lb.sx + ox, lb.sy + oy, lb.tx - lb.sx, lb.ty - lb.sy);
      // Viewfinder corners when no images
      if (!gameImg || !psImg) {
        const x1 = Math.min(lb.sx, lb.tx) + ox, y1 = Math.min(lb.sy, lb.ty) + oy;
        const x2 = Math.max(lb.sx, lb.tx) + ox, y2 = Math.max(lb.sy, lb.ty) + oy;
        const cl = Math.min(14, Math.abs(x2 - x1) * 0.18, Math.abs(y2 - y1) * 0.18);
        ctx.setLineDash([]); ctx.globalAlpha = 0.9; ctx.lineWidth = lwVal * 1.4;
        ctx.strokeStyle = lc.length > 7 ? lc.slice(0, 7) + 'ff' : lc;
        ctx.beginPath();
        ctx.moveTo(x1, y1 + cl); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cl, y1);
        ctx.moveTo(x2 - cl, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + cl);
        ctx.moveTo(x1, y2 - cl); ctx.lineTo(x1, y2); ctx.lineTo(x1 + cl, y2);
        ctx.moveTo(x2 - cl, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - cl);
        ctx.stroke();
        ctx.setLineDash([6, 3]); ctx.globalAlpha = shapeAlpha; ctx.lineWidth = lwVal; ctx.strokeStyle = lc;
      }
    } else if (sh === 'circle' && lb.sx != null) {
      const cx2 = (lb.sx + lb.tx) / 2 + ox, cy2 = (lb.sy + lb.ty) / 2 + oy;
      const rx = Math.abs(lb.tx - lb.sx) / 2, ry = Math.abs(lb.ty - lb.sy) / 2;
      ctx.beginPath(); ctx.ellipse(cx2, cy2, rx || 1, ry || 1, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (sh === 'arrow' && lb.sx != null) {
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      drawArrow(ctx, lb.sx + ox, lb.sy + oy, lb.tx + ox, lb.ty + oy, lwVal);
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // Connector line
    let fromX, fromY;
    if ((sh === 'rect' || sh === 'circle') && lb.sx != null) {
      const sMinX = Math.min(lb.sx, lb.tx), sMaxX = Math.max(lb.sx, lb.tx);
      const sMinY = Math.min(lb.sy, lb.ty), sMaxY = Math.max(lb.sy, lb.ty);
      const sMidX = (sMinX + sMaxX) / 2, sMidY = (sMinY + sMaxY) / 2;
      const elRef = document.getElementById('cl-' + lb.id);
      const lblCX = lb.x + (elRef ? elRef.offsetWidth / 2 : 70), lblCY = lb.y + (elRef ? elRef.offsetHeight / 2 : 15);
      const ddx = Math.abs(lblCX - sMidX), ddy = Math.abs(lblCY - sMidY);
      if (ddy > ddx) { fromX = sMidX + ox; fromY = (lblCY < sMidY ? sMinY : sMaxY) + oy; }
      else { fromY = sMidY + oy; fromX = (lblCX < sMidX ? sMinX : sMaxX) + ox; }
    } else if (sh === 'arrow' && lb.sx != null) { fromX = lb.sx + ox; fromY = lb.sy + oy; }
    else { fromX = lb.tx + ox; fromY = lb.ty + oy; }
    const elRef2 = document.getElementById('cl-' + lb.id);
    const toX = lb.x + ox, toY = lb.y + oy;
    const toYc = elRef2 ? (toY + elRef2.offsetHeight / 2) : toY;
    const dist = Math.sqrt((toX - fromX) ** 2 + (toYc - fromY) ** 2);
    if (dist > 5) {
      ctx.strokeStyle = lc; ctx.lineWidth = lwVal * 0.75; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toYc); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (sh === 'none') {
      ctx.fillStyle = lc.length > 7 ? lc.slice(0, 7) + 'cc' : lc;
      ctx.beginPath(); ctx.arc(lb.tx + ox, lb.ty + oy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Label card (seq number + problem text)
    const text = lb.text || '';
    const fontSize = 12;
    ctx.font = '600 ' + fontSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    const tm = ctx.measureText(text);
    const pad = 5;
    const bgX = lb.x + ox - pad, bgY = lb.y + oy - pad;
    const bgW = tm.width + pad * 2, bgH = fontSize + pad * 2;
    ctx.fillStyle = lb.bgColor || '#007AFF22'; ctx.fillRect(bgX, bgY, bgW, bgH);
    if (lb.textColor) { ctx.strokeStyle = lb.textColor; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.strokeRect(bgX, bgY, bgW, bgH); }
    ctx.fillStyle = lb.textColor || '#007AFF';
    ctx.fillText(text, lb.x + ox, lb.y + oy + fontSize);
    ctx.restore();
  });
  return out;
}

// ====== REPORT CARDS (问题报告) ======
function buildLabelReportCanvas() {
  if (!canvasLabels.length) return null;
  const SCALE = 2;
  const W = 680;
  const PAD = 18;
  const HEADER_H = 58;
  const CROP_GAP = 10;
  const CROP_W = Math.floor((W - PAD * 2 - 4 - CROP_GAP) / 2);

  const items = canvasLabels.map((lb, i) => {
    const hasRect = lb.shape === 'rect' && lb.sx != null && Math.abs(lb.tx - lb.sx) > 8 && Math.abs(lb.ty - lb.sy) > 8;
    const hasCrops = hasRect && gameImg && psImg;
    let cropH = 0, psOff = null, gameOff = null;
    if (hasCrops) {
      const vx1 = Math.min(lb.sx, lb.tx), vy1 = Math.min(lb.sy, lb.ty);
      const vx2 = Math.max(lb.sx, lb.tx), vy2 = Math.max(lb.sy, lb.ty);
      const pp1 = viewportToImgCoordsFor(psImg, vx1, vy1), pp2 = viewportToImgCoordsFor(psImg, vx2, vy2);
      const gp1 = viewportToImgCoordsFor(gameImg, vx1, vy1), gp2 = viewportToImgCoordsFor(gameImg, vx2, vy2);
      const cropWp = Math.max(1, pp2.x - pp1.x), cropHp = Math.max(1, pp2.y - pp1.y);
      cropH = Math.max(30, Math.round(CROP_W * (cropHp / cropWp)));
      psOff = { x: pp1.x, y: pp1.y, w: cropWp, h: cropHp };
      gameOff = { x: gp1.x, y: gp1.y, w: Math.max(1, gp2.x - gp1.x), h: Math.max(1, gp2.y - gp1.y) };
    }
    const LABEL_ROW_H = 28;
    const cardH = PAD + LABEL_ROW_H + PAD + (hasCrops ? CROP_GAP + cropH + 18 : 0);
    return { lb, i, hasCrops, cropH, psOff, gameOff, cardH };
  });

  const totalH = HEADER_H + items.reduce((s, it) => s + it.cardH + 1, 0) + 1;
  const out = document.createElement('canvas');
  out.width = W * SCALE; out.height = totalH * SCALE;
  const ctx = out.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Header
  ctx.fillStyle = '#12121e'; ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = '#e0e0f0';
  ctx.font = 'bold 17px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('UI跑查 · 问题报告', PAD, 28);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#555';
  ctx.fillText(new Date().toLocaleString() + '    共 ' + canvasLabels.length + ' 项问题', PAD, 46);

  let y = HEADER_H;
  items.forEach(({ lb, i, hasCrops, cropH, psOff, gameOff, cardH }) => {
    const color = (lb.lineColor || lb.color || '#007AFF').slice(0, 7);
    ctx.fillStyle = '#1a1a2a'; ctx.fillRect(0, y, W, cardH);
    ctx.fillStyle = color; ctx.fillRect(0, y, 4, cardH);
    ctx.fillStyle = '#0d0d1d'; ctx.fillRect(0, y + cardH, W, 1);

    // Number badge
    const numStr = '#' + (i + 1);
    ctx.font = 'bold 12px sans-serif';
    const numW = ctx.measureText(numStr).width + 12;
    ctx.fillStyle = color + '33'; ctx.fillRect(PAD + 4, y + PAD, numW, 20);
    ctx.fillStyle = color; ctx.fillText(numStr, PAD + 4 + 6, y + PAD + 15);

    // Problem description
    const displayText = lb.text.replace(/^#\d+\s*/, '');
    ctx.font = '600 15px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#e8e8f0';
    const maxTW = W - PAD * 2 - 4 - numW - 12 - 54;
    let drawText = displayText;
    while (ctx.measureText(drawText).width > maxTW && drawText.length > 1) drawText = drawText.slice(0, -1);
    if (drawText !== displayText) drawText = drawText.slice(0, -1) + '…';
    ctx.fillText(drawText, PAD + 4 + numW + 8, y + PAD + 15);

    // Badge
    const badgeText = hasCrops ? '截图' : '标注';
    ctx.font = '600 10px sans-serif';
    const bw = ctx.measureText(badgeText).width + 12;
    ctx.fillStyle = hasCrops ? '#4ecca322' : '#007AFF22';
    ctx.fillRect(W - PAD - bw, y + PAD + 2, bw, 16);
    ctx.fillStyle = hasCrops ? '#4ecca3' : '#007AFF';
    ctx.fillText(badgeText, W - PAD - bw + 6, y + PAD + 13);

    if (hasCrops && psOff && gameOff) {
      const cropY = y + PAD + 28 + CROP_GAP;
      const crop1X = PAD + 4, crop2X = PAD + 4 + CROP_W + CROP_GAP;
      ctx.drawImage(psImg, psOff.x, psOff.y, psOff.w, psOff.h, crop1X, cropY, CROP_W, cropH);
      ctx.drawImage(gameImg, gameOff.x, gameOff.y, gameOff.w, gameOff.h, crop2X, cropY, CROP_W, cropH);
      ctx.strokeStyle = '#a29bfe'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.strokeRect(crop1X, cropY, CROP_W, cropH);
      ctx.strokeStyle = '#4ecca3';
      ctx.strokeRect(crop2X, cropY, CROP_W, cropH);
      ctx.font = '600 10px sans-serif';
      ctx.fillStyle = '#a29bfe'; ctx.fillText('设计稿', crop1X, cropY + cropH + 14);
      ctx.fillStyle = '#4ecca3'; ctx.fillText('游戏截图', crop2X, cropY + cropH + 14);
    }
    y += cardH + 1;
  });
  return out;
}

// ====== INTERNAL HELPERS ======
function getExportParts() {
  const wantCurrent = document.getElementById('exp-check-current')?.checked !== false;
  const wantReport = document.getElementById('exp-check-report')?.checked !== false;
  const wantOrigin = document.getElementById('exp-check-origin')?.checked;
  const parts = [];
  if (wantCurrent) { const c = compositeAll(); if (c) parts.push({ name: '标注画面', canvas: c }); }
  if (wantReport) { const r = buildLabelReportCanvas(); if (r) parts.push({ name: '问题报告', canvas: r }); }
  if (wantOrigin && psImg && gameImg) {
    const refW = (gameImg || psImg).naturalWidth;
    const halfH = Math.round(refW * 0.6);
    const out = document.createElement('canvas'); out.width = refW; out.height = halfH * 2 + 2;
    const octx = out.getContext('2d');
    octx.fillStyle = '#0d0d1d'; octx.fillRect(0, 0, out.width, out.height);
    if (psImg) { const s = Math.min(refW / psImg.naturalWidth, halfH / psImg.naturalHeight); const dw = Math.floor(psImg.naturalWidth * s), dh = Math.floor(psImg.naturalHeight * s); octx.drawImage(psImg, Math.floor((refW - dw) / 2), Math.floor((halfH - dh) / 2), dw, dh); }
    octx.strokeStyle = '#333'; octx.lineWidth = 1; octx.beginPath(); octx.moveTo(0, halfH + 1); octx.lineTo(refW, halfH + 1); octx.stroke();
    if (gameImg) { const s = Math.min(refW / gameImg.naturalWidth, halfH / gameImg.naturalHeight); const dw = Math.floor(gameImg.naturalWidth * s), dh = Math.floor(gameImg.naturalHeight * s); octx.drawImage(gameImg, Math.floor((refW - dw) / 2), halfH + 2 + Math.floor((halfH - dh) / 2), dw, dh); }
    parts.push({ name: '原图对比', canvas: out });
  }
  return parts;
}

// ✅ 为 Jira 提单提供核心的长图拼接函数
function getFinalExportCanvas() {
  const parts = getExportParts();
  if (!parts.length) return null;

  const totalW = Math.max(...parts.map(p => p.canvas.width));
  const totalH = parts.reduce((s, p) => s + p.canvas.height + 8, 0) - 8;
  const out = document.createElement('canvas'); 
  out.width = totalW; 
  out.height = totalH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#0d0d1d'; ctx.fillRect(0, 0, totalW, totalH);
  
  let y = 0;
  parts.forEach(p => {
    const ox = Math.floor((totalW - p.canvas.width) / 2);
    ctx.drawImage(p.canvas, ox, y); 
    y += p.canvas.height + 8;
  });
  
  return out;
}

// ====== EXPORT ACTION ======
function doExport() {
  const parts = getExportParts();
  if (!parts.length) { alert('请至少选择一项导出内容'); return; }

  if (exportMerge) {
    const out = getFinalExportCanvas();
    const a = document.createElement('a'); a.href = out.toDataURL('image/png'); a.download = 'ui-export-' + Date.now() + '.png'; a.click();
  } else {
    parts.forEach((p, i) => setTimeout(() => {
      const a = document.createElement('a'); a.href = p.canvas.toDataURL('image/png'); a.download = 'ui-' + p.name + '-' + Date.now() + '.png'; a.click();
    }, i * 300));
  }
  closeExportDropdown();
}

function exportReportTxt() {
  const r = reportData; if (!r) return;
  let txt = 'UI跑查 - 差异分析报告\n' + '='.repeat(40) + '\n';
  txt += '生成时间: ' + new Date().toLocaleString() + '\n\n';
  txt += 'SSIM: ' + (r.ssim * 100).toFixed(1) + '%  Delta-E: ' + r.avgDE.toFixed(1) + '  差异: ' + r.diffPercent.toFixed(2) + '%\n';
  txt += '差异区域: ' + r.regions.length + '个\n\n';
  r.regions.forEach(reg => {
    const a = reg.analysis;
    txt += '#' + reg.id + ' [' + a.severity.label + '] ' + a.issue.label + ' (' + reg.x + ',' + reg.y + ') ' + reg.w + '×' + reg.h + '\n';
  });
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.download = 'UI_Report_' + Date.now() + '.txt'; a.href = URL.createObjectURL(blob); a.click();
}