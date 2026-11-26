"""Visual adjustments for entry, analysis, workbench and score details."""


def update_modules_core(core):
    core = core.replace('<tr><td colspan="3" class="table-side-note" style="font-weight:700;">录入进度与均分',
                        '<tr><td colspan="2" class="table-side-note" style="font-weight:700;">录入进度与均分', 1)
    core = core.replace('                                <th class="header-sticky-80">校区</th>\n', '', 1)
    core = core.replace("                            const safeStudentCampus = Utils.escapeHTML(stu.campus || '-');\n", '', 1)
    core = core.replace('                                <td class="table-side-note">${safeStudentCampus}</td>\n', '', 1)
    core = core.replace('Math.max(1048, 571 + (exam.types || []).length * 98)',
                        'Math.max(968, 491 + (exam.types || []).length * 98)', 1)
    core = core.replace('''                                    : inputHtml;
                                trHtml += `<td class="score-cell${countMode ? ' gk2-count-entry-cell' : ''}">${inputControlHtml}<span class="score-warning"></span></td>`;''',
                        '''                                    : `<span class="gk2-entry-score-field">${inputHtml}</span>`;
                                trHtml += `<td class="score-cell${countMode ? ' gk2-count-entry-cell' : ''}">${inputControlHtml}<span class="score-warning"></span></td>`;''', 1)
    core = core.replace("                            const bgColor = !hasEnteredScore ? 'transparent' : (achieved ? 'var(--success-soft)' : (needsEffort ? 'var(--danger-soft)' : 'var(--warning-soft)'));\n", '', 1)
    core = core.replace('data-profile-student-id="${Utils.escapeHTML(stu.id)}" style="background:${bgColor};"', 'data-profile-student-id="${Utils.escapeHTML(stu.id)}" class="gk2-target-row"', 1)
    core = core.replace('style="cursor:pointer; text-decoration:underline; color:var(--primary);">${Utils.escapeHTML(stu.name)}</a>', 'class="student-link">${Utils.escapeHTML(stu.name)}</a>', 1)
    core = core.replace('class="gk2-target-status-label">${statusText}', '''class="gk2-target-status-label" data-status="${!hasEnteredScore ? 'empty' : achieved ? 'achieved' : needsEffort ? 'effort' : 'near'}">${statusText}''', 1)
    core = core.replace('title="偏科警告"', 'title="题型表现差异：最高与最低题型得分率相差超过 40 个百分点，且有题型低于 50%"', 1)
    core = core.replace('title="差一点就及格"', 'title="接近及格线：距及格线不足或等于 5 分"', 1)
    core = core.replace('title="差一点就优秀"', 'title="接近优秀线：距优秀线不足或等于 5 分"', 1)
    core = core.replace('<td class="sticky-col-left" style="width:58px; min-width:58px; max-width:58px;">${d.examAbsent ? rankValueHtml',
                        '''<td class="sticky-col-left" ${rowClass ? `title="${rowClass === 'row-excellent' ? '接近优秀线' : '接近及格线'}：差距在 5 分以内"` : ''} style="width:58px; min-width:58px; max-width:58px;">${d.examAbsent ? rankValueHtml''', 1)
    return core


def update_modules_features(features):
    features = features.replace('group.append(create,remove,search);', 'group.append(create,search,remove);', 1)
    features = features.replace("   el.insertAdjacentHTML('afterbegin',", '''   const heatLegend = id === 'heatmap' ? '<div class="gk2-dist-legend gk2-heat-legend" role="group" aria-label="题型得分率色阶"></div>' : '';
   el.insertAdjacentHTML('afterbegin',''', 1)
    features = features.replace("${id==='dist'?distLegendMarkup:''}<button", "${id==='dist'?distLegendMarkup:heatLegend}<button", 1)
    features = features.replace("  create('heatmap',{legend:", '''  const heatPieces = G.ratePieces(heat.some(point => point[2] > 100));
  const heatLegend = $('#ov-card-heatmap .gk2-heat-legend');
  heatLegend.innerHTML = heatPieces.map(piece => `<span class="gk2-dist-legend-item"><i aria-hidden="true" style="--dist-legend-color:${piece.color}"></i><span>${esc(piece.label)}</span></span>`).join('');
  create('heatmap',{legend:''', 1)
    features = features.replace("visualMap:{type:'piecewise',orient:'horizontal',left:'center',bottom:0,itemGap:8,itemWidth:10,itemHeight:8,textStyle:{fontSize:11},selectedMode:false,pieces:G.ratePieces(heat.some(p=>p[2]>100)),dimension:2}",
                                "visualMap:{type:'piecewise',show:false,pieces:heatPieces,dimension:2}", 1)
    features = features.replace('bottom:55,left:8,right:8,containLabel:true', 'bottom:22,left:8,right:8,containLabel:true', 2)
    features = features.replace('bottom:44,left:2,right:2,containLabel:true', 'bottom:22,left:2,right:2,containLabel:true', 1)
    return features
