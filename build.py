"""Build the verified production baseline and its focused local feature updates."""
from pathlib import Path
import argparse
import hashlib
import re
import shutil

ROOT = Path(__file__).resolve().parent


def add_disclosure_core(core):
    anchor = '            return { Store, Sync, UI };'
    old = "const isOpen = panel.style.display !== 'none';\n                    panel.style.display = isOpen ? 'none' : 'flex';"
    if core.count(anchor) != 1 or core.count(old) != 1:
        raise RuntimeError('Production disclosure core anchor changed')
    core = core.replace(anchor, (ROOT / 'src/disclosure-motion.js').read_text() + '\n' + anchor, 1)
    return core.replace(old, "const isOpen = window.gk2Disclosure.isOpen(panel);\n                    window.gk2Disclosure.set(panel, !isOpen, { display: 'flex' });", 1)


def add_disclosure_features(features):
    replacements = [
        ("String(d.open)));bindHoverExpand(d,d,()=>{d.open=true;},()=>{d.open=false;});s.addEventListener('click',event=>{if(d.open&&event.detail>0&&d.matches(':hover'))event.preventDefault();});",
         "String(window.gk2Disclosure.menuOpen(d))));bindHoverExpand(d,d,()=>window.gk2Disclosure.setMenu(d,true),()=>window.gk2Disclosure.setMenu(d,false));s.addEventListener('click',event=>{event.preventDefault();const open=window.gk2Disclosure.menuOpen(d);if(open&&event.detail>0&&d.matches(':hover'))return;window.gk2Disclosure.setMenu(d,!open);});", 1),
        ("b.closest('details').open=false;", "window.gk2Disclosure.setMenu(b.closest('details'),false);", 1),
        ("open.forEach(m=>m.open=false)", "open.forEach(m=>window.gk2Disclosure.setMenu(m,false))", 1),
        ("quickFillSettings.hidden=!quickFillSettings.hidden;quickFillSettingsToggle.setAttribute('aria-expanded',String(!quickFillSettings.hidden));",
         "const open=!window.gk2Disclosure.isOpen(quickFillSettings);window.gk2Disclosure.set(quickFillSettings,open);quickFillSettingsToggle.setAttribute('aria-expanded',String(open));", 1),
        ("quickFillSettings.hidden=true;quickFillSettingsToggle.setAttribute('aria-expanded','false');",
         "window.gk2Disclosure.set(quickFillSettings,false,{immediate:true});quickFillSettingsToggle.setAttribute('aria-expanded','false');", 1),
        ("$('#compare-advanced-panel').style.display!=='none'", "window.gk2Disclosure.isOpen($('#compare-advanced-panel'))", 3),
        ("const selector = '#view-students details.tree-level, #view-exams details.gk2-entry-class-group';",
         "const selector = '#view-students details.tree-level, #view-exams details.gk2-entry-class-group, details.gk2-chart-data, .gk2-drill details';", 1),
        ("const disclosureEasing = 'cubic-bezier(.3, .05, .7, .95)';", "const disclosureEasing = 'cubic-bezier(.22, 1, .36, 1)';", 1),
        ("const duration = Math.round(baseDuration / 1.3 / 1.3);", "const duration = Math.round(baseDuration);", 1),
        ("function suspended() { return document.hidden; }", "function suspended() { return document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches; }", 1),
    ]
    for old, new, expected in replacements:
        if features.count(old) != expected:
            raise RuntimeError('Production disclosure feature anchor changed: ' + old[:80])
        features = features.replace(old, new)
    return features


