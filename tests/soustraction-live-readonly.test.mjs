import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertTeacherLaunchSource,inspectSubtractionCatalogue} from './soustraction-live-contract.mjs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const site='https://mr-tat.github.io/Mathas-Connect/';
const entry={app_key:'soustraction-ecrite-simple',title:'Soustraction écrite',enabled:true,launch_url:site+'apps/soustraction-simple/'};

test('production smoke accepts the actual dynamic teacher link without requiring a fixed caption',()=>{
 assertTeacherLaunchSource(source);
 assertTeacherLaunchSource(source.replace(/link\.title=.*\n/,''));
});
test('production smoke rejects a missing teacher guard or missing class binding',()=>{
 for(const mutation of [
  source.replaceAll('if(!teacherPlayerActive){event.preventDefault();','if(false){event.preventDefault();'),
  source.replaceAll('if(!currentClass){event.preventDefault();','if(false){event.preventDefault();'),
  source.replaceAll("target.searchParams.set('class',currentClass)","target.searchParams.set('class','foreign')"),
  source.replaceAll("target.searchParams.set('joueur','prof')","target.searchParams.set('joueur','eleve')"),
 ])assert.throws(()=>assertTeacherLaunchSource(mutation));
});
test('a visible published Subtraction entry is valid',()=>{
 assert.deepEqual(inspectSubtractionCatalogue({ok:true,apps:[entry]},'phase1',site),{visible:true});
 assert.deepEqual(inspectSubtractionCatalogue({ok:true,apps:[{...entry,launch_url:entry.launch_url+'index.html'}]},'phase1',site),{visible:true});
});
test('teacher-hidden Subtraction is a valid catalogue configuration',()=>{
 assert.deepEqual(inspectSubtractionCatalogue({ok:true,apps:[]},'phase1',site),{visible:false});
});
test('malformed, duplicate, disabled and redirected public entries are rejected',()=>{
 for(const value of [
  {ok:false,apps:[]},{ok:true,apps:null},{ok:true,apps:[entry,entry]},
  {ok:true,apps:[{...entry,enabled:false}]},
  {ok:true,apps:[{...entry,launch_url:'https://example.invalid/game/'}]},
  {ok:true,apps:[{...entry,launch_url:site+'apps/addition-plusieurs/'}]},
 ])assert.throws(()=>inspectSubtractionCatalogue(value,'phase1',site));
});
