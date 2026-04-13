'use strict';
// ====== AI ======
function loadAIConfig(){try{const s=localStorage.getItem('qaAIConfig');if(s)Object.assign(aiConfig,JSON.parse(s));}catch(e){}}
function saveAIConfig(){localStorage.setItem('qaAIConfig',JSON.stringify(aiConfig));}
function syncAIConfigToForm(){
  const t=document.getElementById('ai-type-sel'),u=document.getElementById('ai-url-inp'),m=document.getElementById('ai-model-inp'),k=document.getElementById('ai-key-inp');
  if(t)t.value=aiConfig.type||'ollama';if(u)u.value=aiConfig.url||'http://localhost:11434';if(m)m.value=aiConfig.model||'';if(k)k.value=aiConfig.apiKey||'';
  updateAIKeyRowVisibility();
  // Sync diag type checkboxes
  const types=aiConfig.diagTypes||['位置偏移','功能缺失','颜色差异','文字差异','尺寸差异'];
  document.querySelectorAll('#diag-type-grid input[type=checkbox]').forEach(cb=>{
    cb.checked=types.includes(cb.value);
  });
  const mi=document.getElementById('ai-maxissues-inp');
  if(mi) mi.value=aiConfig.diagMaxIssues||5;
  // Sync diagnosis context and ignore options
  const ctx=document.getElementById('ai-diagcontext-inp');
  if(ctx) ctx.value=aiConfig.diagContext||'';
  const ignores=aiConfig.diagIgnore||[];
  const ignText=document.getElementById('diag-ignore-text');
  const ignAsset=document.getElementById('diag-ignore-asset');
  const ignMissing=document.getElementById('diag-ignore-missing');
  if(ignText) ignText.checked=ignores.includes('text');
  if(ignAsset) ignAsset.checked=ignores.includes('asset');
  if(ignMissing) ignMissing.checked=ignores.includes('missing');
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
  // Save diag config
  const checked=[];
  document.querySelectorAll('#diag-type-grid input[type=checkbox]:checked').forEach(cb=>checked.push(cb.value));
  aiConfig.diagTypes=checked.length?checked:['位置偏移','功能缺失','颜色差异','文字差异','尺寸差异'];
  aiConfig.diagMaxIssues=Math.max(1,parseInt(document.getElementById('ai-maxissues-inp')?.value)||5);
  // Save context and ignore options
  aiConfig.diagContext=(document.getElementById('ai-diagcontext-inp')?.value||'').trim();
  const ignores=[];
  if(document.getElementById('diag-ignore-text')?.checked) ignores.push('text');
  if(document.getElementById('diag-ignore-asset')?.checked) ignores.push('asset');
  if(document.getElementById('diag-ignore-missing')?.checked) ignores.push('missing');
  aiConfig.diagIgnore=ignores;
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

// ====== 一键诊断 AI 调用 ======

// System prompt for per-region description (simpler than full-image analysis)
const DIAG_REGION_SYSTEM=`你是游戏UI质量工程师。我会给你两张同一区域的局部截图：图1是设计原稿，图2是游戏截图。
你的任务：用1-3个简短标签描述图2相对图1的差异。
规则：只输出标签，用顿号分隔，不解释，不加标点以外的文字。每个标签2-6个字。若无差异输出：无差异。`;

// System prompt: UI QA standards whitepaper condensed into directives
const DIAG_SYSTEM_PROMPT = `你是一名专业游戏UI视觉质量工程师（Senior QA Engineer），负责对比设计原稿与游戏截图，输出结构化缺陷报告。

【角色约束】
使用冷静、精准、技术化的QA语言，禁止使用模糊表达。每个问题必须包含：组件名称、偏差方向、量化数值。描述格式：「[组件]：[属性]由[设计值]变为[实现值]，偏差[量化]」。

【文字渲染检查规则】
- 字重偏差±100级且字号≥17px → P2；偏差±200级及以上 → P1；Bold降为Regular → P0
- 行高<字号×1.2且多行排布 → P1；文本溢出容器被硬截断 → P1
- 描述示例：「标题字重由700降为400，字号28px，标题层级丧失」

【色彩偏差检查规则】
- ΔE 0-1：通过；ΔE 1-2：P3；ΔE 2-3.5：P2；ΔE 3.5-10：P1；ΔE>10：P0
- 主色调按钮/品牌色/状态色阈值收紧至ΔE<1.5
- 描述示例：「主按钮背景色ΔE≈8.7，蓝色调明显偏暖，偏离品牌色」

【空间节奏检查规则】
- 外边距偏移1-3px：P3；4-8px：P2；9-20px：P1；>20px：P0
- 内边距实现值<设计值50%且内容贴边 → P2
- 外边距坍塌：渲染间距<设计值80%且差值≥4px → P2
- 描述示例：「卡片水平Padding由16px降为8px，内容贴边，呼吸感丧失」

【组件状态检查规则】
- 同一组件跨状态border-radius偏差≥2px → P2
- 圆角完全丢失（设计圆角→实现直角）→ P1
- 宽高比非1:1导致圆形变椭圆 → P2
- 描述示例：「按钮Disabled状态border-radius由8px降为4px，状态视觉连贯性断裂」

【输出格式（严格遵守）】
每行一个问题区域：
[P级] 组件名称 | x,y,w,h | 问题①、问题②、问题③

- x,y,w,h为问题区域在游戏截图中的百分比坐标（整数0-100），x,y为左上角，w,h为宽高
- 同一组件所有问题合并至同一行，用顿号（、）分隔，不得拆行
- 描述必须量化，如「向右偏移约15px」而非「位置有偏差」
- 按P0→P3严重程度排序
- 若无任何差异，仅输出：无明显问题`;

// User-turn prompt: only task variables (rules are in system prompt)
function buildDiagPrompt(types, maxN) {
  let prompt=`图1是设计原稿，图2是游戏截图。\n\n本次检测范围：${types.join('、')}\n最多输出 ${maxN} 个有问题的UI区域，优先输出问题最多或最严重的区域。\n\n请逐一检查两图中每个UI组件，将同一组件的所有差异合并到一行输出。`;

  // Inject business context (helps AI filter false positives)
  const ctx=(aiConfig.diagContext||'').trim();
  if(ctx){
    prompt+=`\n\n【业务背景与语境】\n${ctx}`;
  }

  // Inject ignore rules
  const ignores=aiConfig.diagIgnore||[];
  const ignoreRules=[];
  if(ignores.includes('text'))    ignoreRules.push('文字/数值内容的差异（如数字不同、文字内容不同，属于数据差异，请跳过，不视为问题）');
  if(ignores.includes('asset'))   ignoreRules.push('图标/图片的具体图案变化（如金银铜等级图标差异、不同状态的资产变体，属于游戏状态差异，请跳过）');
  if(ignores.includes('missing')) ignoreRules.push('设计稿中存在但线上截图中未显示的元素（可能是未上线功能或未配置内容，请跳过，不视为问题）');
  if(ignoreRules.length>0){
    prompt+=`\n\n【以下类型差异请忽略，不要输出为问题】\n`+ignoreRules.map((r,i)=>`${i+1}. ${r}`).join('\n');
  }

  return prompt;
}

async function callAIDiagnosis() {
  if(!aiConfig.enabled||!aiConfig.model) return null;
  const types=aiConfig.diagTypes&&aiConfig.diagTypes.length?aiConfig.diagTypes:['位置偏移','功能缺失','颜色差异','文字差异','尺寸差异'];
  const maxN=aiConfig.diagMaxIssues||5;
  const userPrompt=buildDiagPrompt(types,maxN);
  const headers={'Content-Type':'application/json'};
  if(aiConfig.apiKey) headers['Authorization']='Bearer '+aiConfig.apiKey;
  const b64Design=imgToBase64(psImg), b64Live=imgToBase64(gameImg);
  if(aiConfig.type==='ollama'){
    // Ollama: pass system via dedicated field + user prompt
    const body=JSON.stringify({
      model:aiConfig.model,
      system:DIAG_SYSTEM_PROMPT,
      prompt:userPrompt,
      images:[b64Design,b64Live],
      stream:false,
      options:{temperature:0.1}
    });
    const res=await fetch(aiConfig.url+'/api/generate',{method:'POST',headers,body});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return (await res.json()).response;
  } else {
    // OpenAI-compatible (incl. Gemini via proxy): system prompt as first message
    const body=JSON.stringify({
      model:aiConfig.model,
      messages:[
        {role:'system', content:DIAG_SYSTEM_PROMPT},
        {role:'user', content:[
          {type:'text', text:userPrompt},
          {type:'image_url', image_url:{url:'data:image/jpeg;base64,'+b64Design}},
          {type:'image_url', image_url:{url:'data:image/jpeg;base64,'+b64Live}}
        ]}
      ],
      max_tokens:1200,
      temperature:0.1
    });
    const res=await fetch(aiConfig.url+'/v1/chat/completions',{method:'POST',headers,body});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return (await res.json()).choices?.[0]?.message?.content;
  }
}

function parseDiagResponse(text) {
  // Parse: [P1] 确认按钮 | 55,78,22,8 | 位置偏移、颜色差异、...
  const results=[], lines=text.trim().split('\n').filter(l=>l.trim());
  const pColors={'P0':'#ff4757','P1':'#ff6b35','P2':'#ffc107','P3':'#a29bfe'};
  for(const line of lines){
    // Allow component names with Chinese chars, spaces, etc.
    const m=line.match(/^\[?(P[0-3])\]?\s*(.+?)\s*\|\s*(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\s*\|\s*(.+)$/);
    if(m){
      const [,p,type,x,y,w,h,desc]=m;
      // Clamp coords to valid range
      const cx=Math.max(0,Math.min(99,parseFloat(x)));
      const cy=Math.max(0,Math.min(99,parseFloat(y)));
      const cw=Math.max(1,Math.min(100-cx,parseFloat(w)));
      const ch=Math.max(1,Math.min(100-cy,parseFloat(h)));
      results.push({p,type:type.trim(),x:cx,y:cy,w:cw,h:ch,desc:desc.trim(),color:pColors[p]||'#007AFF'});
    }
  }
  return results;
}

// Build ignore rules string for per-region prompt
function buildIgnoreRules() {
  const ignores=aiConfig.diagIgnore||[];
  const rules=[];
  if(ignores.includes('text'))    rules.push('文字和数值内容的差异');
  if(ignores.includes('asset'))   rules.push('图标/图片的具体图案变化（等级、状态差异）');
  if(ignores.includes('missing')) rules.push('设计稿有但线上未显示的元素');
  return rules.length?'请忽略：'+rules.join('、')+'。':'';
}

// Step 2: Send ONE pair of cropped region images to AI, get simple tag descriptions
// Single call: full images + pixel-diff region hints → AI describes each region
async function callAIDiagnosisWithHints(regions) {
  if(!aiConfig.enabled||!aiConfig.model) return null;
  const types=(aiConfig.diagTypes||[]).join('、');
  const ignoreStr=buildIgnoreRules();
  const refTags='颜色偏差、颜色偏暗、颜色偏亮、背景色差异、向右偏移、向左偏移、向上偏移、向下偏移、间距偏差、对齐偏差、元素偏大、元素偏小、宽度不符、高度不符、文字差异、字号不符、字重不符、元素缺失、多余内容、圆角差异、边框差异、阴影差异';

  // Build location hints from pixel diff regions (percentage coords)
  const hints=regions.map((reg,i)=>{
    const x=Math.round(reg.x/markCanvas.width*100);
    const y=Math.round(reg.y/markCanvas.height*100);
    const w=Math.round(reg.w/markCanvas.width*100);
    const h=Math.round(reg.h/markCanvas.height*100);
    return `区域${i+1}：左上角约(${x}%,${y}%)，大小约${w}%×${h}%`;
  }).join('\n');

  const userPrompt=`图1是设计原稿，图2是游戏截图。

像素分析已定位到 ${regions.length} 个差异区域：
${hints}

请逐一检查上述每个区域，描述图2中存在的UI差异。
检测范围：${types||'全部'}。${ignoreStr}

输出格式（每行一个区域，不加其他文字）：
#1: 标签A、标签B、标签C
#2: 标签A、标签B

规则：
- 每个区域必须输出2-4个标签，标签2-6个字
- 若该区域确实无差异，输出：#N: 无差异
- 参考词汇：${refTags}`;

  const b64Design=imgToBase64(psImg), b64Live=imgToBase64(gameImg);
  const headers={'Content-Type':'application/json'};
  if(aiConfig.apiKey) headers['Authorization']='Bearer '+aiConfig.apiKey;

  if(aiConfig.type==='ollama'){
    const body=JSON.stringify({model:aiConfig.model,system:DIAG_SYSTEM_PROMPT,prompt:userPrompt,images:[b64Design,b64Live],stream:false,options:{temperature:0.1,num_predict:200}});
    const res=await fetch(aiConfig.url+'/api/generate',{method:'POST',headers,body});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return (await res.json()).response?.trim();
  } else {
    const body=JSON.stringify({model:aiConfig.model,messages:[
      {role:'system',content:DIAG_SYSTEM_PROMPT},
      {role:'user',content:[
        {type:'text',text:userPrompt},
        {type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b64Design}},
        {type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b64Live}}
      ]}
    ],max_tokens:300,temperature:0.1});
    const res=await fetch(aiConfig.url+'/v1/chat/completions',{method:'POST',headers,body});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return (await res.json()).choices?.[0]?.message?.content?.trim();
  }
}

