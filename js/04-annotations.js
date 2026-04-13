'use strict';
// ====== ANNO EVENTS ======
function bindAnnoEvents() {
  // clickCanvas is topmost (z-index:11), so bind all events here
  clickCanvas.addEventListener('mousedown', onAnnoDown);
  clickCanvas.addEventListener('mousemove', e=>{ onAnnoMove(e); onClickCanvasMove(e); });
  clickCanvas.addEventListener('mouseup', onAnnoUp);
  clickCanvas.addEventListener('mouseleave', e=>{ onAnnoLeave(); canvasTooltip.style.display='none'; });
  clickCanvas.addEventListener('click', onClickCanvasClick);
  clickCanvas.addEventListener('contextmenu', e=>{e.preventDefault();});
}

function onAnnoDown(e) {
  // If text input is in progress, clicking canvas commits it and stops
  if(pendingTextCommit) { pendingTextCommit(); return; }

  const p=getPos(e);

  // No active tool → selection / move / resize
  if(!activeTool) {
    isMouseDown=true;
    // Check canvas label hit first (works in any tool state)
    const hitLb=hitTestCanvasLabel(p.x,p.y);
    if(hitLb){
      selectedLabelId=hitLb.id;
      labelProps.color=hitLb.color||labelProps.color;
      labelProps.shape=hitLb.shape||'none';
      labelProps.lw=hitLb.lw||2;
      renderPropPanel(); renderCanvasLabels();
      // If click landed inside shape area (not on the label text element), start shape-body drag
      if(hitLb.shape && hitLb.shape!=='none' && hitLb.sx!=null){
        const _el=document.getElementById('cl-'+hitLb.id);
        const _vr=viewport.getBoundingClientRect();
        let _onLabel=false;
        if(_el){const _r=_el.getBoundingClientRect();_onLabel=p.x>=(_r.left-_vr.left)&&p.x<=(_r.left-_vr.left+_r.width)&&p.y>=(_r.top-_vr.top)&&p.y<=(_r.top-_vr.top+_r.height);}
        if(!_onLabel){
          isDraggingAnno=true; activeHandle='shape-body';
          dragOffX=p.x; dragOffY=p.y;
          _shapeDragLb=hitLb;
          _shapeDragStart={sx:hitLb.sx,sy:hitLb.sy,tx:hitLb.tx,ty:hitLb.ty,x:hitLb.x,y:hitLb.y};
          saveHist();
        }
      }
      return;
    }
    selectedLabelId=null;
    hideActiveCropFloat();
    // Check shape outline hit → drag entire label+shape
    const shapeLb=hitTestLabelShapeOutline(p.x,p.y);
    if(shapeLb){
      selectedLabelId=shapeLb.id;
      labelProps.color=shapeLb.color||labelProps.color;
      labelProps.shape=shapeLb.shape||'none';
      labelProps.lw=shapeLb.lw||2;
      renderPropPanel(); renderCanvasLabels();
      // Start shape drag
      isDraggingAnno=true; activeHandle='shape-body';
      dragOffX=p.x; dragOffY=p.y;
      _shapeDragLb=shapeLb;
      _shapeDragStart={sx:shapeLb.sx,sy:shapeLb.sy,tx:shapeLb.tx,ty:shapeLb.ty,x:shapeLb.x,y:shapeLb.y};
      saveHist();
      return;
    }
    // 1. Check handle hit on currently selected annotation
    if(selectedAnnoIdx>=0) {
      const hid=hitTestHandle(getHandles(curAnnos()[selectedAnnoIdx]),p.x,p.y);
      if(hid) {
        activeHandle=hid; isDraggingAnno=true;
        dragOffX=p.x; dragOffY=p.y;
        saveHist();
        return;
      }
    }
    // 2. Check body hit (pick topmost)
    let hit=-1;
    for(let i=curAnnos().length-1;i>=0;i--) {
      if(hitTestAnno(curAnnos()[i],p.x,p.y)){hit=i;break;}
    }
    if(hit>=0) {
      selectedAnnoIdx=hit; activeHandle='body'; isDraggingAnno=true;
      dragOffX=p.x; dragOffY=p.y;
      syncPropsFromAnno(curAnnos()[hit]);
      activeTool=curAnnos()[hit].type;
      highlightSidebarTool(activeTool);
      updateCursor();
      saveHist();
    } else {
      selectedAnnoIdx=-1; activeHandle=null; isDraggingAnno=false;
      activeTool=null;
      highlightSidebarTool(null);
      updateCursor();
      // Clear label selection border and close prop panel
      if(typeof pendingCropLabelId!=='undefined'&&pendingCropLabelId) cancelAddScreenshot();
      if(typeof renderCanvasLabels==='function') renderCanvasLabels();
    }
    drawAnnos(); renderPropPanel(); return;
  }

  isMouseDown=true;

  // Check canvas label hit for any non-eraser tool
  if(!activeTool.startsWith('e-') && activeTool!=='label') {
    const hitLb=hitTestCanvasLabel(p.x,p.y);
    if(hitLb){
      selectedLabelId=hitLb.id;
      labelProps.color=hitLb.color||labelProps.color;
      labelProps.shape=hitLb.shape||'none';
      labelProps.lw=hitLb.lw||2;
      renderPropPanel(); renderCanvasLabels();
      return;
    }
  }

  // Tool active but not erasing → check handles/outline of existing annotations first
  if(!activeTool.startsWith('e-')) {
    // 1. If already selected, check handle hit first (resize/stretch)
    if(selectedAnnoIdx>=0) {
      const hid=hitTestHandle(getHandles(curAnnos()[selectedAnnoIdx]),p.x,p.y);
      if(hid) {
        activeHandle=hid; isDraggingAnno=true;
        dragOffX=p.x; dragOffY=p.y;
        saveHist(); return;
      }
    }
    // 2. Check outline hit → select + move
    let outlineHit=-1;
    for(let i=curAnnos().length-1;i>=0;i--) {
      if(hitTestAnnoOutline(curAnnos()[i],p.x,p.y)){outlineHit=i;break;}
    }
    if(outlineHit>=0) {
      selectedAnnoIdx=outlineHit; activeHandle='body'; isDraggingAnno=true;
      dragOffX=p.x; dragOffY=p.y;
      syncPropsFromAnno(curAnnos()[outlineHit]);
      activeTool=curAnnos()[outlineHit].type;
      highlightSidebarTool(activeTool);
      updateCursor();
      saveHist(); drawAnnos(); renderPropPanel(); return;
    }
    // 3. Click on empty area → deselect, restore tool highlight, then fall through to draw
    if(selectedAnnoIdx>=0) { selectedAnnoIdx=-1; activeHandle=null; highlightSidebarTool(activeTool); drawAnnos(); renderPropPanel(); }
  }

  startX=p.x; startY=p.y;
  if(activeTool==='brush') brushPoints=[{x:p.x,y:p.y}];
  if(activeTool==='text') {
    textAnnoX=p.x; textAnnoY=p.y;
    showTextOverlay();
    isMouseDown=false; return;
  }
  if(activeTool==='label') {
    // Check if clicking an existing label to select it
    const hitLb=hitTestCanvasLabel(p.x,p.y);
    if(hitLb){
      selectedLabelId=hitLb.id;
      labelProps.color=hitLb.color||labelProps.color;
      labelProps.shape=hitLb.shape||'none';
      labelProps.lw=hitLb.lw||2;
      renderPropPanel();
      renderCanvasLabels();
      isMouseDown=true; // allow dragging
      return;
    }
    // Start creating new label: mousedown = label position
    selectedLabelId=null;
    startX=p.x; startY=p.y;
  }
  saveHist();
}

