import {annualAmount,applyAnnualBlock,simulate,parseAnnualValue,familyMembers} from './simulation-model.js?v=editable-events-1';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
export function moveItem(items,id,targetId,after=false){
  const from=items.findIndex(i=>i.id===id),target=items.findIndex(i=>i.id===targetId);
  if(from<0||target<0||from===target||items[from].kind!==items[target].kind)return false;
  const [item]=items.splice(from,1);
  const at=items.findIndex(i=>i.id===targetId)+(after?1:0);
  items.splice(at,0,item);
  return true;
}
export function createAnnualGrid({getPlan,update,openItem,openBreakdown,onYear,onUnitChange=()=>{},markPending}){
  let signature='',selected=null;
  const scale=()=>Number($('gridUnit').value);
  const fmt=n=>(n/scale()).toLocaleString('ja-JP',{maximumFractionDigits:scale()===1?0:4});
  const error=e=>{$('gridStatus').textContent=e.message;$('gridStatus').className='error';};
  function choose(input){const p=getPlan(),i=p.items.find(i=>i.id===input.dataset.item);if(!i)return;selected={plan:p.id,id:i.id,year:Number(input.dataset.year)};$('gridSelection').textContent=`${i.name}・${selected.year}年`;$('fillRight').disabled=false;$('resetCell').disabled=false;}
  function render(rows){
    const p=getPlan(),years=rows.map(r=>r.year),unit=scale()===10000?'万円':'円';
    if(selected?.plan!==p.id||!p.items.some(i=>i.id===selected?.id&&i.enabled)||!years.includes(selected?.year)){selected=null;$('gridSelection').textContent='金額のセルを選ぶと、右の年へまとめてコピーできます。';$('fillRight').disabled=true;$('resetCell').disabled=true;}
    const key=JSON.stringify([p.id,p.startYear,p.endYear,scale(),familyMembers(p),(p.lifeEvents??[{},{},{}]).length,p.items.map(i=>[i.id,i.name,i.category,i.kind,i.enabled,Array.isArray(i.breakdown)])]);
    if(signature!==key){
      signature=key;
      const values=(key,label,cls='')=>`<tr class="grid-total ${cls}"><th scope="row">${label}</th>${years.map(y=>`<td data-result="${key}" data-year="${y}"></td>`).join('')}</tr>`;
      const section=(kind,title)=>`<tr class="grid-section ${kind}"><th scope="row">${title}</th>${years.map(()=>'<td></td>').join('')}</tr>`+p.items.filter(i=>i.kind===kind).map(i=>`<tr class="grid-item ${kind} ${i.enabled?'':'is-disabled'}" data-row-id="${esc(i.id)}"><th scope="row"><div class="grid-rowhead"><button type="button" class="grid-drag" data-drag-id="${esc(i.id)}" aria-label="${esc(i.name)}の順番を変更" title="ドラッグして並べ替え。上下キーでも移動できます">⠿</button><input type="checkbox" data-grid-enable="${esc(i.id)}" aria-label="${esc(i.name)}を年別表で有効にする" ${i.enabled?'checked':''}><input data-row-name="${esc(i.id)}" aria-label="項目名 ${esc(i.name)}" value="${esc(i.name)}" maxlength="80" required>${i.kind==='expense'?`<button type="button" data-breakdown="${esc(i.id)}" aria-label="${esc(i.name)}の内訳を管理">内訳</button>`:''}<button type="button" data-detail="${esc(i.id)}" aria-label="${esc(i.name)}の詳細設定">設定</button></div><span class="grid-category">${esc(i.category)}</span></th>${years.map(y=>`<td><input type="text" inputmode="decimal" autocomplete="off" data-item="${esc(i.id)}" data-year="${y}" aria-label="${esc(i.name)} ${y}年 年額（${unit}）" ${i.enabled&&!i.breakdown?'':'disabled'} ${i.breakdown?'class="calculated-value" title="支出内訳の合計です。内訳画面で金額を編集してください。"':''}></td>`).join('')}</tr>`).join('')+values(kind,title+' 合計',kind);
      const family=familyMembers(p).map((m,index)=>`<tr class="grid-family"><th scope="row"><input data-family-name="${index}" aria-label="家族${index+1}の名前" value="${esc(m.name)}" maxlength="40"><label>生まれ年 <input type="number" data-family-birth="${index}" aria-label="家族${index+1}の生まれ年" min="1900" max="2200" step="1" placeholder="西暦" value="${m.birthYear??''}"></label></th>${years.map(y=>`<td>${m.birthYear===null?'—':y<m.birthYear?'<span class="muted">出生前</span>':y===m.birthYear?'0歳・誕生':`${y-m.birthYear}歳`}</td>`).join('')}</tr>`).join('');
      const eventLines=p.lifeEvents??[{},{},{}];
      const events=eventLines.map((line,index)=>`<tr class="grid-event"><th scope="row"><div class="grid-event-head"><span>イベント ${index+1}</span><button type="button" data-delete-event="${index}" aria-label="イベント${index+1}の行を削除">削除</button></div></th>${years.map(y=>`<td><textarea data-event-line="${index}" data-year="${y}" aria-label="イベント${index+1} ${y}年" maxlength="200" rows="2" placeholder="自由に入力"></textarea></td>`).join('')}</tr>`).join('');
      $('annualTable').innerHTML=`<thead><tr><th scope="col">項目 ／ 年額（${unit}）</th>${years.map(y=>`<th scope="col"><button type="button" data-focus-year="${y}" aria-label="${y}年の資産を見る">${y}<small>${y-p.startYear+1}年目</small></button></th>`).join('')}</tr></thead><tbody>${family}${events}<tr class="grid-event-actions"><th scope="row"><button type="button" data-add-event ${eventLines.length>=20?'disabled':''}>＋ イベントの行</button>${eventLines.length>=20?'<small>最大20行です</small>':''}</th>${years.map(()=>'<td></td>').join('')}</tr>${section('income','収入')}${section('expense','支出')}${values('net','年間収支')}${values('contribution','投資に回す額')}${values('cash','年末の現金')}${values('investments','年末の運用資産')}${values('total','年末の総資産','asset-total')}${values('unfunded','未充足額（資金不足）','shortfall')}</tbody>`;
    }
    for(const input of $('annualTable').querySelectorAll('[data-event-line]'))if(document.activeElement!==input)input.value=p.lifeEvents?.[Number(input.dataset.eventLine)]?.[input.dataset.year]??'';
    const itemMap=new Map(p.items.map(i=>[i.id,i])),rowMap=new Map(rows.map(r=>[r.year,r]));
    for(const input of $('annualTable').querySelectorAll('[data-item]')){
      const i=itemMap.get(input.dataset.item),y=Number(input.dataset.year),manual=Object.hasOwn(i.annualValues||{},y);
      if(document.activeElement!==input)input.value=fmt(annualAmount(i,y));
      input.classList.toggle('manual-value',manual);input.title=manual?'この年の個別入力。空欄にすると基本設定の金額に戻ります。':'基本設定から計算した年額。このセルに直接入力して変更できます。';
    }
    for(const td of $('annualTable').querySelectorAll('[data-result]')){const n=rowMap.get(Number(td.dataset.year))[td.dataset.result];td.textContent=fmt(n);td.classList.toggle('negative',n<0||(td.dataset.result==='unfunded'&&n>0));}
    $('gridEmpty').hidden=p.items.length>0;
  }
  $('annualTable').addEventListener('input',e=>{if(e.target.matches('[data-item],[data-row-name],[data-family-name],[data-family-birth],[data-event-line]'))markPending();});
  $('annualTable').addEventListener('focusin',e=>{if(e.target.dataset.item)choose(e.target);});
  function commitCell(e){
    const input=e.target;if(!input.isConnected)return;
    try{
      if(input.matches('[data-family-name],[data-family-birth]')){
        const index=Number(input.dataset.familyName??input.dataset.familyBirth),isName=input.hasAttribute('data-family-name');
        const value=isName?input.value.trim():input.value===''?null:Number(input.value);
        if(familyMembers(getPlan())[index][isName?'name':'birthYear']===value)return;
        update(p=>{p.family=structuredClone(familyMembers(p));p.family[index][isName?'name':'birthYear']=value;});
        $('gridStatus').textContent='家族の年齢を更新しました。最後に「変更を保存」を押してください。';$('gridStatus').className='muted';
      }
      else if(input.hasAttribute('data-event-line')){
        if((getPlan().lifeEvents?.[Number(input.dataset.eventLine)]?.[input.dataset.year]??'')===input.value)return;
        update(p=>{p.lifeEvents??=[{},{},{}];const line=p.lifeEvents[Number(input.dataset.eventLine)];if(input.value)line[input.dataset.year]=input.value;else delete line[input.dataset.year];});
        $('gridStatus').textContent='イベントを反映しました。最後に「変更を保存」を押してください。';$('gridStatus').className='muted';
      }
      else if(input.dataset.item){
        const id=input.dataset.item,y=Number(input.dataset.year),text=input.value;
        const previous=annualAmount(getPlan().items.find(i=>i.id===id),y),amount=parseAnnualValue(text,scale());
        update(p=>applyAnnualBlock(p,id,y,text,scale()));
        input.value=fmt(annualAmount(getPlan().items.find(i=>i.id===id),y));
        let copied=false;
        const p=getPlan(),item=p.items.find(i=>i.id===id);
        if(amount!==null&&amount!==previous&&y<p.endYear&&confirm(`${item.name}：${y}年を${amount.toLocaleString('ja-JP')}円に変更しました。\n翌年（${y+1}年）から${p.endYear}年まで、すべて同じ金額に変更しますか？\n\nOK：翌年以降の金額も上書きする\nキャンセル：${y}年だけ変更する`)){
          update(p=>{const i=p.items.find(i=>i.id===id);i.annualValues??={};for(let year=y+1;year<=p.endYear;year++)i.annualValues[year]=amount;});copied=true;
        }
        $('gridStatus').textContent=copied?`${y}年から${p.endYear}年まで同じ金額に変更しました。最後に「変更を保存」を押してください。`:`${y}年の金額を反映しました。最後に「変更を保存」を押してください。`;$('gridStatus').className='muted';
      }
      else if(input.dataset.rowName){const name=input.value.trim();if(getPlan().items.find(i=>i.id===input.dataset.rowName)?.name===name)return;if(!name)throw Error('項目名を入力してください');update(p=>p.items.find(i=>i.id===input.dataset.rowName).name=name);}
      else if(input.dataset.gridEnable)update(p=>p.items.find(i=>i.id===input.dataset.gridEnable).enabled=input.checked);
    }catch(err){error(err);if(input.matches('[data-family-name],[data-family-birth]')){const m=familyMembers(getPlan())[Number(input.dataset.familyName??input.dataset.familyBirth)];input.value=input.hasAttribute('data-family-name')?m.name:m.birthYear??'';}if(input.dataset.item)input.value=fmt(annualAmount(getPlan().items.find(i=>i.id===input.dataset.item),Number(input.dataset.year)));else if(input.dataset.rowName)input.value=getPlan().items.find(i=>i.id===input.dataset.rowName).name;else if(input.dataset.gridEnable)input.checked=!input.checked;}
  }
  $('annualTable').addEventListener('change',commitCell);
  $('annualTable').addEventListener('focusout',e=>{const i=e.target;if(i.matches('[data-family-name],[data-family-birth],[data-event-line]')||i.dataset.rowName||(i.dataset.item&&i.value!==fmt(annualAmount(getPlan().items.find(x=>x.id===i.dataset.item),Number(i.dataset.year)))))commitCell(e);});
  $('annualTable').addEventListener('paste',e=>{
    if(!e.target.dataset.item)return;
    e.preventDefault();const input=e.target;
    try{let count=0;update(p=>{count=applyAnnualBlock(p,input.dataset.item,Number(input.dataset.year),e.clipboardData.getData('text/plain'),scale());});input.value=fmt(annualAmount(getPlan().items.find(i=>i.id===input.dataset.item),Number(input.dataset.year)));$('gridStatus').textContent=`${count}セルを反映しました。最後に「変更を保存」を押してください。`;$('gridStatus').className='muted';}catch(err){error(err);}
  });
  $('annualTable').addEventListener('keydown',e=>{
    if(e.target.dataset.dragId&&(e.key==='ArrowUp'||e.key==='ArrowDown')){
      e.preventDefault();const id=e.target.dataset.dragId,p=getPlan(),kind=p.items.find(i=>i.id===id)?.kind;
      const peers=p.items.filter(i=>i.kind===kind),index=peers.findIndex(i=>i.id===id),target=peers[index+(e.key==='ArrowUp'?-1:1)];
      if(target){update(p=>moveItem(p.items,id,target.id,e.key==='ArrowDown'));$('annualTable').querySelectorAll('[data-drag-id]').forEach(b=>{if(b.dataset.dragId===id)b.focus();});$('gridStatus').textContent=`${p.items.find(i=>i.id===id).name}の順番を変更しました。最後に「変更を保存」を押してください。`;}
      return;
    }
    if(e.key!=='Enter'||!e.target.dataset.item)return;e.preventDefault();const input=e.target,id=input.dataset.item,nextYear=Number(input.dataset.year)+(e.shiftKey?-1:1);input.blur();const next=[...$('annualTable').querySelectorAll('[data-item]')].find(i=>i.dataset.item===id&&Number(i.dataset.year)===nextYear);next?.focus();next?.select();
  });
  let dragging=null;
  const clearDrag=()=>{if(dragging?.handle?.hasPointerCapture(dragging.pointerId))dragging.handle.releasePointerCapture(dragging.pointerId);$('annualTable').querySelectorAll('.grid-dragging,.grid-drop-before,.grid-drop-after').forEach(r=>r.classList.remove('grid-dragging','grid-drop-before','grid-drop-after'));dragging=null;};
  $('annualTable').addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag-id]');if(!handle||e.button!==0)return;dragging={id:handle.dataset.dragId,handle,pointerId:e.pointerId,x:e.clientX,y:e.clientY,target:null,after:false,moved:false};handle.setPointerCapture(e.pointerId);});
  $('annualTable').addEventListener('pointermove',e=>{
    if(!dragging||dragging.pointerId!==e.pointerId)return;
    if(!dragging.moved&&Math.hypot(e.clientX-dragging.x,e.clientY-dragging.y)<6)return;
    dragging.moved=true;const table=$('annualTable');table.querySelectorAll('.grid-dragging,.grid-drop-before,.grid-drop-after').forEach(r=>r.classList.remove('grid-dragging','grid-drop-before','grid-drop-after'));
    const source=dragging.handle.closest('[data-row-id]');source?.classList.add('grid-dragging');
    const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('#annualTable [data-row-id]');
    const p=getPlan(),sourceItem=p.items.find(i=>i.id===dragging.id),targetItem=p.items.find(i=>i.id===row?.dataset.rowId);
    dragging.target=targetItem&&sourceItem?.kind===targetItem.kind&&targetItem.id!==sourceItem.id?targetItem.id:null;
    if(dragging.target){dragging.after=e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;row.classList.add(dragging.after?'grid-drop-after':'grid-drop-before');}
    const scroll=table.closest('.annual-scroll'),box=scroll.getBoundingClientRect();if(e.clientY>box.bottom-28)scroll.scrollTop+=16;else if(e.clientY<box.top+28)scroll.scrollTop-=16;
  });
  $('annualTable').addEventListener('pointerup',e=>{if(!dragging||dragging.pointerId!==e.pointerId)return;const {id,target,after}=dragging;clearDrag();if(!target)return;try{update(p=>moveItem(p.items,id,target,after));$('gridStatus').textContent=`${getPlan().items.find(i=>i.id===id).name}の順番を変更しました。最後に「変更を保存」を押してください。`;$('gridStatus').className='muted';}catch(err){error(err);}});
  $('annualTable').addEventListener('pointercancel',clearDrag);
  $('annualTable').onclick=e=>{const b=e.target.closest('button');if(b?.hasAttribute('data-add-event')){try{update(p=>{p.lifeEvents??=[{},{},{}];if(p.lifeEvents.length>=20)throw Error('イベント欄は20行まで追加できます');p.lifeEvents.push({});});$('annualTable').querySelector(`[data-event-line="${getPlan().lifeEvents.length-1}"]`)?.focus();$('gridStatus').textContent='イベントの行を追加しました。最後に「変更を保存」を押してください。';$('gridStatus').className='muted';}catch(err){error(err);}return;}if(b?.hasAttribute('data-delete-event')){const index=Number(b.dataset.deleteEvent),lines=getPlan().lifeEvents??[{},{},{}];if(Object.values(lines[index]).some(value=>value.trim())&&!confirm(`イベント${index+1}の行を削除しますか？この行に入力したすべての年のイベントが削除されます。`))return;try{update(p=>{p.lifeEvents??=[{},{},{}];p.lifeEvents.splice(index,1);});$('gridStatus').textContent='イベントの行を削除しました。最後に「変更を保存」を押してください。';$('gridStatus').className='muted';}catch(err){error(err);}return;}if(b?.dataset.detail)openItem('',b.dataset.detail);if(b?.dataset.breakdown)openBreakdown(b.dataset.breakdown);if(b?.dataset.focusYear)onYear(Number(b.dataset.focusYear));};
  $('gridUnit').onchange=()=>{signature='';render(simulate(getPlan()));onUnitChange();};
  $('fillRight').onclick=()=>{if(!selected)return;const {id,year}=selected,p=getPlan(),i=p.items.find(i=>i.id===id);if(!i?.enabled)return;if(!confirm(`${i.name}の${year}年の金額を、${p.endYear}年までコピーします。既存の年別金額は上書きされます。`))return;try{const amount=annualAmount(i,year);update(p=>{const i=p.items.find(i=>i.id===id);i.annualValues??={};for(let y=year;y<=p.endYear;y++)i.annualValues[y]=amount;});$('gridStatus').textContent='選択した年以降にコピーしました。変更を保存してください。';$('gridStatus').className='muted';}catch(e){error(e);}};
  $('resetCell').onclick=()=>{if(!selected)return;try{update(p=>{const i=p.items.find(i=>i.id===selected.id);if(i?.annualValues)delete i.annualValues[selected.year];});$('gridStatus').textContent='選択した年を基本設定の金額に戻しました。';$('gridStatus').className='muted';}catch(e){error(e);}};
  function add(kind,name){const id=crypto.randomUUID();update(p=>p.items.push({id,kind,category:kind==='income'?'収入':'支出',name,amount:0,frequency:'annual',start:p.startYear,end:p.endYear,growth:0,enabled:true,annualValues:{}}));const input=[...$('annualTable').querySelectorAll('[data-row-name]')].find(i=>i.dataset.rowName===id);input?.focus();input?.select();}
  $('gridAddIncome').onclick=()=>{try{add('income','新しい収入');}catch(e){error(e);}};
  $('gridAddExpense').onclick=()=>{try{add('expense','新しい支出');}catch(e){error(e);}};
  $('gridStarter').onclick=()=>{try{update(p=>{for(const [kind,names]of [['income',['給与','年金','児童手当','その他の収入']],['expense',['基本生活費','住居費','通信費','医療費','教育費','自動車','娯楽費','その他の支出']]])for(const name of names)if(!p.items.some(i=>i.kind===kind&&i.name===name))p.items.push({id:crypto.randomUUID(),kind,category:kind==='income'?'収入':'支出',name,amount:0,frequency:'annual',start:p.startYear,end:p.endYear,growth:0,enabled:true,annualValues:{}});});}catch(e){error(e);}};
  return {render};
}
