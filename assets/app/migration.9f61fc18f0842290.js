
window.gk2MigrationTemplate="<span class=\"tag\">离线迁移检查 · 不连接正式云端</span><h1>导入 1.0 数据备份</h1><p>支持 1.0 导出的 JSON 备份或含 data 的云端 JSON 快照。在当前系统内替换本机数据，保留原始文件和上一份备份；不会修改 1.0 云端。</p>\n<section><h2>当前本机数据</h2><p id=\"gk2-migration-current\"></p><div class=\"actions\"><button id=\"gk2-migration-open\" class=\"primary\" hidden>返回成绩工作台</button><button id=\"gk2-migration-export\" disabled>导出副本与回滚包</button><button id=\"gk2-migration-rollback\" disabled>恢复上一份副本</button></div><small>导入后可直接在当前系统查看和使用，原始备份文件仍保留。</small></section>\n<section><h2>1. 选择快照并校验</h2><input id=\"gk2-migration-file\" aria-label=\"选择 1.0 JSON 快照\" type=\"file\" accept=\".json,application/json\"><p>检查重复 ID、学生与考试关联、历史班级、时间戳和删除墓碑。同名考试按 ID 保留；题型合并录入、超出名义满分和总分差异仅提示，原成绩完整保留。</p></section>\n<section id=\"gk2-migration-preview\" hidden><h2>2. 预览与确认</h2><strong id=\"gk2-migration-filename\"></strong><p id=\"gk2-migration-counts\"></p><strong id=\"gk2-migration-result\"></strong><ul id=\"gk2-migration-errors\"></ul><details><summary>查看兼容说明（不拦截导入、不修改原成绩）</summary><ul id=\"gk2-migration-warnings\"></ul></details><div class=\"actions\"><button id=\"gk2-migration-backup-source\" disabled>下载原始快照</button><button id=\"gk2-migration-report\" disabled>下载完整校验报告</button></div><label><input id=\"gk2-migration-backup-confirm\" type=\"checkbox\">我已保留原始快照；如已有离线副本，也已导出其回滚包</label><label><input id=\"gk2-migration-accepted\" type=\"checkbox\">确认按备份原值导入，替换当前本机数据</label><button id=\"gk2-migration-commit\" class=\"primary\" disabled>确认导入备份</button><p>写入成功并回读一致后才开放分析入口。容量不足或其他页面已修改副本时，停止导入。完成后在当前页面载入数据。</p></section>\n<p id=\"gk2-migration-status\" role=\"status\">请选择文件。所有检查在本机完成。</p>\n<dialog id=\"gk2-migration-rollback-dialog\"><h2>恢复上一份离线副本？</h2><p>当前副本会保留为下一次可恢复版本。此操作不会修改 1.0 或正式云端。</p><div class=\"actions\"><button id=\"gk2-migration-confirm-rollback\" class=\"primary\">确认恢复</button><form method=\"dialog\"><button>取消</button></form></div></dialog>";
window.gk2MigrationMount=function(root,onOpen){
 'use strict';
 const abort=new AbortController();root.addEventListener('close',()=>abort.abort(),{once:true});
 const M=window.gk2Migration,$=id=>root.querySelector('#gk2-migration-'+id),state={raw:null,expected:null,staged:null,reading:0};
 const say=text=>{$('status').textContent=text;};
 const report=()=>({summary:state.staged?.summary,sourceKind:state.staged?.sourceKind,errors:state.staged?.errors,warnings:state.staged?.warnings});
 function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function list(id,items){const el=$(id);el.replaceChildren();items.slice(0,200).forEach(text=>{const li=document.createElement('li');li.textContent=text;el.append(li);});if(items.length>200){const li=document.createElement('li');li.textContent=`另有 ${items.length-200} 项，请下载完整校验报告。`;el.append(li);}}
 window.addEventListener('storage',event=>{if(event.key===(window.gk2Safety?.prefix||'gk2_sandbox_v1:')+M.key){$('commit').disabled=true;state.staged=null;say('另一页面已修改副本，请重新选择快照并预览。');showCurrent();}},{signal:abort.signal});
 function showCurrent(){
  try{const slot=M.read(localStorage);$('open').hidden=!slot;$('export').disabled=!slot;$('rollback').disabled=!slot?.previous;$('current').textContent=slot?`已保存独立副本：${slot.state.data.students.length} 名学生 · ${slot.state.data.exams.length} 场考试 · ${slot.state.data.scores.length} 条成绩`:'尚未创建离线副本，演示版与 1.0 数据均不受影响。';}
  catch(e){$('open').hidden=true;$('export').disabled=false;$('rollback').disabled=true;$('current').textContent=e.message;}
 }
 $('file').onchange=async event=>{
  const token=++state.reading;state.raw=null;state.staged=null;$('report').disabled=true;$('backup-source').disabled=true;$('commit').disabled=true;$('accepted').checked=false;$('backup-confirm').checked=false;$('preview').hidden=true;
  const file=event.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){say('文件大于 20MB，未读取，请拆分或先评估容量。');return;}say('正在本机校验，不上传文件…');
  try{const raw=await file.text();if(token!==state.reading||!root.isConnected)return;state.raw=raw;state.expected=localStorage.getItem(M.key);state.staged=M.stage(raw);const r=state.staged;$('preview').hidden=false;$('filename').textContent=file.name;$('counts').textContent=r.summary?`${r.sourceKind}：${r.summary.students} 名学生 / ${r.summary.exams} 场考试 / ${r.summary.scores} 条成绩 / ${r.summary.templates} 个模板`:'未能识别有效数据';list('errors',r.errors);list('warnings',r.warnings);$('result').textContent=r.errors.length?`${r.errors.length} 项错误，禁止导入`:`可完整导入 · ${r.warnings.length} 条兼容说明`;$('backup-source').disabled=false;$('report').disabled=false;updateCommit();say('预览完成，尚未改动数据。');}
  catch(e){say('读取失败：'+e.message);}
 };
 function updateCommit(){$('commit').disabled=!state.staged||state.staged.errors.length>0||!$('accepted').checked||!$('backup-confirm').checked;}
 $('accepted').onchange=updateCommit;$('backup-confirm').onchange=updateCommit;
 $('backup-source').onclick=()=>{if(state.raw!==null)download('Gakuten-1.0-原始快照.json',state.raw);};
 $('report').onclick=()=>download('Gakuten-导入校验报告.json',JSON.stringify(report(),null,2));
 $('export').onclick=()=>{const raw=localStorage.getItem(M.key);if(raw){try{download('Gakuten-离线副本与回滚包.json',JSON.stringify(M.read(localStorage),null,2));}catch{download('Gakuten-损坏副本原文.txt',raw);}}};
 $('commit').onclick=()=>{
  $('commit').disabled=true;
  try{M.commit(localStorage,state.raw,state.expected);state.expected=localStorage.getItem(M.key);state.staged=null;say('离线副本已保存并回读核对。可打开 2.0 离线分析；正式云端未连接。');$('preview').hidden=true;showCurrent();onOpen?.();}
  catch(e){say('未进入分析页：'+e.message);}
 };
 $('rollback').onclick=()=>{
  const expected=localStorage.getItem(M.key);const dialog=$('rollback-dialog');dialog.showModal();$('confirm-rollback').onclick=()=>{try{M.rollback(localStorage,expected);say('已恢复上一份副本；再次恢复可切回。请刷新已打开的分析页。');showCurrent();dialog.close();onOpen?.();}catch(e){say('恢复失败：'+e.message);dialog.close();}};
 };
 $('open').onclick=()=>root.close();
 showCurrent();
};

