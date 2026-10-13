// Amounts are yen. Flows and transfers occur at year end, after investment returns.
export function newPlan(year = new Date().getFullYear()) {
  return {id:crypto.randomUUID(),name:'基本プラン',startYear:year,endYear:year+35,cash:0,investments:0,reserve:0,rate:3,investPercent:100,goal:0,items:[]};
}
export const emptyState=()=>({version:1,revision:0,plans:[newPlan()]});
// Personal family details stay in each saved plan, not in the public defaults.
export const familyMembers=p=>p.family??['本人','配偶者','子供'].map(name=>({name,birthYear:null}));
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const money=v=>Number.isSafeInteger(v)&&finite(v,0,1e12);
const year=v=>Number.isInteger(v)&&finite(v,1900,2200);
export function validate(s){
  if(s?.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.plans)||!s.plans.length||s.plans.length>12)throw Error('プランの形式を確認してください（最大12件）');
  const ids=new Set();
  for(const p of s.plans){
    if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>60)throw Error('プラン名を確認してください');ids.add(p.id);
    if(!year(p.startYear)||!year(p.endYear)||p.endYear<p.startYear||p.endYear-p.startYear>80)throw Error('試算期間は1900〜2200年の範囲、最大81年間です');
    if(![p.cash,p.investments,p.reserve,p.goal].every(money)||!finite(p.rate,-100,100)||!finite(p.investPercent,0,100))throw Error('資産・生活資金・利回り・投資割合を確認してください');
    if(p.annualContributions!==undefined){
      if(!p.annualContributions||typeof p.annualContributions!=='object'||Array.isArray(p.annualContributions)||Object.keys(p.annualContributions).length>301)throw Error('年別投資額の形式を確認してください');
      for(const [y,n] of Object.entries(p.annualContributions))if(!/^\d{4}$/.test(y)||!year(Number(y))||!money(n))throw Error('投資額は0〜1兆円の整数で入力してください');
    }
    if(p.family!==undefined&&(!Array.isArray(p.family)||p.family.length!==3||p.family.some(m=>!m||typeof m.name!=='string'||!m.name.trim()||m.name.length>40||(m.birthYear!==null&&!year(m.birthYear)))))throw Error('家族の名前・生まれ年を確認してください');
    if(p.lifeEvents!==undefined){
      if(!Array.isArray(p.lifeEvents)||p.lifeEvents.length>20)throw Error('イベント欄は20行まで追加できます');
      for(const line of p.lifeEvents){
        if(!line||typeof line!=='object'||Array.isArray(line)||Object.keys(line).length>301)throw Error('イベント欄の形式を確認してください');
        for(const [y,text] of Object.entries(line))if(!/^\d{4}$/.test(y)||!year(Number(y))||typeof text!=='string'||text.length>200)throw Error('イベントは各年200文字以内で入力してください');
      }
    }
    if(!Array.isArray(p.items)||p.items.length>500)throw Error('収支項目は500件までです');
    const itemIds=new Set();
    for(const i of p.items){
      if(typeof i.id!=='string'||!i.id||itemIds.has(i.id)||!['income','expense'].includes(i.kind)||typeof i.category!=='string'||!i.category.trim()||i.category.length>60||typeof i.name!=='string'||!i.name.trim()||i.name.length>80||typeof i.enabled!=='boolean')throw Error('項目の名前・分類を確認してください');itemIds.add(i.id);
      if(!money(i.amount)||!['monthly','annual','once'].includes(i.frequency)||!year(i.start)||!year(i.end)||i.end<i.start||!finite(i.growth,-100,100)||(i.frequency==='once'&&i.start!==i.end))throw Error('項目の金額・期間・増減率を確認してください');
      if(i.annualValues!==undefined){
        if(!i.annualValues||typeof i.annualValues!=='object'||Array.isArray(i.annualValues)||Object.keys(i.annualValues).length>301)throw Error('年別金額の形式を確認してください');
        for(const [y,n] of Object.entries(i.annualValues))if(!/^\d{4}$/.test(y)||!year(Number(y))||!money(n))throw Error('年別金額は0〜1兆円の整数で入力してください');
      }
      if(i.breakdown!==undefined){
        if(i.kind!=='expense'||!Array.isArray(i.breakdown)||i.breakdown.length>100)throw Error('支出内訳の形式を確認してください');
        const lineIds=new Set();
        for(const line of i.breakdown){
          if(typeof line.id!=='string'||!line.id||lineIds.has(line.id)||typeof line.name!=='string'||!line.name.trim()||line.name.length>80)throw Error('支出内訳の名前を確認してください');lineIds.add(line.id);
          if(!money(line.amount)||!year(line.start)||!year(line.end)||line.end<line.start||!finite(line.growth,-100,100))throw Error('支出内訳の金額・期間・増減率を確認してください');
          if(line.annualValues!==undefined){if(!line.annualValues||typeof line.annualValues!=='object'||Array.isArray(line.annualValues)||Object.keys(line.annualValues).length>301)throw Error('支出内訳の年別金額を確認してください');for(const[y,n]of Object.entries(line.annualValues))if(!/^\d{4}$/.test(y)||!year(Number(y))||!money(n))throw Error('支出内訳は0〜1兆円の整数で入力してください');}
        }
      }
    }
  }
  if(new TextEncoder().encode(JSON.stringify(s)).length>650000)throw Error('保存できる容量を超えています');
  return s;
}
export function annualAmount(item,year){
  if(!item.enabled)return 0;
  if(Array.isArray(item.breakdown)){
    const total=item.breakdown.reduce((sum,line)=>sum+annualComponentAmount(line,year),0);
    if(!Number.isSafeInteger(total)||total>1e12)throw Error('支出の内訳合計が上限を超えています');
    return total;
  }
  if(item.annualValues&&Object.hasOwn(item.annualValues,year))return item.annualValues[year];
  if(year<item.start||year>item.end)return 0;
  const n=item.amount*(item.frequency==='monthly'?12:1)*Math.pow(1+item.growth/100,year-item.start);
  if(!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER)throw Error('増減率または金額が大きすぎます');
  return Math.round(n);
}
export function annualComponentAmount(line,year){
  if(line.annualValues&&Object.hasOwn(line.annualValues,year))return line.annualValues[year];
  if(year<line.start||year>line.end)return 0;
  const amount=line.amount*Math.pow(1+line.growth/100,year-line.start);
  if(!Number.isFinite(amount)||amount>Number.MAX_SAFE_INTEGER)throw Error('内訳の金額または増減率が大きすぎます');
  return Math.round(amount);
}
export function parseAnnualValue(text,scale=10000){
  const value=String(text).normalize('NFKC').replace(/[,\s]/g,'');
  if(value==='')return null;
  if(![1,10000].includes(scale)||!/^\d+(\.\d+)?$/.test(value))throw Error('金額は0以上の数字で入力してください（数式は使えません）');
  const n=Number(value)*scale,rounded=Math.round(n);
  if(!money(rounded)||Math.abs(n-rounded)>0.00001)throw Error('1円単位、1兆円以下で入力してください');
  return rounded;
}
// Spreadsheet paste is applied to the supplied draft; callers validate before committing.
export function applyAnnualBlock(plan,id,startYear,text,scale=10000){
  const startItem=plan.items.find(i=>i.id===id);
  if(!startItem||!startItem.enabled)throw Error('有効な収支項目を選んでください');
  const items=plan.items.filter(i=>i.kind===startItem.kind),index=items.findIndex(i=>i.id===id);
  const lines=String(text).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
  if(!Number.isInteger(startYear)||startYear<plan.startYear||startYear>plan.endYear||lines.length+index>items.length||lines.some(line=>startYear+line.length-1>plan.endYear))throw Error('貼り付ける範囲が表を超えています。先に項目や試算期間を増やしてください');
  const edits=[];
  lines.forEach((line,row)=>line.forEach((value,col)=>{if(!items[index+row].enabled)throw Error('無効な項目が含まれています。項目を有効にしてから貼り付けてください');edits.push([items[index+row],startYear+col,parseAnnualValue(value,scale)]);}));
  for(const [item,y,n] of edits){item.annualValues??={};if(n===null)delete item.annualValues[y];else item.annualValues[y]=n;}
  return edits.length;
}
export function simulate(p,rate=p.rate){
  validate({version:1,revision:0,plans:[{...p,rate}]});
  let cash=p.cash,investments=p.investments,unfunded=0;
  const rows=[];
  for(let y=p.startYear;y<=p.endYear;y++){
    const income=p.items.filter(i=>i.kind==='income').reduce((s,i)=>s+annualAmount(i,y),0);
    const expense=p.items.filter(i=>i.kind==='expense').reduce((s,i)=>s+annualAmount(i,y),0);
    const net=income-expense,gain=Math.round(investments*rate/100);
    investments+=gain;cash+=net;
    // An unresolved prior shortfall consumes later cash inflows before new investment.
    const repaid=Math.min(Math.max(cash,0),unfunded);cash-=repaid;unfunded-=repaid;
    let withdrawal=0,shortfall=0,contribution=0;
    if(cash<0){withdrawal=Math.min(investments,-cash);investments-=withdrawal;cash+=withdrawal;if(cash<0){shortfall=-cash;unfunded+=shortfall;cash=0;}}
    const requestedContribution=p.annualContributions?.[y]??null;
    if(requestedContribution!==null){
      // Manual transfers may use existing savings and override the reserve target.
      // Keep the request when cash is insufficient so later income edits can fund it.
      contribution=unfunded===0?Math.min(requestedContribution,Math.max(0,cash)):0;
    }else if(net>0&&unfunded===0){contribution=Math.round(Math.min(net*p.investPercent/100,Math.max(0,cash-p.reserve)));}
    cash-=contribution;investments+=contribution;
    const contributionGap=requestedContribution===null?0:requestedContribution-contribution;
    const total=cash+investments;
    if(!Number.isSafeInteger(total)||total>Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(unfunded))throw Error('試算結果が大きすぎます。金額・利回り・期間を見直してください');
    rows.push({year:y,income,expense,net,gain,contribution,requestedContribution,contributionGap,withdrawal,cash,investments,total,shortfall,unfunded,reserveGap:Math.max(0,p.reserve-cash)});
  }
  return rows;
}
export function sampleState(){
  const p=newPlan();p.name='サンプル（架空の家計）';p.cash=3000000;p.investments=5000000;p.reserve=2000000;p.goal=30000000;
  const add=(kind,category,name,amount,frequency,start=p.startYear,end=p.endYear,growth=0)=>p.items.push({id:crypto.randomUUID(),kind,category,name,amount,frequency,start,end,growth,enabled:true});
  add('income','給与','世帯の手取り収入',6000000,'annual',p.startYear,p.startYear+24);
  add('income','年金','年金の手取り（仮定）',2400000,'annual',p.startYear+25);
  add('expense','基本生活費','食費・日用品など',120000,'monthly',p.startYear,p.endYear,1);
  add('expense','住居費','家賃',100000,'monthly');add('expense','教育費','教育費の積立ではなく実支出',400000,'annual',p.startYear+5,p.startYear+20);
  add('expense','自動車','買い替え',2000000,'once',p.startYear+8,p.startYear+8);
  return {version:1,revision:0,plans:[p]};
}
