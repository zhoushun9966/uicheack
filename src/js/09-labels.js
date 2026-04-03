'use strict';
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
  if(!scroll||!btn) return;
  const isHidden=scroll.style.display==='none';
  scroll.style.display=isHidden?'':'none';
  btn.textContent=isHidden?'收起':'展开';
}
function updateQATagsState(){
  document.querySelectorAll('.qa-tag').forEach(el=>{
    if(isActive){ el.classList.remove('disabled'); el.draggable=true; }
    else{ el.classList.add('disabled'); el.draggable=false; }
  });
}
let dragTagData=null;
function onTagDragStart(e){
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
  const labelW=140, labelH=30, gap=12;
  const cx=(sMinX+sMaxX)/2, cy=(sMinY+sMaxY)/2;
  const dTop=sMinY-ib.top, dBottom=ib.bottom-sMaxY;
  const dLeft=sMinX-ib.left, dRight=ib.right-sMaxX;
  const minD=Math.min(dTop,dBottom,dLeft,dRight);
  let lx, ly;
  if(minD===dTop){
    lx=Math.max(10, Math.min(cx-labelW/2, vw-labelW-10));
    ly=Math.max(6, ib.top-labelH-gap);
  } else if(minD===dBottom){
    lx=Math.max(10, Math.min(cx-labelW/2, vw-labelW-10));
    ly=Math.min(vh-labelH-6, ib.bottom+gap);
  } else if(minD===dLeft){
    lx=Math.max(10, ib.left-labelW-gap);
    ly=Math.max(6, Math.min(cy-labelH/2, vh-labelH-6));
  } else {
    lx=Math.min(vw-labelW-10, ib.right+gap);
    ly=Math.max(6, Math.min(cy-labelH/2, vh-labelH-6));
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
  // Remove old label DOM elements and target dots
  document.querySelectorAll('.canvas-label,.cl-target-dot,.cl-shape-anchor').forEach(el=>el.remove());
  canvasLabels.forEach(lb=>{
    // Label element
    const el=document.createElement('div');
    el.className='canvas-label '+lb.cls;
    el.id='cl-'+lb.id;
    el.style.left=lb.x+'px';
    el.style.top=lb.y+'px';
    // Apply custom colors
    if(lb.bgColor) el.style.background=lb.bgColor;
    if(lb.textColor) el.style.color=lb.textColor;
    if(lb.bgColor) el.style.borderColor=lb.textColor||'#007AFF';
    // Selected highlight
    if(lb.id===selectedLabelId) el.style.outline='2px solid #ffeb3b';
    el.innerHTML=`<span class="cl-delete" onclick="removeCanvasLabel('${lb.id}')">✕</span>
      <span class="cl-text" contenteditable="true" spellcheck="false"
        onblur="updateCanvasLabelText('${lb.id}',this.textContent)">${lb.text}</span>`;
    makeLabelDraggable(el, lb, 'label');
    viewport.appendChild(el);
    // Target dot only for shape='none' (shape labels use canvas-drawn shapes instead)
    if(!lb.shape || lb.shape==='none'){
      const dot=document.createElement('div');
      dot.className='cl-target-dot';
      dot.id='cld-'+lb.id;
      dot.style.left=(lb.tx-5)+'px';
      dot.style.top=(lb.ty-5)+'px';
      if(lb.lineColor) { dot.style.borderColor=lb.lineColor.replace(/[0-9a-f]{2}$/i,'ff'); }
      makeLabelDraggable(dot, lb, 'target');
      viewport.appendChild(dot);
    }
    // Shape anchors for selected label with shapes
    if(lb.id===selectedLabelId && lb.shape && lb.shape!=='none' && lb.sx!=null){
      if(lb.shape==='rect'||lb.shape==='circle'){
        [{px:'sx',py:'sy',cx:'nwse'},{px:'tx',py:'sy',cx:'nesw'},{px:'sx',py:'ty',cx:'nesw'},{px:'tx',py:'ty',cx:'nwse'}].forEach(h=>{
          const a=document.createElement('div');
          a.className='cl-shape-anchor';
          a.style.left=(lb[h.px]-5)+'px'; a.style.top=(lb[h.py]-5)+'px';
          a.style.cursor=h.cx+'-resize';
          makeShapeAnchorDraggable(a, lb, h.px, h.py);
          viewport.appendChild(a);
        });
      } else if(lb.shape==='arrow'){
        [{px:'sx',py:'sy'},{px:'tx',py:'ty'}].forEach(h=>{
          const a=document.createElement('div');
          a.className='cl-shape-anchor';
          a.style.left=(lb[h.px]-5)+'px'; a.style.top=(lb[h.py]-5)+'px';
          a.style.cursor='move'; a.style.borderRadius='50%';
          makeShapeAnchorDraggable(a, lb, h.px, h.py);
          viewport.appendChild(a);
        });
      }
    }
  });
  drawAnnos();
}
function drawLabelArrowsOnly() {
  if(!annoCtx) return;
  canvasLabels.forEach(lb=>{
    const el=document.getElementById('cl-'+lb.id);
    if(!el) return;
    const lc=lb.lineColor||'#ffffff88';
    const sh=lb.shape||'none';
    annoCtx.save();
    annoCtx.strokeStyle=lc;
    annoCtx.lineWidth=lb.lw||2;
    annoCtx.setLineDash([]);
    // Draw shape if applicable
    if(sh==='rect' && lb.sx!=null){
      annoCtx.beginPath(); annoCtx.strokeRect(lb.sx,lb.sy,lb.tx-lb.sx,lb.ty-lb.sy);
    } else if(sh==='circle' && lb.sx!=null){
      const cx=(lb.sx+lb.tx)/2, cy=(lb.sy+lb.ty)/2;
      const rx=Math.abs(lb.tx-lb.sx)/2, ry=Math.abs(lb.ty-lb.sy)/2;
      annoCtx.beginPath(); annoCtx.ellipse(cx,cy,rx||1,ry||1,0,0,Math.PI*2); annoCtx.stroke();
    } else if(sh==='arrow' && lb.sx!=null){
      drawArrow(annoCtx,lb.sx,lb.sy,lb.tx,lb.ty,lb.lw||2);
    }
    // Draw connector line from shape/target to label
    let fromX, fromY;
    if((sh==='rect'||sh==='circle') && lb.sx!=null){
      const sMinX=Math.min(lb.sx,lb.tx), sMaxX=Math.max(lb.sx,lb.tx);
      const sMinY=Math.min(lb.sy,lb.ty), sMaxY=Math.max(lb.sy,lb.ty);
      const sMidX=(sMinX+sMaxX)/2, sMidY=(sMinY+sMaxY)/2;
      const lblCX=lb.x+el.offsetWidth/2, lblCY=lb.y+el.offsetHeight/2;
      const dx=Math.abs(lblCX-sMidX), dy=Math.abs(lblCY-sMidY);
      if(dy>dx){ fromX=sMidX; fromY=lblCY<sMidY?sMinY:sMaxY; }
      else { fromY=sMidY; fromX=lblCX<sMidX?sMinX:sMaxX; }
    } else if(sh==='arrow' && lb.sx!=null){
      fromX=lb.sx; fromY=lb.sy;
    } else {
      fromX=lb.tx; fromY=lb.ty;
    }
    const toX=lb.x;
    const toY=lb.y+el.offsetHeight/2;
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
      annoCtx.closePath();
      annoCtx.fill();
    }
    annoCtx.restore();
  });
}
function removeCanvasLabel(id){
  canvasLabels=canvasLabels.filter(l=>l.id!==id);
  document.getElementById('cl-'+id)?.remove();
  document.getElementById('cld-'+id)?.remove();
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
function updateCanvasLabelText(id,text){
  const lb=canvasLabels.find(l=>l.id===id); if(lb) lb.text=text.trim()||lb.text;
}
function makeLabelDraggable(el, lb, mode){
  let startX,startY,startLx,startLy,dragging=false;
  el.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('cl-delete')||e.target.classList.contains('cl-text')) return;
    e.preventDefault(); e.stopPropagation(); dragging=true;
    startX=e.clientX; startY=e.clientY;
    if(mode==='label'){ startLx=lb.x; startLy=lb.y; }
    else{ startLx=lb.tx; startLy=lb.ty; }
    // Select this label and show property panel
    if(selectedLabelId!==lb.id){
      selectedLabelId=lb.id;
      labelProps.color=lb.color||labelProps.color;
      labelProps.shape=lb.shape||'none';
      labelProps.lw=lb.lw||2;
      renderPropPanel();
      // Update selection highlight without full re-render (avoid DOM rebuild during drag)
      document.querySelectorAll('.canvas-label').forEach(el2=>el2.style.outline='');
      el.style.outline='2px solid #ffeb3b';
    }
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(mode==='label'){
      lb.x=startLx+dx; lb.y=startLy+dy;
      el.style.left=lb.x+'px'; el.style.top=lb.y+'px';
    } else {
      lb.tx=startLx+dx; lb.ty=startLy+dy;
      el.style.left=(lb.tx-5)+'px'; el.style.top=(lb.ty-5)+'px';
    }
    drawAnnos();
  });
  document.addEventListener('mouseup',()=>{ dragging=false; });
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
  });
  document.addEventListener('mouseup',()=>{
    if(dragging){ dragging=false; renderCanvasLabels(); }
  });
}
