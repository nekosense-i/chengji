/* Entirely fictional, deterministic fixtures. No production reads. */
(() => {
 const students=[],exams=[],scores=[];
 const campuses=['青岚校区','星河校区'];
 for (let c=0;c<2;c++) for(let g=0;g<2;g++) for(let b=0;b<2;b++) for(let n=0;n<12;n++) {
  const i=students.length;
  const campus=campuses[c],grade=`${2024+g}级`,teachingClass=`日语${b?'B':'A'}班`;
  students.push({id:`demo-s${i}`,name:`模拟学生${String(i+1).padStart(3,'0')}`,campus,grade,teachingClass,adminClass:`${b+1}班`,tags:n%5===0?['重点关注']:[],classHistory:[{campus,teachingClass,from:'2024-09-01',to:null}],_ts:100+i});
 }
 // Transfer within the same authorized campus; history is preserved by date.
 students[12].classHistory=[{campus:campuses[0],teachingClass:'日语A班',from:'2024-09-01',to:'2026-09-20'},{campus:campuses[0],teachingClass:'日语B班',from:'2026-09-21',to:null}];
 for(let g=0;g<2;g++) for(let e=0;e<4;e++) {
  const maxTotal=e===1?100:150;
  const types=maxTotal===100?[{name:'听力',max:20},{name:'阅读',max:35},{name:'语言运用',max:25},{name:'写作',max:20}]:[{name:'听力',max:30},{name:'阅读',max:50},{name:'语言运用',max:40},{name:'写作',max:30}];
  const exam={id:`demo-e${g}-${e}`,name:['开学诊断','阶段测评','九月联考','十月学情测评'][e],date:['2026-09-05','2026-09-18','2026-09-28','2026-10-12'][e],grade:`${2024+g}级`,campuses,types,maxTotal,_ts:1000+e};exams.push(exam);
  students.filter(s=>s.grade===exam.grade).forEach((s,i)=>{
   if(e===3&&i%19===7) return; // no record
   const absent=e===3&&i%23===4;
   const zero=e===3&&i===2;
   const partial=e===3&&i===9;
   const details={};
   types.forEach((t,k)=>{if(absent || (partial&&k>0)) return;const rate=.20+((i*7)%77)/100+e*.012+[0,-.15,.05,.07][k];details[t.name]=zero?0:Math.round(t.max*Math.max(0,Math.min(.98,rate))*10)/10;});
   scores.push({studentId:s.id,examId:exam.id,details,total:absent?0:Math.round(Object.values(details).reduce((a,b)=>a+b,0)*10)/10,examAbsent:absent,isEstimated:false,estimatedTotal:Math.round(maxTotal*.65),_ts:2000+e});
  });
 }
 const state={data:{students,exams,scores,examTemplates:[{id:'demo-template',name:'模拟日语卷',types:exams[0].types,_ts:1}]},deleted:{students:{},exams:{},scores:{}},syncMeta:{},globalFocus:{campuses:[],grades:['2024级'],phases:[],tClasses:[],tags:[]},currentExamId:'demo-e0-3',currentAnalysisType:'overview',trendPhases:[],currentTrendPredictSeries:[]};
 window.gk2Demo=Object.freeze({create:()=>JSON.parse(JSON.stringify(state)),roles:[{mode:'admin'},{mode:'teacher',campus:'青岚校区',grade:'2024级',classId:'日语A班'}]});
 if (!localStorage.getItem('gakuten_data_v1') && !localStorage.getItem('gakuten_migration_slot')) localStorage.setItem('gakuten_data_v1',JSON.stringify(state));
 // Isolated preview only: explicit role switcher offers fictional admin/teacher roles.
 if (!localStorage.getItem('gakuten_migration_slot') && !localStorage.getItem('gakuten_auth') && !sessionStorage.getItem('gk2_logged_out')) localStorage.setItem('gakuten_auth',JSON.stringify({mode:'admin'}));
})();
