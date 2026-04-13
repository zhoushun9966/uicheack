'use strict';
const PLACEHOLDER_TEXT = '请描述问题';
const CROP_COLORS = ['#007AFF','#ff4757','#4ecca3','#ffc107','#a29bfe'];
let cropColorIndex = 0;
// ====== QA TAG LIBRARY ======
function renderQAPanel() {
  const container=document.getElementById('qa-scroll'); if(!container) return;
  const dis=isActive?'':'disabled';
  let html='';
  QA_TAGS.forEach(cat=>{
    html+=`<div class="qa-category">
      <div class="qa-cat-label">${cat.cat}</div>
      <div class="qa-tags-row">`;
    cat.tags.forEach(tag=>{
      html+=`<span class="qa-tag ${cat.cls} ${dis}" draggable="${isActive}" data-tag="${tag}" data-cls="${cat.cls}"
        ondragstart="onTagDragStart(event)">${tag}</span>`;
    });
    html+='</div></div>';
  });
  container.innerHTML=html;
}
function toggleQAPanel(){
  const scroll=document.getElementById('qa-scroll');
  const btn=document.querySelector('.qa-toggle');
  const qaPanel=document.getElementById('qa-panel');
  if(!scroll||!btn) return;
  const isHidden=scroll.style.display==='none';
  scroll.style.display=isHidden?'':'none';
  btn.textContent=isHidden?'收起':'展开';
  // When collapsed, shrink qa-panel to header only so issues drawer fills remaining space
  if(qaPanel) qaPanel.style.height=isHidden?'':'auto';
}
function updateQATagsState(){
  document.querySelectorAll('.qa-tag').forEach(el=>{
    if(isActive){ el.classList.remove('disabled'); el.draggable=true; }
    else{ el.classList.add('disabled'); el.draggable=false; }
  });
}
let dragTagData=null;
function onTagDragStart(e){
  if(typeof _fadeOutGuide==='function') _fadeOutGuide(document.getElementById('guide-drag'));
  dragTagData={tag:e.target.dataset.tag, cls:e.target.dataset.cls};
  e.dataTransfer.effectAllowed='copy';
}
// Viewport: accept dropped tags or image files
viewport.addEventListener('dragover',e=>{
  e.preventDefault();
  // If dragging files, highlight upload zone based on cursor position
  if(e.dataTransfer.types.includes('Files')){
    e.dataTransfer.dropEffect='copy';
    document.querySelectorAll('.vp-upload-zone.drag-over').forEach(el=>el.classList.remove('drag-over'));
    const vzPS=document.getElementById('vz-ps'), vzGame=document.getElementById('vz-game');
    if(vzPS&&vzGame){
      const mid=viewport.getBoundingClientRect().top+viewport.clientHeight/2;
      const vz=e.clientY<mid?vzPS:vzGame;
      vz.classList.add('drag-over');
    }
  } else {
    e.dataTransfer.dropEffect='copy';
  }
});
viewport.addEventListener('dragleave',e=>{
  // Clean up drag-over when leaving viewport
  if(!viewport.contains(e.relatedTarget)){
    document.querySelectorAll('.vp-upload-zone.drag-over').forEach(el=>el.classList.remove('drag-over'));
  }
});
viewport.addEventListener('drop',e=>{
  e.preventDefault();
  // Check for image file drops first
  document.querySelectorAll('.vp-upload-zone.drag-over').forEach(el=>el.classList.remove('drag-over'));
  const files=e.dataTransfer.files;
  if(files&&files.length>0&&files[0].type.startsWith('image/')){
    // Determine slot: if one is empty auto-fill it; otherwise use cursor position (top=ps, bottom=game)
    let type;
    if(!gameImg&&psImg) type='game';
    else if(!psImg&&gameImg) type='ps';
    else if(!gameImg&&!psImg){
      const mid=viewport.getBoundingClientRect().top+viewport.clientHeight/2;
      type=e.clientY<mid?'ps':'game';
    } else { type=pasteTarget||'game'; }
    loadImageFile(files[0],type);
    return;
  }
  if(!dragTagData) return;
  const r=viewport.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top;
  addCanvasLabel(dragTagData.tag, dragTagData.cls, x, y);
  dragTagData=null;
});

