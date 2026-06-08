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
function openModal(id) { document.getElementById(id).classList.add('open'); if(id==='modal-ai') syncAIConfigToForm(); if(id==='modal-settings') _syncLinkConfigToForm(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ====== CLEAR ======
function clearAll() {
  if(!confirm('确认清空所有内容？')) return;
  clearImage('game',null); clearImage('ps',null);
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

// ====== 链接配置（localStorage 持久化）======
const LINK_CONFIG_KEY = 'ui_tool_link_config';
const LINK_CONFIG_DEFAULTS = {
  resourceLib: 'http://10.225.139.192/#/mockup',
  gameCapture:  'http://10.225.12.103/LayaMobile/',
  jira:         'http://jira.sanguosha.com:8080/secure/CreateIssue!default.jspa'
};

function getLinkConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(LINK_CONFIG_KEY) || '{}');
    return { ...LINK_CONFIG_DEFAULTS, ...saved };
  } catch(e) {
    return { ...LINK_CONFIG_DEFAULTS };
  }
}

function _syncLinkConfigToForm() {
  const cfg = getLinkConfig();
  const rl = document.getElementById('cfg-resource-lib');
  const gc = document.getElementById('cfg-game-capture');
  const jr = document.getElementById('cfg-jira');
  if (rl) rl.value = cfg.resourceLib;
  if (gc) gc.value = cfg.gameCapture;
  if (jr) jr.value = cfg.jira;
}

function saveLinkConfig() {
  const val = k => (document.getElementById(k)?.value.trim() || '');
  const cfg = {
    resourceLib: val('cfg-resource-lib') || LINK_CONFIG_DEFAULTS.resourceLib,
    gameCapture: val('cfg-game-capture') || LINK_CONFIG_DEFAULTS.gameCapture,
    jira:        val('cfg-jira')         || LINK_CONFIG_DEFAULTS.jira
  };
  localStorage.setItem(LINK_CONFIG_KEY, JSON.stringify(cfg));
  // 同步回表单（补上空白时自动填入的默认值）
  _syncLinkConfigToForm();
  const btn = document.querySelector('#modal-settings .form-btn');
  if (btn) { const t = btn.textContent; btn.textContent = '✅ 已保存'; setTimeout(() => btn.textContent = t, 1200); }
}

function resetLinkField(key) {
  const ids = { resourceLib: 'cfg-resource-lib', gameCapture: 'cfg-game-capture', jira: 'cfg-jira' };
  const el = document.getElementById(ids[key]);
  if (el) el.value = LINK_CONFIG_DEFAULTS[key];
}

