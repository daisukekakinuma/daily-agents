// Annual household estimates. Official sources and simplifications are shown in the UI.
export const TAX_VERSION='2026-10-13';
export const TAX_COMPONENTS=[['income','所得税等','tax'],['resident','住民税・森林環境税','tax'],['health','健康保険','social'],['pension','厚生年金・国民年金','social'],['employment','雇用保険','social'],['care','介護保険','social'],['support','子ども・子育て支援金','social']];
const sum=a=>a.reduce((s,n)=>s+n,0),round=Math.round;
export function defaultTaxSettings(p,amount){
  const income=p.items.filter(i=>i.kind==='income'),family=p.family??[];
  const ids=[0,1].map(n=>income.find(i=>i.name===family[n]?.name)?.id??income.find(i=>n===0?/おいちゃん|夫|本人/.test(i.name):/まちゃん|妻|配偶者/.test(i.name))?.id??'');
  const wife=income.find(i=>i.id===ids[1]);let dependentFrom=null;
  if(wife)for(let y=p.startYear;y<=p.endYear;y++)if(amount(wife,y)>0&&amount(wife,y)<=1300000){dependentFrom=y;break;}
  return {version:1,enabled:false,healthRate:9.9,careRate:1.62,supportRate:.23,employmentRate:.5,region:'standard',insurer:'協会けんぽ・全国平均（仮定）',dependentFrom,people:ids.map(salaryId=>({salaryId,bonusPercent:0,bonusCount:2,employment:true,previousGross:null,previousSocial:null,otherIncome:0,extraIncomeDeduction:0,extraResidentDeduction:0})),years:{}};
}
export function validateTaxSettings(p){
  const c=p.taxSettings;if(c===undefined)return;
  if(c?.enabled&&p.startYear<2026)throw Error('税金の自動計算は2026年以降の試算に対応しています');
  const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e12,percent=x=>Number.isFinite(x)&&x>=0&&x<=100;
  if(!c||c.version!==1||typeof c.enabled!=='boolean'||!['standard','kumagaya'].includes(c.region)||typeof c.insurer!=='string'||c.insurer.length>80||![c.healthRate,c.careRate,c.supportRate,c.employmentRate].every(percent)||!(c.dependentFrom===null||Number.isInteger(c.dependentFrom)&&c.dependentFrom>=1900&&c.dependentFrom<=2200)||!Array.isArray(c.people)||c.people.length!==2)throw Error('税金・社会保険の設定を確認してください');
  for(const person of c.people){if(!person||typeof person.salaryId!=='string'||person.salaryId.length>100||!percent(person.bonusPercent)||![1,2,3].includes(person.bonusCount)||typeof person.employment!=='boolean'||![person.otherIncome,person.extraIncomeDeduction,person.extraResidentDeduction].every(money)||![person.previousGross,person.previousSocial].every(x=>x===null||money(x)))throw Error('夫婦の給与・控除設定を確認してください');}
  if(c.people[0].salaryId&&c.people[0].salaryId===c.people[1].salaryId)throw Error('夫婦に同じ給与行は指定できません');
  if(!c.years||typeof c.years!=='object'||Array.isArray(c.years)||Object.keys(c.years).length>301)throw Error('年別の税設定を確認してください');
  const allowed=new Set(TAX_COMPONENTS.flatMap(([k])=>[k+'0',k+'1']));
  for(const [y,v]of Object.entries(c.years)){
    if(!/^\d{4}$/.test(y)||+y<1900||+y>2200||!v||typeof v!=='object'||Array.isArray(v))throw Error('年別の税設定を確認してください');
    if(v.spouseMode!==undefined&&!['employee','dependent','manual','leave'].includes(v.spouseMode))throw Error('扶養設定を確認してください');
    if(v.selfMode!==undefined&&!['employee','manual','leave'].includes(v.selfMode))throw Error('加入設定を確認してください');
    if(v.childDependent!==undefined&&typeof v.childDependent!=='boolean')throw Error('子供の扶養設定を確認してください');
    if(v.values!==undefined&&(!v.values||typeof v.values!=='object'||Array.isArray(v.values)||Object.entries(v.values).some(([k,n])=>!allowed.has(k)||!money(n))))throw Error('内訳の手入力額を確認してください');
    for(const k of ['otherIncome0','otherIncome1','extraIncomeDeduction0','extraIncomeDeduction1','extraResidentDeduction0','extraResidentDeduction1'])if(v[k]!==undefined&&!money(v[k]))throw Error('年別の所得・控除額を確認してください');
  }
}
export function salaryIncome(gross,y){
  // NTA quick calculation, with the under-6.6m rounding bands.
  if(gross<=0)return 0;
  if(y>=2026&&y<=2027&&gross<2200000){if(gross<741000)return 0;if(gross<2191000)return gross-740000;if(gross<2193000)return 1451000;if(gross<2196000)return 1453000;return 1456000;}
  const floor= y>=2028?690000:y>=2025?650000:550000;
  if(gross<=1900000)return Math.max(0,gross-floor);
  if(gross<=3600000)return Math.max(0,Math.min(gross-floor,Math.floor(gross/4000)*4000*.7-80000));
  if(gross<=6600000)return Math.floor(gross/4000)*4000*.8-440000;
  if(gross<=8500000)return gross*.9-1100000;
  return gross-1950000;
}
export function basicDeduction(income,y){
  if(income>25000000)return 0;if(income>24500000)return 160000;if(income>24000000)return 320000;if(income>23500000)return 480000;
  if(y>=2028)return income<=1320000?990000:620000;
  if(y>=2026)return income<=4890000?1040000:income<=6550000?670000:620000;
  if(y>=2025)return income<=1320000?950000:income<=3360000?880000:income<=4890000?680000:income<=6550000?630000:580000;
  return 480000;
}
export function spouseDeduction(own,other,resident=false,age=0){
  if(own>10000000||other>1330000)return 0;
  const col=own<=9000000?0:own<=9500000?1:2;
  if(other<=620000&&age>=70)return (resident?[380000,260000,130000]:[480000,320000,160000])[col];
  const rows=resident?[[1000000,330000,220000,110000],[1050000,310000,210000,110000],[1100000,260000,180000,90000],[1150000,210000,140000,70000],[1200000,160000,110000,60000],[1250000,110000,80000,40000],[1300000,60000,40000,20000],[1330000,30000,20000,10000]]:[[950000,380000,260000,130000],[1000000,360000,240000,120000],[1050000,310000,210000,110000],[1100000,260000,180000,90000],[1150000,210000,140000,70000],[1200000,160000,110000,60000],[1250000,110000,80000,40000],[1300000,60000,40000,20000],[1330000,30000,20000,10000]];
  return rows.find(r=>other<=r[0])?.[col+1]??0;
}
export function nationalTax(taxable){
  const x=Math.floor(Math.max(0,taxable)/1000)*1000;
  const [,r,d]=[[1950000,.05,0],[3300000,.1,97500],[6950000,.2,427500],[9000000,.23,636000],[18000000,.33,1536000],[40000000,.4,2796000],[Infinity,.45,4796000]].find(([limit])=>x<=limit);
  return Math.floor(Math.max(0,x*r-d)*1.021/100)*100;
}
const healthGrades=[58000,68000,78000,88000,98000,104000,110000,118000,126000,134000,142000,150000,160000,170000,180000,190000,200000,220000,240000,260000,280000,300000,320000,340000,360000,380000,410000,440000,470000,500000,530000,560000,590000,620000,650000,680000,710000,750000,790000,830000,880000,930000,980000,1030000,1090000,1150000,1210000,1270000,1330000,1390000];
export const standardMonthly=(salary,grades=healthGrades)=>grades.find((g,i)=>i===grades.length-1||salary<(g+grades[i+1])/2);
function insurance(gross,age,person,c,mode,y,warnings,label){
  let health=0,pension=0,employment=0,care=0,support=0;
  if(mode==='manual'){warnings.push(`${label}：国保・国民年金などは内訳に手入力してください。`);return {health,pension,employment,care,support};}
  if(mode==='leave')return {health,pension,employment,care,support};
  if(person.employment)employment=round(gross*c.employmentRate/100);
  if(mode==='dependent')return {health,pension,employment,care,support};
  if(age===null)warnings.push(`${label}：生まれ年未設定。介護保険・加入年齢を反映できません。`);
  if(age>=65)warnings.push(`${label}：65歳以降の市区町村の介護保険料は内訳に手入力してください。`);
  if(age>=75){warnings.push(`${label}：後期高齢者医療の保険料を健康保険欄に手入力してください。`);return {health,pension,employment,care,support};}
  if(gross===0){warnings.push(`${label}：給与0円の年は保険料も0円で仮置き。休業・退職時の実額を確認してください。`);return {health,pension,employment,care,support};}
  const bonus=gross*person.bonusPercent/100,monthly=(gross-bonus)/12,standard=standardMonthly(monthly),bonusEach=Math.floor(bonus/person.bonusCount/1000)*1000;
  const healthBase=standard*12+Math.min(5730000,bonusEach*person.bonusCount);
  health=round(healthBase*c.healthRate/200);support=round(healthBase*c.supportRate/200);
  if(age!==null&&age>=40&&age<65)care=round(healthBase*c.careRate/200);
  if(age===null||age<70){
    let base=0;for(let m=1;m<=12;m++){
      const cap=y<2027?650000:y===2027?(m<9?650000:680000):y===2028?(m<9?680000:710000):y===2029?(m<9?710000:750000):750000;
      base+=standardMonthly(monthly,healthGrades.filter(g=>g>=88000&&g<=cap));
    }
    pension=round((base+Math.min(1500000,bonusEach)*person.bonusCount)*.183/2);
  }
  return {health,pension,employment,care,support};
}
export function taxProjection(p,amount){
  const c=p.taxSettings;if(!c?.enabled)return [];
  const names=[0,1].map(i=>p.family?.[i]?.name||['本人','配偶者'][i]);
  const source=c.people.map(person=>p.items.find(i=>i.id===person.salaryId&&i.kind==='income'));
  const rows=[],snapshots=new Map();
  for(let y=p.startYear-1;y<=p.endYear;y++){
    const yr=c.years[y]??{},warnings=[],initial=y<p.startYear;
    const gross=c.people.map((person,i)=>initial?(person.previousGross??(source[i]?amount(source[i],p.startYear):0)):(source[i]?amount(source[i],y):0));
    const ages=[0,1,2].map(i=>p.family?.[i]?.birthYear==null?null:y-p.family[i].birthYear);
    const child=yr.childDependent??(ages[2]!==null&&ages[2]>=0&&ages[2]<=22);
    const modes=[yr.selfMode??'employee',yr.spouseMode??(c.dependentFrom!==null&&y>=c.dependentFrom?'dependent':'employee')];
    const other=c.people.map((person,i)=>yr['otherIncome'+i]??person.otherIncome);
    const income=gross.map((g,i)=>Math.max(0,round(salaryIncome(g,y)-(child&&g>8500000?Math.min(g-8500000,1500000)*.1:0)))+other[i]);
    if(modes[1]==='dependent'){
      const limit=ages[1]!==null&&ages[1]>=60?1800000:1300000;
      if(gross[1]+other[1]>=limit)warnings.push(`${names[1]}：扶養を想定していますが、収入が${limit/10000}万円未満の条件を満たしません。保険料0円の仮定を見直してください。`);
      if(gross[1]+other[1]>=(gross[0]+other[0])/2)warnings.push(`${names[1]}：扶養者の収入の半分未満か確認してください。`);
      if(modes[0]!=='employee'||ages[0]>=65)warnings.push('扶養者の加入状況・65歳以降の第3号資格を確認し、必要な年金保険料を手入力してください。');
      warnings.push('扶養は年間収入だけでは確定しません。勤務時間・勤務先での加入義務を確認してください。');
    }
    const people=c.people.map((person,i)=>{
      if(!source[i])warnings.push(`${names[i]}：額面給与の行が未指定または削除されています。`);
      const values=insurance(gross[i],ages[i],person,c,modes[i],y,warnings,names[i]);
      for(const [key,,kind]of TAX_COMPONENTS)if(kind==='social'&&yr.values?.[key+i]!==undefined)values[key]=yr.values[key+i];
      return {...values,gross:gross[i],income:income[i],age:ages[i],mode:modes[i]};
    });
    let social=people.map(v=>sum(['health','pension','employment','care','support'].map(k=>v[k])));
    const socialRow=p.items.find(i=>i.autoTax==='social');
    const socialOverride=socialRow?.enabled?socialRow.annualValues?.[y]:undefined;
    if(socialOverride!==undefined){const all=sum(social);social=[round(socialOverride*(all?social[0]/all:.5)),0];social[1]=socialOverride-social[0];warnings.push('社会保険の合計を手入力しています。所得控除は自動内訳の比率で夫婦に配分します。個人別に指定する場合は合計を自動へ戻し、内訳を編集してください。');}
    if(socialRow&&!socialRow.enabled)social=[0,0];
    if(initial)social=social.map((n,i)=>c.people[i].previousSocial??n);
    const owner=income[0]>=income[1]?0:1;
    const spouse=people.map((_,i)=>i===owner?spouseDeduction(income[i],income[1-i],false,ages[1-i]):0);
    const spouseResident=people.map((_,i)=>i===owner?spouseDeduction(income[i],income[1-i],true,ages[1-i]):0);
    const threshold=y>=2026?620000:580000;
    const counts=people.map((_,i)=>i===owner?Number(income[1-i]<=threshold)+Number(child):0);
    for(let i=0;i<2;i++){
      const extra=yr['extraIncomeDeduction'+i]??c.people[i].extraIncomeDeduction;
      const childDed=child&&i===owner&&ages[2]>=16?(ages[2]<=18?380000:ages[2]<=22?630000:0):0;
      people[i].incomeTaxable=Math.max(0,income[i]-basicDeduction(income[i],y)-social[i]-spouse[i]-childDed-extra);
      people[i].income=nationalTax(people[i].incomeTaxable);
      if(yr.values?.['income'+i]!==undefined)people[i].income=yr.values['income'+i];
      // Resident tax uses the same year's earned income snapshot, assessed in the next year.
      const resBasic=income[i]<=24000000?430000:income[i]<=24500000?290000:income[i]<=25000000?150000:0;
      const childRes=child&&i===owner&&ages[2]>=16?(ages[2]<=18?330000:ages[2]<=22?450000:0):0;
      const taxable=Math.floor(Math.max(0,income[i]-resBasic-social[i]-spouseResident[i]-childRes-(yr['extraResidentDeduction'+i]??c.people[i].extraResidentDeduction))/1000)*1000;
      const count=counts[i],nonTaxFlat=count?(c.region==='kumagaya'?315000*(count+1)+289000:350000*(count+1)+310000):(c.region==='kumagaya'?415000:450000);
      const nonTaxIncome=count?350000*(count+1)+420000:450000;
      // Statutory personal deduction differences use the pre-reform 50,000-yen basic difference.
      const difference=50000+Math.max(0,spouse[i]-spouseResident[i])+childDed-childRes;
      const adjustment=income[i]>25000000?0:taxable<=2000000?Math.min(difference,taxable)*.05:Math.max(50000,difference-(taxable-2000000))*.05;
      people[i].residentAssessed=(income[i]<=nonTaxIncome?0:Math.floor(Math.max(0,taxable*.1-adjustment)/100)*100)+(income[i]<=nonTaxFlat?0:5000);
      const previous=snapshots.get(y-1);
      people[i].resident=previous?.people[i].residentAssessed??0;
      if(yr.values?.['resident'+i]!==undefined)people[i].resident=yr.values['resident'+i];
      people[i].socialDeduction=social[i];
      people[i].spouseDeduction=spouse[i];
    }
    const tax=sum(people.map(v=>v.income+v.resident));
    const result={year:y,people,tax,social:sum(social),warnings:[...new Set(warnings)],childDependent:child};
    snapshots.set(y,result);if(!initial)rows.push(result);
  }
  return rows;
}
