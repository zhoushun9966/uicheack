'use strict';
// ====== REPORT ======
function generateReport(){
  if(!gameImg||!psImg||!gameImg.naturalWidth||!psImg.naturalWidth) return;
  if(!syncCanvasSize()) return;
  const w=markCanvas.width,h=markCanvas.height;
  const off=document.createElement('canvas');off.width=w;off.height=h;
  const octx=off.getContext('2d');
  octx.drawImage(gameImg,0,0,w,h);const d1=octx.getImageData(0,0,w,h).data;
  octx.clearRect(0,0,w,h);octx.drawImage(psImg,0,0,w,h);const d2=octx.getImageData(0,0,w,h).data;

  const totalPixels=w*h;
  const gray1=new Float32Array(totalPixels),gray2=new Float32Array(totalPixels);
  const lab1L=new Float32Array(totalPixels),lab1A=new Float32Array(totalPixels),lab1B=new Float32Array(totalPixels);
  const lab2L=new Float32Array(totalPixels),lab2A=new Float32Array(totalPixels),lab2B=new Float32Array(totalPixels);
  for(let i=0;i<totalPixels;i++){
    const idx=i*4;
    gray1[i]=d1[idx]*0.299+d1[idx+1]*0.587+d1[idx+2]*0.114;
    gray2[i]=d2[idx]*0.299+d2[idx+1]*0.587+d2[idx+2]*0.114;
    const c1=rgb2lab(d1[idx],d1[idx+1],d1[idx+2]);lab1L[i]=c1[0];lab1A[i]=c1[1];lab1B[i]=c1[2];
    const c2=rgb2lab(d2[idx],d2[idx+1],d2[idx+2]);lab2L[i]=c2[0];lab2A[i]=c2[1];lab2B[i]=c2[2];
  }
  const deThreshold=sensitivityVal*0.6;
  let diffPixels=0,deSumTotal=0,deLSum=0,deCSum=0;
  const diffMap=new Uint8Array(totalPixels),deMap=new Float32Array(totalPixels);
  for(let i=0;i<totalPixels;i++){
    const dL=lab1L[i]-lab2L[i],dA=lab1A[i]-lab2A[i],dB=lab1B[i]-lab2B[i];
    const de=Math.sqrt(dL*dL+dA*dA+dB*dB);
    deMap[i]=de;
    if(de>deThreshold){diffPixels++;deSumTotal+=de;deLSum+=Math.abs(dL);deCSum+=Math.sqrt(dA*dA+dB*dB);diffMap[i]=1;}
  }
  // Morphological denoise: erode then dilate
  const eroded=new Uint8Array(totalPixels);
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
    let cnt=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) cnt+=diffMap[(y+dy)*w+(x+dx)];
    if(cnt>=3) eroded[y*w+x]=1;
  }
  const cleaned=new Uint8Array(totalPixels);
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
    if(eroded[y*w+x]){cleaned[y*w+x]=1;continue;}
    let cnt=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) cnt+=eroded[(y+dy)*w+(x+dx)];
    if(cnt>=1) cleaned[y*w+x]=1;
  }
  const ssimResult=computeSSIM(gray1,gray2,w,h);
  const regions=findDiffRegions(cleaned,w,h);
  const edgeMap1=computeEdgeMap(gray1,w,h),edgeMap2=computeEdgeMap(gray2,w,h);
  regions.forEach((reg,i)=>{
    reg.id=i+1;
    reg.analysis=analyzeRegionFull(reg,d1,d2,w,h,lab1L,lab1A,lab1B,lab2L,lab2A,lab2B,deMap,edgeMap1,edgeMap2,gray1,gray2);
  });
  const diffPercent=diffPixels/totalPixels*100;
  const sizeMatch=gameImg.naturalWidth===psImg.naturalWidth&&gameImg.naturalHeight===psImg.naturalHeight;
  reportData={
    w,h,diffPixels,totalPixels,diffPercent,regions,sizeMatch,
    gameSize:{w:gameImg.naturalWidth,h:gameImg.naturalHeight},
    psSize:{w:psImg.naturalWidth,h:psImg.naturalHeight},
    avgDE:diffPixels?deSumTotal/diffPixels:0,
    avgDL:diffPixels?deLSum/diffPixels:0,
    avgDC:diffPixels?deCSum/diffPixels:0,
    ssim:ssimResult.mean,ssimMin:ssimResult.min,
    deThreshold
  };
  regionChecked=regions.map(()=>true);
  if(typeof updateDiagnoseBtn==='function') updateDiagnoseBtn(true);
  if(typeof showOnboardingGuide==='function') setTimeout(showOnboardingGuide, 800);
  loadAIConfig();
  if(aiConfig.enabled&&aiConfig.model) triggerAIAnalysis();
}