function onAnnoMove(e) {
  // Grid pan (when no tool active and dragging in grid mode)
  if(isGridActive() && !activeTool && gridPanStart && isMouseDown) {
    gridPanX=e.clientX-gridPanStart.x;
    gridPanY=e.clientY-gridPanStart.y;
    applyGridTransform(); return;
  }
  const p=getPos(e);

  // No active tool → select/hover mode
  if(!activeTool) {
    if(isMouseDown && isDraggingAnno && activeHandle==='shape-body' && _shapeDragLb) {
      const dx=p.x-dragOffX, dy=p.y-dragOffY;
      _shapeDragLb.sx+=dx; _shapeDragLb.sy+=dy;
      _shapeDragLb.tx+=dx; _shapeDragLb.ty+=dy;
      _shapeDragLb.x+=dx; _shapeDragLb.y+=dy;
      dragOffX=p.x; dragOffY=p.y;
      renderCanvasLabels(); drawAnnos();
    } else if(isMouseDown && isDraggingAnno && selectedAnnoIdx>=0) {
      const dx=p.x-dragOffX, dy=p.y-dragOffY;
      if(activeHandle==='body') moveAnno(curAnnos()[selectedAnnoIdx],dx,dy);
      else applyHandleDrag(curAnnos()[selectedAnnoIdx],activeHandle,dx,dy);
      dragOffX=p.x; dragOffY=p.y;
      drawAnnos();
    } else {
      updateHoverCursor(p);
    }
    return;
  }

  // Tool active: if dragging an annotation (body move or handle resize)
  if(isMouseDown && isDraggingAnno && selectedAnnoIdx>=0) {
    const dx=p.x-dragOffX, dy=p.y-dragOffY;
    if(activeHandle==='body') moveAnno(curAnnos()[selectedAnnoIdx],dx,dy);
    else applyHandleDrag(curAnnos()[selectedAnnoIdx],activeHandle,dx,dy);
    dragOffX=p.x; dragOffY=p.y;
    drawAnnos(); return;
  }

  // eraser circle
  if(activeTool.startsWith('e-')) {
    eraserCircle.style.display='block';
    eraserCircle.style.left=e.clientX+'px'; eraserCircle.style.top=e.clientY+'px';
    const sz=eraserSize/canvasScale;
    eraserCircle.style.width=(sz*2)+'px'; eraserCircle.style.height=(sz*2)+'px';
  } else { eraserCircle.style.display='none'; }

  // Hover cursor: check handles of selected annotation, then outline (only when not erasing)
  if(!isMouseDown && !activeTool.startsWith('e-')) {
    if(selectedAnnoIdx>=0) {
      const hid=hitTestHandle(getHandles(curAnnos()[selectedAnnoIdx]),p.x,p.y);
      if(hid){clickCanvas.style.cursor=HANDLE_CURSORS[hid]||'crosshair'; return;}
    }
    const onOutline=curAnnos().some(a=>hitTestAnnoOutline(a,p.x,p.y));
    if(onOutline){clickCanvas.style.cursor='move'; return;}
    const shapeHit=hitTestLabelShapeOutline(p.x,p.y);
    clickCanvas.style.cursor=shapeHit?'move':'crosshair';
    return;
  }

  if(!isMouseDown) return;
  if(activeTool==='label') {
    drawAnnos();
    annoCtx.save();
    annoCtx.translate(panX, panY); // keep preview aligned with pan
    const sh=labelProps.shape;
    const lc=deriveLabelColors(labelProps.color).lineColor;
    annoCtx.strokeStyle=lc;
    annoCtx.lineWidth=labelProps.lw||2;
    annoCtx.setLineDash([]);
    if(sh==='rect'){
      annoCtx.beginPath(); annoCtx.strokeRect(startX,startY,p.x-startX,p.y-startY);
    } else if(sh==='circle'){
      const cx=(startX+p.x)/2, cy=(startY+p.y)/2;
      const rx=Math.abs(p.x-startX)/2, ry=Math.abs(p.y-startY)/2;
      annoCtx.beginPath(); annoCtx.ellipse(cx,cy,rx||1,ry||1,0,0,Math.PI*2); annoCtx.stroke();
    } else if(sh==='arrow'){
      drawArrow(annoCtx,startX,startY,p.x,p.y,labelProps.lw||2);
    } else {
      // none: dashed line preview
      annoCtx.lineWidth=1.5;
      annoCtx.setLineDash([4,3]);
      annoCtx.beginPath(); annoCtx.moveTo(startX,startY); annoCtx.lineTo(p.x,p.y); annoCtx.stroke();
      annoCtx.setLineDash([]);
    }
    annoCtx.restore();
    return;
  }
  if(activeTool==='brush') { brushPoints.push({x:p.x,y:p.y}); drawAnnos(p); return; }
  if(activeTool==='e-mark') { applyEraser(markCtx,p); return; }
  if(activeTool==='e-ps') { applyEraser(mGenCtx,p); updatePSMask(); return; }
  drawAnnos(p);
}

