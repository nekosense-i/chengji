// Entry preferences belong to this browser. Scores always retain canonical
// correct counts and type scores so older clients and cloud merges stay compatible.
(function(UI) {
    const preferenceKey = 'gk2_entry_mode_default_v1';
    const labels = { count: '按正确题数录入', wrong: '按错误题数录入', score: '按题型分数录入' };
    let defaultMode = null;
    try {
        const saved = localStorage.getItem(preferenceKey);
        if (Object.hasOwn(labels, saved)) defaultMode = saved;
    } catch {}

    UI.prototype.getExamEntryDefault = () => defaultMode;
    UI.prototype._getExamEntryMode = function(exam) {
        if (!this._hasCountEntryTypes(exam?.types)) return 'score';
        return this._localExamEntryModes?.get(exam.id) || defaultMode || (exam.entryMode === 'count' ? 'count' : 'score');
    };
    UI.prototype._getCountEntryLabel = function(exam) {
        return this._getExamEntryMode(exam) === 'wrong' ? '错误题数' : '正确题数';
    };
    UI.prototype._isCountEntryField = function(exam, type) {
        return this._getExamEntryMode(exam) !== 'score' && !type?.manualScore && Number.isInteger(Number(type?.questionCount)) && Number(type.questionCount) > 0;
    };
    const getInputValue = UI.prototype._getEntryInputValue;
    UI.prototype._getEntryInputValue = function(record, exam, type) {
        const value = getInputValue.call(this, record, exam, type);
        return value !== '' && this._isCountEntryField(exam, type) && this._getExamEntryMode(exam) === 'wrong'
            ? Number(type.questionCount) - Number(value) : value;
    };
    UI.prototype._getSavedEntryInputValue = function(input, record) {
        const exam = this.store.state.data.exams.find(e => e.id === input.dataset.eid);
        const type = exam?.types.find(t => t.name === input.dataset.field);
        return type ? this._getEntryInputValue(record, exam, type) : '';
    };
    const preview = UI.prototype._getCountEntryScorePreview;
    UI.prototype._getCountEntryScorePreview = function(value, max, questions, mode) {
        if (mode === 'wrong' && /^\d+$/.test(String(value).trim()) && Number(value) <= Number(questions)) value = Number(questions) - Number(value);
        return preview.call(this, value, max, questions);
    };
    const extremeHint = UI.prototype._updateScoreExtremeHint;
    UI.prototype._updateScoreExtremeHint = function(input) {
        if (input?.dataset.countMode !== 'wrong' || input.dataset.entryKind !== 'count') return extremeHint.call(this, input);
        const value = Number(input.value), max = Number(input.dataset.max);
        const valid = /^\d+$/.test(input.value) && value <= max;
        const needsCheck = valid && (value === 0 || value > max * .8);
        input.closest('.score-cell')?.classList.toggle('score-cell-needs-check', needsCheck);
        if (needsCheck) input.title = value === 0 ? '请确认：该题型没有错题，为满分' : '请确认：错误题数超过总题数的80%';
        else input.removeAttribute('title');
    };
    UI.prototype.saveEntryCount = function(sid, eid, field, value, tid, questions, max, input) {
        const exam = this.store.state.data.exams.find(e => e.id === eid);
        const raw = String(value ?? '').trim();
        if (this._getExamEntryMode(exam) === 'wrong' && /^\d+$/.test(raw) && Number(raw) <= Number(questions)) value = String(Number(questions) - Number(raw));
        return this.saveCorrectCount(sid, eid, field, value, tid, questions, max, input);
    };

    UI.prototype.toggleExamEntryMode = function(eid, mode) {
        const exam = this.store.state.data.exams.find(e => e.id === eid);
        if (!exam) return;
        mode ||= this._getExamEntryMode(exam) === 'score' ? 'count' : 'score';
        if (!Object.hasOwn(labels, mode)) return;
        if (mode !== 'score' && !this._hasCountEntryTypes(exam.types)) return Utils.msg('请先在题型设置中填写客观题题数', 'error');
        (this._localExamEntryModes ||= new Map()).set(eid, mode);
        this.renderExamTables(eid);
        this.syncExamEntryModeControls(exam);
    };
    UI.prototype.setExamEntryDefault = function(mode, eid) {
        if (!Object.hasOwn(labels, mode)) return;
        try { localStorage.setItem(preferenceKey, mode); }
        catch { return Utils.msg('浏览器未能保存默认录入方式，请检查本地存储是否可用', 'error'); }
        defaultMode = mode;
        this._localExamEntryModes?.clear();
        this.renderExamTables(eid);
        this.syncExamEntryModeControls(this.store.state.data.exams.find(e => e.id === eid));
    };
    UI.prototype.syncExamEntryModeControls = function(exam) {
        if (!exam) return;
        const mode = this._getExamEntryMode(exam);
        const trigger = document.getElementById('gk2-entry-mode-toggle');
        if (trigger) trigger.innerHTML = `<span>${labels[mode]}</span>${window.gk2IconMarkup('chevron-down')}`;
        document.querySelectorAll('[data-entry-mode-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.entryModeChoice === mode)));
        document.querySelectorAll('input[name="gk2-entry-mode-default"]').forEach(input => { input.checked = input.value === defaultMode; });
    };
    UI.prototype.createExamEntryModeControl = function(exam) {
        const section = document.createElement('div');
        section.className = 'gk2-entry-mode-section';
        section.innerHTML = `<div class="gk2-entry-mode-control">
            <button type="button" id="gk2-entry-mode-toggle" class="secondary gk2-entry-mode-menu-action" data-gk2-menu-keep-open aria-expanded="false" aria-controls="gk2-entry-mode-options"></button>
            <button type="button" class="secondary gk2-entry-mode-settings-toggle" data-gk2-menu-keep-open aria-label="设置默认录入模式" aria-controls="gk2-entry-mode-settings" aria-expanded="false">${window.gk2IconMarkup('settings')}</button>
        </div>
        <div id="gk2-entry-mode-options" class="gk2-entry-mode-options" role="group" aria-label="选择本次录入方式" hidden></div>
        <div id="gk2-entry-mode-settings" class="gk2-entry-mode-settings" role="group" aria-label="默认录入模式" hidden>
            <strong>默认录入模式</strong>
        </div>`;
        const trigger = section.querySelector('#gk2-entry-mode-toggle');
        const gear = section.querySelector('.gk2-entry-mode-settings-toggle');
        const settingsIcon = document.querySelector('.sidebar-bottom [aria-label="系统设置"] svg');
        if (settingsIcon) gear.replaceChildren(settingsIcon.cloneNode(true));
        const options = section.querySelector('#gk2-entry-mode-options');
        const settings = section.querySelector('#gk2-entry-mode-settings');
        const show = (panel, button, open) => { panel.hidden = !open; button.setAttribute('aria-expanded', String(open)); };
        trigger.innerHTML = `<span>${labels[this._getExamEntryMode(exam)]}</span>${window.gk2IconMarkup('chevron-down')}`;
        trigger.onclick = () => { show(options, trigger, options.hidden); show(settings, gear, false); };
        gear.onclick = () => { show(settings, gear, settings.hidden); show(options, trigger, false); };
        for (const [mode, label] of Object.entries(labels)) {
            const choice = document.createElement('button');
            choice.type = 'button'; choice.className = 'secondary'; choice.textContent = label;
            choice.dataset.entryModeChoice = mode; choice.dataset.gk2MenuKeepOpen = '';
            choice.setAttribute('aria-pressed', String(mode === this._getExamEntryMode(exam)));
            choice.onclick = () => { this.toggleExamEntryMode(exam.id, mode); show(options, trigger, false); trigger.focus({ preventScroll: true }); };
            options.append(choice);
            const option = document.createElement('label'), radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'gk2-entry-mode-default'; radio.value = mode; radio.checked = mode === defaultMode;
            radio.onchange = () => { if (radio.checked) this.setExamEntryDefault(mode, exam.id); };
            option.append(radio, document.createTextNode(label)); settings.append(option);
        }
        return section;
    };

    function positionEntryMenu(root) {
        const body = root?.querySelector('.gk2-action-menu-body');
        if (!root?.open || !body) return;
        body.style.right = '0px';
        const width = document.documentElement.clientWidth;
        const minLeft = Math.max(12, (document.querySelector('.main-content')?.getBoundingClientRect().left || 0) + 12);
        body.style.maxWidth = Math.max(1, width - minLeft - 12) + 'px';
        body.style.minWidth = '0';
        const bounds = body.getBoundingClientRect();
        const left = Math.max(minLeft, Math.min(bounds.left, width - bounds.width - 12));
        body.style.right = (bounds.left - left) + 'px';
    }
    UI.prototype.configureExamEntryMenu = function(root) {
        root.addEventListener('toggle', () => {
            if (root.open) positionEntryMenu(root);
            else root.querySelectorAll('.gk2-entry-mode-section [aria-expanded]').forEach(button => {
                button.setAttribute('aria-expanded', 'false');
                document.getElementById(button.getAttribute('aria-controls')).hidden = true;
            });
        });
    };
    window.addEventListener('resize', () => positionEntryMenu(document.getElementById('gk2-exam-operations')));

    UI.prototype._refreshExamEntryStats = function(eid, input) {
        const exam = this.store.state.data.exams.find(e => e.id === eid);
        if (!exam) return;
        const students = new Map(this.store.state.data.students.map(student => [student.id, student]));
        const table = input?.isConnected && input.closest('table.gk2-entry-score-table');
        const tables = table ? [table] : document.getElementById('e-tables-' + eid)?.querySelectorAll('table.gk2-entry-score-table') || [];
        tables.forEach(table => {
            const footer = table.querySelector('.gk2-entry-stats');
            if (!footer) return;
            const roster = [...table.querySelectorAll('tr[data-gk2-entry-student]')].map(row => students.get(row.dataset.gk2EntryStudent)).filter(Boolean);
            footer.innerHTML = this._renderExamEntryStats(exam, roster);
        });
    };
    for (const name of ['saveVal', 'saveCorrectCount', 'saveEstimated']) {
        const save = UI.prototype[name];
        UI.prototype[name] = function(...args) {
            const result = save.apply(this, args);
            if (result !== false) this._refreshExamEntryStats(args[1], args[name === 'saveEstimated' ? 3 : name === 'saveCorrectCount' ? 7 : 6]);
            return result;
        };
    }
})(UI);
