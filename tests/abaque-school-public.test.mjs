import test from 'node:test';
import assert from 'node:assert/strict';

const BASE='https://mr-tat.github.io/Mathas-Connect';
const CATALOG='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-catalog';
const SPACES=['observation','phase1','phase2','phase2b','2eco'];
async function check(url,{expectJson=false}={}){
 const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'cache-control':'no-cache'}});
 assert.equal(response.status,200,`HTTP ${response.status} : ${url}`);
 return expectJson?response.json():response;
}

test('Abaque : les cinq catalogues publics de production renvoient la carte ouvrable',async()=>{
 for(const space of SPACES){
  const data=await check(CATALOG+'?space='+space,{expectJson:true});
  assert.equal(data.ok,true,space);
  assert.ok(Array.isArray(data.apps),space);
  const matches=data.apps.filter(x=>x.app_key==='abaque-longueurs');
  assert.equal(matches.length,1,space);
  const item=matches[0];
  assert.equal(item.hub_section,'outil',space);
  assert.equal(item.enabled,true,space);
  assert.equal(item.featured,false,space);
  assert.equal(new URL(item.launch_url).searchParams.get('connect'),'1',space);
 }
});
test('Abaque : les pages GitHub Pages publiques et la miniature sont accessibles',async()=>{
 const hub=await check(BASE+'/hub.html');
 assert.match((await hub.text()).slice(0,50000),/hub\.js/);
 const game=await check(BASE+'/apps/GRAN-abaque-m-1/?connect=1');
 assert.match((await game.text()).slice(0,200000),/Abaque/i);
 const image=await check(BASE+'/assets/miniatures/abaque-longueurs.webp');
 assert.match(image.headers.get('content-type')||'',/image\/webp/);
});
