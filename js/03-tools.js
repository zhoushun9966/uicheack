'use strict';
// ====== TOOL SELECTION ======
function highlightSidebarTool(type) {
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('active'));
  if(type){
    // Map eraser sub-types to merged eraser button
    const btnId=(type==='e-mark'||type==='e-ps')?'tool-eraser':'tool-'+type;
    const el=document.getElementById(btnId);if(el)el.classList.add('active');
  }
}
function setTool(t) {
  // Dismiss onboarding guide on first tool use
  if(typeof _autoDismissGuide==='function') _autoDismissGuide();
  if(typeof pendingCropLabelId!=='undefined'&&pendingCropLabelId&&t!=='label'){
    pendingCropLabelId=null;
    hideCropHint();
  }
  // Mutual exclusion: activating a tool clears label selection
  if(t&&selectedLabelId){
    selectedLabelId=null;
    hideActiveCropFloat();
    if(typeof renderCanvasLabels==='function') renderCanvasLabels();
  }
  const _wasActive=activeTool===t;
  activeTool=_wasActive?null:t;
  selectedAnnoIdx=-1; activeHandle=null;
  if(t!=='label') selectedLabelId=null;
  // Default to rect shape when activating label/screenshot tool
  if(t==='label'&&!_wasActive) labelProps.shape='rect';
  drawAnnos();
  highlightSidebarTool(activeTool);
  renderPropPanel(); updateCursor();
}
function updateCursor() {
  const gao=document.getElementById('grid-anno-overlay');
  if(!activeTool){
    clickCanvas.style.cursor='default';
    if(gao) gao.style.cursor=isGridActive()?'default':'';
    eraserCircle.style.display='none'; return;
  }
  let cur='crosshair';
  if(activeTool.startsWith('e-')){cur='none';}
  clickCanvas.style.cursor=cur;
  if(gao) gao.style.cursor=cur;
}

