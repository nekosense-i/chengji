(() => {
    const directory = window.gk2TeacherAccounts;
    if (!directory.sharedDirectoryAvailable()) return;
    const actions = window.gk2SharedRoster;
    const auth = () => window.__gakutenAuth.getAuth();
    const request = (route, body) => directory.directoryRequest(route, body);
    const active = () => auth()?.mode === 'admin';
    let reading, writing, epoch;
    const localDate = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());

    function apply(state) {
        const {ui,store} = window.app;
        const data = store.state.data;
        const renamed = actions.applyRenames(state,data);
        const {changed,gradeChanges} = actions.project(state,data,{
            timestamp:Date.now(),effectiveDate:localDate(),
            participates:(student,exam)=>Utils.isStudentInExam(student,exam) && student.grade === exam.grade
        });
        if (gradeChanges.length) throw Error('共享名单包含跨年级的历史学生，请先核对其考试归属。');
        if (!changed.length && !renamed) return;
        const byId = new Map(changed.map(student=>[student.id,student]));
        const known = new Set(data.students.map(student=>student.id));
        data.students = data.students.map(student=>byId.get(student.id) || student)
            .concat(changed.filter(student=>!known.has(student.id)));
        store.save();
        ui.refresh();
    }

    async function ensureReady() {
        const {sync,store} = window.app;
        if (!active()) throw Error('只有管理员可调整共享名单。');
        if (!sync.isEnabled() || sync.isPulling || sync.isPushing || store.hasPendingDelta()) {
            throw Error('请等成绩云同步完成后再更新名单。');
        }
        const before = store.state.syncMeta.lastPulledAt || 0;
        await sync.pull({manual:true});
        if (!active() || !(store.state.syncMeta.lastPulledAt > before) || store.state.syncMeta.lastError) {
            throw Error('未能确认云端成绩版本，名单暂未更新。');
        }
    }

    async function refresh() {
        if (!active() || reading || writing || !window.app?.sync?.isEnabled() ||
            window.app.sync.isPushing || window.app.sync.isPulling || window.app.store.hasPendingDelta()) return;
        reading = true;
        try {
            const state = await request('roster');
            if (state.revision === epoch) return;
            await ensureReady();
            apply(state);
            epoch = state.revision;
        } catch (error) {
            if (error.status !== 401 && error.status !== 403) Utils.msg(error.message,'error');
        } finally {
            reading = false;
        }
    }

    async function update(command) {
        if (!active() || reading || writing) {
            Utils.msg('请用管理员账号，等当前名单同步完成后再操作。','error');
            return false;
        }
        writing = true;
        try {
            const state = await request('roster');
            if (!active() || state.user?.role !== 'admin') throw Error('管理员会话已失效，请返回主登录页重新登录。');
            await ensureReady();
            apply(state);
            let next;
            if (command.kind === 'import') {
                await request('roster-import',{userId:state.user.id,operationId:crypto.randomUUID(),rows:command.rows});
                next = await request('roster');
            } else {
                next = await actions.submit(state,command,request,crypto.randomUUID());
            }
            if (!active()) throw Error('名单已写入云端。请重新登录查看。');
            apply(next);
            epoch = next.revision;
            Utils.msg('已保存共享名单。','success');
            return true;
        } catch (error) {
            Utils.msg(error.status === 401 || error.status === 403 ?
                '管理员会话已失效，请返回主登录页重新登录。' : error.message,'error');
            return false;
        } finally {
            writing = false;
        }
    }

    const openExam = UI.prototype.openExamModal;
    UI.prototype.openExamModal = function (...args) {
        const result = openExam.apply(this,args);
        if (active()) {
            const call = request('roster');
            this.sharedExamDirectory = {pending:true};
            const load = this.sharedExamDirectory;
            call.then(state=>Object.assign(load,{state,pending:false}),
                error=>Object.assign(load,{error,pending:false}));
        }
        return result;
    };
    UI.prototype.sharedExamParticipants = function (grade,classScope) {
        if (!active()) return null;
        const load = this.sharedExamDirectory;
        if (load?.pending) throw Error('正在读取参试班级，请稍候。');
        if (!load?.state) throw Error('未能读取共享班级，请重新打开新建考试窗口。');
        return actions.examParticipants(load.state,grade,classScope);
    };

    const edit = UI.prototype.updStu;
    UI.prototype.updStu = function (id, field, value) {
        if (!active() || !['name','adminClass','campus','teachingClass','grade'].includes(field)) {
            return edit.call(this,id,field,value);
        }
        const student = this.store.state.data.students.find(item=>item.id===id);
        if (field === 'grade' && student && this.store.state.data.scores.some(score=>score.studentId===id &&
            !this.store.state.data.exams.find(exam=>exam.id===score.examId)?.sharedParticipants)) {
            Utils.msg('这个学生已有历史成绩，跨年级变更需要先核对考试归属。','error');
            this.refresh();
            return;
        }
        return update({kind:'edit',gakutenId:id,field,value:String(value ?? '').trim()});
    };

    const add = UI.prototype.doAddStudent;
    UI.prototype.doAddStudent = async function () {
        if (!active()) return add.call(this);
        const input = id => document.getElementById(id).value.trim();
        const profile = {
            name:input('as-name'),campus:input('as-campus'),grade:input('as-grade'),
            teachingClass:input('as-tclass') || '未分日语班',adminClass:input('as-aclass') || '-'
        };
        if (!profile.name || !profile.campus || !profile.grade) return Utils.msg('姓名、校区和年级为必填项','error');
        if (await update({kind:'add',profile,studentId:crypto.randomUUID(),classId:crypto.randomUUID()})) {
            document.getElementById('modal-add-student').close();
        }
    };

    const remove = UI.prototype._archiveRosterStudents;
    UI.prototype._archiveRosterStudents = function (ids) {
        if (!active()) return remove.call(this,ids);
        return update({kind:'archive-many',gakutenIds:ids});
    };

    UI.prototype.addTeachingCategoryField = async function (dialog,kind,campus,grade,teachingClass) {
        if (!active() || kind !== 'teachingClass') return;
        const field = dialog.querySelector('[data-group-name]');
        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = '教学类别';
        const select = document.createElement('select');
        select.setAttribute('aria-label','教学类别');
        for (const [name,id] of [['未分类',''],['高考日语','gaokao'],['留学','study-abroad']]) {
            select.add(new Option(name,id));
        }
        select.disabled = true;
        label.append(select);
        field.after(label);
        try {
            const state = await request('roster');
            const info = Object.values(state.classes).map(room=>room.info).find(info=>
                info.campus === campus && info.grade === grade && info.teachingClass === teachingClass);
            if (!info || !dialog.open) return;
            select.value = info.teachingCategory || '';
            select.dataset.initial = select.value;
            select.disabled = false;
        } catch (error) {
            label.remove();
            Utils.msg(error.message,'error');
        }
        select.dataset.sharedTeachingCategory = '';
    };

    UI.prototype.submitTeachingCategory = function (dialog,campus,grade,teachingClass,nextName) {
        const select = dialog.querySelector('[data-shared-teaching-category]');
        if (!select || select.disabled || select.value === select.dataset.initial) return null;
        if (nextName !== teachingClass) {
            Utils.msg('请先保存教学类别，再单独修改班级名称。','error');
            return Promise.resolve(false);
        }
        return update({kind:'set-category',campus,grade,teachingClass,category:select.value});
    };

    UI.prototype.submitSharedGroupRename = function (field,original,name,campus,grade) {
        if (!active()) return null;
        if (field === 'grade' && this.store.state.data.exams.some(exam=>exam.grade===original)) {
            Utils.msg('该年级已有考试，请先核对历史归属。','error');
            return Promise.resolve(false);
        }
        return update({kind:'rename-group',field,original,name,campus,grade});
    };

    UI.prototype.submitSharedRosterBulkEdit = function (ids,fields,tagChange) {
        if (!active() || !Object.keys(fields).length) return null;
        if (tagChange) {
            Utils.msg('请分开提交名单资料和学生标签。','error');
            return Promise.resolve(false);
        }
        if (fields.grade && this.store.state.data.scores.some(score=>ids.includes(score.studentId) &&
            !this.store.state.data.exams.find(exam=>exam.id===score.examId)?.sharedParticipants)) {
            Utils.msg('所选学生已有历史成绩，跨年级变更需要先核对考试归属。','error');
            return Promise.resolve(false);
        }
        return update({kind:'edit-many',gakutenIds:ids,fields});
    };

    UI.prototype.submitSharedRosterImport = function (rows) {
        return active() ? update({kind:'import',rows}) : null;
    };

    const view = UI.prototype.renderStudents;
    UI.prototype.renderStudents = function (...args) {
        const result = view.apply(this,args);
        if (this.cur === 'students') queueMicrotask(refresh);
        return result;
    };
    const refreshVisibleRoster = () => {
        if (!document.hidden && window.app?.ui?.cur === 'students') refresh();
    };
    window.addEventListener('focus',refreshVisibleRoster);
    setInterval(refreshVisibleRoster,20000);
})();
