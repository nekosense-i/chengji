'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'../src/shared-teacher-grades.js'),'utf8');

function loadDeleteFlow({archivedAt, conflict} = {}) {
    class Store {}
    class UI {}
    const auth = {mode:'teacher',sharedDirectory:true,teacherId:'teacher'};
    const messages = [], requests = [];
    const exam = {id:'exam',name:'期中考试',_ts:200,archivedAt};
    const response = (payload,status=200) => ({ok:status===200,status,json:async()=>payload});
    const window = {
        gk2TeacherWorkspaceId:auth.teacherId,
        __gakutenAuth:{getAuth:()=>auth},
        gk2TeacherAccounts:{
            gradeRequest:async options=>{
                requests.push(options);
                if (!options.method) return response({
                    data:{exams:[exam],scores:[{examId:exam.id}],students:[],examTemplates:[]}
                });
                if (conflict) return response({error:'考试已被修改，请同步后重试'},409);
                return response({operationId:'mock-operation'});
            }
        },
        addEventListener(){}
    };
    vm.runInNewContext(source,{
        window,UI,Store,AbortSignal,crypto:{randomUUID:()=> 'mock-operation'},
        Utils:{msg:(...args)=>messages.push(args)},document:{addEventListener(){}},setInterval(){}
    });
    const ui = new UI();
    ui.store = {state:{data:{exams:[{...exam,_ts:999}],scores:[]}}};
    ui.showConfirmDialog = (message,confirm) => { ui.confirm = confirm; ui.message = message; };
    return {ui,messages,requests};
}

test('teacher confirms the cloud score count and deletes with the current cloud version', async () => {
    const {ui,messages,requests} = loadDeleteFlow();
    await ui.deleteExam('exam');
    assert.match(ui.message,/1 条成绩/);
    assert.equal(requests.length,1);
    await ui.confirm();
    assert.deepEqual(JSON.parse(requests[1].body),{
        action:'delete-exam',examId:'exam',expectedVersion:200,operationId:'mock-operation'
    });
    assert.deepEqual(messages,[['考试已删除']]);
});

test('archived exam is rejected before confirmation and a real concurrent change requires confirmation again', async () => {
    const archived = loadDeleteFlow({archivedAt:123});
    await archived.ui.deleteExam('exam');
    assert.equal(archived.ui.confirm,undefined);
    assert.deepEqual(archived.messages,[['已归档考试不能删除','error']]);

    const changed = loadDeleteFlow({conflict:true});
    await changed.ui.deleteExam('exam');
    await changed.ui.confirm();
    assert.equal(changed.requests.length,2);
    assert.match(changed.messages[0][0],/重新点「删除此场考试」核对后再确认/);
});