function exportLinkConfig() {
  const cfg = getLinkConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'uicheack-config.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importLinkConfig(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const cfg = JSON.parse(ev.target.result);
      // 只保留已知字段，防止污染
      const safe = {};
      ['resourceLib','gameCapture','jira'].forEach(k => { if (cfg[k]) safe[k] = cfg[k]; });
      localStorage.setItem(LINK_CONFIG_KEY, JSON.stringify({ ...LINK_CONFIG_DEFAULTS, ...safe }));
      _syncLinkConfigToForm();
      alert('✅ 配置导入成功');
    } catch(err) {
      alert('❌ 配置文件格式错误，请检查是否为合法 JSON');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ====== PLUGIN TUTORIAL MODAL ======
function switchPluginTab(tab) {
  document.querySelectorAll('.plugin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.plugin-tab-btn[onclick*="${tab}"]`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.plugin-tab-content').forEach(content => content.style.display = 'none');
  document.getElementById(`plugin-tab-${tab}`).style.display = 'block';
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
  initQATags();
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

// ====== 原图查看：独立弹出窗口（可拖至浏览器外任意位置）======
let _icfWin = null;

function _imgToDataUrl(img, maxW) {
  if (!img) return '';
  const scale = maxW ? Math.min(1, maxW / img.naturalWidth) : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.88);
}

function toggleImgCompareFloat() {
  const btn = document.getElementById('btn-img-compare');
  // 若窗口已打开则聚焦
  if (_icfWin && !_icfWin.closed) { _icfWin.focus(); return; }
  if (!psImg && !gameImg) return;

  // 图片转 dataURL（限宽 1920 避免传输过大）
  const psUrl   = _imgToDataUrl(psImg,   1920);
  const gameUrl = _imgToDataUrl(gameImg, 1920);

  const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<title>原图对比</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d1d;color:#ccc;font-family:"PingFang SC","Microsoft YaHei",sans-serif;display:flex;flex-direction:column;height:100vh;overflow:hidden}
.hd{background:#12121e;border-bottom:1px solid #2a2a3a;padding:8px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.hd-title{font-size:12px;font-weight:600;flex:1}
.zoom-row{display:flex;gap:4px}
.zb{background:#1e1e2e;border:1px solid #333;color:#888;padding:3px 9px;border-radius:4px;cursor:pointer;font-size:10px;transition:all .12s}
.zb:hover{background:#2a2a3a;color:#ccc}
.zb.on{background:#007AFF33;border-color:#007AFF88;color:#4a9eff}
.bd{display:flex;flex-direction:column;flex:1;overflow:auto;padding:12px;gap:12px;align-items:center}
.row{display:flex;flex-direction:column;align-items:flex-start;gap:6px;flex-shrink:0}
.row img{display:block;border-radius:4px;max-width:none}
.lbl{font-size:10px;font-weight:600;padding:2px 8px;border-radius:3px}
.lbl-ps{color:#a29bfe;background:rgba(162,155,254,.15)}
.lbl-gm{color:#4ecca3;background:rgba(78,204,163,.15)}
.dv{height:1px;background:#2a2a3a;width:100%;flex-shrink:0}
</style></head><body>
<div class="hd">
  <span class="hd-title">◧ 原图对比</span>
  <div class="zoom-row">
    <button class="zb" onclick="sz(0.5)">×0.5</button>
    <button class="zb on" onclick="sz(1)">×1</button>
    <button class="zb" onclick="sz(1.5)">×1.5</button>
    <button class="zb" onclick="sz(2)">×2</button>
  </div>
</div>
<div class="bd">
  ${psUrl   ? `<div class="row"><div class="lbl lbl-ps">设计稿</div><img id="ps" src="${psUrl}"></div>` : ''}
  ${psUrl && gameUrl ? '<div class="dv"></div>' : ''}
  ${gameUrl ? `<div class="row"><div class="lbl lbl-gm">游戏截图</div><img id="gm" src="${gameUrl}"></div>` : ''}
</div>
<script>
var baseW=0;
window.onload=function(){
  var p=document.getElementById('ps'), g=document.getElementById('gm');
  baseW=Math.max(p?p.naturalWidth:0, g?g.naturalWidth:0);
  if(!baseW) return;
  // 计算让两图全部可见的初始缩放：取宽、高两个方向的最小缩放比
  var hd=document.querySelector('.hd');
  var availW=window.innerWidth-24;                          // 左右 padding
  var availH=window.innerHeight-(hd?hd.offsetHeight:44)-24-12-1; // 上下 padding + gap + divider
  // 两图在 baseW 下各自的高度
  var psH  = p ? Math.round(baseW*p.naturalHeight/p.naturalWidth)  : 0;
  var gmH  = g ? Math.round(baseW*g.naturalHeight/g.naturalWidth)  : 0;
  var totalH = psH + gmH;
  var scaleW = availW / baseW;
  var scaleH = totalH>0 ? availH/totalH : 1;
  var initScale = Math.min(scaleW, scaleH, 1); // 不超过 ×1
  applyW(Math.round(baseW*initScale));
};
function applyW(w){
  var p=document.getElementById('ps'),g=document.getElementById('gm');
  if(p) p.style.width=w+'px';
  if(g) g.style.width=w+'px';
}
function sz(z){
  document.querySelectorAll('.zb').forEach(function(b){b.classList.remove('on')});
  event.target.classList.add('on');
  applyW(Math.round(baseW*z));
}
<\/script>
</body></html>`;

  const sw = Math.min(screen.availWidth, 1000);
  const sh = Math.min(screen.availHeight, 700);
  const sx = Math.round((screen.availWidth - sw) / 2);
  const sy = Math.round((screen.availHeight - sh) / 2);
  _icfWin = window.open('', 'ui-img-compare',
    `width=${sw},height=${sh},left=${sx},top=${sy},resizable=yes,scrollbars=yes`);
  if (!_icfWin) { alert('请在浏览器设置中允许弹出窗口，然后再试'); return; }
  _icfWin.document.open();
  _icfWin.document.write(html);
  _icfWin.document.close();
  if (btn) btn.classList.add('active');

  // 窗口关闭时重置按钮状态
  const checkClosed = setInterval(() => {
    if (_icfWin.closed) { clearInterval(checkClosed); if(btn) btn.classList.remove('active'); }
  }, 800);
}

// 拖拽浮窗（保留旧代码兼容，此处不再使用）
(function initIcfDrag() {
  document.addEventListener('DOMContentLoaded', () => {});
})();
