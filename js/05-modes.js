'use strict';
// ====== GRID VIEW ======
function cachePanel(mode) {
  if(!panelCache[mode]) panelCache[mode]=document.createElement('canvas');
  const c=panelCache[mode];
  if(mode==='vsplit') {
    const vw=viewport.clientWidth,vh=viewport.clientHeight;
    if(!vw||!vh) return;
    c.width=vw; c.height=vh;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,vw,vh);
    ctx.fillStyle='#0d0d1d'; ctx.fillRect(0,0,vw,vh);
    const halfH=Math.floor(vh/2);
    if(psImg) {
      const s=Math.min(vw/psImg.naturalWidth,halfH/psImg.naturalHeight);
      const dw=Math.floor(psImg.naturalWidth*s),dh=Math.floor(psImg.naturalHeight*s);
      ctx.drawImage(psImg,Math.floor((vw-dw)/2),Math.floor((halfH-dh)/2),dw,dh);
    }
    ctx.strokeStyle='#2a2a3a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,halfH); ctx.lineTo(vw,halfH); ctx.stroke();
    if(gameImg) {
      const s=Math.min(vw/gameImg.naturalWidth,halfH/gameImg.naturalHeight);
      const dw=Math.floor(gameImg.naturalWidth*s),dh=Math.floor(gameImg.naturalHeight*s);
      ctx.drawImage(gameImg,Math.floor((vw-dw)/2),halfH+Math.floor((halfH-dh)/2),dw,dh);
    }
    return;
  }
  const w=markCanvas.width, h=markCanvas.height;
  if(!w||!h) return;
  c.width=w; c.height=h;
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,w,h);
  if(mode==='findiff') {
    ctx.drawImage(markCanvas,0,0);
  } else {
    if(gameImg) ctx.drawImage(gameImg,0,0,w,h);
    ctx.drawImage(markCanvas,0,0);
  }
}
function updateGrid() { /* no-op: replaced by renderCurrentMode() */ }
function renderModePanel(mode) { /* no-op */ }

// ====== MODES ======
function toggleCompare() {
  if(!gameImg||!psImg) return;
  isActive = !isActive;
  const startBtn = document.getElementById('btn-start-compare');
  const modeBtns = ['mode-compare','mode-outline','mode-findiff'];
  if(isActive) {
    startBtn.textContent = '■ 取消对比';
    startBtn.classList.add('active');
    startBtn.classList.remove('cta-ready');
    modeBtns.forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled=false; });
    updateUploadGuide();
    updateQATagsState();
    setMode(currentMode);
  } else {
    startBtn.textContent = '▶ 开始对比';
    startBtn.classList.remove('active');
    startBtn.classList.toggle('cta-ready', !!(gameImg&&psImg));
    modeBtns.forEach(id=>{ const el=document.getElementById(id); if(el){ el.disabled=true; el.classList.remove('active'); } });
    // Restore derived state vars
    isComparing=false; isOutline=false; isFindiff=false; isVSplit=false;
    if(markCtx) markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
    layers.style.display='none';
    splitCanvas.style.display='none';
    document.getElementById('sensitivity-pills').style.display='none';
    updateUploadGuide();
    updateQATagsState();
    clearCropPanels();
  }
}

function setMode(mode) {
  currentMode = mode;
  // Highlight active mode button
  ['compare','outline','findiff'].forEach(m=>{
    const el=document.getElementById('mode-'+m); if(el) el.classList.toggle('active', m===mode);
  });
  // Sensitivity pills: show in 差异对比 and 轮廓对比
  const sp = document.getElementById('sensitivity-pills');
  if(sp) sp.style.display = (isActive && (mode==='compare'||mode==='outline')) ? 'flex' : 'none';
  // Eraser labels
  updateEraserLabels();
  if(!isActive) return;
  renderCurrentMode();
}

function renderCurrentMode() {
  if(!gameImg) return;
  if(!syncCanvasSize()) return;
  splitCanvas.style.display='none';
  // Single canvas with overlay
  layers.style.display='block';
  isComparing = currentMode==='compare';
  isOutline   = currentMode==='outline';
  isFindiff   = currentMode==='findiff';
  isVSplit    = false;
  markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
  markCanvas.style.display='block';
  if(currentMode==='compare') runAnalysis();
  else if(currentMode==='outline') renderOutline();
  else if(currentMode==='findiff') renderFindiff();
  // After rendering, compute diff regions (no auto-display — user triggers via 一键诊断)
  clearCropPanels();
  if(currentMode!=='findiff') {
    setTimeout(() => { generateReport(); }, 0);
  }
}

