(() => {
    if (!window.gk2TeacherWorkspaceId) return;
    const identity = () => window.__gakutenAuth.getAuth();
    const key = score => JSON.stringify([score.studentId,score.examId]);
    const sectionFields = ['details','questionCounts'];
    const plainFields = ['estimatedTotal','examAbsent'];
    let inFlight, timer, conflict;

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
            for (const field of plainFields) add(field,undefined,previous?.[field],next?.[field]);
            if (next && next._totalMode !== 'details-v1' &&
                (!Object.keys(next.details || {}).length || previous && next.total !== previous.total &&
                    JSON.stringify(next.details) === JSON.stringify(previous.details))) {
                add('total',undefined,previous?.total,next.total);
            }
        }
        return result;
    }

    function status(text, tone) {
        const sync = window.app?.sync;
        sync?.setDot(tone,text);
    }

    async function synchronize() {
        const auth = identity();
        const {store,ui} = window.app || {};
        if (!auth?.sharedDirectory || !store || inFlight || conflict || document.hidden || !navigator.onLine) return;
        inFlight = true;
        const data = store.state.data;
        const before = store.state.sharedTeacherBaseline;
        const fingerprint = JSON.stringify(data.scores);
        const changes = before ? edits(before,data.scores) : [];
        try {
            const operationId = changes.length ? crypto.randomUUID() : null;
            const response = await fetch('/gakuten-teacher-grades', {
                cache:'no-store',signal:AbortSignal.timeout(12000),
                ...(operationId ? {method:'POST',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({operationId,changes})} : {})
            });
            const body = await response.json();
            if (response.status === 409 && body.conflict) {
                conflict = true;
                const item = body.conflict;
                status('分项冲突，修改已保存在本机','error');
                ui.showConfirmDialog(
                    '这项成绩在另一设备上有更新。云端值：'+(item.current ?? '未录入')+'；本机值：'+(item.submitted ?? '未录入')+'。确认保留本机值后将重新提交。',
                    () => {
                        if (!identity()?.sharedDirectory || identity().teacherId !== auth.teacherId) return;
                        let row = store.state.sharedTeacherBaseline.find(score=>score.studentId===item.studentId && score.examId===item.examId);
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
            if (identity()?.teacherId !== auth.teacherId) return;
            if (operationId && body.operationId !== operationId) throw Error('未收到本次录分的云端确认');
            const snapshot = operationId ? body.snapshot : body;
            if (!snapshot?.data || !Array.isArray(snapshot.data.students) ||
                !Array.isArray(snapshot.data.exams) || !Array.isArray(snapshot.data.scores)) {
                throw Error('云端成绩格式无效，本机修改已保留');
            }
            if (JSON.stringify(store.state.data.scores) !== fingerprint) return;
            store.state.data = snapshot.data;
            store.state.sharedTeacherBaseline = structuredClone(snapshot.data.scores);
            store.pendingDelta = null;
            store._syncInFlight = null;
            store.lastLocalDataSnapshot = store.cloneSyncState();
            store.rebuildScoreIndex();
            store.writeLocalState();
            if (!document.activeElement?.classList.contains('score-input') && !document.querySelector('dialog[open]')) ui.refresh();
            status('云端已确认','synced');
        } catch (error) {
            status(error.message+'。本机修改已保留。','error');
        } finally {
            inFlight = false;
        }
    }

    const save = Store.prototype.save;
    Store.prototype.save = function (...args) {
        const result = save.apply(this,args);
        clearTimeout(timer);
        timer = setTimeout(synchronize,1600);
        return result;
    };
    window.addEventListener('gk2-auth-changed',synchronize);
    window.addEventListener('online',synchronize);
    window.addEventListener('focus',synchronize);
    setInterval(synchronize,12000);
})();
