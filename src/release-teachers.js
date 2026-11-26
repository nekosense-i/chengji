(() => {
    const key = 'gk2_teacher_accounts_v1';
    const read = () => JSON.parse(localStorage.getItem(key) || '[]');
    const normalize = value => value.trim().toLowerCase();
    const classKey = (campus, grade, classId) => JSON.stringify([campus, grade, classId]);
    const session = (teacher, scope) => {
        const [campus, grade, classId] = JSON.parse(scope);
        return { mode: 'teacher', teacherId: teacher.id, version: teacher.version,
            name: teacher.name, loginId: teacher.loginId, campus, grade, classId };
    };
    function currentTeacher(identity) {
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
        validateSession(identity) {
            if (!identity.teacherId) return identity;
            const teacher = currentTeacher(identity);
            const scope = classKey(identity.campus, identity.grade, identity.classId);
            return teacher?.classes.includes(scope) ? session(teacher, scope) : null;
        },
        signIn(id) {
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
                if (classes.has(scope)) select.add(new Option(classes.get(scope), scope));
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
        render() {
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
            const options = availableClasses();
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
                return { title, label, group: segments.length >= 2 ? segments.slice(0, -1).join(' · ') : '其他教学班' };
            }
            function setState(badge, active) {
                badge.dataset.state = active ? 'active' : 'inactive';
                badge.textContent = active ? '已启用' : '已停用';
            }
            function render() {
                const accounts = read();
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
                        const { title, label } = describeClass(scope);
                        const chip = element('span', 'teacher-auth-badge', title);
                        chip.title = label;
                        classes.append(chip);
                    }
                    if (teacher.classes.length > 3) classes.append(element('span', 'teacher-auth-badge', '+' + (teacher.classes.length - 3)));
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
                selectedId = null;
                editor.hidden = true;
                editor.reset();
                editorTitle.textContent = '教师资料与授权';
                editorState.hidden = true;
                editorEmpty.hidden = false;
                render();
            }
            function openEditor(teacher) {
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
                editor.elements.teacherName.value = teacher?.name || '';
                editor.elements.loginId.value = teacher?.loginId || '';
                editor.elements.active.checked = teacher?.active ?? true;
                classPicker.replaceChildren();
                const scopes = new Set([...options.keys(), ...(teacher?.classes || [])]);
                const groups = new Map();
                for (const scope of scopes) {
                    const { title, label, group } = describeClass(scope);
                    if (!groups.has(group)) {
                        const section = element('section', 'teacher-auth-class-group');
                        const chips = element('div', 'teacher-auth-chips');
                        section.append(element('h4', '', group), chips);
                        groups.set(group, chips);
                        classPicker.append(section);
                    }
                    const choice = element('label', 'teacher-auth-chip');
                    const check = document.createElement('input');
                    check.type = 'checkbox';
                    check.name = 'scope';
                    check.value = scope;
                    check.checked = teacher?.classes.includes(scope) || false;
                    check.setAttribute('aria-label', label);
                    choice.append(check, element('span', '', title));
                    groups.get(group).append(choice);
                }
                if (!scopes.size) classPicker.textContent = '请先在学生名单中添加教学班。';
                updateCount();
                const status = editor.querySelector('[role="alert"]');
                const save = editor.querySelector('[type="submit"]');
                status.textContent = '';
                editor.onsubmit = event => {
                    event.preventDefault();
                    const fields = new FormData(editor);
                    const name = fields.get('teacherName').trim(), loginId = normalize(fields.get('loginId'));
                    const classes = fields.getAll('scope');
                    if (!name || !loginId || /\s/.test(loginId) || !classes.length) {
                        status.textContent = '请填写教师姓名、无空格的 ID，并至少选择一个教学班。';
                        return;
                    }
                    save.disabled = true;
                    try {
                        if (window.__gakutenAuth.getAuth()?.mode !== 'admin') throw Error('请重新登录管理员账号。');
                        const accounts = read();
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
                        find('[role="alert"]').textContent = '已保存教师账号与班级授权。';
                    } catch (error) {
                        status.textContent = error.message;
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