function onAnnoUp(e) {
  if(!isMouseDown) return;
  isMouseDown=false;
  if(gridPanStart){gridPanStart=null;return;}

  // End any drag/resize (both no-tool and tool-active-outline-move)
  if(isDraggingAnno) {
    isDraggingAnno=false; activeHandle=null;
    _shapeDragLb=null; _shapeDragStart=null;
    return;
  }

  if(!activeTool) return;

  const p=getPos(e);
  if(activeTool==='label') {
    const dx=p.x-startX, dy=p.y-startY;
    if(Math.sqrt(dx*dx+dy*dy)<8) { drawAnnos(); return; }

    // "添加截图" flow: link rect coords to an existing label instead of creating new
    if(typeof pendingCropLabelId!=='undefined' && pendingCropLabelId && labelProps.shape==='rect') {
      const targetLb=canvasLabels.find(l=>l.id===pendingCropLabelId);
      if(targetLb) {
        saveHist();
        targetLb.shape='rect';
        targetLb.sx=startX; targetLb.sy=startY;
        targetLb.tx=p.x;   targetLb.ty=p.y;
        const _lp=placeLabelOutside(Math.min(startX,p.x),Math.min(startY,p.y),Math.max(startX,p.x),Math.max(startY,p.y));
        targetLb.x=_lp.x; targetLb.y=_lp.y;
        selectedLabelId=targetLb.id;
        pendingCropLabelId=null;
        hideCropHint();
        activeTool=null;
        highlightSidebarTool(null);
        updateCursor();
        renderCanvasLabels();
        renderPropPanel();
        return;
      }
    }

    saveHist();
    labelCounter++;
    const id='cl'+Date.now()+Math.random().toString(36).slice(2,6);
    const sh=labelProps.shape;
    let lx, ly, tx, ty, sx, sy;
    if(sh==='rect'||sh==='circle'){
      sx=startX; sy=startY; tx=p.x; ty=p.y;
      const _lp=placeLabelOutside(Math.min(sx,tx),Math.min(sy,ty),Math.max(sx,tx),Math.max(sy,ty));
      lx=_lp.x; ly=_lp.y;
    } else if(sh==='arrow'){
      sx=startX; sy=startY; tx=p.x; ty=p.y;
      const _lp=placeLabelOutside(Math.min(sx,tx),Math.min(sy,ty),Math.max(sx,tx),Math.max(sy,ty));
      lx=_lp.x; ly=_lp.y;
    } else {
      sx=startX; sy=startY;
      tx=p.x; ty=p.y;
      const _lp=placeLabelOutside(tx, ty, tx, ty);
      lx=_lp.x; ly=_lp.y;
    }
    // Color rotation for rect shapes (screenshot marks), fixed color for others
    let _useColor=labelProps.color;
    if(sh==='rect'&&typeof CROP_COLORS!=='undefined'){
      _useColor=CROP_COLORS[cropColorIndex%CROP_COLORS.length];
      cropColorIndex++;
    }
    const dc=deriveLabelColors(_useColor);
    canvasLabels.push({id, text:'#'+labelCounter+' '+(typeof PLACEHOLDER_TEXT!=='undefined'?PLACEHOLDER_TEXT:'请描述问题'), cls:'qa-minor',
      x:lx, y:ly, tx:tx, ty:ty, sx:sx, sy:sy,
      shape:sh, lw:labelProps.lw, color:_useColor,
      opacity:labelProps.opacity!=null?labelProps.opacity:0.35,
      bgColor:dc.bgColor, textColor:dc.textColor, lineColor:dc.lineColor});
    selectedLabelId=id;
    // Switch from tool mode to label inspection mode after drawing
    activeTool=null;
    highlightSidebarTool(null);
    updateCursor();
    renderCanvasLabels();
    renderPropPanel();
    // Auto-focus the title field so user can type immediately
    setTimeout(()=>{
      const panel=document.getElementById('lcp-'+id);
      if(panel){
        const title=panel.querySelector('.lcp-title');
        if(title){
          title.focus();
          const range=document.createRange();
          range.selectNodeContents(title);
          range.collapse(false);
          const sel=window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
        }
      }
    },80);
    return;
  }
  if(['rect','circle','line','arrow'].includes(activeTool)) {
    curAnnos().push({type:activeTool,x1:startX,y1:startY,x2:p.x,y2:p.y,color:annoProps.color,lw:annoProps.lw,dashed:annoProps.dashed});
  } else if(activeTool==='brush') {
    brushPoints.push({x:p.x,y:p.y});
    curAnnos().push({type:'brush',pts:[...brushPoints],color:annoProps.color,lw:annoProps.lw});
    brushPoints=[];
  }
  drawAnnos();
}

