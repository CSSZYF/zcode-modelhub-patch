;window.__mhToast=(msg,ok=true)=>{try{const d=document.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;max-width:420px;padding:12px 16px;border-radius:10px;font-size:13px;line-height:1.5;background:#18181b;color:#fafafa;border:1px solid '+(ok?'#3f3f46':'#b91c1c')+';box-shadow:0 8px 24px rgba(0,0,0,.45);opacity:0;transition:opacity .2s,transform .2s;transform:translateY(6px)';document.body.appendChild(d);requestAnimationFrame(()=>{d.style.opacity='1';d.style.transform='translateY(0)'});setTimeout(()=>{d.style.opacity='0';d.style.transform='translateY(6px)';setTimeout(()=>d.remove(),300)},ok?3500:6000)}catch(e){}};
;window.__mhDialect=function(fmt){try{if(fmt==='anthropic-messages')return'anthropic';if(fmt==='openai-responses')return'openai';if(fmt==='openai-chat-completions')return'openai-compatible';return String(fmt||'openai-compatible')}catch(e){return'openai-compatible'}};
;window.__mhPull=async function(ctx){try{
  if(!window.zcode||!window.zcode.modelhubFetchModels){window.__mhToast('补丁未加载',!1);return}
  const dialect=window.__mhDialect(ctx.format);
  const rr=await window.zcode.modelhubFetchModels(ctx.baseUrl,ctx.apiKey,ctx.provider&&ctx.provider.headers,dialect);
  if(!rr||!rr.ok){window.__mhToast('拉取失败：'+((rr&&rr.error)||'未知错误'),!1);return}
  if(!rr.models.length){window.__mhToast('该端点返回 0 个模型',!1);return}
  window.__mhPick(rr.models,{baseUrl:ctx.baseUrl,apiKey:ctx.apiKey,headers:ctx.provider&&ctx.provider.headers,dialect:dialect,onConfirm:async sel=>{
    try{
      const cur=(ctx.models||[]).map(m=>m.modelId);
      const fetched=new Set(rr.models.map(m=>m.id));
      const selIds=new Set(sel.map(s=>s.id));
      const keepManual=cur.filter(id=>!fetched.has(id)).length;
      const toDel=(ctx.models||[]).filter(m=>!m.builtin&&fetched.has(m.modelId)&&!selIds.has(m.modelId));
      const toAdd=sel.filter(s=>!cur.includes(s.id));
      let fail=0;
      for(const m of toDel){try{ctx.deleteModel&&ctx.deleteModel(m.modelId);await new Promise(r=>setTimeout(r,150))}catch(e){fail++}}
      for(const s of toAdd){try{await ctx.addModel({modelId:s.id,personalConfig:s.vision?{properties:{inputFormat:{supportsImage:!0}}}:{},useRecommendedConfig:!0})}catch(e){fail++}}
      window.__mhToast('生效 '+toAdd.length+' 个，移除 '+toDel.length+' 个，保留手动添加 '+keepManual+' 个'+(fail?'，失败 '+fail+' 个':''),!fail);
    }catch(e){window.__mhToast('应用失败：'+e,!1)}
  },onCancel:()=>{}});
}catch(e){window.__mhToast('拉取失败：'+((e&&e.message)||e),!1)}};
;window.__mhPick=function(items,opt){try{
  const old=document.getElementById('mh-picker-root');if(old)old.remove();
  const S={items:items.map(m=>({id:m.id,vision:false,checked:true,probing:false}))};
  const root=document.createElement('div');root.id='mh-picker-root';
  root.style.cssText='position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
  const panel=document.createElement('div');
  panel.style.cssText='width:600px;max-width:92vw;max-height:76vh;display:flex;flex-direction:column;background:#131316;color:#fafafa;border:1px solid #2e2e33;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.5);font-size:13px;overflow:hidden';
  const head=document.createElement('div');
  head.style.cssText='padding:12px 16px;border-bottom:1px solid #2e2e33;display:flex;align-items:center;justify-content:space-between';
  head.innerHTML='<span style="font-weight:600">\u9009\u62e9\u8981\u6dfb\u52a0\u7684\u6a21\u578b</span>';
  const x=document.createElement('button');x.textContent='\u00d7';x.style.cssText='background:none;border:none;color:#a1a1aa;font-size:18px;cursor:pointer';
  x.onclick=close;head.appendChild(x);
  const bar=document.createElement('div');
  bar.style.cssText='padding:10px 16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #2e2e33;flex-wrap:wrap';
  const search=document.createElement('input');search.placeholder='\u641c\u7d22\u6a21\u578b\u2026';
  search.style.cssText='flex:1;min-width:140px;background:#1c1c1f;border:1px solid #2e2e33;border-radius:8px;padding:6px 10px;color:#fafafa;outline:none';
  const mkBtn=(t)=>{const b=document.createElement('button');b.textContent=t;b.style.cssText='background:#1c1c1f;border:1px solid #2e2e33;border-radius:8px;padding:6px 10px;color:#e4e4e7;cursor:pointer';b.onmouseenter=()=>b.style.background='#27272a';b.onmouseleave=()=>b.style.background='#1c1c1f';return b};
  const all=mkBtn('\u5168\u9009'),none=mkBtn('\u5168\u4e0d\u9009'),probe=mkBtn('\u63a2\u6d4b\u89c6\u89c9(\u52fe\u9009\u9879)'),probeAll=mkBtn('\u63a2\u6d4b\u5168\u90e8');
  bar.append(search,all,none,probe,probeAll);
  const list=document.createElement('div');list.style.cssText='flex:1;overflow-y:auto;padding:6px 8px';
  const foot=document.createElement('div');
  foot.style.cssText='padding:12px 16px;border-top:1px solid #2e2e33;display:flex;align-items:center;justify-content:space-between';
  const info=document.createElement('span');info.style.color='#a1a1aa';
  const cancel=mkBtn('\u53d6\u6d88');cancel.onclick=close;
  const ok=document.createElement('button');ok.textContent='\u786e\u8ba4\u6dfb\u52a0';
  ok.style.cssText='background:#3b82f6;border:none;border-radius:8px;padding:7px 16px;color:#fff;font-weight:600;cursor:pointer';
  foot.append(info,cancel,ok);
  panel.append(head,bar,list,foot);root.appendChild(panel);document.body.appendChild(root);
  root.onmousedown=e=>{if(e.target===root)close()};
  function close(){root.remove();if(opt.onCancel)opt.onCancel()}
  function esc(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc)}}
  document.addEventListener('keydown',esc);
  function rowEl(it){
    const r=document.createElement('div');r.dataset.mid=it.id;
    r.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px';
    r.onmouseenter=()=>r.style.background='#1c1c1f';r.onmouseleave=()=>r.style.background='transparent';
    const c=document.createElement('input');c.type='checkbox';c.checked=it.checked;c.style.accentColor='#3b82f6';c.style.width='15px';c.style.height='15px';
    c.onchange=()=>{it.checked=c.checked;stat()};
    const id=document.createElement('span');id.textContent=it.id;id.title=it.id;
    id.style.cssText='flex:1;font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const v=document.createElement('button');
    const drawV=()=>{it.probing?(v.textContent='\u63a2\u6d4b\u4e2d…',v.style.color='#a1a1aa'):(v.textContent=it.vision?'\u89c6\u89c9 \u2713':'\u6587\u672c',v.style.color=it.vision?'#4ade80':'#a1a1aa');v.style.fontWeight=it.vision?'600':'400'};
    v.style.cssText='background:#1c1c1f;border:1px solid #2e2e33;border-radius:6px;padding:3px 10px;cursor:pointer;min-width:64px';
    v.onclick=()=>{it.vision=!it.vision;drawV()};
    drawV();it._drawV=drawV;it._row=r;
    r.append(c,id,v);return r;
  }
  function renderList(){
    list.innerHTML='';const q=search.value.trim().toLowerCase();
    S.items.forEach(it=>{
      const show=!q||it.id.toLowerCase().includes(q);
      if(it._row)show?list.appendChild(it._row):null;
    });
    if(!list.children.length){const e=document.createElement('div');e.textContent='\u65e0\u5339\u914d';e.style.cssText='color:#71717a;text-align:center;padding:20px';list.appendChild(e)}
  }
  function stat(){const n=S.items.filter(i=>i.checked).length;info.textContent='\u5df2\u9009 '+n+' / '+S.items.length+' \u4e2a\u6a21\u578b'}
  const rows=S.items.map(rowEl);renderList();stat();
  search.oninput=renderList;
  all.onclick=()=>{S.items.forEach(it=>{const q=search.value.trim().toLowerCase();if(!q||it.id.toLowerCase().includes(q))it.checked=true});rows.forEach(r=>{const c=r.querySelector('input');if(r.style.display!=='none')c.checked=true});renderList();stat()};
  none.onclick=()=>{S.items.forEach(it=>it.checked=false);rows.forEach(r=>{r.querySelector('input').checked=false});stat()};
  async function doProbe(targets){
    const base=opt.baseUrl,ak=opt.apiKey;
    const queue=targets.slice();let done=0;const total=targets.length;
    info.textContent='\u63a2\u6d4b\u4e2d 0/'+total;
    async function worker(){
      while(queue.length){
        const it=queue.shift();it.probing=true;it._drawV();
        let res=null;
        try{res=await window.zcode.modelhubProbeVision(base,ak,it.id,opt.headers,opt.dialect)}catch(e){res={ok:false,error:String(e)}}
        it.probing=false;
        if(res&&res.ok)it.vision=res.vision;else it.vision=false;
        it._drawV();done++;info.textContent='\u63a2\u6d4b\u4e2d '+done+'/'+total;
      }
    }
    await Promise.all([worker(),worker(),worker(),worker()]);
    info.textContent='\u63a2\u6d4b\u5b8c\u6210';
  }
  probe.onclick=()=>doProbe(S.items.filter(i=>i.checked));
  probeAll.onclick=()=>{S.items.forEach(i=>i.checked=true);rows.forEach(r=>{r.querySelector('input').checked=true});stat();doProbe(S.items)};
  ok.onclick=()=>{const sel=S.items.filter(i=>i.checked).map(i=>({id:i.id,vision:i.vision}));root.remove();document.removeEventListener('keydown',esc);if(sel.length&&opt.onConfirm)opt.onConfirm(sel)};
}catch(e){console.error('[modelhub] picker error',e);if(window.__mhToast)window.__mhToast('\u9009\u62e9\u5668\u5f02\u5e38\uff1a'+e,!1)}};
;window.__mhHeaders=function(provider,save){try{
  const old=document.getElementById('mh-headers-root');if(old)old.remove();
  const PRESETS={
    claude:[
      {k:'user-agent',v:'claude-cli/2.1.6 (external, cli)'},
      {k:'x-app',v:'cli'},
      {k:'anthropic-version',v:'2023-06-01'},
      {k:'anthropic-beta',v:'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'},
      {k:'accept',v:'application/json'},
      {k:'x-stainless-lang',v:'js'},
      {k:'x-stainless-runtime',v:'node'},
      {k:'x-stainless-runtime-version',v:'v24.13.0'},
      {k:'x-stainless-os',v:'Windows'},
      {k:'x-stainless-arch',v:'x64'},
      {k:'x-stainless-package-version',v:'0.60.0'},
      {k:'x-stainless-retry-count',v:'0'},
      {k:'x-stainless-timeout',v:'600000'}
    ],
    codex:[
      {k:'user-agent',v:'codex_cli_rs/0.42.0 (Windows 11.0.26100; x86_64) unknown'},
      {k:'OpenAI-Beta',v:'responses=experimental'},
      {k:'originator',v:'codex_cli_rs'},
      {k:'session_id',v:'',auto:'uuid'},
      {k:'accept',v:'text/event-stream'},
      {k:'version',v:'0.42.0'}
    ]
  };
  let tab='claude';
  const S={};
  const cur=provider.headers||{};
  const shared={};for(const _t in PRESETS)for(const _h of PRESETS[_t])shared[_h.k]=(shared[_h.k]||0)+1;
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
  function loadTab(t){tab=t;if(!S[t])S[t]=PRESETS[t].map(h=>({k:h.k,auto:h.auto,checked:cur[h.k]!==undefined,value:(shared[h.k]>1)?(h.auto?uuid():h.v):(cur[h.k]!==undefined?cur[h.k]:(h.auto?uuid():h.v))}));S[t].forEach(h=>{if(h.auto&&!h.value)h.value=uuid()});render()}
  const root=document.createElement('div');root.id='mh-headers-root';
  root.style.cssText='position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
  const panel=document.createElement('div');
  panel.style.cssText='width:640px;max-width:92vw;max-height:76vh;display:flex;flex-direction:column;background:#131316;color:#fafafa;border:1px solid #2e2e33;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.5);font-size:13px;overflow:hidden';
  const head=document.createElement('div');
  head.style.cssText='padding:12px 16px;border-bottom:1px solid #2e2e33;display:flex;align-items:center;justify-content:space-between';
  head.innerHTML='<span style="font-weight:600">请求头模拟</span><span style="color:#a1a1aa;font-size:12px">勾选=生效 · 取消勾选=移除 · 仅影响当前渠道</span>';
  const x=document.createElement('button');x.textContent='×';x.style.cssText='background:none;border:none;color:#a1a1aa;font-size:18px;cursor:pointer';x.onclick=close;
  head.appendChild(x);
  const tabs=document.createElement('div');
  tabs.style.cssText='padding:10px 16px;display:flex;gap:8px;border-bottom:1px solid #2e2e33';
  const mkBtn=(t,st)=>{const b=document.createElement('button');b.textContent=t;b.style.cssText=(st||'')+'padding:7px 14px;border-radius:8px;border:1px solid #2e2e33;background:#1c1c1f;color:#e4e4e7;cursor:pointer';return b};
  const mkTab=t=>{const b=mkTabBtn(t);b.onclick=()=>{loadTab(t);[...tabs.children].forEach(c=>{c.style.background='#1c1c1f';c.style.color='#e4e4e7'});b.style.background='#3b82f6';b.style.color='#fff'};return b};
  function mkTabBtn(t){const b=mkBtn(t==='claude'?'Claude (claude-cli)':'Codex (codex_cli_rs)');return b}
  tabs.append(mkTab('claude'),mkTab('codex'));
  const list=document.createElement('div');list.style.cssText='flex:1;overflow-y:auto;padding:8px 12px';
  const foot=document.createElement('div');
  foot.style.cssText='padding:12px 16px;border-top:1px solid #2e2e33;display:flex;align-items:center;justify-content:space-between;gap:8px';
  const info=document.createElement('span');info.style.color='#a1a1aa';
  const clear=mkBtn('清除全部模拟');
  clear.onclick=()=>{try{const out={...(provider.headers||{})};let rem=0;for(const _t in PRESETS)for(const _h of PRESETS[_t])if(out[_h.k]!==undefined){delete out[_h.k];rem++}save({...provider,headers:out});close();if(window.__mhToast)window.__mhToast('已清除此渠道的 '+rem+' 个模拟请求头')}catch(e){if(window.__mhToast)window.__mhToast('清除失败：'+e,!1)}};
  const cancel=mkBtn('取消');cancel.onclick=close;
  const ok=document.createElement('button');ok.textContent='应用';ok.style.cssText='padding:7px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-weight:600;cursor:pointer';
  foot.append(info,clear,cancel,ok);
  panel.append(head,tabs,list,foot);root.appendChild(panel);document.body.appendChild(root);
  root.onmousedown=e=>{if(e.target===root)close()};
  function esc(ev){if(ev.key==='Escape'){close();document.removeEventListener('keydown',esc)}}
  document.addEventListener('keydown',esc);
  function close(){root.remove();document.removeEventListener('keydown',esc)}
  function render(){
    list.innerHTML='';stat();
    for(const h of S[tab]){
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:8px';
      const c=document.createElement('input');c.type='checkbox';c.checked=h.checked;c.style.accentColor='#3b82f6';c.style.width='15px';c.style.height='15px';
      c.onchange=()=>{h.checked=c.checked;if(h.auto&&h.checked&&!h.value)h.value=uuid();stat()};
      const k=document.createElement('span');k.textContent=h.k;k.title=h.k;
      k.style.cssText='width:220px;flex-shrink:0;font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      const v=document.createElement('input');v.value=h.value;
      v.style.cssText='flex:1;background:#1c1c1f;border:1px solid #2e2e33;border-radius:6px;padding:4px 8px;color:#fafafa;font-family:ui-monospace,Consolas,monospace;font-size:12px;outline:none';
      v.oninput=()=>{h.value=v.value};
      if(h.auto){const rb=mkBtn('换一个','font-size:11px;padding:4px 8px;');rb.onclick=()=>{h.value=uuid();v.value=h.value};row.append(c,k,v,rb)}
      else row.append(c,k,v);
      list.appendChild(row);
    }
  }
  function stat(){const n=S[tab].filter(h=>h.checked).length;info.textContent='勾选 '+n+' / '+S[tab].length+' · 取消勾选的键将从渠道中移除'}
  loadTab('claude');
  const tb0=[...tabs.children][0];tb0.style.background='#3b82f6';tb0.style.color='#fff';
  ok.onclick=()=>{
    const before=provider.headers||{};
    const out={...before};
    let add=0,rem=0;
    for(const _t in PRESETS){if(_t===tab)continue;for(const _h of PRESETS[_t]){if(shared[_h.k]>1)continue;if(out[_h.k]!==undefined){delete out[_h.k];rem++}}}
    for(const h of S[tab]){
      if(h.checked){if(out[h.k]!==h.value)add++;out[h.k]=h.value}
      else if(out[h.k]!==undefined){delete out[h.k];rem++}
    }
    try{save({...provider,headers:out});close();if(window.__mhToast)window.__mhToast('已应用：新增/更新 '+add+' 个，移除 '+rem+' 个请求头')}
    catch(e){if(window.__mhToast)window.__mhToast('写入失败：'+e,!1)}
  };
}catch(e){console.error('[modelhub] headers error',e)}};
