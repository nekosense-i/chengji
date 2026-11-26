(() => {
    const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
    const UIRef = UI;

    const originalRenderStudents = UIRef.prototype.renderStudents;
    UIRef.prototype.renderStudents = function (...args) {
        const result = originalRenderStudents.apply(this, args);
        this._bindRosterSelectionBar();
        return result;
    };

    UIRef.prototype._bindRosterSelectionBar = function () {
        const container = document.getElementById('tree-container-students');
        if (!container) return;
        let bar = document.getElementById('gk2-roster-selection-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'gk2-roster-selection-bar';
            bar.setAttribute('role', 'toolbar');
            bar.setAttribute('aria-label', '已选学生批量操作');
            bar.style.cssText = 'position:fixed;z-index:80;left:50%;bottom:20px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:10px 14px;background:var(--surface,#fff);border:1px solid var(--border,#d9dce3);border-radius:14px;box-shadow:0 8px 28px rgba(20,35,60,.18);';
            document.body.appendChild(bar);
        }
        const update = () => {
            const ids = this._getSelectedRosterStudentIds();
            bar.style.display = ids.length ? 'flex' : 'none';
            bar.innerHTML = `<strong>已选 ${ids.length} 人</strong><button type="button" class="secondary btn--compact" data-action="edit">批量编辑</button><button type="button" class="secondary btn--compact" data-action="delete">移出名单</button><button type="button" class="secondary btn--compact" data-action="clear">取消选择</button>`;
        };
        if (!bar.dataset.bound) {
            bar.dataset.bound = 'true';
            bar.addEventListener('click', event => {
                const action = event.target.closest('[data-action]')?.dataset.action;
                if (action === 'edit') this.openBulkEditStudents();
                if (action === 'delete') this.bulkDeleteStudents();
                if (action === 'clear') {
                    document.querySelectorAll('#tree-container-students .stu-checkbox:checked, #tree-container-students .select-all-checkbox:checked').forEach(box => { box.checked = false; });
                    update();
                }
            });
        }
        if (!container.dataset.gk2SelectionBarBound) {
            container.dataset.gk2SelectionBarBound = 'true';
            container.addEventListener('change', event => {
                if (event.target.matches('.stu-checkbox,.select-all-checkbox')) update();
            });
        }
        update();
    };

    const originalImportPreview = UIRef.prototype.showStudentImportPreview;
    UIRef.prototype.showStudentImportPreview = function (headers, rows, input) {
        const key = JSON.stringify([headers, rows]);
        const controls = document.querySelectorAll('#student-import-preview-body .student-import-map');
        if (this._studentImportMappingKey === key && controls.length) {
            this._studentImportMapping = Object.fromEntries(Array.from(controls, control => [control.dataset.mapKey, Number(control.value)]));
        } else if (this._studentImportMappingKey !== key) {
            this._studentImportMappingKey = key;
            this._studentImportMapping = null;
        }
        const result = originalImportPreview.call(this, headers, rows, input);
        if (this._studentImportMapping) {
            document.querySelectorAll('#student-import-preview-body .student-import-map').forEach(control => {
                if (Object.prototype.hasOwnProperty.call(this._studentImportMapping, control.dataset.mapKey)) control.value = String(this._studentImportMapping[control.dataset.mapKey]);
            });
        }
        return result;
    };

    const getScoreKey = input => `${input.dataset.sid || ''}\u0000${input.dataset.eid || ''}`;
    const entrySnapshot = input => {
        const record = window.app?.store?.getScore(input.dataset.sid, input.dataset.eid);
        return copy(record);
    };
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

    const showEntryUndo = (ui, changes, focusInput) => {
        const applied = changes.map(change => ({ ...change, after: entrySnapshot(change.input) })).filter(change => !same(change.before, change.after));
        if (!applied.length) return;
        document.getElementById('gk2-entry-local-undo')?.remove();
        const button = document.createElement('button');
        button.id = 'gk2-entry-local-undo';
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = `撤销本次操作（${applied.length} 条）`;
        button.style.cssText = 'position:fixed;z-index:100;right:22px;bottom:22px;box-shadow:0 5px 22px rgba(20,35,60,.2);';
        const host = focusInput?.closest('.gk2-sticky-table-shell') || focusInput?.closest('.table-scroll-container') || document.body;
        host.appendChild(button);
        if (focusInput?.isConnected) focusInput.focus({ preventScroll: true });
        button.addEventListener('click', () => {
            const store = window.app.store;
            const conflicts = applied.filter(change => !same(entrySnapshot(change.input), change.after));
            if (conflicts.length) {
                Utils.msg(`发现 ${conflicts.length} 条记录已被后续修改，未覆盖这些记录。`, 'warning');
                if (conflicts.length === applied.length) return;
            }
            const safe = applied.filter(change => !conflicts.includes(change));
            safe.forEach(change => {
                const index = store.state.data.scores.findIndex(record => record.studentId === change.input.dataset.sid && record.examId === change.input.dataset.eid);
                if (index >= 0) {
                    if (change.before) store.state.data.scores[index] = copy(change.before);
                    else store.state.data.scores.splice(index, 1);
                } else if (change.before) store.state.data.scores.push(copy(change.before));
                const record = change.before;
                const field = change.input.dataset.field;
                change.input.value = change.input.dataset.type === 'estimated' ? String(record?.estimatedTotal ?? '') : String(record?.details?.[field] ?? '');
            });
            store.rebuildScoreIndex();
            store.markAsUnsaved();
            const disconnected = safe.some(change => !change.input.isConnected);
            if (disconnected && safe[0]) ui.renderExamTables(safe[0].input.dataset.eid);
            button.remove();
            const restoredFocus = focusInput?.isConnected ? focusInput : safe[0] && Array.from(document.querySelectorAll('#view-exams .score-input')).find(input => input.dataset.sid === safe[0].input.dataset.sid && input.dataset.eid === safe[0].input.dataset.eid && input.dataset.field === safe[0].input.dataset.field);
            if (restoredFocus?.isConnected) restoredFocus.focus();
            Utils.msg(`已撤销 ${safe.length} 条记录`, 'success');
        });
    };

    const originalClearStudentScore = UIRef.prototype.clearStudentExamScore;
    if (originalClearStudentScore) {
        UIRef.prototype.clearStudentExamScore = function (sid, eid, ...args) {
            const trigger = document.querySelector(`.gk2-score-reset-trigger[data-sid="${sid}"][data-eid="${eid}"]`);
            const before = trigger ? entrySnapshot(trigger) : copy(this.store.getScore(sid, eid));
            const input = document.querySelector(`#view-exams .score-input[data-sid="${sid}"][data-eid="${eid}"]`);
            const result = originalClearStudentScore.call(this, sid, eid, ...args);
            if (result !== false && before) setTimeout(() => showEntryUndo(this, [{ input: input || { dataset: { sid, eid, field: '', type: 'detail' }, isConnected: false }, before }], input), 0);
            return result;
        };
    }

    document.addEventListener('focusin', event => {
        if (event.target?.classList?.contains('score-input')) window.__gk2LastScoreFocus = event.target;
    });
    document.addEventListener('click', event => {
        const confirm = event.target.closest('#paste-preview-confirm');
        if (!confirm) return;
        const modal = document.getElementById('paste-preview-modal');
        updatePasteSummary(modal);
        const previewInputs = Array.from(modal?.querySelectorAll('.preview-input') || []);
        const records = new Map();
        previewInputs.forEach(preview => {
            const target = Array.from(document.querySelectorAll('#view-exams .score-input')).find(input => input.dataset.sid === preview.dataset.sid && input.dataset.eid === preview.dataset.eid && input.dataset.field === preview.dataset.field && input.dataset.type === preview.dataset.type);
            if (!target || !target.dataset.sid || !target.dataset.eid) return;
            const key = getScoreKey(target);
            if (!records.has(key)) records.set(key, { input: target, before: entrySnapshot(target) });
        });
        const focusInput = window.__gk2LastScoreFocus?.isConnected ? window.__gk2LastScoreFocus : null;
        const warningItems = Array.from(modal?.querySelectorAll('.preview-input') || []).filter(input => {
            const value = Number(input.value);
            return input.dataset.targetCell === '-9999' || (input.dataset.max && value > Number(input.dataset.max)) || !input.dataset.sid;
        });
        const duplicateNames = document.getElementById('paste-preview-modal')?.dataset.gk2DuplicateNames;
        const unresolved = warningItems.length || document.getElementById('paste-preview-modal')?.dataset.gk2NoMatch === 'true' || duplicateNames;
        if (unresolved && !window.confirm(`预览中有 ${warningItems.length} 项超分、无匹配或未映射内容${duplicateNames ? `；同名歧义：${duplicateNames}` : ''}。仍要继续写入吗？`)) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        setTimeout(() => showEntryUndo(window.app.ui, [...records.values()], focusInput), 0);
    }, true);

    const updatePasteSummary = modal => {
        const note = modal.querySelector('#paste-preview-note');
        if (!note) return;
        const inputs = Array.from(modal.querySelectorAll('.preview-input'));
        const first = inputs[0];
        const exam = window.app?.store?.state?.data?.exams?.find(item => item.id === first?.dataset.eid);
        const students = [...new Set(inputs.map(input => input.dataset.sid).filter(Boolean))];
        const rows = Array.from(new Set(inputs.map(input => input.dataset.targetRow)));
        const duplicates = new Set();
        rows.forEach(rowIndex => {
            const studentId = inputs.find(input => input.dataset.targetRow === rowIndex)?.dataset.sid;
            const name = window.app?.store?.state?.data?.students?.find(student => student.id === studentId)?.name;
            if (name && window.app?.store?.state?.data?.students?.filter(student => student.name === name && student.rosterMembership?.archivedAt == null).length > 1) duplicates.add(name);
        });
        const overwriteCount = inputs.filter(input => {
            const record = window.app?.store?.getScore(input.dataset.sid, input.dataset.eid);
            const field = input.dataset.field;
            return input.dataset.type === 'estimated' ? record?.estimatedTotal != null && Number(record.estimatedTotal) !== 0 : record?.details?.[field] != null && record.details[field] !== '';
        }).length;
        const studentNames = students.map(id => window.app.store.state.data.students.find(item => item.id === id)?.name || id);
        const classes = [...new Set(students.map(id => {
            const student = window.app.store.state.data.students.find(item => item.id === id);
            const classAtExam = student && exam ? Utils.getClassForExam(student, exam) : student;
            return student ? `${classAtExam.campus || student.campus || ''} / ${student.grade || ''} / ${classAtExam.teachingClass || '未分日语班'}` : '';
        }).filter(Boolean))];
        const summary = `目标考试：${exam?.name || '未识别'}；班级：${classes.join('、') || '未匹配'}；学生匹配顺序：${studentNames.join(' → ') || '存在未匹配学生'}；覆盖 ${overwriteCount} 格`;
        if (!note.textContent.startsWith('目标考试：')) note.textContent = `${summary}。${note.textContent}`;
        modal.dataset.gk2DuplicateNames = [...duplicates].join('、');
        modal.dataset.gk2NoMatch = String(inputs.some(input => !input.dataset.sid));
        let flags = modal.querySelector('#gk2-paste-review-flags');
        if (!flags) {
            flags = document.createElement('div');
            flags.id = 'gk2-paste-review-flags';
            flags.className = 'dialog-warning';
            modal.querySelector('#paste-preview-overmax')?.after(flags);
        }
        const overmax = inputs.filter(input => Number(input.value) > Number(input.dataset.max || 0) && Number(input.dataset.max || 0) > 0).length;
        const unmapped = inputs.filter(input => input.dataset.targetCell === '-9999').length;
        const unmatched = inputs.filter(input => !input.dataset.sid).length;
        const flagText = [overmax && `超分 ${overmax} 格`, unmatched && `无匹配 ${unmatched} 格`, unmapped && `未映射 ${unmapped} 格`, duplicates.size && `重名歧义：${[...duplicates].join('、')}`].filter(Boolean).join('；') || '未发现超分、无匹配或重名歧义';
        if (flags.textContent !== flagText) flags.textContent = flagText;
    };

    const pasteModal = document.getElementById('paste-preview-modal');
    if (pasteModal) {
        new MutationObserver(() => updatePasteSummary(pasteModal)).observe(pasteModal, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
        pasteModal.addEventListener('input', () => { pasteModal.querySelectorAll('#paste-preview-note').forEach(note => { if (note.textContent.startsWith('目标考试：')) note.textContent = ''; }); });
    }

    const truncate = document.getElementById('paste-preview-truncate');
    if (truncate) truncate.checked = false;
})();