function onAnnoLeave() {
  eraserCircle.style.display='none';
  if(isMouseDown) onAnnoUp({clientX:0,clientY:0});
}

function showTextOverlay() {
  const ov=document.getElementById('text-input-overlay');
  const vr=viewport.getBoundingClientRect();
  let left, top, fontSize;
  if(isGridActive()) {
    // In grid mode: textAnnoX/Y are grid-container screen coords
    const gc=document.getElementById('grid-container');
    const gr=gc.getBoundingClientRect();
    left=(gr.left-vr.left+textAnnoX)+'px';
    top=(gr.top-vr.top+textAnnoY)+'px';
    fontSize=annoProps.fontSize+'px';
  } else {
    const lr=layers.getBoundingClientRect();
    left=(lr.left-vr.left+textAnnoX/canvasScale)+'px';
    top=(lr.top-vr.top+textAnnoY/canvasScale)+'px';
    fontSize=Math.round(annoProps.fontSize/canvasScale)+'px';
  }
  ov.style.left=left; ov.style.top=top;
  ov.style.fontSize=fontSize;
  ov.style.color=annoProps.color;
  ov.style.fontWeight=annoProps.bold?'bold':'normal';
  ov.style.fontStyle=annoProps.italic?'italic':'normal';
  ov.style.textDecoration=annoProps.underline?'underline':'none';
  ov.value='';
  ov.style.display='block';

  let committed=false;
  function commitText() {
    if(committed) return; committed=true;
    pendingTextCommit=null;
    const txt=ov.value.trim();
    if(txt) {
      saveHist();
      curAnnos().push({type:'text',x:textAnnoX,y:textAnnoY,text:txt,
        color:annoProps.color,fontSize:annoProps.fontSize,
        bold:annoProps.bold,italic:annoProps.italic,underline:annoProps.underline});
      drawAnnos();
    }
    ov.style.display='none';
  }
  pendingTextCommit=commitText;

  ov.onkeydown=ev=>{
    if(ev.key==='Escape'){committed=true; pendingTextCommit=null; ov.style.display='none';}
    if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault(); commitText();}
  };
  ov.onblur=()=>{ if(!suppressTextBlur) setTimeout(commitText, 80); };
  setTimeout(()=>ov.focus(), 0);
}