// Generate outline comparison image for AI (off-screen, no UI side effects)
function getOutlineBase64ForAI() {
  if(!gameImg||!psImg||typeof detectEdges!=='function') return null;
  try {
    const w=markCanvas.width, h=markCanvas.height;
    if(!w||!h) return null;
    const edges1=detectEdges(gameImg,w,h); // R channel = game
    const edges2=detectEdges(psImg,w,h);   // G channel = design
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d');
    const imgData=ctx.createImageData(w,h); const d=imgData.data;
    for(let i=0;i<w*h;i++){
      const idx=i*4;
      d[idx]=edges1[i]; d[idx+1]=edges2[i]; d[idx+2]=0;
      d[idx+3]=(edges1[i]||edges2[i])?255:128; // semi-transparent bg
    }
    ctx.putImageData(imgData,0,0);
    // Scale to max 512px wide for API (keep payload small)
    const maxW=512;
    if(w<=maxW) return c.toDataURL('image/jpeg',0.85).split(',')[1];
    const out=document.createElement('canvas');
    out.width=maxW; out.height=Math.round(h*(maxW/w));
    out.getContext('2d').drawImage(c,0,0,out.width,out.height);
    return out.toDataURL('image/jpeg',0.85).split(',')[1];
  } catch(e){ return null; }
}