// ====== CANVAS LABELS ======
let labelCounter = 0;
const TAG_CLS_COLORS={'cat-layout':'#007AFF','cat-size':'#00b894','cat-color':'#a29bfe','cat-text':'#ffc107','cat-asset':'#fd79a8'};
function getImageBounds() {
  const refImg=gameImg||psImg;
  if(!refImg) return null;
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  const nw=refImg.naturalWidth, nh=refImg.naturalHeight;
  let w=vw, h=vw*nh/nw;
  if(h>vh){h=vh;w=vh*nw/nh;}
  w=Math.floor(w*zoomLevel); h=Math.floor(h*zoomLevel);
  const ox=(vw-w)/2, oy=(vh-h)/2;
  return {left:ox, top:oy, right:ox+w, bottom:oy+h};
}
function placeLabelOutside(sMinX, sMinY, sMaxX, sMaxY) {
  const ib=getImageBounds();
  if(!ib) return {x:Math.max(10,sMinX), y:Math.max(6,sMinY-80)};
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  // Label is CSS-scaled by zoomLevel from top-left, so visual dimensions scale with zoom
  const s=Math.max(0.35,Math.min(2.5,zoomLevel/ZOOM_BASE));
  const vLabelW=140*s, vLabelH=30*s; // visual size
  const gap=Math.round(10*s);
  const cx=(sMinX+sMaxX)/2, cy=(sMinY+sMaxY)/2;
  const dTop=sMinY-ib.top, dBottom=ib.bottom-sMaxY;
  const dLeft=sMinX-ib.left, dRight=ib.right-sMaxX;
  const minD=Math.min(dTop,dBottom,dLeft,dRight);
  let lx, ly;
  if(minD===dTop){
    // Position label above image; center horizontally on annotation center
    lx=Math.max(4, Math.min(cx-vLabelW/2, vw-vLabelW-4));
    ly=Math.max(4, ib.top-vLabelH-gap);
  } else if(minD===dBottom){
    lx=Math.max(4, Math.min(cx-vLabelW/2, vw-vLabelW-4));
    ly=Math.min(vh-vLabelH-4, ib.bottom+gap);
  } else if(minD===dLeft){
    lx=Math.max(4, ib.left-vLabelW-gap);
    ly=Math.max(4, Math.min(cy-vLabelH/2, vh-vLabelH-4));
  } else {
    lx=Math.min(vw-vLabelW-4, ib.right+gap);
    ly=Math.max(4, Math.min(cy-vLabelH/2, vh-vLabelH-4));
  }
  return {x:lx, y:ly};
}
function addCanvasLabel(text, cls, tx, ty) {
  saveHist();
  const id='cl'+Date.now()+Math.random().toString(36).slice(2,6);
  labelCounter++;
  // Label placed outside the image area, nearest edge
  const _lp=placeLabelOutside(tx, ty, tx, ty);
  const labelX=_lp.x, labelY=_lp.y;
  const tagColor=TAG_CLS_COLORS[cls]||labelProps.color;
  const dc=deriveLabelColors(tagColor);
  canvasLabels.push({id, text:'#'+labelCounter+' '+text, cls, x:labelX, y:labelY, tx:tx, ty:ty,
    sx:tx, sy:ty, shape:'none', lw:2, color:tagColor,
    bgColor:dc.bgColor, textColor:dc.textColor, lineColor:dc.lineColor});
  renderCanvasLabels();
}
function renderCanvasLabels() {
  document.querySelectorAll('.canvas-label,.cl-target-dot,.cl-shape-anchor,.label-crop-panel').forEach(el=>el.remove());
  canvasLabels.forEach(lb=>{
    const _hasRect=lb.shape==='rect'&&lb.sx!=null&&Math.abs(lb.tx-lb.sx)>8&&Math.abs(lb.ty-lb.sy)>8;
    const _hasCrops=_hasRect&&gameImg&&psImg;
    const _editingInFloat=lb.id===selectedLabelId&&_hasCrops;
    // When selected+crops: float card is the editing UI, skip canvas-label to avoid overlap
    if(!_editingInFloat){
      const el=document.createElement('div');
      el.className='canvas-label '+lb.cls;
      el.id='cl-'+lb.id;
    el.style.left=(lb.x+panX)+'px'; el.style.top=(lb.y+panY)+'px';
    // Scale the label card visually with zoom (text + border + padding all scale together)
    const _s=Math.max(0.35,Math.min(2.5,zoomLevel/ZOOM_BASE));
    el.style.transformOrigin='top left';
    el.style.transform=`scale(${_s})`;
    if(lb.bgColor) el.style.background=lb.bgColor;
    if(lb.textColor) el.style.color=lb.textColor;
    if(lb.bgColor) el.style.borderColor=lb.textColor||'#007AFF';
    if(lb.id===selectedLabelId) el.style.outline='2px solid #ffeb3b';
    // Split #N prefix from description
    const _nm=lb.text.match(/^(#\d+)\s*(.*)/s);
    const _numPart=_nm?_nm[1]:'';
    const _descPart=_nm?_nm[2].trim():lb.text;
    const _isPlaceholder=!_descPart||_descPart===PLACEHOLDER_TEXT;
    const _displayDesc=_isPlaceholder?PLACEHOLDER_TEXT:_descPart;
    el.innerHTML=`<span class="cl-delete" onclick="removeCanvasLabel('${lb.id}')">✕</span>
      <span class="cl-num">${_numPart}</span>
      <span class="cl-text${_isPlaceholder?' cl-placeholder':''}" contenteditable="true" spellcheck="false"
        onfocus="clTextFocus(this)"
        onblur="updateCanvasLabelText('${lb.id}',this.textContent)"
        onkeydown="if(event.key==='Enter'){event.preventDefault();commitLabelText('${lb.id}',this)}"
        >${_displayDesc}</span>`;
    makeLabelDraggable(el, lb, 'label');
    viewport.appendChild(el);
    if(!lb.shape||lb.shape==='none'){
      const dot=document.createElement('div');
      dot.className='cl-target-dot'; dot.id='cld-'+lb.id;
      dot.style.left=(lb.tx+panX-5)+'px'; dot.style.top=(lb.ty+panY-5)+'px';
      if(lb.lineColor){dot.style.borderColor=lb.lineColor.replace(/[0-9a-f]{2}$/i,'ff');}
      dot.style.transformOrigin='center';
      dot.style.transform=`scale(${Math.max(0.35,Math.min(2.5,zoomLevel/ZOOM_BASE))})`;
      makeLabelDraggable(dot, lb, 'target');
      viewport.appendChild(dot);
    }
    } // end if(!_editingInFloat)
    // Shape anchors always shown when selected (even in float-editing mode)
    if(lb.id===selectedLabelId && lb.shape && lb.shape!=='none' && lb.sx!=null){
      if(lb.shape==='rect'||lb.shape==='circle'){
        [{px:'sx',py:'sy',cx:'nwse'},{px:'tx',py:'sy',cx:'nesw'},{px:'sx',py:'ty',cx:'nesw'},{px:'tx',py:'ty',cx:'nwse'}].forEach(h=>{
          const a=document.createElement('div'); a.className='cl-shape-anchor';
          a.style.left=(lb[h.px]+panX-5)+'px'; a.style.top=(lb[h.py]+panY-5)+'px'; a.style.cursor=h.cx+'-resize';
          makeShapeAnchorDraggable(a, lb, h.px, h.py); viewport.appendChild(a);
        });
      } else if(lb.shape==='arrow'){
        [{px:'sx',py:'sy'},{px:'tx',py:'ty'}].forEach(h=>{
          const a=document.createElement('div'); a.className='cl-shape-anchor';
          a.style.left=(lb[h.px]+panX-5)+'px'; a.style.top=(lb[h.py]+panY-5)+'px';
          a.style.cursor='move'; a.style.borderRadius='50%';
          makeShapeAnchorDraggable(a, lb, h.px, h.py); viewport.appendChild(a);
        });
      }
    }
  });
  drawAnnos();
  renderIssuesDrawer();
  syncActiveCropFloat();
}
function drawLabelArrowsOnly() {
  if(!annoCtx) return;
  canvasLabels.forEach(lb=>{
    const el=document.getElementById('cl-'+lb.id); // null for merged rect labels
    const lc=lb.lineColor||'#ffffff88';
    const sh=lb.shape||'none';
    annoCtx.save();
    annoCtx.strokeStyle=lc;
    annoCtx.lineWidth=lb.lw||2;
    // Apply shape opacity (default 35%)
    const shapeAlpha = lb.opacity!=null ? lb.opacity : 0.35;
    // All shape outlines use dashed lines
    annoCtx.setLineDash([6,3]);
    annoCtx.globalAlpha=shapeAlpha;
    if(sh==='rect' && lb.sx!=null){
      annoCtx.beginPath(); annoCtx.strokeRect(lb.sx,lb.sy,lb.tx-lb.sx,lb.ty-lb.sy);
      // Viewfinder corner marks: shown when no screenshot yet (no images loaded)
      const hasCrops=gameImg&&psImg;
      if(!hasCrops){
        const x1=Math.min(lb.sx,lb.tx), y1=Math.min(lb.sy,lb.ty);
        const x2=Math.max(lb.sx,lb.tx), y2=Math.max(lb.sy,lb.ty);
        const cl=Math.min(14, Math.abs(x2-x1)*0.18, Math.abs(y2-y1)*0.18);
        annoCtx.setLineDash([]);
        annoCtx.globalAlpha=0.9;
        annoCtx.lineWidth=(lb.lw||2)*1.4;
        annoCtx.strokeStyle=lc.length>7?lc.slice(0,7)+'ff':lc;
        annoCtx.beginPath();
        annoCtx.moveTo(x1,y1+cl); annoCtx.lineTo(x1,y1); annoCtx.lineTo(x1+cl,y1); // top-left
        annoCtx.moveTo(x2-cl,y1); annoCtx.lineTo(x2,y1); annoCtx.lineTo(x2,y1+cl); // top-right
        annoCtx.moveTo(x1,y2-cl); annoCtx.lineTo(x1,y2); annoCtx.lineTo(x1+cl,y2); // bottom-left
        annoCtx.moveTo(x2-cl,y2); annoCtx.lineTo(x2,y2); annoCtx.lineTo(x2,y2-cl); // bottom-right
        annoCtx.stroke();
        annoCtx.setLineDash([6,3]);
        annoCtx.globalAlpha=shapeAlpha;
        annoCtx.lineWidth=lb.lw||2;
        annoCtx.strokeStyle=lc;
      }
    } else if(sh==='circle' && lb.sx!=null){
      const cx=(lb.sx+lb.tx)/2, cy=(lb.sy+lb.ty)/2;
      const rx=Math.abs(lb.tx-lb.sx)/2, ry=Math.abs(lb.ty-lb.sy)/2;
      annoCtx.beginPath(); annoCtx.ellipse(cx,cy,rx||1,ry||1,0,0,Math.PI*2); annoCtx.stroke();
    } else if(sh==='arrow' && lb.sx!=null){
      annoCtx.setLineDash([]);
      drawArrow(annoCtx,lb.sx,lb.sy,lb.tx,lb.ty,lb.lw||2);
    }
    annoCtx.setLineDash([]);
    annoCtx.globalAlpha=1; // restore before drawing connector
    // Compute connector: from shape edge → label (or crop panel for merged rect)
    let fromX, fromY, toX, toY;
    if((sh==='rect'||sh==='circle') && lb.sx!=null){
      const sMinX=Math.min(lb.sx,lb.tx), sMaxX=Math.max(lb.sx,lb.tx);
      const sMinY=Math.min(lb.sy,lb.ty), sMaxY=Math.max(lb.sy,lb.ty);
      const sMidX=(sMinX+sMaxX)/2, sMidY=(sMinY+sMaxY)/2;
      if(el){
        const lblCX=lb.x+el.offsetWidth/2, lblCY=lb.y+el.offsetHeight/2;
        const dx=Math.abs(lblCX-sMidX), dy=Math.abs(lblCY-sMidY);
        if(dy>dx){ fromX=sMidX; fromY=lblCY<sMidY?sMinY:sMaxY; }
        else { fromY=sMidY; fromX=lblCX<sMidX?sMinX:sMaxX; }
        toX=lb.x; toY=lb.y+el.offsetHeight/2;
      } else { annoCtx.restore(); return; }
    } else if(sh==='arrow' && lb.sx!=null){
      fromX=lb.sx; fromY=lb.sy;
      if(el){ toX=lb.x; toY=lb.y+el.offsetHeight/2; }
      else { annoCtx.restore(); return; }
    } else {
      fromX=lb.tx; fromY=lb.ty;
      if(el){ toX=lb.x; toY=lb.y+el.offsetHeight/2; }
      else { annoCtx.restore(); return; }
    }
    const dist=Math.sqrt((toX-fromX)**2+(toY-fromY)**2);
    if(dist>5){
      annoCtx.strokeStyle=lc;
      annoCtx.lineWidth=Math.max(1,(lb.lw||2)*0.75);
      annoCtx.setLineDash([4,3]);
      annoCtx.beginPath(); annoCtx.moveTo(fromX,fromY); annoCtx.lineTo(toX,toY); annoCtx.stroke();
      annoCtx.setLineDash([]);
    }
    if(sh==='none'){
      const angle=Math.atan2(fromY-toY,fromX-toX);
      const hl=8;
      annoCtx.fillStyle=lc.length>7?lc.slice(0,7)+'cc':lc;
      annoCtx.beginPath();
      annoCtx.moveTo(fromX,fromY);
      annoCtx.lineTo(fromX-hl*Math.cos(angle-0.4),fromY-hl*Math.sin(angle-0.4));
      annoCtx.lineTo(fromX-hl*Math.cos(angle+0.4),fromY-hl*Math.sin(angle+0.4));
      annoCtx.closePath(); annoCtx.fill();
    }
    annoCtx.restore();
  });
}
function removeCanvasLabel(id){
  canvasLabels=canvasLabels.filter(l=>l.id!==id);
  document.getElementById('cl-'+id)?.remove();
  document.getElementById('cld-'+id)?.remove();
  removeLabelCropPanel(id);
  if(selectedLabelId===id) selectedLabelId=null;
  renumberLabels();
  renderCanvasLabels();
  renderPropPanel();
}
function renumberLabels(){
  canvasLabels.forEach((lb,i)=>{
    const num=i+1;
    // Replace existing #N prefix or add one
    lb.text=lb.text.replace(/^#\d+\s*/,'');
    lb.text='#'+num+' '+lb.text;
  });
  labelCounter=canvasLabels.length;
}
function updateCanvasLabelText(id, newText) {
  const idx=canvasLabels.findIndex(l=>l.id===id);
  if(idx<0) return;
  const desc=newText.trim();
  const isPlaceholder=!desc||desc===PLACEHOLDER_TEXT;
  canvasLabels[idx].text='#'+(idx+1)+' '+(isPlaceholder?PLACEHOLDER_TEXT:desc);
  // Update placeholder class on span without full re-render
  const el=document.getElementById('cl-'+id);
  if(el){
    const t=el.querySelector('.cl-text');
    if(t){
      if(isPlaceholder){t.textContent=PLACEHOLDER_TEXT;t.classList.add('cl-placeholder');}
      else{t.classList.remove('cl-placeholder');}
    }
  }
}
function clTextFocus(el) {
  if(el.textContent.trim()===PLACEHOLDER_TEXT){
    el.textContent='';
    el.classList.remove('cl-placeholder');
  }
}
// Enter in canvas label text: save + deselect (consistent with 悬浮卡 "完成" behavior)
function commitLabelText(id, el) {
  updateCanvasLabelText(id, el.textContent);
  if(!activeTool){
    selectedLabelId=null;
    hideActiveCropFloat();
    renderCanvasLabels();
    renderPropPanel();
  }
}
function makeLabelDraggable(el, lb, mode){
  let startX,startY,startLx,startLy,dragging=false,hasMoved=false;
  el.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('cl-delete')||e.target.classList.contains('cl-text')||e.target.classList.contains('cl-num')) return;
    e.preventDefault(); e.stopPropagation(); dragging=true; hasMoved=false;
    startX=e.clientX; startY=e.clientY;
    if(mode==='label'){ startLx=lb.x; startLy=lb.y; }
    else{ startLx=lb.tx; startLy=lb.ty; }
    // Select label on mousedown (for visual feedback)
    if(selectedLabelId!==lb.id){
      selectedLabelId=lb.id;
      labelProps.color=lb.color||labelProps.color;
      labelProps.shape=lb.shape||'none';
      labelProps.lw=lb.lw||2;
      // Mutual exclusion: selecting a label deactivates any drawing tool
      if(activeTool&&!activeTool.startsWith('e-')){
        activeTool=null;
        if(typeof pendingCropLabelId!=='undefined'&&pendingCropLabelId) cancelAddScreenshot();
        highlightSidebarTool(null);
        updateCursor();
      }
      renderPropPanel();
      document.querySelectorAll('.canvas-label').forEach(el2=>el2.style.outline='');
      el.style.outline='2px solid #ffeb3b';
      document.querySelectorAll('.iss-item').forEach(el2=>el2.classList.remove('active'));
      const drawerItem=document.getElementById('iss-item-'+lb.id);
      if(drawerItem){drawerItem.classList.add('active');drawerItem.scrollIntoView({behavior:'smooth',block:'nearest'});}
      syncActiveCropFloat();
    }
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(Math.abs(dx)>5||Math.abs(dy)>5) hasMoved=true;
    if(mode==='label'){
      lb.x=startLx+dx; lb.y=startLy+dy;
      el.style.left=lb.x+'px'; el.style.top=lb.y+'px';
    } else {
      lb.tx=startLx+dx; lb.ty=startLy+dy;
      el.style.left=(lb.tx-5)+'px'; el.style.top=(lb.ty-5)+'px';
    }
    drawAnnos();
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging) return;
    dragging=false;
    if(!hasMoved){
      renderCanvasLabels();
    }
  });
}
function makeShapeAnchorDraggable(el, lb, propX, propY){
  let startMX,startMY,startVX,startVY,dragging=false;
  el.addEventListener('mousedown',e=>{
    e.preventDefault(); e.stopPropagation(); dragging=true;
    startMX=e.clientX; startMY=e.clientY;
    startVX=lb[propX]; startVY=lb[propY];
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    lb[propX]=startVX+(e.clientX-startMX);
    lb[propY]=startVY+(e.clientY-startMY);
    el.style.left=(lb[propX]-5)+'px'; el.style.top=(lb[propY]-5)+'px';
    // Also reposition other anchors
    document.querySelectorAll('.cl-shape-anchor').forEach(a=>a!==el&&a.remove());
    drawAnnos();
    updateActiveCropFloat();
  });
  document.addEventListener('mouseup',()=>{
    if(dragging){ dragging=false; renderCanvasLabels(); }
  });
}

