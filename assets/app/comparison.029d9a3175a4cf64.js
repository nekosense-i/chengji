
/* Independent A/B comparison. Reads records only; never changes scores or cloud state. */
((host) => {
 'use strict';
 const number=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const maximum=t=>number(t?.max??t?.maxScore??t?.full??t?.fullScore)||0;
 const full=e=>number(e?.maxTotal??e?.fullScore)||(e?.types||[]).reduce((s,t)=>s+maximum(t),0);
 const average=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>v===null||v===undefined||!Number.isFinite(v)?'—':v.toFixed(1);
 const delta=(a,b)=>a===null||b===null?null:Math.abs(a-b)<1e-9?0:a-b;
 const signed=v=>{if(v===null)return '—';const rounded=Number(v.toFixed(1));return `${rounded>0?'+':''}${rounded.toFixed(1)}`;};
 const gapColor=v=>v===null||Math.abs(v)<.05?'#64748b':v<0?'#b45309':'#1d4ed8';
 function at(student,exam){
  const date=String(exam.date||'').slice(0,10),history=student.classHistory||[];
  const found=date?[...history].filter(h=>(!h.from||h.from<=date)&&(!h.to||h.to>=date)).sort((a,b)=>String(b.from||'').localeCompare(String(a.from||'')))[0]:null;
  return found?{campus:found.campus||student.campus,teachingClass:found.teachingClass||student.teachingClass,historical:true}:{campus:student.campus,teachingClass:student.teachingClass,historical:false};
 }
 function typeScore(record,exam,type){
  if(!record||record.examAbsent)return null;
  if(exam.entryMode==='count'&&!type.manualScore&&Number.isInteger(Number(type.questionCount))&&number(type.questionCount)>0){
   const n=number(record.questionCounts?.[type.name]);
   return n!==null&&Number.isInteger(n)&&n>=0&&n<=Number(type.questionCount)?Math.round(n*maximum(type)/Number(type.questionCount)*100)/100:null;
  }
  const value=number(record.details?.[type.name]);return value!==null&&value>=0?value:null;
 }
 function status(record,exam){
  if(record?.examAbsent)return 'absent';
  if(!record||record.isEstimated===true)return 'missing';
  const types=exam.types||[];
  if(!types.length)return number(record.total)!==null&&number(record.total)>=0?'complete':'missing';
  const entered=types.filter(t=>typeScore(record,exam,t)!==null).length;
  return entered===types.length?'complete':entered?'partial':'missing';
 }
 function phase(exam){
  if(exam.phase)return String(exam.phase);
  const year=String(exam.grade||'').match(/\d{4}/),date=String(exam.date||'').match(/^(\d{4})-(\d{2})/);
  if(!year||!date)return '';
  const month=Number(date[2]),diff=Number(date[1])-(month<9?1:0)-Number(year[0]);
  return diff>=0&&diff<3?['高一','高二','高三'][diff]+(month>=2&&month<=8?'下':'上'):'';
 }
 function examKind(exam){
  let name=`${exam.examType||''} ${exam.name||''}`.replace(/\s/g,'');
  const ord=name.match(/第?([一二三四五六七八九十\d]+)(?:次)?(?:月考|联考|阶段)/)||name.match(/(?:月考|联考|阶段)([一二三四五六七八九十\d]+)/);
  const ordinals={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  const n=ord?(ordinals[ord[1]]||ord[1]):'';
  const kind=/期中|半期/.test(name)?'期中':/期末/.test(name)?'期末':/入学|开学/.test(name)?'入学考':/月考/.test(name)?'月考':/联考/.test(name)?'联考':/阶段/.test(name)?'阶段测评':'';
  // Repeated unnamed monthly tests must be paired explicitly, never guessed by date.
  return kind&&(!['月考','联考','阶段测评'].includes(kind)||n)?kind+n:'';
 }
 const classLabel=key=>{try{const value=JSON.parse(key);return Array.isArray(value)?value.join(' / '):key;}catch{return key;}};
 const stageKey=e=>phase(e)&&examKind(e)?phase(e)+' · '+examKind(e):'';
 function model(data,auth){
  const students=data.students||[],records=new Map();
  (data.scores||[]).forEach(r=>{const key=JSON.stringify([r.examId,r.studentId]),old=records.get(key);if(!old||Number(r._ts||0)>=Number(old._ts||0))records.set(key,r);});
  const authorized=s=>auth?.mode!=='teacher'||(s.grade===auth.grade&&s.campus===auth.campus&&s.teachingClass===auth.classId);
  const exams=(data.exams||[]).filter(e=>auth?.mode!=='teacher'||e.grade===auth.grade).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.id).localeCompare(String(b.id)));
  function roster(exam,scope={}){
   if(!exam||!exams.some(e=>e.id===exam.id))return [];
   const campuses=Array.isArray(exam.campuses)?exam.campuses:exam.campus?[exam.campus]:[];
   return students.filter(s=>authorized(s)&&(!exam.grade||s.grade===exam.grade)).map(student=>({student,place:at(student,exam),record:records.get(JSON.stringify([exam.id,student.id]))})).filter(r=>(!campuses.length||campuses.includes(r.place.campus))&&(!scope.campus||scope.campus===r.place.campus)&&(!scope.classes?.length||(scope.classes.includes(JSON.stringify([r.place.campus,r.place.teachingClass]))||scope.classes.includes(r.place.teachingClass)))&&(auth?.mode!=='teacher'||(r.place.campus===auth.campus&&r.place.teachingClass===auth.classId)));
  }
  function aggregate(exam,scope){
   const rows=roster(exam,scope),counts={complete:0,missing:0,partial:0,absent:0},values=[],typeRows=(exam?.types||[]).map(t=>({name:t.name,max:maximum(t),values:[]}));
   for(const row of rows){
    const state=status(row.record,exam);counts[state]++;
    if(state==='absent'||state==='missing')continue;
    typeRows.forEach((t,i)=>{const value=typeScore(row.record,exam,exam.types[i]);if(value!==null)t.values.push(value);});
    if(state==='complete'){
     const derived=(exam.types||[]).map(t=>typeScore(row.record,exam,t));
     const total=exam.entryMode==='count'&&derived.length?derived.reduce((s,v)=>s+v,0):(number(row.record.total)??(derived.length?derived.reduce((s,v)=>s+v,0):null));
     if(total!==null&&total>=0)values.push(total);else{counts.complete--;counts.missing++;}
    }
   }
   const mean=average(values),max=full(exam);
   return {exam,rows,counts,n:values.length,mean,rate:mean!==null&&max>0?mean/max*100:null,max,fallback:rows.filter(r=>!r.place.historical).length,types:typeRows.map(t=>({...t,n:t.values.length,mean:average(t.values),rate:t.max>0&&t.values.length?average(t.values)/t.max*100:null}))};
  }
  function history(anchor){
   if(!anchor)return [];
   return exams.filter(e=>e.grade===anchor.grade&&(!anchor.subject||!e.subject||e.subject===anchor.subject)&&(e.id===anchor.id||(e.date&&anchor.date&&String(e.date)<String(anchor.date)))).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id).localeCompare(String(b.id))).filter(e=>e.id!==anchor.id).slice(-4).concat(anchor);
  }
  function pairs(a,b,alignment,overrides={}){
   const ah=history(a),bh=history(b),pad=a=>Array(5-a.length).fill(null).concat(a),aa=pad(ah),bb=pad(bh);
   return aa.map((ea,i)=>{
    if(alignment==='relative')return {a:ea,b:bb[i],label:i===4?'所选考试':`前${4-i}次`,choices:bh};
    const key=ea?stageKey(ea):'',matches=key?bh.filter(e=>stageKey(e)===key):[],aMatches=key?ah.filter(e=>stageKey(e)===key):[];
    const override=ea?overrides[ea.id]:undefined;
    const eb=override!==undefined?bh.find(e=>e.id===override)||null:(a?.id===b?.id?ea:matches.length===1&&aMatches.length===1?matches[0]:null);
    return {a:ea,b:eb,label:ea?(key||ea.name):'暂无历史考试',choices:bh,ambiguous:matches.length>1||aMatches.length>1,manual:override!==undefined};
   });
  }
  return {exams,roster,aggregate,history,pairs};
 }
 const api={model,at,full,status,typeScore,phase,stageKey};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(!host?.document)return;
 host.gk2Comparison=api;
 let root,charts=[],ui,state,engine,report,resize,choiceRows,filterPanel,filterTrigger,filterAria,filterHoverTimer,filterCloseTimer,filterPinned=false;
 const defaults=()=>({a:{exam:'',campus:'',classes:[],phase:''},b:{exam:'',campus:'',classes:[],phase:''},unit:'raw',alignment:'relative',pairs:{},typeMap:{},sort:'name',initialized:false,gradeA:'',gradeB:''});
 const $=s=>root.querySelector(s);
 const save=()=>{try{sessionStorage.setItem('gk2_comparison_'+JSON.stringify(ui._getAuth()),JSON.stringify(state));}catch{}};
 const option=(v,label,selected)=>`<option value="${esc(v)}"${selected?' selected':''}>${esc(label)}</option>`;
 function dispose(){charts.forEach(c=>{try{c.dispose();}catch{}});charts=[];}
 function ensure(){
  if(root)return;
  root=document.createElement('section');root.id='gk2-comparison';root.setAttribute('aria-label','成绩对比');root.hidden=true;
  document.querySelector('#view-analysis .content-body').prepend(root);
  root.innerHTML=`<div class="gkc-actions"><button type="button" class="secondary" data-preset="campus">同考跨校区</button><button type="button" class="secondary" data-preset="cohort">跨届同期</button><button type="button" class="secondary" data-action="swap">交换 A / B</button></div><div class="gkc-pickers">${['a','b'].map(s=>`<section class="gkc-picker"><h3><i class="gkc-dot gkc-${s}"></i>对比 ${s.toUpperCase()}</h3><label>校区<select data-side="${s}" data-field="campus" aria-label="${s.toUpperCase()}校区"></select></label><label>年级<select data-side="${s}" data-field="grade" aria-label="${s.toUpperCase()}筛选入学年级"></select></label><fieldset class="gkc-class-picker"><legend>班级</legend><div data-classes="${s}" class="gkc-class-list"></div><p data-classes-summary="${s}" class="gkc-meta">全部班级</p></fieldset><label>学段<select data-side="${s}" data-field="phase" aria-label="${s.toUpperCase()}学段"></select></label><div class="gkc-exam-picker"><label for="gkc-exam-${s}">考试</label><select id="gkc-exam-${s}" data-side="${s}" data-field="exam" aria-label="${s.toUpperCase()}考试"></select></div><p data-meta="${s}" class="gkc-meta"></p></section>`).join('')}</div><div id="gkc-status" role="status" aria-live="polite"></div><div id="gkc-results"><section class="gkc-panel gkc-summary-panel"><div class="gkc-heading"><h3>本次平均成绩</h3><label class="gkc-inline">显示口径<select id="gkc-unit"><option value="raw">平均分</option><option value="pct">平均得分率</option></select></label></div><div id="gkc-metrics" class="gkc-metrics" aria-live="polite"></div><p id="gkc-counts" class="gkc-meta"></p></section><section class="gkc-panel gkc-trend-panel"><div class="gkc-heading"><h3>近五次考试走势</h3><label class="gkc-inline">横轴对齐<select id="gkc-align"><option value="relative">相对考次</option><option value="stage">同期节点</option></select></label></div><div id="gkc-trend" class="gkc-chart" role="img" aria-label="双方近五次考试平均成绩折线图"></div></section><section class="gkc-panel gkc-heat-panel"><div class="gkc-heading"><h3>题型得分率对比</h3><span class="gkc-meta">统一色阶 0–100% · 差值为 A−B（百分点）</span></div><div id="gkc-heat" class="gkc-table-wrap"></div><div class="gkc-scale"></div><p id="gkc-type-detail" class="gkc-detail" aria-live="polite">点击题型单元格查看均分、满分和有效人数。</p><details class="gkc-type-settings"><summary>题型对应设置</summary><p class="gkc-meta">同名题型自动对应；不同名称可手动指定。每个 B 题型只对应一次，不同题目难度仍可能有差异。</p><div id="gkc-type-map" class="gkc-mapping"></div></details></section><section class="gkc-panel" id="gkc-classes"><div class="gkc-heading"><h3>班级明细与班级热力图</h3><label class="gkc-inline">排序<select id="gkc-sort"><option value="name">班级名称</option><option value="mean">平均分从高到低</option><option value="rate">得分率从高到低</option></select></label></div><div id="gkc-class-tables" class="gkc-class-tables"></div></section></div>`;
  const summary=root.querySelector('.gkc-summary-panel'),summaryHead=summary.querySelector('.gkc-heading');summary.setAttribute('aria-label','本次平均成绩概览');summary.prepend(summaryHead.querySelector('h3'));summary.append(summaryHead.querySelector('.gkc-inline'));summaryHead.remove();
  summary.querySelector('h3').after(summary.querySelector('.gkc-inline'));
  const insights=document.createElement('div');insights.id='gkc-insights';insights.setAttribute('aria-label','对比摘要');insights.setAttribute('aria-live','polite');summary.append(insights);
  for(const panel of root.querySelectorAll('.gkc-trend-panel,.gkc-heat-panel,#gkc-classes')){
   const body=document.createElement('div');body.className='gkc-module-body';body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label',panel.querySelector('h3').textContent+'内容，可滚动浏览');
   while(panel.children.length>1)body.append(panel.children[1]);panel.append(body);
  }
  filterPanel=document.createElement('div');filterPanel.id='gkc-filter-popover';filterPanel.setAttribute('popover','auto');filterPanel.setAttribute('role','dialog');filterPanel.setAttribute('aria-label','成绩对比筛选');
  const panelHead=document.createElement('div');panelHead.className='gkc-filter-heading';panelHead.innerHTML='<h3>成绩对比筛选</h3><button type="button" class="secondary" data-action="close-filters" aria-label="关闭对比筛选">完成</button>';
  filterPanel.append(panelHead,root.querySelector('.gkc-actions'),root.querySelector('.gkc-pickers'));root.append(filterPanel);
  filterPanel.addEventListener('beforetoggle',event=>filterTrigger?.setAttribute('aria-expanded',String(event.newState==='open')));
  filterPanel.addEventListener('toggle',()=>{if(!filterPanel.matches(':popover-open'))filterPinned=false;filterTrigger?.setAttribute('aria-expanded',String(filterPanel.matches(':popover-open')));if(filterPanel.matches(':popover-open'))positionFilters();});
  filterPanel.addEventListener('pointerenter',()=>{clearTimeout(filterCloseTimer);});
  filterPanel.addEventListener('pointerleave',()=>api.scheduleFiltersClose());
  window.addEventListener('resize',positionFilters,{passive:true});
  root.addEventListener('change',change);

  root.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.dataset.action==='swap'){[state.a,state.b]=[state.b,state.a];[state.gradeA,state.gradeB]=[state.gradeB,state.gradeA];state.pairs={};state.typeMap={};render(ui);}
   if(button.dataset.preset)preset(button.dataset.preset);
   if(button.dataset.action==='close-filters')api.closeFilters(true);
   if(button.dataset.heat!==undefined){const item=report.types[Number(button.dataset.heat)],t=button.dataset.side==='a'?item.a:item.b;$('#gkc-type-detail').textContent=t?`${button.dataset.side.toUpperCase()} · ${t.name}：均分 ${fmt(t.mean)} / 满分 ${fmt(t.max)} · 得分率 ${fmt(t.rate)}% · 有效 ${t.n} 人`:'该题型未对应或没有有效成绩。';}
   save();
  });
  resize=new ResizeObserver(()=>charts.forEach(c=>c.resize()));resize.observe(root);resize.observe($('#gkc-trend'));
 }
 function examMatches(exam,side,ignorePhase=false){
  const scope=state[side],grade=state['grade'+side.toUpperCase()];
  if(grade&&exam.grade!==grade)return false;
  if(!ignorePhase&&scope.phase&&phase(exam)!==scope.phase)return false;
  const rows=choiceRows.get(exam.id)||[];
  if(scope.campus&&!rows.some(r=>r.place.campus===scope.campus)&&!(Array.isArray(exam.campuses)&&exam.campuses.includes(scope.campus))&&exam.campus!==scope.campus)return false;
  return !scope.classes.length||rows.some(r=>(!scope.campus||r.place.campus===scope.campus)&&scope.classes.includes(JSON.stringify([r.place.campus,r.place.teachingClass])));
 }
 function picker(side){
  const scope=state[side],cap=side.toUpperCase(),allRows=[...choiceRows.values()].flat();
  const campuses=[...new Set(allRows.map(r=>r.place.campus).filter(Boolean))].sort();
  if(scope.campus&&!campuses.includes(scope.campus))scope.campus='';
  $(`[data-side="${side}"][data-field="campus"]`).innerHTML=option('','全部校区',!scope.campus)+campuses.map(c=>option(c,c,c===scope.campus)).join('');
  const candidates=engine.exams.filter(e=>!scope.campus||(choiceRows.get(e.id)||[]).some(r=>r.place.campus===scope.campus)||(Array.isArray(e.campuses)&&e.campuses.includes(scope.campus))||e.campus===scope.campus);
  const grades=[...new Set(candidates.map(e=>e.grade||''))].sort();
  if(state['grade'+cap]&&!grades.includes(state['grade'+cap]))state['grade'+cap]='';
  $(`[data-side="${side}"][data-field="grade"]`).innerHTML=option('','全部年级',!state['grade'+cap])+grades.map(g=>option(g,g,state['grade'+cap]===g)).join('');
  const rows=candidates.filter(e=>!state['grade'+cap]||e.grade===state['grade'+cap]).flatMap(e=>choiceRows.get(e.id)||[]);
  const classes=[...new Set(rows.filter(r=>!scope.campus||r.place.campus===scope.campus).map(r=>JSON.stringify([r.place.campus,r.place.teachingClass])))].sort((a,b)=>classLabel(a).localeCompare(classLabel(b),'zh-CN',{numeric:true}));
  scope.classes=(scope.classes||[]).filter(c=>classes.includes(c));
  $(`[data-classes="${side}"]`).innerHTML=`<button type="button" class="secondary" data-all-classes="${side}">全部班级</button>`+classes.map(c=>`<label><input type="checkbox" data-side="${side}" data-field="class" value="${esc(c)}"${scope.classes.includes(c)?' checked':''}>${esc(scope.campus?JSON.parse(c)[1]:classLabel(c))}</label>`).join('');
  $(`[data-all-classes="${side}"]`).onclick=()=>{state[side].classes=[];render(ui);};
  $(`[data-classes-summary="${side}"]`).textContent=scope.classes.length?'已选：'+scope.classes.map(classLabel).join('、'):'全部班级';
  const recordedPhases=new Set(engine.exams.filter(e=>examMatches(e,side,true)&&(choiceRows.get(e.id)||[]).some(r=>(!scope.campus||r.place.campus===scope.campus)&&(!scope.classes.length||scope.classes.includes(JSON.stringify([r.place.campus,r.place.teachingClass])))&&status(r.record,e)!=='missing')).map(phase).filter(Boolean));
  const phases=['高一上','高一下','高二上','高二下','高三上','高三下'].filter(p=>recordedPhases.has(p));
  if(scope.phase&&!phases.includes(scope.phase))scope.phase='';
  $(`[data-side="${side}"][data-field="phase"]`).innerHTML=option('','全部学段',!scope.phase)+phases.map(p=>option(p,p,p===scope.phase)).join('');
  const exam=engine.exams.find(e=>e.id===scope.exam);
  if(exam&&!examMatches(exam,side)){scope.exam='';state.pairs={};state.typeMap={};}
  filterExams(side);
 }
 function filterExams(side){
  const items=engine.exams.filter(e=>examMatches(e,side)),select=$(`[data-side="${side}"][data-field="exam"]`);
  select.innerHTML=option('',items.length?'请选择考试':'当前范围暂无匹配考试',!state[side].exam)+items.map(e=>option(e.id,`${e.grade||'未设年级'} · ${phase(e)||'学段未识别'} · ${e.name}（${e.date||'日期未设'}）`,e.id===state[side].exam)).join('');
 }
 function change(event){
  const el=event.target,{side,field}=el.dataset;
  if(side&&field){
   if(field==='grade'){state['grade'+side.toUpperCase()]=el.value;state[side].classes=[];render(ui);save();return;}
   if(field==='class')state[side].classes=[...root.querySelectorAll(`[data-side="${side}"][data-field="class"]:checked`)].map(e=>e.value);
   else {state[side][field]=el.value;if(field==='exam'){state.pairs={};state.typeMap={};}if(field==='campus')state[side].classes=[];}
  }else if(el.id==='gkc-unit')state.unit=el.value;
  else if(el.id==='gkc-align')state.alignment=el.value;
  else if(el.id==='gkc-sort')state.sort=el.value;
  else if(el.dataset.pair)state.pairs[el.dataset.pair]=el.value;
  else if(el.dataset.map!==undefined)state.typeMap[el.dataset.map]=el.value;
  render(ui);save();
 }
 function preset(kind){
  const a=engine.exams.find(e=>e.id===state.a.exam)||engine.exams[0];if(!a)return;
  state.a={exam:a.id,campus:'',classes:[],phase:''};state.b={exam:'',campus:'',classes:[],phase:''};state.pairs={};state.typeMap={};state.gradeA=state.gradeB='';
  if(kind==='campus'){
   const campuses=[...new Set(engine.roster(a).map(r=>r.place.campus).filter(Boolean))].sort();
   if(campuses.length>=2){state.b.exam=a.id;state.a.campus=campuses[0];state.b.campus=campuses[1];}
   state.alignment='relative';state.unit='raw';
  }else{
   const matches=engine.exams.filter(e=>e.grade!==a.grade&&stageKey(a)&&stageKey(e)===stageKey(a));
   if(matches.length===1)state.b.exam=matches[0].id;
   state.alignment='stage';state.unit='pct';
  }
  render(ui);if(!state.b.exam){$('#gkc-status').hidden=false;$('#gkc-status').textContent=kind==='campus'?'当前权限或考试中不足两个校区，请手动选择另一场考试或班级。':'没有唯一的跨届同期考试，请在 B 侧手动选择；系统不会猜测配对。';}save();
 }
 function typesFor(a,b){
  const used=new Set(),result=a.types.map((ta,i)=>{
   const mapped=state.typeMap[ta.name],name=mapped===undefined?ta.name:mapped;
   const tb=b.types.find(t=>t.name===name&&!used.has(t.name));if(tb)used.add(tb.name);
   return {a:ta,b:tb||null,label:tb&&ta.name!==tb.name?`${ta.name} / ${tb.name}`:ta.name};
  });
  b.types.filter(t=>!used.has(t.name)).forEach(tb=>result.push({a:null,b:tb,label:tb.name+'（仅 B）'}));return result;
 }
 function rateTone(value){
  if(value===null||value===undefined||!Number.isFinite(value))return {bg:'#edf1f6',fg:'#64748b'};
  const band=host.gk2.rateBand(value);return {bg:band.color,fg:band.text};
 }
 function heatCell(type,index,side){
  const value=type?.rate,tone=rateTone(value);
  return `<td><button type="button" data-heat="${index}" data-side="${side}" aria-label="${side.toUpperCase()} ${esc(type?.name||'无对应题型')} ${fmt(value)}${value==null?'':'%'}，查看详情" style="background:${tone.bg};color:${tone.fg}">${fmt(value)}${value==null?'':'%'}</button></td>`;
 }
 function table(headers,rows){return `<table data-gk2-static-table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;}
 function render(currentUI){
  ui=currentUI;ensure();const active=document.activeElement;const focusData=root.contains(active)?{...active.dataset,value:active.value,id:active.id}:null;const restoreFocus=()=>{if(!focusData)return;const target=focusData.side&&focusData.field?root.querySelector(`[data-side="${focusData.side}"][data-field="${focusData.field}"]${focusData.field==='class'?'[value="'+CSS.escape(focusData.value)+'"]':''}`):focusData.id?document.getElementById(focusData.id):null;target?.focus({preventScroll:true});};root.hidden=false;document.body.classList.add('gk2-comparing');dispose();
  engine=model(ui.store.state.data,ui._getAuth());
  choiceRows=new Map(engine.exams.map(e=>[e.id,engine.roster(e)]));
  if(!state){state=defaults();try{const saved=JSON.parse(sessionStorage.getItem('gk2_comparison_'+JSON.stringify(ui._getAuth()))||'null');if(saved)state={...state,...saved};}catch{};}
  for(const side of ['a','b']){if(state[side].exam&&!engine.exams.some(e=>e.id===state[side].exam))state[side].exam='';}
  if(!state.initialized&&!state.a.exam&&engine.exams.length)state.a.exam=engine.exams.find(e=>e.id===ui.store.state.currentExamId)?.id||engine.exams[0].id;
  state.initialized=true;picker('a');picker('b');
  ['analysis-toolbar','analysis-compact-stats','chart-wrapper-card','overview-dashboard-card','analysis-table-area','empty-state-card'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  const aExam=engine.exams.find(e=>e.id===state.a.exam),bExam=engine.exams.find(e=>e.id===state.b.exam);
  for(const side of ['a','b']){const e=side==='a'?aExam:bExam,r=engine.aggregate(e,state[side]);$(`[data-meta="${side}"]`).textContent=e?`${e.date||'日期未设'} · 满分 ${fmt(r.max)} · 完整成绩 ${r.n} / 范围内 ${r.rows.length} 人`:'请选择考试';}
  $('#gkc-results').hidden=!aExam||!bExam;
  $('.gkc-summary-panel').hidden=!aExam||!bExam;
  $('#gkc-status').hidden=!!aExam&&!!bExam;
  if(!aExam||!bExam){$('#gkc-status').textContent=engine.exams.length?'悬浮右上角橙色 VS 图标，设置两侧的考试与学生范围（触屏可点击）。':'当前权限范围内尚无考试。';restoreFocus();return;}
  const a=engine.aggregate(aExam,state.a),b=engine.aggregate(bExam,state.b);
  if(a.max!==b.max)state.unit='pct';
  $('#gkc-unit').value=state.unit;$('#gkc-unit').querySelector('[value="raw"]').disabled=a.max!==b.max;$('#gkc-align').value=state.alignment;$('#gkc-sort').value=state.sort;
  const pct=state.unit==='pct',av=pct?a.rate:a.mean,bv=pct?b.rate:b.mean;
  $('#gkc-metrics').innerHTML=[['A · '+aExam.grade,av,pct?'%':'分',`${state.a.campus||'全部校区'} · ${state.a.classes.map(classLabel).join('、')||'全部班级'} · ${a.n}人`],['B · '+bExam.grade,bv,pct?'%':'分',`${state.b.campus||'全部校区'} · ${state.b.classes.map(classLabel).join('、')||'全部班级'} · ${b.n}人`],['差距 · A−B',delta(av,bv),pct?'个百分点':'分','所选两场考试的平均成绩差']].map((r,i)=>`<div class="gkc-metric"><span>${i<2?`<b class="gkc-label-${i===0?'a':'b'}">${i===0?'A':'B'}</b>${esc(r[0].slice(1))}`:'差距 · <b class="gkc-label-a">A</b>−<b class="gkc-label-b">B</b>'}</span><strong>${i===2?signed(r[1]):fmt(r[1])}<small>${r[1]===null?'':r[2]}</small></strong><span>${esc(r[3])}</span></div>`).join('');
  $('#gkc-counts').textContent=[['A',a],['B',b]].map(([name,r])=>`${name}：完整 ${r.counts.complete} · 缺考 ${r.counts.absent} · 部分录入 ${r.counts.partial} · 未录入/预估 ${r.counts.missing}`).join('；');
  $('.gkc-summary-panel h3').title=$('#gkc-counts').textContent;
  [...$('#gkc-metrics').children].forEach((el,i)=>{el.title=el.textContent+(i<2?'；'+$('#gkc-counts').textContent.split('；')[i]:'');el.setAttribute('aria-label',el.title);});
  const pairs=engine.pairs(aExam,bExam,state.alignment,state.pairs),trend=pairs.map(p=>({...p,ar:engine.aggregate(p.a,state.a),br:engine.aggregate(p.b,state.b)}));
  const trendPct=pct||new Set(trend.flatMap(p=>[p.ar.max,p.br.max]).filter(v=>v>0)).size>1;
  $('#gkc-trend').setAttribute('aria-label','双方近五次考试'+(trendPct?'平均得分率':'平均成绩')+'折线图');
  const chart=echarts.init($('#gkc-trend'));charts.push(chart);
  chart.setOption({animation:false,aria:{enabled:true},color:['#4e79a7','#f28e2c'],grid:{left:55,right:22,top:42,bottom:48},legend:{data:['A','B'],top:0},tooltip:{trigger:'item',triggerOn:'mousemove',alwaysShowContent:false,enterable:false,confine:true,formatter:params=>{const point=Array.isArray(params)?params[0]:params;const r=trend[point?.dataIndex];if(!r)return '';return ['A','B'].map(side=>{const e=side==='A'?r.a:r.b,ag=side==='A'?r.ar:r.br;return `${side} · ${esc(e?.name||'未匹配')}<br>${esc(e?.date||'—')} · ${fmt(trendPct?ag.rate:ag.mean)}${trendPct?'%':'分'} · ${ag.n}人`;}).join('<br><br>')+`<br><br>差距 A−B：${signed(delta(trendPct?r.ar.rate:r.ar.mean,trendPct?r.br.rate:r.br.mean))}${trendPct?' 个百分点':' 分'}`;}},xAxis:{type:'category',data:trend.map(p=>state.alignment==='relative'?p.label:(p.a?phase(p.a)+'\n'+(examKind(p.a)||p.a.name):'暂无记录')),axisLabel:{fontSize:12,interval:'auto',hideOverlap:true}},yAxis:{type:'value',min:0,name:trendPct?'平均得分率 / %':'平均分 / 分',max:trendPct?Math.max(100,...trend.flatMap(p=>[p.ar.rate||0,p.br.rate||0])):Math.max(a.max,b.max,...trend.flatMap(p=>[p.ar.max||0,p.br.max||0,p.ar.mean||0,p.br.mean||0]))||150},series:[['A','ar','circle','solid'],['B','br','rect','dashed']].map(([name,key,symbol,line])=>({name,type:'line',symbol,symbolSize:8,connectNulls:false,smooth:false,itemStyle:{color:name==='A'?'#4e79a7':'#f28e2c'},lineStyle:{width:2.5,type:line,color:name==='A'?'#4e79a7':'#f28e2c'},data:trend.map(r=>trendPct?r[key].rate:r[key].mean)}))});
  chart.getZr().on('globalout',()=>{if(!chart.isDisposed())chart.dispatchAction({type:'hideTip'});});
  const types=typesFor(a,b);report={a,b,types,trend};renderInsights(a,b,types);
  $('#gkc-heat').innerHTML=types.length?table(['对象',...types.map(t=>t.label)],[...['a','b'].map(side=>`<tr><th scope="row">${side.toUpperCase()}</th>${types.map((t,i)=>heatCell(t[side],i,side)).join('')}</tr>`),`<tr><th scope="row">A−B<br>百分点</th>${types.map(t=>`<td class="gkc-gap" style="color:${gapColor(delta(t.a?.rate??null,t.b?.rate??null))}">${signed(delta(t.a?.rate??null,t.b?.rate??null))}</td>`).join('')}</tr>`]):'<p class="gkc-empty">两场考试均未设置题型结构，暂不能生成热力图。</p>';
  const heatPieces=host.gk2.ratePieces(types.some(t=>(t.a?.rate??0)>100||(t.b?.rate??0)>100));
  $('.gkc-scale').innerHTML=heatPieces.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.label)}</span>`).join('')+'<span>— 无数据 / 未对应</span>';
  $('#gkc-type-detail').textContent='点击题型单元格查看均分、满分和有效人数。';
  $('#gkc-type-map').innerHTML=a.types.map(t=>{const desired=state.typeMap[t.name]===undefined?(b.types.some(x=>x.name===t.name)?t.name:''):state.typeMap[t.name];return `<label>${esc(t.name)}<select data-map="${esc(t.name)}" aria-label="A题型${esc(t.name)}对应B题型">${option('','不对应',!desired)}${b.types.map(tb=>option(tb.name,tb.name,tb.name===desired)).join('')}</select></label>`;}).join('');
  // Resolve duplicate manual mappings visibly; never silently pool multiple types.
  const selected=[...root.querySelectorAll('[data-map]')].map(e=>e.value).filter(Boolean);
  if(new Set(selected).size!==selected.length)$('#gkc-type-detail').textContent='同一 B 题型被多次指定：仅第一项参与比较，请调整重复对应。';
  renderClasses(a,b);save();restoreFocus();
 }
 function renderInsights(a,b,types){
  const sides=[['a',a],['b',b]],tag=side=>`<b class="gkc-label-${side}">${side.toUpperCase()}</b>`;
  const row=(side,content,title='')=>`<div class="gkc-insight-row"${title?' title="'+esc(title)+'"':''}>${tag(side)}<span>${content}</span></div>`;
  const coverage=sides.map(([side,r])=>row(side,`${r.n} / ${r.rows.length} 人 <small>· ${fmt(r.rows.length?r.n/r.rows.length*100:null)}${r.rows.length?'%':''}</small>`)).join('');
  const changes=sides.map(([side,r])=>{
   const previous=engine.history(r.exam).at(-2),old=previous?engine.aggregate(previous,state[side]):null,value=old?delta(r.rate,old.rate):null;
   return row(side,value===null?'<small>暂无可比数据</small>':`<strong style="color:${gapColor(value)}">${signed(value)}</strong><small> 个百分点</small>`,previous?`前次：${previous.name}（${previous.date||'日期未设'}）；本次与前次分别按有效成绩统计`:'没有更早的同年级考试');
  }).join('');
  const comparable=types.map(t=>({label:t.label,value:delta(t.a?.rate??null,t.b?.rate??null)})).filter(t=>t.value!==null).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  const widest=comparable[0],ties=widest?comparable.filter(t=>Math.abs(Math.abs(t.value)-Math.abs(widest.value))<1e-9).length:0;
  let gap='<p class="gkc-insight-empty">暂无可比题型</p>';
  if(widest){
   if(Math.abs(widest.value)<.05)gap='<p class="gkc-insight-empty">各题型差距均小于 0.1 个百分点</p>';
   else gap=`<p class="gkc-insight-type" title="${esc(comparable.filter(t=>Math.abs(Math.abs(t.value)-Math.abs(widest.value))<1e-9).map(t=>t.label).join('、'))}">${esc(widest.label)}${ties>1?' 等'+ties+'项':''}</p><p class="gkc-insight-difference"><span style="color:${gapColor(widest.value)}">${signed(widest.value)}<small> 个百分点</small></span><small>A−B</small></p>`;
  }
  $('#gkc-insights').innerHTML=`<section><h4>有效成绩占比</h4>${coverage}</section><section><h4>较前次 · 得分率变化</h4>${changes}</section><section><h4>最大题型差距</h4>${gap}</section>`;
 }
 function renderClasses(a,b){
  $('#gkc-class-tables').innerHTML=[['a',a],['b',b]].map(([side,r])=>{
   const scopes=[...new Set(r.rows.map(row=>JSON.stringify([row.place.campus,row.place.teachingClass])))];
   const items=scopes.map(key=>{const [campus,name]=JSON.parse(key);return {campus,name,result:engine.aggregate(r.exam,{campus,classes:[name]})};});
   items.sort((a,b)=>state.sort==='name'?(a.campus+a.name).localeCompare(b.campus+b.name,'zh-CN',{numeric:true}):(b.result[state.sort]??-Infinity)-(a.result[state.sort]??-Infinity));
   return `<section><h4><i class="gkc-dot gkc-${side}"></i>${side.toUpperCase()} · ${esc(r.exam.name)}</h4><div class="gkc-table-wrap">${table(['校区 / 班级','有效人数','平均分','得分率',...r.types.map(t=>t.name)],items.map(item=>`<tr><th scope="row">${esc(item.campus+' / '+item.name)}</th><td>${item.result.n}</td><td>${fmt(item.result.mean)}</td><td>${fmt(item.result.rate)}%</td>${item.result.types.map(t=>`<td style="background:${rateTone(t.rate).bg};color:${rateTone(t.rate).fg}">${fmt(t.rate)}${t.rate===null?'':'%'}</td>`).join('')}</tr>`))}</div></section>`;
  }).join('');
 }
 function positionFilters(){
  if(!filterPanel?.matches(':popover-open')||!filterTrigger)return;
  const rect=filterTrigger.getBoundingClientRect(),left=Math.max(12,Math.min(rect.right-filterPanel.offsetWidth,innerWidth-filterPanel.offsetWidth-12)),top=Math.max(12,Math.min(rect.bottom+10,innerHeight-160));
  filterPanel.style.left=left+'px';filterPanel.style.top=top+'px';filterPanel.style.maxHeight=Math.max(120,innerHeight-top-12)+'px';
 }
 api.isFiltersOpen=()=>!!filterPanel?.matches(':popover-open');
 api.closeFilters=(restore=false)=>{clearTimeout(filterHoverTimer);clearTimeout(filterCloseTimer);filterPinned=false;if(filterPanel?.matches(':popover-open'))filterPanel.hidePopover();filterTrigger?.setAttribute('aria-expanded','false');if(restore&&filterTrigger&&!filterTrigger.disabled)filterTrigger.focus({preventScroll:true});};
 const openFilters=(button,focus)=>{if(window.gk2?.page!=='analysis'||ui?.store.state.currentAnalysisType!=='compare')return;filterTrigger=button;clearTimeout(filterCloseTimer);if(!filterPanel.matches(':popover-open'))filterPanel.showPopover();positionFilters();if(focus)filterPanel.querySelector('select')?.focus({preventScroll:true});};
 api.hoverFilters=button=>{clearTimeout(filterHoverTimer);clearTimeout(filterCloseTimer);filterHoverTimer=setTimeout(()=>openFilters(button,false),120);};
 api.scheduleFiltersClose=()=>{clearTimeout(filterHoverTimer);clearTimeout(filterCloseTimer);filterCloseTimer=setTimeout(()=>{if(!filterPinned&&!filterPanel?.matches(':hover')&&!filterTrigger?.matches(':hover')&&!filterPanel?.contains(document.activeElement))api.closeFilters();},160);};
 api.toggleFilters=button=>{clearTimeout(filterHoverTimer);if(filterPanel.matches(':popover-open')&&filterPinned)return api.closeFilters(true);filterPinned=true;openFilters(button,true);};
 api.syncFilterTrigger=(button,active)=>{
  button.classList.toggle('gkc-comparison-trigger',active);
  if(active&&!button.querySelector('.gkc-vs-icon')){const mark=document.createElement('span');mark.className='gkc-vs-icon';mark.textContent='VS';mark.setAttribute('aria-hidden','true');button.append(mark);}
  if(!active)button.querySelector('.gkc-vs-icon')?.remove();
  if(active){filterTrigger=button;if(!filterAria)filterAria=Object.fromEntries(['aria-haspopup','aria-controls'].map(name=>[name,button.getAttribute(name)]));button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','gkc-filter-popover');button.setAttribute('aria-expanded',String(!!filterPanel?.matches(':popover-open')));}
  else if(filterAria){api.closeFilters(false);for(const [name,value]of Object.entries(filterAria)){if(value===null)button.removeAttribute(name);else button.setAttribute(name,value);}filterAria=null;}
 };
 api.render=render;
 api.leave=()=>{api.closeFilters(false);dispose();if(root)root.hidden=true;document.body.classList.remove('gk2-comparing');};
 api.export=async()=>{
  if(!report||!await host.gk2Dependencies.ensure('xlsx'))return;
  // Re-evaluate authorization and current records at the moment of export.
  render(ui);if($('#gkc-results').hidden)return;
  const {a,b,trend,types}=report,book=XLSX.utils.book_new(),scope=s=>`${state[s].campus||'全部校区'} / ${state[s].classes.map(classLabel).join('、')||'全部班级'} / ${state[s].phase||'全部学段'}`;
  const sheets=[['对比概况',[['对象','考试','日期','范围','归属口径','有效人数','满分','均分','得分率(%)','缺考','部分录入','未录入或预估','当前归属回退人数'],...[[a,'a'],[b,'b']].map(([r,s])=>[s.toUpperCase(),r.exam.name,r.exam.date,scope(s),'考试当时归属；缺少历史则当前归属',r.n,r.max,r.mean,r.rate,r.counts.absent,r.counts.partial,r.counts.missing,r.fallback]),['说明','完整实考成绩（含零分）；得分率不消除难度差异'],['走势对齐',state.alignment==='stage'?'同期节点（含手动指定）':'相对考次（非同期配对）']]],['近期走势',[['节点','A考试','A日期','A均分','A得分率','A人数','B考试','B日期','B均分','B得分率','B人数','手动配对'],...trend.map(p=>[p.label,p.a?.name,p.a?.date,p.ar.mean,p.ar.rate,p.ar.n,p.b?.name,p.b?.date,p.br.mean,p.br.rate,p.br.n,p.manual?'是':'否'])]],['题型对比',[['A题型','B题型','A均分','A满分','A人数','A得分率','B均分','B满分','B人数','B得分率','A−B(百分点)'],...types.map(t=>[t.a?.name,t.b?.name,t.a?.mean,t.a?.max,t.a?.n,t.a?.rate,t.b?.mean,t.b?.max,t.b?.n,t.b?.rate,delta(t.a?.rate??null,t.b?.rate??null)])]]];
  for(const [name,rows] of sheets)XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),name);
  XLSX.writeFile(book,'成绩对比.xlsx');
 };
 const install=()=>{
  const current=host.app?.ui;if(!current)return;
  if(api.__installed)return;api.__installed=true;
  const exportOriginal=current.exportAnalysisExcel;current.exportAnalysisExcel=function(...args){return this.store.state.currentAnalysisType==='compare'?api.export():exportOriginal.apply(this,args);};
  const switchView=current.switchView;current.switchView=function(...args){const result=switchView.apply(this,args);if(this.cur!=='analysis')api.leave();return result;};
  const switchTab=current.switchAnalysisTab;current.switchAnalysisTab=function(type){return switchTab.call(this,type==='avg'?'compare':type);};
  window.gk2Navigation?.refresh?.();
 };
 api.install=install;
 if(document.readyState==='complete')install();else host.addEventListener('load',install,{once:true});
})(typeof window==='undefined'?null:window);

