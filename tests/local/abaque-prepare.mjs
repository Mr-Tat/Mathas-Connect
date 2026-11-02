// Ephemeral LOCAL credentials generated only for isolated Docker fixtures.
import {randomBytes,createHmac} from 'node:crypto';
import {writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
const [root,lab,tools,databasePort,apiPort,staticPort]=process.argv.slice(2);
if(!/^\/tmp\/mathas-abaque-local\.[a-zA-Z0-9]+$/.test(lab)||![databasePort,apiPort,staticPort].every(p=>/^\d+$/.test(p)&&Number(p)>1024&&Number(p)<65536))throw Error('disposable_local_paths_required');
const require=createRequire(join(tools,'loader.cjs'));
const {build}=require('esbuild');
const secret=randomBytes(32).toString('hex');
const sign=role=>{
 const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({role,iss:'supabase-local',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');
 return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');
};
const anon=sign('anon'),service=sign('service_role'),api='http://127.0.0.1:'+apiPort;
const save=(file,value,mode=0o600)=>writeFileSync(join(lab,file),value,{mode});
chmodSync(lab,0o755);mkdirSync(join(lab,'edge'));
save('local.json',JSON.stringify({localOnly:true,host:'127.0.0.1',port:Number(databasePort),database:'abaque_test',user:'postgres',password:secret,api,static:'http://127.0.0.1:'+staticPort,anon,service,lab}));
save('postgres.env',`POSTGRES_PASSWORD=${secret}\nPOSTGRES_DB=abaque_test\n`);
save('auth.env',`NO_PROXY=abaque-db,localhost,127.0.0.1\nno_proxy=abaque-db,localhost,127.0.0.1\nGOTRUE_API_HOST=0.0.0.0\nGOTRUE_API_PORT=9999\nAPI_EXTERNAL_URL=${api}\nGOTRUE_SITE_URL=http://127.0.0.1:${staticPort}\nGOTRUE_DB_DRIVER=postgres\nGOTRUE_DB_DATABASE_URL=postgres://postgres:${secret}@abaque-db:5432/abaque_test?search_path=auth\nGOTRUE_JWT_SECRET=${secret}\nGOTRUE_JWT_AUD=authenticated\nGOTRUE_JWT_ADMIN_ROLES=service_role\nGOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true\nGOTRUE_DISABLE_SIGNUP=false\nGOTRUE_MAILER_AUTOCONFIRM=true\n`);
save('rest.env',`NO_PROXY=abaque-db,localhost,127.0.0.1\nno_proxy=abaque-db,localhost,127.0.0.1\nPGRST_DB_URI=postgres://postgres:${secret}@abaque-db:5432/abaque_test\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\n`);
save('edge.env',`SUPABASE_URL=http://abaque-gateway:8000\nSUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nCONNECT_ABAQUE_ACCESS=pilot\nNO_PROXY=abaque-gateway,localhost,127.0.0.1\nno_proxy=abaque-gateway,localhost,127.0.0.1\n`);
save('kong.yml',`_format_version: '2.1'\nservices:\n  - name: auth\n    url: http://abaque-auth:9999\n    routes:\n      - name: auth\n        strip_path: true\n        paths: [/auth/v1/]\n  - name: rest\n    url: http://abaque-rest:3000\n    routes:\n      - name: rest\n        strip_path: true\n        paths: [/rest/v1/]\n  - name: abaque\n    url: http://abaque-edge:9000\n    routes:\n      - name: abaque\n        strip_path: true\n        paths: [/functions/v1/connect-abaque]\nplugins:\n  - name: cors\n    config:\n      origins: ['*']\n      methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]\n      headers: [Authorization, apikey, Content-Type, X-Client-Info, X-Supabase-Api-Version]\n`,0o644);
chmodSync(join(lab,'kong.yml'),0o644);
const aliases={name:'local-supabase-sdk',setup(plugin){plugin.onResolve({filter:/^npm:@supabase\/supabase-js@2\.95\.0$/},()=>({path:require.resolve('@supabase/supabase-js')}));}};
await build({entryPoints:[resolve(root,'supabase/functions/connect-abaque/index.ts')],outfile:join(lab,'edge/index.ts'),bundle:true,platform:'browser',format:'esm',target:'es2022',plugins:[aliases],define:{'process.env.NODE_ENV':'"production"'}});
chmodSync(join(lab,'edge/index.ts'),0o644);chmodSync(join(lab,'edge'),0o755);
await build({stdin:{contents:`export {createClient} from '@supabase/supabase-js';`,resolveDir:tools},outfile:join(lab,'sdk.mjs'),bundle:true,platform:'browser',format:'esm',target:'es2022'});

await build({stdin:{contents:`import {createClient as realCreateClient} from '@supabase/supabase-js';export const createClient=(_url,_key,options)=>realCreateClient(${JSON.stringify(api)},${JSON.stringify(anon)},options);`,resolveDir:tools},outfile:join(lab,'browser-sdk.mjs'),bundle:true,platform:'browser',format:'esm',target:'es2022'});
chmodSync(join(lab,'browser-sdk.mjs'),0o600);