// ====== LABEL CROP PANELS ======
// Attached to rect-shape canvas labels: shows side-by-side design/game crops

// 按各图自身分辨率独立计算裁剪坐标（归一化映射，两图不同尺寸时不会裁黑）
function viewportToImgCoordsFor(img, vx, vy) {
  if(!img) return {x:0,y:0};
  // 用参考图计算画布在视口中的位置/大小（与 syncCanvasSize 逻辑一致）
  const refImg=gameImg||psImg;
  const nw=refImg.naturalWidth, nh=refImg.naturalHeight;
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  let fitW=vw, fitH=vw*nh/nw;
  if(fitH>vh){fitH=vh;fitW=vh*nw/nh;}
  fitW=Math.floor(fitW*zoomLevel); fitH=Math.floor(fitH*zoomLevel);
  const imgLeft=(vw-fitW)/2, imgTop=(vh-fitH)/2;
  // 归一化到 0..1（视口显示区域内的相对位置），再映射到该图自身像素坐标
  const nx=(vx-imgLeft)/fitW, ny=(vy-imgTop)/fitH;
  return {
    x:Math.round(Math.max(0,Math.min(img.naturalWidth,  nx*img.naturalWidth))),
    y:Math.round(Math.max(0,Math.min(img.naturalHeight, ny*img.naturalHeight)))
  };
}

function getLabelCropSide(lb) {
  const ib=getImageBounds();
  if(!ib) return 'top';
  const imgCx=(ib.left+ib.right)/2, imgCy=(ib.top+ib.bottom)/2;
  const el=document.getElementById('cl-'+lb.id);
  const lbCx=lb.x+(el?el.offsetWidth/2:70);
  const lbCy=lb.y+(el?el.offsetHeight/2:15);
  const adx=Math.abs(lbCx-imgCx), ady=Math.abs(lbCy-imgCy);
  if(ady>=adx) return lbCy<imgCy?'top':'bottom';
  return lbCx<imgCx?'left':'right';
}

function _lcpDispSize(lb) {
  const rectW=Math.abs(lb.tx-lb.sx), rectH=Math.abs(lb.ty-lb.sy);
  const aspect=rectH/(rectW||1);
  const MAX_W=140;
  const dw=Math.min(rectW,MAX_W), dh=Math.round(dw*aspect);
  return {dw, dh, aspect};
}

function removeLabelCropPanel(id) {
  document.getElementById('lcp-'+id)?.remove();
}

function syncAllLabelCropPanels() {
  document.querySelectorAll('.label-crop-panel').forEach(el=>el.remove());
  if(!gameImg||!psImg) return;
  canvasLabels.forEach(lb=>{
    if(lb.shape==='rect'&&lb.sx!=null&&Math.abs(lb.tx-lb.sx)>8&&Math.abs(lb.ty-lb.sy)>8)
      createLabelCropPanel(lb);
  });
}

