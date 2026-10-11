// Matching is one-to-one within each imported statement, preserving repeated purchases.
const compact=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)).replace(/[\s\p{P}\p{S}ー]/gu,'');
const aliases=[
  ['grandtreemusashikosugi','グランツリー武蔵小杉'],
  ['daisojapan','ダイソー'],
  ['bic cameracom','ビックカメラドットコム'],
  ['geo','ゲオ'],
  ['itoyokadogrouphq','イトーヨーカドー食品'],
  ['sundrug','サンドラッグ'],
  ['aeongrouphq','イオンフードスタイル'],
].map(a=>a.map(compact));
function merchant(name){return compact(String(name).normalize('NFKC').replace(/[\s-]+(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県|神奈川|東京|埼玉|千葉)(?:\s.*)?$/u,''));}
function aliasId(name){const n=merchant(name);return aliases.findIndex(a=>a.some(v=>n===v||(v==='ゲオ'&&/^ゲオ.+店$/.test(n))));}
function nameScore(a,b){const x=merchant(a),y=merchant(b);if(!x||!y)return 0;if(x===y)return 0.99;const ai=aliasId(a);if(ai>=0&&ai===aliasId(b))return 0.98;
 const short=x.length<y.length?x:y,long=x.length<y.length?y:x;
 if(short.length>=6&&long.includes(short)&&short.length/long.length>=0.65)return 0.95;
 if(short.length<8)return 0;
 let prev=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const next=[i];for(let j=1;j<=y.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));prev=next;}
 const score=1-prev[y.length]/Math.max(x.length,y.length);return score>=0.88?score:0;
}
const exactName=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function exact(r){let n=exactName(r.name);if(r.source==='楽天'&&n.includes('etc'))n='etc';if(r.source==='楽天'&&n.includes('投信積立'))n='楽天証券投信積立';return JSON.stringify([r.source,r.date,n,r.amount,r.person]);}
export function matchScore(a,b){
 if(a.source!==b.source||a.person!==b.person||a.amount!==b.amount)return 0;
 if(exact(a)===exact(b))return 3;
 if(a.source!=='AMEX')return 0;
 const days=Math.abs(Date.parse(a.date.replaceAll('/','-'))-Date.parse(b.date.replaceAll('/','-')))/86400000;
 if(days>1||!Number.isFinite(days))return 0;
 // Identical descriptions on adjacent days may be two daily purchases.
 if(days&&exactName(a.name)===exactName(b.name))return 0;
 const score=nameScore(a.name,b.name);return score?score+(days===0?1:0):0;
}
function scoreWithVariants(a,b){return Math.max(matchScore(a,b),...(b.duplicateVariants||[]).map(v=>matchScore(a,{...b,...v})));}
export function matchStatement(rows,pool){
 const matches=new Map(),used=new Set(),edges=[];
 rows.forEach((r,i)=>pool.forEach((p,j)=>{const score=scoreWithVariants(r,p);if(score)edges.push({i,j,score});}));
 // Reserve exact matches first; stable ordering makes duplicate counts predictable.
 edges.sort((a,b)=>b.score-a.score||a.i-b.i||a.j-b.j);
 for(const {i,j}of edges)if(!matches.has(i)&&!used.has(j)){matches.set(i,j);used.add(j);}
 return matches;
}
export function markStatementDuplicates(groups,entries){
 const pool=entries.filter(r=>!r.deleted).map(r=>({...r})),result=[];
 for(const group of groups){const matches=matchStatement(group,pool);const fresh=[];
 group.forEach((r,i)=>{const duplicate=matches.has(i);result.push({...r,duplicate});if(!duplicate)fresh.push(r);});pool.push(...fresh);}
 return result;
}
export function findStoredDuplicates(entries){
 const groups=new Map();
 for(const r of entries){if(r.deleted||r.source!=='AMEX'||(!r.file&&!r.importBatch))continue;const batch=r.importBatch||JSON.stringify([r.month,r.file]);if(!groups.has(batch))groups.set(batch,[]);groups.get(batch).push(r);}
 const kept=[],pairs=[];
 for(const rows of groups.values()){const matches=matchStatement(rows,kept);const fresh=[];rows.forEach((r,i)=>{if(matches.has(i))pairs.push({keep:kept[matches.get(i)],remove:r});else fresh.push(r);});kept.push(...fresh);}
 return pairs;
}
