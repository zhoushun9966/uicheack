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
  canvasLabels=[]; renderCanvasLabels(); // renderIssuesDrawer is called inside renderCanvasLabels
  clearCropPanels();
  panX=0; panY=0;
  if(markCtx) markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
  if(annoCtx) annoCtx.clearRect(0,0,annoCanvas.width,annoCanvas.height);
  if(clickCtx) clickCtx.clearRect(0,0,clickCanvas.width,clickCanvas.height);
  reportData=null; isActive=false; isComparing=false; isOutline=false; isFindiff=false; isVSplit=false;
  currentMode='outline';
  // Reset diagnosis button
  const diagBtn=document.getElementById('btn-diagnose');
  if(diagBtn){diagBtn.disabled=true;diagBtn.textContent='🔍 一键诊断';diagBtn.classList.remove('diag-active');}
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
  // Scale canvas labels — only annotation coords, NOT label card position (lb.x/y)
  // lb.x/y will be recomputed from annotation coords after syncCanvasSize
  canvasLabels.forEach(lb=>{
    lb.tx=cx+(lb.tx-cx)*ratio; lb.ty=cy+(lb.ty-cy)*ratio;
    if(lb.sx!=null){ lb.sx=cx+(lb.sx-cx)*ratio; lb.sy=cy+(lb.sy-cy)*ratio; }
  });
  syncCanvasSize();
  if(typeof recomputeLabelPositions==='function') recomputeLabelPositions();
  renderCanvasLabels();
  updateScrollbars();
} { zoomLevel=0.7; syncCanvasSize(); }
// ====== PAN & SCROLLBARS ======
function _getPanMax() {
  const refImg=gameImg||psImg; if(!refImg) return {x:0,y:0};
  const vw=viewport.clientWidth,vh=viewport.clientHeight;
  const nw=refImg.naturalWidth,nh=refImg.naturalHeight;
  let fitW=vw,fitH=vw*nh/nw;
  if(fitH>vh){fitH=vh;fitW=vh*nw/nh;}
  fitW=Math.floor(fitW*zoomLevel);fitH=Math.floor(fitH*zoomLevel);
  return {x:Math.max(0,(fitW-vw)/2+30),y:Math.max(0,(fitH-vh)/2+30)};
}
function clampPan(){const m=_getPanMax();panX=Math.max(-m.x,Math.min(m.x,panX));panY=Math.max(-m.y,Math.min(m.y,panY));}
function applyPan(){clampPan();syncCanvasSize();renderCanvasLabels();updateScrollbars();}
function updateScrollbars(){
  const hs=document.getElementById('vp-hscroll');
  const vs=document.getElementById('vp-vscroll');
  const ht=document.getElementById('vp-hthumb');
  const vt=document.getElementById('vp-vthumb');
  if(!hs||!vs) return;
  const refImg=gameImg||psImg;
  if(!refImg){hs.style.display='none';vs.style.display='none';return;}
  const vw=viewport.clientWidth,vh=viewport.clientHeight;
  const nw=refImg.naturalWidth,nh=refImg.naturalHeight;
  let fitW=vw,fitH=vw*nh/nw;
  if(fitH>vh){fitH=vh;fitW=vh*nw/nh;}
  fitW=Math.floor(fitW*zoomLevel);fitH=Math.floor(fitH*zoomLevel);
  const needH=fitW>vw,needV=fitH>vh;
  hs.style.display=needH?'block':'none';vs.style.display=needV?'block':'none';
  if(needH&&ht){const tw=hs.clientWidth;const tw2=Math.max(24,Math.round(vw/fitW*tw));
    const mx=Math.max(1,(fitW-vw)/2+30);
    ht.style.width=tw2+'px';ht.style.left=Math.max(0,Math.min(tw-tw2,Math.round((panX+mx)/(2*mx)*(tw-tw2))))+'px';}
  if(needV&&vt){const th=vs.clientHeight;const th2=Math.max(24,Math.round(vh/fitH*th));
    const my=Math.max(1,(fitH-vh)/2+30);
    vt.style.height=th2+'px';vt.style.top=Math.max(0,Math.min(th-th2,Math.round((panY+my)/(2*my)*(th-th2))))+'px';}
}
// Scrollbar thumb drag
(function(){
  let _drag=null,_sx,_sy,_px,_py;
  function _initThumb(id,axis){
    const el=document.getElementById(id);if(!el)return;
    el.addEventListener('mousedown',e=>{e.preventDefault();_drag=axis;_sx=e.clientX;_sy=e.clientY;_px=panX;_py=panY;});
  }
  window.addEventListener('load',()=>{_initThumb('vp-hthumb','x');_initThumb('vp-vthumb','y');});
  document.addEventListener('mousemove',e=>{
    if(!_drag)return;
    const m=_getPanMax();
    if(_drag==='x'){const hs=document.getElementById('vp-hscroll');if(!hs)return;
      panX=_px-(e.clientX-_sx)/hs.clientWidth*(2*m.x);applyPan();}
    else{const vs=document.getElementById('vp-vscroll');if(!vs)return;
      panY=_py-(e.clientY-_sy)/vs.clientHeight*(2*m.y);applyPan();}
  });
  document.addEventListener('mouseup',()=>{_drag=null;});
})();
viewport.addEventListener('wheel', e=>{
  e.preventDefault();
  if(e.ctrlKey){ canvasZoom(e.deltaY<0?1.1:0.9); }
  else { panX-=(e.deltaX||0)*0.8; panY-=e.deltaY*0.8; applyPan(); }
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

// ====== ONBOARDING GUIDE ======
let _guideTimer=null;
function showOnboardingGuide() {
  if(localStorage.getItem('guideShown')) return;
  const shot=document.getElementById('guide-screenshot');
  const drag=document.getElementById('guide-drag');
  if(shot) shot.style.display='block';
  if(drag) drag.style.display='block';
  _guideTimer=setTimeout(dismissGuide, 10000);
}
function _fadeOutGuide(el) {
  // Use computedStyle to correctly detect CSS display:none (not just inline style)
  if(!el) return;
  if(window.getComputedStyle(el).display==='none') return;
  el.style.transition='opacity .3s';
  el.style.opacity='0';
  setTimeout(()=>{el.style.display='none';el.style.opacity='';el.style.transition='';},300);
  // NOTE: do NOT set localStorage here — only dismissGuide() does that
}
function dismissGuide() {
  _fadeOutGuide(document.getElementById('guide-screenshot'));
  _fadeOutGuide(document.getElementById('guide-drag'));
  clearTimeout(_guideTimer);
  localStorage.setItem('guideShown','1');
}
// Called when user clicks screenshot tool — dismiss only screenshot hint
function _autoDismissGuide() {
  _fadeOutGuide(document.getElementById('guide-screenshot'));
}
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
  // ====== QA / Issues resizable divider ======
  (function(){
    const handle=document.getElementById('rp-divider');
    const qaPanel=document.getElementById('qa-panel');
    const reportPanel=document.getElementById('report-panel');
    if(!handle||!qaPanel||!reportPanel) return;
    let dragging=false, startY=0, startH=0;
    handle.addEventListener('mousedown',e=>{
      dragging=true; startY=e.clientY; startH=qaPanel.offsetHeight;
      handle.classList.add('rp-dragging');
      document.body.style.cursor='ns-resize';
      e.preventDefault();
    });
    document.addEventListener('mousemove',e=>{
      if(!dragging) return;
      const dy=e.clientY-startY;
      const minH=60, maxH=reportPanel.offsetHeight-120;
      const newH=Math.max(minH,Math.min(maxH,startH+dy));
      qaPanel.style.height=newH+'px';
    });
    document.addEventListener('mouseup',()=>{
      if(dragging){dragging=false;handle.classList.remove('rp-dragging');document.body.style.cursor='';}
    });
  })();
});
window.addEventListener('resize', () => {
  syncCanvasSize();
  if(isActive) renderCurrentMode();
});
document.addEventListener('click', e => {
  if(!e.target.closest('.export-split') && !e.target.closest('#export-dropdown')) closeExportDropdown();
});
