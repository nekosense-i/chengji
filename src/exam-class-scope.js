/* Exam scopes use campus and Japanese class together. Grade belongs to the exam. */
(() => {
    const key = (campus, name) => JSON.stringify([campus, name]);
    const allows = (exam, campus, name) => !exam?.classScope || exam.classScope.includes(key(campus, name));
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
    UI.prototype.sharedExamClassChoices = function (auth) {
        if (!['analysis','details','workbench'].includes(this.cur)) return null;
        const exam = this.store.state.data.exams.find(item=>item.id===this.store.state.currentExamId);
        const group = currentTeachingGroup(exam,auth);
        if (!group) return null;
        const rows = Object.values(exam.teacherParticipants).filter(place=>place.campus===(group.examCampus || group.campus) &&
            place.grade===(group.examGrade || group.grade) && place.teachingCategory===group.teachingCategory);
        return {examId:exam.id,defaultClass:group.examClass || auth.classId,classes:[...new Set(rows.map(row=>row.teachingClass))]};
    };
    const matchFocus = UI.prototype._studentMatchesFocusForExam;
    UI.prototype._studentMatchesFocusForExam = function (student,exam,focus = this.store.state.globalFocus || {}) {
        const selected = this.sharedExamClassFilter;
        const group = currentTeachingGroup(exam,this._getAuth());
        if (group) {
            const className = exam.id===selected?.examId ? selected.className : group.examClass || group.teachingClass;
            return !!student && matchFocus.call(this,student,exam,{
                ...focus,campuses:[],grades:[],tClasses:className ? [className] : []
            });
        }
        return matchFocus.call(this,student,exam,focus);
    };
    const examChange = UI.prototype.onGlobalExamChange;
    UI.prototype.onGlobalExamChange = function (...args) {
        const result = examChange.apply(this,args);
        const auth = this._getAuth();
        if (auth?.sharedDirectory) window.gk2TeacherAccounts.renderClasses(document.getElementById('sb-cls-panel'),auth,true);
        return result;
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
        if (exam && auth?.mode === 'teacher') return;
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
        if (!exam && focus.grades?.length === 1) grade.value = focus.grades[0];
        if (!exam && focus.tClasses?.length) {
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
            const scopes = ui._readExamClassScope('m');
            const defaults = scopes.map(value => {
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
                else {
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
                : '本场调整不会修改班级默认模板。';
        }
        function render() {
            const checked = [...campuses.querySelectorAll('input:checked')].map(input => input.value);
            const options = new Map();
            for (const student of ui.store.state.data.students) {
                if (student.grade !== grade.value) continue;
                const place = Utils.getClassForExam(student, { date: date.value });
                if (checked.includes(place.campus) && place.teachingClass) options.set(key(place.campus, place.teachingClass), place);
            }
            box.replaceChildren();
            for (const [value, place] of options) {
                if (auth?.mode === 'teacher' && value !== key(auth.campus, auth.classId)) continue;
                const label = document.createElement('label');
                label.className = 'campus-tag-label';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = value;
                input.checked = selected.has(value) || auth?.mode === 'teacher' || (!exam && options.size === 1);
                input.disabled = auth?.mode === 'teacher';
                input.onchange = () => {
                    if (input.checked) selected.add(value);
                    else selected.delete(value);
                    updateTemplate();
                };
                label.append(input, document.createTextNode(` ${place.campus} · ${place.teachingClass}`));
                box.append(label);
            }
            const message = !box.querySelector('input') ? '请先选择有日语班的校区和年级。'
                : exam && !exam.classScope ? '历史考试不勾选时保留原范围。' : '';
            if (message) {
                const hint = document.createElement('span');
                hint.className = 'field-hint';
                hint.textContent = message;
                box.append(hint);
            }
            updateTemplate();
        }
        campuses.onchange = grade.onchange = date.onchange = render;
        render();
    }
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
