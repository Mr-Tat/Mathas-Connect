import test from 'node:test';
import assert from 'node:assert/strict';

const site='https://mr-tat.github.io/Mathas-Connect/';
const get=async path=>{
 const url=site+path+(path.includes('?')?'&':'?')+'audit='+Date.now();
 const response=await fetch(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(22000)});
 assert.equal(response.status,200,url+' HTTP '+response.status);
 return response.text();
};
test('SITE EN LIGNE : les animations sont servies par GitHub Pages',async()=>{
 const [html,live,model,animation,css]=await Promise.all([
  get('projection-v2.html'),
  get('projection-v2-live.js?v=20261104-depassements-v5'),
  get('projection-v2-overtakes.mjs'),
  get('projection-v2-overtake-animation.mjs'),
  get('projection-v2-overtake.css?v=20261104-v1')
 ]);
 assert.match(html,/projection-v2-live\.js\?v=20261104-depassements-v5/);
 assert.match(html,/projection-v2-overtake\.css\?v=20261104-v1/);
 assert.match(live,/createOvertakeTracker/);
 assert.match(live,/tracker\.pending\(currentApp\)/);
 assert.match(live,/movement\.gained<3/);
 assert.match(live,/REFRESH_INTERVAL_MS=20000/);
 assert.match(model,/export function detectOvertakes/);
 assert.match(model,/queued\.set\(key,queue\)/);
 assert.match(animation,/const DURATION=550/);
 assert.match(animation,/sprinkleArrival/);
 assert.match(css,/mathas-arrival-spark/);
 console.log('LIVE_OVERTAKES_OK : HTML, JS, modèle, animations, CSS et 20 s servis');
});