function renderReport(){
  if(!reportData) return;
  document.getElementById('rp-empty').style.display='none';
  const c=document.getElementById('rp-content'); c.style.display='block';
  const r=reportData;
  const ssimPct=(r.ssim*100);
  const ssimSev=ssimPct>97?'metric-good':ssimPct>90?'metric-warn':'metric-bad';
  const deSev=r.avgDE<3?'metric-good':r.avgDE<10?'metric-warn':'metric-bad';
  const sevCounts={serious:0,normal:0,ref:0};
  r.regions.forEach(reg=>{
    const a=reg.analysis;
    if(a.severity.label==='P0'||a.severity.label==='P1') sevCounts.serious++;
    else if(a.severity.label==='P2') sevCounts.normal++;
    else sevCounts.ref++;
  });
  let html=`<div id="ai-config-bar" style="background:#09091a;border:1px solid #222;border-radius:7px;padding:8px 10px;margin-bottom:9px">
    <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="toggleAIConfig()">
      <span style="font-size:11px;color:#007AFF">⚙ AI识图分析配置</span>
      <span id="ai-status-dot" style="font-size:10px;color:#666">未配置</span>
    </div>
    <div id="ai-config-form" style="display:none;margin-top:8px">
      <label style="font-size:10px;color:#666;display:block;margin-bottom:2px">接口类型</label>
      <select id="ai-type-sel" style="width:100%;background:#11111f;border:1px solid #2a2a3a;color:#ccc;padding:4px;border-radius:4px;font-size:11px;margin-bottom:5px;box-sizing:border-box" onchange="onAITypeChange()">
        <option value="ollama">Ollama（本地）</option>
        <option value="siliconflow">硅基流动</option>
        <option value="zhipu">智谱AI</option>
        <option value="qwen">通义千问</option>
        <option value="openai">OpenAI兼容</option>
      </select>
      <label style="font-size:10px;color:#666;display:block;margin-bottom:2px">API 地址</label>
      <input id="ai-url-inp" type="text" value="http://localhost:11434" style="width:100%;background:#11111f;border:1px solid #2a2a3a;color:#ccc;padding:4px;border-radius:4px;font-size:11px;margin-bottom:5px;box-sizing:border-box">
      <label style="font-size:10px;color:#666;display:block;margin-bottom:2px">模型名称</label>
      <input id="ai-model-inp" type="text" placeholder="如 llava、Qwen2.5-VL-7B-Instruct" style="width:100%;background:#11111f;border:1px solid #2a2a3a;color:#ccc;padding:4px;border-radius:4px;font-size:11px;margin-bottom:5px;box-sizing:border-box">
      <div id="ai-key-row" style="display:none;margin-bottom:5px">
        <label style="font-size:10px;color:#666;display:block;margin-bottom:2px">API Key</label>
        <input id="ai-key-inp" type="password" placeholder="sk-..." style="width:100%;background:#11111f;border:1px solid #2a2a3a;color:#ccc;padding:4px;border-radius:4px;font-size:11px;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="saveAIConfigUI()" style="flex:1;background:#007AFF;color:#fff;border:none;padding:5px;border-radius:4px;font-size:11px;cursor:pointer">保存</button>
        <button onclick="testAIConnection()" style="flex:1;background:#222;color:#ccc;border:1px solid #444;padding:5px;border-radius:4px;font-size:11px;cursor:pointer">测试</button>
      </div>
      <div id="ai-config-msg" style="margin-top:5px;font-size:10px;color:#666"></div>
    </div>
  </div>
  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:#007AFF;margin-bottom:6px">AI 综合分析</div>
    <div id="ai-analysis-section">${aiConfig.enabled&&aiConfig.model?'<span style="color:#555;font-size:11px">待分析...</span>':'<span style="color:#555;font-size:11px">AI未配置，请点击上方⚙设置</span>'}</div>
  </div>`;

  // 核心指标
  html+=`<div class="rp-metric"><span class="rp-metric-label">结构相似度(SSIM)</span><span class="rp-metric-value ${ssimSev}">${ssimPct.toFixed(1)}% · ${ssimPct>97?'高度一致':ssimPct>90?'存在差异':'差异显著'}</span></div>`;
  html+=`<div class="rp-metric"><span class="rp-metric-label">感知色差(Delta-E)</span><span class="rp-metric-value ${deSev}">${r.avgDE.toFixed(1)} · ${r.avgDE<3?'几乎无感知':r.avgDE<10?'可感知':'明显差异'}</span></div>`;
  html+=`<div class="rp-metric"><span class="rp-metric-label">差异像素占比</span><span class="rp-metric-value ${r.diffPercent<1?'metric-good':r.diffPercent<5?'metric-warn':'metric-bad'}">${r.diffPercent.toFixed(2)}%</span></div>`;
  html+=`<div class="rp-metric"><span class="rp-metric-label">尺寸对比</span><span class="rp-metric-value ${r.sizeMatch?'metric-good':'metric-warn'}">${r.sizeMatch?'✓ 一致':'⚠ 不一致'}</span></div>`;
  html+=`<div style="font-size:10px;color:#555;margin-bottom:8px;padding:0 2px">线上: ${r.gameSize.w}×${r.gameSize.h} &nbsp; 设计稿: ${r.psSize.w}×${r.psSize.h}</div>`;
  html+=`<div class="rp-metric"><span class="rp-metric-label">差异区域数</span><span class="rp-metric-value ${r.regions.length===0?'metric-good':r.regions.length<5?'metric-warn':'metric-bad'}">${r.regions.length} 个</span></div>`;

  // 区域列表
  if(r.regions.length>0){
    html+=`<div style="font-size:11px;color:#007AFF;margin:10px 0 6px">差异区域列表</div>
    <div class="region-filter">
      <button class="rf-btn ${activeFilter==='all'?'active':''}" onclick="setFilter('all')">全部(${r.regions.length})</button>
      <button class="rf-btn ${activeFilter==='serious'?'active':''}" onclick="setFilter('serious')">严重(${sevCounts.serious})</button>
      <button class="rf-btn ${activeFilter==='normal'?'active':''}" onclick="setFilter('normal')">一般(${sevCounts.normal})</button>
      <button class="rf-btn ${activeFilter==='ref'?'active':''}" onclick="setFilter('ref')">参考(${sevCounts.ref})</button>
    </div>
    <label class="rpt-select-all" style="display:flex;align-items:center;gap:5px;margin-bottom:6px;padding:4px 6px;background:rgba(255,255,255,.04);border-radius:5px;cursor:pointer;font-size:11px">
      <input type="checkbox" id="rpt-check-all" checked onchange="toggleAllRegions(this.checked)" style="accent-color:#007AFF">全选/取消全选
    </label>`;
    r.regions.forEach((reg,i)=>{
      const a=reg.analysis;
      let filterKey=(a.severity.label==='P0'||a.severity.label==='P1')?'serious':a.severity.label==='P2'?'normal':'ref';
      const visible=activeFilter==='all'||filterKey===activeFilter;
      let metricsHtml=`<div style="color:#555;font-size:9px;margin-top:2px">ΔE:${a.avgDE.toFixed(1)}`;
      if(a.offset&&a.offset.confidence>0.35&&(Math.abs(a.offset.dx)>2||Math.abs(a.offset.dy)>2)) metricsHtml+=` 偏移:X${a.offset.dx>0?'+':''}${a.offset.dx}Y${a.offset.dy>0?'+':''}${a.offset.dy}`;
      if(a.sizeInfo&&a.sizeInfo.hasDiff) metricsHtml+=` 尺寸差:宽${a.sizeInfo.dw>0?'+':''}${a.sizeInfo.dw}高${a.sizeInfo.dh>0?'+':''}${a.sizeInfo.dh}`;
      metricsHtml+=`</div>`;
      html+=`<div class="rpt-region-row" data-filter="${filterKey}" style="display:${visible?'flex':'none'};gap:5px;align-items:flex-start;margin-bottom:5px">
        <input type="checkbox" class="rpt-region-cb" data-idx="${i}" checked onchange="onRegionCheck(${i},this.checked)" style="margin-top:8px;width:13px;height:13px;accent-color:#007AFF;cursor:pointer;flex-shrink:0">
        <div class="region-card" style="border-left:3px solid ${a.issue.borderColor};padding:6px 8px;border-radius:0 6px 6px 0;font-size:11px;cursor:pointer;flex:1;background:rgba(255,255,255,.03)" onclick="scrollToRegionById(${i})">
          <div><strong>#${i+1}</strong>
            <span style="background:${a.severity.bg};color:${a.severity.color};padding:1px 5px;border-radius:3px;font-size:9px;margin-left:3px;font-weight:bold">${a.severity.label} ${a.severity.desc}</span>
            <span style="color:${a.issue.borderColor};font-size:11px;margin-left:3px">${a.issue.label}</span>
          </div>
          <div style="color:#555;font-size:9px;margin-top:2px">位置:(${reg.x},${reg.y}) 大小:${reg.w}×${reg.h}</div>
          ${metricsHtml}
          ${a.colorDesc!=='无明显偏移'?`<div style="color:#555;font-size:9px">色偏:${a.colorDesc}</div>`:''}
        </div>
      </div>`;
    });
  }
  html+=`<button class="rpt-export-btn" onclick="exportReportTxt()">导出差异报告(TXT)</button>`;
  c.innerHTML=html;
  syncAIConfigToForm();
  updateAIStatusDot();
}
function setFilter(f){
  activeFilter=f;
  document.querySelectorAll('.rpt-region-row').forEach(row=>{
    row.style.display=(f==='all'||row.dataset.filter===f)?'flex':'none';
  });
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
  const ab=document.querySelector(`.rf-btn[onclick="setFilter('${f}')"]`);
  if(ab) ab.classList.add('active');
}
function toggleAllRegions(checked){
  regionChecked=regionChecked.map(()=>checked);
  document.querySelectorAll('.rpt-region-cb').forEach(cb=>cb.checked=checked);
  drawReportMarkers(reportData.regions);
}
function onRegionCheck(idx,checked){
  regionChecked[idx]=checked;
  const allCb=document.getElementById('rpt-check-all');
  if(allCb){const allC=regionChecked.every(v=>v);const noneC=regionChecked.every(v=>!v);allCb.checked=allC;allCb.indeterminate=!allC&&!noneC;}
  drawReportMarkers(reportData.regions);
}
function scrollToRegionById(idx){
  if(!regionChecked[idx]){regionChecked[idx]=true;const cb=document.querySelector(`.rpt-region-cb[data-idx="${idx}"]`);if(cb)cb.checked=true;drawReportMarkers(reportData.regions);}
  const rows=document.querySelectorAll('.rpt-region-row');
  if(rows[idx]) rows[idx].scrollIntoView({behavior:'smooth',block:'nearest'});
  // 高亮闪烁
  const reg=reportData.regions[idx];
  if(reg){markCtx.save();markCtx.strokeStyle='#ffeb3b';markCtx.lineWidth=6;markCtx.strokeRect(reg.x-4,reg.y-4,reg.w+8,reg.h+8);markCtx.restore();setTimeout(()=>drawReportMarkers(reportData.regions),800);}
}

