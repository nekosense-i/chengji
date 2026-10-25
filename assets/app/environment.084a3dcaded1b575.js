/* Confirmed 2026-10-25. Shared read-only policy.
 * No storage writes, transport calls or prototype overrides. */
(function(root) {
 'use strict';
 const POLICY_ID = 'complete-actual-v1';
 const PASS_RATE = .6, EXCELLENT_RATE = .8, TOTAL_TOLERANCE = .11;
 const numeric = value => typeof value === 'number' && Number.isFinite(value);
 const own = (value,key) => Object.prototype.hasOwnProperty.call(value || {},key);
 const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
 function explainIssue(code) {
  const [kind,...parts]=code.split(':'),field=parts.join(':');
  const labels={
   'invalid-type':'题型分值无效','invalid-count':'正确题数无效','invalid-total':'存储总分无效',
   'above-type-maximum':'题型超过名义满分，保留原值','above-total-maximum':'总分超过名义满分，保留原值',
   'total-detail-mismatch':'存储总分与当前模板有效题型合计不一致，保留原值',
   'unknown-type':'历史题型不属于当前考试模板，保留原字段','absent-with-values':'缺考标记与已录分值并存，保留原值'
  };
  return (field?field+'：':'')+(labels[kind]||code);
 }

 /** Read a recorded type value. Count mode uses the existing rounded score
  * in details and requires a valid corresponding count. Never recalculates it.
  * @returns {{valid:boolean,value:number|null,issues:string[]}} */
 function typeValue(record, exam, type) {
  const value = record?.details?.[type.name], issues = [];
  if (!numeric(value) || value < 0 || !numeric(type.max) || type.max <= 0) {
   return {valid:false,value:null,issues:own(record?.details,type.name)?['invalid-type:'+type.name]:[]};
  }
  if (value > type.max) issues.push('above-type-maximum:'+type.name);
  if (exam.entryMode === 'count' && !type.manualScore && Number.isInteger(type.questionCount) && type.questionCount > 0) {
   const count = record?.questionCounts?.[type.name];
   if (!Number.isInteger(count) || count < 0 || count > type.questionCount) issues.push('invalid-count:'+type.name);
  }
  const valid=!issues.some(issue=>issue.startsWith('invalid-'));
  return {valid,value:valid?value:null,issues};
 }

 /** Classify without rewriting stored totals or flags. A mismatch is evidence,
  * not permission to silently correct a historical record.
  * @returns {{state:string,included:boolean,total:number|null,issues:string[],types:Object}} */
 function inspect(record, exam) {
  const types = Object.create(null), issues = [];
  for (const type of exam.types || []) {
   types[type.name] = typeValue(record,exam,type);
   issues.push(...types[type.name].issues);
  }
  const total = numeric(record?.total) ? record.total : null;
  const validTypes = Object.values(types).filter(t=>t.valid);
  const detailTotal = validTypes.length ? validTypes.reduce((sum,t)=>sum+t.value,0) : null;
  const allTypes = (exam.types || []).length > 0 && validTypes.length === exam.types.length;
  if (record && (total === null || total < 0 || !numeric(exam.maxTotal) || exam.maxTotal <= 0)) issues.push('invalid-total');
  if (record && total > exam.maxTotal) issues.push('above-total-maximum');
  if (record && allTypes && total !== null && Math.abs(detailTotal-total)>TOTAL_TOLERANCE) issues.push('total-detail-mismatch');
  for (const name of Object.keys(record?.details || {})) if (!own(types,name)) issues.push('unknown-type:'+name);
  let state;
  if (record?.examAbsent === true) state='absent';
  else if (record?.isEstimated === true) state='estimated';
  else if (!record) state='missing';
  else if (issues.some(x=>x.startsWith('invalid-'))) state='invalid';
  else if (allTypes) state='complete';
  else if (validTypes.length) state='partial';
  else if (total > 0) state='historical-total-only';
  else state='missing';
  if (record?.examAbsent && (validTypes.length || total)) issues.push('absent-with-values');
  return {state,included:state==='complete',total,detailTotal,issues,types};
 }

 /** All rows must already belong to ONE exam and the authorized filtered roster.
  * Each row is {studentId, record}; missing records must be supplied explicitly.
  * Duplicate IDs fail closed so the denominator cannot silently grow.
  * Competition ranks: 1,1,3; empty aggregates return null, counts return zero. */
 function summarize(rows, exam) {
  const ids = new Set();
  const classified = rows.map(row=>{
   if (!row.studentId || ids.has(row.studentId)) throw Error('Duplicate or missing student ID');
   ids.add(row.studentId);
   if (row.record && (row.record.studentId !== row.studentId || row.record.examId !== exam.id)) throw Error('Score association does not match roster/exam');
   return {...row,...inspect(row.record,exam)};
  });
  const valid = classified.filter(row=>row.included), targets = valid.filter(row=>numeric(row.record.estimatedTotal)&&row.record.estimatedTotal>0);
  const average = mean(valid.map(row=>row.total));
  const ordered = [...valid].sort((a,b)=>b.total-a.total||String(a.studentId).localeCompare(String(b.studentId)));
  let rank=0;
  const ranks = ordered.map((row,index)=>{if (!index || row.total!==ordered[index-1].total) rank=index+1;return {studentId:row.studentId,total:row.total,rank};});
  const statuses = {};
  for (const row of classified) statuses[row.state]=(statuses[row.state]||0)+1;
  return {
   policy:POLICY_ID, examId:exam.id, roster:rows.length, valid:valid.length,
   average, scoreRate:average!==null&&exam.maxTotal>0?average/exam.maxTotal*100:null,
   passCount:valid.filter(row=>row.total>=exam.maxTotal*PASS_RATE).length,
   excellentCount:valid.filter(row=>row.total>=exam.maxTotal*EXCELLENT_RATE).length,
   passRate:valid.length?valid.filter(row=>row.total>=exam.maxTotal*PASS_RATE).length/valid.length*100:null,
   excellentRate:valid.length?valid.filter(row=>row.total>=exam.maxTotal*EXCELLENT_RATE).length/valid.length*100:null,
   targetCount:targets.length,targetAchieved:targets.filter(row=>row.total>=row.record.estimatedTotal).length,
   statuses,ranks,
   types:(exam.types||[]).map(type=>{
    const values=classified.filter(row=>!['absent','estimated'].includes(row.state)&&row.types[type.name].valid).map(row=>row.types[type.name].value);
    const average=mean(values);
    return {name:type.name,count:values.length,average,scoreRate:average!==null&&type.max>0?average/type.max*100:null};
   }),
   evidence:classified.map(row=>({studentId:row.studentId,state:row.state,included:row.included,storedTotal:row.total,detailTotal:row.detailTotal,issues:row.issues}))
  };
 }
 const api=Object.freeze({POLICY_ID,PASS_RATE,EXCELLENT_RATE,TOTAL_TOLERANCE,typeValue,inspect,summarize,explainIssue});
 root.gk2Statistics=api;
 if (typeof module==='object' && module.exports) module.exports=api;
})(globalThis);

