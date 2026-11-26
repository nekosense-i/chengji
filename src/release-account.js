window.gk2DismissibleDialog = function (dialog, label) {
    const header = dialog.querySelector('.gk2-surface-header');
    if (header) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gk2-settings-close';
        button.setAttribute('aria-label', label);
        button.title = '关闭';
        button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12 M18 6 6 18"/></svg>';
        button.onclick = () => dialog.close();
        header.append(button);
    }
    const outside = event => {
        if (event.target !== dialog) return false;
        const bounds = dialog.getBoundingClientRect();
        return event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom;
    };
    let startedOutside = false;
    dialog.addEventListener('pointerdown', event => { startedOutside = outside(event); });
    dialog.addEventListener('click', event => {
        if (startedOutside && outside(event)) dialog.close();
        startedOutside = false;
    });
};

(() => {
    const testing = window.gk2ReleaseTest;
    const auth = () => window.__gakutenAuth?.getAuth();
    const modeAction = testing ? '退出测试模式' : '进入测试模式';

    function switchMode() {
        if (!testing && auth()?.mode !== 'admin') return;
        const store = window.app.store;
        try {
            store.writeLocalState();
        } catch (error) {
            window.alert('本机保存失败，未切换模式。' + error.message);
            return;
        }
        const url = new URL(location.href);
        if (testing) url.searchParams.delete('mode');
        else url.searchParams.set('mode', 'test');
        location.assign(url.href);
    }

    window.gk2OpenAccount = function () {
        const identity = auth();
        if (!identity) return;
        const dialog = document.getElementById('gk2-account-dialog');
        const teacher = identity.mode === 'teacher';
        dialog.querySelector('strong').textContent = identity.name || (teacher ? '任课教师' : '教务管理员');
        dialog.querySelector('[data-account-scope]').textContent = teacher
            ? [identity.campus, identity.grade, identity.classId].join(' · ')
            : '全部教学范围';
        const lamp = document.getElementById('gk2-cloud-lamp');
        dialog.querySelector('.gk2-account-mode').hidden = !testing;
        dialog.querySelector('[data-account-teachers]').hidden = teacher;
        dialog.querySelector('[data-account-status]').dataset.state = testing ? 'test' : lamp.dataset.state;
        dialog.querySelector('[data-account-status]').textContent = ({
            healthy: '已同步', pending: '待确认', paused: '仅本机', busy: '同步中', error: '异常'
        })[lamp.dataset.state] || '仅本机';
        dialog.querySelector('[data-account-id]').textContent = identity.loginId ? '教师 ID：' + identity.loginId : '';
        window.gk2TeacherAccounts.renderClasses(dialog.querySelector('[data-account-classes]'), identity);
        dialog.showModal();
    };

    window.addEventListener('load', () => {
        const dialog = document.createElement('dialog');
        dialog.id = 'gk2-account-dialog';
        dialog.className = 'gk2-sync-dialog gk2-settings-surface';
        dialog.setAttribute('aria-labelledby', 'gk2-account-title');
        dialog.innerHTML = `<header class="gk2-surface-header"><h2 id="gk2-account-title">账号与云同步</h2></header>
            <div class="gk2-account-identity">
                <span class="gk2-account-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg></span>
                <div><strong></strong><small data-account-scope></small><small data-account-id></small></div>
            </div>
            <div data-account-classes></div>
            <div class="gk2-account-mode" hidden><span>测试模式 · 仅存本机</span><button type="button" class="secondary" data-gk2-test-toggle aria-label="退出测试模式"></button></div>
            <div class="gk2-account-menu">
                <button type="button" data-account-teachers><span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"/></svg>教师管理</span><span aria-hidden="true">›</span></button>
                <button type="button" data-account-sync><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5 9a7.5 7.5 0 0 1 12-3l3 3M4 15l3 3a7.5 7.5 0 0 0 12-3"/></svg>同步详情</span><small data-account-status></small></button>
            </div>
            <div class="gk2-account-menu gk2-account-danger"><button type="button" data-account-logout>退出登录</button></div>`;
        window.gk2DismissibleDialog(dialog, '关闭账号与云同步');
        document.body.append(dialog);
        dialog.querySelector('[data-account-logout]').onclick = () => {
            dialog.close();
            window.__gakutenLogout();
        };
        dialog.querySelector('[data-account-sync]').onclick = () => {
            dialog.close();
            window.gk2OpenSyncStatus();
        };
        for (const button of document.querySelectorAll('[data-gk2-test-toggle]')) {
            button.textContent = dialog.contains(button) ? '退出' : modeAction;
            button.onclick = switchMode;
        }
        const rosterSwitch = document.querySelector('.gk2-roster-switch');
        const teacherPanel = document.getElementById('gk2-teacher-panel');
        const studentPanel = document.getElementById('tree-container-students');
        function selectRoster(section) {
            const teachers = section === 'teachers' && auth()?.mode === 'admin';
            if (teachers && teacherPanel.hidden) window.gk2TeacherAccounts.render();
            teacherPanel.hidden = !teachers;
            studentPanel.hidden = teachers;
            if (teachers) {
                window.gk2Navigation?.closeRosterSearch?.();
                window.gk2Navigation?.closeRosterImportPopover?.();
            }
            for (const button of rosterSwitch.querySelectorAll('button')) {
                button.setAttribute('aria-pressed', String(button.dataset.rosterSection === (teachers ? 'teachers' : 'students')));
            }
        }
        for (const button of rosterSwitch.querySelectorAll('button')) {
            button.onclick = () => selectRoster(button.dataset.rosterSection);
        }
        teacherPanel.querySelector('[data-teacher-cancel]').onclick = () => {
            teacherPanel.querySelector('form').hidden = true;
            teacherPanel.querySelector('form').reset();
            teacherPanel.querySelector('[data-teacher-add]').focus();
        };
        dialog.querySelector('[data-account-teachers]').onclick = () => {
            dialog.close();
            window.gk2.navigate('students');
            selectRoster('teachers');
        };
        const systemSettings = document.getElementById('modal-settings');
        window.gk2DismissibleDialog(systemSettings);
        const keyInput = document.getElementById('api-key-input');
        const keyToggle = document.getElementById('gk2-key-visibility');
        function setKeyVisible(visible) {
            keyInput.type = visible ? 'text' : 'password';
            keyToggle.setAttribute('aria-pressed', String(visible));
            keyToggle.setAttribute('aria-label', visible ? '隐藏 API Key' : '显示 API Key');
        }
        keyToggle.onclick = () => setKeyVisible(keyInput.type === 'password');
        systemSettings.addEventListener('close', () => setKeyVisible(false));
        const customModel = document.getElementById('ai-model-custom');
        const modelPriority = document.getElementById('gk2-model-priority');
        const updateModelPriority = () => { modelPriority.hidden = !customModel.value.trim(); };
        systemSettings.addEventListener('input', updateModelPriority);
        systemSettings.addEventListener('change', updateModelPriority);
        new MutationObserver(updateModelPriority).observe(systemSettings, { attributeFilter: ['open'] });
        new MutationObserver(updateModelPriority).observe(document.getElementById('ai-model-status'), {
            childList: true, characterData: true, subtree: true
        });
        const loginId = document.getElementById('auth-teacher-id');
        const loginPassword = document.getElementById('auth-password');
        const switchEntry = document.getElementById('auth-switch-entry');
        loginId.addEventListener('keydown', event => {
            if (event.key === 'Enter') loginPassword.focus();
        });
        switchEntry.onclick = () => {
            loginId.hidden = !loginId.hidden;
            loginId.value = '';
            loginPassword.value = '';
            loginPassword.placeholder = loginId.hidden ? '请输入登录口令' : '请输入教师登录凭证';
            document.getElementById('auth-current-entry').textContent = loginId.hidden ? '管理员或原班级口令登录' : '本机教师账号';
            switchEntry.textContent = loginId.hidden ? '教师 ID 登录' : '返回口令登录';
            (loginId.hidden ? loginPassword : loginId).focus();
        };
        const avatar = document.getElementById('gk2-cloud-lamp');
        document.querySelector('.sidebar-bottom [aria-label="系统设置"]').title = '系统设置';
        if (testing) avatar?.setAttribute('data-test-active', '');
        document.querySelector('#gk2-test-settings [data-test-active]').hidden = !testing;
        const avatarLabel = document.createElement('span');
        avatarLabel.className = 'gk2-avatar-label';
        const name = document.createElement('strong'), role = document.createElement('small');
        avatarLabel.append(name, role);
        avatar?.after(avatarLabel);
        const settings = document.getElementById('gk2-test-settings');
        const update = () => {
            const identity = auth();
            const admin = identity?.mode === 'admin';
            settings.hidden = !testing && !admin;
            rosterSwitch.hidden = !admin;
            if (!admin) selectRoster('students');
            name.textContent = identity ? identity.name || (admin ? '管理员' : '任课教师') : '';
            avatarLabel.title = admin ? '教务管理员 · 全部教学范围' : name.textContent;
            role.textContent = admin ? '管理模式' : '';
            avatarLabel.hidden = !identity;
            const toggle = document.getElementById('cloud-sync-toggle');
            toggle.disabled = testing || !!identity?.teacherId;
            if (toggle.disabled) toggle.checked = false;
            window.gk2RenderCloudLamp?.();
        };
        update();
        window.addEventListener('gk2-auth-changed', update);
        if (testing) {
            document.title = '测试模式 · ' + document.title;
            document.getElementById('cloud-sync-toggle').disabled = true;
            const banner = document.createElement('div');
            banner.className = 'gk2-test-banner';
            banner.innerHTML = '<strong>测试模式 · 虚拟数据</strong><button type="button" class="secondary">返回正式模式</button>';
            banner.querySelector('button').onclick = switchMode;
            document.body.append(banner);
        }
    });
})();
