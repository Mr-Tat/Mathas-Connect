import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('apps/multiplication-simple/game-original.html');
const sql=read('supabase/migrations/20261109010000_school_multiplication_balanced_tables.sql');
const body=html.match(/  function takeBalancedMultiplier\(owner,available\)\{[\s\S]*?\n  \}/)?.[0];
assert.ok(body,'Missing balanced generator');
const take=Function(body+';return takeBalancedMultiplier;')();
test('2 et 5 : chaque bloc de quatre comporte exactement deux calculs de chaque',()=>{
 for(let run=0;run<120;run++){
  const holder={},values=Array.from({length:20},()=>take(holder,[2,5]));
  for(let i=0;i<values.length;i+=4)
   assert.deepEqual(values.slice(i,i+4).sort((a,b)=>a-b),[2,2,5,5]);
  assert.ok(values.every((n,i)=>i===0||n!==values[i-1]));
 }
});
test('chaque paquet utilise toutes les tables et accepte une table unique',()=>{
 const holder={},draws=Array.from({length:32},()=>take(holder,[2,3,4,5,6,7,8,9]));
 for(let i=0;i<32;i+=8)
  assert.deepEqual(draws.slice(i,i+8).sort((a,b)=>a-b),[2,3,4,5,6,7,8,9]);
 const one={};
 assert.deepEqual(Array.from({length:4},()=>take(one,[5])),[5,5,5,5]);
});
test('les séries classiques, guidées et HARD utilisent ce mélange',()=>{
 assert.match(html,/const mult=takeBalancedMultiplier\(session,session\.multipliers\)/);
 assert.match(html,/generateGuidedMultiplication\(session\.maxDigits,\[mult\]\)/);
 assert.match(html,/generateMultiplication\(session\.maxDigits,\[mult\]\)/);
 assert.match(html,/takeBalancedMultiplier\(hardSession,hardSession\.multiplierChoices\)/);
});
test('les deux procédures officielles mélangent avant de répéter, sans modifier les preuves',()=>{
 for(const name of ['connect_objective_record_school_mul_issue_classic_v1','connect_objective_record_school_mul_issue_extended_v1']){
  const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name);
  const end=sql.indexOf('REVOKE ALL ON FUNCTION public.'+name,start);
  assert.ok(start>=0&&end>start);
  const fn=sql.slice(start,end);
  assert.match(fn,/array_agg\(t\.n ORDER BY random\(\)\)/);
  assert.match(fn,/v_m:=v_deck\[v_deck_at\]/);
  assert.match(fn,/v_last_m:=v_m/);
  assert.doesNotMatch(fn,/v_m:=p_multipliers\[1\+floor\(random\(\)/);
  assert.match(fn,/SECURITY DEFINER/);
  assert.match(fn,/SET search_path TO ''/);
 }
});
