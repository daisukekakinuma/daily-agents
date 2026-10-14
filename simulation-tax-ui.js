import {defaultTaxSettings,taxProjection,TAX_COMPONENTS} from './simulation-tax.js?v=tax-auto-1';
import {annualAmount} from './simulation-model.js?v=tax-auto-1';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>Math.round(n).toLocaleString('ja-JP')+'円',monthly=n=>(n/12).toLocaleString('ja-JP',{maximumFractionDigits:2});
const candidate=i=>!i.autoTax&&i.kind==='expense'&&/^(税金|所得税|住民税|雇用保険[・･]?税|雇用保険|健康保険|厚生年金|社会保険[・･]?年金|社会保険料)$/.test(i.name.replace(/\s/g,''));
export function createTaxView({getPlan,update,onChange}){
  let draft=false,signature='';
  const report=(s,error=false)=>{$('taxStatus').textContent=s;$('taxStatus').className=error?'error':'muted';};
  const names=p=>[0,1].map(i=>p.family?.[i]?.name||['本人','配偶者'][i]);
  const num=(name,label,value,extra='')=>`<label>${label}<input name="${name}" type="number" min="0" max="1000000000000" step="1" value="${value??''}" ${extra}></label>`;
  const select=(name,label,value,opts)=>`<label>${label}<select name="${name}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  function render(){
    const p=getPlan(),c=p.taxSettings??defaultTaxSettings(p,annualAmount),people=names(p);
    const key=JSON.stringify([p.id,c,p.items.map(i=>[i.id,i.name,i.kind,i.enabled]),people,p.startYear,p.endYear]);
    if(!draft&&signature!==key){signature=key;
      const income=[['','未指定'],...p.items.filter(i=>i.kind==='income').map(i=>[i.id,i.name])];
      $('taxConfigFields').innerHTML=`<label class="tax-check"><input name="enabled" type="checkbox" ${c.enabled?'checked':''}>税金・社会保険を自動計算する</label><div class="tax-person-grid">${c.people.map((person,i)=>`<fieldset><legend>${esc(people[i])}</legend>${select('salary'+i,'額面給与の収入行',person.salaryId,income)}<div class="settingsgrid">${num('bonus'+i,'給与のうち賞与の割合（%）',person.bonusPercent,'required')}${select('bonusCount'+i,'賞与の回数／年',person.bonusCount,[[1,'1回'],[2,'2回'],[3,'3回']])}</div><label class="tax-check"><input name="employment${i}" type="checkbox" ${person.employment?'checked':''}>雇用保険に加入する</label><details><summary>前年収入・その他の所得・控除</summary>${num('previousGross'+i,'開始年の前年の額面給与（円／年・空欄は開始年と同額）',person.previousGross)}${num('previousSocial'+i,'開始年の前年の社会保険料（円／年・空欄は推計）',person.previousSocial)}${num('otherIncome'+i,'給与以外の課税所得（経費等控除後・円／年）',person.otherIncome,'required')}${num('extraIncomeDeduction'+i,'追加の所得控除：所得税用（円／年）',person.extraIncomeDeduction,'required')}${num('extraResidentDeduction'+i,'追加の所得控除：住民税用（円／年）',person.extraResidentDeduction,'required')}<p class="muted">追加所得・控除は全期間共通の基本値です。年ごとの変更は下の内訳で設定できます。住宅ローン控除などの税額控除は税額自体を手入力してください。</p></details></fieldset>`).join('')}</div><div class="settingsgrid">${num('dependentFrom',`${esc(people[1])}の扶養を想定する開始年（空欄はなし）`,c.dependentFrom)}${select('region','住民税の非課税基準',c.region,[['standard','標準（東京23区など）'],['kumagaya','熊谷市']])}<label>加入先・計算の前提<input name="insurer" maxlength="80" value="${esc(c.insurer)}" required></label>${num('healthRate','健康保険料率（労使合計・%）',c.healthRate,'required')}${num('careRate','介護保険料率（労使合計・%）',c.careRate,'required')}${num('supportRate','子ども・子育て支援金率（労使合計・%）',c.supportRate,'required')}${num('employmentRate','雇用保険料率（本人負担・%）',c.employmentRate,'required')}</div><p class="muted">初期値：協会けんぽ全国平均9.90%、介護1.62%、支援金0.23%、雇用保険0.5%。健康・介護・支援金・厚生年金は本人負担の半額だけを支出にします。加入先が異なる場合は料率を変更してください。</p>`;
      for(const el of $('taxConfig').querySelectorAll('input[name$="Rate"],input[name^="bonus"]'))el.step='.001';
      for(const el of $('taxConfig').querySelectorAll('input[name$="Rate"],input[name^="bonus"]'))el.max='100';
      const dup=p.items.filter(candidate);
      $('taxMergeFields').innerHTML=dup.length?`<details open><summary>重複を避けるため、既存の支出を確認</summary><p>チェックした項目を試算から外し、新しい2行に置き換えます。元の金額は残ります。</p>${dup.map(i=>`<label class="tax-check"><input type="checkbox" data-tax-replace="${esc(i.id)}" ${i.enabled?'checked':''}>${esc(i.name)}（${i.enabled?'現在有効':'現在無効'}）</label>`).join('')}</details>`:'<p class="muted">同名の税・社会保険の支出項目はありません。別名の既存項目がある場合は、年別表で無効にして二重計上を避けてください。</p>';
    }
    $('taxActiveSummary').textContent=c.enabled?'自動計算を利用中。TOPの「税金」「社会保険・年金」と将来資産に反映しています。':'設定を確認して「設定を反映」を押すと、TOPに2行を追加します。';
    const old=$('taxYear').value;$('taxYear').innerHTML=Array.from({length:p.endYear-p.startYear+1},(_,i)=>p.startYear+i).map(y=>`<option value="${y}">${y}年</option>`).join('');$('taxYear').value=(+old>=p.startYear&&+old<=p.endYear)?old:p.startYear;
    renderYear();
  }
  function renderYear(){
    const p=getPlan(),c=p.taxSettings,y=+$('taxYear').value,people=names(p);
    $('taxYearContent').hidden=!c?.enabled;if(!c?.enabled)return;
    const r=taxProjection(p,annualAmount).find(r=>r.year===y);if(!r)return;
    const yr=c.years[y]??{};
    $('taxYearSettings').innerHTML=people.map((name,i)=>select(i===0?'selfMode':'spouseMode',`${name}の社会保険`,r.people[i].mode,[['employee','勤務先の社会保険'],...(i===1?[['dependent','扶養を想定（条件を確認）']]:[]),['leave','育休等の免除を想定'],['manual','国保・その他（内訳を手入力）']])).join('')+`<label class="tax-check"><input type="checkbox" name="childDependent" ${r.childDependent?'checked':''}>子供を税の扶養に含める（収入要件を満たす想定）</label>`;
    $('taxYearFacts').textContent=r.people.map((v,i)=>`${people[i]}：額面給与 ${yen(v.gross)} ／ ${v.age===null?'年齢未設定':v.age+'歳'} ／ 配偶者控除等 ${yen(v.spouseDeduction)}`).join('　｜　');
    $('taxTotals').innerHTML=['tax','social'].map(kind=>{const row=p.items.find(i=>i.autoTax===kind),manual=row?.annualValues?.[y]!==undefined,total=row?annualAmount(row,y):0;return `<article class="panel"><h3>${kind==='tax'?'税金':'社会保険・年金'}</h3><p>年額 <strong>${yen(total)}</strong> ／ 月額換算 ${monthly(total)}円</p><label>この年の合計<select data-tax-mode="${kind}" ${row?'':'disabled'}><option value="auto" ${!manual?'selected':''}>自動（内訳の合計）</option><option value="manual" ${manual?'selected':''}>手入力</option></select></label><label>夫婦合算の月額（円）<input type="number" min="0" max="83333333333" step="1" data-tax-total="${kind}" value="${manual?total/12:''}" ${manual?'':'disabled'}></label>${row?'':'<p class="error">対象行が削除されています。「設定を反映」で再追加できます。</p>'}${row&&!row.enabled?'<p class="error">年別表で無効になっています。支出には反映されません。</p>':''}${manual?'<p class="muted">合計の手入力が優先され、下の内訳は参考表示です。</p>':''}</article>`;}).join('');
    $('taxDetailRows').innerHTML=TAX_COMPONENTS.map(([k,label,kind])=>`<tr><th>${label}<small>${kind==='tax'?'税金':'社会保険・年金'}</small></th>${r.people.map((v,i)=>{const manual=yr.values?.[k+i]!==undefined;return `<td><span>${monthly(v[k])}円／月</span><input type="number" min="0" max="83333333333" step="1" data-tax-component="${k+i}" aria-label="${esc(people[i])} ${label} 月額上書き（円）" value="${manual?yr.values[k+i]/12:''}" placeholder="自動・月額で上書き"><small>${manual?'手入力':'自動'} ／ 年額 ${yen(v[k])}</small></td>`;}).join('')}</tr>`).join('');
    $('taxPersonHead0').textContent=people[0];$('taxPersonHead1').textContent=people[1];
    $('taxExtraYear').innerHTML=people.map((name,i)=>`<fieldset><legend>${esc(name)}</legend>${['otherIncome','extraIncomeDeduction','extraResidentDeduction'].map((k,j)=>`<label>${['給与以外の課税所得','追加の所得控除（所得税）','追加の所得控除（住民税）'][j]}（円／年）<input type="number" min="0" max="1000000000000" step="1" data-tax-extra="${k+i}" value="${yr[k+i]??''}" placeholder="基本値 ${c.people[i][k]}"></label>`).join('')}</fieldset>`).join('');
    const warnings=[...r.warnings];
    if(y===p.startYear&&c.people.some(v=>v.previousGross===null))warnings.push('初年度の住民税：前年給与が未入力の人は開始年と同額で仮置きしています。');
    if(p.items.some(i=>candidate(i)&&i.enabled))warnings.push('税・保険と思われる既存支出が有効です。重複がないか確認してください。');
    if(p.items.some(i=>i.kind==='income'&&i.enabled&&!c.people.some(v=>v.salaryId===i.id)))warnings.push('選択した給与以外の収入行は自動で課税しません。不動産・年金等の課税所得は追加所得に入力してください。');
    for(const input of $('taxYearContent').querySelectorAll('[data-tax-component],[data-tax-total],[data-tax-extra]'))input.dataset.committed=input.value;
    $('taxWarnings').innerHTML=warnings.map(w=>`<li>${esc(w)}</li>`).join('');
  }
  $('taxConfig').addEventListener('input',()=>{draft=true;onChange();report('設定は未反映です。「設定を反映」を押してください。');});
  $('taxConfig').onsubmit=e=>{e.preventDefault();try{
    const f=$('taxConfig').elements,p=getPlan(),base=structuredClone(p.taxSettings??defaultTaxSettings(p,annualAmount));
    base.enabled=f.enabled.checked;base.dependentFrom=f.dependentFrom.value===''?null:Number(f.dependentFrom.value);base.region=f.region.value;base.insurer=f.insurer.value.trim();
    for(const k of ['healthRate','careRate','supportRate','employmentRate'])base[k]=Number(f[k].value);
    base.people=base.people.map((person,i)=>({...person,salaryId:f['salary'+i].value,bonusPercent:Number(f['bonus'+i].value),bonusCount:Number(f['bonusCount'+i].value),employment:f['employment'+i].checked,...Object.fromEntries(['previousGross','previousSocial','otherIncome','extraIncomeDeduction','extraResidentDeduction'].map(k=>[k,f[k+i].value===''?null:Number(f[k+i].value)]))}));
    if(base.enabled&&!base.people[0].salaryId&&!base.people[1].salaryId)throw Error('少なくとも1人の額面給与行を選択してください');
    const replace=[...$('taxMergeFields').querySelectorAll('[data-tax-replace]:checked')].map(el=>el.dataset.taxReplace);
    draft=false;signature='';
    update(next=>{next.taxSettings=base;if(base.enabled){for(const kind of ['tax','social']){let row=next.items.find(i=>i.autoTax===kind);if(!row){row={id:crypto.randomUUID(),kind:'expense',category:'税・社会保険',name:kind==='tax'?'税金':'社会保険・年金',amount:0,frequency:'annual',start:next.startYear,end:next.endYear,growth:0,enabled:true,autoTax:kind};next.items.push(row);}row.enabled=true;}for(const id of replace){const i=next.items.find(i=>i.id===id);if(i)i.enabled=false;}}else for(const i of next.items.filter(i=>i.autoTax))i.enabled=false;});
    report('設定を反映しました。最後に「変更を保存」を押してください。');
  }catch(err){draft=true;report(err.message,true);}};
  $('taxYear').onchange=renderYear;
  $('taxYearSettings').onchange=e=>{try{const y=+$('taxYear').value,key=e.target.name;if(!['selfMode','spouseMode','childDependent'].includes(key))return;update(p=>{p.taxSettings.years[y]??={};p.taxSettings.years[y][key]=key==='childDependent'?e.target.checked:e.target.value;});}catch(err){report(err.message,true);}};
  function commit(e){const el=e.target;if(!el.isConnected)return;const y=+$('taxYear').value;if(!el.matches('[data-tax-component],[data-tax-total],[data-tax-extra]'))return;if(el.value===el.dataset.committed)return;
    try{const value=el.value===''?null:Number(el.value),annual=el.hasAttribute('data-tax-extra')?value:value===null?null:Math.round(value*12);
      if(value!==null&&(!Number.isFinite(value)||value<0||annual>1e12||!Number.isSafeInteger(annual)))throw Error('0以上・年額1兆円以下で入力してください');
      el.dataset.committed=el.value;
      update(p=>{if(el.dataset.taxTotal){const row=p.items.find(i=>i.autoTax===el.dataset.taxTotal);row.annualValues??={};if(annual===null)delete row.annualValues[y];else row.annualValues[y]=annual;return;}const yr=p.taxSettings.years[y]??={};if(el.dataset.taxExtra){if(value===null)delete yr[el.dataset.taxExtra];else yr[el.dataset.taxExtra]=value;}else{yr.values??={};if(annual===null)delete yr.values[el.dataset.taxComponent];else yr.values[el.dataset.taxComponent]=annual;}});
      report('この年の金額を反映しました。空欄に戻すと自動計算になります。');
    }catch(err){report(err.message,true);}}
  $('taxYearContent').addEventListener('change',e=>{if(e.target.dataset.taxMode){try{const y=+$('taxYear').value,kind=e.target.dataset.taxMode,mode=e.target.value;update(p=>{const row=p.items.find(i=>i.autoTax===kind);row.annualValues??={};if(mode==='auto')delete row.annualValues[y];else row.annualValues[y]=annualAmount(row,y);});}catch(err){report(err.message,true);}}else commit(e);});
  $('taxYearContent').addEventListener('focusout',commit);
  return {render,reset:()=>{draft=false;signature='';},hasDraft:()=>draft};
}