function updateEraserLabels() {
  // Eraser buttons merged into one; no-op for individual buttons that no longer exist
  const eraserEl=document.getElementById('tool-eraser');
  if(eraserEl){ eraserEl.disabled=false; eraserEl.style.opacity=''; }
}

function setSensitivity(val) {
  sensitivityVal = val;
  document.querySelectorAll('.sens-pill').forEach(p=>{
    p.classList.toggle('active', +p.dataset.val===val);
  });
  if(isActive && currentMode==='compare'){
    if(val===0){ markCtx.clearRect(0,0,markCanvas.width,markCanvas.height); }
    else runAnalysis();
  }
  if(isActive && currentMode==='outline'){
    if(val===0){ markCtx.clearRect(0,0,markCanvas.width,markCanvas.height); }
    else renderOutline();
  }
}
function renderFindiff() {
  if(!syncCanvasSize()) return;
  const w=markCanvas.width, h=markCanvas.height;
  const off=document.createElement('canvas'); off.width=w; off.height=h;
  const octx=off.getContext('2d');
  octx.drawImage(gameImg,0,0,w,h); const d1=octx.getImageData(0,0,w,h).data;
  octx.clearRect(0,0,w,h); octx.drawImage(psImg,0,0,w,h); const d2=octx.getImageData(0,0,w,h).data;
  const out=markCtx.createImageData(w,h);
  for(let i=0;i<d1.length;i+=4){
    const dr=Math.abs(d1[i]-d2[i]);
    const dg=Math.abs(d1[i+1]-d2[i+1]);
    const db=Math.abs(d1[i+2]-d2[i+2]);
    const diff=dr+dg+db;
    if(diff>15){
      // 差异像素：放大色差，暖色高亮
      out.data[i]=Math.min(255,dr*3);
      out.data[i+1]=Math.min(255,dg*2);
      out.data[i+2]=Math.min(255,db*2);
      out.data[i+3]=255;
    } else {
      // 相同像素：黑色
      out.data[i]=0; out.data[i+1]=0; out.data[i+2]=0; out.data[i+3]=255;
    }
  }
  markCtx.putImageData(out,0,0);
  markCanvas.style.display='block';
}

// ====== PIXEL ANALYSIS ======
function getImageData(img, w, h) {
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
  return ctx.getImageData(0,0,w,h);
}

function runAnalysis() {
  if(!gameImg||!psImg||!gameImg.naturalWidth||!psImg.naturalWidth){ return; }
  if(!syncCanvasSize()) return;
  const w=markCanvas.width, h=markCanvas.height;
  const off=document.createElement('canvas'); off.width=w; off.height=h;
  const octx=off.getContext('2d');
  octx.drawImage(gameImg,0,0,w,h); const d1=octx.getImageData(0,0,w,h).data;
  octx.clearRect(0,0,w,h); octx.drawImage(psImg,0,0,w,h); const d2=octx.getImageData(0,0,w,h).data;

  markCtx.clearRect(0,0,w,h);
  markCtx.fillStyle='rgba(255,0,0,0.7)';
  const threshold=sensitivityVal*3;
  for(let i=0;i<d1.length;i+=4){
    if(Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])>threshold)
      markCtx.fillRect((i/4)%w,Math.floor((i/4)/w),1,1);
  }
  markCanvas.style.display='block';
}

