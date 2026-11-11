"""Build the verified production baseline plus the focused Aliyun sync update."""
from pathlib import Path
import argparse
import hashlib
import re
import shutil

ROOT = Path(__file__).resolve().parent


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
    # Count validation applies to both correct and incorrect question counts.
    start, end = core.index('                renderExamTables(eid) {'), core.index('                saveVal(sid, eid, tn, val, tid, max = 0, inputEl) {')
    core = core[:start] + core[start:end].replace('正确题数', '题数') + core[end:]
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
    styles_path = re.search(r'assets/app/styles\.[a-f0-9]+\.css', html)[0]
    styles = (ROOT / styles_path).read_text()
    idle_scope_shadow = 'box-shadow:0 1px 2px rgba(49,91,145,.055);'
    if styles.count(idle_scope_shadow) != 1:
        raise RuntimeError('Production idle scope shadow anchor changed')
    styles = styles.replace(idle_scope_shadow, 'box-shadow:none;', 1)
    styles += '\n' + (ROOT / 'src/exam-entry-modes.css').read_text()
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
