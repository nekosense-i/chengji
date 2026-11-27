(() => {
    const auth = () => window.__gakutenAuth.getAuth();
    const isTeacher = () => auth()?.sharedDirectory === true;
    const stateFor = store => store.state.personalExamTemplates ??= {templates:[],defaults:{}};
    const ownTemplates = store => store.state.data.examTemplates.filter(template=>template.schoolPublished !== true && !template._deleted);
    const refreshSelect = ui => ui.refreshExamTemplateSelect(document.getElementById('m-template-select')?.value || '');
    const currentClass = teacher => JSON.stringify([teacher.campus,teacher.grade,teacher.classId]);
    const content = ({templates,defaults}) => JSON.stringify({templates,defaults});
    let timer, inFlight;

    UI.prototype.syncPersonalExamTemplates = async function () {
        const teacher = auth();
        if (!teacher?.sharedDirectory || inFlight || !navigator.onLine) return;
        inFlight = true;
        const local = stateFor(this.store);
        const fingerprint = content(local);
        try {
            const request = window.gk2TeacherAccounts.directoryRequest;
            const result = Number.isInteger(local.version) && local.baseline !== fingerprint
                ? await request('gakuten-templates',{templates:local.templates,defaults:local.defaults,version:local.version})
                : await request('gakuten-templates');
            if (auth()?.teacherId !== teacher.teacherId) return;
            local.version = result.version;
            local.baseline = content(result);
            if (content(local) === fingerprint) {
                local.templates = result.templates;
                local.defaults = result.defaults;
                this.store.state.data.examTemplates = this.store.state.data.examTemplates
                    .filter(item=>item.schoolPublished === true).concat(local.templates);
                refreshSelect(this);
                if (!this._editingExamTemplateId && !this._creatingExamTemplate) this.renderExamTemplateManager();
            }
            this.store.lastLocalDataSnapshot = this.store.cloneSyncState();
            this.store.writeLocalState();
        } catch (error) {
            if (!document.hidden) Utils.msg(error.message,'error');
        } finally {
            inFlight = false;
        }
    };

    const save = Store.prototype.save;
    Store.prototype.save = function (...args) {
        if (isTeacher()) {
            const local = stateFor(this);
            local.templates = structuredClone(ownTemplates(this));
            if (content(local)!==local.baseline) {
                clearTimeout(timer);
                timer = setTimeout(()=>window.app?.ui?.syncPersonalExamTemplates(),500);
            }
        }
        return save.apply(this,args);
    };

    const defaultTemplate = UI.prototype.getDefaultExamTemplate;
    UI.prototype.getDefaultExamTemplate = function () {
        const teacher = auth();
        if (!teacher?.sharedDirectory) return defaultTemplate.call(this);
        const id = stateFor(this.store).defaults[currentClass(teacher)];
        return this.store.state.data.examTemplates.find(template=>template.id===id && !template._deleted)
            || this.store.state.data.examTemplates.find(template=>template.schoolPublished && template.isDefault && !template._deleted)
            || null;
    };

    const setDefault = UI.prototype.setDefaultExamTemplate;
    UI.prototype.setDefaultExamTemplate = function (id) {
        if (!isTeacher()) return setDefault.call(this,id);
        if (!Number.isInteger(stateFor(this.store).version)) return Utils.msg('正在读取个人模板，请稍后保存。','info');
        if (!this.store.state.data.examTemplates.some(item=>item.id===id && !item._deleted)) return;
        const {defaults} = stateFor(this.store), scope = currentClass(auth());
        if (defaults[scope] === id) delete defaults[scope];
        else defaults[scope] = id;
        this.store.save();
        refreshSelect(this);
        this.renderExamTemplateManager();
    };

    for (const method of ['editExamTemplate','renameExamTemplate','deleteExamTemplate','saveExamTemplateTypes']) {
        const original = UI.prototype[method];
        UI.prototype[method] = function (...args) {
            const id = args[0] || this._editingExamTemplateId;
            if (isTeacher() && this.store.state.data.examTemplates.some(item=>item.id===id && item.schoolPublished)) {
                return Utils.msg('学校通用模板由管理员维护，可以复制为个人模板。','error');
            }
            return original.apply(this,args);
        };
    }

    const open = UI.prototype.openExamTemplateManager;
    UI.prototype.openExamTemplateManager = function (...args) {
        const result = open.apply(this,args);
        if (isTeacher()) this.syncPersonalExamTemplates();
        return result;
    };
    for (const method of ['saveNewExamTemplate','saveExamTemplate']) {
        const original = UI.prototype[method];
        UI.prototype[method] = function (...args) {
            if (isTeacher() && !Number.isInteger(stateFor(this.store).version)) {
                this.syncPersonalExamTemplates();
                return Utils.msg('正在读取个人模板，请稍后保存。','info');
            }
            return original.apply(this,args);
        };
    }

    const render = UI.prototype.renderExamTemplateManager;
    UI.prototype.renderExamTemplateManager = function (...args) {
        const result = render.apply(this,args);
        const body = document.getElementById('exam-template-manager-body');
        if (!body) return result;
        for (const row of body.querySelectorAll('tr')) {
            const load = row.querySelector('[data-action="load"]');
            const template = this.store.state.data.examTemplates.find(item=>item.id===load?.dataset.id);
            if (!template) continue;
            const tag = document.createElement('small');
            tag.className = 'dialog-note';
            tag.textContent = template.schoolPublished ? '学校通用' : isTeacher() ? '我的模板' : '未发布';
            row.firstElementChild.append(' ',tag);
            if (isTeacher() && template.schoolPublished || auth()?.mode==='admin') {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gk2-template-action';
                if (isTeacher()) {
                    row.querySelectorAll('[data-action="rename"],[data-action="edit"],[data-action="delete"]').forEach(node=>node.remove());
                    button.textContent = '复制为我的模板';
                    button.onclick = () => {
                        if (!Number.isInteger(stateFor(this.store).version)) return Utils.msg('正在读取个人模板，请稍后复制。','info');
                        const copy = {id:Utils.id(),name:template.name+'（副本）',types:structuredClone(template.types),_ts:Date.now()};
                        if (template.assessmentRule) copy.assessmentRule = structuredClone(template.assessmentRule);
                        this.store.state.data.examTemplates.push(copy);
                        this.store.save();
                        refreshSelect(this);
                        this.renderExamTemplateManager();
                    };
                } else {
                    button.textContent = template.schoolPublished ? '取消发布' : '发布为通用';
                    button.onclick = () => {
                        template.schoolPublished = !template.schoolPublished;
                        template._ts = Date.now();
                        this.store.save();
                        this.renderExamTemplateManager();
                    };
                }
                load.after(button);
            }
        }
        return result;
    };
})();
