'use strict';
// ====== UPLOAD ======
function selectPasteTarget(type) {
  pasteTarget=type;
  updatePasteTargetUI();
}
function updatePasteTargetUI(){
  document.querySelectorAll('.vp-upload-zone').forEach(el=>el.classList.remove('paste-target'));
  if(!pasteTarget) return;
  const vz=document.getElementById(pasteTarget==='ps'?'vz-ps':'vz-game');
  if(vz&&!(pasteTarget==='game'?gameImg:psImg)) vz.classList.add('paste-target');
}
function triggerUpload(type) { document.getElementById('file-input-'+type).click(); }
function handleFileInput(e, type) { const f=e.target.files[0]; if(f) loadImageFile(f,type); e.target.value=''; }
function onDragOver(e) { e.preventDefault(); e.stopPropagation(); }
function onDrop(e, type) { e.preventDefault(); e.stopPropagation(); const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith('image/')) loadImageFile(f,type); }
function vzDragOver(e, el) { e.preventDefault(); e.stopPropagation(); el.classList.add('drag-over'); }
function vzDragLeave(el) { el.classList.remove('drag-over'); }
function vzDrop(e, type) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith('image/')) loadImageFile(f,type); }

function bindPaste() {
  document.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if(!items) return;
    for(let i=0;i<items.length;i++) {
      if(items[i].type.startsWith('image/')) {
        // Must have a paste target selected, or auto-detect from loaded state
        let type;
        if(!gameImg&&psImg) type='game';
        else if(!psImg&&gameImg) type='ps';
        else if(pasteTarget) type=pasteTarget;
        else return; // no target selected, ignore paste
        const vzId=type==='ps'?'vz-ps':'vz-game';
        const vz=document.getElementById(vzId);
        if(vz){vz.classList.add('drag-over');setTimeout(()=>vz.classList.remove('drag-over'),600);}
        loadImageFile(items[i].getAsFile(), type);
        // Auto-switch paste target to the other slot
        if(type==='game'&&!psImg) pasteTarget='ps';
        else if(type==='ps'&&!gameImg) pasteTarget='game';
        setTimeout(updatePasteTargetUI,100);
        break;
      }
    }
  });
}

function loadImageFile(file, type) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if(type==='game') {
      gameImg=img;
      gameLayer.onload=null;
      gameLayer.src=url;
      gameLayer.style.visibility='visible';
      const th=document.getElementById('thumb-game'); th.src=url;
      document.getElementById('box-game').classList.add('loaded');
    } else {
      psImg=img;
      psLayer.src=url;
      psLayer.style.visibility='visible';
      const th=document.getElementById('thumb-ps'); th.src=url;
      document.getElementById('box-ps').classList.add('loaded');
    }
    setTimeout(syncCanvasSize,80);
    checkGuide();
  };
  img.src=url;
}

function clearImage(type, e) {
  e&&e.stopPropagation();
  if(type==='game') {
    gameImg=null; gameLayer.src=''; gameLayer.style.visibility='hidden';
    document.getElementById('thumb-game').src='';
    document.getElementById('box-game').classList.remove('loaded');
  } else {
    psImg=null; psLayer.src=''; psLayer.style.visibility='hidden';
    document.getElementById('thumb-ps').src='';
    document.getElementById('box-ps').classList.remove('loaded');
  }
  syncCanvasSize(); checkGuide();
}

function checkGuide() {
  const vzGame=document.getElementById('vz-game');
  const vzPs=document.getElementById('vz-ps');
  const prevGame=document.getElementById('vz-preview-game');
  const prevPs=document.getElementById('vz-preview-ps');
  if(vzGame) vzGame.classList.toggle('loaded',!!gameImg);
  if(vzPs) vzPs.classList.toggle('loaded',!!psImg);
  if(prevGame) prevGame.src=gameImg?gameLayer.src:'';
  if(prevPs) prevPs.src=psImg?psLayer.src:'';
  const bothNow=!!(gameImg&&psImg);
  const startBtn=document.getElementById('btn-start-compare');
  if(startBtn) {
    startBtn.disabled=!bothNow;
    startBtn.classList.toggle('cta-ready', bothNow && !isActive);
  }
  updateUploadGuide();
  updatePasteTargetUI();
}
function updateUploadGuide(){
  const ug=document.getElementById('upload-guide');
  if(ug) ug.style.display=isActive?'none':'flex';
  // When upload guide is visible, disable clickCanvas so zones are clickable/droppable
  clickCanvas.style.pointerEvents=isActive?'auto':'none';
  layers.style.display='none';
}

