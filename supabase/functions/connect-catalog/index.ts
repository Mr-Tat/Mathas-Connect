import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async request=>{
 const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','cache-control':'public, max-age=60'};
 if(request.method==='OPTIONS')return new Response('',{headers});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 const {data,error}=await db.from('connect_apps').select('app_key,title,launch_url,image_url,enabled,featured,hub_section,display_order').eq('enabled',true).order('display_order').limit(100);
 if(error)return new Response(JSON.stringify({ok:false}),{status:503,headers});
 return new Response(JSON.stringify({ok:true,apps:data}),{headers});
});
