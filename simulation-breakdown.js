import {annualAmount,annualComponentAmount,parseAnnualValue} from './simulation-model.js?v=manual-investments-1';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createBreakdown({getPlan,update,markPending}){
  let signature='';
  const scale=()=>Number($('gridUnit').value);
  const fmt=n=>(n/scale()).toLocaleString('ja-JP',{maximumFractionDigits:scale()===1?0:4});
  const monthly=n=>(n/12/scale()).toLocaleString('ja-JP',{maximumFractionDigits:scale()===1?0:4});
  const report=(message,error=false)=>{$('breakdownStatus').textContent=message;$('breakdownStatus').className=error?'error':'muted';};
  function setup(p,item){
    const years=Object.fromEntries(Array.from({length:p.endYear-p.startYear+1},(_,n)=>{const y=p.startYear+n;return [y,annualAmount(item,y)];}));
    item.breakdown=[{id:crypto.randomUUID(),name:'内訳未設定',amount:0,start:p.startYear,end:p.endYear,growth:0,annualValues:years}];
  }
  function render(){
    const p=getPlan(),parents=p.items.filter(i=>i.kind==='expense');
    const next=JSON.stringify([p.id,p.startYear,p.endYear,scale(),parents.map(i=>[i.id,i.name,i.enabled,Array.isArray(i.breakdown),...(i.breakdown||[]).flatMap(x=>[x.id,x.name])])]);
    if(signature!==next){signature=next;const years=Array.from({length:p.endYear-p.startYear+1},(_,n)=>p.startYear+n),unit=scale()===10000?'万円':'円';
      const headers=`<thead><tr><th>支出項目・内訳</th>${years.map(y=>`<th>${y}年</th>`).join('')}</tr></thead>`;
      const groups=parents.map(item=>{
        const amounts=years.map(y=>annualAmount(item,y));
        const totalRow=`<tr class="breakdown-parent${item.enabled?'':' is-disabled'}" data-parent-breakdown="${esc(item.id)}"><th scope="row"><strong>${esc(item.name)}</strong><br><small>${esc(item.category)} · 年額合計（${unit}）</small>${item.breakdown?`<button type="button" data-add-line="${esc(item.id)}">＋ 内訳を追加</button>`:`<button type="button" data-setup-breakdown="${esc(item.id)}">内訳を設定</button>`}</th>${amounts.map((n,index)=>`<td data-parent-amount="${esc(item.id)}:${years[index]}">${fmt(n)}</td>`).join('')}</tr>`;
        if(!item.breakdown)return totalRow;
        const lines=item.breakdown.map(line=>`<tr class="breakdown-line"><th scope="row"><input data-line-name="${esc(item.id)}:${esc(line.id)}" value="${esc(line.name)}" maxlength="80" aria-label="${esc(item.name)}の内訳名" required><small>月額（${unit}）</small><button type="button" class="quiet" data-delete-line="${esc(item.id)}:${esc(line.id)}">削除</button></th>${years.map(y=>`<td><input type="text" inputmode="decimal" autocomplete="off" data-line-amount="${esc(item.id)}:${esc(line.id)}:${y}" aria-label="${esc(item.name)} ${esc(line.name)} ${y}年 月額（${unit}）" title="月額 × 12 を年額に反映します" value="${monthly(annualComponentAmount(line,y))}"></td>`).join('')}</tr>`).join('');
        return totalRow+lines;
      }).join('');
      $('breakdownTable').innerHTML=headers+`<tbody>${groups||`<tr><td colspan="${years.length+1}">支出項目がありません。「年別入力」から支出を追加してください。</td></tr>`}</tbody>`;
      $('breakdownTable').setAttribute('aria-label','月額の支出内訳と年額合計');
    }
    for(const input of $('breakdownTable').querySelectorAll('[data-line-amount]')){
      const [itemId,lineId,year]=input.dataset.lineAmount.split(':'),line=p.items.find(i=>i.id===itemId)?.breakdown?.find(x=>x.id===lineId);
      if(line&&document.activeElement!==input)input.value=monthly(annualComponentAmount(line,Number(year)));
    }
    for(const cell of $('breakdownTable').querySelectorAll('[data-parent-amount]')){
      const [itemId,year]=splitKey(cell.dataset.parentAmount),item=p.items.find(i=>i.id===itemId);
      if(item)cell.textContent=fmt(annualAmount(item,Number(year)));
    }
  }
  function splitKey(value){const pos=value.lastIndexOf(':');return [value.slice(0,pos),value.slice(pos+1)];}
  const findLine=(p,itemId,lineId)=>p.items.find(i=>i.id===itemId)?.breakdown?.find(x=>x.id===lineId);
  $('breakdownTable').addEventListener('input',e=>{if(e.target.dataset.lineAmount||e.target.dataset.lineName)markPending();});
  function commitAmount(input){
    if(!input.isConnected)return;
    const [itemId,lineId,yearText]=input.dataset.lineAmount.split(':'),year=Number(yearText),p=getPlan(),item=p.items.find(i=>i.id===itemId),line=findLine(p,itemId,lineId);
    if(!line)return;
    try{
      const monthlyAmount=parseAnnualValue(input.value,scale()),amount=monthlyAmount===null?null:monthlyAmount*12,previous=annualComponentAmount(line,year);
      if(amount!==null&&amount>1e12)throw Error('月額は年額換算で1兆円以下にしてください');
      update(p=>{const l=findLine(p,itemId,lineId);l.annualValues??={};if(amount===null)delete l.annualValues[year];else l.annualValues[year]=amount;});
      const normalized=findLine(getPlan(),itemId,lineId);input.value=monthly(annualComponentAmount(normalized,year));
      let copied=false;
      if(amount!==null&&amount!==previous&&year<getPlan().endYear&&confirm(`${item.name}・${line.name}：${year}年の月額を変更しました。翌年から${getPlan().endYear}年まで、同じ月額に変更しますか？\n\nOK：翌年以降も同じ月額\nキャンセル：${year}年だけ変更`)){
        update(p=>{const l=findLine(p,itemId,lineId);l.annualValues??={};for(let y=year+1;y<=p.endYear;y++)l.annualValues[y]=amount;});copied=true;
      }
      report(copied?`${year}年から${getPlan().endYear}年まで同じ内訳金額にしました。最後に「変更を保存」を押してください。`:`${year}年の内訳金額を反映しました。支出項目の合計も更新しました。最後に「変更を保存」を押してください。`);
    }catch(err){report(err.message,true);const l=findLine(getPlan(),itemId,lineId);if(l)input.value=monthly(annualComponentAmount(l,year));}
  }
  $('breakdownTable').addEventListener('change',e=>{if(e.target.dataset.lineAmount)commitAmount(e.target);else if(e.target.dataset.lineName){const [itemId,lineId]=splitKey(e.target.dataset.lineName),name=e.target.value.trim();if(!name){report('内訳名を入力してください。',true);e.target.value=findLine(getPlan(),itemId,lineId)?.name||'';return;}try{update(p=>{findLine(p,itemId,lineId).name=name;});report('内訳名を更新しました。最後に「変更を保存」を押してください。');}catch(err){report(err.message,true);}}});
  $('breakdownTable').addEventListener('focusout',e=>{if(e.target.dataset.lineAmount){const [itemId,lineId,year]=e.target.dataset.lineAmount.split(':'),line=findLine(getPlan(),itemId,lineId);if(line&&e.target.value!==monthly(annualComponentAmount(line,Number(year))))commitAmount(e.target);}});
  $('breakdownTable').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.lineAmount){e.preventDefault();e.target.blur();}});
  $('breakdownTable').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    try{
      if(b.dataset.setupBreakdown){update(p=>{const item=p.items.find(i=>i.id===b.dataset.setupBreakdown);if(item&&!item.breakdown)setup(p,item);});report('現在の年別金額を「内訳未設定」に移しました。金額を保ったまま、内訳を追加できます。最後に「変更を保存」を押してください。');}
      else if(b.dataset.addLine){update(p=>{const item=p.items.find(i=>i.id===b.dataset.addLine);if(!item?.breakdown)setup(p,item);if(item.breakdown.length>=100)throw Error('内訳は100件まで追加できます');item.breakdown.push({id:crypto.randomUUID(),name:'新しい内訳',amount:0,start:p.startYear,end:p.endYear,growth:0});});report('内訳を追加しました。年ごとの月額を入力してください。');}
      else if(b.dataset.deleteLine){const [itemId,lineId]=splitKey(b.dataset.deleteLine),item=getPlan().items.find(i=>i.id===itemId),line=item?.breakdown?.find(x=>x.id===lineId);if(!line)return;const old=Array.from({length:getPlan().endYear-getPlan().startYear+1},(_,n)=>{const y=getPlan().startYear+n;return [y,annualComponentAmount(line,y)];}),changedYears=old.filter(([y,n])=>n!==0);if(changedYears.length){const [year,before]=changedYears[0],after=annualAmount(item,year)-before;if(!confirm(`「${line.name}」を削除しますか？\n${year}年の${item.name}合計は ${fmt(annualAmount(item,year))} → ${fmt(after)} ${scale()===10000?'万円':'円'} になります。ほかの年もこの内訳分だけ減ります。`))return;}update(p=>{const parent=p.items.find(i=>i.id===itemId);parent.breakdown=parent.breakdown.filter(x=>x.id!==lineId);});report(`「${line.name}」を削除しました。合計が更新されます。最後に「変更を保存」を押してください。`);}
    }catch(err){report(err.message,true);}
  });
  return {render};
}