// ====== SSIM ======
function computeSSIM(g1,g2,w,h){
  const C1=6.5025,C2=58.5225;
  const blockSize=8;
  const bw=Math.floor(w/blockSize),bh=Math.floor(h/blockSize);
  let ssimSum=0,ssimCount=0,ssimMin=1;
  for(let by=0;by<bh;by++){
    for(let bx=0;bx<bw;bx++){
      let sum1=0,sum2=0,sum11=0,sum22=0,sum12=0;
      const n=blockSize*blockSize;
      for(let dy=0;dy<blockSize;dy++){
        for(let dx=0;dx<blockSize;dx++){
          const pi=(by*blockSize+dy)*w+(bx*blockSize+dx);
          const v1=g1[pi],v2=g2[pi];
          sum1+=v1;sum2+=v2;sum11+=v1*v1;sum22+=v2*v2;sum12+=v1*v2;
        }
      }
      const mu1=sum1/n,mu2=sum2/n;
      const s1=sum11/n-mu1*mu1,s2=sum22/n-mu2*mu2,s12=sum12/n-mu1*mu2;
      const ssim=((2*mu1*mu2+C1)*(2*s12+C2))/((mu1*mu1+mu2*mu2+C1)*(s1+s2+C2));
      ssimSum+=ssim; ssimCount++;
      if(ssim<ssimMin) ssimMin=ssim;
    }
  }
  return {mean:ssimCount?ssimSum/ssimCount:1,min:ssimMin};
}

// ====== DELTA-E & LAB ======
function rgb2lab(r,g,b){
  r/=255;g/=255;b/=255;
  r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;
  g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;
  b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;
  let x=(r*0.4124564+g*0.3575761+b*0.1804375)/0.95047;
  let y=(r*0.2126729+g*0.7151522+b*0.0721750);
  let z=(r*0.0193339+g*0.1191920+b*0.9503041)/1.08883;
  const f=v=>v>0.008856?Math.cbrt(v):7.787*v+16/116;
  x=f(x);y=f(y);z=f(z);
  return[116*y-16,500*(x-y),200*(y-z)];
}
function computeDeltaE(d1,d2,totalPixels){
  let deSum=0,deLSum=0,deCSum=0,deCount=0;
  const deThreshold=5;
  const deMap=new Float32Array(totalPixels);
  const diffMap=new Uint8Array(totalPixels);
  for(let i=0;i<totalPixels;i++){
    const o=i*4;
    const [L1,a1,b1]=rgb2lab(d1[o],d1[o+1],d1[o+2]);
    const [L2,a2,b2]=rgb2lab(d2[o],d2[o+1],d2[o+2]);
    const dL=L1-L2,da=a1-a2,db=b1-b2;
    const de=Math.sqrt(dL*dL+da*da+db*db);
    deMap[i]=de;
    if(de>deThreshold){
      deSum+=de; deLSum+=Math.abs(dL);
      deCSum+=Math.sqrt(da*da+db*db);
      deCount++; diffMap[i]=1;
    }
  }
  return {avgDE:deCount?deSum/deCount:0,avgDL:deCount?deLSum/deCount:0,avgDC:deCount?deCSum/deCount:0,deMap,diffMap,deCount};
}
function describeColorShift(avgDL,avgDA,avgDB){
  const parts=[];
  if(Math.abs(avgDL)>5) parts.push(avgDL>0?'偏暗':'偏亮');
  if(Math.abs(avgDA)>5) parts.push(avgDA>0?'偏绿':'偏红');
  if(Math.abs(avgDB)>5) parts.push(avgDB>0?'偏蓝':'偏黄');
  return parts.length?parts.join('、'):'无明显偏移';
}

