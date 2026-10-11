import test from 'node:test';
import assert from 'node:assert/strict';
import {matchScore,markStatementDuplicates,findStoredDuplicates} from '../duplicate-matching.js';
const row=(name,extra={})=>({name,date:'2026/01/10',amount:1234,source:'AMEX',person:'本人',month:'2026-01',file:'before.xlsx',...extra});
test('English/Japanese names, punctuation and next-day settlement match',()=>{
 for(const [a,b]of [['GRANDTREE MUSASHIKOSUGI','グランツリー武蔵小杉'],['DAISOJAPAN','ダイソー 広島県 東広島市'],['GEO','ゲオ 木月店 神奈川県 川崎市'],['BIC CAMERA COM','ビックカメラ ドットコム -東京都 豊'],['LILYCONNR AIR','Lily Connor/Air 神奈川'],['ITOYOKADO GROUP HQ','イトーヨーカドー 食品']])assert.ok(matchScore(row(a),row(b,{date:'2026/01/11'})),a);
 assert.ok(matchScore(row('SHOP SAMPLE'),row('ＳＨＯＰ・ＳＡＭＰＬＥ')));
});
test('does not merge unrelated amounts, people, dates, merchants or daily identical payments',()=>{
 const a=row('DAISOJAPAN');for(const e of [{amount:999},{person:'家族'},{source:'楽天'},{date:'2026/01/12'}])assert.equal(matchScore(a,row('ダイソー',e)),0);
 assert.equal(matchScore(row('SHOP ABC'),row('SHOP XYZ')),0);
 assert.equal(matchScore(row('Suica'),row('Suica',{date:'2026/01/11'})),0);
 assert.equal(matchScore(row('IDEMITSU APOLLO STATION'),row('ソフトバンクM')),0);
});
test('preserves repeated purchases and consumes each existing row once',()=>{
 const old=[row('DAISOJAPAN'),row('DAISOJAPAN')];const next=Array.from({length:3},()=>row('ダイソー',{date:'2026/01/11'}));
 assert.deepEqual(markStatementDuplicates([next],old).map(r=>r.duplicate),[true,true,false]);
 assert.deepEqual(markStatementDuplicates([old,next],[]).map(r=>r.duplicate),[false,false,true,true,false]);
});
test('exact matches take priority and deleted rows do not hide real transactions',()=>{
 const a=row('SHOP SAMPLE');assert.deepEqual(markStatementDuplicates([[a,a]],[{...a,deleted:true}]).map(r=>r.duplicate),[false,false]);
 const next=[row('SHOP SAMPLE EXTRA'),a];assert.deepEqual(markStatementDuplicates([next],[a]).map(r=>r.duplicate),[false,true]);
});
test('cleanup compares files and preserves same-file multiplicity',()=>{
 const entries=[row('DAISOJAPAN',{id:'a'}),row('DAISOJAPAN',{id:'b'}),row('ダイソー',{id:'c',file:'after.xlsx',date:'2026/01/11'}),row('ダイソー',{id:'d',file:'after.xlsx',date:'2026/01/11'})];
 const pairs=findStoredDuplicates(entries);assert.equal(pairs.length,2);assert.equal(new Set(pairs.map(p=>p.keep.id)).size,2);
 for(const p of pairs){p.remove.deleted=true;p.keep.duplicateVariants=[{name:p.remove.name,date:p.remove.date}];}
 assert.equal(findStoredDuplicates(entries).length,0);
 assert.deepEqual(markStatementDuplicates([[row('ダイソー',{date:'2026/01/11'}),row('ダイソー',{date:'2026/01/11'})]],entries).map(r=>r.duplicate),[true,true]);
});
test('new import batch distinguishes reused filenames, cleanup excludes manual and Rakuten',()=>{
 assert.equal(findStoredDuplicates([row('SHOP SAMPLE',{importBatch:'a'}),row('SHOP SAMPLE',{importBatch:'b'})]).length,1);
 assert.equal(findStoredDuplicates([row('SHOP SAMPLE'),row('SHOP SAMPLE')]).length,0);
 assert.equal(findStoredDuplicates([row('SHOP SAMPLE',{source:'手入力'}),row('SHOP SAMPLE',{file:'after.xlsx',source:'手入力'})]).length,0);
});
