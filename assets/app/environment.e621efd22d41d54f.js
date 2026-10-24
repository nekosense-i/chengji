/* Development boundary. Runs before every original script. Never use with production data. */
(() => {
 'use strict';
 const prefix = 'gk2_migration_v1:';
 const blocked = [];
 const nativeLocal = window.localStorage, nativeSession = window.sessionStorage;
 function isolated(storage) {
  return Object.freeze({
   getItem(key) { if (key === 'gakuten_cloud_sync_disabled') return '1'; return storage.getItem(prefix + key); },
   setItem(key,value) { storage.setItem(prefix + key, key === 'gakuten_cloud_sync_disabled' ? '1' : String(value)); },
   removeItem(key) { if (key !== 'gakuten_cloud_sync_disabled') storage.removeItem(prefix + key); },
   clear() { for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key); },
   key(i) { return Object.keys(storage).filter(k=>k.startsWith(prefix))[i]?.slice(prefix.length) ?? null; },
   get length() { return Object.keys(storage).filter(k=>k.startsWith(prefix)).length; }
  });
 }
 Object.defineProperty(window,'localStorage',{value:isolated(nativeLocal), configurable:false, writable:false});
 Object.defineProperty(window,'sessionStorage',{value:isolated(nativeSession), configurable:false, writable:false});
 function deny(channel,method='CONNECT') {
  blocked.push({channel,method,time:Date.now()});
  window.dispatchEvent(new Event('gk2-network-blocked'));
  throw new DOMException('Gakuten 2.0 隔离预览：网络请求已阻断','SecurityError');
 }
 const nativeFetch=window.fetch.bind(window);
 window.fetch = async (input,options={}) => {
  const url=typeof input==='string'?input:input?.url;
  if(window.gk2TestTransportActive===true&&(window.gk2CloudTarget?url===window.gk2CloudTarget.endpoint:/^http:\/\/127\.0\.0\.1:8976\/api\/gakuten-v2(?:\?|$)/.test(url||'')))return nativeFetch(input,{...options,redirect:'error',credentials:'omit'});
  return deny('fetch',options.method || input?.method || 'GET');
 };
 XMLHttpRequest.prototype.open = function(method) { deny('xhr',method); };
 navigator.sendBeacon = () => { try { deny('beacon','POST'); } catch {} return false; };
 window.WebSocket = class { constructor() { deny('websocket'); } };
 window.EventSource = class { constructor() { deny('eventsource'); } };
 Object.defineProperty(window,'gk2Safety',{value:Object.freeze({isolated:true,prefix,blocked})});
})();

