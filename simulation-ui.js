import {emptyState,validate,simulate,annualAmount,sampleState} from './simulation-model.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(n).toLocaleString('ja-JP'),unit={monthly:'月',annual:'年',once:'単発'};
let state=emptyState(),selected=state.plans[0].id,latest=null,ready=false,dirty=false,busy=false,demo=false,cloud,editing=null,userId=null,settingsDirty=false,assetsDirty=false;
const hasDraft=()=>settingsDirty||assetsDirty;
const current=()=>state.plans.find(p=>p.id===selected)||state.plans[0];
function status(s,error=false){$('status').textContent=s;$('status').className=error?'error':'';}
function controls(){$('workspace').disabled=!ready||busy;$('save').disabled=!ready||busy||demo||!dirty;$('logout').disabled=busy;}
function changed(){dirty=true;controls();status(demo?'サンプルを変更しました（保存されません）':'未保存の変更があります。「変更を保存」で記録できます。');}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function validNext(next){validate(next);next.plans.forEach(p=>simulate(p));return next;}
function updatePlan(fn){const next=structuredClone(state);fn(next.plans.find(p=>p.id===current().id));validNext(next);state=next;changed();render();}
function chart(rows,p,other){
  const series=[{name:'総資産',color:'#244fe0',values:[{year:p.startYear-1,total:p.cash+p.investments},...rows]}, {name:'現金',color:'#20816a',values:[{year:p.startYear-1,total:p.cash},...rows.map(r=>({year:r.year,total:r.cash}))]}];
  if(other)series.push({name:other.name+'（総資産）',color:'#b55b16',values:[{year:other.startYear-1,total:other.cash+other.investments},...simulate(other)]});
  const points=series.flatMap(s=>s.values),minYear=Math.min(...points.map(r=>r.year)),maxYear=Math.max(...points.map(r=>r.year)),max=Math.max(1,...points.map(r=>r.total))*1.08;
  const x=y=>90+(y-minYear)/(maxYear-minYear||1)*800,y=v=>270-v/max*235;
  const focus=rows.find(r=>r.year===Number($('focusYear').value));
  $('chart').innerHTML=`<svg viewBox="0 0 920 320" role="img" aria-label="年末の資産推移。正確な金額は年ごとの結果で確認できます。">${[0,.25,.5,.75,1].map(f=>`<line x1="90" x2="890" y1="${y(max*f)}" y2="${y(max*f)}" stroke="#e3e8f0"/><text x="80" y="${y(max*f)+5}" text-anchor="end" fill="#69768a" font-size="14">${(max*f/10000).toLocaleString('ja-JP',{maximumFractionDigits:0})}万</text>`).join('')}${series.map(s=>`<polyline fill="none" stroke="${s.color}" stroke-width="3" points="${s.values.map(r=>`${x(r.year)},${y(r.total)}`).join(' ')}"/>`).join('')}${focus?`<line x1="${x(focus.year)}" x2="${x(focus.year)}" y1="25" y2="270" stroke="#244fe0" stroke-dasharray="5 5"/><circle cx="${x(focus.year)}" cy="${y(focus.total)}" r="6" fill="#244fe0" stroke="white" stroke-width="2"><title>${focus.year}年末 ${yen(focus.total)}</title></circle>`:''}${Array.from({length:6},(_,i)=>{const yr=Math.round(minYear+(maxYear-minYear)*i/5);return `<text x="${x(yr)}" y="302" text-anchor="middle" fill="#69768a" font-size="14">${yr}</text>`}).join('')}</svg><div class="legend">${series.map(s=>`<span style="--color:${s.color}">${esc(s.name)}</span>`).join('')}</div>`;
}
function renderAssets(){const p=current();for(const el of $('currentAssetsForm').elements)if(el.name)el.value=p[el.name];assetsDirty=false;$('assetError').textContent='';}
function renderSettings(resetAssets=true){if(resetAssets)renderAssets();const p=current();for(const el of $('settingsForm').elements)if(el.name)el.value=p[el.name];settingsDirty=false;$('settingsError').textContent='';}
function render(){
  const p=current();selected=p.id;controls();
  $('plan').innerHTML=state.plans.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('plan').value=p.id;
  const comparison=$('compare').value;$('compare').innerHTML='<option value="">比較なし</option>'+state.plans.filter(x=>x.id!==p.id).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('compare').value=state.plans.some(x=>x.id===comparison&&x.id!==p.id)?comparison:'';
  const yr=Number($('focusYear').value),rows=simulate(p);$('focusYear').innerHTML=rows.map(r=>`<option value="${r.year}">${r.year}年</option>`).join('');$('focusYear').value=rows.some(r=>r.year===yr)?yr:p.startYear;
  const r=rows.find(r=>r.year===Number($('focusYear').value));
  const initial=p.cash+p.investments;
  $('assetBasis').textContent=`入力額を${p.startYear}年初の資産として、${p.endYear}年末まで試算します。`;
  $('currentTotal').textContent=yen(initial);
  $('focusLabel').textContent=r.year+'年末の総資産';$('focusTotal').textContent=yen(r.total);
  $('focusBreakdown').textContent=`現金 ${yen(r.cash)} ／ 運用資産 ${yen(r.investments)}`;
  const change=r.total-initial;$('focusChange').textContent=`開始時点から ${change>=0?'+':'−'}${yen(Math.abs(change))}`;
  const milestones=rows.filter((r,i)=>(i+1)%5===0||i===rows.length-1);
  $('milestones').innerHTML=milestones.map(r=>`<button type="button" data-year="${r.year}" aria-pressed="${r.year===Number($('focusYear').value)}"><span>${r.year}年末</span><strong>${yen(r.total)}</strong><small>${r.year-p.startYear+1}年間の試算</small></button>`).join('');
  $('expenseLabel').textContent=r.year+'年の総支出';$('expense').textContent=yen(r.expense);$('income').textContent='年間収入 '+yen(r.income);$('net').textContent=yen(r.net);$('net').className='amount '+(r.net<0?'down':'up');$('contribution').textContent=yen(r.contribution);$('reserveNote').textContent='年末の現金 '+yen(r.cash);
  const last=rows.at(-1);$('future').textContent=`${last.year}年末：総資産 ${yen(last.total)} ／ 現金 ${yen(last.cash)} ／ 運用資産 ${yen(last.investments)}`;
  chart(rows,p,state.plans.find(x=>x.id===$('compare').value));
  const reached=rows.find(r=>r.total>=p.goal&&r.unfunded===0);
  $('goalResult').textContent=p.goal>0?(p.cash+p.investments>=p.goal?`目標 ${yen(p.goal)} は開始時点で達成しています。`:reached?`目標 ${yen(p.goal)} に初めて届く見込み：${reached.year}年末`:`目標 ${yen(p.goal)} は試算期間内に届きません。`):'目標資産を設定すると、到達する年を確認できます。';
  const short=rows.find(r=>r.shortfall>0),gap=rows.find(r=>r.reserveGap>0);
  $('warning').textContent=short?`${short.year}年に資金不足が発生します。その年に賄えない支出 ${yen(short.shortfall)}。不足発生後の資産は、未充足額を後年の黒字で解消する仮定です。`:gap?`${gap.year}年に、現金が設定した生活資金を下回ります。`:'';
  $('itemYearLabel').textContent=r.year+'年の金額';
  const items=p.items.filter(i=>$('filter').value==='all'||i.kind===$('filter').value);
  $('itemRows').innerHTML=items.map(i=>`<tr><td><input type="checkbox" data-enable="${esc(i.id)}" aria-label="${esc(i.name)}を試算に含める" ${i.enabled?'checked':''}></td><td><b>${esc(i.category)}</b><br>${esc(i.name)}</td><td>${i.kind==='income'?'収入':'支出'}</td><td>${yen(i.amount)} / ${unit[i.frequency]}</td><td>${i.start}${i.end===i.start?'':'〜'+i.end}年</td><td>${i.growth}%</td><td>${yen(annualAmount(i,r.year))}</td><td><button data-edit="${esc(i.id)}">編集</button> <button data-copy="${esc(i.id)}">複製</button> <button data-delete="${esc(i.id)}" class="danger">削除</button></td></tr>`).join('')||'<tr><td colspan="8">収入・支出を追加してください。教育費や児童手当も期間を指定して登録できます。</td></tr>';
  const categories=new Map();for(const i of p.items.filter(i=>i.kind==='expense'))categories.set(i.category,(categories.get(i.category)||0)+annualAmount(i,r.year));
  $('categoryTotals').innerHTML=[...categories].map(([name,n])=>`<span>${esc(name)} ${yen(n)} / 年</span>`).join('');
  $('yearRows').innerHTML=rows.map(r=>`<tr><td>${r.year}</td>${['income','expense','net','contribution','gain','withdrawal','cash','investments','total','unfunded'].map(k=>`<td class="${(k==='unfunded'&&r[k]>0)||r[k]<0?'down':''}">${yen(r[k])}</td>`).join('')}</tr>`).join('');
  $('deletePlan').disabled=state.plans.length===1;$('duplicate').disabled=state.plans.length>=12;
}
function openItem(kind,id,copy=false){
  const p=current(),existing=p.items.find(i=>i.id===id);editing=copy?null:existing?.id;
  const item=existing?{...existing,name:existing.name+(copy?'（複製）':'')}:{kind,category:kind==='income'?'給与':'基本生活費',name:'',amount:0,frequency:'monthly',start:p.startYear,end:p.endYear,growth:0};
  for(const el of $('itemForm').elements)if(el.name)el.value=item[el.name];
  $('categories').innerHTML=[...new Set(['基本生活費','住居費','通信費','医療費','教育費','自動車','子供の生活費','娯楽費','税・社会保険','その他','給与','年金','児童手当',...p.items.map(i=>i.category)])].map(c=>`<option value="${esc(c)}"></option>`).join('');
  $('modalTitle').textContent=editing?'収支項目を編集':'収支項目を追加';$('itemError').textContent='';setFrequency();$('modal').showModal();
}
function setFrequency(){const f=$('itemForm').elements;f.end.disabled=f.frequency.value==='once';if(f.end.disabled)f.end.value=f.start.value;}
$('itemForm').elements.frequency.onchange=setFrequency;$('itemForm').elements.start.onchange=setFrequency;
$('itemForm').onsubmit=e=>{e.preventDefault();try{const f=$('itemForm').elements,item={id:editing||crypto.randomUUID(),enabled:editing?current().items.find(i=>i.id===editing).enabled:true};for(const k of ['kind','category','name','frequency'])item[k]=f[k].value.trim();for(const k of ['amount','start','end','growth'])item[k]=Number(f[k].value);if(item.frequency==='once')item.end=item.start;updatePlan(p=>{if(editing)p.items[p.items.findIndex(i=>i.id===editing)]=item;else p.items.push(item);});$('modal').close();}catch(e){$('itemError').textContent=e.message;}};
$('close').onclick=()=>$('modal').close();$('addIncome').onclick=()=>openItem('income');$('addExpense').onclick=()=>openItem('expense');
$('itemRows').onclick=e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.edit)openItem('',b.dataset.edit);if(b.dataset.copy)openItem('',b.dataset.copy,true);if(b.dataset.delete&&confirm('この収支項目を削除しますか？'))updatePlan(p=>p.items=p.items.filter(i=>i.id!==b.dataset.delete));}catch(e){status(e.message,true);}};
$('itemRows').onchange=e=>{if(e.target.dataset.enable)try{updatePlan(p=>p.items.find(i=>i.id===e.target.dataset.enable).enabled=e.target.checked);}catch(err){status(err.message,true);render();}};
$('settingsForm').oninput=()=>{settingsDirty=true;$('settingsError').textContent='条件はまだ反映されていません。「条件を試算に反映」を押してください。';};
$('settingsForm').onsubmit=e=>{e.preventDefault();try{const f=$('settingsForm').elements;updatePlan(p=>{p.name=f.name.value.trim();for(const k of ['startYear','endYear','reserve','rate','investPercent','goal'])p[k]=Number(f[k].value);});renderSettings(false);}catch(e){$('settingsError').textContent=e.message;}};
$('currentAssetsForm').oninput=()=>{assetsDirty=true;$('assetError').textContent='入力中です。「現在の資産を反映」を押すと結果が更新されます。';};
$('currentAssetsForm').onsubmit=e=>{e.preventDefault();try{const f=$('currentAssetsForm').elements;updatePlan(p=>{p.cash=Number(f.cash.value);p.investments=Number(f.investments.value);});renderAssets();}catch(e){$('assetError').textContent=e.message;}};
$('milestones').onclick=e=>{const b=e.target.closest('[data-year]');if(b){$('focusYear').value=b.dataset.year;render();}};
$('focusYear').onchange=render;$('filter').onchange=render;$('compare').onchange=render;
$('plan').onchange=()=>{if(hasDraft()&&!confirm('未反映の資産・運用条件を破棄してプランを切り替えますか？')){$('plan').value=selected;return;}selected=$('plan').value;renderSettings();render();};
$('duplicate').onclick=()=>{if(hasDraft()){status('先に入力中の資産・運用条件を試算に反映してください。',true);return;}const next=structuredClone(state),p=structuredClone(current());p.id=crypto.randomUUID();p.name=p.name.slice(0,50)+'（比較用）';next.plans.push(p);try{validNext(next);state=next;selected=p.id;changed();renderSettings();render();}catch(e){status(e.message,true);}};
$('deletePlan').onclick=()=>{if(state.plans.length<2||!confirm('このプランを削除しますか？'))return;state.plans=state.plans.filter(p=>p.id!==selected);selected=state.plans[0].id;changed();renderSettings();render();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{for(const x of document.querySelectorAll('[data-tab]')){const active=x===b;x.setAttribute('aria-pressed',String(active));$(x.dataset.tab).hidden=!active;}});
$('save').onclick=async()=>{if(!ready||busy||demo)return;if(hasDraft()){status('資産・運用条件に未反映の入力があります。それぞれの「反映」ボタンを押してください。',true);return;}busy=true;controls();const uid=userId,next=structuredClone(state);status('保存しています…');try{await cloud.save(next,next.revision);if(userId!==uid)return;next.revision++;state=next;dirty=false;if(latest&&latest.revision>state.revision)state=structuredClone(latest);status('保存しました。ほかの端末でも同じ設定を確認できます。');render();}catch(e){status('保存できませんでした。'+e.message,true);}finally{busy=false;controls();}};
$('reload').onclick=()=>{if(demo){status('サンプルには保存内容がありません。');return;}if(!latest)return;if((dirty||hasDraft())&&!confirm('未保存の変更を破棄して、最新の保存内容を読み込みますか？'))return;state=structuredClone(latest);dirty=false;renderSettings();render();status('保存済みの内容を読み込みました。');};
$('export').onclick=()=>{if(hasDraft()){status('先に入力中の資産・運用条件を試算に反映してください。',true);return;}download(JSON.stringify(state,null,2),'asset-simulation.json','application/json');};
$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async()=>{try{const file=$('importFile').files[0];if(!file)return;if(file.size>700000)throw Error('ファイルが大きすぎます');const next=validNext(JSON.parse(await file.text()));if(!confirm(`${next.plans.length}件のプランで現在の設定を置き換えます。よろしいですか？（保存は別途必要です）`))return;next.revision=state.revision;state=next;selected=state.plans[0].id;changed();renderSettings();render();}catch(e){status(e.message,true);}finally{$('importFile').value='';}};
$('csv').onclick=()=>{const keys=['year','income','expense','net','contribution','gain','withdrawal','cash','investments','total','unfunded'];download('\ufeff年,収入,支出,収支,新規投資,運用増減,取崩し,現金,運用資産,総資産,未充足額\r\n'+simulate(current()).map(r=>keys.map(k=>r[k]).join(',')).join('\r\n'),'asset-projection.csv','text/csv;charset=utf-8');};
window.addEventListener('beforeunload',e=>{if(!demo&&(dirty||hasDraft())){e.preventDefault();e.returnValue='';}});
$('sample').onclick=()=>{demo=true;state=sampleState();selected=state.plans[0].id;ready=true;dirty=false;$('auth').hidden=true;$('app').hidden=false;$('sampleNote').hidden=false;$('logout').hidden=true;renderSettings();render();status('架空のサンプルを表示しています。');};
$('exitSample').onclick=()=>location.reload();
$('login').onclick=async()=>{try{await cloud.login();}catch(e){$('authStatus').textContent='ログインできませんでした。ポップアップの許可と通信状態を確認してください。';}};
$('logout').onclick=async()=>{if((dirty||hasDraft())&&!confirm('未保存の変更を破棄してログアウトしますか？'))return;try{await cloud.logout();}catch(e){status('ログアウトできませんでした。もう一度お試しください。',true);}};
document.querySelectorAll('.tablewrap').forEach(el=>{el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label','横にスクロールできる表');});
try{cloud=await import('./simulation-cloud.js');$('login').disabled=false;cloud.watch(u=>{if(demo)return;userId=u?.uid||null;ready=false;dirty=false;settingsDirty=false;assetsDirty=false;latest=null;state=emptyState();selected=state.plans[0].id;$('modal').close();$('auth').hidden=!!u;$('app').hidden=!u;$('logout').hidden=!u;$('authStatus').textContent='家計簿・資産管理と同じアカウントでログインできます。';controls();status('保存内容を読み込んでいます…');},s=>{if(demo)return;latest=structuredClone(s);ready=true;if(!dirty&&!busy&&!hasDraft()&&!$('modal').open){state=structuredClone(s);renderSettings();render();status('保存内容を読み込みました。');}else{controls();if(s.revision>state.revision&&!busy)status('別の端末の更新を受信しました。未保存の入力は保持しています。バックアップ後に最新の保存内容を読み込んでください。',true);}},e=>{if(demo)return;ready=false;controls();status('保存内容を読み込めませんでした。再読み込みしてください。'+(e.code==='permission-denied'?' 保存先へのアクセスが許可されていません。':''),true);});}catch(e){$('authStatus').textContent='ログインに接続できませんでした。通信環境を確認して再読み込みしてください。サンプルは利用できます。';}
