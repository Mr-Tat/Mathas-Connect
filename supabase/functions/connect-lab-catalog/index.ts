import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

// Catalogue indépendant de la seule classe de démonstration.
// Le GET n'expose que les cartes visibles ; le POST exige un JWT professeur
// et une permission de gestion explicite. Rien ne touche aux quatre presets.
const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  'cache-control':'no-store',
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(message:string,status=400)=>respond({ok:false,error:message},status);
const validKey=(s:unknown):s is string=>typeof s==='string'&&/^[a-z0-9-]{1,80}$/.test(s);

async function catalogue(includeHidden:boolean){
 const [all,chosen]=await Promise.all([
   db.from('connect_apps').select('app_key,title,launch_url,image_url,hub_section,display_order,enabled')
     .neq('app_key','connect-lab').order('display_order').limit(100),
   db.from('connect_lab_hub_visibility').select('app_key,visible').limit(100),
 ]);
 if(all.error||chosen.error)throw Error('catalogue_unavailable');
 const visibility=new Map((chosen.data||[]).map((x:any)=>[x.app_key,x.visible===true]));
 return (all.data||[]).filter((app:any)=>includeHidden||(app.enabled===true&&visibility.get(app.app_key)===true))
   .map((app:any)=>({
     app_key:app.app_key,title:app.title,launch_url:app.launch_url,image_url:app.image_url,
     hub_section:app.hub_section,display_order:app.display_order,
     enabled:app.enabled===true,visible:visibility.get(app.app_key)===true,featured:false,
   }));
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 try{
   if(req.method==='GET'){
     const query=new URL(req.url).searchParams;
     if(query.get('class')!==TEST_CLASS)return fail('invalid_test_class',403);
     return respond({ok:true,apps:await catalogue(false)});
   }
   if(req.method!=='POST')return fail('method_not_allowed',405);
   const raw=await req.text();
   if(raw.length>2500)return fail('payload_too_large',413);
   let body:any;
   try{body=JSON.parse(raw)}catch{return fail('invalid_json')}
   if(body?.classId!==TEST_CLASS||!['list','set'].includes(body.action))return fail('invalid_test_class',403);
   const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
   if(!token)return fail('authentication_required',401);
   const {data:{user},error}=await auth.auth.getUser(token);
   if(error||!user||user.is_anonymous)return fail('professor_required',403);
   const p=await db.from('connect_class_permissions').select('class_id')
     .eq('class_id',TEST_CLASS).eq('teacher_id',user.id).eq('can_manage',true).maybeSingle();
   if(p.error||!p.data)return fail('class_permission_required',403);
   if(body.action==='list')return respond({ok:true,apps:await catalogue(true)});
   if(!validKey(body.appKey)||typeof body.visible!=='boolean')return fail('invalid_visibility');
   // On ne peut jamais activer une appli désactivée ni l'outil de diagnostic.
   const app=await db.from('connect_apps').select('enabled').eq('app_key',body.appKey).maybeSingle();
   if(app.error||!app.data||app.data.enabled!==true||body.appKey==='connect-lab')return fail('app_not_enabled',409);
   const saved=await db.from('connect_lab_hub_visibility').upsert(
     {app_key:body.appKey,visible:body.visible,updated_at:new Date().toISOString()},
     {onConflict:'app_key'});
   if(saved.error)throw Error('visibility_save_failed');
   return respond({ok:true,appKey:body.appKey,visible:body.visible});
 }catch(err){
   console.error('connect_lab_hub_catalog_error',err instanceof Error?err.message:'unknown');
   return fail('catalogue_unavailable',503);
 }
});