// ====== EDGE DETECTION ======
function computeEdgeMap(gray,w,h){
  const edges=new Float32Array(w*h);
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const gx=-gray[(y-1)*w+x-1]+gray[(y-1)*w+x+1]-2*gray[y*w+x-1]+2*gray[y*w+x+1]-gray[(y+1)*w+x-1]+gray[(y+1)*w+x+1];
      const gy=-gray[(y-1)*w+x-1]-2*gray[(y-1)*w+x]-gray[(y-1)*w+x+1]+gray[(y+1)*w+x-1]+2*gray[(y+1)*w+x]+gray[(y+1)*w+x+1];
      edges[y*w+x]=Math.sqrt(gx*gx+gy*gy);
    }
  }
  return edges;
}
function detectEdges(imgEl,w,h){
  const tc=document.createElement('canvas');tc.width=w;tc.height=h;
  const tctx=tc.getContext('2d');tctx.drawImage(imgEl,0,0,w,h);
  const src=tctx.getImageData(0,0,w,h).data;
  const gray=new Float32Array(w*h);
  for(let i=0;i<w*h;i++) gray[i]=src[i*4]*0.299+src[i*4+1]*0.587+src[i*4+2]*0.114;
  // Map sensitivityVal: 70(低)→80, 40(一般)→40, 20(高)→20, 10(极高)→10
  const edgeThreshold = sensitivityVal * 1.0 + 10;
  const edges=new Uint8Array(w*h);
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const gx=-gray[(y-1)*w+x-1]+gray[(y-1)*w+x+1]-2*gray[y*w+x-1]+2*gray[y*w+x+1]-gray[(y+1)*w+x-1]+gray[(y+1)*w+x+1];
      const gy=-gray[(y-1)*w+x-1]-2*gray[(y-1)*w+x]-gray[(y-1)*w+x+1]+gray[(y+1)*w+x-1]+2*gray[(y+1)*w+x]+gray[(y+1)*w+x+1];
      const mag=Math.sqrt(gx*gx+gy*gy);
      edges[y*w+x]=mag>edgeThreshold?Math.min(255,mag):0;
    }
  }
  return edges;
}
function renderOutline(){
  if(!gameImg||!psImg||!gameImg.naturalWidth) return;
  if(!syncCanvasSize()) return;
  const w=markCanvas.width,h=markCanvas.height;
  const edges1=detectEdges(gameImg,w,h);
  const edges2=detectEdges(psImg,w,h);
  const outData=markCtx.createImageData(w,h);
  const od=outData.data;
  for(let i=0;i<w*h;i++){
    const idx=i*4;
    od[idx]=edges1[i];od[idx+1]=edges2[i];od[idx+2]=0;
    od[idx+3]=(edges1[i]||edges2[i])?255:0;
  }
  markCtx.putImageData(outData,0,0);
  markCtx.fillStyle='rgba(0,0,0,0.7)';markCtx.fillRect(10,10,220,30);
  markCtx.font='14px sans-serif';
  markCtx.fillStyle='#ff4444';markCtx.fillText('● 线上截图轮廓',18,30);
  markCtx.fillStyle='#44ff44';markCtx.fillText('● UI设计稿轮廓',128,30);
  markCanvas.style.display='block';
}

