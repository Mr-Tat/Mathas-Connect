// Generates ephemeral LOCAL credentials; never accepts hosted database credentials.
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const [root,lab,api]=process.argv.slice(2);
if(!path.isAbsolute(root)||!path.isAbsolute(lab)||!/^http:\/\/127\.0\.0\.1:\d+$/.test(api))throw Error('local_paths_required');
const secret=randomBytes(32).toString('hex');
const sign=role=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({role,iss:'supabase-local',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',secret).update(h+'.'+p).digest('base64url')};
const anon=sign('anon'),service=sign('service_role'),pilotClass=randomUUID();
const env=(name,value)=>writeFileSync(path.join(lab,name),value,{mode:0o600});
env('local.env',`API_URL=${api}\nANON_KEY=${anon}\nSERVICE_ROLE_KEY=${service}\nMATHAS_MIXED_PILOT_CLASS_ID=${pilotClass}\n`);
env('postgres.env',`POSTGRES_PASSWORD=${secret}\n`);
env('auth.env',`NO_PROXY=mathas-mixed-db,localhost,127.0.0.1\nno_proxy=mathas-mixed-db,localhost,127.0.0.1\nGOTRUE_API_HOST=0.0.0.0\nGOTRUE_API_PORT=9999\nAPI_EXTERNAL_URL=${api}\nGOTRUE_SITE_URL=http://127.0.0.1:8765\nGOTRUE_DB_DRIVER=postgres\nGOTRUE_DB_DATABASE_URL=postgres://postgres:${secret}@mathas-mixed-db:5432/postgres?search_path=auth\nGOTRUE_JWT_SECRET=${secret}\nGOTRUE_JWT_AUD=authenticated\nGOTRUE_JWT_ADMIN_ROLES=service_role\nGOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true\nGOTRUE_DISABLE_SIGNUP=false\nGOTRUE_MAILER_AUTOCONFIRM=true\n`);
env('rest.env',`NO_PROXY=mathas-mixed-db,localhost,127.0.0.1\nPGRST_DB_URI=postgres://postgres:${secret}@mathas-mixed-db:5432/postgres\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\n`);
for(const name of ['results','api']){
 const dir=path.join(lab,name);mkdirSync(dir,{recursive:true});
 const original=readFileSync(path.join(root,'supabase/functions/connect-'+name+'/index.ts'),'utf8');
 if(name==='results'&&!original.includes('const MIXED_SERVER_READY=false;'))throw Error('expected_closed_source');
 writeFileSync(path.join(dir,'index.ts'),original.replace("from 'npm:@supabase/supabase-js@2.95.0'","from './sdk.mjs'").replace('const MIXED_SERVER_READY=false;','const MIXED_SERVER_READY=true;'));
 env(name+'/edge.env',`SUPABASE_URL=http://mathas-mixed-kong:8000\nSUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nCONNECT_MIXED_ACCESS=pilot:${pilotClass}\nNO_PROXY=mathas-mixed-kong,localhost,127.0.0.1\n`);
}
