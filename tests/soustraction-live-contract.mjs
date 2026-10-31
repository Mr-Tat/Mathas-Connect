// Public deployment checks only. Never evaluates downloaded JavaScript.
import assert from 'node:assert/strict';

export function assertTeacherLaunchSource(source){
 const start=source.indexOf('const href=app.launch_url||app.url;');
 const end=source.indexOf("const img=document.createElement('img');",start);
 assert.ok(start>=0&&end>start&&end-start<4000,'bloc des liens GLOBAL absent du portail publié');
 const block=source.slice(start,end);
 assert.match(block,/app\.app_key\s*===\s*['"]soustraction-ecrite-simple['"]/,'lien GLOBAL Soustraction absent');
 assert.match(block,/link\.onclick\s*=\s*event\s*=>/,'gestion du lien professeur absente');
 assert.match(block,/if\s*\(\s*!teacherPlayerActive\s*\)\s*\{\s*event\.preventDefault\(\)/,'le lien doit refuser le lancement sans Monsieur T');
 assert.match(block,/\$\(['"]class-selector['"]\)\?\.value/,'classe professeur sélectionnée absente');
 assert.match(block,/if\s*\(\s*!currentClass\s*\)\s*\{\s*event\.preventDefault\(\)/,'le lien doit refuser le lancement sans classe');
 assert.match(block,/target\.searchParams\.set\(['"]class['"],\s*currentClass\)/,'classe sélectionnée non transmise au jeu');
 assert.match(block,/target\.searchParams\.set\(['"]joueur['"],\s*['"]prof['"]\)/,'profil professeur non transmis au jeu');
 assert.match(block,/link\.href\s*=\s*target\.href/,'destination professeur non appliquée');
}

export function inspectSubtractionCatalogue(data,space,site){
 assert.equal(data?.ok,true,'catalogue '+space);
 assert.ok(Array.isArray(data.apps),'catalogue '+space);
 const entries=data.apps.filter(app=>app.app_key==='soustraction-ecrite-simple');
 assert.ok(entries.length<=1,'Soustraction dupliquée dans '+space);
 if(!entries.length)return {visible:false};
 const app=entries[0];
 assert.equal(app.enabled,true,'Soustraction désactivée annoncée dans '+space);
 assert.ok(typeof app.title==='string'&&app.title.trim(),'titre Soustraction absent dans '+space);
 assert.ok(typeof app.launch_url==='string'&&app.launch_url,'URL Soustraction absente dans '+space);
 const target=new URL(app.launch_url,site),base=new URL(site);
 assert.equal(target.origin,base.origin,'origine du jeu Soustraction incorrecte dans '+space);
 const expectedPath=new URL('apps/soustraction-simple/',site).pathname;
 assert.ok([expectedPath,expectedPath+'index.html'].includes(target.pathname),'destination Soustraction incorrecte dans '+space);
 return {visible:true};
}