// ====== 简洁诊断（单次全图，纯标签列表输出）======

const DIAG_SIMPLE_SYSTEM=`你是游戏UI质量工程师。我会给你3张图：图1=设计原稿，图2=游戏截图，图3=轮廓对比图。

图3颜色规则（优先参考）：
- 纯绿色区域 → 设计稿有、游戏没有 → 功能缺失
- 纯红色区域 → 游戏有、设计稿没有 → 多余内容
- 红绿相邻且形状相似 → 同一元素位置偏移
- 红绿相邻但形状差异大 → 尺寸或样式差异
- 无颜色区域 → 该区域无结构差异

先解读图3定性问题类型，再结合图1和图2描述具体差异。每行描述一个区域，每行从视觉/布局/内容三个维度输出有差异的短描述，用顿号分隔，不捏造不存在的问题，不加解释。`;

async function callAIDiagSimple() {
  if(!aiConfig.enabled||!aiConfig.model) return null;
  const maxN=aiConfig.diagMaxIssues||5;
  const types=(aiConfig.diagTypes||[]).join('、');
  const ctx=(aiConfig.diagContext||'').trim();
  const ignoreStr=buildIgnoreRules();
  const refTags='颜色偏差、颜色偏暗、颜色偏亮、背景色差异、向右偏移、向左偏移、向上偏移、向下偏移、间距偏差、对齐偏差、元素偏小、元素偏大、宽度不符、高度不符、文字差异、字号不符、字重不符、元素缺失、多余内容、圆角差异、边框差异、阴影差异';

  let prompt=`你是游戏UI质量工程师，用简短描述输出差异，不解释，不捏造。

图1=设计原稿，图2=游戏截图。检测范围：${types||'全部'}。
找出最多 ${maxN} 个差异区域，每区域一行，从视觉/布局/内容维度描述，有差异的维度输出2-5字短描述，用顿号分隔。
示例：颜色偏暗、向右偏移、元素缺失
示例：向右偏移、间距偏差
参考词汇：${refTags}`;

  if(ctx) prompt+=`\n\n背景说明：${ctx}`;
  if(ignoreStr) prompt+=`\n\n${ignoreStr}`;

  const headers={'Content-Type':'application/json'};
  if(aiConfig.apiKey) headers['Authorization']='Bearer '+aiConfig.apiKey;
  // Compress images to 512px max for API (reduce payload size)
  const b64Design=imgToBase64(psImg,512), b64Live=imgToBase64(gameImg,512);
  const b64Outline=getOutlineBase64ForAI();

  if(aiConfig.type==='ollama'){
    const images=b64Outline?[b64Design,b64Live,b64Outline]:[b64Design,b64Live];
    const body=JSON.stringify({model:aiConfig.model,system:DIAG_SIMPLE_SYSTEM,prompt,images,stream:false,options:{temperature:0.1,num_predict:400}});
    const res=await fetch(aiConfig.url+'/api/generate',{method:'POST',headers,body});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return (await res.json()).response?.trim();
  } else {
    // Merge system prompt into user message (some proxies don't support role:'system')
    const doCall=async(imgs, userPrompt)=>{
      const content=[
        {type:'text', text:userPrompt},
        ...imgs.map(b=>({type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b}}))
      ];
      const body=JSON.stringify({model:aiConfig.model,messages:[
        {role:'user',content}
      ],max_tokens:500,temperature:0.1});
      const res=await fetch(aiConfig.url+'/v1/chat/completions',{method:'POST',headers,body});
      if(!res.ok){
        const errBody=await res.text().catch(()=>'');
        console.error('[一键诊断] 400详情:', errBody);
        throw new Error('HTTP '+res.status);
      }
      return (await res.json()).choices?.[0]?.message?.content?.trim();
    };
    // Try with outline (3 images); if 400, fall back to 2 images
    const imgs3=b64Outline?[b64Design,b64Live,b64Outline]:[b64Design,b64Live];
    try{
      return await doCall(imgs3, prompt);
    }catch(e){
      if(e.message.includes('400')&&b64Outline){
        console.log('[一键诊断] 3图400，降级为2图');
        return await doCall([b64Design,b64Live], prompt);
      }
      throw e;
    }
  }
}

// Parse AI output: each non-empty line is one region's description
function parseDiagSimple(text) {
  if(!text) return [];
  return text.split('\n')
    .map(l=>l.replace(/^[-•·\d\.\)\s]+/,'').trim())
    .filter(l=>{
      if(l.length<=1||l==='无差异'||l.includes('示例')) return false;
      // Keep lines that have actual problem content (colon separator or Chinese problem words)
      const hasProblem=/[：:、偏|差|缺|多|不|偏|移|失|异|大|小|重|号]/.test(l);
      return hasProblem;
    });
}

// Parse "#1: tagA、tagB\n#2: tagC" → array indexed by region
function parseDiagWithHints(text, regionCount) {
  const results=new Array(regionCount).fill(null);
  if(!text) return results;
  text.trim().split('\n').forEach(line=>{
    const m=line.match(/^#(\d+)[：:]\s*(.+)$/);
    if(m){
      const idx=parseInt(m[1])-1;
      if(idx>=0&&idx<regionCount){
        const desc=m[2].trim();
        if(desc&&desc!=='无差异') results[idx]=desc;
      }
    }
  });
  return results;
}
