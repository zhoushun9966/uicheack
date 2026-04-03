'use strict';
// ====== SETTINGS ======
function toggleBW(white) {
  bwMode=white;
  viewport.classList.toggle('bw-bg',white);
  document.getElementById('bw-dark').classList.toggle('active',!white);
  document.getElementById('bw-white').classList.toggle('active',white);
}
function setLang(l) {
  lang=l;
  document.getElementById('lang-zh').classList.toggle('active',l==='zh');
  document.getElementById('lang-en').classList.toggle('active',l==='en');
  if(l==='en'){
    document.querySelector('.brand').textContent='🔍 UI Diff Tool';
    document.getElementById('mode-compare').textContent='⬡ Diff Compare';
  } else {
    document.querySelector('.brand').textContent='🔍 UI跑查对比工具';
    document.getElementById('mode-compare').textContent='⬡ 差异对比';
  }
}

// ====== MODALS ======
function openModal(id) { document.getElementById(id).classList.add('open'); if(id==='modal-ai') syncAIConfigToForm(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ====== CLEAR ======
function clearAll() {
  if(!confirm('确认清空所有内容？')) return;
  clearImage('game',null); clearImage('ps',null);
  annos=[]; history=[]; redoHistory=[];
  gridAnnos=[]; gridHistory=[]; gridRedoHistory=[];
  canvasLabels=[]; renderCanvasLabels();
  if(markCtx) markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
  if(annoCtx) annoCtx.clearRect(0,0,annoCanvas.width,annoCanvas.height);
  if(clickCtx) clickCtx.clearRect(0,0,clickCanvas.width,clickCanvas.height);
  reportData=null; isActive=false; isComparing=false; isOutline=false; isFindiff=false; isVSplit=false;
  currentMode='outline';
  panelCache={};
  layers.style.display='none';
  splitCanvas.style.display='none';
  document.getElementById('grid-container').classList.remove('active');
  const startBtn=document.getElementById('btn-start-compare');
  if(startBtn){ startBtn.textContent='▶ 开始对比'; startBtn.classList.remove('active','cta-ready'); startBtn.disabled=true; }
  ['mode-compare','mode-outline','mode-findiff'].forEach(id=>{
    const el=document.getElementById(id); if(el){ el.disabled=true; el.classList.remove('active'); }
  });
  document.getElementById('sensitivity-pills').style.display='none';
  labelCounter=0;
  activeTool=null; renderPropPanel();
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('active'));
  updateEraserLabels();
  updateUndoRedo();
  checkGuide();
}

// ====== ZOOM ======
function canvasZoom(delta) {
  const oldZoom=zoomLevel;
  zoomLevel=Math.max(0.2,Math.min(4,zoomLevel*delta));
  const ratio=zoomLevel/oldZoom;
  if(ratio===1) return;
  // Scale annotations around viewport center
  const cx=viewport.clientWidth/2, cy=viewport.clientHeight/2;
  annos.forEach(a=>{
    if(a.type==='text'){
      a.x=cx+(a.x-cx)*ratio; a.y=cy+(a.y-cy)*ratio;
      a.fontSize=Math.round((a.fontSize||20)*ratio);
    } else if(a.type==='brush'){
      if(a.pts) a.pts.forEach(p=>{ p.x=cx+(p.x-cx)*ratio; p.y=cy+(p.y-cy)*ratio; });
      a.lw=(a.lw||2)*ratio;
    } else {
      a.x1=cx+(a.x1-cx)*ratio; a.y1=cy+(a.y1-cy)*ratio;
      a.x2=cx+(a.x2-cx)*ratio; a.y2=cy+(a.y2-cy)*ratio;
      a.lw=(a.lw||2)*ratio;
    }
  });
  // Scale canvas labels
  canvasLabels.forEach(lb=>{
    lb.x=cx+(lb.x-cx)*ratio; lb.y=cy+(lb.y-cy)*ratio;
    lb.tx=cx+(lb.tx-cx)*ratio; lb.ty=cy+(lb.ty-cy)*ratio;
    if(lb.sx!=null){ lb.sx=cx+(lb.sx-cx)*ratio; lb.sy=cy+(lb.sy-cy)*ratio; }
  });
  syncCanvasSize();
  renderCanvasLabels();
}
function canvasZoomReset() { zoomLevel=0.8; syncCanvasSize(); }
viewport.addEventListener('wheel', e=>{
  if(e.ctrlKey){e.preventDefault(); canvasZoom(e.deltaY<0?1.1:0.9);}
},{passive:false});

// ====== GRID VIEW (simplified/legacy) ======
function updateGrid(){ /* no-op: grid view removed */ }
function cachePanel(mode){ /* no-op: panel cache no longer needed for display */ }
function refreshGridPanels(){ if(isActive) renderCurrentMode(); }

// ====== GRID ZOOM & PAN ======
function applyGridTransform() {
  const gi=document.getElementById('grid-inner');
  if(gi) gi.style.transform=`translate(${gridPanX}px,${gridPanY}px) scale(${gridZoom})`;
}
function onGridWheel(e) {
  e.preventDefault();
  const gc=document.getElementById('grid-container');
  const r=gc.getBoundingClientRect();
  const cx=e.clientX-r.left, cy=e.clientY-r.top;
  const delta=e.deltaY<0?1.12:0.9;
  const newZoom=Math.max(0.5,Math.min(6,gridZoom*delta));
  gridPanX=cx-(cx-gridPanX)*(newZoom/gridZoom);
  gridPanY=cy-(cy-gridPanY)*(newZoom/gridZoom);
  gridZoom=newZoom;
  applyGridTransform();
}

// ====== INIT ======
window.addEventListener('load', () => {
  markCtx = markCanvas.getContext('2d');
  annoCtx = annoCanvas.getContext('2d');
  clickCtx = clickCanvas.getContext('2d');
  splitCtx = splitCanvas.getContext('2d');
  mGenCanvas = document.createElement('canvas');
  mGenCtx = mGenCanvas.getContext('2d');
  // Prevent prop panel button clicks from stealing focus away from text input overlay.
  // Range sliders are exempt (they need mousedown to drag), but we suppress blur commit
  // during slider interaction and restore focus on mouseup.
  propInner.addEventListener('mousedown', e => {
    const ov=document.getElementById('text-input-overlay');
    const textActive=ov && ov.style.display!=='none';
    if(!textActive) return; // text overlay not active → don't interfere with normal prop interactions
    // Text overlay active: prevent prop panel from stealing focus / committing text
    suppressTextBlur=true;
    if(!(e.target.tagName==='INPUT' && e.target.type==='range')) {
      e.preventDefault(); // keep focus on textarea (doesn't block onclick on buttons)
    }
  });
  document.addEventListener('mouseup', () => {
    if(suppressTextBlur) {
      suppressTextBlur=false;
      const ov=document.getElementById('text-input-overlay');
      if(ov && ov.style.display!=='none') ov.focus();
    }
  });
  loadAIConfig();
  bindAnnoEvents();
  bindKeyboard();
  bindPaste();
  renderQAPanel();
  checkGuide();
  updateUndoRedo();
});
window.addEventListener('resize', () => {
  syncCanvasSize();
  if(isActive) renderCurrentMode();
});
document.addEventListener('click', e => {
  if(!e.target.closest('.export-split') && !e.target.closest('#export-dropdown')) closeExportDropdown();
});
