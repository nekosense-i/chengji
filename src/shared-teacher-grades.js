(() => {
    if (!window.gk2TeacherWorkspaceId) return;
    const identity = () => window.__gakutenAuth.getAuth();
    const key = score => JSON.stringify([score.studentId,score.examId]);
    const cell = ({studentId,examId,field,part}) => JSON.stringify([studentId,examId,field,part]);
    const sectionFields = ['details','questionCounts'];
    const plainFields = ['estimatedTotal','examAbsent'];
    let inFlight, timer, conflict, lastCloudContent, examWriteVersion = 0, refreshAfterSync = false;
    const meter = {state:'busy',error:'',lastPushedAt:0};

    function edits(before, after) {
        const baseline = new Map(before.map(score=>[key(score),score]));
        const current = new Map(after.map(score=>[key(score),score]));
        const result = [];
        for (const id of new Set([...baseline.keys(),...current.keys()])) {
            const previous = baseline.get(id), next = current.get(id);
            const {studentId,examId} = next || previous;
            const add = (field, part, oldValue, newValue) => {
                const from = oldValue ?? null, to = newValue ?? null;
                if (from !== to) result.push({studentId,examId,field,part,before:from,after:to});
            };
            for (const field of sectionFields) {
                const oldValues = previous?.[field] || {}, newValues = next?.[field] || {};
                for (const part of new Set([...Object.keys(oldValues),...Object.keys(newValues)])) {
                    add(field,part,oldValues[part],newValues[part]);
                }
            }
            for (const field of plainFields) {
                // Older local startup code fills in false without a teacher edit.
                if (field === 'examAbsent' && previous?.[field] == null && next?.[field] === false && !next._fieldTs?.__examAbsent) continue;
                add(field,undefined,previous?.[field],next?.[field]);
            }
            if (next && next._totalMode !== 'details-v1' &&
                (!Object.keys(next.details || {}).length || previous && next.total !== previous.total &&
                    JSON.stringify(next.details) === JSON.stringify(previous.details))) {
                add('total',undefined,previous?.total,next.total);
            }
        }
        return result;
    }

    function readSnapshot(body) {
        const data = body?.data;
        if (!Array.isArray(data?.students) || !Array.isArray(data.exams) ||
            !Array.isArray(data.scores) || !Array.isArray(data.examTemplates)) {
            throw Error('云端成绩格式无效');
        }
        return body;
    }

    function canSubmit(change, students, exams, scopes) {
        const student = students.get(change.studentId);
        const exam = exams.get(change.examId);
        if (!student || !exam) return false;
        if (exam.teacherParticipants) return Object.hasOwn(exam.teacherParticipants,student.id);
        const date = String(exam.date || '').slice(0,10);
        const history = student.classHistory || [];
        const place = history.findLast(entry=>entry.from <= date && (!entry.to || entry.to >= date)) || history[0] || student;
        const campuses = exam.campuses?.length ? exam.campuses : exam.campus ? [exam.campus] : [];
        return student.grade === exam.grade && student.rosterMembership?.archivedAt == null &&
            !student.rosterMembership?.excludedExamIds?.includes(exam.id) &&
            (!campuses.length || campuses.includes(place.campus)) &&
            (!exam.classScope || exam.classScope.includes(JSON.stringify([place.campus,place.teachingClass]))) &&
            scopes.has(JSON.stringify([place.campus,exam.grade,place.teachingClass]));
    }

    function status(text, tone) {
        const sync = window.app?.sync;
        meter.state = tone === 'synced' ? 'healthy' : tone;
        meter.error = tone === 'error' ? text : '';
        sync?.setDot(tone,text);
        window.gk2RenderCloudLamp?.();
    }

    // A single historical batch was independently matched field by field against
    // cloud revision 1011. Preserve the exact batch locally when retiring it.
    async function archiveVerifiedBatch(store, auth) {
        const held = store.state.sharedTeacherHeldChanges;
        if (!crypto.subtle || !Array.isArray(held) || held.length !== 5382) return;
        const payload = JSON.stringify(held);
        const hash = async value => Array.from(new Uint8Array(
            await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
        ), byte=>byte.toString(16).padStart(2,'0')).join('');
        const [identityHash,batchHash] = await Promise.all([hash(auth.teacherId),hash(payload)]);
        if (identityHash !== '0aab0b06d192ceb47d83ca02d930e60e2fa5fb9e653945224ea8d88e5f0cde9b' ||
            batchHash !== '7c6fb83253cbf0dc693b1d293ca92e2167647da9af5e36f1751ac783a0d610ba' ||
            identity()?.teacherId !== auth.teacherId ||
            JSON.stringify(store.state.sharedTeacherHeldChanges) !== payload) return;
        const previous = store.state.sharedTeacherVerifiedArchives;
        store.state.sharedTeacherVerifiedArchives = [...(previous || []),{
            cloudRevision:1011,verifiedAt:'2026-11-27',changes:held
        }];
        store.state.sharedTeacherHeldChanges = [];
        try {
            store.writeLocalState();
        } catch (error) {
            store.state.sharedTeacherHeldChanges = held;
            store.state.sharedTeacherVerifiedArchives = previous;
            throw error;
        }
    }

    async function synchronize() {
        const auth = identity();
        const {store,ui} = window.app || {};
        if (!auth?.sharedDirectory || !store || inFlight || conflict || document.hidden || !navigator.onLine) return;
        inFlight = true;
        if (meter.state !== 'healthy') status('正在同步教师成绩','busy');
        const data = store.state.data;
        const before = store.state.sharedTeacherBaseline;
        const fingerprint = JSON.stringify(data.scores);
        const examVersion = examWriteVersion;
        try {
            const current = await window.gk2TeacherAccounts.restoreSharedSession(auth);
            if (identity()?.teacherId !== auth.teacherId || identity()?.campus !== auth.campus ||
                identity()?.grade !== auth.grade || identity()?.classId !== auth.classId) return;
            if (!current) {
                window.__gakutenAuth.clearAuth();
                location.reload();
                return;
            }
            if (current.campus !== auth.campus || current.grade !== auth.grade || current.classId !== auth.classId) {
                store.writeLocalState();
                window.__gakutenAuth.saveAuth(current);
                location.reload();
                return;
            }
            window.__gakutenAuth.saveAuth(current);
            if (current.version !== auth.version) ui.initGlobalFilters();
            await archiveVerifiedBatch(store,auth);
            const held = store.state.sharedTeacherHeldChanges || [];
            const pending = new Map(held.map(change=>[cell(change),change]));
            for (const change of before ? edits(before,data.scores) : []) pending.set(cell(change),change);
            const request = options => window.gk2TeacherAccounts.gradeRequest({
                cache:'no-store',signal:AbortSignal.timeout(12000),...options
            });
            const read = await request();
            const payload = await read.json();
            if (!read.ok) throw Error(payload.error || '云端成绩读取失败');
            let snapshot = readSnapshot(payload);
            if (examVersion !== examWriteVersion || identity()?.teacherId !== auth.teacherId ||
                JSON.stringify(store.state.data.scores) !== fingerprint) return;
            const students = new Map(snapshot.data.students.map(student=>[student.id,student]));
            const exams = new Map(snapshot.data.exams.map(exam=>[exam.id,exam]));
            const cloudScores = new Map(snapshot.data.scores.map(score=>[key(score),score]));
            const scopes = new Set(window.gk2TeacherAccounts.classScopes(current));
            const changes = [], heldChanges = [];
            for (const change of pending.values()) {
                const score = cloudScores.get(key(change));
                const value = change.part === undefined ? score?.[change.field] : score?.[change.field]?.[change.part];
                const writable = canSubmit(change,students,exams,scopes);
                if ((value ?? null) === change.after && (score || writable)) continue;
                if (writable) changes.push(change);
                else heldChanges.push(change);
            }
            const operationId = changes.length ? crypto.randomUUID() : null;
            if (operationId) {
                const response = await request({method:'POST',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({operationId,changes})});
                const body = await response.json();
                if (response.status === 409 && body.conflict) {
                    conflict = true;
                    const item = body.conflict;
                    status('分项冲突，修改已保存在本机','error');
                    ui.showConfirmDialog(
                        '这项成绩在另一设备上有更新。云端值：'+(item.current ?? '未录入')+'；本机值：'+(item.submitted ?? '未录入')+'。确认保留本机值后将重新提交。',
                        () => {
                            if (!identity()?.sharedDirectory || identity().teacherId !== auth.teacherId) return;
                            const parked = held.find(change=>cell(change) === cell(item));
                            if (parked) parked.before = item.current;
                            let row = (store.state.sharedTeacherBaseline ||= []).find(score=>score.studentId===item.studentId && score.examId===item.examId);
                            if (!row) {
                                row = {studentId:item.studentId,examId:item.examId,details:{}};
                                store.state.sharedTeacherBaseline.push(row);
                            }
                            const target = item.part ? (row[item.field] ??= {}) : row;
                            const field = item.part || item.field;
                            if (item.current === null) delete target[field];
                            else target[field] = item.current;
                            conflict = false;
                            store.writeLocalState();
                            synchronize();
                        },'保留本机值');
                    const dialog = document.querySelector('dialog[open]');
                    dialog?.addEventListener('close',()=>{
                        if (conflict) {
                            conflict = false;
                            status('有待核对的本机成绩，下一次同步会重新提示','error');
                        }
                    },{once:true});
                    return;
                }
                if (!response.ok) throw Error(body.error || '云端成绩暂未确认');
                if (body.operationId !== operationId) throw Error('未收到本次录分的云端确认');
                snapshot = readSnapshot(body.snapshot);
            }
            if (examVersion !== examWriteVersion || identity()?.teacherId !== auth.teacherId ||
                JSON.stringify(store.state.data.scores) !== fingerprint) return;
            const cloudContent = JSON.stringify(snapshot.data);
            ui.teacherExamClasses = snapshot.examClasses || [];
            snapshot.data.examTemplates = snapshot.data.examTemplates.concat(store.state.personalExamTemplates?.templates || []);
            const dataChanged = lastCloudContent === undefined
                ? JSON.stringify(data) !== JSON.stringify(snapshot.data)
                : cloudContent !== lastCloudContent;
            const previousHeld = store.state.sharedTeacherHeldChanges;
            store.state.sharedTeacherHeldChanges = heldChanges;
            store.state.data = snapshot.data;
            store.state.sharedTeacherBaseline = structuredClone(snapshot.data.scores);
            try {
                store.writeLocalState();
            } catch (error) {
                store.state.data = data;
                store.state.sharedTeacherBaseline = before;
                store.state.sharedTeacherHeldChanges = previousHeld;
                throw error;
            }
            lastCloudContent = cloudContent;
            store.pendingDelta = null;
            store._syncInFlight = null;
            store.lastLocalDataSnapshot = store.cloneSyncState();
            store.rebuildScoreIndex();
            if (dataChanged) {
                if (!document.activeElement?.classList.contains('score-input') && !document.querySelector('dialog[open]')) ui.refresh();
                else ui.pendingRemoteRefresh = true;
            }
            if (operationId) meter.lastPushedAt=Date.now();
            store.state.syncMeta.lastError='';
            status(heldChanges.length ? '云端已连接，部分修改仅保留在本机' : '云端已确认','synced');
            if (!Number.isInteger(store.state.personalExamTemplates?.version)) ui.syncPersonalExamTemplates?.();
        } catch (error) {
            status(error.message+'。本机修改已保留。','error');
        } finally {
            inFlight = false;
            if (refreshAfterSync) {
                refreshAfterSync = false;
                synchronize();
            }
        }
    }

    const save = Store.prototype.save;
    Store.prototype.save = function (...args) {
        const result = save.apply(this,args);
        clearTimeout(timer);
        timer = setTimeout(synchronize,1600);
        return result;
    };
    window.gk2TeacherGradeSyncStatus = () => {
        const state=window.app?.store?.state;
        const pending=state?.sharedTeacherBaseline ? edits(state.sharedTeacherBaseline,state.data.scores).length : 0;
        return {...meter,pending,held:state?.sharedTeacherHeldChanges?.length || 0,busy:!!inFlight || !!conflict};
    };
    window.gk2SynchronizeTeacherGrades = synchronize;
    const deleteExam = UI.prototype.deleteExam;
    UI.prototype.deleteExam = async function (id) {
        if (!identity()?.sharedDirectory) return deleteExam.call(this,id);
        if (this.teacherExamSaving || this.teacherExamChecking) return;
        this.teacherExamChecking = true;
        const auth = identity();
        try {
            const response = await window.gk2TeacherAccounts.gradeRequest({
                cache:'no-store',signal:AbortSignal.timeout(12000)
            });
            const payload = await response.json();
            if (!response.ok) throw Error(payload.error || '无法核对云端考试，请稍后重试');
            if (JSON.stringify(identity()) !== JSON.stringify(auth)) return;
            const {data} = readSnapshot(payload);
            const exam = data.exams.find(row=>row.id===id);
            if (!exam) throw Error('云端已找不到这场考试，或该考试已超出当前授权范围');
            if (exam.archivedAt) throw Error('已归档考试不能删除');
            const scoreCount = data.scores.filter(row=>row.examId===id).length;
            this.showConfirmDialog(`将「${exam.name}」及其 ${scoreCount} 条成绩删除。删除结果会同步到其他设备。`,()=>
                this.submitTeacherExamChange({action:'delete-exam',examId:id,expectedVersion:exam._ts}),'确认删除');
        } catch (error) {
            Utils.msg(error.message,'error');
        } finally {
            this.teacherExamChecking = false;
        }
    };
    const saveExamBasicInfo = UI.prototype.saveExamBasicInfo;
    UI.prototype.saveExamBasicInfo = function () {
        if (!identity()?.sharedDirectory) return saveExamBasicInfo.call(this);
        const id = document.getElementById('gk2-exam-basic-id').value;
        const exam = this.store.state.data.exams.find(row=>row.id===id);
        if (!exam) return;
        const name = document.getElementById('gk2-exam-basic-name').value.trim();
        const date = document.getElementById('gk2-exam-basic-date').value;
        const classIds = (this.teacherExamClasses || []).filter(row=>row.grade===exam.grade &&
            exam.classScope?.includes(JSON.stringify([row.campus,row.teachingClass]))).map(row=>row.id);
        return this.submitTeacherExamChange({action:'edit-exam',examId:id,expectedVersion:exam._ts,
            exam:{name,date,classIds,types:exam.types,assessmentRule:exam.assessmentRule}},
            document.getElementById('modal-exam-basic-info'));
    };
    UI.prototype.submitTeacherExamChange = async function (request, dialog) {
        if (this.teacherExamSaving) return;
        this.teacherExamSaving = true;
        try {
            const operationId = crypto.randomUUID();
            const response = await window.gk2TeacherAccounts.gradeRequest({
                method:'POST',headers:{'Content-Type':'application/json'},
                signal:AbortSignal.timeout(12000),body:JSON.stringify({...request,operationId})
            });
            const result = await response.json();
            if (!response.ok) {
                if (request.action==='create-exam' && response.status===400 && result.error==='成绩提交格式无效') {
                    throw Error('当前云端版本尚未启用教师建考。考试未创建，表单内容已保留。');
                }
                if (request.action==='delete-exam' && response.status===409 && result.error==='考试已被修改，请同步后重试') {
                    throw Error('确认期间考试在云端发生了变化。请重新点「删除此场考试」核对后再确认。');
                }
                throw Error(result.error || '考试保存失败');
            }
            if (result.operationId !== operationId) throw Error('未收到本次考试操作的云端确认，请重新核对');
            examWriteVersion++;
            dialog?.close();
            Utils.msg(request.action==='delete-exam' ? '考试已删除' : '考试更新已由云端确认');
            if (inFlight) refreshAfterSync = true;
            else await synchronize();
        } catch (error) {
            Utils.msg(error.message,'error');
        } finally {
            this.teacherExamSaving = false;
        }
    };
    window.addEventListener('load',()=>setTimeout(synchronize,0),{once:true});
    document.addEventListener('visibilitychange',()=>{ if (!document.hidden) synchronize(); });
    window.addEventListener('gk2-auth-changed',synchronize);
    window.addEventListener('online',synchronize);
    window.addEventListener('focus',synchronize);
    setInterval(synchronize,12000);
})();
