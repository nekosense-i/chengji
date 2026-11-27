window.gk2OpenSyncStatus = function () {
    const { store, sync } = window.app || {};
    if (!store || !sync) return;
    const existing = document.getElementById('gk2-sync-dialog');
    if (existing?.open) return;
    window.gk2Comfort?.close(true);
    window.gk2Comfort?.hideChartTips();
    const dialog = document.createElement('dialog');
    dialog.id = 'gk2-sync-dialog';
    dialog.className = 'gk2-sync-dialog gk2-settings-surface';
    dialog.setAttribute('aria-labelledby', 'gk2-sync-title');
    dialog.innerHTML = `<header class="gk2-surface-header">
        <div><h2 id="gk2-sync-title">数据保存与同步</h2><p>查看云端连接、本机保存状态与待上传的修改。</p></div>
    </header>
    <div class="gk2-sync-overview">
        <dl class="gk2-sync-metrics"></dl>
        <p class="gk2-sync-explanation">本机修改立即保存；停顿约 2 秒后上传，连续录入约 8 秒一批。页面打开时每 12 秒检查更新；同一字段的冲突沿用现有版本规则，可在核对记录中查看。</p>
        <details class="gk2-sync-records">
            <summary><span>同步核对记录<small>当前身份可见，本机最多保留 50 条</small></span><span data-sync-count></span></summary>
            <div data-sync-records></div>
        </details>
    </div>
    <p role="status" class="gk2-sync-feedback"></p>
    <div class="gk2-settings-footer gk2-sync-footer">
        <button type="button" class="secondary" data-sync-pull>重新拉取云端数据</button>
        <button type="button" class="secondary" data-sync-close>关闭</button>
        <button type="button" class="gk2-settings-primary" data-sync-now>立即同步</button>
    </div>`;
    window.gk2DismissibleDialog(dialog, '关闭数据保存与同步');
    const overview = dialog.querySelector('dl');
    const records = dialog.querySelector('[data-sync-records]');
    const badge = dialog.querySelector('[data-sync-count]');
    const message = dialog.querySelector('[role="status"]');
    const pull = dialog.querySelector('[data-sync-pull]');
    const syncNow = dialog.querySelector('[data-sync-now]');
    const labels = {
        'merged-values-review': '合并后的成绩需要核对',
        'older-cloud-snapshot': '收到较旧的云端快照',
        'same-version-field-choice': '相同字段版本出现不同值，已按既有规则选值',
        'deletion-suppressed-record': '记录受到较新的删除版本压制'
    };
    let busy = false, previousMetrics, previousRecords;
    const teacherStatus = () => window.__gakutenAuth.getAuth()?.sharedDirectory && window.gk2TeacherGradeSyncStatus?.();
    function render() {
        let count = 0;
        for (const delta of [store.pendingDelta, store._syncInFlight]) {
            if (!delta) continue;
            for (const key of ['students', 'exams', 'scores', 'examTemplates']) {
                count += Object.keys(delta[key] || {}).length + Object.keys(delta.deleted?.[key] || {}).length;
            }
        }
        const teacher = teacherStatus();
        if (teacher) count = teacher.pending;
        const enabled = !!teacher || sync.isEnabled();
        const lastPushedAt = teacher ? teacher.lastPushedAt : store.state.syncMeta.lastPushedAt;
        const lastError = teacher ? teacher.error : store.state.syncMeta.lastError;
        const state = teacher ? teacher.state : sync.connectionStatus().state;
        const localStatus = store.getLocalSaveStatus();
        const metrics = [
            ['云同步', enabled ? '已开启' : '已关闭 · 仅本机保存', state],
            ['本机保存', localStatus, store._syncLocalError ? 'error' : 'healthy'],
            ['待上传操作', count + ' 项', count ? 'pending' : 'neutral'],
            ['最近上传确认', lastPushedAt ? new Date(lastPushedAt).toLocaleString() : '暂无', 'neutral'],
            ['同步结果', lastError || (state === 'busy' ? '正在等待云端确认' : count ? '本机修改等待上传' : '无错误'), lastError ? 'error' : 'healthy']
        ];
        const signature = JSON.stringify(metrics);
        if (signature !== previousMetrics) {
            previousMetrics = signature;
            overview.replaceChildren(...metrics.map(([label, value, tone]) => {
                const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
                term.textContent = label;
                detail.dataset.state = tone;
                detail.textContent = value;
                row.append(term, detail);
                return row;
            }));
        }
        const policy = window.gk2Policy;
        const warnings = (store.state.localSync?.warnings || []).filter(warning => {
            if (policy?.admin()) return true;
            if (!policy?.auth()) return false;
            if (warning.code === 'older-cloud-snapshot' && !warning.studentId) return true;
            return policy.studentForExam(store.state.data.students.find(s => s.id === warning.studentId),
                store.state.data.exams.find(e => e.id === warning.examId));
        });
        const lines = warnings.map(warning => {
            const student = store.state.data.students.find(s => s.id === warning.studentId);
            const exam = store.state.data.exams.find(e => e.id === warning.examId);
            return [labels[warning.code] || warning.code, student?.name || warning.studentId, exam?.name || warning.examId]
                .filter(Boolean).join(' · ') + '：' + JSON.stringify(warning.detail);
        });
        if (JSON.stringify(lines) !== previousRecords) {
            previousRecords = JSON.stringify(lines);
            badge.textContent = warnings.length + ' / 50';
            records.replaceChildren(...(lines.length ? lines : ['暂无核对记录。']).map(line => {
                const p = document.createElement('p');
                p.textContent = line;
                return p;
            }));
        }
        pull.disabled = syncNow.disabled = !enabled || busy || !navigator.onLine || (teacher ? teacher.busy : sync.isPulling || sync.isPushing);
    }
    async function run(action) {
        if (busy || !(teacherStatus() || sync.isEnabled())) return;
        busy = true;
        render();
        message.textContent = '正在同步…';
        try {
            await action();
            message.textContent = (teacherStatus() ? teacherStatus().error : store.state.syncMeta.lastError) || '操作完成，数据已保存到本机';
        } catch (error) {
            message.textContent = error.message;
        } finally {
            busy = false;
            render();
        }
    }
    syncNow.onclick = () => run(async () => {
        clearTimeout(store.saveTimeout);
        store.saveTimeout = null;
        store.writeLocalState();
        if (teacherStatus()) await window.gk2SynchronizeTeacherGrades();
        else await sync.manualSync();
    });
    pull.onclick = () => {
        if (confirm('重新拉取会读取云端最新数据，并按现有规则与本机修改合并。确定继续吗？')) {
            run(() => teacherStatus() ? window.gk2SynchronizeTeacherGrades() : sync.manualSync());
        }
    };
    dialog.querySelector('[data-sync-close]').onclick = () => dialog.close();
    document.body.append(dialog);
    render();
    const timer = setInterval(render, 1000);
    dialog.addEventListener('close', () => {
        clearInterval(timer);
        dialog.remove();
        const ui = window.app?.ui;
        if (ui?.pendingRemoteRefresh) {
            ui.pendingRemoteRefresh = false;
            ui.refresh();
        }
    }, { once: true });
    dialog.showModal();
};
