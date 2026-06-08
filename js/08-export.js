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

// 共享布局计算：包围盒包含图层区域+所有标注，确保设计稿与游戏截图尺寸完全一致
function _computeExportLayout() {
  const refImg = gameImg || psImg;
  if (!refImg) return null;
  const vr = viewport.getBoundingClientRect();
  const lr = layers.getBoundingClientRect();
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
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
  maxX = maxX + 10; maxY = maxY + 10;
  const outW = Math.round(maxX - minX), outH = Math.round(maxY - minY);
  if (outW < 1 || outH < 1) return null;
  const lx = lr.left - vr.left - minX, ly = lr.top - vr.top - minY;
  const lw = lr.width, lh = lr.height;
  return { vw, vh, minX, minY, outW, outH, lx, ly, lw, lh };
}

// 为导出画布顶部追加标题栏（2x 分辨率匹配）
function addTitleBar(canvas, title, accentColor) {
  const TITLE_H = 56; // 28px × 2x
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height + TITLE_H;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#0d0d1d'; ctx.fillRect(0, 0, out.width, TITLE_H);
  ctx.fillStyle = accentColor || '#007AFF'; ctx.fillRect(0, 0, 6, TITLE_H);
  ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#e0e0f0';
  ctx.fillText(title, 22, 38);
  ctx.drawImage(canvas, 0, TITLE_H);
  return out;
}

function compositeAll(includeOverlay = true) {
  const layout = _computeExportLayout();
  if (!layout) return null;
  const { vw, vh, minX, minY, outW, outH, lx, ly, lw: lw2, lh: lh2 } = layout;
  const out = document.createElement('canvas'); out.width = outW * 2; out.height = outH * 2;
  const ctx = out.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#1a1a2a'; ctx.fillRect(0, 0, outW, outH);
  if (gameImg) ctx.drawImage(gameImg, lx, ly, lw2, lh2);
  if (includeOverlay && psImg) {
    // 将 mGenCanvas 遮罩应用到 psImg（橡皮擦"抹设计稿"的结果），
    // 避免直接 drawImage 绕过 CSS mask 导致被擦区域在导出图中复现
    const psMasked = document.createElement('canvas');
    psMasked.width  = mGenCanvas.width;
    psMasked.height = mGenCanvas.height;
    const pmCtx = psMasked.getContext('2d');
    pmCtx.drawImage(psImg, 0, 0, psMasked.width, psMasked.height);
    pmCtx.globalCompositeOperation = 'destination-in';
    pmCtx.drawImage(mGenCanvas, 0, 0);
    ctx.globalAlpha = +document.getElementById('slider-ps').value;
    ctx.drawImage(psMasked, lx, ly, lw2, lh2);
    ctx.globalAlpha = 1;
  }
  if (includeOverlay) ctx.drawImage(markCanvas, lx, ly, lw2, lh2);
  ctx.drawImage(annoCanvas, -minX, -minY, vw, vh);
  // Draw canvas labels (shapes + connectors + label cards)
  canvasLabels.forEach(lb => {
    const lc = lb.lineColor || '#ffffff88';
    const sh = lb.shape || 'none';
    const lwVal = lb.lw || 2;
    const shapeAlpha = lb.opacity != null ? lb.opacity : 1;
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
    const CARD_PAD = 5;
    const cardElW = elRef2 ? elRef2.offsetWidth : 120;
    const cardElH = elRef2 ? elRef2.offsetHeight : 22;
    // 计算卡片四边
    const cardL = lb.x + ox - CARD_PAD;
    const cardT = lb.y + oy - CARD_PAD;
    const cardR = lb.x + ox + cardElW + CARD_PAD;
    const cardB = lb.y + oy + cardElH + CARD_PAD;
    const cardCX = (cardL + cardR) / 2, cardCY = (cardT + cardB) / 2;
    // 从卡片中心向 from 点方向，求与卡片矩形边界的交点，连线终止于此
    const dx = fromX - cardCX, dy = fromY - cardCY;
    const halfW = (cardR - cardL) / 2, halfH = (cardB - cardT) / 2;
    let toX, toYc;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      toX = cardCX; toYc = cardCY;
    } else if (Math.abs(dx) * halfH >= Math.abs(dy) * halfW) {
      // 交点在左边或右边
      const t = halfW / Math.abs(dx);
      toX = cardCX + Math.sign(dx) * halfW;
      toYc = cardCY + dy * t;
    } else {
      // 交点在上边或下边
      const t = halfH / Math.abs(dy);
      toX = cardCX + dx * t;
      toYc = cardCY + Math.sign(dy) * halfH;
    }
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
    // Label card (seq number + problem text) — wrap long text to match CSS max-width:280px
    const text = lb.text || '';
    const fontSize = 12;
    const maxCardW = 260; // matches CSS max-width:280px minus border/padding
    const pad = 5;
    const lineH = fontSize + 4;
    ctx.font = '600 ' + fontSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    // Wrap text into lines
    const cardLines = [];
    let remaining = text;
    while (remaining.length > 0) {
      let lo = 1, hi = remaining.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(remaining.slice(0, mid)).width <= maxCardW - pad * 2) lo = mid;
        else hi = mid - 1;
      }
      cardLines.push(remaining.slice(0, lo));
      remaining = remaining.slice(lo);
    }
    const bgW = Math.min(maxCardW, Math.max(...cardLines.map(l => ctx.measureText(l).width)) + pad * 2);
    const bgH = cardLines.length * lineH + pad * 2;
    const bgX = lb.x + ox - pad, bgY = lb.y + oy - pad;
    ctx.fillStyle = lb.bgColor || '#007AFF22'; ctx.fillRect(bgX, bgY, bgW, bgH);
    if (lb.textColor) { ctx.strokeStyle = lb.textColor; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.strokeRect(bgX, bgY, bgW, bgH); }
    ctx.fillStyle = lb.textColor || '#007AFF';
    cardLines.forEach((line, i) => {
      ctx.fillText(line, lb.x + ox, lb.y + oy + fontSize + i * lineH);
    });
    ctx.restore();
  });
  return out;
}

