import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createMilieuHandler} from '../../supabase/functions/connect-milieu/handler.mjs';
import {PILOT_CLASS} from '../../supabase/functions/connect-milieu/access-policy.mjs';
const url=Deno.env.get('SUPABASE_URL');
if(url!=='http://abaque-gateway:8000'||Deno.env.get('MILIEU_LOCAL_AUTH_TEST')!=='1')throw Error('disposable_local_auth_required');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
Deno.serve(createMilieuHandler({auth,db,access:'pilot',pilotClassId:PILOT_CLASS}));
