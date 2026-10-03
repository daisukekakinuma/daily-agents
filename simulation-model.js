// Amounts are yen. Flows and transfers occur at year end, after investment returns.
export function newPlan(year = new Date().getFullYear()) {
  return {id:crypto.randomUUID(),name:'基本プラン',startYear:year,endYear:year+35,cash:0,investments:0,reserve:0,rate:3,investPercent:100,goal:0,items:[]};
}
export const emptyState=()=>({version:1,revision:0,plans:[newPlan()]});
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
    if(!Array.isArray(p.items)||p.items.length>500)throw Error('収支項目は500件までです');
    const itemIds=new Set();
    for(const i of p.items){
      if(typeof i.id!=='string'||!i.id||itemIds.has(i.id)||!['income','expense'].includes(i.kind)||typeof i.category!=='string'||!i.category.trim()||i.category.length>60||typeof i.name!=='string'||!i.name.trim()||i.name.length>80||typeof i.enabled!=='boolean')throw Error('項目の名前・分類を確認してください');itemIds.add(i.id);
      if(!money(i.amount)||!['monthly','annual','once'].includes(i.frequency)||!year(i.start)||!year(i.end)||i.end<i.start||!finite(i.growth,-100,100)||(i.frequency==='once'&&i.start!==i.end))throw Error('項目の金額・期間・増減率を確認してください');
    }
  }
  if(new TextEncoder().encode(JSON.stringify(s)).length>650000)throw Error('保存できる容量を超えています');
  return s;
}
export function annualAmount(item,year){
  if(!item.enabled||year<item.start||year>item.end)return 0;
  const n=item.amount*(item.frequency==='monthly'?12:1)*Math.pow(1+item.growth/100,year-item.start);
  if(!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER)throw Error('増減率または金額が大きすぎます');
  return Math.round(n);
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
    if(net>0&&unfunded===0){contribution=Math.round(Math.min(net*p.investPercent/100,Math.max(0,cash-p.reserve)));cash-=contribution;investments+=contribution;}
    const total=cash+investments;
    if(!Number.isSafeInteger(total)||total>Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(unfunded))throw Error('試算結果が大きすぎます。金額・利回り・期間を見直してください');
    rows.push({year:y,income,expense,net,gain,contribution,withdrawal,cash,investments,total,shortfall,unfunded,reserveGap:Math.max(0,p.reserve-cash)});
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
