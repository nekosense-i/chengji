(() => {
    const identity = () => window.__gakutenAuth.getAuth();
    const enabled = () => identity()?.sharedDirectory || identity()?.cloudAdmin;
    const categories = {gaokao:'高考日语', 'study-abroad':'留学'};
    const stages = ['高一','高二','高三'];
    const standard = {id:'gaokao-standard',name:'高考标准题型',types:[
        {name:'听力',max:30,questionCount:20}, {name:'阅读',max:50,questionCount:20},
        {name:'完型',max:15,questionCount:10}, {name:'适当形式填空',max:15,questionCount:10},
        {name:'小作文',max:10,manualScore:true}, {name:'大作文',max:30,manualScore:true}
    ]};
    const builtin = id => window.gk2JLPT.templateFor(id);
    const route = (kind, category, campus) => 'gakuten-templates?' + new URLSearchParams({
        kind,category,...(campus ? {campus} : {})
    });
    const request = (path,body) => window.gk2TeacherAccounts.directoryRequest(path,body);
    async function readLibrary(path) {
        const result = await request(path);
        if (result.templateScope !== new URLSearchParams(path.split('?')[1]).get('kind')) {
            throw Error('共享模板服务尚未启用，可使用内置模板。');
        }
        return result;
    }

    function stageOf(grade,date) {
        if (stages.includes(grade)) return grade;
        const cohort = /^(\d{4})(?:级|届入学)$/.exec(grade);
        const year = Number(date?.slice(0,4));
        const month = Number(date?.slice(5,7));
        return cohort && month ? stages[year - Number(cohort[1]) - (month < 9 ? 1 : 0)] : undefined;
    }

    UI.prototype.refreshScopedExamTemplates = async function () {
        const auth = identity();
        if (!enabled()) return;
        const active = window.gk2TeacherAccounts.classInfo(auth).find(row=>row.campus===auth.campus &&
            row.grade===auth.grade && row.teachingClass===auth.classId);
        const kinds = auth.sharedDirectory ? [active?.teachingCategory].filter(category=>Object.hasOwn(categories,category))
            : Object.keys(categories);
        const roster = await (auth.sharedDirectory ? Promise.resolve(null) : request('roster'));
        if (JSON.stringify(identity())!==JSON.stringify(auth)) return;
        this.scopedTemplateClasses = roster ? Object.values(roster.classes).map(room=>room.info) : null;
        const reads = kinds.map(async category=>({
            category,
            system:await readLibrary(route('system',category)),
            ...(auth.sharedDirectory && {campus:await readLibrary(route('campus',category,auth.campus))})
        }));
        const results = await Promise.allSettled(reads);
        if (JSON.stringify(identity())!==JSON.stringify(auth)) return;
        this.scopedExamTemplates = results.flatMap(result=>result.status==='fulfilled' ? [result.value] : []);
        this.scopedTemplateError = results.find(result=>result.status==='rejected')?.reason.message;
        this.refreshExamTemplateSelect(document.getElementById('m-template-select').value);
    };

    const originalRefresh = UI.prototype.refreshExamTemplateSelect;
    UI.prototype.refreshExamTemplateSelect = function (selected) {
        originalRefresh.call(this,selected);
        const select = document.getElementById('m-template-select');
        if (!select || !enabled()) return;
        if (identity()?.sharedDirectory) {
            const privateIds = new Set(this.store.state.personalExamTemplates?.templates.map(template=>template.id));
            for (const option of [...select.options]) if (privateIds.has(option.value)) option.remove();
        }
        const option = new Option('系统通用 · 高考标准题型',standard.id);
        option.dataset.teachingCategory='gaokao';
        select.insertBefore(option,select.children[1] || null);
        for (const library of this.scopedExamTemplates || []) {
            for (const [kind,label] of [['campus','校区模板'],['system','系统通用']]) {
                for (const template of library[kind]?.templates || []) {
                    const option = new Option([label,categories[library.category],template.stage,template.name].filter(Boolean).join(' · '),template.id);
                    option.dataset.teachingCategory=library.category;
                    select.append(option);
                }
            }
        }
        if ([...select.options].some(option=>option.value===selected)) select.value=selected;
    };
    const oldSave = UI.prototype.saveExamTemplate;
    UI.prototype.saveExamTemplate = function () {
        if (!enabled()) return oldSave.call(this);
        const types = this.collectCurrentQuestionTypes();
        if (!types?.length) return Utils.msg('请先填写有效题型。','error');
        const selected = document.getElementById('m-template-select').value;
        return this.openExamTemplateManager({types,assessmentRule:this.examTemplateRule(selected)});
    };
    const customized = (ui,id) => id===standard.id && enabled() ? standard : (ui.scopedExamTemplates || []).flatMap(item=>
        [...(item.campus?.templates || []),...item.system.templates]).find(template=>template.id===id);
    UI.prototype.examTemplateRule = function (id) {
        return (customized(this,id) || builtin(id))?.assessmentRule;
    };
    const originalLoad = UI.prototype.loadExamTemplate;
    UI.prototype.loadExamTemplate = function (id,options) {
        id ||= document.getElementById('m-template-select')?.value;
        const template = customized(this,id);
        if (!template) return originalLoad.call(this,id,options);
        const entries = this.store.state.data.examTemplates;
        entries.push(template);
        try { return originalLoad.call(this,id,options); }
        finally { entries.pop(); }
    };
    UI.prototype.scopedExamDefault = function (category,grade,date,multiCampus) {
        const library = (this.scopedExamTemplates || []).find(item=>item.category===category);
        const stage = stageOf(grade,date);
        if (!multiCampus && stage && library?.campus?.defaults[stage]) return library.campus.defaults[stage];
        if (stage && library?.system.defaults[stage]) return library.system.defaults[stage];
        if (category==='study-abroad') return 'jlpt-mock:N5';
        if (category==='gaokao') return standard.id;
    };
    const oldDefault = UI.prototype.getDefaultExamTemplate;
    UI.prototype.getDefaultExamTemplate = function () {
        return enabled() ? null : oldDefault.call(this);
    };

    const originalOpen = UI.prototype.openExamTemplateManager;
    UI.prototype.openExamTemplateManager = function (draft) {
        if (!enabled()) return originalOpen.call(this);
        const ui = this;
        const auth = identity();
        const dialog = document.createElement('dialog');
        dialog.className = 'dialog-shell dialog--lg exam-template-library';
        dialog.setAttribute('aria-label',auth.sharedDirectory ? '校区模板管理' : '系统通用模板管理');
        dialog.innerHTML = `
            <div class="dialog-header"><strong>${auth.sharedDirectory ? '校区模板' : '系统通用模板'}</strong>
            <button type="button" data-close>关闭</button></div>
            <div class="dialog-body">
                <label>班型 <select data-category></select></label>
                <label>模板 <select data-template></select></label>
                <label>名称 <input data-name maxlength="60"></label>
                <label>适用学段 <select data-stage><option value="">不限学段</option>
                    <option>高一</option><option>高二</option><option>高三</option></select></label>
                <label><input type="checkbox" data-default> 设为所选学段默认</label>
                <div id="gk2-shared-template-questions" data-questions></div>
                <button type="button" data-add>添加题型</button>
                <button type="button" data-import>从旧模板复制</button>
                <button type="button" data-save>保存模板</button>
                <p role="status" data-status></p>
            </div>`;
        const field = name=>dialog.querySelector('[data-'+name+']');
        const kind = auth.sharedDirectory ? 'campus' : 'system';
        const authorized = auth.sharedDirectory ? window.gk2TeacherAccounts.classInfo(auth)
            .filter(row=>row.campus===auth.campus).map(row=>row.teachingCategory) : Object.keys(categories);
        for (const category of new Set(authorized.filter(value=>Object.hasOwn(categories,value)))) {
            field('category').add(new Option(categories[category],category));
        }
        let state, endpoint, rule, loading = false;
        const add = (type={}) => {
            const row = document.createElement('div');
            row.className = 'q-row';
            row.innerHTML = ui._renderQuestionRow({name:type.name || '',max:type.max ?? '',questionCount:type.questionCount ?? '',
                manualScore:!!type.manualScore,old:null});
            row.querySelector('.q-drag-handle').remove();
            row.querySelectorAll('[oninput],[onchange]').forEach(control=>{
                control.removeAttribute('oninput');
                control.removeAttribute('onchange');
            });
            const remove = row.querySelector('.q-delete');
            remove.setAttribute('aria-label','移除题型');
            remove.onclick=()=>row.remove();
            field('questions').append(row);
        };
        const apply = (template,checked=false) => {
            field('name').value=template?.name || '';
            field('stage').value=template?.stage || '';
            field('default').checked=checked;
            field('questions').replaceChildren();
            rule=template?.assessmentRule;
            for (const type of template?.types || [{}]) add(type);
        };
        async function read(selected='') {
            if (!field('category').value) throw Error('请先为教学班设置班型。');
            state=null;
            field('template').replaceChildren(new Option('正在读取模板',''));
            endpoint=route(kind,field('category').value,auth.campus);
            state=await readLibrary(endpoint);
            field('template').replaceChildren(new Option('新建模板',''),...state.templates.map(t=>new Option(t.name,t.id)));
            field('template').value=selected;
            field('template').onchange();
        }
        const run = async operation => {
            if (loading) return;
            loading=true;
            field('status').textContent='';
            field('category').disabled=field('save').disabled=true;
            try { await operation(); }
            catch (error) { field('status').textContent=error.message; }
            finally { loading=false; field('category').disabled=false; field('save').disabled=!state; }
        };
        field('close').onclick=()=>dialog.close();
        field('add').onclick=()=>add();
        field('category').onchange=()=>run(()=>read());
        field('template').onchange=()=>{
            const template=state?.templates.find(item=>item.id===field('template').value);
            apply(template || (!field('template').value && draft),!!template && state.defaults[template.stage]===template.id);
        };
        field('import').onclick=()=>{
            const legacy = ui.store.state.data.examTemplates.filter(t=>!t._deleted);
            const choices = field('category').value==='study-abroad'
                ? [...Object.values(window.gk2JLPT.templates).filter(t=>t.assessmentRule.kind==='jlpt-mock'),...legacy] : [standard,...legacy];
            const select = document.createElement('select');
            select.setAttribute('aria-label','选择源模板');
            select.append(new Option('选择源模板',''),...choices.map(t=>new Option(t.name,t.id)));
            select.onchange=()=>{
                const source=choices.find(t=>t.id===select.value);
                if (!source) return;
                field('template').value='';
                apply(source);
                select.remove();
            };
            field('import').after(select);
        };
        field('save').onclick=()=>run(async()=>{
            if (!state) throw Error('请先加载模板。');
            const name=field('name').value.trim();
            const stage=field('stage').value || null;
            if (!name || (field('default').checked && !stage)) throw Error('请输入模板名称，设置默认时请选择学段。');
            const questionList=field('questions');
            const types=ui._collectQuestionTypesFromList(questionList.id);
            if (!types?.length) throw Error('请填写有效题型和满分。');
            const id=field('template').value || Utils.id();
            const defaults={...state.defaults};
            for (const previous of Object.keys(defaults)) if (defaults[previous]===id && previous!==stage) delete defaults[previous];
            if (field('default').checked) defaults[stage]=id;
            else if (defaults[stage]===id) delete defaults[stage];
            const template={id,name,types,stage,...(rule && {assessmentRule:rule})};
            const entries=state.templates.filter(item=>item.id!==id).concat(template);
            if (JSON.stringify(identity())!==JSON.stringify(auth)) throw Error('当前账号已切换，请重新打开模板管理。');
            await request(endpoint,{version:state.version,templates:entries,defaults});
            await read(id);
            await ui.refreshScopedExamTemplates();
            field('status').textContent='已保存。更改适用于之后新建的考试。';
        });
        dialog.addEventListener('close',()=>dialog.remove(),{once:true});
        document.body.append(dialog);
        dialog.showModal();
        run(()=>read());
    };
})();
