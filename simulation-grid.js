import {annualAmount,applyAnnualBlock,simulate} from './simulation-model.js?v=annual-1';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
export function createAnnualGrid({getPlan,update,openItem,onYear,markPending}){
  let signature='',selected=null;
  const scale=()=>Number($('gridUnit').value);
  const fmt=n=>(n/scale()).toLocaleString('ja-JP',{maximumFractionDigits:scale()===1?0:4});
  const error=e=>{$('gridStatus').textContent=e.message;$('gridStatus').className='error';};
  function choose(input){const p=getPlan(),i=p.items.find(i=>i.id===input.dataset.item);if(!i)return;selected={plan:p.id,id:i.id,year:Number(input.dataset.year)};$('gridSelection').textContent=`${i.name}・${selected.year}年`;$('fillRight').disabled=false;$('resetCell').disabled=false;}
  function render(rows){
    const p=getPlan(),years=rows.map(r=>r.year),unit=scale()===10000?'万円':'円';
    if(selected?.plan!==p.id||!p.items.some(i=>i.id===selected?.id&&i.enabled)||!years.includes(selected?.year)){selected=null;$('gridSelection').textContent='金額のセルを選ぶと、右の年へまとめてコピーできます。';$('fillRight').disabled=true;$('resetCell').disabled=true;}
    const key=JSON.stringify([p.id,p.startYear,p.endYear,scale(),p.items.map(i=>[i.id,i.name,i.category,i.kind,i.enabled])]);
    if(signature!==key){
      signature=key;
      const values=(key,label,cls='')=>`<tr class="grid-total ${cls}"><th scope="row">${label}</th>${years.map(y=>`<td data-result="${key}" data-year="${y}"></td>`).join('')}</tr>`;
      const section=(kind,title)=>`<tr class="grid-section ${kind}"><th scope="row">${title}</th>${years.map(()=>'<td></td>').join('')}</tr>`+p.items.filter(i=>i.kind===kind).map(i=>`<tr class="grid-item ${kind} ${i.enabled?'':'is-disabled'}"><th scope="row"><div class="grid-rowhead"><input type="checkbox" data-grid-enable="${esc(i.id)}" aria-label="${esc(i.name)}を年別表で有効にする" ${i.enabled?'checked':''}><input data-row-name="${esc(i.id)}" aria-label="項目名 ${esc(i.name)}" value="${esc(i.name)}" maxlength="80" required><button type="button" data-detail="${esc(i.id)}" aria-label="${esc(i.name)}の詳細設定">設定</button></div><span class="grid-category">${esc(i.category)}</span></th>${years.map(y=>`<td><input type="text" inputmode="decimal" autocomplete="off" data-item="${esc(i.id)}" data-year="${y}" aria-label="${esc(i.name)} ${y}年 年額（${unit}）" ${i.enabled?'':'disabled'}></td>`).join('')}</tr>`).join('')+values(kind,title+' 合計',kind);
      $('annualTable').innerHTML=`<thead><tr><th scope="col">項目 ／ 年額（${unit}）</th>${years.map(y=>`<th scope="col"><button type="button" data-focus-year="${y}" aria-label="${y}年の資産を見る">${y}<small>${y-p.startYear+1}年目</small></button></th>`).join('')}</tr></thead><tbody>${section('income','収入')}${section('expense','支出')}${values('net','年間収支')}${values('contribution','投資に回す額')}${values('cash','年末の現金')}${values('investments','年末の運用資産')}${values('total','年末の総資産','asset-total')}${values('unfunded','未充足額（資金不足）','shortfall')}</tbody>`;
    }
    const itemMap=new Map(p.items.map(i=>[i.id,i])),rowMap=new Map(rows.map(r=>[r.year,r]));
    for(const input of $('annualTable').querySelectorAll('[data-item]')){
      const i=itemMap.get(input.dataset.item),y=Number(input.dataset.year),manual=Object.hasOwn(i.annualValues||{},y);
      if(document.activeElement!==input)input.value=fmt(annualAmount(i,y));
      input.classList.toggle('manual-value',manual);input.title=manual?'この年の個別入力。空欄にすると基本設定の金額に戻ります。':'基本設定から計算した年額。このセルに直接入力して変更できます。';
    }
    for(const td of $('annualTable').querySelectorAll('[data-result]')){const n=rowMap.get(Number(td.dataset.year))[td.dataset.result];td.textContent=fmt(n);td.classList.toggle('negative',n<0||(td.dataset.result==='unfunded'&&n>0));}
    $('gridEmpty').hidden=p.items.length>0;
  }
  $('annualTable').addEventListener('input',e=>{if(e.target.dataset.item||e.target.dataset.rowName)markPending();});
  $('annualTable').addEventListener('focusin',e=>{if(e.target.dataset.item)choose(e.target);});
  function commitCell(e){
    const input=e.target;if(!input.isConnected)return;
    try{
      if(input.dataset.item){const id=input.dataset.item,y=Number(input.dataset.year),text=input.value;update(p=>applyAnnualBlock(p,id,y,text,scale()));input.value=fmt(annualAmount(getPlan().items.find(i=>i.id===id),y));$('gridStatus').textContent='年別の金額を反映しました。最後に「変更を保存」を押してください。';$('gridStatus').className='muted';}
      else if(input.dataset.rowName){const name=input.value.trim();if(getPlan().items.find(i=>i.id===input.dataset.rowName)?.name===name)return;if(!name)throw Error('項目名を入力してください');update(p=>p.items.find(i=>i.id===input.dataset.rowName).name=name);}
      else if(input.dataset.gridEnable)update(p=>p.items.find(i=>i.id===input.dataset.gridEnable).enabled=input.checked);
    }catch(err){error(err);if(input.dataset.item)input.value=fmt(annualAmount(getPlan().items.find(i=>i.id===input.dataset.item),Number(input.dataset.year)));else if(input.dataset.rowName)input.value=getPlan().items.find(i=>i.id===input.dataset.rowName).name;else if(input.dataset.gridEnable)input.checked=!input.checked;}
  }
  $('annualTable').addEventListener('change',commitCell);
  $('annualTable').addEventListener('focusout',e=>{const i=e.target;if(i.dataset.rowName||(i.dataset.item&&i.value!==fmt(annualAmount(getPlan().items.find(x=>x.id===i.dataset.item),Number(i.dataset.year)))))commitCell(e);});
  $('annualTable').addEventListener('paste',e=>{
    if(!e.target.dataset.item)return;
    e.preventDefault();const input=e.target;
    try{let count=0;update(p=>{count=applyAnnualBlock(p,input.dataset.item,Number(input.dataset.year),e.clipboardData.getData('text/plain'),scale());});input.value=fmt(annualAmount(getPlan().items.find(i=>i.id===input.dataset.item),Number(input.dataset.year)));$('gridStatus').textContent=`${count}セルを反映しました。最後に「変更を保存」を押してください。`;$('gridStatus').className='muted';}catch(err){error(err);}
  });
  $('annualTable').addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target.dataset.item)return;e.preventDefault();const input=e.target,id=input.dataset.item,nextYear=Number(input.dataset.year)+(e.shiftKey?-1:1);input.blur();const next=[...$('annualTable').querySelectorAll('[data-item]')].find(i=>i.dataset.item===id&&Number(i.dataset.year)===nextYear);next?.focus();next?.select();});
  $('annualTable').onclick=e=>{const b=e.target.closest('button');if(b?.dataset.detail)openItem('',b.dataset.detail);if(b?.dataset.focusYear)onYear(Number(b.dataset.focusYear));};
  $('gridUnit').onchange=()=>{signature='';render(simulate(getPlan()));};
  $('fillRight').onclick=()=>{if(!selected)return;const {id,year}=selected,p=getPlan(),i=p.items.find(i=>i.id===id);if(!i?.enabled)return;if(!confirm(`${i.name}の${year}年の金額を、${p.endYear}年までコピーします。既存の年別金額は上書きされます。`))return;try{const amount=annualAmount(i,year);update(p=>{const i=p.items.find(i=>i.id===id);i.annualValues??={};for(let y=year;y<=p.endYear;y++)i.annualValues[y]=amount;});$('gridStatus').textContent='選択した年以降にコピーしました。変更を保存してください。';$('gridStatus').className='muted';}catch(e){error(e);}};
  $('resetCell').onclick=()=>{if(!selected)return;try{update(p=>{const i=p.items.find(i=>i.id===selected.id);if(i?.annualValues)delete i.annualValues[selected.year];});$('gridStatus').textContent='選択した年を基本設定の金額に戻しました。';$('gridStatus').className='muted';}catch(e){error(e);}};
  function add(kind,name){const id=crypto.randomUUID();update(p=>p.items.push({id,kind,category:kind==='income'?'収入':'支出',name,amount:0,frequency:'annual',start:p.startYear,end:p.endYear,growth:0,enabled:true,annualValues:{}}));const input=[...$('annualTable').querySelectorAll('[data-row-name]')].find(i=>i.dataset.rowName===id);input?.focus();input?.select();}
  $('gridAddIncome').onclick=()=>{try{add('income','新しい収入');}catch(e){error(e);}};
  $('gridAddExpense').onclick=()=>{try{add('expense','新しい支出');}catch(e){error(e);}};
  $('gridStarter').onclick=()=>{try{update(p=>{for(const [kind,names]of [['income',['給与','年金','児童手当','その他の収入']],['expense',['基本生活費','住居費','通信費','医療費','教育費','自動車','娯楽費','その他の支出']]])for(const name of names)if(!p.items.some(i=>i.kind===kind&&i.name===name))p.items.push({id:crypto.randomUUID(),kind,category:kind==='income'?'収入':'支出',name,amount:0,frequency:'annual',start:p.startYear,end:p.endYear,growth:0,enabled:true,annualValues:{}});});}catch(e){error(e);}};
  return {render};
}
