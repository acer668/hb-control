let API='';let role=null,channels=[];const TOKEN_KEY='hb_control_session';let authToken=sessionStorage.getItem(TOKEN_KEY)||'';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const button=(label,handler,cls='')=>{let b=el('button',cls,label);b.onclick=handler;return b};
const note=t=>{$('notice').textContent=t||''};
async function req(path,method='GET',body){const headers={};if(authToken)headers['Authorization']='Bearer '+authToken;if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';const res=await fetch(API+path,{method,credentials:'omit',headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});let data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.detail||`HTTP ${res.status}`);return data}
async function run(fn){try{note('');await fn();await refresh()}catch(e){note(e.message)}}
function field(label,type='text',value=''){let l=el('label','',label),i=el('input');i.type=type;i.value=value;l.append(i);return [l,i]}
function createBot(b){const card=el('article','bot');card.dataset.botId=b.id;const top=el('div','top'),title=el('h3','',b.label),status=el('span','status'+(b.online?' on':''),b.online?b.state:'Offline');top.append(title,status);card.append(top,el('p','muted',`Bot ${b.id} • ${b.voice_connected?'Voice connected':'Not in voice'}`),el('p','detail',`Audio: ${b.source||'Not selected'}`),el('p','detail',`Channel: ${channels.find(c=>c.id===b.channel_id)?.name||b.channel_id||'Not selected'}`));
if(role){let controls=el('div','controls');let sel=el('select');sel.append(new Option('Select voice channel',''));for(let c of channels)sel.append(new Option(c.name,c.id));sel.value=b.channel_id||'';sel.onchange=()=>run(()=>req(`/api/bots/${encodeURIComponent(b.id)}/channel`,'PUT',{channel_id:sel.value}));controls.append(sel);let acts=el('div','actions');for(let [name,action,cls] of [['▶ Play','play','primary'],['Ⅱ Pause','pause',''],['■ Stop','stop','']])acts.append(button(name,()=>run(()=>req(`/api/bots/${encodeURIComponent(b.id)}/${action}`,'POST')),cls));controls.append(acts);
let [urlLabel,url]=field('YouTube link','url');url.placeholder='https://www.youtube.com/watch?v=...';controls.append(urlLabel,button('Set YouTube audio',()=>run(()=>req(`/api/bots/${encodeURIComponent(b.id)}/youtube`,'POST',{url:url.value}))));let [fileLabel,file]=field('Upload MP3 / MP4','file');file.accept='.mp3,.mp4';controls.append(fileLabel,button('Upload audio',()=>run(async()=>{if(!file.files.length)throw Error('Choose a file');let fd=new FormData();fd.append('file',file.files[0]);await req(`/api/bots/${encodeURIComponent(b.id)}/upload`,'POST',fd)})));card.append(controls)}
if(role==='owner'){let owner=el('div','owner'),[labLabel,lab]=field('Bot display name','text',b.label);owner.append(labLabel,button('Rename',()=>run(()=>req(`/api/bots/${encodeURIComponent(b.id)}/label`,'PUT',{label:lab.value}))));let [tokLabel,tok]=field('New bot token','password');tok.placeholder='Paste replacement token';owner.append(tokLabel,button('Rotate token',()=>{if(confirm(`Replace token for ${b.label}?`))run(()=>req(`/api/bots/${encodeURIComponent(b.id)}/token`,'PUT',{token:tok.value}))}));owner.append(button('Remove bot',()=>{if(confirm(`Remove ${b.label} from this manager? This does not delete the Discord application.`))run(()=>req(`/api/bots/${encodeURIComponent(b.id)}`,'DELETE'))},'danger'));card.append(owner)}return card}
async function refresh(){const data=await req('/api/bots');$('total').textContent=data.length;$('online').textContent=data.filter(b=>b.online).length;$('playing').textContent=data.filter(b=>b.state==='playing').length;$('bots').replaceChildren(...data.map(createBot));$('loginArea').replaceChildren(button(role?`${role} • Sign out`:'Sign in',role?()=>run(async()=>{await req('/api/logout','POST');role=null;authToken='';sessionStorage.removeItem(TOKEN_KEY);await load()}):()=> $('loginDialog').showModal()));$('add').hidden=role!=='owner'}
async function load(){let s=await req('/api/session');role=s.role;if(!role){authToken='';sessionStorage.removeItem(TOKEN_KEY)}channels=role?await req('/api/channels'):[];await refresh()}
$('loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const s=await req('/api/login','POST',{password:$('password').value});role=s.role;authToken=s.token;sessionStorage.setItem(TOKEN_KEY,authToken);$('password').value='';$('loginDialog').close();await load()})};$('add').onclick=()=>$('addDialog').showModal();$('addForm').onsubmit=e=>{e.preventDefault();run(async()=>{let f=new FormData(e.target);await req('/api/bots','POST',Object.fromEntries(f));$('addDialog').close();e.target.reset()})};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());initializeBackend().then(()=>load()).catch(e=>note('Backend unavailable: '+e.message));setInterval(async()=>{try{const data=await req('/api/bots');$('total').textContent=data.length;$('online').textContent=data.filter(b=>b.online).length;$('playing').textContent=data.filter(b=>b.state==='playing').length;for(const b of data){const card=[...document.querySelectorAll('#bots article.bot')].find(n=>n.dataset.botId===b.id);if(card){const badge=card.querySelector('.status');if(badge){badge.textContent=b.online?b.state:'Offline';badge.className='status'+(b.online?' on':'')}}}}catch(e){}},7000);



// URL selection: personal override > centrally published URL > config.js fallback.
const PERSONAL_URL_KEY='hb_control_backend_url';
const FALLBACK_API=(window.HB_API||'').replace(/\/$/,'');
let globalAPI='', globalLastChecked=0;
const backendStatus=$('backendStatus');
function cleanBackendURL(raw){
  let u;
  try{u=new URL(raw.trim())}catch{throw Error('Enter a complete HTTPS URL.')}
  if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)
    throw Error('Use an HTTPS URL without a path, username, query, or fragment.');
  return u.origin;
}
async function getGlobalURL(){
  try{
    const response=await fetch('./global-backend.json?ts='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('Global config unavailable');
    const data=await response.json();
    return data.url?cleanBackendURL(data.url):'';
  }catch(e){console.warn('Global backend config:',e);return ''}
}
function personalURL(){
  try{return localStorage.getItem(PERSONAL_URL_KEY)?cleanBackendURL(localStorage.getItem(PERSONAL_URL_KEY)):''}
  catch{return ''}
}
function clearAuth(){
  authToken='';sessionStorage.removeItem(TOKEN_KEY);role=null;channels=[];
}
function useBackend(url){
  if(url!==API){API=url;clearAuth();}
  $('backendCurrent').textContent=API||'Not configured';
}
async function initializeBackend(){
  globalAPI=await getGlobalURL();globalLastChecked=Date.now();
  useBackend(personalURL()||globalAPI||FALLBACK_API);
  if(!API)throw Error('No backend URL configured. Click Backend URL to set one.');
}
async function healthCheck(url){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const res=await fetch(url+'/api/health',{signal:controller.signal,cache:'no-store'});
    if(!res.ok)throw Error('Health check returned '+res.status);
    const data=await res.json();if(data.ok!==true)throw Error('Not an HB Control backend');
  }finally{clearTimeout(timer)}
}
function backendDialogOpen(){
  $('backendUrl').value=API;
  $('backendStatus').textContent='';
  $('backendMode').textContent=role==='owner'
    ?'Owner: save only to this browser, or publish the URL for everyone.'
    :'Guest/controller: changes only affect this browser. Sign in as owner to publish globally.';
  $('publishGlobal').hidden=role!=='owner';
  $('backendDialog').showModal();
}
async function setPersonalURL(url){
  await healthCheck(url);
  localStorage.setItem(PERSONAL_URL_KEY,url);
  useBackend(url);
  $('backendDialog').close();
  note('Personal backend URL saved for this browser. Sign in again if needed.');
  await load();
}
async function publishGlobalURL(url){
  if(role!=='owner'||!authToken)throw Error('Owner login required.');
  // Never send the owner password or GitHub token to the browser.
  await healthCheck(url);
  const res=await req('/api/settings/global-backend','PUT',{url});
  if(!res.ok)throw Error('Global publish failed');
  globalAPI=url;
  // Remove owner's local override so the published URL becomes their default.
  localStorage.removeItem(PERSONAL_URL_KEY);
  useBackend(url);
  $('backendDialog').close();
  note('Global URL published to GitHub. GitHub Pages may take a minute to deploy.');
  await load();
}
$('backendSettings').onclick=backendDialogOpen;
$('backendForm').onsubmit=async event=>{
  event.preventDefault();
  const submit=$('savePersonal');submit.disabled=true;
  try{await setPersonalURL(cleanBackendURL($('backendUrl').value))}
  catch(e){backendStatus.textContent='Unable to save: '+e.message}
  finally{submit.disabled=false}
};
$('publishGlobal').onclick=async()=>{
  const btn=$('publishGlobal');btn.disabled=true;
  try{
    const url=cleanBackendURL($('backendUrl').value);
    if(!confirm('Publish this backend URL for ALL visitors?\n'+url))return;
    await publishGlobalURL(url);
  }catch(e){backendStatus.textContent='Unable to publish: '+e.message}
  finally{btn.disabled=false}
};
$('backendReset').onclick=async()=>{
  localStorage.removeItem(PERSONAL_URL_KEY);
  globalAPI=await getGlobalURL();
  useBackend(globalAPI||FALLBACK_API);
  $('backendDialog').close();
  note('Personal override cleared. Using global/default URL.');
  if(API)await load().catch(e=>note('Backend unavailable: '+e.message));
};
// Open dashboards adopt new global URL without overriding a personal setting.
setInterval(async()=>{
  const next=await getGlobalURL();
  if(next===globalAPI)return;
  globalAPI=next;
  if(personalURL())return;
  const target=globalAPI||FALLBACK_API;
  if(target!==API){useBackend(target);note('Global backend URL changed. Please sign in again.');
    if(API)await load().catch(e=>note('Backend unavailable: '+e.message));}
},60000);