function createLabelCropPanel(lb) {
  const {dw, dh}=_lcpDispSize(lb);
  const s=lb.cropScale||1;
  const vx1=Math.min(lb.sx,lb.tx), vy1=Math.min(lb.sy,lb.ty);
  const vx2=Math.max(lb.sx,lb.tx), vy2=Math.max(lb.sy,lb.ty);
  const pp1=viewportToImgCoordsFor(psImg,vx1,vy1),   pp2=viewportToImgCoordsFor(psImg,vx2,vy2);
  const gp1=viewportToImgCoordsFor(gameImg,vx1,vy1), gp2=viewportToImgCoordsFor(gameImg,vx2,vy2);
  const cropWp=Math.max(1,pp2.x-pp1.x), cropHp=Math.max(1,pp2.y-pp1.y);
  const cropWg=Math.max(1,gp2.x-gp1.x), cropHg=Math.max(1,gp2.y-gp1.y);
  const color=lb.lineColor||'#ffffff88';
  const isExp=lb.cropExpanded!==false;
  const panel=document.createElement('div');
  panel.className='label-crop-panel';
  panel.id='lcp-'+lb.id;
  if(lb.id===selectedLabelId) panel.style.outline='2px solid #ffeb3b';
  // Header: editable label text + delete + collapse (label and crop panel merged)
  panel.innerHTML=`
    <div class="lcp-header" style="border-left:3px solid ${color}">
      <span class="lcp-title" contenteditable="true" spellcheck="false"
        onblur="updateCanvasLabelText('${lb.id}',this.textContent)"
        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
        >${lb.text}</span>
      <button class="lcp-del" onclick="removeCanvasLabel('${lb.id}')" title="删除">✕</button>
      <button class="lcp-toggle" onclick="toggleLabelCrop('${lb.id}')">${isExp?'↑':'↓'}</button>
    </div>
    <div class="lcp-body" style="display:${isExp?'flex':'none'}">
      <div class="lcp-img-wrap">
        <canvas class="lcp-cvs" id="lcvs-ps-${lb.id}" width="${cropWp}" height="${cropHp}"
          style="width:${Math.round(dw*s)}px;height:${Math.round(dh*s)}px"></canvas>
        <span class="lcp-lbl lcp-lbl-ps">设计</span>
      </div>
      <div class="lcp-divider"></div>
      <div class="lcp-img-wrap">
        <canvas class="lcp-cvs" id="lcvs-game-${lb.id}" width="${cropWg}" height="${cropHg}"
          style="width:${Math.round(dw*s)}px;height:${Math.round(dh*s)}px"></canvas>
        <span class="lcp-lbl lcp-lbl-game">游戏</span>
      </div>
      <div class="lcp-corner lcp-tl"></div>
      <div class="lcp-corner lcp-tr"></div>
      <div class="lcp-corner lcp-bl"></div>
      <div class="lcp-corner lcp-br"></div>
    </div>`;
  makeLcpHeaderDraggable(panel, lb);
  panel.querySelectorAll('.lcp-corner').forEach(c=>makeLcpCornerDraggable(c, lb));
  // Clicking panel body selects this label
  panel.addEventListener('mousedown', ()=>{
    if(selectedLabelId!==lb.id){
      selectedLabelId=lb.id;
      document.querySelectorAll('.label-crop-panel').forEach(p=>p.style.outline='');
      panel.style.outline='2px solid #ffeb3b';
      renderPropPanel();
      // Sync drawer
      document.querySelectorAll('.iss-item').forEach(el=>el.classList.remove('active'));
      const drawerItem=document.getElementById('iss-item-'+lb.id);
      if(drawerItem){drawerItem.classList.add('active');drawerItem.scrollIntoView({behavior:'smooth',block:'nearest'});}
    }
  });
  viewport.appendChild(panel);
  const cvPs=document.getElementById('lcvs-ps-'+lb.id);
  const cvGame=document.getElementById('lcvs-game-'+lb.id);
  if(cvPs)   cvPs.getContext('2d').drawImage(psImg,   pp1.x,pp1.y,cropWp,cropHp, 0,0,cropWp,cropHp);
  if(cvGame) cvGame.getContext('2d').drawImage(gameImg,gp1.x,gp1.y,cropWg,cropHg, 0,0,cropWg,cropHg);
  repositionLabelCropPanel(lb);
}

function redrawLabelCrop(id) {
  const lb=canvasLabels.find(l=>l.id===id);
  if(!lb||lb.shape!=='rect'||lb.sx==null||!gameImg||!psImg) return;
  const cvPs=document.getElementById('lcvs-ps-'+id);
  const cvGame=document.getElementById('lcvs-game-'+id);
  if(!cvPs||!cvGame) return;
  const vx1=Math.min(lb.sx,lb.tx), vy1=Math.min(lb.sy,lb.ty);
  const vx2=Math.max(lb.sx,lb.tx), vy2=Math.max(lb.sy,lb.ty);
  // 每张图按自身分辨率独立计算
  const pp1=viewportToImgCoordsFor(psImg,vx1,vy1),   pp2=viewportToImgCoordsFor(psImg,vx2,vy2);
  const gp1=viewportToImgCoordsFor(gameImg,vx1,vy1), gp2=viewportToImgCoordsFor(gameImg,vx2,vy2);
  const cropWp=Math.max(1,pp2.x-pp1.x), cropHp=Math.max(1,pp2.y-pp1.y);
  const cropWg=Math.max(1,gp2.x-gp1.x), cropHg=Math.max(1,gp2.y-gp1.y);
  if(cvPs.width!==cropWp||cvPs.height!==cropHp){cvPs.width=cropWp; cvPs.height=cropHp;}
  if(cvGame.width!==cropWg||cvGame.height!==cropHg){cvGame.width=cropWg; cvGame.height=cropHg;}
  cvPs.getContext('2d').drawImage(psImg,   pp1.x,pp1.y,cropWp,cropHp, 0,0,cropWp,cropHp);
  cvGame.getContext('2d').drawImage(gameImg,gp1.x,gp1.y,cropWg,cropHg, 0,0,cropWg,cropHg);
  // 同步显示尺寸
  const {dw,dh}=_lcpDispSize(lb);
  const s=lb.cropScale||1;
  cvPs.style.width=Math.round(dw*s)+'px';   cvPs.style.height=Math.round(dh*s)+'px';
  cvGame.style.width=Math.round(dw*s)+'px'; cvGame.style.height=Math.round(dh*s)+'px';
}

function repositionLabelCropPanel(lb) {
  const panel=document.getElementById('lcp-'+lb.id);
  if(!panel) return;
  // lb.x/y is in annotation space; add pan for screen display
  panel.style.left=(lb.x+panX)+'px'; panel.style.top=(lb.y+panY)+'px';
  lb._cropPanelSide=getLabelCropSide(lb);
  lb._cropPanelRect={x:lb.x+panX, y:lb.y+panY, w:panel.offsetWidth||300, h:panel.offsetHeight||90};
}

function toggleLabelCrop(id) {
  const lb=canvasLabels.find(l=>l.id===id);
  if(lb) lb.cropExpanded=lb.cropExpanded===false;
  const panel=document.getElementById('lcp-'+id);
  if(!panel) return;
  const body=panel.querySelector('.lcp-body');
  const btn=panel.querySelector('.lcp-toggle');
  const exp=lb?lb.cropExpanded!==false:true;
  if(body) body.style.display=exp?'flex':'none';
  if(btn)  btn.textContent=exp?'收起':'展开';
  setTimeout(()=>{ if(lb) repositionLabelCropPanel(lb); drawAnnos(); },0);
}

function makeLcpHeaderDraggable(panel, lb) {
  const header=panel.querySelector('.lcp-header');
  let sx,sy,sl,st,dragging=false;
  header.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('lcp-toggle')||e.target.classList.contains('lcp-del')||
       e.target.getAttribute('contenteditable')==='true') return;
    e.preventDefault(); e.stopPropagation();
    dragging=true; sx=e.clientX; sy=e.clientY;
    sl=parseInt(panel.style.left)||lb.x; st=parseInt(panel.style.top)||lb.y;
    panel.style.zIndex=200;
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    const nx=sl+e.clientX-sx, ny=st+e.clientY-sy;
    panel.style.left=nx+'px'; panel.style.top=ny+'px';
    lb.x=nx-panX; lb.y=ny-panY; // store in annotation space (subtract pan)
    lb._cropPanelRect={x:nx,y:ny,w:panel.offsetWidth||300,h:panel.offsetHeight||90};
    drawAnnos();
  });
  document.addEventListener('mouseup',()=>{ if(dragging){dragging=false; panel.style.zIndex='';} });
}

function makeLcpCornerDraggable(corner, lb) {
  const isTL=corner.classList.contains('lcp-tl');
  const isTR=corner.classList.contains('lcp-tr');
  const isBL=corner.classList.contains('lcp-bl');
  let sx,sy,initS,dragging=false;
  corner.addEventListener('mousedown',e=>{
    e.preventDefault(); e.stopPropagation();
    dragging=true; sx=e.clientX; sy=e.clientY; initS=lb.cropScale||1;
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    let dx=e.clientX-sx, dy=e.clientY-sy;
    if(isTL){dx=-dx;dy=-dy;}
    else if(isTR){dy=-dy;}
    else if(isBL){dx=-dx;}
    const delta=(Math.abs(dx)>Math.abs(dy)?dx:dy);
    const {dw}=_lcpDispSize(lb);
    lb.cropScale=Math.max(0.3,Math.min(4,initS+delta/Math.max(dw,60)));
    const panel=document.getElementById('lcp-'+lb.id);
    if(!panel) return;
    const {dw:nw,dh:nh}=_lcpDispSize(lb);
    const s=lb.cropScale;
    panel.querySelectorAll('.lcp-cvs').forEach(c=>{
      c.style.width=Math.round(nw*s)+'px'; c.style.height=Math.round(nh*s)+'px';
    });
  });
  document.addEventListener('mouseup',()=>{ dragging=false; });
}