def build(destination):
    html = (ROOT / 'src/release/Gakuten-2.0.base.html').read_text()
    generated = {}
    core_path = re.search(r'assets/app/core\.[a-f0-9]+\.js', html)[0]
    core = (ROOT / core_path).read_text()
    anchor = '            return { Store, Sync, UI };'
    if core.count(anchor) != 1:
        raise RuntimeError('Production AppCore anchor changed')
    grade_aggregate_replacements = [
        (
            'gradeStudentIds.includes(s.studentId) && Utils.isActualScore(s)',
            'gradeStudentIds.includes(s.studentId) && Utils.isValidGradeAggregateScore(s, exam)',
            2,
        ),
        (
            'gradeStus.includes(s.studentId) && Utils.isActualScore(s)).sort((a,b)=>b.total - a.total);',
            'gradeStus.includes(s.studentId) && Utils.isValidGradeAggregateScore(s, ex)).sort((a,b)=>b.total - a.total);',
            1,
        ),
    ]
    for old, new, expected in grade_aggregate_replacements:
        if core.count(old) != expected:
            raise RuntimeError('Production grade aggregate anchor changed: ' + old[:80])
        core = core.replace(old, new)
    core = core.replace(
        anchor,
        (ROOT / 'src/gakuten-sync-optimization.js').read_text()
        + '\n'
        + (ROOT / 'src/grade-statistics-optimization.js').read_text()
        + '\n'
        + (ROOT / 'src/exam-entry-modes.js').read_text()
        + '\n'
        + (ROOT / 'src/jlpt-mock-rules.js').read_text()
        + '\n'
        + (ROOT / 'src/jlpt-score-entry.js').read_text()
        + '\n'
        + (ROOT / 'src/exam-class-scope.js').read_text()
        + '\n'
        + anchor,
    )
    entry_replacements = [
        ('window.app.ui.saveCorrectCount', 'window.app.ui.saveEntryCount'),
        ('if (isCount) this.saveCorrectCount(', 'if (isCount) this.saveEntryCount('),
        ('${t.name} 正确题数（共', '${t.name} ${this._getCountEntryLabel(exam)}（共'),
        ("? '保留原分' : '题数') : ''}", "? '保留原分' : (this._getExamEntryMode(exam) === 'wrong' ? '错题' : '题数')) : ''}"),
        ('data-entry-kind="${entryKind}" data-field=', 'data-entry-kind="${entryKind}" data-count-mode="${this._getExamEntryMode(exam)}" data-field='),
        ('this._getCountEntryScorePreview(inputValue, t.max, t.questionCount)', 'this._getCountEntryScorePreview(inputValue, t.max, t.questionCount, this._getExamEntryMode(exam))'),
        ('this._getCountEntryScorePreview(input.value, input.dataset.scoreMax, input.dataset.questionCount)', 'this._getCountEntryScorePreview(input.value, input.dataset.scoreMax, input.dataset.questionCount, input.dataset.countMode)'),
        ("countInput?record?.questionCounts?.[input.dataset.field]", "countInput?this._getSavedEntryInputValue(input,record)"),
        ("${isCount ? '正确题数' : '分数'}", "${isCount ? this._getCountEntryLabel(this.store.state.data.exams.find(e=>e.id===eid)) : '分数'}"),
    ]
    for old, new in entry_replacements:
        if old not in core:
            raise RuntimeError('Production entry anchor changed: ' + old[:80])
        core = core.replace(old, new)
    core = core.replace('let existingExam = this.store.state.data.exams.find(e => e.name === n && e.grade === g);',
        "const classScope = this._readExamClassScope('m');\n                    if (!classScope.length) return Utils.msg('请至少勾选一个参与日语班', 'error');\n                    let existingExam = null;")
    core = core.replace('e.id !== eid && e.name === n && e.grade === g', 'e.id !== eid && e.name === n && e.grade === g && !e.classScope && !currentExam.classScope && !classScope')
    core = core.replace('const targetExam = this.store.state.data.exams.find', '''const chosenClasses = this._readExamClassScope('me');
                    const classScope = this._getAuth()?.mode === 'teacher' ? currentExam.classScope : chosenClasses.length ? chosenClasses : currentExam.classScope;
                    const targetExam = this.store.state.data.exams.find''')
    core = core.replace('currentExam.grade = g;', 'currentExam.grade = g;\n                        if (classScope) currentExam.classScope = classScope;')
    core = core.replace('let exam = this.store.state.data.exams.find(e => e.name === n && e.grade === g);',
        'let exam = this.store.state.data.exams.find(e => e.name === n && e.grade === g && !e.classScope && !e.assessmentRule && this._getAuth()?.mode !== \'teacher\');')
    core = core.replace('types: types, grade: g, campuses: [c] };', """types: types, grade: g, campuses: [c] };
                                const importer = this._getAuth();
                                if (importer?.mode === 'teacher') exam.classScope = [JSON.stringify([importer.campus, importer.classId])];""")
    core = core.replace('!Utils.isStudentInExam(s, {id:newExamId})', '!Utils.canReadStudent(s, exam)')
    core = core.replace("const focusKey = kind === 'campus' ?", """for (const exam of this.store.state.data.exams) {
                            if (!exam.classScope) continue;
                            const nextScope = exam.classScope.map(encoded => {
                                const [site, name] = JSON.parse(encoded);
                                if (kind === 'campus' && site === oldValue) return JSON.stringify([nextValue, name]);
                                if (kind === 'teachingClass' && site === campus && exam.grade === grade && name === oldValue) return JSON.stringify([site, nextValue]);
                                return encoded;
                            });
                            if (nextScope.some((value, i) => value !== exam.classScope[i])) {
                                exam.classScope = [...new Set(nextScope)];
                                exam._ts = now;
                            }
                        }
                        const focusKey = kind === 'campus' ?""")
    core = re.sub(r'this\.store\.state\.data\.exams\.filter\((e|ex) => \{', lambda m: m[0] + '\n                        if (!this._examVisible(' + m[1] + ')) return false;', core)
    exam_create_anchor = '                        this.store.state.data.exams.push({ id: newId, _ts: Date.now(), name: n, date: d, maxTotal: max, types: qs, grade: g, campuses: selectedCampuses, entryMode });'
    if core.count(exam_create_anchor) != 1:
        raise RuntimeError('Production exam creation anchor changed')
    core = core.replace(
        exam_create_anchor,
        '                        const assessmentRule = window.gk2JLPT.templateFor(document.getElementById("m-template-select")?.value)?.assessmentRule;\n'
        '                        this.store.state.data.exams.push({ id: newId, _ts: Date.now(), name: n, date: d, maxTotal: max, types: qs, grade: g, campuses: selectedCampuses, classScope, entryMode, ...(assessmentRule ? { assessmentRule: JSON.parse(JSON.stringify(assessmentRule)) } : {}) });',
        1,
    )
    # Count validation applies to both correct and incorrect question counts.
    start, end = core.index('                renderExamTables(eid) {'), core.index('                saveVal(sid, eid, tn, val, tid, max = 0, inputEl) {')
    core = core[:start] + core[start:end].replace('正确题数', '题数') + core[end:]
    core = add_disclosure_core(core)
    total_anchor = '  out._ts=Math.max(time(a._ts),time(b._ts),...Object.values(out._fieldTs));'
    if core.count(total_anchor) != 1:
        raise RuntimeError('Production field merge anchor changed')
    core = core.replace(total_anchor, '  this._mergeDerivedTotal(a,b,out);\n' + total_anchor, 1)
    features_path = re.search(r'assets/app/features\.[a-f0-9]+\.js', html)[0]
    features = (ROOT / features_path).read_text()
    replacements = {
        "const state=!sync.isEnabled()?'paused':navigator.onLine===false?'error':sync._lampActive?'busy':sync._lampState||'busy';": "const state=sync.connectionStatus().state;",
        "const text={paused:": "const text={pending:'已保存到本机，等待云端确认；点击查看同步详情',paused:",
        "if(!sync.isEnabled()){window.gk2OpenSyncStatus();return;}await sync.pull({manual:true});": "if(!sync.isEnabled()||['pending','error'].includes(sync.connectionStatus().state)){window.gk2OpenSyncStatus();return;}await sync.manualSync();",
        "if(sync.isEnabled()&&!sync._lampActive)sync.pull({manual:true});": "if(sync.isEnabled()&&!sync._lampActive)sync.pullIfDue();",
        "'云同步正常'+(meta.lastPulledAt?": "(sync.connectionStatus().state==='pending'?'已保存到本机，等待云端同步':'云端已确认')+(meta.lastPulledAt?",
        "云端确认表示本次响应匹配；免费 KV 不保证并发事务或立即一致。多设备同时录同一学生时请分工，并保存后同步核对。": "本机修改立即保存；停顿约 2 秒后上传，连续录入约 8 秒一批。页面打开时每 12 秒检查更新；同一字段的冲突沿用现有版本规则，可在核对记录中查看。",
        "if(store.hasPendingDelta())await sync._push();else await sync.pull({manual:true});": "await sync.manualSync();",
    }
    for old, new in replacements.items():
        if features.count(old) != 1:
            raise RuntimeError('Production sync UI anchor changed: ' + old[:80])
        features = features.replace(old, new, 1)
    mode_menu = [line for line in features.splitlines() if line.startswith('    if(hasCountTypes){')]
    if len(mode_menu) != 1:
        raise RuntimeError('Production entry mode menu anchor changed')
    features = features.replace(mode_menu[0], '    if(hasCountTypes)more.body.append(ui.createExamEntryModeControl(activeExam));', 1)
    for old, new in [
        ('function configureEntryMenu(more){', 'function configureEntryMenu(more){\n  window.app.ui.configureExamEntryMenu(more.root);'),
        ("countInput?record?.questionCounts?.[input.dataset.field]", "countInput?ui._getSavedEntryInputValue(input,record)"),
        ("if(input&&/^\\d+$/.test(String(value??''))&&Number(value)>=0)input.value=String(value);", "if(input&&ret!==false)input.value=ui._getSavedEntryInputValue(input,ui.store.getScore(args[0],args[1]));"),
    ]:
        if features.count(old) != 1:
            raise RuntimeError('Production count display anchor changed: ' + old[:80])
        features = features.replace(old, new, 1)
    features = features.replace("auth.mode==='admin'||auth.mode==='teacher'&&e.grade===auth.grade", "ui._examVisible(e)")
    features = features.replace("entryMode:e.entryMode})).sort", "entryMode:e.entryMode,classScope:e.classScope,assessmentRule:e.assessmentRule})).sort")
    features = features.replace("const position=atExam(student),campus=position.campus||student.campus;", "if (exam.classScope && !window.gk2Policy.examParticipant(student,exam)) return false;\n   const position=atExam(student),campus=position.campus||student.campus;")
    features = add_disclosure_features(features)
    overview_replacements = [
        (
            'const avg=mean(values),pass=max*.6,excellent=max*.8;',
            'const jlptRule=window.gk2JLPT.ruleForExam(exam),avg=mean(values),pass=jlptRule?jlptRule.passTotal:max*.6,excellent=jlptRule?null:max*.8;',
        ),
        (
            'const passRows=valid.filter(s=>s.rec.total>=pass),excellentRows=valid.filter(s=>s.rec.total>=excellent);',
            'const sectionPassRows=jlptRule?valid.filter(s=>window.gk2JLPT.evaluate(s.rec,exam).sectionPass):[],passRows=valid.filter(s=>jlptRule?window.gk2JLPT.evaluate(s.rec,exam).passed:s.rec.total>=pass),excellentRows=jlptRule?sectionPassRows:valid.filter(s=>s.rec.total>=excellent);',
        ),
        (
            'const history=ui.store.state.data.exams.filter(e=>e.grade===exam.grade&&e.date<=exam.date&&eligible(e).length&&e.maxTotal>0).sort((a,b)=>a.date.localeCompare(b.date));',
            "const history=ui.store.state.data.exams.filter(e=>e.grade===exam.grade&&e.date<=exam.date&&eligible(e).length&&e.maxTotal>0&&(jlptRule?(e.assessmentRule?.kind===jlptRule.kind&&e.assessmentRule.level===jlptRule.level):!window.gk2JLPT.ruleForExam(e))).sort((a,b)=>a.date.localeCompare(b.date));",
        ),
        (
            'G.snapshot={exam,all,valid,max,avg,passRate,excRate,zero:zero.length,absent:absent.length,missing:missing.length,partial:partial.length,delta,statistics};',
            'G.snapshot={exam,all,valid,max,avg,passRate,excRate,zero:zero.length,absent:absent.length,missing:missing.length,partial:partial.length,delta,statistics,passRows,sectionPassRows};',
        ),
        (
            'passCount:passRows.length,excellentCount:excellentRows.length,absent:absent.length,missing:missing.length,partial:partial.length,targetTotal:',
            'passCount:passRows.length,excellentCount:jlptRule?sectionPassRows.length:excellentRows.length,assessmentRule:jlptRule,sectionPassCount:sectionPassRows.length,absent:absent.length,missing:missing.length,partial:partial.length,targetTotal:',
        ),
        (
            'title:`${boundary.length} 名学生接近及格线`,metric:String(boundary.length),unit:"人",metricLabel:"位于及格线附近"',
            'title:jlptRule?`${boundary.length} 名学生接近总合格分`:`${boundary.length} 名学生接近及格线`,metric:String(boundary.length),unit:"人",metricLabel:jlptRule?"位于 JLPT 总合格分附近":"位于及格线附近"',
        ),
    ]
    for old, new in overview_replacements:
        if features.count(old) != 1:
            raise RuntimeError('Production JLPT overview anchor changed: ' + old[:90])
        features = features.replace(old, new, 1)
    features += '\n' + (ROOT / 'src/jlpt-score-overview.js').read_text()
    styles_path = re.search(r'assets/app/styles\.[a-f0-9]+\.css', html)[0]
    styles = (ROOT / styles_path).read_text()
    idle_scope_shadow = 'box-shadow:0 1px 2px rgba(49,91,145,.055);'
    if styles.count(idle_scope_shadow) != 1:
        raise RuntimeError('Production idle scope shadow anchor changed')
    styles = styles.replace(idle_scope_shadow, 'box-shadow:none;', 1)
    styles += '\n' + (ROOT / 'src/exam-entry-modes.css').read_text()
    styles += '\n' + (ROOT / 'src/disclosure-motion.css').read_text()
    for old, content in [(core_path, core), (features_path, features), (styles_path, styles)]:
        label = old.split('/')[-1].split('.')[0]
        new = f'assets/app/{label}.{hashlib.sha256(content.encode()).hexdigest()[:16]}{Path(old).suffix}'
        html = html.replace(old, new)
        generated[new] = content
    destination.mkdir(parents=True, exist_ok=True)
    for asset in set(re.findall(r'(?:src|href)="(assets/[^"?#]+)', html)):
        target = destination / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        if asset not in generated and target.resolve() != (ROOT / asset).resolve():
            shutil.copy2(ROOT / asset, target)
    if destination != ROOT:
        shutil.copytree(ROOT / 'assets/cat-motion', destination / 'assets/cat-motion', dirs_exist_ok=True)
    for asset, content in generated.items():
        (destination / asset).write_text(content)
    (destination / 'Gakuten-2.0.html').write_text(html)
    print('Built:', ', '.join(generated))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT)
    build(parser.parse_args().output_dir.resolve())
