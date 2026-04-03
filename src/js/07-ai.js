'use strict';
// ====== AI ======
function loadAIConfig(){try{const s=localStorage.getItem('qaAIConfig');if(s)Object.assign(aiConfig,JSON.parse(s));}catch(e){}}
function saveAIConfig(){localStorage.setItem('qaAIConfig',JSON.stringify(aiConfig));}
function syncAIConfigToForm(){
  const t=document.getElementById('ai-type-sel'),u=document.getElementById('ai-url-inp'),m=document.getElementById('ai-model-inp'),k=document.getElementById('ai-key-inp');
  if(t)t.value=aiConfig.type||'ollama';if(u)u.value=aiConfig.url||'http://localhost:11434';if(m)m.value=aiConfig.model||'';if(k)k.value=aiConfig.apiKey||'';
  updateAIKeyRowVisibility();
}
function updateAIStatusDot(){
  const dot=document.getElementById('ai-status-dot');if(!dot)return;
  if(!aiConfig.enabled||!aiConfig.model){dot.textContent='● 未配置';dot.style.color='#666';}
  else{dot.textContent='● '+aiConfig.model;dot.style.color='#4ecca3';}
}
function toggleAIConfig(){const f=document.getElementById('ai-config-form');if(f)f.style.display=f.style.display==='none'?'block':'none';}
function onAITypeChange(){
  const type=document.getElementById('ai-type-sel').value;
  const u=document.getElementById('ai-url-inp'),m=document.getElementById('ai-model-inp');
  const urls={ollama:'http://localhost:11434',siliconflow:'https://api.siliconflow.cn',zhipu:'https://open.bigmodel.cn/api/paas',qwen:'https://dashscope.aliyuncs.com/compatible-mode',openai:'https://api.openai.com'};
  if(u)u.value=urls[type]||'';updateAIKeyRowVisibility();
}
function updateAIKeyRowVisibility(){const type=document.getElementById('ai-type-sel')?.value||aiConfig.type;const row=document.getElementById('ai-key-row');if(row)row.style.display=type==='ollama'?'none':'block';}
function saveAIConfigUI(){
  aiConfig.type=document.getElementById('ai-type-sel').value;
  aiConfig.url=document.getElementById('ai-url-inp').value.replace(/\/$/,'');
  aiConfig.model=document.getElementById('ai-model-inp').value.trim();
  aiConfig.apiKey=(document.getElementById('ai-key-inp')?.value||'').trim();
  aiConfig.enabled=!!aiConfig.model;
  saveAIConfig();updateAIStatusDot();
  const msg=document.getElementById('ai-config-msg');if(msg){msg.textContent='✓ 已保存';msg.style.color='#4ecca3';}
  setTimeout(()=>{const m=document.getElementById('ai-config-msg');if(m&&m.textContent==='✓ 已保存')m.textContent='';},2000);
}
async function testAIConnection(){
  const msg=document.getElementById('ai-config-msg');if(msg){msg.textContent='连接中...';msg.style.color='#ffc107';}
  const url=(document.getElementById('ai-url-inp')?.value||aiConfig.url).replace(/\/$/,'');
  const type=document.getElementById('ai-type-sel')?.value||aiConfig.type;
  const key=document.getElementById('ai-key-inp')?.value.trim()||aiConfig.apiKey;
  try{
    const endpoint=type==='ollama'?url+'/api/tags':url+'/v1/models';
    const headers={};if(key)headers['Authorization']='Bearer '+key;
    const res=await fetch(endpoint,{headers,signal:AbortSignal.timeout(5000)});
    if(msg){msg.textContent=res.ok?'✓ 连接成功':'✗ 服务响应异常('+res.status+')';msg.style.color=res.ok?'#4ecca3':'#ff4757';}
  }catch(e){if(msg){msg.textContent='✗ 无法连接：'+e.message;msg.style.color='#ff4757';}}
}
function imgToBase64(imgEl,maxW=1024){
  const tc=document.createElement('canvas');
  const scale=Math.min(1,maxW/imgEl.naturalWidth);
  tc.width=Math.round(imgEl.naturalWidth*scale);tc.height=Math.round(imgEl.naturalHeight*scale);
  tc.getContext('2d').drawImage(imgEl,0,0,tc.width,tc.height);
  return tc.toDataURL('image/jpeg',0.85).split(',')[1];
}
const AI_PROMPT_FULL=`你是一名经验丰富的游戏UI质量保证工程师（QA）。我给你提供两张图片：第一张是设计原稿，第二张是线上截图。\n\n请从专业QA视角，对比分析两图的差异，找出线上截图中存在的UI问题。\n\n重要说明：\n- 设计原稿会包含多种UI状态，线上只展示当前状态\n- 设计稿多出的元素若疑似为隐藏状态，不作为问题，仅标注"[设计稿多出内容]"\n- 只有线上截图本应显示却错误/缺失的内容才算问题\n- 忽略微小的抗锯齿、渲染细节差异\n\n输出格式（每个问题一行）：\n[P级] 问题类型 | 问题描述 | 建议处理方式\n\nP0=阻断 P1=严重 P2=一般 P3=轻微\n按P级从高到低排列，不超过10个问题。若无明显问题，直接输出"未发现明显UI问题"。`;
async function callAIApi(b64Design,b64Live){
  const cfg=aiConfig;if(!cfg.enabled||!cfg.model)return null;
  const headers={'Content-Type':'application/json'};
  if(cfg.apiKey)headers['Authorization']='Bearer '+cfg.apiKey;
  let body;
  if(cfg.type==='ollama'){
    body=JSON.stringify({model:cfg.model,prompt:AI_PROMPT_FULL,images:[b64Design,b64Live],stream:false,options:{temperature:0.2}});
    const res=await fetch(cfg.url+'/api/generate',{method:'POST',headers,body});
    if(!res.ok)throw new Error('HTTP '+res.status);
    return(await res.json()).response;
  }else{
    body=JSON.stringify({model:cfg.model,messages:[{role:'user',content:[{type:'text',text:AI_PROMPT_FULL},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b64Design}},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b64Live}}]}],max_tokens:1000,temperature:0.2});
    const res=await fetch(cfg.url+'/v1/chat/completions',{method:'POST',headers,body});
    if(!res.ok)throw new Error('HTTP '+res.status);
    return(await res.json()).choices?.[0]?.message?.content;
  }
}
async function triggerAIAnalysis(){
  const sec=document.getElementById('ai-analysis-section');if(!sec)return;
  sec.innerHTML='<div style="color:#ffc107;font-size:11px;padding:6px 0">⏳ AI正在分析界面差异...</div>';
  try{
    const result=await callAIApi(imgToBase64(psImg),imgToBase64(gameImg));
    if(result) renderAIResult(result);
    else sec.innerHTML='<div style="color:#555;font-size:11px">AI分析未返回内容</div>';
  }catch(e){sec.innerHTML=`<div style="color:#ff4757;font-size:11px">AI分析失败：${e.message}</div>`;}
}
function renderAIResult(text){
  const sec=document.getElementById('ai-analysis-section');if(!sec)return;
  const lines=text.trim().split('\n').filter(l=>l.trim());
  const sColors={P0:'#ff4757',P1:'#ff6b35',P2:'#ffc107',P3:'#888'};
  let html='';
  lines.forEach(line=>{
    const m=line.match(/^\[(P[0-3])\]\s*(.+?)\s*\|\s*(.+?)(\s*\|\s*(.+))?$/);
    if(m){
      const[,p,type,desc,,suggest]=m;const color=sColors[p]||'#888';
      html+=`<div style="border-left:3px solid ${color};padding:6px 8px;margin-bottom:6px;background:rgba(255,255,255,.03);border-radius:0 5px 5px 0">
        <div><span style="background:${color}33;color:${color};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold">${p}</span><span style="color:#ddd;font-size:11px;margin-left:5px">${type}</span></div>
        <div style="color:#bbb;font-size:11px;margin-top:3px">${desc}</div>
        ${suggest?`<div style="color:#666;font-size:10px;margin-top:2px">→ ${suggest}</div>`:''}
      </div>`;
    }else{html+=`<div style="color:#888;font-size:11px;padding:4px 0;border-left:2px solid #333;padding-left:7px;margin-bottom:4px">${line}</div>`;}
  });
  sec.innerHTML=html||'<div style="color:#888;font-size:11px">未发现明显UI问题</div>';
}