// ====== REPORT CARDS (问题报告) ======

// 为问题报告卡片生成裁图区域的轮廓对比图（与画板轮廓模式逻辑一致，直接 Sobel 输出）
function _buildOutlineCanvas(psOff, gameOff, w, h) {
  if (!psImg || !gameImg || w < 1 || h < 1) return null;

  // object-fit:contain 绘制到临时 canvas，保持比例不拉伸
  const mkContain = (img, off) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cctx = c.getContext('2d');
    const sa = off.w / Math.max(1, off.h), da = w / Math.max(1, h);
    let dw, dh, ox, oy;
    if (sa >= da) { dw = w; dh = Math.max(1, Math.round(w / sa)); ox = 0; oy = Math.floor((h - dh) / 2); }
    else          { dh = h; dw = Math.max(1, Math.round(h * sa)); ox = Math.floor((w - dw) / 2); oy = 0; }
    cctx.drawImage(img, off.x, off.y, off.w, off.h, ox, oy, dw, dh);
    return c;
  };
  const psCrop   = mkContain(psImg,   psOff);
  const gameCrop = mkContain(gameImg, gameOff);

  const edges1 = detectEdges(gameCrop, w, h);
  const edges2 = detectEdges(psCrop,   w, h);

  // 渲染：游戏+设计稿叠加作背景，直接输出 Sobel 边缘（红/绿/黄，与画板一致）
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.drawImage(gameCrop, 0, 0);
  const psAlpha = +( document.getElementById('slider-ps')?.value ?? 0.5 );
  if (psAlpha > 0) { octx.globalAlpha = psAlpha; octx.drawImage(psCrop, 0, 0); octx.globalAlpha = 1; }

  const overlayC = document.createElement('canvas'); overlayC.width = w; overlayC.height = h;
  const overlayCtx = overlayC.getContext('2d');
  const imgData = overlayCtx.createImageData(w, h); const od = imgData.data;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const g = edges1[i] > 0, d = edges2[i] > 0;
    let r = 0, gv = 0, a = 0;
    if (g && d)  { r = 0; gv = 0; a = 0; }         // 重叠 → 不显示
    else if (g)  { r = edges1[i]; a = 255; }        // 仅游戏 → 红
    else if (d)  { gv = edges2[i]; a = 255; }       // 仅设计 → 绿
    od[idx] = r; od[idx+1] = gv; od[idx+2] = 0; od[idx+3] = a;
  }
  overlayCtx.putImageData(imgData, 0, 0);
  octx.drawImage(overlayC, 0, 0);
  return out;
}

