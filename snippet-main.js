import{ipcMain as MdlH}from"electron";
MdlH.handle("modelhub:fetch-models",async(e,p)=>{try{
const b=String(p.baseUrl||'').trim().replace(/\/+$/,'');
if(!b)return{ok:false,error:'baseUrl is empty'};
const hs=Object.assign({'Content-Type':'application/json'},p.headers&&typeof p.headers==='object'?p.headers:{});
const kind=String(p.dialect||'openai-compatible');
if(p.apiKey){hs.Authorization='Bearer '+p.apiKey;if(kind==='anthropic')hs['x-api-key']=p.apiKey;if(kind==='gemini'){hs['x-goog-api-key']=p.apiKey;delete hs.Authorization}}
let urls;
if(kind==='anthropic')urls=[b+'/v1/models',b+'/models'];
else if(kind==='gemini')urls=[b+'/v1beta/models',b+'/models'];
else{urls=[b+'/models'];if(!/\/v\d+[a-z]*$/i.test(b))urls.push(b+'/v1/models')}

let lastErr=null;
for(const u of urls){
let r;try{r=await fetch(u,{headers:hs})}catch(er){lastErr=String(er.cause&&er.cause.code||er.message||er);continue}
if(r.status===404){lastErr='404 at '+u;continue}
const tx=await r.text();
if(!r.ok){lastErr='HTTP '+r.status+': '+tx.slice(0,300);continue}
let j;try{j=JSON.parse(tx)}catch{lastErr='response is not JSON (HTML page?) at '+u;continue}
const raw=Array.isArray(j)?j:(j.data||j.models||[]);
const ids=raw.map(m=>typeof m==='string'?m:(m.id||m.name)).filter(Boolean);
const vis=/(vision|vl-|gpt-4o|gpt-4\.1|gpt-5|claude|gemini|qwen.*vl|glm-4v|glm-5|internvl|llava|pixtral|o4-|omni|doubao.*vision|step-1v|deepseek-vision)/i;
return{ok:true,models:[...new Set(ids)].sort().map(id=>({id,visionGuess:vis.test(id)}))};
}
return{ok:false,error:lastErr||'404: no /models endpoint found'};
}catch(er){return{ok:false,error:String(er&&er.message||er)}}});

import{ipcMain as MdlP}from"electron";
const MdlPng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
MdlP.handle("modelhub:probe-vision",async(e,p)=>{try{
const b=String(p.baseUrl||'').trim().replace(/\/+$/,'');
const hs=Object.assign({'Content-Type':'application/json'},p.headers&&typeof p.headers==='object'?p.headers:{});
const kind=String(p.dialect||'openai-compatible');
if(p.apiKey){hs.Authorization='Bearer '+p.apiKey;if(kind==='anthropic')hs['x-api-key']=p.apiKey;if(kind==='gemini'){hs['x-goog-api-key']=p.apiKey;delete hs.Authorization}}
if(kind==='gemini')return{ok:true,vision:false,detail:'gemini probe unsupported'};
const body=kind==='anthropic'
?JSON.stringify({model:p.model,max_tokens:16,messages:[{role:'user',content:[{type:'text',text:'What color is this image? One word.'},{type:'image',source:{type:'base64',media_type:'image/png',data:MdlPng}}]}]})
:JSON.stringify({model:p.model,max_tokens:16,messages:[{role:'user',content:[{type:'text',text:'What color is this image? One word.'},{type:'image_url',image_url:{url:'data:image/png;base64,'+MdlPng}}]}]});
let urls;
if(kind==='anthropic')urls=[b+'/v1/messages',b+'/messages'];
else{urls=[b+'/chat/completions'];if(!/\/v\d+[a-z]*$/i.test(b))urls.push(b+'/v1/chat/completions')}

for(const u of urls){
let r;try{r=await fetch(u,{method:'POST',headers:hs,body})}catch(er){return{ok:false,error:String(er.cause&&er.cause.code||er.message||er)}}
if(r.status===404)continue;
const tx=await r.text();
if(r.ok)return{ok:true,vision:true,detail:tx.slice(0,120)};
if(r.status===400||r.status===422){const lo=tx.toLowerCase();
if(/image|visual|multimodal|multi-modal|content.*type|unsupported/.test(lo)&&!/rate|quota|billing|token limit|context length|maximum/.test(lo))return{ok:true,vision:false,detail:'rejected image input'};}
return{ok:false,status:r.status,error:'HTTP '+r.status+': '+tx.slice(0,200)};
}
return{ok:false,error:'404'};
}catch(er){return{ok:false,error:String(er&&er.message||er)}}});
