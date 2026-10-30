import {webcrypto as crypto} from 'node:crypto';
const need=k=>{const v=process.env[k];if(!v)throw Error('Configuration manquante : '+k);return v};
const base=need('SUPABASE_PROJECT_URL').replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))throw Error('URL Supabase invalide');
const serviceKey=need('SUPABASE_SERVICE_ROLE_KEY');
const destination=need('BACKUP_PRIVATE_REPO');
if(!/^[\w.-]+\/[\w.-]+$/.test(destination)||destination==='Mr-Tat/Mathas-Connect')throw Error('Dépôt de sauvegarde invalide');
const githubToken=need('BACKUP_REPO_TOKEN');
const secret=Buffer.from(need('BACKUP_ENCRYPTION_KEY_BASE64'),'base64');
if(secret.length!==32)throw Error('Clé AES-256 incorrecte');
const tables=['connect_school_years','connect_teachers','connect_classes','connect_class_permissions','connect_students','connect_enrollments','connect_apps','connect_activities','connect_states','connect_hub_presets','connect_hub_preset_entries','connect_attempts','connect_devices','connect_join_requests','connect_pairings','connect_launches','connect_projections','connect_teacher_players','connect_xp_credits','connect_level_profiles','connect_xp_milestones','connect_xp_award_rules','connect_parcours_current','connect_parcours_history','connect_parcours_xp_bonus'];
const snapshot={format:'mathas-connect-emergency-snapshot-v1',createdAt:new Date().toISOString(),projectRef:new URL(base).hostname.split('.')[0],tables:{}};
async function readTable(table){
 const rows=[];
 for(let start=0;start<50000;start+=500){
  const authHeaders={apikey:serviceKey,Range:start+'-'+(start+499)};
  if(!serviceKey.startsWith('sb_secret_'))authHeaders.Authorization='Bearer '+serviceKey;
  const res=await fetch(base+'/rest/v1/'+table+'?select=*',{headers:authHeaders});
  if(!res.ok)throw Error('Lecture '+table+' : HTTP '+res.status+(res.status===401?' — clé Supabase refusée : vérifier le secret GitHub et le projet':'') );
  const part=await res.json();
  if(!Array.isArray(part))throw Error('Réponse inattendue : '+table);
  rows.push(...part);
  // Une extraction incomplète ne doit jamais être annoncée comme sauvegarde réussie.
  if(start+part.length>=50000)throw Error('Sauvegarde refusée : limite 50 000 lignes atteinte pour '+table);
  if(part.length<500)break;
 }
 return rows;
}
for(const table of tables)snapshot.tables[table]=await readTable(table);
// Mélange is additive: old installations keep their 25-table backup unchanged.
// Once its catalogue row exists, neither missing private tables nor failed reads
// may silently produce an incomplete emergency snapshot.
if(snapshot.tables.connect_apps.some(row=>row.app_key==='melange-calculs-ecrits')){
 for(const table of ['connect_mixed_receipts','connect_mixed_multiplier_locks']){
  snapshot.tables[table]=await readTable(table);
  tables.push(table);
 }
}
const iv=crypto.getRandomValues(new Uint8Array(12));
const key=await crypto.subtle.importKey('raw',secret,{name:'AES-GCM'},false,['encrypt']);
const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(snapshot))));
const wrapped=JSON.stringify({format:'mathas-connect-aes-256-gcm-v1',createdAt:snapshot.createdAt,iv:Buffer.from(iv).toString('base64'),ciphertext:Buffer.from(encrypted).toString('base64')});
const filename='mathas-connect/weekly/'+snapshot.createdAt.slice(0,10)+'.json.enc';
const endpoint='https://api.github.com/repos/'+destination;
const repository=await fetch(endpoint,{headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json'}});
if(!repository.ok)throw Error('Accès au dépôt : HTTP '+repository.status);
const metadata=await repository.json();
if(metadata.private!==true)throw Error('STOP : destination non privée');
const result=await fetch(endpoint+'/contents/'+filename,{method:'PUT',headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({message:'Encrypted weekly Mathas backup',content:Buffer.from(wrapped).toString('base64')})});
if(!result.ok)throw Error('Stockage privé impossible : HTTP '+result.status);
console.log('Sauvegarde chiffrée déposée : '+snapshot.createdAt.slice(0,10)+' ; '+tables.length+' tables');