function applyEraser(ctx, p) {
  ctx.save();
  ctx.globalCompositeOperation='destination-out';
  ctx.beginPath();
  ctx.arc(p.x,p.y,eraserSize,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,1)';
  ctx.fill();
  ctx.restore();
}

function updatePSMask() {
  if(!psImg) return;
  const url=mGenCanvas.toDataURL();
  psLayer.style.webkitMaskImage='url('+url+')';
  psLayer.style.maskImage='url('+url+')';
  psLayer.style.webkitMaskSize='100% 100%';
  psLayer.style.maskSize='100% 100%';
}

// ====== DRAW ANNOS ======
function drawAnnos(liveEnd) {
  const ctx=annoCtx, cw=annoCanvas.width, ch=annoCanvas.height;
  ctx.clearRect(0,0,cw,ch);
  ctx.save();
  ctx.translate(panX, panY); // pan offset so annotations move with canvas
  curAnnos().forEach((a,i)=>{
    drawAnno(ctx,a);
    if(i===selectedAnnoIdx) drawSelectionHandles(ctx,a);
  });
  // live preview
  if(isMouseDown && activeTool && liveEnd) {
    const p=annoProps;
    if(activeTool==='brush') {
      drawBrushPts(ctx,brushPoints,p.color,p.lw);
    } else if(['rect','circle','line','arrow'].includes(activeTool)) {
      drawAnno(ctx,{type:activeTool,x1:startX,y1:startY,x2:liveEnd.x,y2:liveEnd.y,color:p.color,lw:p.lw,dashed:p.dashed});
    }
  }
  // Draw label arrows (must be at end so they're not cleared)
  drawLabelArrowsOnly();
  ctx.restore();
}
function refreshGridPanels() { if(isActive) renderCurrentMode(); }
// Legacy: single mode panel render (unused, kept for compat)
function renderModePanel(mode) {}

