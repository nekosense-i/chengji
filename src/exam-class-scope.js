/* Exam scopes use campus and Japanese class together. Grade belongs to the exam. */
(() => {
    const key = (campus, name) => JSON.stringify([campus, name]);
    const allows = (exam, campus, name) => !exam?.classScope || exam.classScope.includes(key(campus, name));
    const policy = window.gk2Statistics;
    window.gk2Statistics = Object.freeze({
        ...policy,
        isStudentInExam(student, exam) {
            if (!policy.isStudentInExam(student, exam)) return false;
            if (!exam.classScope) return true;
            const place = Utils.getClassForExam(student, exam);
            return student.grade === exam.grade && allows(exam, place.campus, place.teachingClass);
        }
    });
    UI.prototype._examVisible = function(exam) {
        const auth = this._getAuth();
        return auth?.mode !== 'teacher' || (exam.grade === auth.grade &&
            (!this._getExamCampuses(exam).length || this._getExamCampuses(exam).includes(auth.campus)) &&
            allows(exam, auth.campus, auth.classId));
    };
    UI.prototype._readExamClassScope = function(prefix) {
        return [...document.querySelectorAll(`#${prefix}-class-scope input:checked`)].map(input => input.value);
    };
    function install(ui, prefix, exam) {
        const campuses = document.getElementById(prefix + '-campuses-container');
        const grade = document.getElementById(prefix + '-grade');
        const date = document.getElementById(prefix + '-edate');
        document.getElementById(prefix + '-class-scope')?.parentElement.remove();
        const auth = ui._getAuth();
        if (exam && auth?.mode === 'teacher') return;
        const section = document.createElement('div');
        section.style.marginTop = '10px';
        const heading = document.createElement('div');
        heading.id = prefix + '-class-scope-label';
        heading.className = 'field-label mb-sm';
        heading.textContent = '参与日语班';
        const box = document.createElement('div');
        box.id = prefix + '-class-scope';
        box.className = campuses.className;
        box.style.padding = campuses.style.padding;
        box.setAttribute('role', 'group');
        box.setAttribute('aria-labelledby', heading.id);
        section.append(heading, box);
        campuses.after(section);
        let selected = new Set(exam?.classScope || []);
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
                input.onchange = () => input.checked ? selected.add(value) : selected.delete(value);
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
    const openBasic = UI.prototype.openEditExamBasicInfoModal;
    UI.prototype.openEditExamBasicInfoModal = function(id) {
        const exam = this.store.state.data.exams.find(e => e.id === id);
        if (!exam || !this._examVisible(exam)) return;
        const result = openBasic.call(this, id);
        if (this._getAuth()?.mode === 'admin') {
            const dialog = document.getElementById('gk2-exam-basic-campuses')?.closest('dialog');
            dialog?.querySelector('[data-edit-exam-scope]')?.remove();
            if (dialog) {
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
    const saveEdit = UI.prototype.doEditExam;
    UI.prototype.doEditExam = function(...args) {
        const exam = this.store.state.data.exams.find(e => e.id === document.getElementById('me-eid')?.value);
        if (!exam || !this._examVisible(exam)) return;
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
        const result = edit.call(this, id);
        install(this, 'me', exam);
        return result;
    };
})();