// ====== REPORT MARKERS ======
function drawReportMarkers(regions) {
  markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);
  const w=markCanvas.width;
  regions.forEach((reg,i)=>{
    if(!regionChecked[i]) return;
    const a=reg.analysis;
    const color=a?a.issue.borderColor:'#00b0ff';
    markCtx.save();
    markCtx.strokeStyle=color;
    markCtx.lineWidth=Math.max(2,Math.round(w/400));
    markCtx.setLineDash([8,4]);
    markCtx.strokeRect(reg.x,reg.y,reg.w,reg.h);
    markCtx.setLineDash([]);
    const fs=Math.max(12,Math.round(w/80));
    const pad=4;
    const label='#'+reg.id;
    markCtx.font=`bold ${fs}px sans-serif`;
    const tw=markCtx.measureText(label).width;
    const bw=tw+pad*2,bh=fs+pad*2;
    const bx=reg.x,by=Math.max(0,reg.y-bh-2);
    markCtx.fillStyle=color;
    markCtx.beginPath();
    markCtx.roundRect?markCtx.roundRect(bx,by,bw,bh,3):markCtx.rect(bx,by,bw,bh);
    markCtx.fill();
    markCtx.fillStyle='#fff';
    markCtx.textBaseline='top';
    markCtx.fillText(label,bx+pad,by+pad);
    markCtx.restore();
  });
  markCanvas.style.display='block';
}
function clearReportMarkers() {
  if(isComparing){runAnalysis();}
  else{markCtx.clearRect(0,0,markCanvas.width,markCanvas.height);markCanvas.style.display='none';}
  clickCtx.clearRect(0,0,clickCanvas.width,clickCanvas.height);
}
function onClickCanvasClick(e) {
  if(activeTool) return; // annotation tool active, ignore report clicks
  if(!reportData) return;
  const p=getPos(e);
  reportData.regions.forEach((r,i)=>{
    const cx=r.x+r.w/2,cy=r.y+r.h/2;
    if(Math.sqrt((p.x-cx)**2+(p.y-cy)**2)<8) scrollToRegionById(i);
  });
}
function onClickCanvasMove(e) {
  if(activeTool) return; // annotation tool handles cursor, skip tooltip
  if(!reportData) return;
  const p=getPos(e);
  let found=null,foundIdx=-1;
  reportData.regions.forEach((r,i)=>{
    const cx=r.x+r.w/2,cy=r.y+r.h/2;
    if(Math.sqrt((p.x-cx)**2+(p.y-cy)**2)<10){found=r;foundIdx=i;}
  });
  if(found){
    canvasTooltip.style.display='block';
    canvasTooltip.style.left=(e.clientX-layers.getBoundingClientRect().left+8)+'px';
    canvasTooltip.style.top=(e.clientY-layers.getBoundingClientRect().top-24)+'px';
    const a=found.analysis;
    canvasTooltip.textContent='区域 #'+found.id+(a?' ('+a.issue.label+')':'');
  }else{canvasTooltip.style.display='none';}
}
function scrollToRegion(id) {
  // legacy compat
  if(reportData){const idx=reportData.regions.findIndex(x=>x.id===id);if(idx>=0)scrollToRegionById(idx);}
}
