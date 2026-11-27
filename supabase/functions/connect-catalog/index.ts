import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async request=>{
 const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','cache-control':'public, max-age=60'};
 if(request.method==='OPTIONS')return new Response('',{headers});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 const params=new URL(request.url).searchParams;
 const classId=params.get('class');
 const legacy:Record<string,string>={'8fe170fa-9e8f-4e80-885a-b0ba68026f64':'observation','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e':'phase1','1b021ed9-4846-4203-9c7b-4b5fa8d7adab':'phase2','0d8ba828-59cc-468b-a4b8-7b2a1af10b88':'phase2b','a9195199-0a28-4e86-99ce-47b36dd6e646':'2eco'};
 let slug=params.get('space')||'observation';
 if(classId!==null){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)||classId==='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9')return new Response(JSON.stringify({ok:false}),{status:400,headers});
  const {data:cls,error:classError}=await db.from('connect_classes').select('id').eq('id',classId).maybeSingle();
  if(classError)return new Response(JSON.stringify({ok:false}),{status:503,headers});
  if(!cls)return new Response(JSON.stringify({ok:false}),{status:404,headers});
  slug=legacy[cls.id]||'class-'+cls.id.replace(/-/g,'');
 }else if(!Object.values(legacy).includes(slug))return new Response(JSON.stringify({ok:false}),{status:400,headers});
 const {data,error}=await db.from('connect_hub_preset_entries').select('app_key,section,display_order,visible,featured,connect_apps!inner(title,launch_url,image_url,enabled)').eq('preset_slug',slug).eq('visible',true).order('display_order').limit(100);
 if(error)return new Response(JSON.stringify({ok:false}),{status:503,headers});
 const apps=(data||[]).filter(row=>row.connect_apps?.enabled).map(row=>({app_key:row.app_key,title:row.connect_apps.title,launch_url:row.connect_apps.launch_url,image_url:row.connect_apps.image_url,enabled:true,featured:row.featured,hub_section:row.section,display_order:row.display_order}));
 return new Response(JSON.stringify({ok:true,apps}),{headers});
});