// ====== PROP PANEL ======
function renderPropPanel() {
  const selAnno=selectedAnnoIdx>=0 && curAnnos()[selectedAnnoIdx];
  const panelTool=activeTool||(selAnno?selAnno.type:null);

  // ── MODE 1: Label selected (no active drawing tool) → Label inspection panel ──
  if(selectedLabelId && panelTool!=='label'){
    const lb=canvasLabels.find(l=>l.id===selectedLabelId);
    if(!lb){propPanel.classList.remove('open');setTimeout(syncCanvasSize,220);return;}
    propPanel.classList.add('open');
    const nm=lb.text.match(/^(#\d+)\s*(.*)/s);
    const numPart=nm?nm[1]:''; const descPart=nm?nm[2].trim():lb.text;
    const hasRect=lb.shape==='rect'&&lb.sx!=null&&Math.abs(lb.tx-lb.sx)>8&&Math.abs(lb.ty-lb.sy)>8;
    const hasCrops=hasRect&&gameImg&&psImg;
    let h=`<div class="prop-title">${numPart||'标签'} 属性</div>`;
    h+=`<div class="prop-label-name">${descPart&&descPart!==PLACEHOLDER_TEXT?descPart:'请描述问题'}</div>`;
    // Color picker
    const mc=lb.color||labelProps.color;
    h+='<div class="prop-section"><div class="prop-label">标注颜色</div><div class="cp-row">';
    ['#007AFF','#ff4757','#4ecca3','#ffc107','#a29bfe','#fd79a8','#e17336','#ffffff'].forEach(c=>{
      h+=`<div class="cp-dot${mc===c?' active':''}" style="background:${c}" onclick="setLabelProp('color','${c}')"></div>`;
    });
    h+='</div></div>';
    // Line width
    const lw=lb.lw||2;
    h+=`<div class="prop-section"><div class="prop-label">线条粗细 <span id="lbl-lw-val">${lw}</span></div>
    <input type="range" class="prop-slider" min="1" max="10" value="${lw}" oninput="setLabelProp('lw',+this.value);document.getElementById('lbl-lw-val').textContent=this.value"></div>`;
    // Opacity
    const op=lb.opacity!=null?lb.opacity:0.35;
    h+=`<div class="prop-section"><div class="prop-label">线条透明度 <span id="lbl-op-val">${Math.round(op*100)}%</span></div>
    <input type="range" class="prop-slider" min="0.05" max="1" step="0.05" value="${op}"
      oninput="setLabelProp('opacity',+this.value);document.getElementById('lbl-op-val').textContent=Math.round(this.value*100)+'%'"></div>`;
    // Screenshot action
    if(!hasCrops){
      h+=`<button class="prop-add-screenshot" onclick="startAddScreenshot('${lb.id}')">+ 添加截图对比</button>`;
    } else {
      h+=`<div class="prop-has-screenshot">✓ 已添加截图对比</div>`;
    }
    propInner.innerHTML=h;
    setTimeout(syncCanvasSize,220);
    return;
  }

  // ── MODE 2: Label drawing tool active → Tool options panel ──
  if(panelTool==='label'){
    propPanel.classList.add('open');
    const selLb=selectedLabelId?canvasLabels.find(l=>l.id===selectedLabelId):null;
    const mc=selLb?(selLb.color||labelProps.color):labelProps.color;
    const sh=selLb?(selLb.shape||'none'):labelProps.shape;
    const lw=selLb?(selLb.lw||2):labelProps.lw;
    let h='<div class="prop-title">截图标注</div>';
    const allShapes=[{v:'rect',l:'□'},{v:'circle',l:'○'},{v:'arrow',l:'↗'},{v:'none',l:'──'}];
    const visibleShapes=showMoreAnnotations?allShapes:allShapes.slice(0,1);
    h+='<div class="prop-section"><div class="prop-label">标记类型</div><div class="toggle-row">';
    visibleShapes.forEach(s=>{
      h+=`<button class="tog-btn${sh===s.v?' active':''}" onclick="setLabelProp('shape','${s.v}')" style="font-size:14px">${s.l}</button>`;
    });
    if(!showMoreAnnotations) h+=`<span style="font-size:10px;color:#444;margin-left:4px">更多形状可在⚙设置中开启</span>`;
    h+='</div></div>';
    h+='<div class="prop-section"><div class="prop-label">标注颜色</div><div class="cp-row">';
    ['#007AFF','#ff4757','#4ecca3','#ffc107','#a29bfe','#fd79a8','#e17336','#ffffff'].forEach(c=>{
      h+=`<div class="cp-dot${mc===c?' active':''}" style="background:${c}" onclick="setLabelProp('color','${c}')"></div>`;
    });
    h+='</div></div>';
    const lw2=selLb?(selLb.lw||2):labelProps.lw;
    h+=`<div class="prop-section"><div class="prop-label">线条粗细 <span id="lbl-lw-val">${lw2}</span></div>
    <input type="range" class="prop-slider" min="1" max="10" value="${lw2}" oninput="setLabelProp('lw',+this.value);document.getElementById('lbl-lw-val').textContent=this.value"></div>`;
    const op=selLb?(selLb.opacity!=null?selLb.opacity:0.35):(labelProps.opacity!=null?labelProps.opacity:0.35);
    h+=`<div class="prop-section"><div class="prop-label">线条透明度 <span id="lbl-op-val">${Math.round(op*100)}%</span></div>
    <input type="range" class="prop-slider" min="0.05" max="1" step="0.05" value="${op}"
      oninput="setLabelProp('opacity',+this.value);document.getElementById('lbl-op-val').textContent=Math.round(this.value*100)+'%'"></div>`;
    propInner.innerHTML=h;
    setTimeout(syncCanvasSize,220);
    return;
  }
  if(!panelTool){propPanel.classList.remove('open');setTimeout(syncCanvasSize,220);return;}
  propPanel.classList.add('open');
  let h='<div class="prop-title">'+toolName(panelTool)+'</div>';
  if(panelTool==='brush'){
    h+='<div class="prop-section"><div class="prop-label">颜色</div><div class="cp-row">';
    CP_COLORS.forEach(c=>{h+=`<div class="cp-dot${annoProps.color===c?' active':''}" style="background:${c}" onclick="setPropColor('${c}')"></div>`;});
    h+='</div></div>';
    h+=`<div class="prop-section"><div class="prop-label">线宽 <span id="lw-val">${annoProps.lw}</span></div>
    <input type="range" class="prop-slider" min="1" max="50" value="${annoProps.lw}" oninput="setPropLW(+this.value)"></div>`;
  }
  if(panelTool&&panelTool.startsWith('e-')){
    h+='<div class="prop-section"><div class="prop-label">橡皮类型</div><div class="toggle-row">';
    h+=`<button class="tog-btn${activeTool==='e-mark'?' active':''}" onclick="setEraserType('e-mark')">抹提示</button>`;
    h+=`<button class="tog-btn${activeTool==='e-ps'?' active':''}" onclick="setEraserType('e-ps')">抹设计稿</button>`;
    h+='</div></div>';
    h+=`<div class="prop-section"><div class="prop-label">大小 <span id="es-val">${eraserSize}</span></div>
    <input type="range" class="prop-slider" min="10" max="200" value="${eraserSize}" oninput="setEraserSize(+this.value)"></div>`;
  }
  propInner.innerHTML=h;
  setTimeout(syncCanvasSize,220);
}
function toolName(t){const m={label:'标注',brush:'画笔','e-mark':'抹提示','e-ps':'抹设稿'};return m[t]||t;}

function hitTestCanvasLabel(x, y) {
  for(let i=canvasLabels.length-1;i>=0;i--){
    const lb=canvasLabels[i];
    const el=document.getElementById('cl-'+lb.id);
    if(!el) continue;
    const r=el.getBoundingClientRect();
    const vr=viewport.getBoundingClientRect();
    const lx=r.left-vr.left, ly=r.top-vr.top;
    if(x>=lx && x<=lx+r.width && y>=ly && y<=ly+r.height) return lb;
    // Check target dot / shape area
    if(lb.shape && lb.shape!=='none' && lb.sx!=null){
      const minX=Math.min(lb.sx,lb.tx), maxX=Math.max(lb.sx,lb.tx);
      const minY=Math.min(lb.sy,lb.ty), maxY=Math.max(lb.sy,lb.ty);
      if(x>=minX-5 && x<=maxX+5 && y>=minY-5 && y<=maxY+5) return lb;
    } else {
      if(Math.abs(x-lb.tx)<10 && Math.abs(y-lb.ty)<10) return lb;
    }
  }
  return null;
}
function hitTestLabelShapeOutline(x, y) {
  const t=6;
  for(let i=canvasLabels.length-1;i>=0;i--){
    const lb=canvasLabels[i];
    if(!lb.shape||lb.shape==='none'||lb.sx==null) continue;
    const minX=Math.min(lb.sx,lb.tx), maxX=Math.max(lb.sx,lb.tx);
    const minY=Math.min(lb.sy,lb.ty), maxY=Math.max(lb.sy,lb.ty);
    if(lb.shape==='rect'){
      const onH=(x>=minX-t&&x<=maxX+t)&&(Math.abs(y-minY)<t||Math.abs(y-maxY)<t);
      const onV=(y>=minY-t&&y<=maxY+t)&&(Math.abs(x-minX)<t||Math.abs(x-maxX)<t);
      if(onH||onV) return lb;
    } else if(lb.shape==='circle'){
      const cx2=(lb.sx+lb.tx)/2, cy2=(lb.sy+lb.ty)/2;
      const rx=Math.abs(lb.tx-lb.sx)/2||1, ry=Math.abs(lb.ty-lb.sy)/2||1;
      const d=((x-cx2)/rx)**2+((y-cy2)/ry)**2;
      if(Math.abs(d-1)<0.3) return lb;
    } else if(lb.shape==='arrow'){
      const adx=lb.tx-lb.sx, ady=lb.ty-lb.sy;
      const len=Math.sqrt(adx*adx+ady*ady)||1;
      const dist=Math.abs(ady*x-adx*y+lb.tx*lb.sy-lb.ty*lb.sx)/len;
      if(dist<t && x>=minX-t && x<=maxX+t && y>=minY-t && y<=maxY+t) return lb;
    }
  }
  return null;
}

function deriveLabelColors(c) {
  // From a main color like '#ff4757', derive: bgColor (22 alpha), textColor (full), lineColor (88 alpha)
  const hex=c.replace('#','').slice(0,6);
  return { bgColor:'#'+hex+'22', textColor:'#'+hex, lineColor:'#'+hex+'88' };
}
function setLabelProp(prop, val) {
  labelProps[prop]=val;
  if(selectedLabelId){
    const lb=canvasLabels.find(l=>l.id===selectedLabelId);
    if(lb){
      if(prop==='color'){
        const d=deriveLabelColors(val);
        lb.bgColor=d.bgColor; lb.textColor=d.textColor; lb.lineColor=d.lineColor; lb.color=val;
        renderCanvasLabels();
      } else if(prop==='shape'&&val==='rect'){
        // When selecting rect shape: if label has no existing screenshot rect,
        // trigger the same flow as "添加截图" in the issues drawer
        const hasRect=lb.sx!=null&&Math.abs((lb.tx||0)-(lb.sx||0))>8&&Math.abs((lb.ty||0)-(lb.sy||0))>8;
        if(!hasRect&&typeof startAddScreenshot==='function'){
          startAddScreenshot(lb.id);
          return; // startAddScreenshot handles renderPropPanel internally
        } else {
          lb[prop]=val;
          renderCanvasLabels();
        }
      } else {
        lb[prop]=val;
        renderCanvasLabels();
      }
    }
  }
  renderPropPanel();
}

function syncPropsFromAnno(a) {
  if(a.color) annoProps.color=a.color;
  if(a.lw) annoProps.lw=a.lw;
  if(typeof a.dashed!=='undefined') annoProps.dashed=a.dashed;
  if(a.type==='text') {
    annoProps.fontSize=a.fontSize||20;
    annoProps.bold=!!a.bold; annoProps.italic=!!a.italic; annoProps.underline=!!a.underline;
  }
}
function setPropColor(c) { annoProps.color=c; applyAnnoPropChange(); renderPropPanel(); }
function setPropLW(v) {
  annoProps.lw=v;
  const el=document.getElementById('lw-val'); if(el)el.textContent=v;
  applyAnnoPropChange();
}
function setPropDashed(v) { annoProps.dashed=v; applyAnnoPropChange(); renderPropPanel(); }
function setPropFS(v) {
  annoProps.fontSize=v;
  const el=document.getElementById('fs-val'); if(el)el.textContent=v;
  applyAnnoPropChange();
}
function setPropBold() { annoProps.bold=!annoProps.bold; applyAnnoPropChange(); renderPropPanel(); }
function setPropItalic() { annoProps.italic=!annoProps.italic; applyAnnoPropChange(); renderPropPanel(); }
function setPropUnderline() { annoProps.underline=!annoProps.underline; applyAnnoPropChange(); renderPropPanel(); }
function setEraserSize(v) { eraserSize=v; const el=document.getElementById('es-val'); if(el)el.textContent=v; }

// Propagate prop changes to: text overlay (if active) + any selected annotation
function applyAnnoPropChange() {
  const ov=document.getElementById('text-input-overlay');
  if(ov.style.display!=='none') {
    ov.style.color=annoProps.color;
    ov.style.fontSize=Math.round(annoProps.fontSize/canvasScale)+'px';
    ov.style.fontWeight=annoProps.bold?'bold':'normal';
    ov.style.fontStyle=annoProps.italic?'italic':'normal';
    ov.style.textDecoration=annoProps.underline?'underline':'none';
  }
  if(selectedAnnoIdx>=0 && curAnnos()[selectedAnnoIdx]) {
    const a=curAnnos()[selectedAnnoIdx];
    a.color=annoProps.color;
    if(typeof a.lw!=='undefined'||['rect','circle','line','arrow','brush'].includes(a.type)) a.lw=annoProps.lw;
    if(['rect','circle','line'].includes(a.type)) a.dashed=annoProps.dashed;
    if(a.type==='text') {
      a.fontSize=annoProps.fontSize;
      a.bold=annoProps.bold; a.italic=annoProps.italic; a.underline=annoProps.underline;
    }
    drawAnnos();
  }
}

// ====== getPos ======
function getPos(e) {
  // Eraser tools need image-space coordinates (for markCanvas/mGenCanvas)
  if(activeTool && activeTool.startsWith('e-')) {
    return getImagePos(e);
  }
  // Annotation tools use viewport coordinates (allow drawing outside image)
  const r=viewport.getBoundingClientRect();
  return {x:e.clientX-r.left-panX, y:e.clientY-r.top-panY};
}
function getImagePos(e) {
  const refImg=gameImg||psImg;
  if(!refImg) return {x:0,y:0};
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  const nw=refImg.naturalWidth, nh=refImg.naturalHeight;
  let w=vw, h=vw*nh/nw;
  if(h>vh){h=vh;w=vh*nw/nh;}
  w=Math.floor(w*zoomLevel); h=Math.floor(h*zoomLevel);
  const ox=(vw-w)/2+panX, oy=(vh-h)/2+panY; // account for pan
  const r=viewport.getBoundingClientRect();
  const cx=e.clientX-r.left, cy=e.clientY-r.top;
  const scale=nw/w;
  return {x:(cx-ox)*scale, y:(cy-oy)*scale};
}
function getPosInGrid(e) {
  const modes=['compare','outline','findiff','vsplit'];
  const activeMap={compare:isComparing,outline:isOutline,findiff:isFindiff,vsplit:isVSplit};
  for(const mode of modes) {
    if(!activeMap[mode]||!panelCache[mode]) continue;
    const panel=document.getElementById('panel-'+mode);
    const r=panel.getBoundingClientRect();
    if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom) {
      if(mode==='vsplit'&&gameImg) {
        const halfH=r.height/2;
        const s=Math.min(r.width/gameImg.naturalWidth,halfH/gameImg.naturalHeight);
        const aox=r.left+(r.width-gameImg.naturalWidth*s)/2;
        const aoy=r.top+halfH+(halfH-gameImg.naturalHeight*s)/2;
        return {x:(e.clientX-aox)/s, y:(e.clientY-aoy)/s};
      }
      const cache=panelCache[mode];
      const pw=r.width, ph=r.height;
      const scale=Math.min(pw/cache.width,ph/cache.height);
      const ox=(pw-cache.width*scale)/2, oy=(ph-cache.height*scale)/2;
      return {x:(e.clientX-r.left-ox)/scale, y:(e.clientY-r.top-oy)/scale};
    }
  }
  // fallback: first active panel
  for(const mode of modes) {
    if(!activeMap[mode]||!panelCache[mode]) continue;
    const panel=document.getElementById('panel-'+mode);
    const r=panel.getBoundingClientRect();
    if(mode==='vsplit'&&gameImg) {
      const halfH=r.height/2;
      const s=Math.min(r.width/gameImg.naturalWidth,halfH/gameImg.naturalHeight);
      const aox=r.left+(r.width-gameImg.naturalWidth*s)/2;
      const aoy=r.top+halfH+(halfH-gameImg.naturalHeight*s)/2;
      return {x:(e.clientX-aox)/s, y:(e.clientY-aoy)/s};
    }
    const cache=panelCache[mode];
    const pw=r.width, ph=r.height;
    const scale=Math.min(pw/cache.width,ph/cache.height);
    const ox=(pw-cache.width*scale)/2, oy=(ph-cache.height*scale)/2;
    return {x:(e.clientX-r.left-ox)/scale, y:(e.clientY-r.top-oy)/scale};
  }
  return {x:0,y:0};
}

// ====== HIT TEST & HANDLES ======
const HANDLE_CURSORS = {
  tl:'nwse-resize', tc:'ns-resize', tr:'nesw-resize',
  ml:'ew-resize',                   mr:'ew-resize',
  bl:'nesw-resize', bc:'ns-resize', br:'nwse-resize',
  p1:'crosshair', p2:'crosshair'
};

function getHandles(a) {
  if(['line','arrow'].includes(a.type))
    return [{id:'p1',x:a.x1,y:a.y1},{id:'p2',x:a.x2,y:a.y2}];
  if(['rect','circle'].includes(a.type)) {
    const x1=Math.min(a.x1,a.x2), y1=Math.min(a.y1,a.y2);
    const x2=Math.max(a.x1,a.x2), y2=Math.max(a.y1,a.y2);
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    return [{id:'tl',x:x1,y:y1},{id:'tc',x:mx,y:y1},{id:'tr',x:x2,y:y1},
            {id:'ml',x:x1,y:my},                     {id:'mr',x:x2,y:my},
            {id:'bl',x:x1,y:y2},{id:'bc',x:mx,y:y2},{id:'br',x:x2,y:y2}];
  }
  return [];
}

function hitTestHandle(handles, px, py) {
  const r = 7 * (isGridActive() ? 1 : canvasScale);
  for(const h of handles) {
    if(Math.abs(px-h.x)<=r && Math.abs(py-h.y)<=r) return h.id;
  }
  return null;
}

function applyHandleDrag(a, hid, dx, dy) {
  if(hid==='p1'){a.x1+=dx;a.y1+=dy; return;}
  if(hid==='p2'){a.x2+=dx;a.y2+=dy; return;}
  // rect / circle: map handle id to which edge(s) move
  const leftEdge  = hid==='tl'||hid==='ml'||hid==='bl';
  const rightEdge = hid==='tr'||hid==='mr'||hid==='br';
  const topEdge   = hid==='tl'||hid==='tc'||hid==='tr';
  const botEdge   = hid==='bl'||hid==='bc'||hid==='br';
  // x1 is always left side, x2 right side (keep normalized via Math.min)
  const x1=Math.min(a.x1,a.x2), x2=Math.max(a.x1,a.x2);
  const y1=Math.min(a.y1,a.y2), y2=Math.max(a.y1,a.y2);
  let nx1=x1, nx2=x2, ny1=y1, ny2=y2;
  if(leftEdge)  nx1=Math.min(nx1+dx, nx2-2);
  if(rightEdge) nx2=Math.max(nx2+dx, nx1+2);
  if(topEdge)   ny1=Math.min(ny1+dy, ny2-2);
  if(botEdge)   ny2=Math.max(ny2+dy, ny1+2);
  a.x1=nx1; a.x2=nx2; a.y1=ny1; a.y2=ny2;
}

function getAnnoBounds(a) {
  if(a.type==='text') {
    const fs=a.fontSize||20;
    return {x:a.x-4,y:a.y-fs-4,w:fs*a.text.length*0.6+8,h:fs+12};
  }
  if(a.type==='brush') {
    const xs=a.pts.map(p=>p.x), ys=a.pts.map(p=>p.y);
    const x1=Math.min(...xs),y1=Math.min(...ys),x2=Math.max(...xs),y2=Math.max(...ys);
    const pad=a.lw||2;
    return {x:x1-pad,y:y1-pad,w:x2-x1+pad*2,h:y2-y1+pad*2};
  }
  const x1=Math.min(a.x1,a.x2), y1=Math.min(a.y1,a.y2);
  const x2=Math.max(a.x1,a.x2), y2=Math.max(a.y1,a.y2);
  const pad=Math.max(a.lw||2,6);
  return {x:x1-pad,y:y1-pad,w:x2-x1+pad*2,h:y2-y1+pad*2};
}

function hitTestAnno(a, px, py) {
  const b=getAnnoBounds(a);
  return px>=b.x && px<=b.x+b.w && py>=b.y && py<=b.y+b.h;
}

function moveAnno(a, dx, dy) {
  if(a.type==='text'){a.x+=dx;a.y+=dy;}
  else if(a.type==='brush'){a.pts=a.pts.map(p=>({x:p.x+dx,y:p.y+dy}));}
  else{a.x1+=dx;a.y1+=dy;a.x2+=dx;a.y2+=dy;}
}

function distToSeg(px,py,x1,y1,x2,y2) {
  const dx=x2-x1, dy=y2-y1, lenSq=dx*dx+dy*dy;
  if(!lenSq) return Math.sqrt((px-x1)**2+(py-y1)**2);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/lenSq));
  return Math.sqrt((px-(x1+t*dx))**2+(py-(y1+t*dy))**2);
}