;
/* Offline migration only. No network and no production storage keys. */
(() => {
 'use strict';
 const M=window.gk2Migration={},clone=v=>JSON.parse(JSON.stringify(v));
 M.key='gakuten_migration_slot'; M.format='gakuten-offline-slot/1';
 M.encode=value=>{const raw=JSON.stringify(value),z=window.LZString?.compressToUTF16(raw);return z&&z.length+6<raw.length?'gk2lz:'+z:raw;};
 M.decode=raw=>JSON.parse(raw.startsWith('gk2lz:')?window.LZString?.decompressFromUTF16(raw.slice(6)):raw);
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const stamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 M.stage=function(raw){
  const errors=[],warnings=[],add=(p,m)=>errors.push(`${p}：${m}`),warn=(p,m)=>warnings.push(`${p}：${m}`);
  let source;try{if(typeof raw!=='string'||raw.length>20*1024*1024)throw Error();source=JSON.parse(raw);}catch{ return{errors:['文件不是有效 JSON，或大于 20MB。'],warnings}; }
  const fromBundle=source?.format===M.format;
  if(fromBundle){if(!plain(source.state))return{errors:['离线回滚包缺少 state'],warnings};source=source.state;warn('回滚包','导入包内当前副本；包内历史版本仍保存在原文件中');}
  let scanned=0;
  function scan(v,p,depth=0){
   if(++scanned>2000000||depth>40)throw Error('结构过大或嵌套过深');
   if(typeof v==='string'&&/[<>]/.test(v))add(p,'包含 HTML 标记字符，需检查原始内容后再导入，系统不会擅自删除。');
   if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))add(p,'包含不安全字段名');else scan(v[k],p+'.'+k,depth+1);}
  }
  try{scan(source,'快照');}catch(e){add('快照',e.message);}
  if(!plain(source)||!plain(source.data)){add('快照','需要包含 data 的 1.0 备份或云端响应对象');return{errors,warnings};}
  if(source.ts!==undefined&&!stamp(source.ts))add('ts','云端版本时间戳无效');
  const data=source.data;
  for(const k of ['students','exams','scores'])if(!Array.isArray(data[k]))add('data.'+k,'必须为数组');
  if(data.examTemplates!==undefined&&!Array.isArray(data.examTemplates))add('data.examTemplates','必须为数组');
  if(errors.length)return{errors,warnings};
  const state=clone(source),d=state.data;d.examTemplates??=[];
  const students=new Map(),exams=new Map(),pairs=new Set(),names=new Map(),scoreMap=new Map();
  function id(v,p,map){if(!text(v)||! /^[A-Za-z0-9_-]+$/.test(v)){add(p,'ID 必须为字母、数字、下划线或连字符组成的非空字符串');return;}if(map.has(v))add(p,'ID 重复');else map.set(v,true);if(v.startsWith('demo-'))add(p,'包含演示记录 ID，禁止混入数据副本');}
  function ts(record,p){if(record._ts!==undefined&&!stamp(record._ts))add(p+'._ts','时间戳无效');if(record._fieldTs!==undefined){if(!plain(record._fieldTs))add(p+'._fieldTs','必须为对象');else for(const [k,v]of Object.entries(record._fieldTs))if(!stamp(v))add(p+'._fieldTs.'+k,'时间戳无效');}}
  d.students.forEach((s,i)=>{
   const p=`学生[${i+1}]`;if(!plain(s)){add(p,'必须为对象');return;}id(s.id,p,students);ts(s,p);
   for(const k of ['name','campus','grade'])if(!text(s[k]))add(p+'.'+k,'不能为空');
   if(['未设校区','默认校区','未分配校区'].includes(s.campus)||['未设年级','未分配年级'].includes(s.grade))add(p,'存在未设校区或年级；保留原文件，请先核对，不自动剔除');
   if(!text(s.teachingClass)&&text(s.class)){s.teachingClass=s.class;warn(p,'旧 class 字段映射为 teachingClass，原 class 字段保留');}
   if(!text(s.teachingClass))add(p+'.teachingClass','缺少日语班');
   s.adminClass??='-';
   if(typeof s.adminClass!=='string')add(p+'.adminClass','必须为文本');
   if(s.tags!==undefined&&(!Array.isArray(s.tags)||s.tags.some(t=>typeof t!=='string')))add(p+'.tags','必须为文本数组');
   if(s.classHistory===undefined||Array.isArray(s.classHistory)&&!s.classHistory.length){s.classHistory=[{campus:s.campus,teachingClass:s.teachingClass,from:'2000-01-01',to:null}];warn(p,'无历史班级，按当前班级补默认历史，请核对历史考试归属');}
   if(!Array.isArray(s.classHistory))add(p+'.classHistory','必须为数组');
   else s.classHistory.forEach((h,j)=>{if(!plain(h)||!text(h.campus)||!text(h.teachingClass)||!date(h.from)||(h.to!=null&&(!date(h.to)||h.to<h.from)))add(p+`.classHistory[${j+1}]`,'历史班级或起止日期无效');});
   if(Array.isArray(s.classHistory))s.classHistory.forEach((h,j)=>{const previous=s.classHistory[j-1];if(j&&plain(h)&&plain(previous)&&(h.from<=previous.from||previous.to==null||previous.to>h.from))add(p+'.classHistory','历史记录未按时间排序或区间重叠，请核对');});
   if(students.has(s.id))students.set(s.id,s);
  });
  d.exams.forEach((e,i)=>{
   const p=`考试[${i+1}]`;if(!plain(e)){add(p,'必须为对象');return;}id(e.id,p,exams);ts(e,p);
   if(!text(e.name)||!text(e.grade)||!date(e.date))add(p,'考试名、年级或日期无效');
   if(e.entryMode!==undefined&&!['score','count'].includes(e.entryMode))add(p+'.entryMode','录入方式无效');
   if(!Array.isArray(e.campuses)){if(text(e.campus)){e.campuses=[e.campus];warn(p,'旧 campus 映射为 campuses，原字段保留');}else if(e.campuses===undefined){e.campuses=[];warn(p,'未限定校区，按原系统全部校区处理');}else add(p+'.campuses','必须为数组');}
   if(Array.isArray(e.campuses)&&e.campuses.some(c=>!text(c)))add(p+'.campuses','校区名称无效');
   const types=new Set();let max=0;
   if(!Array.isArray(e.types)||!e.types.length)add(p+'.types','至少需要一个题型');
   else e.types.forEach(t=>{if(!plain(t)||!text(t.name)||types.has(t.name)||typeof t.max!=='number'||!Number.isFinite(t.max)||t.max<=0)add(p+'.types','题型名称重复或满分无效');else{types.add(t.name);max+=t.max;if(t.questionCount!==undefined&&(!Number.isInteger(t.questionCount)||t.questionCount<=0))add(p+'.types.'+t.name,'题数必须为正整数');if(t.manualScore!==undefined&&typeof t.manualScore!=='boolean')add(p+'.types.'+t.name,'手动录分标记无效');}});
   if(typeof e.maxTotal!=='number'||!Number.isFinite(e.maxTotal)||e.maxTotal<=0)add(p+'.maxTotal','整卷满分无效');else if(Math.abs(max-e.maxTotal)>.001)warn(p+'.maxTotal','整卷满分与题型合计不同，按原配置保留');
   const key=JSON.stringify([e.grade,e.name]);if(names.has(key))warn(p,`与 ${names.get(key)} 同年级同名，将按 ID 分别保留，不自动合并`);else names.set(key,e.id);
   if(exams.has(e.id))exams.set(e.id,e);
  });
  if(errors.length)return{errors,warnings};
  d.scores.forEach((s,i)=>{
   const p=`成绩[${i+1}]`;if(!plain(s)){add(p,'必须为对象');return;}ts(s,p);
   const student=students.get(s.studentId),exam=exams.get(s.examId),key=`${s.studentId}_${s.examId}`;
   if(!student||!exam||typeof student!=='object'||typeof exam!=='object'){add(p,'学生或考试引用不存在');return;}
   if(pairs.has(key))add(p,'学生/考试成绩键重复或键冲突');pairs.add(key);scoreMap.set(key,s);
   if(student.grade!==exam.grade)warn(p,'学生当前年级与考试年级不同，请核对历史记录');
   if(!plain(s.details)){add(p+'.details','必须为对象');return;}
   if(s.questionCounts!==undefined&&!plain(s.questionCounts))add(p+'.questionCounts','必须为对象');
   if(s.absences!==undefined){if(!plain(s.absences))add(p+'.absences','旧缺考字段无效');else if(Object.values(s.absences).some(Boolean))warn(p+'.absences','保留旧题型缺考状态，不自动转换或清空成绩');}
   if((s.examAbsent!==undefined&&typeof s.examAbsent!=='boolean')||(s.isEstimated!==undefined&&typeof s.isEstimated!=='boolean'))add(p,'缺考/预估标志无效');
   let total=0,entered=0;const typeMap=new Map((exam.types||[]).filter(plain).map(t=>[t.name,t.max]));
   const typeMetaMap=new Map((exam.types||[]).filter(plain).map(t=>[t.name,t]));
   if(plain(s.questionCounts))for(const [name,count]of Object.entries(s.questionCounts)){const type=typeMetaMap.get(name);if(!Number.isInteger(count)||count<0)add(p+'.questionCounts.'+name,'正确题数必须为非负整数');else if(!type)warn(p+'.questionCounts.'+name,'题型已不存在，原题数保留');else if(Number.isInteger(type.questionCount)&&count>type.questionCount)warn(p+'.questionCounts.'+name,`正确题数 ${count} 超过模板题数 ${type.questionCount}，原值保留`);}
   let comparable=true;
   for(const [k,v]of Object.entries(s.details)){
    if(v==null||v==='')continue;
    if(typeof v!=='number'||!Number.isFinite(v)){comparable=false;add(p+'.'+k,`成绩不是有效数值（当前值：${String(v)}）；考试：${exam.name} · ${exam.date}`);continue;}
    // Sum every numeric value, including out-of-range fields, so a range error does not fabricate a second total mismatch.
    total+=v;entered++;
    if(!typeMap.has(k)){warn(p+'.'+k,`题型不属于对应考试，按原字段保留；考试：${exam.name} · ${exam.date}`);continue;}
    if(v<0||v>typeMap.get(k))warn(p+'.'+k,`当前 ${v} 分，题型满分 ${typeMap.get(k)} 分，超出名义范围 0–${typeMap.get(k)}，可能为合并录入，原分数保留；考试：${exam.name} · ${exam.date}`);
   }
   if(typeof s.total!=='number'||!Number.isFinite(s.total))add(p+'.total',`总分 ${String(s.total)} 无效或超出整卷满分 ${exam.maxTotal}；考试：${exam.name} · ${exam.date}`);
   else if(s.total<0||s.total>exam.maxTotal)warn(p+'.total',`记录总分 ${s.total} 超出名义整卷范围，按原值保留；考试：${exam.name} · ${exam.date}`);
   if(typeof s.total==='number'&&comparable&&Math.abs(total-s.total)>.11)warn(p+'.total',`记录总分 ${s.total} 与题型实际合计 ${Number(total.toFixed(4))} 不一致，可能为总分或合并录入，均按原值保留；考试：${exam.name} · ${exam.date}`);
   if(s.examAbsent&&(entered>0||s.total!==0))warn(p,'缺考标志与已有成绩并存，按原值保留，不清空');
   if(s.estimatedTotal!==undefined){if(typeof s.estimatedTotal!=='number'||!Number.isFinite(s.estimatedTotal))add(p+'.estimatedTotal','预估总分不是数值');else if(s.estimatedTotal<0||s.estimatedTotal>exam.maxTotal)warn(p+'.estimatedTotal','预估总分超出名义范围，按原值保留');}
   if(!s.examAbsent&&entered<exam.types?.length)warn(p,'部分录入/未录入，沿用原版统计口径');
   if(!s.examAbsent&&entered&&s.total===0)warn(p,'有效零分已保留，但部分原版总体统计不纳入零分');
  });
  const templates=new Map();d.examTemplates.forEach((t,i)=>{const p=`模板[${i+1}]`;if(!plain(t)){add(p,'必须为对象');return;}id(t.id,p,templates);ts(t,p);if(!text(t.name)||!Array.isArray(t.types)||!t.types.length)add(p,'模板名称或题型无效');else{const names=new Set();t.types.forEach(x=>{if(!plain(x)||!text(x.name)||names.has(x.name)||typeof x.max!=='number'||!Number.isFinite(x.max)||x.max<=0)add(p,'题型无效或重复');else{names.add(x.name);if(x.questionCount!==undefined&&(!Number.isInteger(x.questionCount)||x.questionCount<=0))add(p+'.types.'+x.name,'题数必须为正整数');if(x.manualScore!==undefined&&typeof x.manualScore!=='boolean')add(p+'.types.'+x.name,'手动录分标记无效');}});}});
  state.deleted??=clone(d.__deleted||{students:{},exams:{},scores:{}});
  if(!plain(state.deleted))add('deleted','必须为对象');else for(const k of ['students','exams','scores']){state.deleted[k]??={};if(!plain(state.deleted[k]))add('deleted.'+k,'必须为对象');else for(const [id,v]of Object.entries(state.deleted[k])){if(!stamp(v))add('deleted.'+k+'.'+id,'删除时间戳无效');const record=k==='students'?students.get(id):k==='exams'?exams.get(id):scoreMap.get(id);if(record&&(v>=(record._ts||0)))add('deleted.'+k+'.'+id,'墓碑与现存记录冲突，需核对后导入');}}
  if(d.__deleted&&JSON.stringify(d.__deleted)!==JSON.stringify(state.deleted))add('data.__deleted','与顶层删除墓碑不同，请先核对');
  state.syncMeta??={};if(!plain(state.syncMeta))add('syncMeta','必须为对象');else for(const k of ['lastCloudTs','lastPulledAt','lastPushedAt','last_synced_at'])if(state.syncMeta[k]!==undefined&&!stamp(state.syncMeta[k]))add('syncMeta.'+k,'同步时间戳无效');
  const focus={campuses:[],grades:[],phases:[],tClasses:[],tags:[]};state.globalFocus??=focus;
  if(!plain(state.globalFocus))add('globalFocus','必须为对象');else for(const k of Object.keys(focus)){state.globalFocus[k]??=[];if(!Array.isArray(state.globalFocus[k])||state.globalFocus[k].some(x=>typeof x!=='string'))add('globalFocus.'+k,'必须为字符串数组');}
  state.trendPhases??=[];state.currentTrendPredictSeries??=[];
  if(!Array.isArray(state.trendPhases)||!Array.isArray(state.currentTrendPredictSeries))add('趋势状态','必须为数组');
  if(state.currentExamId&&!exams.has(state.currentExamId)){warn('当前考试','原考试不存在，使用最新日期考试');state.currentExamId=null;}
  state.currentExamId??=[...d.exams].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]?.id||'';
  state.currentAnalysisType='overview';state.currentView='analysis';
  return{errors,warnings,state,summary:{students:d.students.length,exams:d.exams.length,scores:d.scores.length,templates:d.examTemplates.length},sourceKind:fromBundle?'2.0 离线副本':source.globalFocus?'1.0 本机备份':'1.0 云端快照'};
 };
 M.read=function(storage){const raw=storage.getItem(M.key);if(!raw)return null;let slot;try{slot=M.decode(raw);}catch{throw Error('离线副本损坏，已保留原内容；请返回试导入入口恢复');}if(slot?.format!==M.format||!plain(slot.state))throw Error('离线副本格式无效，原内容未被覆盖');return slot;};
 M.commit=function(storage,raw,expected,sourceRaw=raw){
  const staged=M.stage(raw);if(staged.errors.length)throw Error('校验未通过，禁止写入');
  const current=storage.getItem(M.key);if(current!==expected)throw Error('数据副本已在其他页面变化，请重新预览');
  // One atomic localStorage cell holds current, rollback and the exact source. Quota failure leaves the old cell intact.
  let previous=null,previousDamagedRaw=null;
  if(current){try{const old=M.read(storage),check=M.stage(JSON.stringify(old.state));if(check.errors.length)previousDamagedRaw=current;else previous=old.state;}catch{previousDamagedRaw=current;}}
  const slot={format:M.format,importedAt:new Date().toISOString(),sourceRaw,state:staged.state,previous,...(previousDamagedRaw!==null?{previousDamagedRaw}:{})};
  const encoded=M.encode(slot);storage.setItem(M.key,encoded);
  if(storage.getItem(M.key)!==encoded)throw Error('写入回读不一致，请重新打开入口检查，不进入分析页');
  return slot;
 };
 M.rollback=function(storage,expected){const current=storage.getItem(M.key);if(current!==expected)throw Error('副本已变化，请重新打开入口');const slot=M.read(storage);if(!slot?.previous)throw Error('没有上一份副本');const next={...slot,state:slot.previous,previous:slot.state};storage.setItem(M.key,M.encode(next));return next;};
 M.clear=function(storage,expected){
  const current=storage.getItem(M.key);if(current!==expected)throw Error('副本已在其他页面变化，请重新加载');
  const slot=M.read(storage);if(!slot)throw Error('没有可清空的数据副本');
  const state={data:{students:[],exams:[],scores:[],examTemplates:[]},deleted:{students:{},exams:{},scores:{},examTemplates:{}},syncMeta:{},globalFocus:{campuses:[],grades:[],phases:[],tClasses:[],tags:[]},currentExamId:'',currentAnalysisType:'overview',currentView:'analysis',trendPhases:[],currentTrendPredictSeries:[]};
  const encoded=M.encode({...slot,state,previous:clone(slot.state)});storage.setItem(M.key,encoded);
  if(storage.getItem(M.key)!==encoded)throw Error('清空后的回读不一致，请重新加载检查');
 };
 M.loadStore=function(store){
  const slot=M.read(localStorage);if(!slot)throw Error('尚未导入，请先打开数据试导入入口');
  const staged=M.stage(JSON.stringify(slot.state));if(staged.errors.length)throw Error('离线副本校验失败，原内容保留；请回到导入入口查看');
  store.state=staged.state;store.rebuildScoreIndex();store._migrationRaw=localStorage.getItem(M.key);
 };
 M.persistStore=function(store){
  const current=localStorage.getItem(M.key);if(current!==store._migrationRaw){window.alert?.('副本已被其他页面修改，本页不能继续保存。请先返回迁移入口，再重新进入。');throw Error('副本已被其他页面修改，请先重新加载');}
  const slot=M.read(localStorage),next=M.encode({...slot,state:store.state});
  try{localStorage.setItem(M.key,next);store._migrationRaw=next;}
  catch(error){store.hasUnsavedChanges=true;window.alert?.('本机保存失败，当前修改仍保留在页面中，尚未写入本机。请先导出备份并检查浏览器空间，暂勿关闭或刷新。');throw error;}
 };
})();

;
