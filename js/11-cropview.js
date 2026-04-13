'use strict';
// ====== CROP FLOAT PANELS ======
// Shows side-by-side design/game crops floating around the nearest image edge

function clearCropPanels() {
  document.querySelectorAll('.crop-float-panel').forEach(el => el.remove());
}

function cropRegionToBase64(img, reg, canvasW, canvasH) {
  const mx = Math.max(10, Math.floor(reg.w * 0.15));
  const my = Math.max(10, Math.floor(reg.h * 0.15));
  const sx = Math.max(0, reg.x - mx);
  const sy = Math.max(0, reg.y - my);
  const sw = Math.min(canvasW - sx, reg.w + mx * 2);
  const sh = Math.min(canvasH - sy, reg.h + my * 2);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL('image/jpeg', 0.9);
}

function makeCropPanelDraggable(panel) {
  const header = panel.querySelector('.cfp-header');
  let sx, sy, sl, st, dragging = false;
  header.addEventListener('mousedown', e => {
    if (e.target.classList.contains('cfp-close')) return;
    e.preventDefault();
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    sl = parseInt(panel.style.left); st = parseInt(panel.style.top);
    panel.style.zIndex = 200;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    panel.style.left = (sl + e.clientX - sx) + 'px';
    panel.style.top  = (st + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; panel.style.zIndex = ''; }
  });
}

function showCropPanels(regions) {
  clearCropPanels();
  if (!regions || !regions.length || !gameImg || !psImg) return;

  const nw = markCanvas.width, nh = markCanvas.height;
  if (!nw || !nh) return;

  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  // Compute displayed image bounds (same logic as syncCanvasSize)
  let fitW = vw, fitH = vw * nh / nw;
  if (fitH > vh) { fitH = vh; fitW = vh * nw / nh; }
  fitW = Math.floor(fitW * zoomLevel);
  fitH = Math.floor(fitH * zoomLevel);
  const imgLeft = Math.floor((vw - fitW) / 2);
  const imgTop  = Math.floor((vh - fitH) / 2);
  const scale   = fitW / nw;

  const PANEL_W = 172;
  const GAP = 10;
  // Per-edge stagger counters so panels on the same edge don't perfectly overlap
  const edgeCount = { top: 0, bottom: 0, left: 0, right: 0 };

  regions.slice(0, 6).forEach(reg => {
    // Region center in viewport coords
    const cx = imgLeft + (reg.x + reg.w / 2) * scale;
    const cy = imgTop  + (reg.y + reg.h / 2) * scale;

    // Distance from region center to each image edge
    const dTop    = cy - imgTop;
    const dBottom = (imgTop + fitH) - cy;
    const dLeft   = cx - imgLeft;
    const dRight  = (imgLeft + fitW) - cx;
    const minD = Math.min(dTop, dBottom, dLeft, dRight);

    let panelLeft, panelTop, edge;
    if (minD === dTop) {
      edge = 'top';
      const stagger = edgeCount.top * (PANEL_W + 6);
      panelLeft = Math.max(4, Math.min(vw - PANEL_W - 4, cx - PANEL_W / 2 + stagger));
      panelTop  = Math.max(4, imgTop - 130 - GAP);
    } else if (minD === dBottom) {
      edge = 'bottom';
      const stagger = edgeCount.bottom * (PANEL_W + 6);
      panelLeft = Math.max(4, Math.min(vw - PANEL_W - 4, cx - PANEL_W / 2 + stagger));
      panelTop  = Math.min(vh - 134, imgTop + fitH + GAP);
    } else if (minD === dLeft) {
      edge = 'left';
      const stagger = edgeCount.left * 110;
      panelLeft = Math.max(4, imgLeft - PANEL_W - GAP);
      panelTop  = Math.max(4, Math.min(vh - 134, cy - 65 + stagger));
    } else {
      edge = 'right';
      const stagger = edgeCount.right * 110;
      panelLeft = Math.min(vw - PANEL_W - 4, imgLeft + fitW + GAP);
      panelTop  = Math.max(4, Math.min(vh - 134, cy - 65 + stagger));
    }
    edgeCount[edge]++;

    // Build base64 crops from original images
    const b64Ps   = cropRegionToBase64(psImg,   reg, nw, nh);
    const b64Game = cropRegionToBase64(gameImg,  reg, nw, nh);

    const a = reg.analysis;
    const label = a ? `#${reg.id} ${a.issue.label}` : `#${reg.id}`;
    const color = a ? a.issue.borderColor : '#007AFF';

    const panel = document.createElement('div');
    panel.className = 'crop-float-panel';
    panel.style.left = panelLeft + 'px';
    panel.style.top  = panelTop  + 'px';
    panel.innerHTML = `
      <div class="cfp-header" style="border-left:3px solid ${color}">
        <span class="cfp-title">${label}</span>
        <button class="cfp-close" onclick="this.closest('.crop-float-panel').remove()">✕</button>
      </div>
      <div class="cfp-body">
        <div class="cfp-crop">
          <img src="${b64Ps}" class="cfp-img">
          <span class="cfp-lbl cfp-lbl-ps">设计</span>
        </div>
        <div class="cfp-divider"></div>
        <div class="cfp-crop">
          <img src="${b64Game}" class="cfp-img">
          <span class="cfp-lbl cfp-lbl-game">游戏</span>
        </div>
      </div>`;

    makeCropPanelDraggable(panel);
    viewport.appendChild(panel);
  });
}
