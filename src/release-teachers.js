(() => {
    const key = 'gk2_teacher_accounts_v1';
    let feedbackTimer, sharedTeacher, sessionRead;
    function useSharedDirectory() {
        return location.hostname === 'chengji.nekosensei.cn' && !window.gk2ReleaseTest;
    }
    async function directoryRequest(route, body) {
        const response = await fetch('/gakupo-directory/' + route, body ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        } : {});
        const result = await response.json();
        if (!response.ok) throw Object.assign(Error(result.error || '无法读取云端教师目录。'), { status: response.status });
        return result;
    }
    async function loadDirectory() {
        const { classes } = await directoryRequest('roster');
        const scopes = new Map(Object.entries(classes).map(([id, { info }]) =>
            [id, classKey(info.campus, info.grade, info.teachingClass)]));
        const { teachers } = await directoryRequest('teachers');
        return {
            scopes,
            accounts: teachers.map(teacher => ({
                ...teacher, classes: teacher.classIds.map(id => scopes.get(id)).filter(Boolean)
            }))
        };
    }
    function showDirectoryLogin(workspace, retry, error) {
        const list = workspace.querySelector('[data-teacher-list]');
        const empty = workspace.querySelector('[data-teacher-editor-empty]');
        workspace.querySelector('form').hidden = true;
        empty.hidden = false;
        list.replaceChildren();
        const status = document.createElement('p');
        status.textContent = error.status === 401 || error.status === 403
            ? '请使用 Gakupo 管理员口令，管理两边共用的教师账号。'
            : '云端教师目录暂时不可用，请重试。';
        list.append(status);
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '重试';
        list.append(button);
        if (error.status !== 401 && error.status !== 403) {
            button.onclick = retry;
            return;
        }
        const password = document.createElement('input');
        password.type = 'password';
        password.autocomplete = 'current-password';
        password.setAttribute('aria-label', 'Gakupo 管理员口令');
        list.insertBefore(password, button);
        button.textContent = '连接云端';
        const connect = async () => {
            if (!password.value || button.disabled) return;
            button.disabled = true;
            try {
                await directoryRequest('session', { role: 'admin', loginId: 'nekosensei', password: password.value });
                password.value = '';
                retry();
            } catch (failure) {
                status.textContent = failure.message;
            } finally {
                button.disabled = false;
            }
        };
        button.onclick = connect;
        password.onkeydown = event => { if (event.key === 'Enter') connect(); };
    }
    const read = () => JSON.parse(localStorage.getItem(key) || '[]');
    const normalize = value => value.trim().toLowerCase();
    const classKey = (campus, grade, classId) => JSON.stringify([campus, grade, classId]);
    const session = (teacher, scope) => {
        const [campus, grade, classId] = JSON.parse(scope);
        return { mode: 'teacher', teacherId: teacher.id, version: teacher.version,
            name: teacher.name, loginId: teacher.loginId, campus, grade, classId,
            ...(teacher === sharedTeacher && { sharedDirectory: true }) };
    };
    async function readSharedTeacher() {
        const { user, classes } = await directoryRequest('roster');
        if (user.role !== 'teacher' || !user.active) return null;
        return {
            ...user,
            classes: Object.values(classes).map(({info}) => classKey(info.campus, info.grade, info.teachingClass))
        };
    }
    function cloudScope(identity, teacher) {
        const previous = classKey(identity?.campus, identity?.grade, identity?.classId);
        return teacher.classes.includes(previous) ? previous : teacher.classes[0];
    }
    function currentTeacher(identity) {
        if (identity.sharedDirectory) return sharedTeacher?.id === identity.teacherId ? sharedTeacher : null;
        return read().find(teacher => teacher.id === identity.teacherId &&
            teacher.active && teacher.version === identity.version);
    }
    function availableClasses() {
        const options = new Map();
        for (const student of window.app.store.state.data.students) {
            const { campus, grade, teachingClass } = student;
            if (campus && grade && teachingClass) {
                options.set(classKey(campus, grade, teachingClass), [campus, grade, teachingClass].join(' · '));
            }
        }
        return options;
    }
    window.gk2TeacherAccounts = {
        sharedDirectoryAvailable: useSharedDirectory,
        directoryRequest,
        connectDirectory: password => directoryRequest('session', {role:'admin',loginId:'nekosensei',password}),
        async disconnectDirectory() {
            if (!useSharedDirectory()) return;
            await fetch('/gakupo-directory/session', { method: 'DELETE' });
        },
        validateSession(identity) {
            if (!identity.teacherId) return identity;
            const teacher = currentTeacher(identity);
            const scope = classKey(identity.campus, identity.grade, identity.classId);
            return teacher?.classes.includes(scope) ? session(teacher, scope) : null;
        },
        async restoreSharedSession(identity) {
            if (!useSharedDirectory() || !identity?.sharedDirectory) return;
            if (!sessionRead) sessionRead = (async () => {
                try {
                    const live = await readSharedTeacher();
                    sharedTeacher = live?.id === identity.teacherId ? live : null;
                    const scope = sharedTeacher && cloudScope(identity, sharedTeacher);
                    if (scope) return session(sharedTeacher, scope);
                } catch (error) {
                    if (error.status !== 401 && error.status !== 403) throw error;
                    sharedTeacher = null;
                }
                return null;
            })().finally(() => { sessionRead = null; });
            return sessionRead;
        },
        async signIn(id) {
            if (useSharedDirectory() && window.gk2SharedTeacherGradesReady) {
                await directoryRequest('session', { role: 'teacher', loginId: normalize(id) });
                sharedTeacher = await readSharedTeacher();
                const scope = sharedTeacher && cloudScope(null, sharedTeacher);
                if (!scope) throw Error('该账号暂无可用教学班，请联系管理员。');
                return session(sharedTeacher, scope);
            }
            const teacher = read().find(entry => entry.loginId === normalize(id) && entry.active);
            if (!teacher) return null;
            const scope = teacher.classes.find(value => availableClasses().has(value));
            if (!scope) throw Error('该账号暂无可用教学班，请联系管理员。');
            return session(teacher, scope);
        },
        renderClasses(container, identity) {
            container.replaceChildren();
            const teacher = identity.teacherId && currentTeacher(identity);
            if (!teacher) return;
            const classes = availableClasses();
            const select = document.createElement('select');
            select.setAttribute('aria-label', '切换负责班级');
            for (const scope of teacher.classes) {
                if (classes.has(scope) || identity.sharedDirectory) {
                    select.add(new Option(classes.get(scope) || JSON.parse(scope).join(' · '), scope));
                }
            }
            if (select.options.length < 2) return;
            select.value = classKey(identity.campus, identity.grade, identity.classId);
            select.onchange = () => {
                const latest = currentTeacher(identity);
                if (!latest?.classes.includes(select.value)) return;
                window.app.store.writeLocalState();
                window.__gakutenAuth.saveAuth(session(latest, select.value));
                location.reload();
            };
            container.append(select);
        },
        async render() {
            if (window.__gakutenAuth.getAuth()?.mode !== 'admin') return;
            const workspace = document.getElementById('gk2-teacher-panel');
            const find = selector => workspace.querySelector(selector);
            const list = find('[data-teacher-list]');
            const editor = find('form');
            const editorEmpty = find('[data-teacher-editor-empty]');
            const editorTitle = find('[data-teacher-editor-title]');
            const editorState = find('[data-teacher-editor-state]');
            const search = find('[data-teacher-search]');
            const clearSearch = find('[data-teacher-search-clear]');
            const classPicker = find('[data-teacher-classes]');
            const classCount = find('[data-teacher-class-count]');
            let directory;
            const add = find('[data-teacher-add]');
            if (useSharedDirectory()) {
                add.disabled = true;
                add.onclick = null;
                editor.hidden = true;
                try {
                    directory = await loadDirectory();
                } catch (error) {
                    showDirectoryLogin(workspace, () => window.gk2TeacherAccounts.render(), error);
                    return;
                }
                if (window.__gakutenAuth.getAuth()?.mode !== 'admin') return;
            }
            add.disabled = false;
            const options = directory
                ? new Map([...directory.scopes.values()].map(scope => [scope, JSON.parse(scope).join(' · ')]))
                : availableClasses();
            const readAccounts = () => directory?.accounts ?? read();
            const feedback = find('[data-teacher-feedback]');
            let selectedId = null;

            function element(tag, className, text) {
                const node = document.createElement(tag);
                if (className) node.className = className;
                if (text) node.textContent = text;
                return node;
            }
            function describeClass(scope) {
                let parts;
                try { parts = JSON.parse(scope); } catch { parts = null; }
                const label = options.get(scope) || (Array.isArray(parts) ? parts.join(' · ') : String(scope));
                const segments = Array.isArray(parts) ? parts : label.split('·').map(part => part.trim());
                const title = segments.at(-1) || label;
                const campus = segments.length >= 3 ? segments[0] : '';
                return { title, label, summary: campus ? campus + '·' + title : title,
                    grade: segments.length >= 2 ? segments.at(-2) : '',
                    group: segments.length >= 2 ? segments.slice(0, -1).join(' · ') : '其他教学班',
                    campus };
            }
            function showFeedback(message = '', state = 'error') {
                clearTimeout(feedbackTimer);
                feedback.removeAttribute('data-state');
                feedback.textContent = message;
                if (!message) return;
                feedback.dataset.state = state;
                if (state === 'success') feedbackTimer = setTimeout(() => showFeedback(), 3240);
            }
            function setState(badge, active) {
                badge.dataset.state = active ? 'active' : 'inactive';
                badge.textContent = active ? '已启用' : '已停用';
            }
            function render() {
                const accounts = readAccounts();
                const query = normalize(search.value);
                find('[data-teacher-total]').textContent = accounts.length + ' 位';
                clearSearch.hidden = !search.value;
                const teachers = accounts.filter(teacher =>
                    [teacher.name, teacher.loginId, ...teacher.classes.map(scope => describeClass(scope).label)]
                        .some(value => value.toLowerCase().includes(query)));
                list.replaceChildren();
                if (!teachers.length) {
                    const empty = element('div', 'teacher-auth-empty');
                    const icon = element('span', 'teacher-auth-empty-icon');
                    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>';
                    empty.append(icon, element('strong', '', query ? '未找到匹配教师' : '暂无教师账号'),
                        element('small', '', query ? '可尝试其他关键词。' : '点击「+ 添加教师」创建。'));
                    list.append(empty);
                }
                for (const teacher of teachers) {
                    const row = element('button', 'teacher-auth-row');
                    row.type = 'button';
                    row.dataset.teacherId = teacher.id;
                    row.setAttribute('aria-pressed', String(selectedId === teacher.id));
                    const heading = element('span', 'teacher-auth-row-heading');
                    const badge = element('span', 'teacher-auth-badge');
                    setState(badge, teacher.active);
                    heading.append(element('strong', '', teacher.name),
                        element('span', 'teacher-auth-badge', teacher.loginId), badge);
                    const classes = element('span', 'teacher-auth-class-summary');
                    for (const scope of teacher.classes.slice(0, 3)) {
                        const { summary, label } = describeClass(scope);
                        const chip = element('span', 'teacher-auth-class-badge', summary);
                        chip.title = label;
                        classes.append(chip);
                    }
                    if (teacher.classes.length > 3) classes.append(element('span', 'teacher-auth-class-badge', '+' + (teacher.classes.length - 3)));
                    if (!teacher.classes.length) classes.textContent = '暂未分配教学班';
                    row.append(heading, classes);
                    row.onclick = () => openEditor(teacher);
                    list.append(row);
                }
            }
            function updateCount() {
                classCount.textContent = '已选 ' + classPicker.querySelectorAll('input:checked').length + ' 个';
            }
            function showEmpty() {
                showFeedback();
                selectedId = null;
                editor.hidden = true;
                editor.reset();
                editorTitle.textContent = '教师资料与授权';
                editorState.hidden = true;
                editorEmpty.hidden = false;
                render();
            }
            function openEditor(teacher) {
                showFeedback();
                selectedId = teacher?.id || null;
                for (const row of list.querySelectorAll('[data-teacher-id]')) {
                    row.setAttribute('aria-pressed', String(row.dataset.teacherId === selectedId));
                }
                editor.hidden = false;
                editorEmpty.hidden = true;
                editorTitle.textContent = teacher ? '编辑教师：' + teacher.name : '新建教师账号';
                editorState.hidden = false;
                if (teacher) setState(editorState, teacher.active);
                else {
                    editorState.dataset.state = 'new';
                    editorState.textContent = '新建中';
                }
                editor.reset();
                find('[data-teacher-cancel]').textContent = teacher ? '取消编辑' : '取消';
                editor.elements.teacherName.value = teacher?.name || '';
                editor.elements.loginId.value = teacher?.loginId || '';
                editor.elements.active.checked = teacher?.active ?? true;
                classPicker.replaceChildren();
                const selected = new Set(teacher?.classes);
                const scopes = new Set([...options.keys(), ...selected]);
                const groups = new Map();
                for (const scope of scopes) {
                    const { title, label, group, campus, grade } = describeClass(scope);
                    if (!groups.has(group)) {
                        const gradeNumber = grade.match(/\d+/);
                        groups.set(group, { group, campus, gradeNumber: gradeNumber ? Number(gradeNumber[0]) : -1, items: [] });
                    }
                    groups.get(group).items.push({ scope, title, label });
                }
                const orderedGroups = [...groups.values()].sort((a, b) =>
                    Number(!a.campus) - Number(!b.campus) ||
                    a.campus.localeCompare(b.campus, 'zh-CN') ||
                    b.gradeNumber - a.gradeNumber ||
                    a.group.localeCompare(b.group, 'zh-CN'));
                for (const { group, items } of orderedGroups) {
                    const section = element('section', 'teacher-auth-class-group');
                    const chips = element('div', 'teacher-auth-chips');
                    for (const { scope, title, label } of items.sort((a, b) =>
                        a.title.localeCompare(b.title, 'zh-CN', { numeric: true }))) {
                        const choice = element('label', 'teacher-auth-chip');
                        const check = document.createElement('input');
                        check.type = 'checkbox';
                        check.name = 'scope';
                        check.value = scope;
                        check.checked = selected.has(scope);
                        check.setAttribute('aria-label', label);
                        choice.append(check, element('span', '', title));
                        chips.append(choice);
                    }
                    section.append(element('h4', '', group), chips);
                    classPicker.append(section);
                }
                if (!scopes.size) classPicker.textContent = '请先在学生名单中添加教学班。';
                updateCount();
                const save = editor.querySelector('[type="submit"]');
                editor.onsubmit = async event => {
                    event.preventDefault();
                    const fields = new FormData(editor);
                    const name = fields.get('teacherName').trim(), loginId = normalize(fields.get('loginId'));
                    const classes = fields.getAll('scope');
                    if (!name || !loginId || /\s/.test(loginId) || (!directory && !classes.length)) {
                        showFeedback('请填写教师姓名、无空格的 ID，并至少选择一个教学班。');
                        return;
                    }
                    save.disabled = true;
                    try {
                        if (window.__gakutenAuth.getAuth()?.mode !== 'admin') throw Error('请重新登录管理员账号。');
                        if (directory) {
                            await directoryRequest('teachers', {
                                id: teacher?.id, version: teacher?.version, name, loginId, active: fields.has('active'),
                                classIds: [...directory.scopes].filter(([, scope]) => classes.includes(scope)).map(([id]) => id)
                            });
                            directory = await loadDirectory();
                            const updated = directory.accounts.find(account => account.loginId === loginId);
                            render();
                            openEditor(updated);
                            showFeedback('已保存两边共用的教师账号与班级授权。', 'success');
                            return;
                        }
                        const accounts = readAccounts();
                        if (accounts.some(entry => entry.loginId === loginId && entry.id !== teacher?.id)) throw Error('该教师 ID 已被使用。');
                        const index = accounts.findIndex(entry => entry.id === teacher?.id);
                        if (teacher && accounts[index]?.version !== teacher.version) throw Error('账号已变更，请重新打开编辑。');
                        const updated = { id: teacher?.id || crypto.randomUUID(), name, loginId,
                            active: fields.has('active'), classes, version: (teacher?.version || 0) + 1 };
                        if (index < 0) accounts.push(updated);
                        else accounts[index] = updated;
                        localStorage.setItem(key, JSON.stringify(accounts));
                        render();
                        openEditor(updated);
                        showFeedback('已保存教师账号与班级授权。', 'success');
                    } catch (error) {
                        showFeedback(error.message);
                    } finally {
                        save.disabled = false;
                    }
                };
                editor.elements.teacherName.focus({ preventScroll: true });
            }
            search.value = '';
            search.oninput = render;
            clearSearch.onclick = () => {
                search.value = '';
                render();
                search.focus();
            };
            find('[data-teacher-add]').onclick = () => openEditor();
            find('[data-teacher-cancel]').onclick = () => {
                const previousId = selectedId;
                showEmpty();
                const previous = [...list.querySelectorAll('[data-teacher-id]')].find(row => row.dataset.teacherId === previousId);
                (previous || find('[data-teacher-add]')).focus();
            };
            classPicker.onchange = updateCount;
            for (const button of workspace.querySelectorAll('[data-teacher-selection]')) {
                button.onclick = () => {
                    for (const box of classPicker.querySelectorAll('input')) box.checked = button.dataset.teacherSelection === 'all';
                    updateCount();
                };
            }
            showEmpty();
        }
    };
})();