function onPSOpacity(el) {
  psLayer.style.opacity=el.value;
  document.getElementById('ps-opacity-label').textContent='透明度 '+Math.round(el.value*100)+'%';
}

// ====== CANVAS SYNC ======
function syncCanvasSize() {
  const refImg=gameImg||psImg;
  if(!refImg) { layers.style.width='0'; layers.style.height='0'; return false; }
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  const nw=refImg.naturalWidth, nh=refImg.naturalHeight;
  if(!nw||!nh) return false;
  let w=vw, h=vw*nh/nw;
  if(h>vh){h=vh;w=vh*nw/nh;}
  w=Math.floor(w*zoomLevel); h=Math.floor(h*zoomLevel);
  if(!w||!h) return false;
  layers.style.width=w+'px'; layers.style.height=h+'px';
  gameLayer.style.width='100%'; gameLayer.style.height='100%';
  psLayer.style.width='100%'; psLayer.style.height='100%';
  // markCanvas stays inside #layers (image-space, for diff/outline/findiff)
  if(markCanvas.width!==nw||markCanvas.height!==nh){markCanvas.width=nw;markCanvas.height=nh;}
  markCanvas.style.width='100%'; markCanvas.style.height='100%';
  markCanvas.style.position='absolute'; markCanvas.style.top='0'; markCanvas.style.left='0';
  // anno-canvas and click-canvas cover the full viewport (for annotations beyond image bounds)
  const avw=viewport.clientWidth, avh=viewport.clientHeight;
  if(annoCanvas.width!==avw||annoCanvas.height!==avh){annoCanvas.width=avw;annoCanvas.height=avh;}
  if(clickCanvas.width!==avw||clickCanvas.height!==avh){clickCanvas.width=avw;clickCanvas.height=avh;}
  if(mGenCanvas.width!==nw||mGenCanvas.height!==nh){
    mGenCanvas.width=nw; mGenCanvas.height=nh;
    mGenCtx.fillStyle='#fff'; mGenCtx.fillRect(0,0,nw,nh);
  }
  canvasScale=nw/w;
  annoCanvasScale=1;
  layers.style.transform=`translate(${panX}px,${panY}px)`; // apply pan offset
  drawAnnos();
  zoomInfo.textContent=Math.round(zoomLevel/(typeof ZOOM_BASE!=='undefined'?ZOOM_BASE:0.7)*100)+'%';
  return true;
}
// ============================================================
// ==========================================
// 插件通信接收器 (纯净版)
window.addEventListener("message", (e) => {
  if (!e.data) return;

  // 1. 响应状态查询：多重判定法
  if (e.data.type === "UI_TOOL_PING") {
    const comparePanel = document.getElementById('panel-compare');
    const compareBtn = document.getElementById('btn-start-compare');
    
    // 判定方法 1：检查对比面板的实际计算样式（解决 CSS 类名判定失效问题）
    let isVisible = false;
    if (comparePanel) {
      const style = window.getComputedStyle(comparePanel);
      isVisible = style.display !== 'none' && style.visibility !== 'hidden';
    }

    // 判定方法 2：检查按钮文字是否为“停止对比”
    const isStopMode = compareBtn && (compareBtn.innerText.includes('停止') || compareBtn.innerText.includes('Stop'));

    // 只要满足其中一个条件，就告诉插件“我很忙”
    const isBusy = isVisible || isStopMode;
    
    console.log(`[UI助手] 当前忙碌状态判定: ${isBusy}`);
    window.postMessage({ type: "UI_TOOL_PONG", isComparing: isBusy }, "*");
  }

  // 2. 接收并渲染图片（保持不变）
  if (e.data.type === "UI_TOOL_RENDER") {
    const { base64, target } = e.data;
    const input = document.getElementById(`file-input-${target}`);
    if (!input || !base64) return;

    fetch(base64).then(res => res.blob()).then(blob => {
      const file = new File([blob], `auto_${Date.now()}.png`, { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(err => console.error("渲染失败:", err));
  }
});