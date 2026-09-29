export const initialAccounts=()=>[
  ['SBI証券','大輔'],['SBI証券','まゆちゃん'],['SBI証券','順子さん'],
  ['楽天銀行','大輔'],['楽天銀行','まゆちゃん'],['楽天証券','大輔'],['楽天証券','まゆちゃん'],
  ['ビットコイン',''],['ゆうちょ銀行','まゆちゃん']
].map(([institution,owner],i)=>({id:'account-'+i,institution,owner,archived:false}));
export const emptyState=()=>({version:1,revision:0,accounts:initialAccounts(),records:[]});
export function validDate(date){const d=new Date(date+'T00:00:00Z');return /^20\d{2}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;}
export function validate(s){
  if(s?.version!==1||!Array.isArray(s.accounts)||!Array.isArray(s.records)||s.accounts.length>100||s.records.length>2000)throw Error('データの形式または保存件数を確認してください');
  const ids=new Set();
  for(const a of s.accounts){if(!/^[\w-]{1,100}$/.test(a.id)||ids.has(a.id)||typeof a.institution!=='string'||!a.institution.trim()||a.institution.length>60||typeof a.owner!=='string'||a.owner.length>40||typeof a.archived!=='boolean')throw Error('口座名・名義を確認してください');ids.add(a.id);}
  const dates=new Set();
  for(const r of s.records){if(!validDate(r.date)||dates.has(r.date)||!r.balances||typeof r.balances!=='object'||Array.isArray(r.balances)||!Object.keys(r.balances).length)throw Error('記録日または残高が無効です');dates.add(r.date);for(const [id,n]of Object.entries(r.balances)){if(!ids.has(id)||!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('残高は0〜1兆円の整数で入力してください');}}
  if(new TextEncoder().encode(JSON.stringify(s)).length>700000)throw Error('保存容量の上限です。バックアップを書き出してください');
  return s;
}
export const total=r=>r?Object.values(r.balances).reduce((a,n)=>a+n,0):null;
export const ordered=s=>[...s.records].sort((a,b)=>a.date.localeCompare(b.date));
export function previousMonth(date){const d=new Date(date+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);}
export function comparison(s,date,mode='month'){
  const list=ordered(s),current=list.find(r=>r.date===date)||null;
  const previous=mode==='previous'?list.filter(r=>r.date<date).at(-1):list.filter(r=>r.date.startsWith(previousMonth(date))).at(-1);
  const rows=s.accounts.filter(a=>current&&Object.hasOwn(current.balances,a.id)||previous&&Object.hasOwn(previous.balances,a.id)).map(a=>{
    const value=current?.balances[a.id]??null,base=previous?.balances[a.id]??null,delta=value!==null&&base!==null?value-base:null;
    return {...a,value,base,delta,percent:delta!==null&&base>0?delta/base*100:null};
  });
  const comparable=rows.filter(r=>r.delta!==null);
  return {current,previous,rows,matched:comparable.length,delta:previous&&comparable.length?comparable.reduce((n,r)=>n+r.delta,0):null,complete:!!previous&&rows.every(r=>r.delta!==null)};
}
export function project(principal,rate,years){
  if(!Number.isFinite(principal)||principal<0||!Number.isFinite(rate)||rate<-100||rate>100||!Number.isInteger(years)||years<1||years>60)throw Error('年利は−100〜100%、期間は1〜60年で指定してください');
  return Array.from({length:years+1},(_,year)=>({year,value:principal*Math.pow(1+rate/100,year)}));
}