// Hit-test only the stroke/outline of an annotation (not interior fill)
// Used when a drawing tool is active: rect/circle interior is still drawable
function hitTestAnnoOutline(a, px, py) {
  const tol = 8 * (isGridActive() ? 1 : canvasScale);
  if(a.type==='rect') {
    const x1=Math.min(a.x1,a.x2), y1=Math.min(a.y1,a.y2);
    const x2=Math.max(a.x1,a.x2), y2=Math.max(a.y1,a.y2);
    const inH=px>=x1-tol && px<=x2+tol, inV=py>=y1-tol && py<=y2+tol;
    return (inH&&(Math.abs(py-y1)<tol||Math.abs(py-y2)<tol))||
           (inV&&(Math.abs(px-x1)<tol||Math.abs(px-x2)<tol));
  }
  if(a.type==='circle') {
    const cx=(a.x1+a.x2)/2, cy=(a.y1+a.y2)/2;
    const rx=Math.abs(a.x2-a.x1)/2, ry=Math.abs(a.y2-a.y1)/2;
    if(!rx||!ry) return false;
    const dist=Math.sqrt(((px-cx)/rx)**2+((py-cy)/ry)**2);
    return Math.abs(dist-1) < tol/Math.min(rx,ry);
  }
  if(a.type==='line'||a.type==='arrow')
    return distToSeg(px,py,a.x1,a.y1,a.x2,a.y2) < tol;
  if(a.type==='brush') {
    const pts=a.pts;
    for(let i=0;i<pts.length-1;i++)
      if(distToSeg(px,py,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y)<tol) return true;
    return false;
  }
  if(a.type==='text') return hitTestAnno(a,px,py);
  return false;
}

