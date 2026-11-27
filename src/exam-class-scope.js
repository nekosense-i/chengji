/* Exam scopes use campus and Japanese class together. Grade belongs to the exam. */
(() => {
    const key = (campus, name) => JSON.stringify([campus, name]);
    const allows = (exam, campus, name) => !exam?.classScope || exam.classScope.includes(key(campus, name));
    function authorizedExamClasses(ui, auth) {
        const assigned = window.gk2TeacherAccounts.classInfo(auth);
        const classes = ui.teacherExamClasses?.length ? ui.teacherExamClasses : assigned;
        const active = classes.find(row=>row.campus===auth.campus && row.grade===auth.grade &&
            row.teachingClass===auth.classId);
        return active ? classes.filter(row=>row.campus===active.campus && row.grade===active.grade &&
            row.teachingCategory===active.teachingCategory) : [];
    }
    function currentTeachingGroup(exam, auth) {
        if (!auth?.sharedDirectory || !exam?.teacherParticipants) return null;
        return exam.teacherSources?.find(info=>info.campus===auth.campus && info.grade===auth.grade &&
            info.teachingClass===auth.classId) || null;
    }
    function sharedExamStudent(student, exam, auth) {
        const group = currentTeachingGroup(exam,auth);
        const place = exam.teacherParticipants[student.id];
        return !!group && !!place && place.campus===(group.examCampus || group.campus) && place.grade===(group.examGrade || group.grade) &&
            place.teachingCategory===group.teachingCategory;
    }
    const matchFocus = UI.prototype._studentMatchesFocusForExam;
    UI.prototype._studentMatchesFocusForExam = function (student,exam,focus = this.store.state.globalFocus || {}) {
        const group = currentTeachingGroup(exam,this._getAuth());
        if (group) {
            return !!student && matchFocus.call(this,student,exam,{
                ...focus,campuses:[],grades:[]
            });
        }
        return matchFocus.call(this,student,exam,focus);
    };
    const initFilters = UI.prototype.initGlobalFilters;
    UI.prototype.initGlobalFilters = function (...args) {
        const auth = this._getAuth();
        if (!auth?.sharedDirectory) return initFilters.apply(this,args);
        const focus = this.store.state.globalFocus;
        const scope = JSON.stringify([auth.campus,auth.grade,auth.classId]);
        if (this._teacherFilterScope !== scope) {
            focus.tClasses = [];
            this._teacherFilterScope = scope;
        }
        const result = initFilters.apply(this,args);
        if (this.cur === 'students') {
            const category = document.getElementById('gk2-teacher-category');
            if (category) category.hidden = true;
            return result;
        }
        const info = window.gk2TeacherAccounts.classInfo(auth);
        const active = info.find(row=>row.campus===auth.campus && row.grade===auth.grade && row.teachingClass===auth.classId);
        if (!active) return result;
        const group = row=>row.campus===auth.campus && row.grade===auth.grade && row.teachingCategory===active.teachingCategory;
        const names = new Set();
        for (const exam of this.store.state.data.exams) {
            const source = currentTeachingGroup(exam,auth);
            if (!source) continue;
            for (const place of Object.values(exam.teacherParticipants)) {
                if (place.campus===(source.examCampus || source.campus) && place.grade===(source.examGrade || source.grade) &&
                    place.teachingCategory===source.teachingCategory) names.add(place.teachingClass);
            }
        }
        for (const row of info.filter(group)) names.add(row.teachingClass);
        const options = [...names].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
        focus.tClasses = (focus.tClasses || []).filter(name=>names.has(name));
        document.getElementById('sb-cls-panel').replaceChildren();
        this._buildMultiSelect('sb-cls-panel','sb-cls-head',options,"window.app.ui.onGlobalFilterChange('tClasses')",'查看全班级',false,focus.tClasses,true);
        document.querySelectorAll('#sb-cls-panel input[type=checkbox]').forEach(input=>{ input.checked=focus.tClasses.includes(input.value); });
        this._updateMsHeader('sb-cls-panel','sb-cls-head','查看全班级',false);
        const campuses = [...new Set(info.map(row=>row.campus))];
        const grades = [...new Set(info.filter(row=>row.campus===auth.campus).map(row=>row.grade))];
        document.getElementById('sb-cam-panel').replaceChildren();
        document.getElementById('sb-grd-panel').replaceChildren();
        this._buildMultiSelect('sb-cam-panel','sb-cam-head',campuses,"window.app.ui.changeTeacherGroup('campus')",'选择校区',false,[auth.campus],true,false,true);
        this._buildMultiSelect('sb-grd-panel','sb-grd-head',grades,"window.app.ui.changeTeacherGroup('grade')",'选择年级',false,[auth.grade],true,false,true);
        for (const id of ['sb-cam-head','sb-grd-head','sb-cls-head']) {
            const head=document.getElementById(id);
            head.style.pointerEvents=''; head.style.opacity=''; head.removeAttribute('aria-disabled');
        }
        let category = document.getElementById('gk2-teacher-category');
        const categories = [...new Set(info.filter(row=>row.campus===auth.campus && row.grade===auth.grade).map(row=>row.teachingCategory))];
        if (!category) {
            category = document.createElement('select');
            category.id = 'gk2-teacher-category';
            category.className = 'sidebar-ms';
            category.setAttribute('aria-label','班级类型');
            document.getElementById('sb-grd-wrap').parentElement.after(category);
            category.onchange = () => this.changeTeacherGroup('category');
        }
        category.replaceChildren(...categories.map(value=>{
            const option=document.createElement('option');
            option.value=value;
            option.textContent=value==='study-abroad'?'留学班':value==='gaokao'?'高考日语班':'未分类';
            return option;
        }));
        category.value=active.teachingCategory;
        category.hidden=categories.length<2;
        return result;
    };
    UI.prototype.changeTeacherGroup = function (kind) {
        const auth=this._getAuth(), info=window.gk2TeacherAccounts.classInfo(auth);
        const campus=kind==='campus' ? this._getSelectedClasses('sb-cam-panel')[0] : auth.campus;
        const grade=kind==='grade' ? this._getSelectedClasses('sb-grd-panel')[0] : auth.grade;
        const category=kind==='category' ? document.getElementById('gk2-teacher-category').value : null;
        let candidate=info.find(row=>row.campus===campus && (kind==='campus' || row.grade===grade) && (!category || row.teachingCategory===category));
        if (!candidate) { this.initGlobalFilters(); return; }
        window.gk2TeacherAccounts.selectScope(auth,candidate);
    };
    function frozenPlace(student,exam) {
        if (!student || !exam?.sharedParticipants) return null;
        const row = exam.sharedParticipants.students.find(item=>item.studentId===student.id);
        return row && exam.sharedParticipants.classes.find(info=>info.id===row.classId);
    }
    const oldCanRead = Utils.canReadStudent;
    Utils.canReadStudent = function (student,exam) {
        const auth = window.__gakutenAuth?.getAuth();
        if (student && auth?.sharedDirectory && exam?.teacherParticipants) return sharedExamStudent(student,exam,auth);
        if (auth?.mode === 'admin' && exam?.sharedParticipants) return !!frozenPlace(student,exam);
        return oldCanRead(student,exam);
    };
    const oldPlace = Utils.getClassForExam;
    Utils.getClassForExam = (student,exam) => exam?.teacherParticipants?.[student?.id] || frozenPlace(student,exam) || oldPlace(student,exam);
    for (const method of ['_getExamRosterStudents','_getExamEntryStudents']) {
        const original = UI.prototype[method];
        UI.prototype[method] = function (exam) {
            const auth = this._getAuth();
            if (!auth?.sharedDirectory || !exam?.teacherParticipants) return original.call(this,exam);
            return this.store.state.data.students.filter(student=>sharedExamStudent(student,exam,auth));
        };
    }
    const policy = window.gk2Statistics;
    window.gk2Statistics = Object.freeze({
        ...policy,
        isStudentInExam(student, exam) {
            if (exam?.teacherParticipants && student) return Object.hasOwn(exam.teacherParticipants,student.id);
            if (exam?.sharedParticipants) return !!frozenPlace(student,exam);
            if (!policy.isStudentInExam(student, exam)) return false;
            if (!exam.classScope) return true;
            const place = Utils.getClassForExam(student, exam);
            return student.grade === exam.grade && allows(exam, place.campus, place.teachingClass);
        }
    });
    UI.prototype._examVisible = function(exam) {
        const auth = this._getAuth();
        if (auth?.sharedDirectory && exam?.teacherParticipants) return !!currentTeachingGroup(exam,auth);
        return auth?.mode !== 'teacher' || (exam.grade === auth.grade &&
            (!this._getExamCampuses(exam).length || this._getExamCampuses(exam).includes(auth.campus)) &&
            allows(exam, auth.campus, auth.classId));
    };
    UI.prototype._readExamClassScope = function(prefix) {
        return [...document.querySelectorAll(`#${prefix}-class-scope input:checked`)].map(input => input.value);
    };
    const classKey = (campus, grade, name) => JSON.stringify([campus, grade, name]);
    const templatesFor = ui => [
        ...ui.store.state.data.examTemplates.filter(t => !t._deleted),
        ...Object.values(window.gk2JLPT.templates).filter(t => t.assessmentRule.kind === 'jlpt-mock')
    ];
    function preferredTemplate(ui, campus, grade, name) {
        const scope = classKey(campus, grade, name);
        if (ui._getAuth()?.sharedDirectory) {
            const id = ui.store.state.personalExamTemplates?.defaults?.[scope];
            return templatesFor(ui).find(template=>template.id===id) ||
                templatesFor(ui).find(template=>template.schoolPublished && template.isDefault);
        }
        const latest = ui.store.state.data.students.reduce((best, student) => {
            const preference = student.classExamTemplate;
            const current = classKey(student.campus, student.grade, student.teachingClass);
            return current === scope && preference?.scope === scope && (!best || preference.ts > best.ts)
                ? preference : best;
        }, null);
        return templatesFor(ui).find(t => t.id === latest?.id);
    }
    const editGroup = UI.prototype.editStudentGroup;
    UI.prototype.editStudentGroup = function(kind, name, campus, grade) {
        const result = editGroup.call(this, kind, name, campus, grade);
        if (kind !== 'teachingClass' || this._getAuth()?.sharedDirectory) return result;
        const dialog = document.querySelector('.gk2-roster-group-dialog[open]');
        const field = dialog?.querySelector('.gk2-roster-group-field');
        if (!field) return result;
        const label = document.createElement('label');
        label.className = field.className;
        const caption = document.createElement('span');
        caption.textContent = '默认考试模板';
        const select = document.createElement('select');
        select.dataset.classExamTemplate = '';
        select.add(new Option('不设置', ''));
        for (const template of templatesFor(this)) select.add(new Option(template.name, template.id));
        select.value = preferredTemplate(this, campus, grade, name)?.id || '';
        select.dataset.previous = select.value;
        select.dataset.scope = classKey(campus, grade, name);
        label.append(caption, select);
        field.after(label);
        return result;
    };
    UI.prototype._saveClassTemplate = function(dialog, students, campus, grade, name) {
        const select = dialog.querySelector('[data-class-exam-template]');
        const scope = classKey(campus, grade, name);
        if (!select || (select.value === select.dataset.previous && scope === select.dataset.scope)) return false;
        const ts = Date.now();
        for (const student of students) {
            student.classExamTemplate = { scope, id: select.value, ts };
            student._ts = ts;
        }
        return true;
    };
    const renderStudents = UI.prototype.renderStudents;
    UI.prototype.renderStudents = function(...args) {
        const result = renderStudents.apply(this, args);
        for (const button of document.querySelectorAll('#tree-container-students [data-student-group-edit][data-kind="teachingClass"]')) {
            const { campus, grade, value } = button.dataset;
            const template = preferredTemplate(this, campus, grade, value);
            if (!template) continue;
            const summary = button.parentElement.querySelector(':scope > summary');
            if (!summary) continue;
            const badge = document.createElement('span');
            badge.className = 'pill';
            badge.dataset.classTemplateBadge = '';
            badge.textContent = template.name;
            summary.append(badge);
        }
        this._layoutStudentGroupEditButtons();
        return result;
    };
    function install(ui, prefix, exam) {
        const campuses = document.getElementById(prefix + '-campuses-container');
        const grade = document.getElementById(prefix + '-grade');
        const date = document.getElementById(prefix + '-edate');
        document.getElementById(prefix + '-class-scope')?.parentElement.remove();
        const auth = ui._getAuth();
        if (exam && auth?.mode === 'teacher' && !auth.sharedDirectory) return;
        const section = document.createElement('div');
        section.className = 'exam-class-scope';
        const heading = document.createElement('div');
        heading.id = prefix + '-class-scope-label';
        heading.className = 'exam-field-label';
        heading.textContent = '参与日语班';
        const box = document.createElement('div');
        box.id = prefix + '-class-scope';
        box.className = campuses.className;
        box.setAttribute('role', 'group');
        box.setAttribute('aria-labelledby', heading.id);
        section.append(heading, box);
        campuses.after(section);
        const focus = ui.store.state.globalFocus || {};
        const selected = new Set(exam?.classScope || []);
        if (!exam && auth?.sharedDirectory && [...grade.options].some(option=>option.value===auth.grade)) grade.value=auth.grade;
        else if (!exam && focus.grades?.length === 1) grade.value = focus.grades[0];
        const sharedTeacher = auth?.sharedDirectory;
        const teacherClasses = sharedTeacher ? authorizedExamClasses(ui,auth) : [];
        if (!exam && !sharedTeacher && focus.tClasses?.length) {
            const candidates = ui.store.state.data.students.filter(student => student.grade === grade.value &&
                student.rosterMembership?.archivedAt == null && focus.tClasses.includes(student.teachingClass) &&
                (!focus.campuses?.length || focus.campuses.includes(student.campus)));
            const scopes = new Set(candidates.map(student => key(student.campus, student.teachingClass)));
            if (scopes.size && (focus.tClasses.length > 1 || scopes.size === 1)) {
                const sites = new Set();
                for (const scope of scopes) {
                    selected.add(scope);
                    sites.add(JSON.parse(scope)[0]);
                }
                for (const input of campuses.querySelectorAll('input')) input.checked = sites.has(input.value);
            }
        }
        const picker = !exam && document.getElementById('m-template-select');
        let manual = false, previousAuto = '';
        if (picker) {
            picker.closest('div').parentElement.querySelector('[data-class-template-hint]')?.remove();
            const hint = document.createElement('p');
            hint.className = 'field-hint';
            hint.dataset.classTemplateHint = '';
            picker.closest('div').after(hint);
            picker.onchange = () => {
                manual = true;
                if (picker.value) ui.loadExamTemplate(picker.value, { silent: true });
                updateTemplate();
            };
        }
        function updateTemplate() {
            if (!picker) return;
            const checked = ui._readExamClassScope('m');
            const scopes = sharedTeacher && !checked.length
                ? teacherClasses.map(row=>key(row.campus,row.teachingClass)) : checked;
            const classes = ui.scopedTemplateClasses || teacherClasses;
            const chosen = classes.filter(row=>row.grade===grade.value && scopes.includes(key(row.campus,row.teachingClass)));
            const categories = new Set(chosen.map(row=>row.teachingCategory).filter(Boolean));
            const scopedCategory = categories.size===1 ? [...categories][0] : null;
            for (const option of picker.querySelectorAll('option')) {
                const category = option.dataset.teachingCategory ||
                    (option.value.startsWith('jlpt-') ? 'study-abroad' : '');
                option.hidden = option.disabled = !!(scopedCategory && category && category!==scopedCategory);
            }
            const scoped = (auth?.sharedDirectory || auth?.cloudAdmin) && ui.scopedExamDefault;
            const scopedSuggestion = scopedCategory && scoped && ui.scopedExamDefault(
                scopedCategory,grade.value,date.value,new Set(chosen.map(row=>row.campus)).size>1);
            const defaults = scoped ? (scopedSuggestion ? [scopedSuggestion] : []) : scopes.map(value => {
                const [campus, name] = JSON.parse(value);
                return preferredTemplate(ui, campus, grade.value, name)?.id || '';
            });
            const conflict = new Set(defaults).size > 1;
            const hint = document.querySelector('[data-class-template-hint]');
            const suggestion = !conflict && defaults[0];
            if (!manual && suggestion && !picker.value) {
                previousAuto = suggestion;
                ui.loadExamTemplate(suggestion, { silent: true });
            }
            if (!manual && previousAuto && !conflict && suggestion !== previousAuto) {
                if (suggestion) ui.loadExamTemplate(suggestion, { silent: true });
                else if (picker.value === previousAuto) {
                    const list = document.getElementById('q-list');
                    list.dataset.gk2JlptTemplate = '';
                    list.innerHTML = '<div class="q-row" draggable="true">' + ui._renderQuestionRow({ name: '听力', max: 30, old: null }) + '</div>';
                    const note = document.getElementById('gk2-jlpt-entry-note');
                    if (note) note.hidden = true;
                    const add = list.closest('dialog')?.querySelector('button[onclick*="addQ"]');
                    if (add) add.disabled = false;
                    picker.value = '';
                    ui._syncQuestionRows('q-list');
                }
                previousAuto = suggestion || '';
            }
            const needsTemplate = conflict && !picker.value;
            picker.setCustomValidity(needsTemplate ? '请为本场联考选择模板' : '');
            hint.textContent = conflict
                ? (picker.value ? '各班默认模板不同，保留当前模板。可为本场更换。' : '各班默认模板不同，请选择本场模板。')
                : scopes.length && !suggestion ? '所选班级未设置默认模板，可选模板或手动配置题型。'
                : ui.scopedTemplateError || (suggestion ? '已匹配本场考试的默认模板。' : '请选择模板或填写题型。');
        }
        function render() {
            const checked = [...campuses.querySelectorAll('input:checked')].map(input => input.value);
            const options = new Map();
            for (const student of ui.store.state.data.students) {
                if (student.grade !== grade.value) continue;
                const place = Utils.getClassForExam(student, { date: date.value });
                if (checked.includes(place.campus) && place.teachingClass) options.set(key(place.campus, place.teachingClass), place);
            }
            if (sharedTeacher) {
                options.clear();
                for (const row of teacherClasses) options.set(key(row.campus,row.teachingClass),row);
            }
            box.replaceChildren();
            for (const [value, place] of options) {
                if (!sharedTeacher && auth?.mode === 'teacher' && value !== key(auth.campus, auth.classId)) continue;
                const label = document.createElement('label');
                label.className = 'campus-tag-label';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = value;
                input.checked = selected.has(value) || (!sharedTeacher && (auth?.mode === 'teacher' || (!exam && options.size === 1)));
                input.disabled = !sharedTeacher && auth?.mode === 'teacher';
                input.onchange = () => {
                    if (input.checked) selected.add(value);
                    else selected.delete(value);
                    updateTemplate();
                };
                label.append(input, document.createTextNode(` ${place.campus} · ${place.teachingClass}`));
                box.append(label);
            }
            const message = !box.querySelector('input') ? '请先选择有日语班的校区和年级。'
                : !exam && sharedTeacher ? '不勾选班级时，默认纳入本校区本年级全部同类型班级。'
                : exam && !exam.classScope ? '历史考试不勾选时保留原范围。' : '';
            if (message) {
                const hint = document.createElement('span');
                hint.className = 'field-hint';
                hint.textContent = message;
                box.append(hint);
            }
            updateTemplate();
        }
        if (picker) document.getElementById('q-list').oninput = () => { manual = true; };
        campuses.onchange = grade.onchange = date.onchange = render;
        render();
        if (picker && (auth?.sharedDirectory || auth?.cloudAdmin)) {
            ui.refreshScopedExamTemplates?.().then(()=>{
                if (picker.isConnected && picker.closest('dialog')?.open) render();
            }).catch(error=>Utils.msg(error.message,'error'));
        }
    }
    UI.prototype.selectCreatedExam = function (id) {
        const exam = this.store.state.data.exams.find(row=>row.id===id);
        if (!exam || !this._examVisible(exam)) return false;
        const select = document.getElementById('global-exam');
        this.initGlobalExamsDropdown(false,false);
        if (![...select.options].some(option=>option.value===id)) {
            Object.assign(this.store.state.globalFocus,{campuses:[],grades:[],phases:[],tClasses:[]});
            this.initGlobalFilters();
            this.initGlobalExamsDropdown(false,false);
        }
        if (![...select.options].some(option=>option.value===id)) return false;
        select.value = id;
        this.onGlobalExamChange();
        if (this.cur !== 'exams') window.gk2.navigate('exams');
        return true;
    };
    const create = UI.prototype.openExamModal;
    UI.prototype.openExamModal = function(...args) {
        const result = create.apply(this, args);
        install(this, 'm');
        return result;
    };
    const submitExam = UI.prototype.doCreateExam;
    UI.prototype.doCreateExam = function(...args) {
        const picker = document.getElementById('m-template-select');
        if (picker?.validity.customError && !picker.value) return picker.reportValidity();
        const auth = this._getAuth();
        if (auth?.sharedDirectory) {
            const selection = new Set(this._readExamClassScope('m'));
            const candidates = authorizedExamClasses(this,auth);
            const scopeClassId = candidates.find(row=>row.teachingClass===auth.classId)?.id;
            const classIds = candidates.filter(row=>selection.has(key(row.campus,row.teachingClass))).map(row=>row.id);
            const name = document.getElementById('m-ename').value.trim();
            const date = document.getElementById('m-edate').value;
            const types = this.collectCurrentQuestionTypes();
            if (!name || !date || !scopeClassId || !types?.length) {
                return Utils.msg('请填写考试名称、日期、参试班和有效题型','error');
            }
            const assessmentRule = this.examTemplateRule(picker?.value);
            return this.submitTeacherExamChange({
                action:'create-exam',examId:Utils.id(),exam:{name,date,classIds,scopeClassId,types,assessmentRule}
            },document.getElementById('modal-exam'));
        }
        return submitExam.apply(this, args);
    };
    const openBasic = UI.prototype.openEditExamBasicInfoModal;
    UI.prototype.openEditExamBasicInfoModal = function(id) {
        const exam = this.store.state.data.exams.find(e => e.id === id);
        if (!exam || !this._examVisible(exam)) return;
        const isAdmin = this._getAuth()?.mode === 'admin';
        document.getElementById('gk2-exam-teacher-entry-field').hidden = !isAdmin;
        const status = document.getElementById('gk2-exam-teacher-entry');
        status.value = exam.archivedAt ? 'archived' : 'open';
        status.disabled = !!exam.archivedAt;
        const result = openBasic.call(this, id);
        for (const input of document.querySelectorAll('#modal-exam-basic-info input:not([type=hidden])')) {
            if (exam.archivedAt) input.disabled = true;
            else if (input.id==='gk2-exam-basic-name' || input.id==='gk2-exam-basic-date') input.disabled = false;
        }
        if (isAdmin) {
            const dialog = document.getElementById('gk2-exam-basic-campuses')?.closest('dialog');
            dialog?.querySelector('[data-edit-exam-scope]')?.remove();
            if (dialog && !exam.archivedAt) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'secondary';
                button.dataset.editExamScope = '';
                button.textContent = '编辑参与日语班';
                button.onclick = () => { dialog.close(); this.openEditExamModal(id); };
                document.getElementById('gk2-exam-basic-campuses').after(button);
            }
        }
        return result;
    };
    UI.prototype.backfillExamParticipants = async function () {
        if (this._getAuth()?.mode !== 'admin') return;
        try {
            const response = await window.gk2TeacherAccounts.adminGradeRequest(
                'https://sync.nekosensei.cn/gakuten-all',{
                    method:'POST',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({action:'backfill-participants',operationId:crypto.randomUUID()})
                });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || '未能补齐参试范围');
            await window.app.sync.pull({manual:true});
            Utils.msg('已补齐 '+result.updated+' 场，尚待核对 '+result.unresolved+' 场。');
        } catch (error) { Utils.msg(error.message,'error'); }
    };
    const saveEdit = UI.prototype.doEditExam;
    UI.prototype.doEditExam = function(...args) {
        const exam = this.store.state.data.exams.find(e => e.id === document.getElementById('me-eid')?.value);
        if (!exam || !this._examVisible(exam)) return;
        if (exam.archivedAt) return Utils.msg('已归档的考试不能修改评分规则。','error');
        const selected = this._readExamClassScope('me');
        const auth = this._getAuth();
        if (auth?.sharedDirectory) {
            const classIds = authorizedExamClasses(this,auth)
                .filter(row=>selected.includes(key(row.campus,row.teachingClass))).map(row=>row.id);
            const name = document.getElementById('me-ename').value.trim();
            const date = document.getElementById('me-edate').value;
            const types = this._collectQuestionTypesFromList('edit-q-list');
            if (!name || !date || !classIds.length || !types?.length) {
                return Utils.msg('请填写考试名称、日期、参试班和有效题型','error');
            }
            return this.submitTeacherExamChange({action:'edit-exam',examId:exam.id,expectedVersion:exam._ts,
                exam:{name,date,classIds,types,assessmentRule:exam.assessmentRule}},document.getElementById('modal-edit-exam'));
        }
        if (this._getAuth()?.mode !== 'teacher' && exam.classScope && !selected.length) {
            return Utils.msg('请至少勾选一个参与日语班', 'error');
        }
        return saveEdit.apply(this, args);
    };
    const edit = UI.prototype.openEditExamModal;
    UI.prototype.openEditExamModal = function(id) {
        const exam = this.store.state.data.exams.find(e => e.id === id);
        if (!exam || !this._examVisible(exam)) return;
        if (exam.archivedAt) return Utils.msg('已归档的考试不能修改评分规则。','error');
        const result = edit.call(this, id);
        install(this, 'me', exam);
        return result;
    };
})();
