import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,join,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
function pages(folder){
 const result=[];
 for(const entry of readdirSync(folder,{withFileTypes:true})){
  if(entry.name==='.git'||entry.name==='node_modules')continue;
  const path=join(folder,entry.name);
  if(entry.isDirectory())result.push(...pages(path));
  else if(entry.isFile()&&entry.name.endsWith('.html'))result.push(path);
 }
 return result;
}
function attribute(tag,name){
 const attrs=Array.from(tag.matchAll(/\b([a-z][\w-]*)\s*=\s*(["'])(.*?)\2/gi));
 return attrs.find(match=>match[1].toLowerCase()===name)?.[3]||null;
}
test('Chaque page HTML Connect et chaque sous-jeu ont un favicon local valide',()=>{
 const html=pages(root);
 assert.ok(html.length>=42,'Le contrôle doit inclure les jeux et maquettes, pas seulement les pages racines');
 for(const file of html){
  const source=readFileSync(file,'utf8');
  const links=Array.from(source.matchAll(/<link\b[^>]*>/gi),match=>match[0]);
  const icons=links.filter(tag=>/^(?:shortcut\s+)?icon$/i.test(attribute(tag,'rel')||''));
  const name=relative(root,file);
  assert.ok(icons.length>0,name+' : favicon manquant');
  const href=attribute(icons[0],'href');
  assert.ok(href,name+' : favicon sans chemin');
  assert.ok(!/^(?:https?:)?\/\//i.test(href),name+' : utiliser une ressource locale stable');
  const resolved=resolve(dirname(file),decodeURIComponent(href.split(/[?#]/)[0]));
  assert.ok(resolved.startsWith(root+sep),name+' : chemin favicon hors du dépôt');
  assert.ok(existsSync(resolved)&&statSync(resolved).isFile(),name+' : fichier favicon introuvable : '+href);
 }
});
