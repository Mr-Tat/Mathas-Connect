import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async request=>{
 const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','cache-control':'public, max-age=60'};
 if(request.method==='OPTIONS')return new Response('',{headers});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 const slug=new URL(request.url).searchParams.get('space')||'observation';
 if(!['observation','phase1','phase2','2eco'].includes(slug))return new Response(JSON.stringify({ok:false}),{status:400,headers});
 const {data,error}=await db.from('connect_hub_preset_entries').select('app_key,section,display_order,visible,featured,connect_apps!inner(title,launch_url,image_url,enabled)').eq('preset_slug',slug).eq('visible',true).order('display_order').limit(100);
 if(error)return new Response(JSON.stringify({ok:false}),{status:503,headers});
 const apps=(data||[]).filter(row=>row.connect_apps?.enabled).map(row=>({app_key:row.app_key,title:row.connect_apps.title,launch_url:row.connect_apps.launch_url,image_url:row.connect_apps.image_url,enabled:true,featured:row.featured,hub_section:row.section,display_order:row.display_order}));
 return new Response(JSON.stringify({ok:true,apps}),{headers});
});