/* Runs in head, before any legacy markup can paint. Does not change layout dimensions. */
(() => {
 const root=document.documentElement;root.classList.add('gk2-starting');
 let stopped=false,failed=false,timer,reason='',mutedError=false;
 const fail=detail=>{
  if(typeof detail==='string'&&detail)reason=detail;
  if(stopped)return;failed=true;clearTimeout(timer);
  const show=()=>{const box=document.getElementById('gk2-startup');if(!box)return;box.setAttribute('role','alert');box.querySelector('p').textContent='页面初始化未完成，请重新载入。已保存的本机数据不会被清除。';if(reason){let details=document.getElementById('gk2-startup-reason');if(!details){details=document.createElement('pre');details.id='gk2-startup-reason';details.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-width:720px;margin:16px auto;font-size:14px;line-height:1.6;text-align:left';box.appendChild(details);}details.textContent=reason;}box.querySelector('button').hidden=false;};
  if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true});
 };
 const onError=e=>{
  if(e.target===window){
   // Safari can report an opaque cross-origin/injected script error without a
   // filename or Error object. It is not evidence that the app failed to boot.
   // Keep the readiness check and timeout active instead of latching failure.
   if(!e.filename&&!e.error&&/^script error\.?$/i.test(String(e.message||'').trim())){mutedError=true;return;}
   if(e.filename){try{if(new URL(e.filename,document.baseURI).origin!==location.origin)return;}catch{}}
   let source='';
   if(e.filename){try{source=new URL(e.filename,document.baseURI).pathname;}catch{source=e.filename;}}
   fail((e.message||'启动脚本执行失败')+(source?'\n'+source+(e.lineno?':'+e.lineno:'')+(e.colno?':'+e.colno:''):''));
  }else if(e.target?.tagName==='SCRIPT'||(e.target?.tagName==='LINK'&&e.target.rel==='stylesheet')){
   let url;try{url=new URL(e.target.src||e.target.href,document.baseURI);}catch{return;}
   // Cloudflare Pages may inject its external analytics beacon. Its CSP/network
   // failure is unrelated to the app and must not keep the startup cover open.
   if(url.origin!==location.origin)return;
   const name=url.pathname.split('/').pop();
   fail((e.target.tagName==='LINK'?'样式':'脚本')+'未能加载：'+name+'。请保留 HTML 与完整 assets 文件夹在同一目录。');
  }
 };
 window.addEventListener('error',onError,true);
 timer=setTimeout(()=>fail(mutedError?'启动超时；浏览器曾报告 Script error.，但未提供脚本来源。':'页面启动超时，请检查网络后重新载入。'),20000);
 window.gk2Startup={
  fail,
  finish(){if(stopped||failed)return;stopped=true;clearTimeout(timer);window.removeEventListener('error',onError,true);root.classList.remove('gk2-starting');document.getElementById('gk2-startup')?.remove();}
 };
})();

/* Optional libraries and feature bundles. Classic scripts support file:// previews. */
(() => {
 'use strict';
 const definitions = {
  xlsx: { path: 'assets/xlsx.full.min.js', ready: () => !!window.XLSX?.utils, label: 'Excel' },
  capture: { path: 'assets/html2canvas.min.js', ready: () => typeof window.html2canvas === 'function', label: '报告导出' },
  pinyin: { path: 'assets/pinyin-pro.js', ready: () => typeof window.pinyinPro?.pinyin === 'function', label: '拼音搜索' },
  comparison: { bundle: true, ready: () => !!window.gk2Comparison && !!document.querySelector('[data-gk2-loaded-style="comparison"]'), label: 'A/B 对比' },
  migration: { bundle: true, ready: () => !!window.__gk2MigrationEntryReady, label: '数据恢复' }
 };
 const pending = new Map();
 let notification;

 function loadStylesheet(name) {
  const marker = document.querySelector(`[data-gk2-lazy-css="${name}"]`);
  if (!marker) return Promise.resolve();
  const path = marker.dataset.href;
  if (!path) return Promise.reject(new Error(name + '样式路径缺失'));
  const loaded = document.querySelector(`[data-gk2-loaded-style="${name}"]`);
  if (loaded?.sheet) return Promise.resolve();
  return new Promise((resolve, reject) => {
   const link = document.createElement('link');
   link.rel = 'stylesheet';
   link.href = new URL(path, document.baseURI).href;
   link.dataset.gk2LoadedStyle = name;
   link.onload = () => { link.onload = link.onerror = null; resolve(); };
   link.onerror = () => { link.onload = link.onerror = null; link.remove(); reject(new Error(name + '样式未能加载')); };
   document.head.appendChild(link);
  });
 }

 function loadScript(path, name, ready, label) {
  return new Promise((resolve, reject) => {
   const script = document.createElement('script');
   let status;
   const indicator = setTimeout(() => {
    status = document.createElement('div'); status.className = 'gk2-dependency-status';
    status.setAttribute('role', 'status'); status.textContent = '正在准备' + label + '功能…';
    document.body.appendChild(status);
   }, 250);
   const finish = error => {
    clearTimeout(timer); clearTimeout(indicator); status?.remove(); script.onload = script.onerror = null;
    if (error) { script.remove(); reject(error); } else resolve();
   };
   const timer = setTimeout(() => finish(new Error(label + '加载超时')), 20000);
   script.src = new URL(path, document.baseURI).href;
   script.dataset.gk2Dependency = name;
   script.onload = () => finish(ready() ? null : new Error(label + '未能初始化'));
   script.onerror = () => finish(new Error(label + '资源未能加载'));
   document.head.appendChild(script);
  });
 }

 function load(name) {
  const entry = definitions[name];
  if (!entry) return Promise.reject(new Error('Unknown optional module: ' + name));
  if (entry.ready()) return Promise.resolve();
  if (pending.has(name)) return pending.get(name);
  const request = (async () => {
   if (entry.bundle) {
    await loadStylesheet(name);
    const marker = document.querySelector(`[data-gk2-lazy-js="${name}"]`);
    if (!marker?.dataset.src) throw new Error(entry.label + '模块路径缺失');
    await loadScript(marker.dataset.src, name, entry.ready, entry.label);
   } else {
    await loadScript(entry.path, name, entry.ready, entry.label);
   }
  })();
  pending.set(name, request);
  request.catch(() => { if (pending.get(name) === request) pending.delete(name); });
  return request;
 }

 window.gk2Dependencies = Object.freeze({
  load,
  prefetch(name) { return load(name).then(() => true, () => false); },
  async ensure(name) {
   try { await load(name); return true; }
   catch (error) {
    console.error('[Gakuten]', error);
    // Concurrent actions share one load attempt and one failure notification.
    if (notification !== error) {
     notification = error;
     window.alert((definitions[name]?.label || '该功能') + '暂时无法使用，请确认资源文件齐全并重试。');
    }
    return false;
   }
  }
 });
})();