// ====== DIFF REGIONS ======
function findDiffRegions(diffMap,w,h){
  const blockSize=4;
  const bw=Math.ceil(w/blockSize),bh=Math.ceil(h/blockSize);
  const blockMap=new Uint8Array(bw*bh);
  const visited=new Uint8Array(bw*bh);
  for(let by=0;by<bh;by++){
    for(let bx=0;bx<bw;bx++){
      let count=0,total=0;
      for(let dy=0;dy<blockSize&&by*blockSize+dy<h;dy++){
        for(let dx=0;dx<blockSize&&bx*blockSize+dx<w;dx++){
          if(diffMap[(by*blockSize+dy)*w+bx*blockSize+dx]) count++;
          total++;
        }
      }
      if(count>total*0.1) blockMap[by*bw+bx]=1;
    }
  }
  const regions=[];
  for(let by=0;by<bh;by++){
    for(let bx=0;bx<bw;bx++){
      if(!blockMap[by*bw+bx]||visited[by*bw+bx]) continue;
      const queue=[[bx,by]]; visited[by*bw+bx]=1;
      let minX=bx,maxX=bx,minY=by,maxY=by,area=0;
      while(queue.length){
        const [cx,cy]=queue.shift(); area++;
        const neighbors=[[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1],[cx-2,cy],[cx+2,cy],[cx,cy-2],[cx,cy+2],[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1],[cx+1,cy+1]];
        for(const[nx,ny] of neighbors){
          if(nx>=0&&nx<bw&&ny>=0&&ny<bh&&!visited[ny*bw+nx]&&blockMap[ny*bw+nx]){
            visited[ny*bw+nx]=1;queue.push([nx,ny]);
            if(nx<minX)minX=nx;if(nx>maxX)maxX=nx;if(ny<minY)minY=ny;if(ny>maxY)maxY=ny;
          }
        }
      }
      if(area>=2) regions.push({x:minX*blockSize,y:minY*blockSize,w:(maxX-minX+1)*blockSize,h:(maxY-minY+1)*blockSize,blockArea:area});
    }
  }
  const finalRegions=[];
  regions.forEach(reg=>{
    const aspect=Math.max(reg.w,reg.h)/Math.min(reg.w,reg.h);
    if(aspect>6&&reg.blockArea>20) finalRegions.push(...trySplitRegion(reg,diffMap,w,h));
    else finalRegions.push(reg);
  });
  finalRegions.sort((a,b)=>b.blockArea-a.blockArea);
  // Filter out low-coverage regions (likely noise aggregation)
  const filtered=finalRegions.filter(reg=>{
    const area=reg.w*reg.h;
    if(area<1) return false;
    let cnt=0;
    for(let y=reg.y;y<reg.y+reg.h&&y<h;y++)
      for(let x=reg.x;x<reg.x+reg.w&&x<w;x++)
        if(diffMap[y*w+x]) cnt++;
    return cnt/(area)>=0.05;
  });
  return filtered.slice(0,60);
}
function trySplitRegion(reg,diffMap,w,h){
  const isHoriz=reg.w>reg.h;
  const len=isHoriz?reg.w:reg.h;
  const density=new Float32Array(len);
  const cross=isHoriz?reg.h:reg.w;
  for(let i=0;i<len;i++){
    let sum=0;
    for(let j=0;j<cross;j++){
      const px=isHoriz?reg.x+i:reg.x+j,py=isHoriz?reg.y+j:reg.y+i;
      if(px<w&&py<h&&diffMap[py*w+px]) sum++;
    }
    density[i]=sum/cross;
  }
  const splitPoints=[]; let zeroStart=-1;
  for(let i=0;i<len;i++){
    if(density[i]<0.05){if(zeroStart<0)zeroStart=i;}
    else{if(zeroStart>=0&&i-zeroStart>=8) splitPoints.push(Math.floor((zeroStart+i)/2));zeroStart=-1;}
  }
  if(splitPoints.length===0) return[reg];
  const points=[0,...splitPoints,len];
  const parts=[];
  for(let i=0;i<points.length-1;i++){
    const start=points[i],end=points[i+1];
    if(end-start<4) continue;
    if(isHoriz) parts.push({x:reg.x+start,y:reg.y,w:end-start,h:reg.h,blockArea:Math.ceil((end-start)*reg.h/16)});
    else parts.push({x:reg.x,y:reg.y+start,w:reg.w,h:end-start,blockArea:Math.ceil(reg.w*(end-start)/16)});
  }
  return parts.length>0?parts:[reg];
}
function detectOffset(reg,gray1,gray2,w,h){
  if(reg.w*reg.h>w*h*0.15||reg.w*reg.h<100) return{dx:0,dy:0,confidence:0};
  const maxShift=Math.min(20,Math.floor(Math.min(reg.w,reg.h)*0.5));
  let bestDx=0,bestDy=0,bestScore=Infinity;
  const cx=reg.x+Math.floor(reg.w/2),cy=reg.y+Math.floor(reg.h/2);
  const sampleSize=Math.min(reg.w,reg.h,40),half=Math.floor(sampleSize/2);
  let baseScore=0;
  for(let sy=-half;sy<half;sy+=2) for(let sx=-half;sx<half;sx+=2){const px=cx+sx,py=cy+sy;if(px>=0&&px<w&&py>=0&&py<h) baseScore+=Math.abs(gray1[py*w+px]-gray2[py*w+px]);}
  for(let dy=-maxShift;dy<=maxShift;dy+=2){
    for(let dx=-maxShift;dx<=maxShift;dx+=2){
      if(dx===0&&dy===0) continue;
      let score=0;
      for(let sy=-half;sy<half;sy+=2) for(let sx=-half;sx<half;sx+=2){const px1=cx+sx,py1=cy+sy,px2=px1+dx,py2=py1+dy;if(px1>=0&&px1<w&&py1>=0&&py1<h&&px2>=0&&px2<w&&py2>=0&&py2<h) score+=Math.abs(gray1[py1*w+px1]-gray2[py2*w+px2]);}
      if(score<bestScore){bestScore=score;bestDx=dx;bestDy=dy;}
    }
  }
  const confidence=baseScore>0?Math.max(0,1-bestScore/baseScore):0;
  return{dx:bestDx,dy:bestDy,confidence};
}
function detectSizeDiff(reg,edgeMap1,edgeMap2,w,h){
  let e1MinX=reg.w,e1MaxX=0,e1MinY=reg.h,e1MaxY=0;
  let e2MinX=reg.w,e2MaxX=0,e2MinY=reg.h,e2MaxY=0;
  let e1Count=0,e2Count=0;
  for(let y=reg.y;y<reg.y+reg.h&&y<h;y++){
    for(let x=reg.x;x<reg.x+reg.w&&x<w;x++){
      const pi=y*w+x,lx=x-reg.x,ly=y-reg.y;
      if(edgeMap1[pi]>50){if(lx<e1MinX)e1MinX=lx;if(lx>e1MaxX)e1MaxX=lx;if(ly<e1MinY)e1MinY=ly;if(ly>e1MaxY)e1MaxY=ly;e1Count++;}
      if(edgeMap2[pi]>50){if(lx<e2MinX)e2MinX=lx;if(lx>e2MaxX)e2MaxX=lx;if(ly<e2MinY)e2MinY=ly;if(ly>e2MaxY)e2MaxY=ly;e2Count++;}
    }
  }
  if(e1Count<10||e2Count<10) return{hasDiff:false,dw:0,dh:0};
  const w1=e1MaxX-e1MinX,h1=e1MaxY-e1MinY,w2=e2MaxX-e2MinX,h2=e2MaxY-e2MinY;
  const dw=w2-w1,dh=h2-h1;
  const hasDiff=(Math.abs(dw)>3||Math.abs(dh)>3)&&(Math.abs(dw)/Math.max(w1,1)>0.05||Math.abs(dh)/Math.max(h1,1)>0.05);
  return{hasDiff,dw,dh,gameSize:{w:w1,h:h1},psSize:{w:w2,h:h2}};
}
function classifyIssue(reg,w,h,avgDE,avgDL,chromaShift,isHighEdge,edgePct1,edgePct2,offset,sizeInfo,count,regPixels){
  const ratio=reg.w/(reg.h||1);
  const diffRatio=count/(regPixels||1);
  let type,severity;

  // 1. Content: missing or extra
  if(edgePct1<edgePct2*0.6&&avgDE>10&&edgePct1<0.05){
    type={id:'missing',cls:'cat-text',label:'内容缺失',borderColor:'#ff4757'};
    severity=avgDE>20?'P1':'P2';
  } else if(edgePct2>edgePct1+0.1&&edgePct2>0.1){
    type={id:'extra',cls:'cat-text',label:'多余内容',borderColor:'#888'};
    severity='P3';
  }
  // 2. Size difference
  else if(sizeInfo.hasDiff&&(Math.abs(sizeInfo.dw)>4||Math.abs(sizeInfo.dh)>4)){
    const dw=sizeInfo.dw, dh=sizeInfo.dh;
    const maxDiff=Math.max(Math.abs(dw),Math.abs(dh));
    let lbl;
    if(Math.abs(dw)>4&&Math.abs(dh)>4) lbl=dw>0?'元素偏小':'元素偏大';
    else if(Math.abs(dw)>Math.abs(dh)) lbl='宽度不符';
    else lbl='高度不符';
    type={id:'size',cls:'cat-size',label:lbl,borderColor:'#f0932b'};
    severity=maxDiff>15?'P1':'P2';
  }
  // 3. Position offset
  else if(offset.confidence>0.35&&(Math.abs(offset.dx)>2||Math.abs(offset.dy)>2)){
    const adx=Math.abs(offset.dx), ady=Math.abs(offset.dy);
    let lbl;
    if(adx>2&&ady>2) lbl=adx>ady*2?'水平偏移':ady>adx*2?'垂直偏移':'整体偏移';
    else if(adx>ady) lbl='水平偏移';
    else lbl='垂直偏移';
    if(offset.confidence<0.5&&adx<6&&ady<6) lbl='间距偏差';
    type={id:'layout',cls:'cat-layout',label:lbl,borderColor:'#74c0fc'};
    const maxOff=Math.max(adx,ady);
    severity=maxOff>10?'P1':'P2';
  }
  // 4. Text/font difference
  else if(isHighEdge&&ratio>1.5&&reg.h<80){
    type={id:'text',cls:'cat-text',label:'文字差异',borderColor:'#55efc4'};
    severity=avgDE>15?'P1':'P2';
  }
  // 5. Style difference (thin edge-like regions)
  else if(isHighEdge&&diffRatio<0.4&&(ratio>4||ratio<0.25)){
    type={id:'style',cls:'cat-asset',label:'边框差异',borderColor:'#fd79a8'};
    severity=avgDE>15?'P2':'P3';
  }
  else if(isHighEdge&&reg.w<50&&reg.h<50&&diffRatio<0.5){
    type={id:'style',cls:'cat-asset',label:'圆角差异',borderColor:'#fd79a8'};
    severity='P3';
  }
  // 6. Color/visual difference (use LAB components)
  else if(avgDE>5){
    let lbl;
    if(avgDL>chromaShift*1.5&&avgDL>3) lbl='亮度不符';
    else if(chromaShift>avgDL*1.5&&chromaShift>3) lbl='饱和度偏差';
    else if(avgDE>8&&diffRatio<0.3) lbl='透明度差异';
    else lbl='颜色偏差';
    type={id:'color',cls:'cat-color',label:lbl,borderColor:'#a29bfe'};
    severity=avgDE>20?'P1':avgDE>10?'P2':'P3';
  }
  // 7. Minor style/background diff
  else if(avgDE>2){
    type={id:'style',cls:'cat-asset',label:'背景差异',borderColor:'#636e72'};
    severity='P3';
  }
  // 8. Fallback
  else {
    type={id:'color',cls:'cat-color',label:'颜色偏差',borderColor:'#555'};
    severity='P3';
  }
  const sMap={P0:{label:'P0',desc:'阻断',bg:'#ff475733',color:'#ff4757'},P1:{label:'P1',desc:'严重',bg:'#ff6b3533',color:'#ff6b35'},P2:{label:'P2',desc:'一般',bg:'#ffc10733',color:'#ffc107'},P3:{label:'P3',desc:'参考',bg:'#55555533',color:'#888'}};
  return{type,severity:sMap[severity]};
}
function analyzeRegionFull(reg,d1,d2,w,h,lab1L,lab1A,lab1B,lab2L,lab2A,lab2B,deMap,edgeMap1,edgeMap2,gray1,gray2){
  let deLSum=0,deASum=0,deBSum=0,deSum=0,count=0;
  let edgeDensity1=0,edgeDensity2=0,edgePixels=0;
  const regPixels=reg.w*reg.h;
  for(let y=reg.y;y<reg.y+reg.h&&y<h;y++){
    for(let x=reg.x;x<reg.x+reg.w&&x<w;x++){
      const pi=y*w+x;
      if(deMap[pi]>0){deLSum+=Math.abs(lab1L[pi]-lab2L[pi]);deASum+=Math.abs(lab1A[pi]-lab2A[pi]);deBSum+=Math.abs(lab1B[pi]-lab2B[pi]);deSum+=deMap[pi];count++;}
      if(edgeMap1[pi]>50) edgeDensity1++;
      if(edgeMap2[pi]>50) edgeDensity2++;
      edgePixels++;
    }
  }
  const avgDE=count?deSum/count:0,avgDL=count?deLSum/count:0,avgDA=count?deASum/count:0,avgDB=count?deBSum/count:0;
  const edgePct1=edgePixels?edgeDensity1/edgePixels:0,edgePct2=edgePixels?edgeDensity2/edgePixels:0;
  const isHighEdge=(edgePct1>0.15||edgePct2>0.15);
  const chromaShift=Math.sqrt(avgDA*avgDA+avgDB*avgDB);
  const offset=detectOffset(reg,gray1,gray2,w,h);
  const sizeInfo=detectSizeDiff(reg,edgeMap1,edgeMap2,w,h);
  const {type:issueType,severity}=classifyIssue(reg,w,h,avgDE,avgDL,chromaShift,isHighEdge,edgePct1,edgePct2,offset,sizeInfo,count,regPixels);
  return{issue:issueType,severity,avgDE,avgDL,chromaShift,edgePct1,edgePct2,offset,sizeInfo,diffRatio:count/(regPixels||1),colorDesc:describeColorShift(avgDL,avgDA,avgDB)};
}