function drawSelectionHandles(ctx, a) {
  const cs = isGridActive() ? 1 : (canvasScale || 1);
  const handles = getHandles(a);
  ctx.save();

  if(handles.length === 2) {
    handles.forEach(h=>{
      const r = 6 * cs;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI*2);
      ctx.fillStyle='#ffffff'; ctx.fill();
      ctx.strokeStyle='#007AFF'; ctx.lineWidth=1.5*cs; ctx.stroke();
    });
  } else {
    const b=getAnnoBounds(a);
    ctx.strokeStyle='#007AFF';
    ctx.lineWidth=1.5*cs;
    ctx.setLineDash([5*cs, 3*cs]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    const hs = 7 * cs;
    handles.forEach(h=>{
      ctx.fillStyle='#ffffff';
      ctx.fillRect(h.x-hs/2, h.y-hs/2, hs, hs);
      ctx.strokeStyle='#007AFF';
      ctx.lineWidth=1.5*cs;
      ctx.strokeRect(h.x-hs/2, h.y-hs/2, hs, hs);
    });
  }

  if(!handles.length) {
    const b=getAnnoBounds(a);
    ctx.strokeStyle='#007AFF';
    ctx.lineWidth=1.5*cs;
    ctx.setLineDash([5*cs, 3*cs]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawAnno(ctx,a) {
  ctx.save();
  ctx.strokeStyle=a.color; ctx.fillStyle=a.color; ctx.lineWidth=a.lw||2;
  if(a.dashed){const lw=a.lw||2; ctx.setLineDash([lw*3, lw*2]);} else ctx.setLineDash([]);
  ctx.lineCap='round'; ctx.lineJoin='round';
  switch(a.type) {
    case 'rect':
      ctx.beginPath(); ctx.strokeRect(a.x1,a.y1,a.x2-a.x1,a.y2-a.y1); break;
    case 'circle': {
      const cx=(a.x1+a.x2)/2, cy=(a.y1+a.y2)/2;
      const rx=Math.abs(a.x2-a.x1)/2, ry=Math.abs(a.y2-a.y1)/2;
      ctx.beginPath(); ctx.ellipse(cx,cy,rx||1,ry||1,0,0,Math.PI*2); ctx.stroke(); break;
    }
    case 'line':
      ctx.beginPath(); ctx.moveTo(a.x1,a.y1); ctx.lineTo(a.x2,a.y2); ctx.stroke(); break;
    case 'arrow':
      drawArrow(ctx,a.x1,a.y1,a.x2,a.y2,a.lw||2); break;
    case 'text': {
      const fs=a.fontSize||20;
      let fstr='';
      if(a.bold) fstr+='bold ';
      if(a.italic) fstr+='italic ';
      fstr+=fs+'px sans-serif';
      ctx.font=fstr; ctx.fillStyle=a.color;
      ctx.fillText(a.text,a.x,a.y);
      if(a.underline){
        const tw=ctx.measureText(a.text).width;
        ctx.beginPath(); ctx.moveTo(a.x,a.y+2); ctx.lineTo(a.x+tw,a.y+2); ctx.lineWidth=1; ctx.stroke();
      }
      break;
    }
    case 'brush':
      drawBrushPts(ctx,a.pts,a.color,a.lw); break;
  }
  ctx.restore();
}

function drawArrow(ctx,x1,y1,x2,y2,lw) {
  const angle=Math.atan2(y2-y1,x2-x1);
  const headLen=Math.max(lw*4,16);
  const headAngle=0.45;

  // Draw line exactly like the line tool (same lw, same style)
  ctx.save();
  ctx.lineWidth=lw;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

  // Filled triangle arrowhead at end point
  ctx.fillStyle=ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-headLen*Math.cos(angle-headAngle),y2-headLen*Math.sin(angle-headAngle));
  ctx.lineTo(x2-headLen*Math.cos(angle+headAngle),y2-headLen*Math.sin(angle+headAngle));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBrushPts(ctx,pts,color,lw) {
  if(!pts||pts.length<2) return;
  ctx.strokeStyle=color; ctx.lineWidth=lw||2;
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.stroke();
}

// ====== HISTORY ======
function saveHist() {
  const snap={a:JSON.stringify(annos),ga:JSON.stringify(gridAnnos),m:markCanvas.toDataURL(),k:mGenCanvas.toDataURL(),
    cl:JSON.stringify(canvasLabels),lc:labelCounter};
  history.push(snap);
  if(history.length>50) history.shift();
  redoHistory=[];
  updateUndoRedo();
}
function updateUndoRedo() {
  document.getElementById('btn-undo').style.opacity=history.length?'1':'0.4';
  document.getElementById('btn-redo').style.opacity=redoHistory.length?'1':'0.4';
}
function undo() {
  if(!history.length) return;
  const cur={a:JSON.stringify(annos),ga:JSON.stringify(gridAnnos),m:markCanvas.toDataURL(),k:mGenCanvas.toDataURL(),
    cl:JSON.stringify(canvasLabels),lc:labelCounter};
  redoHistory.push(cur);
  const snap=history.pop();
  restoreSnap(snap); updateUndoRedo();
}
function redo() {
  if(!redoHistory.length) return;
  const cur={a:JSON.stringify(annos),ga:JSON.stringify(gridAnnos),m:markCanvas.toDataURL(),k:mGenCanvas.toDataURL(),
    cl:JSON.stringify(canvasLabels),lc:labelCounter};
  history.push(cur);
  const snap=redoHistory.pop();
  restoreSnap(snap); updateUndoRedo();
}
function restoreSnap(snap) {
  annos=JSON.parse(snap.a);
  if(snap.ga) gridAnnos=JSON.parse(snap.ga);
  if(snap.cl){ canvasLabels=JSON.parse(snap.cl); labelCounter=snap.lc||0; selectedLabelId=null; }
  const imgM=new Image(); imgM.onload=()=>{markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);markCtx.drawImage(imgM,0,0);}; imgM.src=snap.m;
  const imgK=new Image(); imgK.onload=()=>{mGenCtx.clearRect(0,0,mGenCanvas.width,mGenCanvas.height);mGenCtx.drawImage(imgK,0,0);}; imgK.src=snap.k;
  renderCanvasLabels();
  drawAnnos();
  renderPropPanel();
}
function bindKeyboard() {
  document.addEventListener('keydown', e=>{
    const tag=document.activeElement.tagName;
    const isInput=tag==='INPUT'||tag==='TEXTAREA'||document.activeElement.getAttribute('contenteditable')==='true';
    // Escape: cancel add-screenshot flow
    if(e.key==='Escape' && typeof pendingCropLabelId!=='undefined' && pendingCropLabelId) {
      cancelAddScreenshot(); e.preventDefault(); return;
    }
    // Enter: deselect label and close prop panel (label inspection mode only)
    if(e.key==='Enter' && !isInput && selectedLabelId && !activeTool) {
      e.preventDefault();
      selectedLabelId=null;
      if(typeof hideActiveCropFloat==='function') hideActiveCropFloat();
      if(typeof renderCanvasLabels==='function') renderCanvasLabels();
      renderPropPanel();
      return;
    }
    if(e.ctrlKey&&e.key==='z'){e.preventDefault();undo();}
    if(e.ctrlKey&&e.key==='y'){e.preventDefault();redo();}
    if(!isInput && (e.key==='Delete'||e.key==='Backspace') && selectedAnnoIdx>=0) {
      e.preventDefault();
      saveHist();
      curAnnos().splice(selectedAnnoIdx,1);
      selectedAnnoIdx=-1;
      drawAnnos();
    }
    // Backspace/Delete to remove selected canvas label
    if(!isInput && (e.key==='Delete'||e.key==='Backspace') && selectedLabelId) {
      e.preventDefault();
      removeCanvasLabel(selectedLabelId);
      selectedLabelId=null;
      renumberLabels();
      renderCanvasLabels();
      renderPropPanel();
    }
  });
}