function buildLabelReportCanvas() {
  if (!canvasLabels.length) return null;
  const SCALE = 2;
  const W = 900;  // 扩大卡片宽度，三列各 ~280px，提升可读性
  const PAD = 18;
  const HEADER_H = 58;
  const CROP_GAP = 10;
  // 三列等宽：设计稿 | 游戏截图 | 轮廓对比
  const CROP_W = Math.floor((W - PAD * 2 - 4 - CROP_GAP * 2) / 3);
  const FULL_W = W - PAD * 2 - 4; // 竖排时每行满宽

  const items = canvasLabels.map((lb, i) => {
    const hasRect = lb.shape === 'rect' && lb.sx != null && Math.abs(lb.tx - lb.sx) > 8 && Math.abs(lb.ty - lb.sy) > 8;
    const hasCrops = hasRect && gameImg && psImg;
    let cropH = 0, psOff = null, gameOff = null, isWide = false;
    if (hasCrops) {
      const vx1 = Math.min(lb.sx, lb.tx), vy1 = Math.min(lb.sy, lb.ty);
      const vx2 = Math.max(lb.sx, lb.tx), vy2 = Math.max(lb.sy, lb.ty);
      const pp1 = viewportToImgCoordsFor(psImg, vx1, vy1), pp2 = viewportToImgCoordsFor(psImg, vx2, vy2);
      const gp1 = viewportToImgCoordsFor(gameImg, vx1, vy1), gp2 = viewportToImgCoordsFor(gameImg, vx2, vy2);
      const cropWp = Math.max(1, pp2.x - pp1.x), cropHp = Math.max(1, pp2.y - pp1.y);
      // 以视口选框的实际像素宽度决定横/竖排：
      // 3张图并排预留 2×10px 间距，可用 ~920px → 每张上限 300px
      // 选框宽度 ≤ 300px → 横排三列；> 300px → 竖排（单张已超三等分阈值）
      const vpW = Math.max(1, vx2 - vx1), vpH = Math.max(1, vy2 - vy1);
      isWide = vpW > 300;
      if (isWide) {
        // 竖排：满宽展示，高度按视口比例，上限 300px
        cropH = Math.max(30, Math.min(300, Math.round(FULL_W * vpH / vpW)));
      } else {
        // 横排三列：高度按视口比例，上限 400px 防止窄截图过度放大
        cropH = Math.max(30, Math.min(400, Math.round(CROP_W * vpH / vpW)));
      }
      psOff = { x: pp1.x, y: pp1.y, w: cropWp, h: cropHp };
      gameOff = { x: gp1.x, y: gp1.y, w: Math.max(1, gp2.x - gp1.x), h: Math.max(1, gp2.y - gp1.y) };
    }
    const LABEL_ROW_H = 28;
    const cardH = PAD + LABEL_ROW_H + PAD
      + (hasCrops && !isWide ? CROP_GAP + cropH + 18 : 0)
      + (hasCrops &&  isWide ? (CROP_GAP + cropH + 14) * 3 : 0);
    return { lb, i, hasCrops, isWide, cropH, psOff, gameOff, cardH };
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
  items.forEach(({ lb, i, hasCrops, isWide, cropH, psOff, gameOff, cardH }) => {
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
      ctx.font = '600 10px sans-serif';
      ctx.lineWidth = 1; ctx.setLineDash([]);

      // object-fit:contain 绘制：保持裁图原始比例，不拉伸，超出区域留空
      const drawContain = (img, off, dstX, dstY, dstW, dstH) => {
        const sa = off.w / Math.max(1, off.h), da = dstW / Math.max(1, dstH);
        let dw, dh, ox, oy;
        if (sa >= da) { dw = dstW; dh = Math.max(1, Math.round(dstW / sa)); ox = dstX; oy = dstY + Math.floor((dstH - dh) / 2); }
        else          { dh = dstH; dw = Math.max(1, Math.round(dstH * sa)); ox = dstX + Math.floor((dstW - dw) / 2); oy = dstY; }
        ctx.drawImage(img, off.x, off.y, off.w, off.h, ox, oy, dw, dh);
      };

      if (isWide) {
        // ── 竖排模板（宽图：横幅/通栏）─────────────────────────────────────
        const rowX = PAD + 4;
        const row2Y = cropY + cropH + 14 + CROP_GAP;
        const row3Y = row2Y + cropH + 14 + CROP_GAP;

        drawContain(psImg,   psOff,   rowX, cropY, FULL_W, cropH);
        ctx.strokeStyle = '#a29bfe'; ctx.strokeRect(rowX, cropY, FULL_W, cropH);
        ctx.fillStyle = '#a29bfe'; ctx.fillText('设计稿', rowX, cropY + cropH + 12);

        drawContain(gameImg, gameOff, rowX, row2Y, FULL_W, cropH);
        ctx.strokeStyle = '#4ecca3'; ctx.strokeRect(rowX, row2Y, FULL_W, cropH);
        ctx.fillStyle = '#4ecca3'; ctx.fillText('游戏截图', rowX, row2Y + cropH + 12);

        const olC = _buildOutlineCanvas(psOff, gameOff, FULL_W * SCALE, cropH * SCALE);
        if (olC) { ctx.drawImage(olC, rowX, row3Y, FULL_W, cropH); ctx.strokeStyle = '#555'; ctx.strokeRect(rowX, row3Y, FULL_W, cropH); }
        ctx.fillStyle = '#888'; ctx.fillText('轮廓对比', rowX, row3Y + cropH + 12);

      } else {
        // ── 横排三列模板（正常比例截图）──────────────────────────────────────
        const crop1X = PAD + 4;
        const crop2X = crop1X + CROP_W + CROP_GAP;
        const crop3X = crop2X + CROP_W + CROP_GAP;

        drawContain(psImg,   psOff,   crop1X, cropY, CROP_W, cropH);
        ctx.strokeStyle = '#a29bfe'; ctx.strokeRect(crop1X, cropY, CROP_W, cropH);

        drawContain(gameImg, gameOff, crop2X, cropY, CROP_W, cropH);
        ctx.strokeStyle = '#4ecca3'; ctx.strokeRect(crop2X, cropY, CROP_W, cropH);

        const olC = _buildOutlineCanvas(psOff, gameOff, CROP_W * SCALE, cropH * SCALE);
        if (olC) { ctx.drawImage(olC, crop3X, cropY, CROP_W, cropH); ctx.strokeStyle = '#555'; ctx.strokeRect(crop3X, cropY, CROP_W, cropH); }

        ctx.fillStyle = '#a29bfe'; ctx.fillText('设计稿', crop1X, cropY + cropH + 14);
        ctx.fillStyle = '#4ecca3'; ctx.fillText('游戏截图', crop2X, cropY + cropH + 14);
        ctx.fillStyle = '#888';    ctx.fillText('轮廓对比', crop3X, cropY + cropH + 14);
      }
    }
    y += cardH + 1;
  });
  return out;
}

// ====== INTERNAL HELPERS ======

// 设计稿导出：与游戏截图使用完全相同的画布尺寸和图层偏移，确保对齐
function buildDesignCanvas() {
  if (!psImg) return null;
  const layout = _computeExportLayout();
  if (!layout) return null;
  const { outW, outH, lx, ly, lw, lh } = layout;
  const out = document.createElement('canvas'); out.width = outW * 2; out.height = outH * 2;
  const ctx = out.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#1a1a2a'; ctx.fillRect(0, 0, outW, outH);
  // 在与游戏截图相同的 (lx, ly) 偏移处渲染设计稿，保证两图对齐
  ctx.save();
  ctx.translate(lx, ly);
  if (typeof _drawPsCentered === 'function') _drawPsCentered(ctx, lw, lh);
  else ctx.drawImage(psImg, 0, 0, lw, lh);
  ctx.restore();
  return out;
}

function getExportParts() {
  const wantDesign    = document.getElementById('exp-check-design')?.checked;
  const wantAnnotated = document.getElementById('exp-check-annotated')?.checked;
  const wantReport    = document.getElementById('exp-check-report')?.checked;
  const wantOverlay   = document.getElementById('exp-check-overlay')?.checked;
  const parts = [];
  if (wantDesign) {
    const c = buildDesignCanvas();
    if (c) parts.push({ name: '设计稿', canvas: addTitleBar(c, 'UI设计稿', '#a29bfe') });
  }
  if (wantAnnotated) {
    const c = compositeAll(false);
    if (c) parts.push({ name: '游戏截图+标注', canvas: addTitleBar(c, '游戏截图', '#4ecca3') });
  }
  if (wantReport)    { const r = buildLabelReportCanvas(); if (r) parts.push({ name: '问题报告', canvas: r }); }
  if (wantOverlay)   { const c = compositeAll(true);      if (c) parts.push({ name: '标注画面', canvas: c }); }
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