/* Import stays inside the current application and storage namespace. */
window.gk2OpenImport=function(){
 if(window.__gakutenAuth?.getAuth()?.mode!=='admin')return window.alert('请使用管理员身份导入整套备份。');
 const previous=document.getElementById('gk2-migration-dialog');previous?.close();previous?.remove();
 window.gk2Comfort?.close(true);window.gk2Comfort?.hideChartTips();
 const dialog=document.createElement('dialog');dialog.id='gk2-migration-dialog';dialog.className='gk2-migration-dialog';dialog.setAttribute('aria-label','导入 1.0 数据备份');
 const close=document.createElement('button');close.textContent='关闭';close.className='secondary gk2-migration-close';close.onclick=()=>dialog.close();
 const content=document.createElement('div');content.innerHTML=window.gk2MigrationTemplate;dialog.append(close,content);document.body.append(dialog);
 window.gk2MigrationMount(dialog,()=>{const store=window.app.store;clearTimeout(store.saveTimeout);store.saveTimeout=null;location.reload();});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
};
function installMigrationEntry(){
 if(window.__gk2MigrationEntryReady)return;
 const store=window.app?.store;if(store){store.prepareImportBackup=window.gk2OpenImport;store.importBackup=window.gk2OpenImport;}

 document.querySelectorAll('[onclick*="prepareImportBackup"]').forEach(b=>b.textContent='导入备份 / 恢复数据');
 window.addEventListener('storage',event=>{
  if(event.key!==(window.gk2Safety.prefix+window.gk2Migration.key)||document.getElementById('gk2-import-stale'))return;
  const dialog=document.createElement('dialog');dialog.id='gk2-import-stale';dialog.className='gk2-drill';const text=document.createElement('p');text.textContent='本机数据已在另一个页面更新，请重新载入后继续操作。';const reload=document.createElement('button');reload.textContent='重新载入';reload.className='primary';reload.onclick=()=>{clearTimeout(store.saveTimeout);store.saveTimeout=null;location.reload();};dialog.append(text,reload);dialog.addEventListener('cancel',e=>e.preventDefault());document.body.append(dialog);dialog.showModal();
 });
 if(localStorage.getItem(window.gk2Migration.key)){
  document.title='nekosensei成绩分析系统';
  const role=document.getElementById('gk2-demo-role');if(role){role.replaceChildren(new Option(window.__gakutenAuth?.getAuth()?.mode==='teacher'?'本机备份 · 任课教师':'本机备份 · 管理员',window.__gakutenAuth?.getAuth()?.mode||'admin'));role.disabled=true;role.onchange=null;}
  document.querySelectorAll('.gk2-preview-badge,#gk2-workspace-menu small').forEach(el=>el.textContent='已载入本机备份 · 云同步关闭');
 }
 window.__gk2MigrationEntryReady=true;
}
if(document.readyState==='complete')installMigrationEntry();else window.addEventListener('load',installMigrationEntry,{once:true});