function updateHoverCursor(p) {
  if(selectedAnnoIdx>=0) {
    const hid=hitTestHandle(getHandles(curAnnos()[selectedAnnoIdx]),p.x,p.y);
    if(hid){clickCanvas.style.cursor=HANDLE_CURSORS[hid]||'crosshair'; return;}
  }
  const hovering=curAnnos().some(a=>hitTestAnno(a,p.x,p.y));
  if(hovering){clickCanvas.style.cursor='move'; return;}
  // Check shape outline hover for canvas labels
  const shapeHit=hitTestLabelShapeOutline(p.x,p.y);
  clickCanvas.style.cursor=shapeHit?'move':'default';
}

// ====== ERASER (merged) ======
function activateEraser() {
  // Toggle eraser off if already in eraser mode
  if(activeTool==='e-mark'||activeTool==='e-ps'){
    activeTool=null; highlightSidebarTool(null); updateCursor(); renderPropPanel(); return;
  }
  activeTool=eraserType; highlightSidebarTool(activeTool); renderPropPanel(); updateCursor();
}
function setEraserType(type) {
  eraserType=type; activeTool=type;
  highlightSidebarTool(activeTool); renderPropPanel(); updateCursor();
}

// ====== MORE ANNOTATIONS SETTING ======
function setShowMoreAnnotations(show) {
  showMoreAnnotations=show;
  document.getElementById('anno-more-off')?.classList.toggle('active',!show);
  document.getElementById('anno-more-on')?.classList.toggle('active',show);
  // If more annotations turned off, reset shape to rect
  if(!show&&labelProps.shape!=='rect') labelProps.shape='rect';
  renderPropPanel();
}
