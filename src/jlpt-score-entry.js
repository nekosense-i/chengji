/* Official JLPT scaled-score entry templates. Legacy exams keep their existing rules. */
(() => {
    'use strict';

    const levelRules = {
        N1: { passTotal: 100, sections: [
            ['语言知识（文字・词汇・语法）', 60, 19], ['读解', 60, 19], ['听解', 60, 19]
        ] },
        N2: { passTotal: 90, sections: [
            ['语言知识（文字・词汇・语法）', 60, 19], ['读解', 60, 19], ['听解', 60, 19]
        ] },
        N3: { passTotal: 95, sections: [
            ['语言知识（文字・词汇・语法）', 60, 19], ['读解', 60, 19], ['听解', 60, 19]
        ] },
        N4: { passTotal: 90, sections: [
            ['语言知识・读解', 120, 38], ['听解', 60, 19]
        ] },
        N5: { passTotal: 80, sections: [
            ['语言知识・读解', 120, 38], ['听解', 60, 19]
        ] }
    };
    const templates = Object.fromEntries(Object.entries(levelRules).map(([level, config]) => {
        const types = config.sections.map(([name, max]) => ({ name, max, manualScore: true }));
        const sectionPassMarks = Object.fromEntries(config.sections.map(([name, , min]) => [name, min]));
        return [`jlpt:${level}`, {
            id: `jlpt:${level}`,
            name: `JLPT ${level} 官方成绩`,
            level,
            types,
            assessmentRule: { kind: 'jlpt-official', level, passTotal: config.passTotal, sectionPassMarks }
        }];
    }));

    const mock = window.gk2JLPTMock;
    function mockTypes(level, counts) {
        const merged = ['N4', 'N5'].includes(level);
        const shared = counts[0] + counts[1] + (merged ? counts[2] : 0);
        return mock.names.map((name, i) => ({
            name, questionCount: counts[i], manualScore: false,
            max: i === 3 || (i === 2 && !merged) ? 60 : counts[i] / shared * (merged ? 120 : 60)
        }));
    }
    const paperTemplates = Object.entries(mock.levels).reverse().map(([level, config]) => {
        const official = templates[`jlpt:${level}`];
        const id = `jlpt-mock:${level}`;
        return templates[id] = {
            id, level, name: `${level}试卷`,
            types: mockTypes(level, config.counts),
            assessmentRule: { ...official.assessmentRule, kind: 'jlpt-mock' }
        };
    });

    const templateFor = id => templates[id] || null;
    const ruleForExam = exam => ['jlpt-official', 'jlpt-mock', 'jlpt-mock-score'].includes(exam?.assessmentRule?.kind) ? exam.assessmentRule : null;
    const sameRule = (left, right) => {
        if (!left || !right) return !left && !right;
        if (left.kind !== right.kind || left.level !== right.level || left.passTotal !== right.passTotal) return false;
        const a = left.sectionPassMarks || {}, b = right.sectionPassMarks || {};
        return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
    };
    const sameTypes = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && expected.every((type, index) =>
        actual[index]?.name === type.name && Number(actual[index]?.max) === type.max && !actual[index]?.questionCount
    );

    function evaluate(record, exam) {
        const rule = ruleForExam(exam);
        if (!rule) return null;
        if (!record) return { status: '未录入', complete: false, sectionPass: false, passed: false, failures: [] };
        if (record.examAbsent) return { status: '缺考', complete: false, sectionPass: false, passed: false, failures: [] };
        if (rule.kind === 'jlpt-mock') {
            const counts = exam.types.map(t => t.questionCount);
            const correct = exam.types.map(t => record.questionCounts?.[t.name]);
            const result = mock.evaluate(rule.level, counts, correct);
            if (result?.complete && exam.types.every((type, i) => Math.abs(record.details?.[type.name] - correct[i] * type.max / counts[i]) < 0.005001)) {
                const failures = result.sections.filter(section => section.score < section.minimum).map(section => section.name);
                return { ...result, failures, sectionPass: !failures.length, totalPass: result.total >= rule.passTotal };
            }
        }
        const sections = Object.entries(rule.sectionPassMarks || {});
        const scores = sections.map(([name, minimum]) => {
            const index = sections.findIndex(section => section[0] === name);
            const merged = sections.length === 2;
            const types = rule.kind !== 'jlpt-mock' ? [name] : index === sections.length - 1 ? ['听力'] :
                index === 0 ? ['词汇', '文法', ...(merged ? ['阅读'] : [])] : ['阅读'];
            const values = types.map(type => record.details?.[type]);
            const raw = values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
            const value = raw === undefined || raw === null || String(raw).trim() === '' ? null : Number(raw);
            return { name, minimum, value };
        });
        const complete = scores.every(section => Number.isFinite(section.value));
        if (!complete) return { status: '待补录', complete: false, sectionPass: false, passed: false, failures: [] };
        const failures = scores.filter(section => section.value < section.minimum).map(section => section.name);
        const total = scores.reduce((sum, section) => sum + section.value, 0);
        const sectionPass = failures.length === 0;
        const passed = sectionPass && total >= rule.passTotal;
        return { status: rule.kind === 'jlpt-official' ? (passed ? '合格' : '未合格') : (passed ? '模拟参考达线' : '模拟参考未达线'), complete, sectionPass, passed, failures, total, totalPass: total >= rule.passTotal };
    }

    const api = Object.freeze({ templates, templateFor, ruleForExam, sameRule, sameTypes, evaluate });
    window.gk2JLPT = api;

    // Keep the shared statistics API intact for all legacy exams while applying
    // the official two-part pass rule to JLPT summaries.
    const baseStatistics = window.gk2Statistics;
    if (baseStatistics?.summarize) {
        window.gk2Statistics = Object.freeze({
            ...baseStatistics,
            summarize(rows, exam) {
                const summary = baseStatistics.summarize(rows, exam);
                const rule = ruleForExam(exam);
                if (!rule) return summary;
                const validRows = rows.filter(row => row.record && baseStatistics.inspect(row.record, exam).included);
                const results = validRows.map(row => evaluate(row.record, exam));
                const passCount = results.filter(result => result.passed).length;
                const sectionPassCount = results.filter(result => result.sectionPass).length;
                return {
                    ...summary,
                    passCount,
                    passRate: validRows.length ? passCount / validRows.length * 100 : null,
                    excellentCount: null,
                    excellentRate: null,
                    sectionPassCount,
                    sectionPassRate: validRows.length ? sectionPassCount / validRows.length * 100 : null
                };
            }
        });
    }

    const UILayer = UI;
    if (!UILayer?.prototype) return;

    const originalRefresh = UILayer.prototype.refreshExamTemplateSelect;
    UILayer.prototype.refreshExamTemplateSelect = function(selectedId = '') {
        originalRefresh.call(this, selectedId);
        const select = document.getElementById('m-template-select');
        if (!select) return;
        const group = document.createElement('optgroup');
        group.label = 'JLPT 成绩模板';
        paperTemplates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            group.appendChild(option);
        });
        select.appendChild(group);
        if (selectedId) select.value = selectedId;
    };

    function setTemplateMode(id) {
        const locked = !!templateFor(id);
        const list = document.getElementById('q-list');
        if (!list) return;
        list.dataset.gk2JlptTemplate = locked ? id : '';
        list.querySelectorAll('.q-row').forEach(row => {
            row.draggable = !locked;
            row.querySelectorAll('input,button').forEach(control => { control.disabled = locked && !(control.matches('.q-count') && templateFor(id)?.assessmentRule.kind === 'jlpt-mock'); });
        });
        const addButton = list.closest('dialog')?.querySelector('button[onclick*="addQ"]');
        if (addButton) addButton.disabled = locked;
        let note = document.getElementById('gk2-jlpt-entry-note');
        if (locked && !note) {
            note = document.createElement('div');
            note.id = 'gk2-jlpt-entry-note';
            note.className = 'field-hint mb-sm';
            list.after(note);
        }
        if (note) {
            const template = templateFor(id);
            note.hidden = !template;
            if (template) {
                const rule = template.assessmentRule;
                const sectionText = Object.entries(rule.sectionPassMarks).map(([name, min]) => `${name} ≥ ${min}`).join('；');
                note.textContent = rule.kind === 'jlpt-mock' ? '可按试卷调整题数。录分时可选择正确题数、错误题数或直接填写四项分数。' : rule.kind === 'jlpt-mock-score' ? '直接填入大板块模拟分，四项正确率未提供。' : `录入 JLPT ${rule.level} 成绩单上的尺度分（非答对题数换算分）。官方合格线：总分 ${rule.passTotal}/180；分项基准：${sectionText}。`;
            }
        }
    }

    const originalLoad = UILayer.prototype.loadExamTemplate;
    UILayer.prototype.loadExamTemplate = function(templateId = '', options = {}) {
        const select = document.getElementById('m-template-select');
        const id = templateId || select?.value || '';
        const template = templateFor(id);
        if (!template) {
            const result = originalLoad.call(this, templateId, options);
            setTemplateMode('');
            return result;
        }
        if (select) select.value = id;
        const list = document.getElementById('q-list');
        if (!list) return Utils.msg('题型列表未找到', 'error');
        list.innerHTML = '';
        template.types.forEach(type => {
            const row = document.createElement('div');
            row.className = 'q-row';
            row.innerHTML = this._renderQuestionRow({ name: type.name, max: type.max, manualScore: type.manualScore, questionCount: type.questionCount, old: null });
            list.appendChild(row);
        });
        this._syncQuestionRows('q-list');
        setTemplateMode(id);
        const name = document.getElementById('m-ename');
        if (name && !name.value.trim()) {
            const date = document.getElementById('m-edate')?.value || '日期待补';
            name.value = `${template.name}（${date}）`;
        }
        if (!options.silent) Utils.msg(`${template.name}模板已加载`);
    };

    const originalOpen = UILayer.prototype.openExamModal;
    UILayer.prototype.openExamModal = function(...args) {
        const result = originalOpen.apply(this, args);
        setTemplateMode(document.getElementById('m-template-select')?.value || '');
        return result;
    };

    const collect = UILayer.prototype.collectCurrentQuestionTypes;
    UILayer.prototype.collectCurrentQuestionTypes = function() {
        const template = templateFor(document.getElementById('q-list')?.dataset.gk2JlptTemplate);
        if (template?.assessmentRule.kind !== 'jlpt-mock') return collect.call(this);
        const counts = [...document.querySelectorAll('#q-list .q-count')].map(input => Number(input.value));
        return counts.length === 4 && counts.every(n => Number.isInteger(n) && n > 0) ? mockTypes(template.level, counts) : null;
    };

    const originalCreate = UILayer.prototype.doCreateExam;
    UILayer.prototype.doCreateExam = function(...args) {
        const id = document.getElementById('m-template-select')?.value || '';
        const template = templateFor(id);
        const loadedTemplate = document.getElementById('q-list')?.dataset.gk2JlptTemplate || '';
        if (loadedTemplate && loadedTemplate !== id) return Utils.msg('已更改模板选择，请先点击“加载”应用所选模板', 'error');
        if (template) {
            const types = this.collectCurrentQuestionTypes();
            if (template.assessmentRule.kind === 'jlpt-mock' ? !types : !sameTypes(types, template.types)) return Utils.msg('请检查 JLPT 模板的题数、成绩项和满分', 'error');
        }

        return originalCreate.apply(this, args);
    };

    const originalEdit = UILayer.prototype.doEditExam;
    UILayer.prototype.doEditExam = function(...args) {
        const id = document.getElementById('me-eid')?.value || '';
        const current = this.store.state.data.exams.find(exam => exam.id === id);
        const rule = ruleForExam(current);
        const name = document.getElementById('me-ename')?.value.trim() || '';
        const grade = document.getElementById('me-grade')?.value || '';
        const target = this.store.state.data.exams.find(exam => exam.id !== id && exam.name === name && exam.grade === grade && !exam.classScope && !current?.classScope && !this._readExamClassScope('me').length);
        if (rule) {
            const template = templateFor(`jlpt:${rule.level}`);
            const types = this._collectQuestionTypesFromList('edit-q-list');
            if (!template || (rule.kind === 'jlpt-mock' ? !types || types.length !== current.types.length || types.some((t, i) => t.name !== current.types[i].name || t.max !== current.types[i].max || t.questionCount !== current.types[i].questionCount || t.manualScore !== current.types[i].manualScore) : !sameTypes(types, template.types))) return Utils.msg('JLPT 考试的计分结构须保持一致', 'error');
            if (target && (!sameRule(target.assessmentRule, rule) || !sameTypes(target.types, template.types))) {
                return Utils.msg('不能将 JLPT 官方成绩考试合并到不同等级或普通考试', 'error');
            }
        } else if (target && ruleForExam(target)) {
            return Utils.msg('不能将普通考试合并到 JLPT 官方成绩考试，请使用独立名称', 'error');
        }
        return originalEdit.apply(this, args);
    };

    const originalRenderTemplateManager = UILayer.prototype.renderExamTemplateManager;
    UILayer.prototype.renderExamTemplateManager = function(...args) {
        const result = originalRenderTemplateManager.apply(this, args);
        const body = document.getElementById('exam-template-manager-body');
        if (!body) return result;
        const hint = document.querySelector('#exam-template-manager-dialog > .dialog-note');
        if (hint) hint.textContent = '自定义模板可设为新建默认项并继续编辑；JLPT 试卷模板可按实际试卷调整题数。';
        if (this._creatingExamTemplate || this._editingExamTemplateId) return result;

        let table = body.querySelector('.gk2-template-manager-table');
        if (!table) {
            body.innerHTML = `
                <div class="table-scroll-container" style="max-height:420px;">
                    <table class="table-shell gk2-template-manager-table">
                        <thead><tr><th>模板名称</th><th>题型构成</th><th class="gk2-template-default-heading">新建默认</th><th class="gk2-template-actions-heading">操作</th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>`;
            table = body.querySelector('.gk2-template-manager-table');
        }
        const tbody = table.querySelector('tbody');
        if (!tbody || tbody.querySelector('.gk2-jlpt-template-divider')) return result;
        tbody.insertAdjacentHTML('beforeend', `<tr class="gk2-jlpt-template-divider"><th colspan="4" style="text-align:left;">JLPT 成绩模板</th></tr>${paperTemplates.map(template => {
            const composition = template.types.map(type => `${Utils.escapeHTML(type.name)}（${type.questionCount ? type.questionCount + '题' : type.max + '分'}）`).join('、');
            const total = template.assessmentRule.passTotal;
            return `<tr class="gk2-jlpt-template-row">
                <td style="font-weight:700;">${Utils.escapeHTML(template.name)}<small class="dialog-note" style="display:block;">系统内置</small></td>
                <td class="dialog-note">${composition}<br><strong>总分参考线 ${total}/180</strong></td>
                <td class="gk2-template-default-cell"><span class="dialog-note">内置模板</span></td>
                <td class="gk2-template-actions-cell"><div class="gk2-template-actions"><button class="gk2-template-action gk2-template-action--load" type="button" data-action="load" data-id="${template.id}">加载</button></div></td>
            </tr>`;
        }).join('')}`);
        return result;
    };
})();
