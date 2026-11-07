import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createAbaqueHandler} from './handler.mjs';
import {resolveAbaqueAccess} from './access-policy.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createAbaqueHandler({auth,db,access:resolveAbaqueAccess(Deno.env.get('CONNECT_ABAQUE_ACCESS'),url)}));
