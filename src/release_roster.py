"""Focused presentation changes for the release roster renderer."""
import re


def update_roster(core):
    start = core.index('                renderStudents() {')
    end = core.index('                _layoutStudentGroupEditButtons()', start)
    roster = core[start:end]
    roster = re.sub(r'^.*const id(?:Cam|Grd) = .*\n', '', roster, flags=re.M)
    roster = re.sub(r'^.*html \+= `<details class="tree-level" id="\$\{idCam\}".*\n', '', roster, flags=re.M)
    roster = re.sub(
        r'<details class="tree-level" id="\$\{idGrd\}".*?<div class="tree-content">',
        r'''<section class="gk2-roster-group"><header class="gk2-roster-group-heading"><span class="gk2-roster-group-label"><strong>${safeCampusLabel}</strong>${groupEditButton('campus', cam)}</span><span aria-hidden="true">·</span><span class="gk2-roster-group-label"><strong>${safeGradeLabel}</strong>${groupEditButton('grade', grd, cam)}</span></header>''',
        roster, count=1,
    )
    roster = roster.replace('                            html += `</div></details>`;\n                        }\n                        html += `</div></details>`;',
                            '                            html += `</section>`;\n                        }', 1)
    roster = re.sub(r'<th>学生姓名</th>.*?<\/th>\s*\n', '<th>学生姓名</th><th>原行政班</th><th>标签</th><th>操作</th>\n', roster, count=1)
    roster = re.sub(r'^.*const safe(?:Campus|Grade|Class) = .*\n', '', roster, flags=re.M)
    roster = re.sub(r'^.*<td><input class="student-input" value="\$\{safe(?:Campus|Grade|Class)\}".*\n', '', roster, flags=re.M)
    roster = roster.replace('title="编辑名称"', '''title="编辑${kind === 'campus' ? '校区' : kind === 'grade' ? '年级' : '班级'}名称"''')
    roster = roster.replace('<td><input class="student-input" value="${safeName}"', '''<td><div class="gk2-roster-name"><input aria-label="学生姓名" class="student-input" style="--roster-name-length:${Math.max(5, Math.min(12, String(s.name || '').length))}" value="${safeName}"''', 1)
    roster = roster.replace('看档案</a></td>', '档案</a>${transferMark}</div></td>', 1)
    roster = roster.replace('href="#" class="table-link--student" onclick="window.app.ui.openStudentDashboardModal(\'${s.id}\')"', 'href="#" class="table-link--student" onclick="event.preventDefault(); window.app.ui.openStudentDashboardModal(\'${s.id}\')"', 1)
    roster = roster.replace('class="cell-min-120"', 'class="gk2-roster-tags"')
    roster = roster.replace('>${window.gk2IconMarkup(\'tag\')}</button>', '>+ 标签</button>', 1)
    roster = roster.replace('<td><button class="secondary btn--danger-outline"', '''<td class="gk2-roster-row-actions">${window.gk2Policy?.admin() ? `<button type="button" class="secondary gk2-roster-move" onclick="window.app.ui.openBulkEditStudents(['${s.id}'])">调整归属</button>` : ''}<button class="secondary gk2-roster-remove"''', 1)
    core = core[:start] + roster + core[end:]
    core = core.replace('openBulkEditStudents() {\n                    const ids = this._getSelectedRosterStudentIds();',
                        'openBulkEditStudents(ids = this._getSelectedRosterStudentIds()) {', 1)
    core = core.replace('        const result = originalRenderStudents.apply(this, args);', """        const container = document.getElementById('tree-container-students');
        const bar = document.getElementById('gk2-roster-selection-bar');
        if (bar && container?.contains(bar)) container.before(bar);
        const result = originalRenderStudents.apply(this, args);""", 1)
    core = re.sub(r"            bar.style.cssText = 'position:fixed;z-index:80;.*?';\n            document.body.appendChild\(bar\);",
                  "            container.before(bar);", core, count=1)
    core = core.replace("bar.style.display = ids.length ? 'flex' : 'none';", """const selectedGroups = new Set([...container.querySelectorAll('.stu-checkbox:checked')]
                .map(box => box.closest('.tree-table-wrapper')));
            const [group] = selectedGroups;
            if (selectedGroups.size === 1) {
                if (bar.parentElement !== group) group.prepend(bar);
            } else if (bar.parentElement === container || container.contains(bar)) {
                container.before(bar);
            }
            bar.hidden = !ids.length;""", 1)
    core = core.replace('data-action="delete">移出名单', 'data-action="delete">批量删除', 1)
    return core