// ====== ISSUES DRAWER ======
function renderIssuesDrawer() {
  const list=document.getElementById('iss-list');
  const empty=document.getElementById('iss-empty');
  const countEl=document.getElementById('iss-count');
  if(!list) return;
  list.querySelectorAll('.iss-item').forEach(el=>el.remove());
  if(!canvasLabels.length){
    if(empty) empty.style.display='flex';
    if(countEl) countEl.textContent='0';
    return;
  }
  if(empty) empty.style.display='none';
  if(countEl) countEl.textContent=canvasLabels.length;
  canvasLabels.forEach((lb,i)=>{
    const isActive=lb.id===selectedLabelId;
    const hasRect=lb.shape==='rect'&&lb.sx!=null&&Math.abs(lb.tx-lb.sx)>8&&Math.abs(lb.ty-lb.sy)>8;
    const hasCrops=hasRect&&gameImg&&psImg;
    const color=lb.lineColor||lb.color||'#007AFF';
    // For AI-diagnosed labels, show full description in drawer; otherwise show label text
    const rawDisplay=lb.text.replace(/^#\d+\s*/,'');
    const displayText=(lb.autoGenerated&&lb.diagDesc)?lb.diagDesc:rawDisplay;
    const isPlaceholderText=!displayText||displayText===PLACEHOLDER_TEXT;
    const badgeText=hasCrops?'截图':hasRect?'截图区域':'标注';
    const badgeCls=hasCrops?'iss-badge-crop':hasRect?'iss-badge-pending':'iss-badge-label';

    let cropsHtml='';
    if(hasCrops){
      cropsHtml=`<div class="iss-crops">
        <div class="iss-crop-col">
          <canvas class="iss-cvs" id="iss-cvs-ps-${lb.id}"></canvas>
          <span class="iss-crop-lbl iss-crop-lbl-ps">设计</span>
        </div>
        <div class="iss-crop-divider"></div>
        <div class="iss-crop-col">
          <canvas class="iss-cvs" id="iss-cvs-game-${lb.id}"></canvas>
          <span class="iss-crop-lbl iss-crop-lbl-game">游戏</span>
        </div>
      </div>
      <button class="iss-del-crop" onclick="event.stopPropagation();removeIssueScreenshot('${lb.id}')">删除截图</button>`;
    } else {
      cropsHtml=`<button class="iss-add-crop" onclick="event.stopPropagation();startAddScreenshot('${lb.id}')">+ 添加截图</button>`;
    }

    const item=document.createElement('div');
    item.className='iss-item'+(isActive?' active':'');
    item.id='iss-item-'+lb.id;
    item.innerHTML=`
      <div class="iss-item-head" style="border-left-color:${color}">
        <span class="iss-num">#${i+1}</span>
        <span class="iss-text${isPlaceholderText?' iss-placeholder':''}" contenteditable="true" spellcheck="false"
          onclick="event.stopPropagation()"
          onfocus="issTextFocus(this)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
          onblur="updateIssueText('${lb.id}',this.textContent)"
          title="${isPlaceholderText?PLACEHOLDER_TEXT:displayText}"
          >${isPlaceholderText?PLACEHOLDER_TEXT:displayText}</span>
        <span class="iss-badge ${badgeCls}">${badgeText}</span>
        <button class="iss-del-issue" onclick="event.stopPropagation();removeCanvasLabel('${lb.id}')" title="删除问题">✕</button>
      </div>
      ${cropsHtml}`;
    item.addEventListener('click',()=>selectIssueFromDrawer(lb.id));
    list.appendChild(item);
    if(hasCrops) setTimeout(()=>drawIssueDrawerCrops(lb),0);
  });
}

function drawIssueDrawerCrops(lb) {
  const cvPs=document.getElementById('iss-cvs-ps-'+lb.id);
  const cvGame=document.getElementById('iss-cvs-game-'+lb.id);
  if(!cvPs||!cvGame||!psImg||!gameImg) return;
  const vx1=Math.min(lb.sx,lb.tx), vy1=Math.min(lb.sy,lb.ty);
  const vx2=Math.max(lb.sx,lb.tx), vy2=Math.max(lb.sy,lb.ty);
  const pp1=viewportToImgCoordsFor(psImg,vx1,vy1),   pp2=viewportToImgCoordsFor(psImg,vx2,vy2);
  const gp1=viewportToImgCoordsFor(gameImg,vx1,vy1), gp2=viewportToImgCoordsFor(gameImg,vx2,vy2);
  const cropWp=Math.max(1,pp2.x-pp1.x), cropHp=Math.max(1,pp2.y-pp1.y);
  const cropWg=Math.max(1,gp2.x-gp1.x), cropHg=Math.max(1,gp2.y-gp1.y);
  cvPs.width=cropWp; cvPs.height=cropHp;
  cvGame.width=cropWg; cvGame.height=cropHg;
  cvPs.getContext('2d').drawImage(psImg,pp1.x,pp1.y,cropWp,cropHp,0,0,cropWp,cropHp);
  cvGame.getContext('2d').drawImage(gameImg,gp1.x,gp1.y,cropWg,cropHg,0,0,cropWg,cropHg);
  // Thumbnail size: fit in ~110px wide column, preserve aspect
  const colW=110, aspect=cropHp/Math.max(1,cropWp);
  const dispH=Math.min(100, Math.round(colW*aspect));
  cvPs.style.height=dispH+'px';
  cvGame.style.height=dispH+'px';
}

function updateIssueText(id, newDesc) {
  const idx=canvasLabels.findIndex(l=>l.id===id);
  if(idx<0) return;
  const desc=newDesc.trim();
  const isPlaceholder=!desc||desc===PLACEHOLDER_TEXT;
  canvasLabels[idx].text='#'+(idx+1)+' '+(isPlaceholder?PLACEHOLDER_TEXT:desc);
  // Sync canvas label card
  const el=document.getElementById('cl-'+id);
  if(el){
    const t=el.querySelector('.cl-text');
    if(t){
      if(isPlaceholder){t.textContent=PLACEHOLDER_TEXT;t.classList.add('cl-placeholder');}
      else{t.textContent=desc;t.classList.remove('cl-placeholder');}
    }
  }
}
function issTextFocus(el) {
  if(el.textContent.trim()===PLACEHOLDER_TEXT){
    el.textContent='';
    el.classList.remove('iss-placeholder');
  }
}

function removeIssueScreenshot(id) {
  const lb=canvasLabels.find(l=>l.id===id);
  if(!lb) return;
  saveHist();
  lb.shape='none';
  lb.sx=null; lb.sy=null;
  // Reset target dot to label position
  lb.tx=lb.x+60; lb.ty=lb.y+10;
  hideActiveCropFloat();
  renderCanvasLabels();
}

function selectIssueFromDrawer(id) {
  selectedLabelId=id;
  renderCanvasLabels();
  renderPropPanel();
  const item=document.getElementById('iss-item-'+id);
  if(item) item.scrollIntoView({behavior:'smooth',block:'nearest'});
  syncActiveCropFloat();
}

// Called when a canvas label is clicked — scroll drawer to match
function syncDrawerToLabel(id) {
  selectedLabelId=id;
  renderIssuesDrawer();
  const item=document.getElementById('iss-item-'+id);
  if(item) item.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// Recompute label card positions from annotation coords + current image bounds.
// Called after zoom so labels always sit correctly outside the image.
function recomputeLabelPositions() {
  canvasLabels.forEach(lb=>{
    let pos;
    if(lb.sx!=null&&lb.shape&&lb.shape!=='none'){
      const sMinX=Math.min(lb.sx,lb.tx), sMaxX=Math.max(lb.sx,lb.tx);
      const sMinY=Math.min(lb.sy,lb.ty), sMaxY=Math.max(lb.sy,lb.ty);
      pos=placeLabelOutside(sMinX,sMinY,sMaxX,sMaxY);
    } else {
      pos=placeLabelOutside(lb.tx,lb.ty,lb.tx,lb.ty);
    }
    lb.x=pos.x; lb.y=pos.y;
  });
}

// ====== ACTIVE CROP FLOAT (2x 悬浮对比卡) ======

// Determine which image edge the rect is closest to
function getRectEdge(lb) {
  const ib=getImageBounds(); if(!ib) return 'top';
  const vx1=Math.min(lb.sx,lb.tx), vy1=Math.min(lb.sy,lb.ty);
  const vx2=Math.max(lb.sx,lb.tx), vy2=Math.max(lb.sy,lb.ty);
  const dTop=vy1-ib.top, dBottom=ib.bottom-vy2;
  const dLeft=vx1-ib.left, dRight=ib.right-vx2;
  const minD=Math.min(dTop,dBottom,dLeft,dRight);
  if(minD===dTop) return 'top';
  if(minD===dBottom) return 'bottom';
  if(minD===dLeft) return 'left';
  return 'right';
}

function syncActiveCropFloat() {
  const existing=document.getElementById('active-crop-float');
  const lb=selectedLabelId?canvasLabels.find(l=>l.id===selectedLabelId):null;
  const hasCrops=lb&&lb.shape==='rect'&&lb.sx!=null&&
    Math.abs(lb.tx-lb.sx)>8&&Math.abs(lb.ty-lb.sy)>8&&gameImg&&psImg;
  if(!hasCrops){ existing?.remove(); return; }
  if(existing&&existing.dataset.labelId===selectedLabelId) return;
  existing?.remove();
  createActiveCropFloat(lb);
}

function createActiveCropFloat(lb) {
  const vx1=Math.min(lb.sx,lb.tx), vy1=Math.min(lb.sy,lb.ty);
  const vx2=Math.max(lb.sx,lb.tx), vy2=Math.max(lb.sy,lb.ty);
  const rectW=vx2-vx1, rectH=vy2-vy1;
  const aspect=rectH/Math.max(1,rectW);
  // Default ×1: display at the same size as the selected region on canvas
  const initW=Math.max(80,Math.round(rectW));
  const initH=Math.round(initW*aspect);
  const PANEL_W=initW*2+34, PANEL_H=initH+84; // 84 = header + zoom row + labels
  const GAP=14;

  // Crop coords
  const pp1=viewportToImgCoordsFor(psImg,vx1,vy1), pp2=viewportToImgCoordsFor(psImg,vx2,vy2);
  const gp1=viewportToImgCoordsFor(gameImg,vx1,vy1), gp2=viewportToImgCoordsFor(gameImg,vx2,vy2);
  const cropWp=Math.max(1,pp2.x-pp1.x), cropHp=Math.max(1,pp2.y-pp1.y);
  const cropWg=Math.max(1,gp2.x-gp1.x), cropHg=Math.max(1,gp2.y-gp1.y);

  const _nm2=lb.text.match(/^(#\d+)\s*(.*)/s);
  const _numPart2=_nm2?_nm2[1]:'';
  const _descPart2=_nm2?_nm2[2].trim():lb.text;
  const _isPlh=!_descPart2||_descPart2===PLACEHOLDER_TEXT;
  const color=lb.lineColor||'#ffffff88';

  const panel=document.createElement('div');
  panel.className='acf-panel';
  panel.id='active-crop-float';
  panel.dataset.labelId=lb.id;
  panel.innerHTML=`
    <div class="acf-header" style="border-left:3px solid ${color}">
      <span class="acf-num">${_numPart2}</span>
      <span class="acf-edit-text${_isPlh?' cl-placeholder':''}" contenteditable="true" spellcheck="false"
        onfocus="clTextFocus(this)"
        onblur="updateCanvasLabelText('${lb.id}',this.textContent)"
        onkeydown="if(event.key==='Enter'){event.preventDefault();finishCropEditing()}"
        >${_isPlh?PLACEHOLDER_TEXT:_descPart2}</span>
      <button class="acf-del" onclick="event.stopPropagation();removeCanvasLabel('${lb.id}')" title="删除问题">✕</button>
      <button class="acf-done" onclick="event.stopPropagation();finishCropEditing()" title="完成编辑">完成</button>
    </div>
    <div class="acf-zoom-row">
      <button class="acf-zoom-btn" onclick="setAcfZoom(this,0.5)">×0.5</button>
      <button class="acf-zoom-btn active" onclick="setAcfZoom(this,1)">×1</button>
      <button class="acf-zoom-btn" onclick="setAcfZoom(this,2)">×2</button>
    </div>
    <div class="acf-body">
      <div class="acf-col">
        <canvas class="acf-cvs" id="acf-ps" width="${cropWp}" height="${cropHp}" style="width:${initW}px;height:${initH}px"></canvas>
        <span class="acf-lbl acf-lbl-ps">设计稿</span>
      </div>
      <div class="acf-divider"></div>
      <div class="acf-col">
        <canvas class="acf-cvs" id="acf-game" width="${cropWg}" height="${cropHg}" style="width:${initW}px;height:${initH}px"></canvas>
        <span class="acf-lbl acf-lbl-game">游戏截图</span>
      </div>
    </div>
    <div class="acf-resize" id="acf-resize"></div>`;

  makeAcfDraggable(panel);
  makeAcfResizable(panel);
  viewport.appendChild(panel);

  // Position OUTSIDE the image at nearest edge
  const ib=getImageBounds();
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  const cx=(vx1+vx2)/2, cy=(vy1+vy2)/2;
  const edge=getRectEdge(lb);
  let pl=20, pt=20;
  if(ib){
    if(edge==='top'){
      pl=Math.max(4,Math.min(vw-PANEL_W-4,cx-PANEL_W/2));
      pt=Math.max(4,ib.top-PANEL_H-GAP);
    } else if(edge==='bottom'){
      pl=Math.max(4,Math.min(vw-PANEL_W-4,cx-PANEL_W/2));
      pt=Math.min(vh-PANEL_H-4,ib.bottom+GAP);
    } else if(edge==='left'){
      pl=Math.max(4,ib.left-PANEL_W-GAP);
      pt=Math.max(4,Math.min(vh-PANEL_H-4,cy-PANEL_H/2));
    } else {
      pl=Math.min(vw-PANEL_W-4,ib.right+GAP);
      pt=Math.max(4,Math.min(vh-PANEL_H-4,cy-PANEL_H/2));
    }
  }
  panel.style.left=pl+'px'; panel.style.top=pt+'px';

  // Draw crops
  const cvPs=document.getElementById('acf-ps');
  const cvGame=document.getElementById('acf-game');
  if(cvPs) cvPs.getContext('2d').drawImage(psImg,pp1.x,pp1.y,cropWp,cropHp,0,0,cropWp,cropHp);
  if(cvGame) cvGame.getContext('2d').drawImage(gameImg,gp1.x,gp1.y,cropWg,cropHg,0,0,cropWg,cropHg);

  // Auto-focus description for quick editing
  setTimeout(()=>{
    const t=panel.querySelector('.acf-edit-text');
    if(t){ t.focus(); if(_isPlh){ t.textContent=''; t.classList.remove('cl-placeholder'); } }
  },80);
}

function setAcfZoom(btn, scale) {
  const panel=document.getElementById('active-crop-float');
  if(!panel) return;
  const lb=canvasLabels.find(l=>l.id===panel.dataset.labelId);
  if(!lb||lb.sx==null) return;
  const rectW=Math.abs(lb.tx-lb.sx);
  const displayW=Math.max(40,Math.round(rectW*scale));
  panel.querySelectorAll('.acf-cvs').forEach(c=>{
    const pw=c.width||1, ph=c.height||1;
    c.style.width=displayW+'px';
    c.style.height=Math.round(displayW*(ph/pw))+'px';
  });
  panel.querySelectorAll('.acf-zoom-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function finishCropEditing() {  // Save description text from float card before closing
  const panel=document.getElementById('active-crop-float');
  if(panel){
    const t=panel.querySelector('.acf-edit-text');
    if(t) updateCanvasLabelText(panel.dataset.labelId, t.textContent);
  }
  selectedLabelId=null;
  pendingCropLabelId=null;
  hideCropHint();
  activeTool=null;
  highlightSidebarTool(null);
  updateCursor();
  renderCanvasLabels(); // float card hidden, canvas-label shown
  renderPropPanel();
}

function hideActiveCropFloat() {
  document.getElementById('active-crop-float')?.remove();
}

function toggleAcfCollapse() { /* removed - kept for safety */ }

function updateActiveCropFloat() {
  const panel=document.getElementById('active-crop-float');
  if(!panel) return;
  const lb=canvasLabels.find(l=>l.id===panel.dataset.labelId);
  if(!lb||lb.shape!=='rect'||lb.sx==null||!psImg||!gameImg) return;
  const vx1=Math.min(lb.sx,lb.tx), vy1=Math.min(lb.sy,lb.ty);
  const vx2=Math.max(lb.sx,lb.tx), vy2=Math.max(lb.sy,lb.ty);
  const pp1=viewportToImgCoordsFor(psImg,vx1,vy1), pp2=viewportToImgCoordsFor(psImg,vx2,vy2);
  const gp1=viewportToImgCoordsFor(gameImg,vx1,vy1), gp2=viewportToImgCoordsFor(gameImg,vx2,vy2);
  const cropWp=Math.max(1,pp2.x-pp1.x), cropHp=Math.max(1,pp2.y-pp1.y);
  const cropWg=Math.max(1,gp2.x-gp1.x), cropHg=Math.max(1,gp2.y-gp1.y);
  const cvPs=document.getElementById('acf-ps');
  const cvGame=document.getElementById('acf-game');
  if(!cvPs||!cvGame) return;
  const displayW=cvPs.clientWidth||100;
  cvPs.width=cropWp; cvPs.height=cropHp;
  cvGame.width=cropWg; cvGame.height=cropHg;
  cvPs.getContext('2d').drawImage(psImg,pp1.x,pp1.y,cropWp,cropHp,0,0,cropWp,cropHp);
  cvGame.getContext('2d').drawImage(gameImg,gp1.x,gp1.y,cropWg,cropHg,0,0,cropWg,cropHg);
  cvPs.style.height=Math.round(displayW*(cropHp/Math.max(1,cropWp)))+'px';
  cvGame.style.height=Math.round(displayW*(cropHg/Math.max(1,cropWg)))+'px';
}

// makeAcfDraggable and makeAcfResizable follow below

function makeAcfDraggable(panel) {
  const header=panel.querySelector('.acf-header');
  let sx,sy,sl,st,dragging=false;
  header.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('acf-del')||
       e.target.classList.contains('acf-done')||
       e.target.getAttribute('contenteditable')==='true') return;
    e.preventDefault(); e.stopPropagation();
    dragging=true; sx=e.clientX; sy=e.clientY;
    sl=parseInt(panel.style.left)||0; st=parseInt(panel.style.top)||0;
    panel.style.zIndex=200;
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    panel.style.left=(sl+e.clientX-sx)+'px';
    panel.style.top=(st+e.clientY-sy)+'px';
  });
  document.addEventListener('mouseup',()=>{ if(dragging){dragging=false;panel.style.zIndex='';} });
}

function makeAcfResizable(panel) {
  const corner=panel.querySelector('.acf-resize');
  if(!corner) return;
  let sx,sy,dragging=false;
  corner.addEventListener('mousedown',e=>{
    e.preventDefault(); e.stopPropagation();
    dragging=true; sx=e.clientX; sy=e.clientY;
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    const delta=Math.abs(dx)>=Math.abs(dy)?dx:dy;
    // Read current displayed size from canvas element directly
    panel.querySelectorAll('.acf-cvs').forEach(c=>{
      const curW=c.clientWidth||80;
      const pw=c.width||1, ph=c.height||1;
      const newW=Math.max(40,Math.min(500,curW+delta));
      c.style.width=newW+'px';
      c.style.height=Math.round(newW*(ph/pw))+'px';
    });
    sx=e.clientX; sy=e.clientY;
  });
  document.addEventListener('mouseup',()=>{ dragging=false; });
}

let pendingCropLabelId=null;

// Convert image pixel coords → viewport coords (inverse of viewportToImgCoordsFor)
function imgCoordsToViewport(imgX, imgY) {
  const refImg=gameImg||psImg; if(!refImg) return {x:0,y:0};
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  const nw=refImg.naturalWidth, nh=refImg.naturalHeight;
  let fitW=vw, fitH=vw*nh/nw;
  if(fitH>vh){fitH=vh;fitW=vh*nw/nh;}
  fitW=Math.floor(fitW*zoomLevel); fitH=Math.floor(fitH*zoomLevel);
  return {
    x:(vw-fitW)/2+(imgX/nw)*fitW,
    y:(vh-fitH)/2+(imgY/nh)*fitH
  };
}

function startAddScreenshot(id) {
  const lb=canvasLabels.find(l=>l.id===id);
  if(!lb) return;
  const num=lb.text.match(/^#(\d+)/)?.[1]||'?';

  // Pick next crop color
  const cropColor=CROP_COLORS[cropColorIndex%CROP_COLORS.length];
  cropColorIndex++;
  const dc=deriveLabelColors(cropColor);

  let autoDetected=false;

  // Try nearest diff region from reportData
  if(typeof reportData!=='undefined'&&reportData&&reportData.regions&&reportData.regions.length>0){
    let nearest=null, minDist=Infinity;
    reportData.regions.forEach(reg=>{
      const vc=imgCoordsToViewport(reg.x+reg.w/2, reg.y+reg.h/2);
      const dist=Math.sqrt((vc.x-lb.tx)**2+(vc.y-lb.ty)**2);
      if(dist<minDist){minDist=dist;nearest=reg;}
    });
    if(nearest){
      const v1=imgCoordsToViewport(nearest.x, nearest.y);
      const v2=imgCoordsToViewport(nearest.x+nearest.w, nearest.y+nearest.h);
      saveHist();
      lb.shape='rect'; lb.sx=v1.x; lb.sy=v1.y; lb.tx=v2.x; lb.ty=v2.y;
      lb.color=cropColor; lb.bgColor=dc.bgColor; lb.textColor=dc.textColor; lb.lineColor=dc.lineColor;
      const _lp=placeLabelOutside(v1.x,v1.y,v2.x,v2.y);
      lb.x=_lp.x; lb.y=_lp.y;
      autoDetected=true;
    }
  }

  // Fallback: default 120×80 box centered on label target point
  if(!autoDetected){
    const DW=120, DH=80;
    saveHist();
    const sx=lb.tx-DW/2, sy=lb.ty-DH/2, tx=lb.tx+DW/2, ty=lb.ty+DH/2;
    lb.shape='rect'; lb.sx=sx; lb.sy=sy; lb.tx=tx; lb.ty=ty;
    lb.color=cropColor; lb.bgColor=dc.bgColor; lb.textColor=dc.textColor; lb.lineColor=dc.lineColor;
    const _lp=placeLabelOutside(sx,sy,tx,ty);
    lb.x=_lp.x; lb.y=_lp.y;
  }

  // Select label (anchors shown for adjustment), activate label+rect tool for optional redraw
  selectedLabelId=id;
  pendingCropLabelId=id;
  activeTool='label'; labelProps.shape='rect';
  highlightSidebarTool('label');
  updateCursor();
  renderCanvasLabels();
  renderPropPanel();

  // Show hint
  const hintText=document.getElementById('crop-hint-text');
  if(hintText) hintText.textContent=autoDetected?
    `已识别截图区域 #${num}，可拖拽锚点调整`:
    `正在为 #${num} 添加截图区域`;
  const hint=document.getElementById('crop-hint');
  if(hint) hint.classList.add('active');
}
function hideCropHint() {
  const hint=document.getElementById('crop-hint');
  if(hint) hint.classList.remove('active');
}
function cancelAddScreenshot() {
  pendingCropLabelId=null;
  hideCropHint();
  activeTool=null;
  highlightSidebarTool(null);
  updateCursor();
  renderPropPanel();
}

// ====== 一键诊断 ======
function updateDiagnoseBtn(enabled) {
  const btn=document.getElementById('btn-diagnose');
  if(!btn) return;
  btn.disabled=!enabled;
}

function toggleAutoDiagnosis() {
  const btn=document.getElementById('btn-diagnose');
  if(!btn) return;
  if(btn.classList.contains('diag-active')){
    cancelAutoDiagnosis();
  } else {
    // Show confirmation modal before running
    openModal('modal-diag-confirm');
  }
}

// Crop a region from an image for per-region AI description
// reg coords are in markCanvas space; scale to img natural resolution
function _cropRegionBase64(img, reg) {
  if(!img||!markCanvas.width||!markCanvas.height) return null;
  const sx=img.naturalWidth/markCanvas.width;
  const sy=img.naturalHeight/markCanvas.height;
  const margin=Math.max(10,Math.floor(Math.min(reg.w,reg.h)*0.15));
  const cx=Math.max(0,Math.round((reg.x-margin)*sx));
  const cy=Math.max(0,Math.round((reg.y-margin)*sy));
  const cw=Math.min(img.naturalWidth-cx,Math.round((reg.w+margin*2)*sx));
  const ch=Math.min(img.naturalHeight-cy,Math.round((reg.h+margin*2)*sy));
  if(cw<=0||ch<=0) return null;
  // Limit to 512px wide for API
  const scale=cw>512?512/cw:1;
  const c=document.createElement('canvas');
  c.width=Math.round(cw*scale); c.height=Math.round(ch*scale);
  c.getContext('2d').drawImage(img,cx,cy,cw,ch,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.85).split(',')[1];
}

async function runAutoDiagnosis() {
  canvasLabels=canvasLabels.filter(lb=>!lb.autoGenerated);
  const btn=document.getElementById('btn-diagnose');
  if(btn){btn.textContent='⏳ 诊断中...';btn.disabled=true;}

  try {
    if(!reportData||!reportData.regions||!reportData.regions.length){
      if(btn){btn.textContent='🔍 一键诊断';btn.disabled=false;}
      return;
    }
    const maxN=aiConfig.diagMaxIssues||5;
    const pColors={'P0':'#ff4757','P1':'#ff6b35','P2':'#ffc107','P3':'#a29bfe'};

    // Step 1: merge nearby diff blobs + expand → component-level regions
    const regions=_processRegions(reportData.regions,maxN);

    // Step 2: single API call — full images → tag list
    let aiDescList=null;
    const aiConfigured=aiConfig.enabled&&!!aiConfig.model;
    if(aiConfigured&&typeof callAIDiagSimple==='function'){
      try{
        const aiText=await callAIDiagSimple();
        if(aiText) aiDescList=parseDiagSimple(aiText);
      }catch(e){
        console.warn('[诊断] AI失败:', e.message);
      }
    }

    const issues=regions.map((reg,i)=>{
      const a=reg.analysis;
      const p=a?.severity?.label||'P2';
      const color=a?.issue?.borderColor||pColors[p]||'#007AFF';
      const rx=(reg.x/markCanvas.width)*100, ry=(reg.y/markCanvas.height)*100;
      const rw=(reg.w/markCanvas.width)*100, rh=(reg.h/markCanvas.height)*100;
      const desc=(aiDescList&&aiDescList[i])?aiDescList[i]:(a?.issue?.label||'差异');
      return {p, type:a?.issue?.label||'差异', x:rx, y:ry, w:rw, h:rh, desc, color};
    });

    _applyDiagIssues(issues);
    if(btn){btn.textContent='✕ 取消诊断';btn.classList.add('diag-active');btn.disabled=false;}
    const notice=document.getElementById('iss-diag-notice');
    if(notice) notice.style.display='block';
  } catch(e){
    console.warn('一键诊断失败：',e);
    const issues=_diagPixelFallback();
    _applyDiagIssues(issues);
    if(btn){btn.textContent='✕ 取消诊断';btn.classList.add('diag-active');btn.disabled=false;}
    const notice=document.getElementById('iss-diag-notice');
    if(notice) notice.style.display='block';
  }
}

// Merge nearby pixel-diff blobs + expand → component-level regions sorted by severity
function _processRegions(rawRegions, maxN) {
  const MERGE_GAP=60;
  const EXPAND=50;
  const pOrder={'P0':0,'P1':1,'P2':2,'P3':3};

  const sorted=[...rawRegions].sort((a,b)=>
    (pOrder[a.analysis?.severity?.label]??2)-(pOrder[b.analysis?.severity?.label]??2)
  );

  const used=new Array(sorted.length).fill(false);
  const merged=[];

  for(let i=0;i<sorted.length;i++){
    if(used[i]) continue;
    let x1=sorted[i].x, y1=sorted[i].y;
    let x2=x1+sorted[i].w, y2=y1+sorted[i].h;
    let bestA=sorted[i].analysis;
    used[i]=true;
    let changed=true;
    while(changed){
      changed=false;
      for(let j=i+1;j<sorted.length;j++){
        if(used[j]) continue;
        const r=sorted[j];
        const rx2=r.x+r.w, ry2=r.y+r.h;
        const gapX=Math.max(0,Math.max(x1,r.x)-Math.min(x2,rx2));
        const gapY=Math.max(0,Math.max(y1,r.y)-Math.min(y2,ry2));
        if(gapX<=MERGE_GAP&&gapY<=MERGE_GAP){
          x1=Math.min(x1,r.x); y1=Math.min(y1,r.y);
          x2=Math.max(x2,rx2); y2=Math.max(y2,ry2);
          const pi=pOrder[bestA?.severity?.label]??2;
          const pj=pOrder[r.analysis?.severity?.label]??2;
          if(pj<pi) bestA=r.analysis;
          used[j]=true; changed=true;
        }
      }
    }
    const W=markCanvas.width||1, H=markCanvas.height||1;
    merged.push({
      x:Math.max(0,x1-EXPAND), y:Math.max(0,y1-EXPAND),
      w:Math.min(W,x2+EXPAND)-Math.max(0,x1-EXPAND),
      h:Math.min(H,y2+EXPAND)-Math.max(0,y1-EXPAND),
      analysis:bestA
    });
    if(merged.length>=maxN) break;
  }
  return merged;
}

// Fallback: convert existing pixel-diff regions to comprehensive issue descriptions
function _diagPixelFallback() {
  if(!reportData||!reportData.regions) return [];
  const maxN=aiConfig.diagMaxIssues||5;
  const pColors={'P0':'#ff4757','P1':'#ff6b35','P2':'#ffc107','P3':'#a29bfe'};
  return reportData.regions.slice(0,maxN).map(reg=>{
    const a=reg.analysis;
    const p=a?.severity?.label||'P2';
    // Build comprehensive description from all available analysis data
    const parts=[];
    // 1. Main issue type
    const issueLabel=a?.issue?.label||'差异';
    // 2. Color difference
    if(a?.avgDE!=null&&a.avgDE>3){
      const deLevel=a.avgDE>15?'严重':a.avgDE>8?'明显':'轻微';
      let colorPart=`颜色差异${deLevel}（ΔE=${a.avgDE.toFixed(1)}）`;
      if(a.colorDesc&&a.colorDesc!=='无明显偏移') colorPart+=`，${a.colorDesc}`;
      parts.push(colorPart);
    }
    // 3. Position offset
    if(a?.offset&&a.offset.confidence>0.3&&(Math.abs(a.offset.dx)>2||Math.abs(a.offset.dy)>2)){
      const dx=a.offset.dx, dy=a.offset.dy;
      let offsetPart='位置偏移：';
      if(Math.abs(dx)>2) offsetPart+=`水平${dx>0?'向右':'向左'}约${Math.abs(dx)}px`;
      if(Math.abs(dy)>2) offsetPart+=(Math.abs(dx)>2?'、':'')+(dy>0?'向下':'向上')+`约${Math.abs(dy)}px`;
      parts.push(offsetPart);
    }
    // 4. Size difference
    if(a?.sizeInfo?.hasDiff){
      const dw=a.sizeInfo.dw, dh=a.sizeInfo.dh;
      let sizePart='尺寸差异：';
      if(dw!==0) sizePart+=`宽度${dw>0?'增大':'缩小'}约${Math.abs(dw)}px`;
      if(dh!==0) sizePart+=(dw!==0?'、':'')+(dh>0?'高度增大':'高度缩小')+`约${Math.abs(dh)}px`;
      parts.push(sizePart);
    }
    // If no details extracted, fall back to issue label + location info
    if(!parts.length) parts.push(`${issueLabel}（区域大小 ${reg.w}×${reg.h}px）`);
    const desc=parts.join('、');
    return {
      p, type:issueLabel,
      x:(reg.x/markCanvas.width)*100, y:(reg.y/markCanvas.height)*100,
      w:(reg.w/markCanvas.width)*100, h:(reg.h/markCanvas.height)*100,
      desc, color:a?.issue?.borderColor||pColors[p]||'#007AFF'
    };
  });
}

// Apply parsed issues (from AI or fallback) as canvasLabels
function _applyDiagIssues(issues) {
  issues.forEach((issue,idx)=>{
    const color=issue.color||CROP_COLORS[idx%CROP_COLORS.length];
    const dc=deriveLabelColors(color);
    labelCounter++;
    const id='cl'+Date.now()+Math.random().toString(36).slice(2,6);
    // Percentage coords → game image pixel coords → viewport coords
    const imgW=gameImg?gameImg.naturalWidth:markCanvas.width;
    const imgH=gameImg?gameImg.naturalHeight:markCanvas.height;
    const px=issue.x/100*imgW, py=issue.y/100*imgH;
    const pw=Math.max(10,issue.w/100*imgW), ph=Math.max(10,issue.h/100*imgH);
    const v1=imgCoordsToViewport(px,py);
    const v2=imgCoordsToViewport(px+pw,py+ph);
    // Canvas label and drawer both use desc — unified, tag-style, no precise numbers
    const text='['+issue.p+'] '+issue.desc;
    const pos=placeLabelOutside(v1.x,v1.y,v2.x,v2.y);
    canvasLabels.push({
      id, text, cls:'qa-minor',
      x:pos.x, y:pos.y, tx:v2.x, ty:v2.y, sx:v1.x, sy:v1.y,
      shape:'rect', lw:2,
      color, bgColor:dc.bgColor, textColor:dc.textColor, lineColor:dc.lineColor,
      opacity:0.35, autoGenerated:true, diagDesc:issue.desc
    });
  });
  renumberLabels();
  // Clear markCanvas region markers
  if(markCtx&&markCanvas){
    markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
    if(!isComparing) markCanvas.style.display='none';
  }
  renderCanvasLabels();
}

function cancelAutoDiagnosis() {
  canvasLabels=canvasLabels.filter(lb=>!lb.autoGenerated);
  renumberLabels();
  renderCanvasLabels();
  if(markCtx&&markCanvas){
    markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
    markCanvas.style.display='none';
  }
  const btn=document.getElementById('btn-diagnose');
  if(btn){btn.textContent='🔍 一键诊断';btn.classList.remove('diag-active');}
  const notice=document.getElementById('iss-diag-notice');
  if(notice) notice.style.display='none';
}