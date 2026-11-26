import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createMilieuHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
Deno.serve(createMilieuHandler({auth,db,access:Deno.env.get('CONNECT_MILIEU_ACCESS')==='pilot'?'pilot':'closed',pilotClassId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'}));
