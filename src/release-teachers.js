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
    const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    async function hash(password, salt) {
        if (!crypto.subtle) throw Error('当前浏览器无法使用凭证加密，请通过本机文件或 HTTPS 打开。');
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        return hex(new Uint8Array(await crypto.subtle.deriveBits({
            name: 'PBKDF2', salt: encoder.encode(salt), iterations: 600000, hash: 'SHA-256'
        }, key, 256)));
    }
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
        async signIn(id, password) {
            const teacher = read().find(entry => entry.loginId === normalize(id) && entry.active);
            if (!teacher || !password || await hash(password, teacher.salt) !== teacher.passwordHash) return null;
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
            const dialog = document.getElementById('gk2-teacher-panel');
            const list = dialog.querySelector('[data-teacher-list]');
            const editor = dialog.querySelector('form');
            const editorTitle = dialog.querySelector('[data-teacher-editor-title]');
            const editorEmpty = dialog.querySelector('[data-teacher-editor-empty]');
            const passwordInput = editor.elements.password;
            const passwordToggle = editor.querySelector('[data-teacher-password-toggle]');
            function hideEditor() {
                editor.hidden = true;
                editor.reset();
                editorTitle.textContent = '教师资料与授权';
                editorEmpty.hidden = false;
            }
            editor.querySelector('[data-teacher-cancel]').onclick = () => {
                hideEditor();
                dialog.querySelector('[data-teacher-add]').focus();
            };
            passwordToggle.onclick = () => {
                const visible = passwordInput.type === 'password';
                passwordInput.type = visible ? 'text' : 'password';
                passwordToggle.setAttribute('aria-label', visible ? '隐藏凭证' : '显示凭证');
            };
            const options = availableClasses();
            editor.querySelector('[data-teacher-password-generate]').onclick = () => {
                passwordInput.value = hex(crypto.getRandomValues(new Uint8Array(10)));
                if (passwordInput.type === 'password') passwordToggle.click();
                passwordInput.focus();
                passwordInput.select();
            };
            function render(query = '') {
                list.replaceChildren();
                const teachers = read().filter(teacher => [teacher.name, teacher.loginId, ...teacher.classes.map(scope => options.get(scope) || scope)]
                    .some(value => value.toLowerCase().includes(normalize(query))));
                if (!teachers.length) {
                    const empty = document.createElement('p');
                    empty.className = 'gk2-teacher-empty';
                    empty.textContent = query ? '没有匹配的教师。' : '还没有教师账号。点击「添加教师」为老师分配教学班。';
                    list.append(empty);
                }
                for (const teacher of teachers) {
                    const row = document.createElement('div');
                    row.className = 'gk2-teacher-row';
                    const details = document.createElement('div');
                    const name = document.createElement('strong');
                    const identity = document.createElement('small');
                    const classes = document.createElement('p');
                    name.textContent = teacher.name;
                    identity.textContent = teacher.loginId;
                    const state = document.createElement('span');
                    state.className = 'gk2-teacher-state';
                    state.dataset.active = String(teacher.active);
                    state.textContent = teacher.active ? '已启用' : '已停用';
                    classes.className = 'gk2-teacher-class-chips';
                    for (const scope of teacher.classes) {
                        const chip = document.createElement('span');
                        chip.textContent = options.get(scope) || JSON.parse(scope).join(' · ');
                        classes.append(chip);
                    }
                    details.append(name, state, identity, classes);
                    const edit = document.createElement('button');
                    edit.type = 'button';
                    edit.className = 'secondary';
                    edit.textContent = '编辑';
                    edit.setAttribute('aria-label', '编辑 ' + teacher.name);
                    edit.onclick = () => openEditor(teacher);
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'secondary gk2-roster-remove';
                    remove.textContent = '删除';
                    remove.setAttribute('aria-label', '删除 ' + teacher.name);
                    remove.onclick = () => {
                        window.app.ui.showConfirmDialog('删除教师「' + teacher.name + '」的本机账号与授权？学生名单、考试和成绩将保留。', () => {
                            if (window.__gakutenAuth.getAuth()?.mode !== 'admin') return;
                            const accounts = read();
                            if (accounts.find(account => account.id === teacher.id)?.version !== teacher.version) return;
                            localStorage.setItem(key, JSON.stringify(accounts.filter(account => account.id !== teacher.id)));
                            hideEditor();
                            render(dialog.querySelector('[data-teacher-search]').value);
                        });
                    };
                    const actions = document.createElement('div');
                    actions.className = 'gk2-teacher-row-actions';
                    actions.append(edit, remove);
                    row.append(details, actions);
                    list.append(row);
                }
            }
            function openEditor(teacher) {
                editor.hidden = false;
                editorEmpty.hidden = true;
                editorTitle.textContent = teacher ? '编辑教师：' + teacher.name : '新建教师账号';
                editor.reset();
                passwordInput.type = 'password';
                passwordToggle.setAttribute('aria-label', '显示凭证');
                editor.querySelector('[data-password-required]').hidden = !!teacher;
                editor.elements.teacherName.value = teacher?.name || '';
                editor.elements.loginId.value = teacher?.loginId || '';
                editor.elements.active.checked = teacher?.active ?? true;
                editor.elements.password.required = !teacher;
                editor.querySelector('[data-password-label]').textContent = teacher ? '新凭证（留空保留原凭证）' : '初始登录凭证';
                const fieldset = editor.querySelector('[data-teacher-classes]');
                fieldset.replaceChildren();
                if (!options.size) fieldset.append('请先在学生名单中添加教学班。');
                const groups = new Map();
                for (const [scope, title] of options) {
                    const [campus, grade] = JSON.parse(scope);
                    const group = campus + ' · ' + grade;
                    if (!groups.has(group)) groups.set(group, []);
                    groups.get(group).push([scope, title]);
                }
                for (const [group, classes] of groups) {
                    const heading = document.createElement('div');
                    heading.className = 'gk2-teacher-class-group';
                    heading.textContent = group;
                    fieldset.append(heading);
                    for (const [scope, title] of classes) {
                        const label = document.createElement('label');
                        const check = document.createElement('input');
                        check.type = 'checkbox';
                        check.name = 'scope';
                        check.value = scope;
                        check.checked = teacher?.classes.includes(scope) || false;
                        const text = document.createElement('span');
                        text.textContent = title;
                        text.title = title;
                        label.append(check, text);
                        fieldset.append(label);
                    }
                }
                const updateCount = () => {
                    editor.querySelector('[data-teacher-class-count]').textContent =
                        '已选 ' + fieldset.querySelectorAll('input:checked').length + ' 个';
                };
                fieldset.onchange = updateCount;
                for (const button of editor.querySelectorAll('[data-teacher-class-set]')) {
                    button.onclick = () => {
                        for (const box of fieldset.querySelectorAll('input')) box.checked = button.dataset.teacherClassSet === 'all';
                        updateCount();
                    };
                }
                updateCount();
                const status = editor.querySelector('[role="alert"]');
                const save = editor.querySelector('[type="submit"]');
                status.textContent = '';
                editor.onsubmit = async event => {
                    event.preventDefault();
                    const fields = new FormData(editor);
                    const name = fields.get('teacherName').trim(), loginId = normalize(fields.get('loginId'));
                    const classes = fields.getAll('scope'), password = fields.get('password');
                    if (!name || !loginId || /\s/.test(loginId) || !classes.length) {
                        status.textContent = '请填写教师姓名、无空格的 ID，并至少选择一个教学班。';
                        return;
                    }
                    save.disabled = true;
                    try {
                        const salt = password ? hex(crypto.getRandomValues(new Uint8Array(16))) : teacher.salt;
                        const passwordHash = password ? await hash(password, salt) : teacher.passwordHash;
                        if (window.__gakutenAuth.getAuth()?.mode !== 'admin') throw Error('请重新登录管理员账号。');
                        const accounts = read();
                        if (accounts.some(entry => entry.loginId === loginId && entry.id !== teacher?.id)) throw Error('该教师 ID 已被使用。');
                        const index = accounts.findIndex(entry => entry.id === teacher?.id);
                        if (teacher && accounts[index]?.version !== teacher.version) throw Error('账号已变更，请重新打开编辑。');
                        const updated = { id: teacher?.id || crypto.randomUUID(), name, loginId, salt, passwordHash,
                            active: fields.has('active'), classes, version: (teacher?.version || 0) + 1 };
                        if (index < 0) accounts.push(updated);
                        else accounts[index] = updated;
                        localStorage.setItem(key, JSON.stringify(accounts));
                        hideEditor();
                        render(dialog.querySelector('[data-teacher-search]').value);
                    } catch (error) {
                        status.textContent = error.message;
                    } finally {
                        save.disabled = false;
                    }
                };
                editor.elements.teacherName.focus();
            }
            const search = dialog.querySelector('[data-teacher-search]');
            search.value = '';
            search.oninput = () => render(search.value);
            dialog.querySelector('[data-teacher-add]').onclick = () => openEditor();
            hideEditor();
            render();
        }
    };
})();
