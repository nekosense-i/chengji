

        const AppCore = (function() {
            const phaseOrderDict = { "高一上": 1, "高一下": 2, "高二上": 3, "高二下": 4, "高三上": 5, "高三下": 6, "未入学": 0, "已毕业": 7, "未知学段": 8 };
            
            const colorPalette = [
                { bg: '#eaf3ff', border: '#0071e3', text: '#005bb5' },
                { bg: '#f5edfa', border: '#8e44ad', text: '#71398b' },
                { bg: 'var(--success-soft)', border: 'var(--success)', text: 'var(--score-excellent)' },
                { bg: 'var(--warning-soft)', border: 'var(--warning)', text: 'var(--score-pass)' },
                { bg: '#e6f6f8', border: '#007889', text: '#005e71' },
                { bg: 'var(--danger-soft)', border: 'var(--danger)', text: 'var(--score-fail)' }
            ];
            const barColors = ['#0071e3','#1f7a35','#5e5ce6','#ffcc00','#d70015','#8e44ad','#007889','#6e6e73','#0f766e','#ae500e'];

            const Utils = {
                cssVar: (name, fallback = '') => {
                    try {
                        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
                    } catch(e) {
                        return fallback;
                    }
                },
                id: () => {
                    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                        return crypto.randomUUID();
                    }
                    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
                },
                msg: (txt, type='success', undoable = false) => {
                    const c = document.getElementById('toast-container');
                    const e = document.createElement('div'); e.className = `toast ${type}`;
                    e.setAttribute('role', 'alert');
                    const content = document.createElement('div'); content.className = 'toast-content';
                    content.innerHTML = (type === 'success' ? `${window.gk2IconMarkup('spark')} ${Utils.escapeHTML(txt)}` : `${window.gk2IconMarkup('alert')} ${Utils.escapeHTML(txt)}`);
                    e.appendChild(content);
                    if (undoable) {
                        const btn = document.createElement('button'); btn.className = 'toast-undo'; btn.innerText = '撤销';
                        btn.onclick = () => { try { window.app.store.undo(); } catch(e){}; e.remove(); };
                        e.appendChild(btn);
                    }
                    c.appendChild(e);
                    const closeToast = () => {
                        try {
                            e.classList.add('toast-leaving');
                            setTimeout(() => { try { e.remove(); } catch(e){} }, 190);
                        } catch(e) {}
                    };
                    setTimeout(closeToast, undoable ? 6000 : 4500);
                },
                debounce: (func, wait) => {
                    let timeout;
                    return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
                },
                throttle: (func, limit) => {
                    let inThrottle;
                    return function(...args) {
                        if (!inThrottle) {
                            func.apply(this, args);
                            inThrottle = true;
                            setTimeout(() => inThrottle = false, limit);
                        }
                    };
                },
                calculatePhase: (gradeStr, examDateStr) => {
                    if (!gradeStr || !examDateStr || gradeStr.includes('未设')) return "未知学段";
                    const match = gradeStr.match(/(\d{4})/); 
                    if (!match) return "未知学段";
                    const enrollYear = parseInt(match[1]);
                    const date = new Date(examDateStr);
                    if (isNaN(date.getTime())) return "日期错误";

                    const examYear = date.getFullYear();
                    const examMonth = date.getMonth() + 1; 
                    let acadYear = examMonth >= 9 ? examYear : examYear - 1;
                    let diff = acadYear - enrollYear;

                    let phaseName = "";
                    if (diff === 0) phaseName = "高一";
                    else if (diff === 1) phaseName = "高二";
                    else if (diff === 2) phaseName = "高三";
                    else if (diff < 0) return "未入学";
                    else return "已毕业";

                    let termName = (examMonth >= 2 && examMonth <= 8) ? "下" : "上";
                    return `${phaseName}${termName}`;
                },
                sortPhaseStrict: (a, b) => {
                    return (phaseOrderDict[a] || 99) - (phaseOrderDict[b] || 99);
                },
                escapeHTML: (str) => {
                    if (str === undefined || str === null) return '';
                    return String(str)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                },
                getClassAtDate: (student, dateStr) => {
                    const history = student && student.classHistory;
                    if (!history || history.length === 0) {
                        return { campus: student ? student.campus : '', teachingClass: student ? student.teachingClass : '' };
                    }
                    const normalizedDate = dateStr ? String(dateStr).slice(0, 10) : '';
                    if (!normalizedDate) {
                        const last = history[history.length - 1];
                        return { campus: last.campus, teachingClass: last.teachingClass };
                    }
                    for (let i = history.length - 1; i >= 0; i--) {
                        const entry = history[i];
                        if (entry.from <= normalizedDate && (entry.to === null || entry.to >= normalizedDate)) {
                            return { campus: entry.campus, teachingClass: entry.teachingClass };
                        }
                    }
                    return { campus: history[0].campus, teachingClass: history[0].teachingClass };
                },
                getClassForExam: (student, exam) => {
                    return Utils.getClassAtDate(student, exam && exam.date ? exam.date : null);
                },
                hasTransferred: (student) => {
                    return !!(student && student.classHistory && student.classHistory.length > 1);
                },
                getTransferSummary: (student) => {
                    if (!Utils.hasTransferred(student)) return '';
                    return student.classHistory.map(h => h.teachingClass).join(' → ');
                },
                getBoxplotData: (arr) => {
                    if (!arr || arr.length === 0) return [0,0,0,0,0];
                    const sorted = arr.slice().sort((a, b) => a - b);
                    const q = (p) => {
                        const pos = (sorted.length - 1) * p;
                        const base = Math.floor(pos);
                        const rest = pos - base;
                        if (sorted[base + 1] !== undefined) {
                            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
                        } else {
                            return sorted[base];
                        }
                    };
                    return [parseFloat(sorted[0].toFixed(1)), parseFloat(q(0.25).toFixed(1)), parseFloat(q(0.5).toFixed(1)), parseFloat(q(0.75).toFixed(1)), parseFloat(sorted[sorted.length - 1].toFixed(1))];
                },
                getEmptyStateIllustration: (title = '', iconName = '') => {
                    const text = `${title} ${iconName}`;
                    const type = text.includes('学生') ? 'student'
                        : text.includes('考试') ? 'exam'
                        : text.includes('搜索') || text.includes('未找到') ? 'search'
                        : 'analysis';
                    const common = 'viewBox="0 0 180 118" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
                    const bg = '<rect x="28" y="18" width="124" height="82" rx="20" fill="#f7f7f9" stroke="#D7E3F8"/><path d="M44 86H136" stroke="#C7D2FE" stroke-width="3" stroke-linecap="round"/>';
                    if (type === 'student') {
                        return `<svg ${common}>${bg}<circle cx="90" cy="48" r="15" fill="#e3f0ff" stroke="#66a8ee" stroke-width="2"/><path d="M62 82c5-17 51-17 56 0" fill="#ECFDF5" stroke="#34C759" stroke-width="2" stroke-linecap="round"/><circle cx="53" cy="36" r="5" fill="#FFCC00"/><circle cx="132" cy="42" r="4" fill="#FFB3C1"/></svg>`;
                    }
                    if (type === 'exam') {
                        return `<svg ${common}>${bg}<rect x="62" y="36" width="56" height="44" rx="8" fill="#FFFFFF" stroke="#66a8ee" stroke-width="2"/><path d="M74 50h32M74 62h28M74 74h18" stroke="#86868b" stroke-width="2" stroke-linecap="round"/><path d="M113 31l9 9" stroke="#34C759" stroke-width="3" stroke-linecap="round"/><path d="M122 31l-9 9" stroke="#34C759" stroke-width="3" stroke-linecap="round"/></svg>`;
                    }
                    if (type === 'search') {
                        return `<svg ${common}>${bg}<circle cx="82" cy="55" r="21" fill="#FFFFFF" stroke="#66a8ee" stroke-width="3"/><path d="M98 71l20 20" stroke="#66a8ee" stroke-width="5" stroke-linecap="round"/><path d="M75 55h14" stroke="#c7c7cc" stroke-width="2" stroke-linecap="round"/><circle cx="130" cy="34" r="5" fill="#FFCC00"/></svg>`;
                    }
                    return `<svg ${common}>${bg}<path d="M57 77V58M78 77V45M99 77V52M120 77V34" stroke="#66a8ee" stroke-width="9" stroke-linecap="round"/><path d="M53 42l21 10 22-18 28-5" stroke="#34C759" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="125" cy="29" r="5" fill="#34C759"/></svg>`;
                },
                getEmptyStateHTML: (title, desc, iconName = 'inbox', actionHtml = '', actionCallback = null, actionText = '立即操作') => {
                    if (typeof actionHtml === 'function' && actionCallback === null) {
                        actionCallback = actionHtml;
                        actionHtml = '';
                    }
                    const safeTitle = Utils.escapeHTML(title);
                    const safeDesc = Utils.escapeHTML(desc);
                    const illustrationSvg = Utils.getEmptyStateIllustration(title, '');
                    const ctaHtml = (() => {
                        if (actionHtml) return `<div class="empty-state-actions mt-md">${actionHtml}</div>`;
                        if (typeof actionCallback !== 'function') return '';
                        const callbackId = `empty-state-cta-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                        window.__emptyStateCtaHandlers = window.__emptyStateCtaHandlers || {};
                        window.__emptyStateCtaHandlers[callbackId] = actionCallback;
                        return `<div class="empty-state-actions mt-md"><button class="primary" type="button" onclick="window.__emptyStateCtaHandlers['${callbackId}'] && window.__emptyStateCtaHandlers['${callbackId}']()">${Utils.escapeHTML(actionText || '立即操作')}</button></div>`;
                    })();
                    return `
                    <div class="empty-state empty-state--transparent">
                        <div class="empty-state-illustration">${illustrationSvg}</div>
                        <div class="empty-state-title">${safeTitle}</div>
                        <div class="empty-state-desc">${safeDesc}</div>
                        ${ctaHtml}
                    </div>`;
                },
                setScoreHeatColor: (inputEl, value, maxScore) => {
                    try {
                        if (!inputEl || value === '' || value === null || isNaN(parseFloat(value)) || maxScore <= 0) {
                            inputEl.style.backgroundColor = '';
                            inputEl.style.color = 'var(--text-main)';
                            inputEl.style.borderBottomColor = 'transparent';
                            inputEl.style.borderBottomWidth = '';
                            inputEl.style.borderBottomStyle = '';
                            return;
                        }
                        const ratio = parseFloat(value) / maxScore;
                        if (ratio >= 0.85) {
                            inputEl.style.backgroundColor = 'var(--success-soft)';
                            inputEl.style.color = 'var(--score-excellent)';
                            inputEl.style.borderBottomColor = 'transparent';
                            inputEl.style.borderBottomWidth = '';
                            inputEl.style.borderBottomStyle = '';
                        } else if (ratio >= 0.6) {
                            inputEl.style.backgroundColor = 'var(--warning-soft)';
                            inputEl.style.color = 'var(--score-pass)';
                            inputEl.style.borderBottomColor = 'transparent';
                            inputEl.style.borderBottomWidth = '';
                            inputEl.style.borderBottomStyle = '';
                        } else {
                            inputEl.style.backgroundColor = 'var(--danger-soft)';
                            inputEl.style.color = 'var(--score-fail)';
                            inputEl.style.borderBottomColor = 'transparent';
                            inputEl.style.borderBottomWidth = '';
                            inputEl.style.borderBottomStyle = '';
                        }
                    } catch (e) { try { console.warn('setScoreHeatColor', e); } catch(err) {} }
                },
                linearRegression: (xArr, yArr) => {
                    // 最小二乘法计算线性回归 y = a*x + b
                    // 只使用非 null 的数据点进行计算
                    const validPoints = [];
                    for (let i = 0; i < xArr.length; i++) {
                        if (yArr[i] !== null && yArr[i] !== undefined) {
                            validPoints.push({ x: xArr[i], y: yArr[i] });
                        }
                    }

                    if (validPoints.length < 2) return null;

                    const n = validPoints.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
                    validPoints.forEach(p => {
                        sumX += p.x;
                        sumY += p.y;
                        sumXY += p.x * p.y;
                        sumX2 += p.x * p.x;
                    });

                    const denom = (n * sumX2 - sumX * sumX);
                    if (denom === 0) return null;

                    const a = (n * sumXY - sumX * sumY) / denom;
                    const b = (sumY - a * sumX) / n;

                    return {
                        a,
                        b,
                        predict: (x) => a * x + b
                    };
                }
            };

            // Membership is based on exam identity, not date: backdated new exams
            // must not pull a student who has left, or rewrite a new student's past.
            Utils.isStudentInExam = (student, exam) => window.gk2Statistics.isStudentInExam(student, exam);

            // Read-only statistics and local teacher-range checks, shared by all adapters.
            Utils.canReadStudent = (student, exam = null) => {
                const auth = window.__gakutenAuth?.getAuth();
                if (!student || !auth) return false;
                if (exam && (student.grade !== exam.grade || !Utils.isStudentInExam(student, exam))) return false;
                const position=exam?Utils.getClassForExam(student,exam):student;
                const campuses=exam?.campuses?.length?exam.campuses:exam?.campus?[exam.campus]:[];
                if(campuses.length&&!campuses.includes(position.campus))return false;
                if (auth.mode === 'admin') return true;
                if (auth.mode !== 'teacher' || student.campus !== auth.campus || student.grade !== auth.grade || student.teachingClass !== auth.classId) return false;
                const place = exam ? Utils.getClassForExam(student, exam) : student;
                return place.campus === auth.campus && place.teachingClass === auth.classId;
            };
            Utils.isActualScore = (record, exam = null) => {
                const data = window.app?.store?.state?.data;
                exam ||= data?.exams.find(e => e.id === record?.examId);
                if (!record || !exam || !window.gk2Statistics.inspect(record, exam).included) return false;
                const student = data?.students.find(s => s.id === (record.studentId || record.id));
                return Utils.canReadStudent(student, exam);
            };
            Utils.contextStamp = () => JSON.stringify([window.__gakutenAuth?.getAuth(),window.app?.store?.state.globalFocus,window.app?.store?.state.currentExamId]);
            Utils.assertContext = stamp => { if(stamp!==Utils.contextStamp()) throw Error('身份、考试或教学范围已变化，请重新操作。'); };
            const StatsEngine = {
                getClassmateScores(student, exam, allStudents, allScores) {
                    const stuClass = Utils.getClassForExam(student, exam);
                    const classmateIds = allStudents
                        .filter(s => {
                            const sClass = Utils.getClassForExam(s, exam);
                            return sClass.campus === stuClass.campus && sClass.teachingClass === stuClass.teachingClass;
                        })
                        .map(s => s.id);
                    return allScores.filter(s => 
                        s.examId === exam.id && 
                        classmateIds.includes(s.studentId) && 
                        Utils.isActualScore(s)
                    );
                },
                classAverage(student, exam, allStudents, allScores) {
                    const scores = this.getClassmateScores(student, exam, allStudents, allScores);
                    if (scores.length === 0) return null;
                    return parseFloat((scores.reduce((a, b) => a + b.total, 0) / scores.length).toFixed(1));
                },
                classTypeAverage(student, exam, typeName, allStudents, allScores) {
                    const place=Utils.getClassForExam(student,exam), type=exam.types.find(t=>t.name===typeName);
                    if(!type)return null;
                    const ids=new Set(allStudents.filter(s=>{const at=Utils.getClassForExam(s,exam);return Utils.canReadStudent(s,exam)&&at.campus===place.campus&&at.teachingClass===place.teachingClass;}).map(s=>s.id));
                    const values=allScores.filter(r=>r.examId===exam.id&&ids.has(r.studentId)&&!r.examAbsent&&!r.isEstimated).map(r=>window.gk2Statistics.typeValue(r,exam,type)).filter(t=>t.valid).map(t=>t.value);
                    return values.length?Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)):null;
                },
                inverseNormalCDF(p) {
                    if (p <= 0) return -3.89;
                    if (p >= 1) return 3.89;
                    
                    p = Math.max(0.00001, Math.min(0.99999, p));
                    
                    const isUpper = p > 0.5;
                    const q = isUpper ? 1.0 - p : p;
                    
                    const t = Math.sqrt(-2.0 * Math.log(q));
                    const c0 = 2.515517;
                    const c1 = 0.802853;
                    const c2 = 0.010328;
                    const d1 = 1.432788;
                    const d2 = 0.189269;
                    const d3 = 0.001308;
                    
                    const z = t - ((c0 + c1 * t + c2 * t * t) / (1.0 + d1 * t + d2 * t * t + d3 * t * t * t));
                    
                    return isUpper ? z : -z;
                },
                gradeStats(exam, allStudents, allScores, campusFilter = null) {
                    const gradeStudentIds = allStudents
                        .filter(s => s.grade === exam.grade && (!campusFilter || Utils.getClassForExam(s, exam).campus === campusFilter))
                        .map(s => s.id);
                    const gradeScores = allScores
                        .filter(s => s.examId === exam.id && gradeStudentIds.includes(s.studentId) && Utils.isActualScore(s))
                        .map(s => s.total)
                        .sort((a, b) => a - b); // 升序排列以计算百分位数
                    if (gradeScores.length === 0) return { mean: 0, stdDev: 1, count: 0, scores: [] };
                    const mean = gradeScores.reduce((a, b) => a + b, 0) / gradeScores.length;
                    const variance = gradeScores.reduce((a, v) => a + (v - mean) ** 2, 0) / gradeScores.length;
                    return { mean, stdDev: Math.sqrt(variance) || 1, count: gradeScores.length, scores: gradeScores };
                },
                convertScore(rawScore, exam, scoreType, gradeStatsObj) {
                    if (scoreType === 'pct') {
                        return exam.maxTotal ? parseFloat(((rawScore / exam.maxTotal) * 100).toFixed(1)) : 0;
                    }
                    if (scoreType === 'std') {
                        // 如果缺失年级成绩常模数组，自动安全降级为原有线性标准分计算
                        if (!gradeStatsObj || !gradeStatsObj.scores || gradeStatsObj.scores.length === 0) {
                            const z = (gradeStatsObj && gradeStatsObj.stdDev) ? (rawScore - gradeStatsObj.mean) / gradeStatsObj.stdDev : 0;
                            return parseFloat((z * 10 + 50).toFixed(1));
                        }
                        
                        // 计算百分位等级 PR = (L + 0.5 * E) / N
                        const scores = gradeStatsObj.scores;
                        const N = scores.length;
                        let L = 0; // 严格小于当前分数的人数
                        let E = 0; // 等于当前分数的人数
                        for (let i = 0; i < N; i++) {
                            if (scores[i] < rawScore) {
                                L++;
                            } else if (scores[i] === rawScore) {
                                E++;
                            } else {
                                break;
                            }
                        }
                        
                        // 兜底防御，若没有找到该成绩记录，则采用线性标准分降级
                        if (E === 0) {
                            const z = gradeStatsObj.stdDev ? (rawScore - gradeStatsObj.mean) / gradeStatsObj.stdDev : 0;
                            return parseFloat((z * 10 + 50).toFixed(1));
                        }
                        
                        const pr = (L + 0.5 * E) / N;
                        const zNorm = this.inverseNormalCDF(pr);
                        return parseFloat((zNorm * 10 + 50).toFixed(1));
                    }
                    if (scoreType === 'ratio') {
                        return gradeStatsObj.mean === 0 ? 0 : parseFloat(((rawScore / gradeStatsObj.mean) * 100).toFixed(1));
                    }
                    return parseFloat(rawScore.toFixed(1));
                },
                gradeRank(studentId, exam, allStudents, allScores) {
                    const gradeStudentIds = allStudents.filter(s => s.grade === exam.grade).map(s => s.id);
                    const sorted = allScores
                        .filter(s => s.examId === exam.id && gradeStudentIds.includes(s.studentId) && Utils.isActualScore(s))
                        .sort((a, b) => b.total - a.total);
                    const idx = sorted.findIndex(s => s.studentId === studentId);
                    return { rank: idx >= 0 ? sorted.filter(r => r.total > sorted[idx].total).length + 1 : null, total: sorted.length };
                },
                groupByClass(exam, allStudents, allScores) {
                    const groups = {};
                    allStudents.forEach(s => {
                        const classInfo = Utils.getClassForExam(s, exam);
                        const key = `${classInfo.campus} - ${classInfo.teachingClass}`;
                        if (!groups[key]) groups[key] = { campus: classInfo.campus, teachingClass: classInfo.teachingClass, students: [], scores: [] };
                        groups[key].students.push(s);
                    });
                    Object.values(groups).forEach(g => {
                        const ids = new Set(g.students.map(s => s.id));
                        g.scores = allScores.filter(s => s.examId === exam.id && ids.has(s.studentId) && Utils.isActualScore(s));
                    });
                    return groups;
                }
            };

	            class Store {
	                constructor() {
	                    this.KEY = 'gakuten_data_v1';
	                    this.DEVICE_KEY = 'gakuten_device_id';
	                    this.state = { data: { students: [], exams: [], scores: [], examTemplates: [] }, deleted: { students: {}, exams: {}, scores: {} }, syncMeta: {}, globalFocus: { campuses: [], grades: [], phases: [], tClasses: [], tags: [] }, currentAnalysisType: 'overview', trendPhases: [], currentTrendPredictSeries: [] };
	                    this.scoreIndex = new Map();
	                    this.hasUnsavedChanges = false;
	                    this.saveTimeout = null;
	                    this.history = [];
	                    this.maxHistorySize = 10;
	                    this.deviceId = this.getDeviceId();
	                    this.isDataChangedRef = { current: false };
	                    this.lastLocalDataSnapshot = null;
	                    this.pendingDelta = null;
	                    this.load();
	                    this.ensureSyncShape();
	                    this.rebuildScoreIndex();
	                    this.resetDeltaTracking();
	                    window.addEventListener('beforeunload', () => {
	                        if (this.saveTimeout) {
	                            clearTimeout(this.saveTimeout);
	                            this.saveTimeout = null;
	                            this.save();
	                        }
	                    });
	                }
	                getDeviceId() {
	                    try {
	                        let id = localStorage.getItem(this.DEVICE_KEY);
	                        if (!id) {
	                            id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
	                            localStorage.setItem(this.DEVICE_KEY, id);
	                        }
	                        return id;
	                    } catch (e) {
	                        return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
	                    }
	                }
	                ensureSyncShape() {
	                    if (!this.state) this.state = {};
	                    if (!this.state.data) this.state.data = {};
	                    if (!Array.isArray(this.state.data.students)) this.state.data.students = [];
	                    if (!Array.isArray(this.state.data.exams)) this.state.data.exams = [];
	                    if (!Array.isArray(this.state.data.scores)) this.state.data.scores = [];
	                    if (!Array.isArray(this.state.data.examTemplates)) this.state.data.examTemplates = [];
	                    const fromDataDeleted = this.state.data.__deleted || {};
	                    if (!this.state.deleted) this.state.deleted = fromDataDeleted;
	                    this.state.deleted.students = { ...(fromDataDeleted.students || {}), ...(this.state.deleted.students || {}) };
	                    this.state.deleted.exams = { ...(fromDataDeleted.exams || {}), ...(this.state.deleted.exams || {}) };
	                    this.state.deleted.scores = { ...(fromDataDeleted.scores || {}), ...(this.state.deleted.scores || {}) };
	                    delete this.state.data.__deleted;
	                    if (!this.state.syncMeta) this.state.syncMeta = {};
	                    this.state.syncMeta.deviceId = this.deviceId;
	                    if (!this.state.syncMeta.lastPulledAt) this.state.syncMeta.lastPulledAt = 0;
	                    if (!this.state.syncMeta.lastPushedAt) this.state.syncMeta.lastPushedAt = 0;
	                    if (!this.state.syncMeta.lastError) this.state.syncMeta.lastError = '';
	                }
	                getScoreKey(score) {
	                    return score ? `${score.studentId}_${score.examId}` : '';
	                }
	                cloneSyncState() {
	                    this.ensureSyncShape();
	                    return JSON.parse(JSON.stringify({
	                        data: this.state.data || { students: [], exams: [], scores: [], examTemplates: [] },
	                        deleted: this.state.deleted || { students: {}, exams: {}, scores: {} }
	                    }));
	                }
	                resetDeltaTracking() {
	                    this.lastLocalDataSnapshot = this.cloneSyncState();
	                    this.pendingDelta = null;
	                    this.isDataChangedRef.current = false;
	                }
	                _recordKey(kind, item) {
	                    if (!item) return '';
	                    if (kind === 'scores') return `${item.studentId}_${item.examId}`;
	                    return item.id || '';
	                }
	                _makeDeltaBucket() {
	                    return {
	                        students: {},
	                        exams: {},
	                        scores: {},
	                        examTemplates: null,
	                        deleted: { students: {}, exams: {}, scores: {} },
	                        last_synced_at: this.state.syncMeta ? (this.state.syncMeta.lastCloudTs || this.state.syncMeta.lastPulledAt || 0) : 0
	                    };
	                }
	                buildDeltaSinceSnapshot() {
	                    const before = this.lastLocalDataSnapshot || { data: { students: [], exams: [], scores: [], examTemplates: [] }, deleted: { students: {}, exams: {}, scores: {} } };
	                    const after = this.cloneSyncState();
	                    const delta = this._makeDeltaBucket();
	                    let changed = false;
	                    const diffArr = (kind, keyFn) => {
	                        const prevMap = new Map((before.data[kind] || []).map(item => [keyFn(item), JSON.stringify(item)]));
	                        const nextKeys = new Set();
	                        (after.data[kind] || []).forEach(item => {
	                            const key = keyFn(item);
	                            if (!key) return;
	                            nextKeys.add(key);
	                            const nextStr = JSON.stringify(item);
	                            if (prevMap.get(key) !== nextStr) {
	                                delta[kind][key] = item;
	                                changed = true;
	                            }
	                        });
	                        prevMap.forEach((_, key) => {
	                            if (!key || nextKeys.has(key)) return;
	                            const deletedTs = (after.deleted[kind] || {})[key] || Date.now();
	                            delta.deleted[kind][key] = deletedTs;
	                            changed = true;
	                        });
	                    };
	                    diffArr('students', item => item && item.id);
	                    diffArr('exams', item => item && item.id);
	                    diffArr('scores', item => item && `${item.studentId}_${item.examId}`);
	                    const beforeTemplates = JSON.stringify(before.data.examTemplates || []);
	                    const afterTemplates = JSON.stringify(after.data.examTemplates || []);
	                    if (beforeTemplates !== afterTemplates) {
	                        delta.examTemplates = after.data.examTemplates || [];
	                        changed = true;
	                    }
	                    ['students', 'exams', 'scores'].forEach(kind => {
	                        const prevDeleted = before.deleted[kind] || {};
	                        const nextDeleted = after.deleted[kind] || {};
	                        Object.entries(nextDeleted).forEach(([key, ts]) => {
	                            if ((prevDeleted[key] || 0) !== ts) {
	                                delta.deleted[kind][key] = ts;
	                                changed = true;
	                            }
	                        });
	                    });
	                    return changed ? delta : null;
	                }
	                mergePendingDelta(delta) {
	                    if (!delta) return;
	                    if (!this.pendingDelta) this.pendingDelta = this._makeDeltaBucket();
	                    ['students', 'exams', 'scores'].forEach(kind => {
	                        Object.assign(this.pendingDelta[kind], delta[kind] || {});
	                    });
	                    if (delta.examTemplates) this.pendingDelta.examTemplates = delta.examTemplates;
	                    ['students', 'exams', 'scores'].forEach(kind => {
	                        Object.assign(this.pendingDelta.deleted[kind], (delta.deleted && delta.deleted[kind]) || {});
	                    });
	                    const currentBase = this.pendingDelta.last_synced_at || 0;
	                    const nextBase = delta.last_synced_at || 0;
	                    this.pendingDelta.last_synced_at = currentBase && nextBase ? Math.min(currentBase, nextBase) : (currentBase || nextBase);
	                }
	                hasPendingDelta(delta = this.pendingDelta) {
	                    if (!delta) return false;
	                    return ['students', 'exams', 'scores'].some(kind => Object.keys(delta[kind] || {}).length > 0)
	                        || ['students', 'exams', 'scores'].some(kind => Object.keys((delta.deleted && delta.deleted[kind]) || {}).length > 0)
	                        || Array.isArray(delta.examTemplates);
	                }
	                stagePendingDeltaFromCurrent() {
	                    this.ensureSyncShape();
	                    this.rebuildScoreIndex();
	                    const delta = this.buildDeltaSinceSnapshot();
	                    if (!delta) return false;
	                    this.isDataChangedRef.current = true;
	                    this.mergePendingDelta(delta);
	                    this.state.ts = Date.now();
	                    this.lastLocalDataSnapshot = this.cloneSyncState();
	                    return true;
	                }
	                consumePendingDelta() {
	                    const delta = this.pendingDelta;
	                    this.pendingDelta = null;
	                    this.isDataChangedRef.current = false;
	                    return delta;
	                }
	                markDeleted(kind, key, ts = Date.now()) {
	                    this.ensureSyncShape();
	                    if (!kind || !key || !this.state.deleted[kind]) return;
	                    this.state.deleted[kind][key] = Math.max(this.state.deleted[kind][key] || 0, ts);
	                }
	                markScoreDeleted(score, ts = Date.now()) {
	                    const key = this.getScoreKey(score);
	                    if (key) this.markDeleted('scores', key, ts);
	                }
	                writeLocalState() {
                    if (localStorage.getItem(window.gk2Migration.key)) { window.gk2Migration.persistStore(this); return; }

	                    this.ensureSyncShape();
	                    const serialized = JSON.stringify(this.state);
	                    try {
	                        if (typeof LZString !== 'undefined' && LZString && LZString.compressToUTF16) {
	                            const compressed = LZString.compressToUTF16(serialized);
	                            localStorage.setItem(this.KEY, compressed && compressed.length < serialized.length ? compressed : serialized);
	                        } else {
	                            localStorage.setItem(this.KEY, serialized);
	                        }
	                    } catch (cz) {
	                        localStorage.setItem(this.KEY, serialized);
	                    }
	                }
	                load() {
                    if (localStorage.getItem(window.gk2Migration.key)) { window.gk2Migration.loadStore(this); return; }

	                    const raw = localStorage.getItem(this.KEY);
	                    if (!raw) { this.ensureSyncShape(); return; }
	                    try {
                        let parsed = null;
                        // 优先尝试解压（兼容已压缩的数据）
                        if (typeof LZString !== 'undefined' && LZString && LZString.decompressFromUTF16) {
                            try {
                                const decompressed = LZString.decompressFromUTF16(raw);
                                if (decompressed !== null && decompressed !== undefined) parsed = JSON.parse(decompressed);
                            } catch (e) {
                                parsed = null;
                            }
                        }

                        // 回退：尝试直接解析原始 JSON（兼容未压缩的旧数据）
                        if (!parsed) {
                            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
                        }

                        if (!parsed) throw new Error('local data parse failed');

	                        this.state = parsed;
	                        this.ensureSyncShape();
	                        if (!this.state.globalFocus) this.state.globalFocus = { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
	                        this.state.currentAnalysisType = 'overview';
	                        this.state.currentView = 'analysis';
	                        if (!this.state.trendPhases) this.state.trendPhases = [];

                        let needsSave = false;
                        const oldStuCount = this.state.data.students.length;
                        this.state.data.students = this.state.data.students.filter(s => {
                            const c = (s.campus || '').trim();
                            const g = (s.grade || '').trim();
                            if (!c || c === '未设校区' || c === '默认校区' || c === '未分配校区') return false;
                            if (!g || g === '未设年级' || g === '未分配年级') return false;
                            if (s.class !== undefined) { s.teachingClass = s.class; s.adminClass = '-'; delete s.class; needsSave = true; }
                            if (!s.teachingClass) s.teachingClass = '未分日语班';
                            if (!s.adminClass) s.adminClass = '-';
                            if (!Array.isArray(s.classHistory) || s.classHistory.length === 0) {
                                s.classHistory = [{ campus: s.campus, teachingClass: s.teachingClass, from: '2000-01-01', to: null }];
                                needsSave = true;
                            }
                            const lastEntry = s.classHistory[s.classHistory.length - 1];
                            if (lastEntry.campus !== s.campus || lastEntry.teachingClass !== s.teachingClass) {
                                lastEntry.campus = s.campus;
                                lastEntry.teachingClass = s.teachingClass;
                                lastEntry.to = null;
                                needsSave = true;
                            }
                            return true;
                        });
                        if (this.state.data.students.length !== oldStuCount) needsSave = true;

                        const examGroups = {};
                        const newExams = [];
                        let didMigrateExams = false;

                        this.state.data.exams.forEach(e => {
                            const g = (e.grade || '').trim();
                            if (!g || g === '未设年级') return;

                            if (!e.campuses) {
                                e.campuses = e.campus ? [e.campus] : [];
                                needsSave = true;
                            }

                            const key = g + '_' + e.name;
                            if (!examGroups[key]) {
                                examGroups[key] = e;
                                newExams.push(e);
                            } else {
                                didMigrateExams = true;
                                needsSave = true;
                                const baseExam = examGroups[key];

                                if (e.campus && !baseExam.campuses.includes(e.campus)) baseExam.campuses.push(e.campus);
                                if (e.campuses) {
                                    e.campuses.forEach(c => { if (!baseExam.campuses.includes(c)) baseExam.campuses.push(c); });
                                }

                                if (e.date < baseExam.date) baseExam.date = e.date;
                                if (e.maxTotal > baseExam.maxTotal) {
                                    baseExam.maxTotal = e.maxTotal;
                                    baseExam.types = e.types;
                                }

                                this.state.data.scores.forEach(s => { if (s.examId === e.id) s.examId = baseExam.id; });
                            }
                        });

                        if (didMigrateExams || this.state.data.exams.length !== newExams.length) {
                            this.state.data.exams = newExams;
                            needsSave = true;
                        }

                        (this.state.data.scores || []).forEach(score => {
                            if (score.absences && Object.keys(score.absences).length > 0) {
                                const exam = this.state.data.exams.find(e => e.id === score.examId);
                                if (exam && Array.isArray(exam.types)) {
                                    const allAbsent = exam.types.length > 0 && exam.types.every(t => score.absences[t.name]);
                                    if (allAbsent) {
                                        score.examAbsent = true;
                                        score.details = {};
                                        score.total = 0;
                                    }
                                }
                                delete score.absences;
                                needsSave = true;
                            }
                            if (score.examAbsent === undefined) {
                                score.examAbsent = false;
                                needsSave = true;
                            }
                            if (score.examAbsent) {
                                score.details = {};
                                score.total = 0;
                            }
                        });

                        if (needsSave) this.save();
                        this.rebuildScoreIndex();
	                    } catch (e) {
	                        Utils.msg('本地数据加载异常，已重置为初始状态', 'error');
	                        this.state.data = { students:[], exams:[], scores:[], examTemplates:[] };
	                        this.state.deleted = { students: {}, exams: {}, scores: {} };
	                        this.ensureSyncShape();
	                        this.rebuildScoreIndex();
	                        this.save();
	                    }
                }
                rebuildScoreIndex() {
                    this.scoreIndex.clear();
                    (this.state.data.scores || []).forEach(s => {
                        if (s && s.studentId && s.examId) {
                            this.scoreIndex.set(`${s.studentId}_${s.examId}`, s);
                        }
                    });
                }

                printStudentProfile() {
                    try {
                        if (this.spTrendChart) this.spTrendChart.resize();
                        if (this.spRadarChart) this.spRadarChart.resize();
                        if (this.spQuadChart) this.spQuadChart.resize();
                        if (this.chartInstance) this.chartInstance.resize();
                        if (this.ovCharts) this.ovCharts.forEach(c => c.resize());
                    } catch(e){}
                    // give browsers a moment to reflow charts before printing
                    setTimeout(() => { window.print(); }, 350);
                }
                async exportStudentProfile(studentName, btnElement) {
                    if (!await window.gk2Dependencies.ensure('capture')) return;
                    const dialog = (btnElement && btnElement.closest) ? (btnElement.closest('dialog') || document.querySelector('dialog[open]')) : document.querySelector('dialog[open]');
                    if (!dialog) return;

                    const noExportElements = dialog.querySelectorAll('.no-export');
                    noExportElements.forEach(el => { el.style.visibility = 'hidden'; });
                    const originalClassName = dialog.className;
                    const originalStyle = dialog.getAttribute('style') || '';
                    dialog.classList.add('profile-export-mode');

                    const originalText = btnElement ? btnElement.innerHTML : '';
                    if (btnElement) btnElement.disabled = true;

                    const doHtml2Canvas = (target, opts) => {
                        if (typeof window.html2canvas === 'function') return window.html2canvas(target, opts);
                        if (typeof html2canvas === 'function') return html2canvas(target, opts);
                        return Promise.reject(new Error('html2canvas 未加载'));
                    };

                    try {
                        if (window.app && window.app.ui && typeof window.app.ui._resizeStudentProfileChartsSoon === 'function') window.app.ui._resizeStudentProfileChartsSoon();
                    } catch(e) {}

                    setTimeout(() => doHtml2Canvas(dialog, {
                        scale: 2,
                        width: 1123,
                        height: 794,
                        windowWidth: 1123,
                        windowHeight: 794,
                        backgroundColor: '#ffffff',
                        useCORS: true,
                        ignoreElements: (element) => element.classList && element.classList.contains('no-export')
                    }).then(canvas => {
                        const link = document.createElement('a');
                        link.download = `${studentName}_个人成长档案.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    }).catch(err => {
                        console.error('导出档案失败:', err);
                        alert('报告导出失败，请重试');
                    }).finally(() => {
                        dialog.className = originalClassName;
                        if (originalStyle) dialog.setAttribute('style', originalStyle);
                        else dialog.removeAttribute('style');
                        noExportElements.forEach(el => { el.style.visibility = 'visible'; });
                        if (btnElement) {
                            btnElement.disabled = false;
                            btnElement.innerHTML = originalText;
                        }
                        try {
                            if (window.app && window.app.ui && typeof window.app.ui._resizeStudentProfileChartsSoon === 'function') window.app.ui._resizeStudentProfileChartsSoon();
                        } catch(e) {}
                    }), 120);
                }
                getScore(studentId, examId) {
                    return this.scoreIndex.get(`${studentId}_${examId}`) || null;
                }
	                save() {
	                    this.ensureSyncShape();
	                    this.rebuildScoreIndex();
	                    this.stagePendingDeltaFromCurrent();
	                    const shouldPush = this.hasPendingDelta();
	                    try {
	                        this.writeLocalState();
	                        this.hasUnsavedChanges = false;
	                        this.updateSaveIndicator();
	                        this.lastLocalDataSnapshot = this.cloneSyncState();
	                        if(shouldPush && window.app && window.app.sync) window.app.sync.push();
                    } catch(e) {
                        if (e.name === 'QuotaExceededError' || e.message.includes('QuotaExceeded')) {
                            this.showStorageQuotaWarning();
                        }
                    }
                }
                getLocalStorageUsage() {
                    let bytes = 0;
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i) || '';
                            const val = localStorage.getItem(key) || '';
                            bytes += (key.length + val.length) * 2;
                        }
                    } catch(e) {}
                    return bytes;
                }
                updateStorageUsageUI() {
                    const textEl = document.getElementById('storage-usage-text');
                    const barEl = document.getElementById('storage-usage-bar');
                    if (!textEl && !barEl) return;
                    const usedMb = this.getLocalStorageUsage() / 1024 / 1024;
                    const limitMb = 5;
                    const pct = Math.min(100, (usedMb / limitMb) * 100);
                    if (textEl) textEl.textContent = `已用 ${usedMb.toFixed(2)} MB / 上限约 ${limitMb} MB`;
                    if (barEl) barEl.style.width = `${pct.toFixed(1)}%`;
                }
                showStorageQuotaWarning() {
                    let bar = document.getElementById('storage-quota-warning');
                    if (!bar) {
                        bar = document.createElement('div');
                        bar.id = 'storage-quota-warning';
                        bar.className = 'storage-warning-bar';
                        bar.innerHTML = `
                            <div><strong>本机存储空间已满。</strong><br>请先导出备份，再清理旧数据或不再需要的考试。</div>
                            <div class="storage-warning-actions">
                                <button class="secondary btn--compact" onclick="window.app.store.exportBackup()">立即导出备份</button>
                                <button class="secondary btn--compact" onclick="window.app.ui.openDataManagerDialog()">清理旧数据</button>
                            </div>
                        `;
                        const main = document.querySelector('.main-content');
                        if (main) main.prepend(bar);
                    }
                    this.updateStorageUsageUI();
                }
	                pushSnapshot() {
	                    try {
	                        const snapshot = JSON.parse(JSON.stringify({ data: this.state.data, deleted: this.state.deleted || { students: {}, exams: {}, scores: {} } }));
	                        this.history.push(snapshot);
	                        if (this.history.length > this.maxHistorySize) this.history.shift();
	                        this.updateUndoButton();
                    } catch (e) { console.warn('pushSnapshot failed', e); }
                }
	                scheduleScoreLocalSave(delay = 260) {
	                    clearTimeout(this._scoreLocalSaveTimer);
	                    this._scoreLocalSaveTimer = setTimeout(() => {
	                        this._scoreLocalSaveTimer = 0;
	                        this.silentSave();
	                    }, delay);
	                }
	                flushScoreLocalSave() {
	                    if (!this._scoreLocalSaveTimer) return false;
	                    clearTimeout(this._scoreLocalSaveTimer);
	                    this._scoreLocalSaveTimer = 0;
	                    this.silentSave();
	                    return true;
	                }
	                // 静默保存：仅写入 localStorage，不触发 hasUnsavedChanges 或云同步
	                silentSave() {
	                    if (this._scoreLocalSaveTimer) {
	                        clearTimeout(this._scoreLocalSaveTimer);
	                        this._scoreLocalSaveTimer = 0;
	                    }
	                    try {
	                        this.writeLocalState();
	                    } catch (e) {
	                        // 静默保存不应打扰用户；仅在控制台记录
	                        try { console.warn('silentSave failed', e); } catch (err) {}
                    }
                }
                undo() {
                    if (this.history.length === 0) {
                        Utils.msg("没有可以撤销的操作", "error");
                        return;
	                    }
	                    const previousSnapshot = this.history.pop();
	                    if (previousSnapshot && previousSnapshot.data) {
	                        this.state.data = JSON.parse(JSON.stringify(previousSnapshot.data));
	                        this.state.deleted = JSON.parse(JSON.stringify(previousSnapshot.deleted || { students: {}, exams: {}, scores: {} }));
	                    } else {
	                        this.state.data = JSON.parse(JSON.stringify(previousSnapshot));
	                    }
	                    this.ensureSyncShape();
	                    this.rebuildScoreIndex();
	                    this.updateUndoButton();
	                    try {
	                        this.isDataChangedRef.current = true;
	                        this.save();
	                    } catch(e) {
	                        Utils.msg("撤销操作失败", "error");
	                    }
                    if(window.app && window.app.ui) window.app.ui.refresh();
                    Utils.msg("已撤销最后一次操作");
                }
                updateUndoButton() {
                    document.querySelectorAll('#undo-btn-students, #undo-btn-exams').forEach(btn => {
                        if (btn) btn.disabled = this.history.length === 0;
                    });
                }
                markAsUnsaved() {
                    this.isDataChangedRef.current = true;
                    if (!this.hasUnsavedChanges) {
                        this.hasUnsavedChanges = true;
                        this.updateSaveIndicator();
                    }
                    // Score typing can generate several keystrokes per field. Coalesce the
                    // full local serialization while the score cell remains focused;
                    // blur/pagehide flush it before the user leaves the entry context.
                    const scoreCellActive = window.app?.ui?.cur === 'exams' && document.activeElement?.matches?.('.score-input');
                    if (scoreCellActive) this.scheduleScoreLocalSave();
                    else this.silentSave();
                    
                    // 网络合并由生产适配器继续执行上传限频；本机保存独立进行。
                    if (this.saveTimeout) clearTimeout(this.saveTimeout);
                    this.saveTimeout = setTimeout(() => {
                        this.save();
                    }, 5000); // 停手 5 秒后完成本机保存/提交合并队列
                }
	                updateSaveIndicator() {
	                    const dot = document.getElementById('sync-dot');
	                    if (!dot) return;
	                    if (this.state && this.hasUnsavedChanges) {
	                        dot.className = 'sync-dot unsaved';
	                        dot.title = '有未保存的更改 (等待同步)';
	                    } else if (this.state && this.state.syncMeta && this.state.syncMeta.lastError) {
	                        dot.className = 'sync-dot error';
	                        dot.title = this.state.syncMeta.lastError;
	                    } else {
	                        dot.className = 'sync-dot synced';
	                        dot.title = '云端数据已同步';
                    }
                }
                reset() { 
                    if(!window.app || !window.app.ui) return;
                    const stuCount = this.state.data.students.length;
                    const examCount = this.state.data.exams.length;
                    const scoreCount = this.state.data.scores.length;
	                    const syncEnabled = !(localStorage.getItem('gakuten_cloud_sync_disabled') === '1');
	                    const typed = prompt(`即将清空本浏览器中的所有数据（${stuCount} 名学生、${examCount} 次考试、${scoreCount} 条成绩）。\n\n${syncEnabled ? '当前云同步已开启：清空后刷新可能会从云端重新拉回数据；如需演示清空，请先关闭云同步。\\n\\n' : ''}请输入“清空”二字继续。`);
                    if (typed !== '清空') {
                        Utils.msg('已取消清空操作', 'info');
                        return;
                    }
                    window.app.ui.showConfirmDialog(
	                        `即将清空本浏览器中的所有数据（${stuCount} 名学生、${examCount} 次考试、${scoreCount} 条成绩），此操作不可撤销！${syncEnabled ? '\n\n提示：当前云同步已开启，云端数据不会被清空，刷新后可能重新拉回。' : ''}`,
                        () => {
                            localStorage.removeItem(this.KEY);
                            localStorage.removeItem('gakuten_ai_key');
                            localStorage.removeItem('gakuten_ai_provider');
                            localStorage.removeItem('gakuten_ai_base_url');
                            localStorage.removeItem('gakuten_ai_model');
                            location.reload();
                        },
                        "清空所有数据"
                    );
                }
                exportBackup() {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state));
                    const downloadNode = document.createElement('a');
                    downloadNode.setAttribute("href", dataStr);
                    downloadNode.setAttribute("download", "Gakuten_Data_Backup_" + new Date().toISOString().slice(0,10) + ".json");
                    document.body.appendChild(downloadNode);
                    downloadNode.click();
                    downloadNode.remove();
                    Utils.msg("已下载数据备份至您的电脑");
                }
                prepareImportBackup() {
                    try { this.exportBackup(); } catch(e) {}
                    Utils.msg("已先为当前数据导出备份，请再选择要恢复的文件");
                    setTimeout(() => {
                        const input = document.getElementById('file-backup');
                        if (input) input.click();
                    }, 250);
                }
                importBackup(e) {
                    const f = e.target.files[0]; if(!f) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        try {
                            const parsed = JSON.parse(evt.target.result);
                            if(parsed && parsed.data && parsed.data.students) {
                                const stuCount = this.state.data.students.length;
                                const examCount = this.state.data.exams.length;
                                const scoreCount = this.state.data.scores.length;
                                const newStuCount = parsed.data.students.length;
                                const newExamCount = parsed.data.exams.length;
                                const newScoreCount = parsed.data.scores.length;
                                
                                if(!window.app || !window.app.ui) {
                                    Utils.msg("系统错误", "error");
                                    return;
                                }
                                
                                window.app.ui.showConfirmDialog(
	                                    `即将用备份文件覆盖当前所有数据\n\n当前数据：${stuCount} 名学生、${examCount} 次考试、${scoreCount} 条成绩\n备份数据：${newStuCount} 名学生、${newExamCount} 次考试、${newScoreCount} 条成绩\n\n${localStorage.getItem('gakuten_cloud_sync_disabled') === '1' ? '' : '提示：当前云同步已开启，恢复后的数据可能继续与其他设备同步；如只是本机测试，请先关闭云同步。\\n\\n'}此操作不可撤销，请确认。`,
                                    () => {
                                        this.state = parsed;
                                        this.rebuildScoreIndex();
                                        try {
                                            localStorage.setItem(this.KEY, JSON.stringify(this.state));
                                            window.app.ui.refresh();
                                            Utils.msg("数据恢复成功！");
                                        } catch(err) {
                                            Utils.msg("数据恢复失败", "error");
                                        }
                                    },
                                    "恢复数据"
                                );
                            } else throw new Error();
                        } catch(err) { Utils.msg("选择的文件不是有效的数据备份", "error"); }
                    };
                    reader.readAsText(f);
                }
            }

	            class Sync {
	                constructor(store) {
	                    this.store = store;
	                    this.api = 'http://127.0.0.1:8976/api/gakuten-v2';
	                    this.groupId = 'gakuten_v2_local_test';
	                    this.disabledKey = 'gakuten_cloud_sync_disabled';
	                    this.debouncedPush = Utils.debounce(this._push.bind(this), 3000);
	                    this.isPulling = false;
	                    this.isPushing = false;
	                    this.pendingPush = false;
	                    
		                    // 省流同步策略：读取最低 30 秒一次，无变化时逐步退避到 5 分钟。
		                    // 写入仍由本地数据增量触发，不因筛选、视图切换等界面状态自动上传。
		                    this.currentInterval = 30000;
		                    this.minInterval = 30000;
		                    this.maxInterval = 300000;
		                    this.idleThreshold = 120000;
		                    this.lastPullAttemptAt = 0;
		                    this.lastUserActiveTime = Date.now();
	                    
	                    this.bindUserActivity();
	                    if (this.isEnabled()) this.startAutoSync();
	                    else this.setDot('synced', '云同步已关闭，仅保存到本机');
	                    this.initNetworkEvents();
	                }
	                isEnabled() {
	                    try { return localStorage.getItem(this.disabledKey) !== '1'; }
	                    catch(e) { return true; }
	                }
	                setEnabled(enabled) {
	                    try {
	                        if (enabled) localStorage.removeItem(this.disabledKey);
	                        else localStorage.setItem(this.disabledKey, '1');
	                    } catch(e) {}
	                    if (!enabled) {
	                        if (this.pollTimer) clearTimeout(this.pollTimer);
	                        this.setDot('synced', '云同步已关闭，仅保存到本机');
	                        Utils.msg('云同步已关闭，之后的更改只保存在本机', 'info');
	                        return;
	                    }
	                    Utils.msg('云同步已开启，正在连接云端', 'info');
	                    this.startAutoSync();
	                    if (this.store.hasPendingDelta()) this.push();
	                    else this.pull({ silent: true }).catch(()=>{});
	                }
		                setDot(status, title) {
		                    const dot = document.getElementById('sync-dot');
		                    if (dot) {
		                        dot.className = `sync-dot ${status}`;
		                        dot.title = `${title || '云端同步'}（点击手动同步）`;
		                        dot.setAttribute('aria-label', title || '手动同步云端数据');
		                    }
		                }
		                async manualSync() {
		                    if (!this.isEnabled()) {
		                        Utils.msg('云同步已关闭，请先在设置中开启', 'info');
		                        this.setDot('synced', '云同步已关闭，仅保存到本机');
		                        return;
		                    }
		                    if (this.isPulling || this.isPushing) {
		                        Utils.msg('正在同步中，请稍候', 'info');
		                        return;
		                    }
		                    try {
		                        if (this.store.saveTimeout) {
		                            clearTimeout(this.store.saveTimeout);
		                            this.store.saveTimeout = null;
		                        }
		                        this.store.stagePendingDeltaFromCurrent();
		                        if (this.store.hasPendingDelta()) {
		                            this.store.isDataChangedRef.current = true;
		                            Utils.msg('正在上传本机更改', 'info');
		                            this.push();
		                        } else {
		                            Utils.msg('正在手动读取云端数据', 'info');
		                            await this.pull({ silent: false, manual: true });
		                        }
		                    } catch(e) {
		                        Utils.msg('手动同步失败，请稍后重试', 'error');
		                    }
		                }
		                bindUserActivity() {
		                    const activeEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
		                    activeEvents.forEach(evt => {
		                        window.addEventListener(evt, Utils.throttle(() => {
		                            this.lastUserActiveTime = Date.now();
		                            if (this.currentInterval > this.minInterval) {
		                                this.currentInterval = this.minInterval;
		                            }
		                        }, 2000));
		                    });
		                }
	                startAutoSync() {
	                    if (this.pollTimer) clearTimeout(this.pollTimer);
	                    if (!this.isEnabled()) {
	                        this.setDot('synced', '云同步已关闭，仅保存到本机');
	                        return;
	                    }
	                    
	                    const tick = async () => {
	                        if (!this.isEnabled()) {
	                            this.setDot('synced', '云同步已关闭，仅保存到本机');
	                            return;
	                        }
	                        if (document.hidden || (this.store.hasUnsavedChanges && !this.noteLocalEdit) || this.isPushing) {
	                            this.startAutoSync();
	                            return;
	                        }
	                        
	                        const idleTime = Date.now() - this.lastUserActiveTime;
		                        if (idleTime > this.idleThreshold) {
		                            this.currentInterval = this.maxInterval;
		                            this.startAutoSync();
		                            return;
	                        }
	                        
	                        try {
	                            const changed = await this.pull({ silent: true });
	                            if (changed) {
	                                this.currentInterval = this.minInterval;
	                            } else {
	                                this.currentInterval = Math.min(this.maxInterval, this.currentInterval * 1.5);
	                            }
	                        } catch(e) {}
	                        
	                        this.startAutoSync();
	                    };
		                    
		                    this.pollTimer = setTimeout(tick, this.currentInterval);
		                }
		                pullIfDue() {
		                    if (!this.isEnabled()) return;
		                    if (this.store.hasUnsavedChanges) {
		                        this.push();
		                        return;
		                    }
		                    const now = Date.now();
		                    if (this.lastPullAttemptAt && now - this.lastPullAttemptAt < this.minInterval) return;
		                    this.pull({ silent: true }).catch(()=>{});
		                }
		                // 挂接 online 与 visibilitychange 事件的增强安全防护
		                initNetworkEvents() {
	                    if (this._eventsBound) return;
	                    this._eventsBound = true;
	                    
		                    window.addEventListener('online', () => {
		                        if (!this.isEnabled()) return;
		                        this.pullIfDue();
		                    });
		                    
		                    document.addEventListener('visibilitychange', () => {
		                        if (!this.isEnabled()) return;
		                        if (!document.hidden) {
		                            this.pullIfDue();
		                        }
		                    });
	                }
	                normalizeCloud(cloud) {
	                    const data = (cloud && cloud.data) || {};
	                    return {
	                        ts: (cloud && cloud.ts) || 0,
	                        data: {
	                            students: Array.isArray(data.students) ? data.students : [],
	                            exams: Array.isArray(data.exams) ? data.exams : [],
	                            scores: Array.isArray(data.scores) ? data.scores : [],
	                            examTemplates: Array.isArray(data.examTemplates) ? data.examTemplates : []
	                        },
	                        deleted: (cloud && cloud.deleted) || data.__deleted || { students: {}, exams: {}, scores: {} },
	                        syncMeta: (cloud && cloud.syncMeta) || {}
	                    };
	                }
	                async fetchCloud() {
	                    const res = await fetch(`${this.api}?groupId=${encodeURIComponent(this.groupId)}&t=${Date.now()}`, { cache: 'no-store' });
	                    if (!res.ok) throw new Error(`云端读取失败：HTTP ${res.status}`);
	                    return this.normalizeCloud(await res.json());
	                }
	                applyDeltaToCloud(cloud, delta) {
	                    const merged = this.normalizeCloud(JSON.parse(JSON.stringify(cloud || {})));
	                    delta = delta || {};
	                    const upsertByKey = (kind, keyFn, mergeFn = null) => {
	                        const incoming = delta[kind] || {};
	                        const map = new Map((merged.data[kind] || []).map(item => [keyFn(item), item]));
	                        Object.entries(incoming).forEach(([key, item]) => {
	                            if (!key || !item) return;
	                            map.set(key, mergeFn && map.has(key) ? mergeFn(map.get(key), item) : item);
	                        });
	                        const deleted = (delta.deleted && delta.deleted[kind]) || {};
	                        Object.entries(deleted).forEach(([key, ts]) => {
	                            merged.deleted[kind][key] = Math.max(merged.deleted[kind][key] || 0, Number(ts) || 0);
	                            map.delete(key);
	                        });
	                        merged.data[kind] = Array.from(map.values()).filter(item => {
	                            const key = keyFn(item);
	                            return key && !((merged.deleted[kind] || {})[key] >= (item._ts || 0));
	                        });
	                    };
	                    upsertByKey('students', item => item && item.id);
	                    upsertByKey('exams', item => item && item.id);
	                    upsertByKey('scores', item => item && `${item.studentId}_${item.examId}`, this.mergeScoreRecord.bind(this));
	                    if (Array.isArray(delta.examTemplates)) {
	                        const templateMap = new Map((merged.data.examTemplates || []).map(t => [t.id, t]));
	                        delta.examTemplates.forEach(t => {
	                            if (!t || !t.id) return;
	                            const prev = templateMap.get(t.id);
	                            if (!prev || (t._ts || 0) >= (prev._ts || 0)) templateMap.set(t.id, t);
	                        });
	                        merged.data.examTemplates = Array.from(templateMap.values());
	                    }
	                    merged.ts = Date.now();
	                    merged.syncMeta = {
	                        ...(merged.syncMeta || {}),
	                        deviceId: this.store.deviceId,
	                        last_synced_at: delta.last_synced_at || 0,
	                        lastPushedAt: Date.now()
	                    };
	                    return merged;
	                }
	                mergeScoreRecord(a, b) {
	                    if (!a) return b;
	                    if (!b) return a;
	                    const merged = JSON.parse(JSON.stringify((a._ts || 0) >= (b._ts || 0) ? a : b));
	                    const aTs = a._fieldTs || {};
	                    const bTs = b._fieldTs || {};
	                    merged.details = { ...(a.details || {}) };
	                    merged.questionCounts = { ...(a.questionCounts || {}) };
	                    merged._fieldTs = { ...aTs };
	                    const allFields = new Set([...Object.keys(a.details || {}), ...Object.keys(b.details || {})]);
	                    allFields.forEach(field => {
	                        const aHasField = a.details && Object.prototype.hasOwnProperty.call(a.details, field);
	                        const bHasField = b.details && Object.prototype.hasOwnProperty.call(b.details, field);
	                        const at = Number(aTs[field] || (aHasField ? a._ts : 0) || 0);
	                        const bt = Number(bTs[field] || (bHasField ? b._ts : 0) || 0);
	                        if (bt >= at) {
	                            if (bHasField) merged.details[field] = b.details[field];
	                            else if (bTs[field]) delete merged.details[field];
	                            if (b.questionCounts && Object.prototype.hasOwnProperty.call(b.questionCounts, field)) merged.questionCounts[field] = b.questionCounts[field];
	                            else if (bTs[field]) delete merged.questionCounts[field];
	                            merged._fieldTs[field] = bt;
	                        }
	                    });
	                    const estA = Number(aTs.__estimatedTotal || a._ts || 0);
	                    const estB = Number(bTs.__estimatedTotal || b._ts || 0);
	                    if (estB >= estA) {
	                        merged.estimatedTotal = b.estimatedTotal || 0;
	                        merged._fieldTs.__estimatedTotal = estB;
	                    } else {
	                        merged.estimatedTotal = a.estimatedTotal || 0;
	                        merged._fieldTs.__estimatedTotal = estA;
	                    }
	                    const absentA = Number(aTs.__examAbsent || a._ts || 0);
	                    const absentB = Number(bTs.__examAbsent || b._ts || 0);
	                    if (absentB >= absentA) {
	                        merged.examAbsent = b.examAbsent === true;
	                        merged._fieldTs.__examAbsent = absentB;
	                    } else {
	                        merged.examAbsent = a.examAbsent === true;
	                        merged._fieldTs.__examAbsent = absentA;
	                    }
	                    if (merged.examAbsent) {
	                        merged.details = {};
	                        merged.questionCounts = {};
	                        Object.keys(merged._fieldTs).forEach(k => { if (!k.startsWith('__')) delete merged._fieldTs[k]; });
	                        merged.total = 0;
	                    } else {
	                        merged.total = Object.values(merged.details || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
	                    }
	                    merged._ts = Math.max(a._ts || 0, b._ts || 0, ...Object.values(merged._fieldTs).map(Number).filter(Boolean));
	                    return merged;
	                }
	                async postCloud(merged, delta) {
	                    const payloadData = { ...merged.data, __deleted: merged.deleted };
	                    const res = await fetch(this.api, {
	                        method:'POST',
	                        headers:{'Content-Type':'application/json'},
	                        body:JSON.stringify({
	                            groupId:this.groupId,
	                            ts: merged.ts,
	                            last_synced_at: delta ? (delta.last_synced_at || 0) : 0,
	                            data: payloadData,
	                            deleted: merged.deleted,
	                            syncMeta: merged.syncMeta
	                        })
	                    });
	                    if (res.status === 409 || res.status === 412) {
	                        const err = new Error('云端数据已被其他老师更新，正在重新合并');
	                        err.code = 'STALE_CLOUD_VERSION';
	                        throw err;
	                    }
	                    if (!res.ok) throw new Error(`云端保存失败：HTTP ${res.status}`);
	                    return res;
	                }
	                async pull(options = {}) {
	                    if (!this.isEnabled()) {
	                        this.setDot('synced', '云同步已关闭，仅保存到本机');
	                        return false;
	                    }
		                    if (this.isPulling) return false;
		                    this.isPulling = true;
		                    this.lastPullAttemptAt = Date.now();
		                    if (!options.silent) this.setDot('unsaved', '正在连接云端...');
	                    try {
	                        const cloud = await this.fetchCloud();
	                        const changed = this.merge(cloud);
	                        this.store.state.syncMeta.lastPulledAt = Date.now();
	                        this.store.state.syncMeta.lastCloudTs = cloud.ts || 0;
	                        this.store.state.syncMeta.lastError = '';
	                        this.store.silentSave();
	                        if (!this.store.hasPendingDelta()) this.store.resetDeltaTracking();
	                        if (changed && window.app && window.app.ui) {
	                            const ui = window.app.ui;
	                            // 无冲突焦点保护：如果正在录分或观看图表，仅静默更新底层数据，避免焦点丢失或图表周期性重绘。
	                            const hasActiveInput = document.activeElement && document.activeElement.classList.contains('score-input');
	                            const hasOpenDialog = !!document.querySelector('dialog[open]');
	                            const isViewingReport = ['analysis', 'details', 'student-dashboard'].includes(ui.cur);
	                            if (hasActiveInput && ui.cur === 'exams') {
	                                ui.pendingRemoteExamRefresh = true;
	                                Utils.msg("已收到其他老师更新，当前输入结束后将刷新表格", "info");
	                            } else if (options.silent && (isViewingReport || hasOpenDialog)) {
	                                ui.pendingRemoteRefresh = true;
	                                if (!ui._remoteRefreshNoticeShown) {
	                                    ui._remoteRefreshNoticeShown = true;
	                                    Utils.msg("云端数据有更新，已在后台暂存，切换页面后自动刷新", "info");
	                                }
	                            } else {
	                                ui.pendingRemoteRefresh = false;
	                                ui._remoteRefreshNoticeShown = false;
	                                ui.refresh();
	                            }
	                        }
	                        this.setDot('synced', `云端数据已同步（${new Date().toLocaleTimeString()}）`);
	                        return changed;
	                    } catch(e) { 
	                        this.store.ensureSyncShape();
	                        this.store.state.syncMeta.lastError = e.message || '同步失败或离线';
	                        this.setDot('error', this.store.state.syncMeta.lastError);
	                        if (!options.silent) Utils.msg("未连接到网络，当前离线使用中", "error"); 
	                        return false;
	                    } finally {
	                        this.isPulling = false;
	                    }
	                }
	                merge(cloud) {
	                    cloud = this.normalizeCloud(cloud);
	                    const local = this.store.state;
	                    this.store.ensureSyncShape();
	                    const localDeleted = local.deleted;
	                    const cloudDeleted = cloud.deleted || {};
	                    const mergeDeleted = (kind) => {
	                        const out = { ...(localDeleted[kind] || {}) };
	                        Object.entries(cloudDeleted[kind] || {}).forEach(([key, ts]) => {
	                            out[key] = Math.max(out[key] || 0, Number(ts) || 0);
	                        });
	                        localDeleted[kind] = out;
	                    };
	                    ['students', 'exams', 'scores'].forEach(mergeDeleted);

	                    let changed = false;
	                    let conflictCount = 0;
	                    const sameRecord = (a, b) => {
	                        if (a === b) return true;
	                        if (!a || !b) return false;
	                        if ((a._ts || 0) !== (b._ts || 0)) return false;
	                        return JSON.stringify(a) === JSON.stringify(b);
	                    };
	                    const mergeArr = (l, c, key, kind, mergeFn = null) => {
	                        const map = new Map();
	                        const deleted = localDeleted[kind] || {};
	                        (c || []).forEach(i => {
	                            const ck = key(i);
	                            if (!ck || (deleted[ck] || 0) >= (i._ts || 0)) return;
	                            map.set(ck, i);
	                        });
	                        (l || []).forEach(i => {
	                            const ck = key(i);
	                            if (!ck || (deleted[ck] || 0) >= (i._ts || 0)) return;
	                            if(!map.has(ck)) {
	                                map.set(ck, i);
	                            } else {
	                                const remote = map.get(ck);
	                                if (!sameRecord(i, remote)) conflictCount++;
	                                if (mergeFn) map.set(ck, mergeFn(remote, i));
	                                else if ((i._ts || 0) >= (remote._ts || 0)) map.set(ck, i);
	                            }
	                        });
	                        return Array.from(map.values());
	                    };
	                    const nextStudents = mergeArr(local.data.students, cloud.data.students, i=>i.id, 'students');
	                    const nextExams = mergeArr(local.data.exams, cloud.data.exams, i=>i.id, 'exams');
	                    const nextScores = mergeArr(local.data.scores, cloud.data.scores, i=>`${i.studentId}_${i.examId}`, 'scores', this.mergeScoreRecord.bind(this));
	                    changed = !sameRecord(local.data.students, nextStudents) || !sameRecord(local.data.exams, nextExams) || !sameRecord(local.data.scores, nextScores);
	                    local.data.students = nextStudents;
	                    local.data.exams = nextExams;
	                    local.data.scores = nextScores;
	                    const templateMap = new Map((cloud.data.examTemplates || []).map(t => [t.id, t]));
	                    (local.data.examTemplates || []).forEach(t => {
	                        const remote = templateMap.get(t.id);
	                        if (!remote || (t._ts || 0) >= (remote._ts || 0)) templateMap.set(t.id, t);
	                    });
	                    const nextTemplates = Array.from(templateMap.values()).sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN', { numeric: true }));
	                    if (JSON.stringify(local.data.examTemplates || []) !== JSON.stringify(nextTemplates)) {
	                        local.data.examTemplates = nextTemplates;
	                        changed = true;
	                    }
	                    local.ts = Math.max(local.ts, cloud.ts || 0);
	                    local.syncMeta.conflictCount = (local.syncMeta.conflictCount || 0) + conflictCount;
	                    this.store.rebuildScoreIndex();
	                    return changed || conflictCount > 0;
	                }
	                push() {
	                    if (!this.isEnabled()) {
	                        this.setDot('synced', '云同步已关闭，仅保存到本机');
	                        return;
	                    }
	                    if (!this.store.isDataChangedRef || !this.store.isDataChangedRef.current) return;
	                    if (!this.store.hasPendingDelta()) return;
	                    this._push();
	                }
	                async _push() {
	                    if (!this.isEnabled()) {
	                        this.setDot('synced', '云同步已关闭，仅保存到本机');
	                        return;
	                    }
	                    if (this.isPushing) { this.pendingPush = true; return; }
	                    if (!this.store.isDataChangedRef || !this.store.isDataChangedRef.current || !this.store.hasPendingDelta()) return;
	                    this.isPushing = true;
	                    this.setDot('unsaved', '正在保存至云端...');
	                    const delta = this.store.consumePendingDelta();
	                    try {
	                        let merged = null;
	                        let latestCloud = null;
	                        for (let attempt = 0; attempt < 3; attempt++) {
	                            latestCloud = await this.fetchCloud();
	                            if ((latestCloud.ts || 0) > (delta.last_synced_at || 0)) {
	                                this.merge(latestCloud);
	                                delta.last_synced_at = latestCloud.ts || Date.now();
	                            }
	                            merged = this.applyDeltaToCloud(latestCloud, delta);
	                            try {
	                                await this.postCloud(merged, delta);
	                                break;
	                            } catch (err) {
	                                if (err.code !== 'STALE_CLOUD_VERSION' || attempt === 2) throw err;
	                                const fresh = await this.fetchCloud();
	                                this.merge(fresh);
	                                delta.last_synced_at = fresh.ts || Date.now();
	                            }
	                        }
	                        if (!merged) throw new Error('云端保存失败：无法生成合并数据');
	                        const hasNewLocalEdits = this.store.hasPendingDelta();
	                        if (hasNewLocalEdits) {
	                            this.merge(merged);
	                        } else {
	                            this.store.state.data = merged.data;
	                            this.store.state.deleted = merged.deleted;
	                        }
	                        this.store.state.ts = merged.ts;
	                        this.store.state.syncMeta.lastPushedAt = Date.now();
	                        this.store.state.syncMeta.lastPulledAt = Date.now();
	                        this.store.state.syncMeta.lastCloudTs = merged.ts;
	                        this.store.state.syncMeta.lastError = '';
	                        this.store.rebuildScoreIndex();
	                        this.store.silentSave();
	                        if (!hasNewLocalEdits && !this.store.hasPendingDelta()) this.store.resetDeltaTracking();
	                        this.setDot('synced', `云端数据已同步（${new Date().toLocaleTimeString()}）`);
	                    } catch(e) {
	                        this.store.mergePendingDelta(delta);
	                        this.store.isDataChangedRef.current = true;
	                        this.store.ensureSyncShape();
	                        this.store.state.syncMeta.lastError = e.message || '同步失败或离线';
	                        this.setDot('error', this.store.state.syncMeta.lastError);
	                    } finally {
	                        this.isPushing = false;
	                        if (this.pendingPush) {
	                            this.pendingPush = false;
	                            this.push();
	                        }
	                    }
	                }
	            }

            class UI {
                get _students() { return this.store.state.data.students || []; }
                get _exams() { return this.store.state.data.exams || []; }
                get _scores() { return this.store.state.data.scores || []; }

                constructor(store) { 
                    this.store = store; 
                    this.state = this.store.state;
                    this.cur = 'exams'; 
                    this.chartInstance = null; 
                    this.spTrendChart = null;
                    this.spRadarChart = null;
                    this.analysisCache = { exam: null, pool: [], prevRanks: {}, sortCol: 'total', sortAsc: false };
                    this.detailsScoreSort = { col: null, asc: false };
                    this.debouncedSearchStudentInExams = Utils.debounce((kw) => this.searchStudentInExams(kw), 300);

                    this._handleContentBodyScroll = (event) => {
                        const contentBody = event && event.target && event.target.classList && event.target.classList.contains('content-body')
                            ? event.target
                            : null;
                        if (!contentBody) return;
                        const topNavbar = contentBody.closest('.view-section')?.querySelector('.top-navbar');
                        if (!topNavbar) return;
                        topNavbar.classList.toggle('scrolled', contentBody.scrollTop > 20);
                    };

                    document.addEventListener('scroll', this._handleContentBodyScroll, true);
                    document.querySelectorAll('.content-body').forEach(contentBody => {
                        this._handleContentBodyScroll({ target: contentBody });
                        contentBody.addEventListener('scroll', () => {
                            document.querySelectorAll('.multi-select.open').forEach(ms => ms.classList.remove('open'));
                        }, { passive: true });
                    });
                    this._bindAnalysisTabsEdgeIndicators();
                    this._bindScrollShadows();
                    this._bindOverviewResponsiveResize();
                    this._setupMobileTopActionMenus();
                    this._installGlobalSearchButtons();
                    this._enhanceDialogs();
                    this._bindQuestionListDnD('q-list');
                    this._bindQuestionListDnD('edit-q-list');
                    
                    window.addEventListener('resize', Utils.debounce(() => { 
                        if (this.chartInstance) this.chartInstance.resize(); 
                        if (this.spTrendChart) this.spTrendChart.resize();
                        if (this.spRadarChart) this.spRadarChart.resize();
                        if (this.spQuadChart) this.spQuadChart.resize();
                        this._resizeOverviewChartsSoon();
                        this._setupMobileTopActionMenus();
                    }, 200));

                    // Ensure charts resize when printing
                    window.addEventListener('beforeprint', () => {
                        try {
                            if (this.chartInstance) this.chartInstance.resize();
                            if (this.spTrendChart) this.spTrendChart.resize();
                            if (this.spRadarChart) this.spRadarChart.resize();
                            if (this.spQuadChart) this.spQuadChart.resize();
                            if (this.ovCharts) this.ovCharts.forEach(c => c.resize());
                        } catch(e){}
                    });
                    window.addEventListener('afterprint', () => {
                        setTimeout(() => {
                            try {
                                if (this.chartInstance) this.chartInstance.resize();
                                if (this.spTrendChart) this.spTrendChart.resize();
                                if (this.spRadarChart) this.spRadarChart.resize();
                                if (this.spQuadChart) this.spQuadChart.resize();
                                if (this.ovCharts) this.ovCharts.forEach(c => c.resize());
                            } catch(e){}
                        }, 200);
                    });

                    let isComposingAnalysis = false;
                    const analysisSearchInput = document.getElementById('analysis-search-student');
                    if (analysisSearchInput) {
                        analysisSearchInput.addEventListener('compositionstart', () => {
                            isComposingAnalysis = true;
                        });
                        analysisSearchInput.addEventListener('compositionend', (e) => {
                            isComposingAnalysis = false;
                        });
                        analysisSearchInput.addEventListener('input', (e) => {
                            if ((this.store.state.data.students || []).length === 0 && analysisSearchInput.value.trim()) {
                                analysisSearchInput.value = '';
                                Utils.msg('请先添加学生数据', 'error');
                            }
                        });
                        analysisSearchInput.addEventListener('keydown', (e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const kw = analysisSearchInput.value.trim();
                            if (!kw) return;
                            window.app.ui.handleAnalysisSearch(kw);
                        });
                    }
                    
                    const sidebarEngine = document.getElementById('global-engine-scroll');
                    if (sidebarEngine) {
                        sidebarEngine.addEventListener('scroll', () => {
                            document.querySelectorAll('.sidebar-ms').forEach(ms => ms.classList.remove('open'));
                            this._updateScrollShadow(sidebarEngine);
                        });
                        this._updateScrollShadow(sidebarEngine);
                    }

                    // Dialog backdrop click to close
                    if (window.HTMLDialogElement && !window.__gakutenDialogFocusPatched) {
                        window.__gakutenDialogFocusPatched = true;
                        const rawShowModal = HTMLDialogElement.prototype.showModal;
                        HTMLDialogElement.prototype.showModal = function(...args) {
                            this.__lastFocus = document.activeElement;
                            const ret = rawShowModal.apply(this, args);
                            setTimeout(() => {
                                const first = this.querySelector('input, select, textarea, button');
                                if (first && typeof first.focus === 'function') first.focus();
                            }, 0);
                            this.addEventListener('close', () => {
                                const last = this.__lastFocus;
                                if (last && typeof last.focus === 'function') setTimeout(() => last.focus(), 0);
                            }, { once: true });
                            return ret;
                        };
                    }
                    window.addEventListener('click', (e) => {
                        if (e.target.tagName === 'DIALOG' && e.target.hasAttribute('open') && e.target.dataset.backdropClose !== 'false') {
                            e.target.close();
                        }
                    });
                    this.syncStudentSearchAvailability();
                    // Global undo (Ctrl/Cmd+Z) when not focused in an editable field
                    window.addEventListener('keydown', (e) => {
                        const ae = document.activeElement;
                        const tag = ae && ae.tagName ? ae.tagName.toUpperCase() : '';
                        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.isContentEditable);
                        const key = e.key && e.key.toLowerCase();
                        if ((e.ctrlKey || e.metaKey) && key === 's') {
                            e.preventDefault();
                            try { if (this.store.saveTimeout) clearTimeout(this.store.saveTimeout); this.store.save(); Utils.msg('已手动保存'); } catch(err) {}
                            return;
                        }
                        if ((e.ctrlKey || e.metaKey) && key === 'z') {
                            if (isEditable) return;
                            e.preventDefault();
                            try { this.store.undo(); } catch(err) {}
                            return;
                        }
                        if ((e.ctrlKey || e.metaKey) && key === 'k') {
                            e.preventDefault();
                            this.openGlobalSearch();
                            return;
                        }
                        if (!isEditable && ['1','2','3','4'].includes(e.key)) {
                            const order = ['exams', 'analysis', 'details', 'students'];
                            this.switchView(order[Number(e.key) - 1]);
                        }
                    });
                }

                syncStudentSearchAvailability() {
                    const hasStudents = (this.store.state.data.students || []).length > 0;
                    ['dashboard-search-student', 'exam-search-student', 'details-search-student', 'sp-jump-search'].forEach(id => {
                        const input = document.getElementById(id);
                        if (!input) return;
                        input.disabled = !hasStudents;
                        input.title = hasStudents ? '' : '请先添加学生数据';
                        if (!hasStudents) input.value = '';
                    });
                    if (typeof window.__gakutenUpdatePinyinStatus === 'function') window.__gakutenUpdatePinyinStatus();
                }

                showConfirmDialog(message, onConfirm, confirmText = "确认删除") {
                    const dialog = document.createElement('dialog');
                    dialog.setAttribute('aria-modal', 'true');
                    dialog.setAttribute('aria-label', '确认操作');
                    dialog.className = 'dialog-shell dialog--md confirm-dialog';
                    dialog.innerHTML = `
                        <div class="mb-md">
                            <div class="dialog-title" style="font-size:16px; margin-bottom:12px;">
                                ${window.gk2IconMarkup('alert')} 请确认操作
                            </div>
                            <div class="dialog-note" style="font-size:14px; color:var(--text-muted); white-space:pre-wrap;">${Utils.escapeHTML(message)}</div>
                        </div>
                        <div class="dialog-footer" style="margin-top:25px;">
                            <button class="secondary btn--compact" onclick="this.closest('dialog').close()">取消</button>
                            <button class="danger btn--compact" style="background-color: var(--danger); color: white;" onclick="window.app.ui._confirmDialogAction()">${confirmText}</button>
                        </div>
                    `;
                    document.body.appendChild(dialog);
                    this._pendingConfirmAction = onConfirm;
                    dialog.showModal();
                    dialog.addEventListener('close', () => {
                        dialog.remove();
                        this._pendingConfirmAction = null;
                    });
                }

                _confirmDialogAction() {
                    if (this._pendingConfirmAction) {
                        this._pendingConfirmAction();
                        const dialog = document.querySelector('dialog[open]');
                        if (dialog) dialog.close();
                    }
                }

	                openSettingsDialog(tab = 'ai') {
	                    const dialog = document.getElementById('modal-settings');
	                    if (!dialog) return;
	                    try {
	                        const cloudSyncToggle = document.getElementById('cloud-sync-toggle');
	                        if (cloudSyncToggle && window.app && window.app.sync && typeof window.app.sync.isEnabled === 'function') {
	                            cloudSyncToggle.checked = window.app.sync.isEnabled();
	                        }
                        window.gk2AISettings?.restore();
                        this.store.updateStorageUsageUI();
                    } catch (e) {}
                    this.switchSettingsTab(tab);
                    const diagnosticToggle = document.getElementById('gk2-diagnostic-setting');
                    if (diagnosticToggle) diagnosticToggle.checked = window.gk2?.diagnostic !== false;
                    dialog.showModal();
                }

                openDataManagerDialog() {
                    this.openSettingsDialog('data');
                }

                switchSettingsTab(tab = 'ai') {
                    document.querySelectorAll('.settings-tab').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.settingsTab === tab);
                    });
                    document.querySelectorAll('.settings-panel').forEach(panel => {
                        panel.classList.toggle('active', panel.id === `settings-panel-${tab}`);
                    });
                    if (tab === 'data' && this.store && typeof this.store.updateStorageUsageUI === 'function') {
                        this.store.updateStorageUsageUI();
                    }
                }

                _installGlobalSearchButtons() {
                    document.querySelectorAll('.top-actions').forEach(actions => {
                        if (actions.dataset.gk2RosterMoved === 'true') return;
                        if (actions.closest('#view-exams') || actions.closest('#view-student-dashboard')) return;
                        if (actions.querySelector('.global-search-trigger')) return;
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'secondary global-search-trigger mobile-keep';
                        btn.title = '全局搜索 (Cmd/Ctrl+K)';
                        btn.setAttribute('aria-label', '全局搜索');
                        btn.innerHTML = window.gk2IconMarkup('search');
                        btn.onclick = () => this.openGlobalSearch();
                        actions.prepend(btn);
                    });
                }

                _enhanceDialogs() {
                    document.querySelectorAll('dialog .dialog-close-x').forEach(btn => btn.remove());
                }

                openGlobalSearch() {
                    let dialog = document.getElementById('global-search-dialog');
                    if (!dialog) {
                        dialog = document.createElement('dialog');
                        dialog.id = 'global-search-dialog';
                        dialog.setAttribute('aria-modal', 'true');
                        dialog.setAttribute('aria-label', '全局搜索');
                        dialog.className = 'dialog-shell dialog--search';
                        dialog.innerHTML = `
                            <div class="global-search-input-wrap">
                                <span aria-hidden="true">${window.gk2IconMarkup('search')}</span>
                                <input id="global-search-input" placeholder="搜索学生、考试，或输入：对比 考试名">
                                <span class="global-search-hint">⌘K</span>
                            </div>
                            <div id="global-search-results" class="dialog-results mt-md"></div>`;
                        document.body.appendChild(dialog);
                        this._enhanceDialogs();
                        const input = dialog.querySelector('#global-search-input');
                        input.addEventListener('input', Utils.debounce(() => this.renderGlobalSearchResults(input.value), 120));
                        input.addEventListener('keydown', (e) => {
                            if (e.key !== 'Enter') return;
                            const first = dialog.querySelector('.search-result-btn');
                            if (first) { e.preventDefault(); first.click(); }
                        });
                    }
                    dialog.showModal();
                    const input = dialog.querySelector('#global-search-input');
                    if (input) { input.value = ''; setTimeout(() => input.focus(), 0); }
                    this.renderGlobalSearchResults('');
                }

                _matchesPinyin(text, keyword) {
                    const kw = String(keyword || '').trim().toLowerCase();
                    if (!kw) return true;
                    const raw = String(text || '');
                    const lower = raw.toLowerCase();
                    const initials = this._getPinyinInitials ? this._getPinyinInitials(raw).toLowerCase() : lower;
                    const full = (window.pinyinPro && window.pinyinPro.pinyin) ? window.pinyinPro.pinyin(raw, { toneType:'none', type:'string' }).replace(/\s+/g,'').toLowerCase() : '';
                    return lower.includes(kw) || initials.includes(kw) || full.includes(kw);
                }

                renderGlobalSearchResults(keyword, resultBox = null, closeAction = null) {
                    const box = resultBox || document.getElementById('global-search-results');
                    if (!box) return;
                    const rawKw = String(keyword || '').trim();
                    const kw = rawKw.toLowerCase();
                    const compareMode = /^对比\s+/.test(rawKw);
                    const query = compareMode ? rawKw.replace(/^对比\s+/, '').trim() : rawKw;
                    const rows = [];
                    const closeSearch = closeAction || "document.getElementById('global-search-dialog').close();";

                    if (!compareMode) {
                        (this.store.state.data.students || [])
                            .filter(student=>Utils.canReadStudent(student))
                            .filter(s => this._matchesPinyin(s.name, query) || this._matchesPinyin(s.teachingClass, query) || this._matchesPinyin(s.campus, query))
                            .slice(0, 12)
                            .forEach(s => {
                                rows.push(`<button class="secondary search-result-btn" onclick="${closeSearch} window.app.ui.openStudentProfile('${s.id}')">${window.gk2IconMarkup('user')} 学生｜${Utils.escapeHTML(s.name)} <span class="search-result-subtext">${Utils.escapeHTML(s.campus||'')} · ${Utils.escapeHTML(s.teachingClass||'')}</span></button>`);
                            });
                    }

                    (this.store.state.data.exams || [])
                        .filter(exam=>this.store.state.data.students.some(student=>Utils.canReadStudent(student,exam)))
                        .filter(e => this._matchesPinyin(e.name, query) || this._matchesPinyin(e.grade, query))
                        .slice(0, 12)
                        .forEach(e => {
                            if (compareMode) {
                                rows.push(`<button class="secondary search-result-btn" onclick="${closeSearch} window.app.ui.jumpToExamCompare('${e.id}')">${window.gk2IconMarkup('compare')} 对比｜${Utils.escapeHTML(e.name)} <span class="search-result-subtext">${Utils.escapeHTML(e.grade||'')}</span></button>`);
                            } else {
                                rows.push(`<button class="secondary search-result-btn" onclick="${closeSearch} window.app.ui.jumpToExamEntry('${e.id}')">${window.gk2IconMarkup('file')} 考试｜${Utils.escapeHTML(e.name)} <span class="search-result-subtext">${Utils.escapeHTML(e.grade||'')}</span></button>`);
                            }
                        });

                    box.innerHTML = rows.length ? rows.join('') : '<div class="dialog-empty-note">输入学生姓名/拼音、考试名称，或“对比 + 考试名”。</div>';
                }

                jumpToExamEntry(eid) {
                    this.switchView('exams');
                    setTimeout(() => {
                        const card = document.getElementById(`e-card-${eid}`);
                        if (card) { card.open = true; this.renderExamTables(eid); card.scrollIntoView({ behavior:'smooth', block:'start' }); }
                    }, 80);
                }

                jumpToExamCompare(eid) {
                    const exam = (this.store.state.data.exams || []).find(e => e.id === eid);
                    this.switchView('analysis');
                    this.store.state.currentAnalysisType = 'compare';
                    if (exam) this.store.state.currentExamId = eid;
                    setTimeout(() => this.switchAnalysisTab('compare'), 80);
                }

                _bindAnalysisTabsEdgeIndicators(scope = document) {
                    scope.querySelectorAll('.analysis-tabs').forEach(tabs => {
                        if (tabs.__edgeIndicatorBound) return;
                        tabs.__edgeIndicatorBound = true;
                        const updateEdge = () => {
                            tabs.classList.toggle('scrolled-start', tabs.scrollLeft > 5);
                            tabs.classList.toggle('scrolled-end', tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 5);
                            const visibleTabs = Array.from(tabs.querySelectorAll('.analysis-tab')).filter(tab => tab.offsetParent !== null && tab.style.display !== 'none');
                            tabs.classList.toggle('is-even-distributed', visibleTabs.length <= 4);
                        };
                        tabs.addEventListener('scroll', updateEdge, { passive: true });
                        setTimeout(updateEdge, 0);
                    });
                }

                _updateScrollShadow(el) {
                    if (!el || !el.classList) return;
                    el.classList.toggle('is-scrolled-x', el.scrollLeft > 4);
                    el.classList.toggle('is-scrolled-y', el.scrollTop > 4);
                    el.classList.toggle('scrolled-top', el.scrollTop > 4);
                    el.classList.toggle('scrolled-bottom', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
                }

                _bindScrollShadows(scope = document) {
                    scope.querySelectorAll('.table-scroll-container, .global-engine').forEach(el => {
                        if (el.__scrollShadowBound) return;
                        el.__scrollShadowBound = true;
                        const update = () => this._updateScrollShadow(el);
                        el.addEventListener('scroll', update, { passive: true });
                        setTimeout(update, 0);
                    });
                }

                _getExamCampuses(exam) {
                    if (!exam) return [];

                    // 1. 获取建考时配置的初始校区数组（主数据基准）
                    const configuredCamps = exam.campuses && exam.campuses.length > 0
                        ? exam.campuses
                        : (exam.campus ? [exam.campus] : []);

                    // 2. 获取已有成绩学生推算出的校区（动态流水数据兜底）
                    const scores = this.store.state.data.scores.filter(s => s.examId === exam.id && (!s.examAbsent && (s.total > 0 || s.estimatedTotal > 0)));
                    let scoreCamps = [];
                    if (scores.length > 0) {
                        const stuIds = scores.map(s => s.studentId);
                        const stus = this.store.state.data.students.filter(s => stuIds.includes(s.id));
                        scoreCamps = stus.map(s => s.campus).filter(Boolean);
                    }

                    // 3. 将静态配置和动态推算的校区合并去重，确保联考校区不会因为某一方没录成绩而丢失可见权限
                    return [...new Set([...configuredCamps, ...scoreCamps])];
                }

                _getAuth() {
                    try {
                        return window.__gakutenAuth && typeof window.__gakutenAuth.getAuth === 'function'
                            ? window.__gakutenAuth.getAuth()
                            : null;
                    } catch (e) {
                        return null;
                    }
                }

                _applyTeacherExamScopeLock(options = {}) {
                    const auth = this._getAuth();
                    const isTeacher = auth && auth.mode === 'teacher';
                    const campusContainer = options.campusContainer ? document.querySelector(options.campusContainer) : null;
                    const campusSelect = options.campusSelect ? document.querySelector(options.campusSelect) : null;
                    const gradeSelect = options.gradeSelect ? document.querySelector(options.gradeSelect) : null;

                    if (campusContainer) {
                        campusContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            if (isTeacher) {
                                if (options.preserveOtherCampuses) {
                                    if (cb.value === auth.campus) {
                                        cb.checked = true;
                                        cb.disabled = true;
                                    } else {
                                        cb.disabled = false;
                                    }
                                } else {
                                    cb.checked = cb.value === auth.campus;
                                    cb.disabled = true;
                                }
                            } else {
                                cb.disabled = false;
                            }
                        });
                    }
                    if (campusSelect) {
                        if (isTeacher && auth.campus) {
                            if (![...campusSelect.options].some(opt => opt.value === auth.campus)) {
                                campusSelect.innerHTML += `<option value="${Utils.escapeHTML(auth.campus)}">${Utils.escapeHTML(auth.campus)}</option>`;
                            }
                            campusSelect.value = auth.campus;
                            campusSelect.disabled = true;
                        } else {
                            campusSelect.disabled = false;
                        }
                    }
                    if (gradeSelect) {
                        if (isTeacher && auth.grade) {
                            if (![...gradeSelect.options].some(opt => opt.value === auth.grade)) {
                                gradeSelect.innerHTML += `<option value="${Utils.escapeHTML(auth.grade)}">${Utils.escapeHTML(auth.grade)}</option>`;
                            }
                            gradeSelect.value = auth.grade;
                            gradeSelect.disabled = true;
                        } else {
                            gradeSelect.disabled = false;
                        }
                    }
                }

                toggleDropdown(headerElement) {
                    const parent = headerElement.parentElement;
                    const panel = parent.querySelector('.ms-panel');
                    const isOpen = parent.classList.contains('open');
                    
                    document.querySelectorAll('.multi-select').forEach(ms => {
                        if (ms !== parent) {
                            ms.classList.remove('open');
                            const p = ms.querySelector('.ms-panel');
                            if (p && ms.classList.contains('sidebar-ms')) {
                                p.style.position = ''; p.style.top = ''; p.style.left = '';
                            }
                        }
                    });
                    
                    if (isOpen) {
                        parent.classList.remove('open');
                        if (parent.classList.contains('sidebar-ms')) {
                            panel.style.position = ''; panel.style.top = ''; panel.style.left = '';
                        }
                    } else {
                        parent.classList.add('open');
                        if (parent.classList.contains('sidebar-ms') && !(window.matchMedia && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches)) {
                            const rect = headerElement.getBoundingClientRect();
                            panel.style.position = 'fixed';
                            panel.style.top = Math.max(15, rect.top - 15) + 'px'; 
                            panel.style.left = (rect.right + 15) + 'px';
                        }
                        
                        const closeHandler = (e) => {
                            if (!document.body.contains(e.target)) {
                                document.removeEventListener('click', closeHandler);
                                return;
                            }
                            if (!parent.contains(e.target)) {
                                parent.classList.remove('open');
                                if (parent.classList.contains('sidebar-ms')) {
                                    panel.style.position = ''; panel.style.top = ''; panel.style.left = '';
                                }
                                document.removeEventListener('click', closeHandler);
                            }
                        };
                        setTimeout(() => document.addEventListener('click', closeHandler), 10);
                    }
                }

                updateNavBadges() {
                    if (!this.store || !this.store.state || !this.store.state.data) return;
                    const data = this.store.state.data;
                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    const students = data.students || [];
                    const exams = data.exams || [];
                    const scores = data.scores || [];

                    const visibleStudents = students.filter(s => this._studentMatchesFocusForExam(s, null, focus));
                    const visibleStudentIds = new Set(visibleStudents.map(s => s.id));
                    const visibleExams = exams.filter(exam => {
                        const exCampuses = this._getExamCampuses(exam);
                        if (focus.grades && focus.grades.length > 0 && !focus.grades.includes(exam.grade)) return false;
                        if (focus.phases && focus.phases.length > 0) {
                            const phase = Utils.calculatePhase(exam.grade, exam.date);
                            if (!focus.phases.includes(phase)) return false;
                        }
                        return students.some(s => {
                            if (!this._studentMatchesFocusForExam(s, exam, focus)) return false;
                            if (s.grade !== exam.grade) return false;
                            const classAtExam = Utils.getClassForExam(s, exam);
                            const campusAtExam = classAtExam.campus || s.campus || '';
                            return exCampuses.length === 0 || exCampuses.includes(campusAtExam);
                        });
                    });
                    const visibleExamIds = new Set(visibleExams.map(e => e.id));
                    const visibleScoreCount = scores.filter(sc => {
                        if (!visibleExamIds.has(sc.examId)) return false;
                        if (!visibleStudentIds.has(sc.studentId)) {
                            const stu = students.find(s => s.id === sc.studentId);
                            const exam = exams.find(e => e.id === sc.examId);
                            if (!stu || !exam || !this._studentMatchesFocusForExam(stu, exam, focus)) return false;
                        }
                        return !sc.examAbsent && (Number(sc.total || 0) > 0 || Number(sc.estimatedTotal || 0) > 0 || (sc.details && Object.keys(sc.details).length > 0));
                    }).length;
                    const selectedExamId = this.store.state.currentExamId || document.getElementById('global-exam')?.value || '';
                    const selectedExam = selectedExamId ? exams.find(e => e.id === selectedExamId) : null;
                    const selectedExamScoreCount = selectedExam ? scores.filter(sc => {
                        if (sc.examId !== selectedExam.id) return false;
                        const stu = students.find(s => s.id === sc.studentId);
                        if (!stu || !this._studentMatchesFocusForExam(stu, selectedExam, focus)) return false;
                        return !sc.examAbsent && (Number(sc.total || 0) > 0 || Number(sc.estimatedTotal || 0) > 0 || (sc.details && Object.keys(sc.details).length > 0));
                    }).length : visibleScoreCount;
                    
                    // 1. 考试场次
                    const badgeExam = document.getElementById('nav-badge-exam');
                    if (badgeExam) {
                        badgeExam.innerText = `${visibleExams.length}场`;
                    }
                    
                    // 2. 成绩条数
                    const badgeAnalysis = document.getElementById('nav-badge-analysis');
                    if (badgeAnalysis) {
                        badgeAnalysis.innerText = `${visibleScoreCount}条`;
                    }

                    const badgeDetails = document.getElementById('nav-badge-details');
                    if (badgeDetails) {
                        badgeDetails.innerText = `${selectedExamScoreCount}条`;
                    }
                    
                    // 3. 学生人数
                    const badgeStudent = document.getElementById('nav-badge-student');
                    if (badgeStudent) {
                        badgeStudent.innerText = `${visibleStudents.length}人`;
                    }
                }

                updateAnalysisTabAvailability() {
                    const examCount = (this.store.state.data.exams || []).length;
                    const hideMulti = examCount <= 1;
                    document.querySelectorAll('.analysis-tab[data-type="compare"], .analysis-tab[data-type="trend"]').forEach(tab => {
                        tab.style.display = hideMulti ? 'none' : '';
                    });
                    if (hideMulti && ['compare', 'trend'].includes(this.store.state.currentAnalysisType)) {
                        this.store.state.currentAnalysisType = 'overview';
                    }
                }

                refresh() {
                    const statStu = document.getElementById('stat-stu');
                    const statExam = document.getElementById('stat-exam');
                    const statScore = document.getElementById('stat-score');
                    if(statStu) statStu.innerText = this.store.state.data.students.length;
                    if(statExam) statExam.innerText = this.store.state.data.exams.length;
                    if(statScore) statScore.innerText = this.store.state.data.scores.length;
                    
                    this.initGlobalFilters();
                    this.updateAnalysisTabAvailability();

                    if(this.cur === 'students') this.renderStudents();
                    // Refresh details view when either the logical current view is 'details'
                    // or the details container is currently active/visible in the DOM.
                    try {
                        const vd = document.getElementById('view-details');
                        if (this.cur === 'details' || (vd && vd.classList.contains('active'))) {
                            try { this.renderDetailsView(); } catch(e) { console.warn('renderDetailsView error', e); }
                        }
                    } catch(e) {}
                    if(this.cur === 'exams') this.renderExamsWorkflow();
                    if(this.cur === 'analysis') {
                        this.initGlobalExamsDropdown(); // 修复：使用新的全局下拉框函数名
                        if (this.store.state.currentAnalysisType === 'compare') {
                            this.updateCompareExamsMultiSelect();
                        }
                    }
                    try { this.updateNavBadges(); } catch(e){}
                    try { this.updateGuideProgress(); } catch(e){}
                    try { this.syncStudentSearchAvailability(); } catch(e){}
                    try { this._installGlobalSearchButtons(); this._enhanceDialogs(); } catch(e){}
                }

                updateGuideProgress() {
                    const step = localStorage.getItem('gakuten_tour_step');
                    if (!step) return;
                    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
                    if ((this.store.state.data.students || []).length === 0) {
                        document.querySelector('.nav-item[onclick*="students"]')?.classList.add('tour-highlight');
                        return;
                    }
                    if ((this.store.state.data.exams || []).length === 0) {
                        localStorage.setItem('gakuten_tour_step', 'exams');
                        document.querySelector('.nav-item[onclick*="exams"]')?.classList.add('tour-highlight');
                        return;
                    }
                    if ((this.store.state.data.scores || []).length === 0) {
                        document.querySelector('#exam-search-student')?.classList.add('tour-highlight');
                        return;
                    }
                    localStorage.removeItem('gakuten_tour_step');
                }

                expandAllExamCards(expand = true) {
                    const container = document.getElementById('flat-exam-container');
                    if (!container) return;
                    container.querySelectorAll('details.exam-card').forEach(d => { try { d.open = !!expand; if (d.open) { const id = d.id.replace('e-card-',''); if (id) this.renderExamTables(id); } } catch(e){} });
                    this.updateToggleAllExamCardsBtnState();
                }

                toggleAllExamCards() {
                    const container = document.getElementById('flat-exam-container');
                    if (!container) return;
                    const detailsList = container.querySelectorAll('details.exam-card');
                    if (detailsList.length === 0) return;
                    
                    // 如果有任意一个卡片未展开，则此次操作为“全部展开”
                    const anyClosed = Array.from(detailsList).some(d => !d.open);
                    this.expandAllExamCards(anyClosed);
                }

                updateToggleAllExamCardsBtnState() {
                    const container = document.getElementById('flat-exam-container');
                    const btn = document.getElementById('toggle-all-exams-btn');
                    if (!container || !btn) return;
                    
                    const detailsList = container.querySelectorAll('details.exam-card');
                    if (detailsList.length === 0) {
                        btn.innerHTML = `${window.gk2IconMarkup('chevron-down')} 全部展开`;
                        return;
                    }
                    
                    // 如果有任意一个卡片未展开，按钮则提示“全部展开”，否则提示“全部折叠”
                    const anyClosed = Array.from(detailsList).some(d => !d.open);
                    if (anyClosed) {
                        btn.innerHTML = `${window.gk2IconMarkup('chevron-down')} 全部展开`;
                    } else {
                        btn.innerHTML = `${window.gk2IconMarkup('chevron-up')} 全部折叠`;
                    }
                }

                toggleSidebar(force) {
                    const sidebar = document.querySelector('.sidebar');
                    const backdrop = document.getElementById('sidebar-backdrop');
                    if (!sidebar) return;
                    const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('sidebar-open');
                    sidebar.classList.toggle('sidebar-open', open);
                    if (backdrop) backdrop.classList.toggle('visible', open);
                }

                closeSidebar() {
                    this.toggleSidebar(false);
                }

                _highlightScoreCross(input) {
                    const table = input && input.closest('table');
                    if (!table) return;
                    if (document.body.classList.contains('gk2-entry-keyboard-navigation')) {
                        this._clearScoreCross(table);
                        return;
                    }
                    table.querySelectorAll('.score-row-active').forEach(row => row.classList.remove('score-row-active'));
                    table.querySelectorAll('.score-col-active').forEach(cell => cell.classList.remove('score-col-active'));
                    const row = input.closest('tr');
                    const cell = input.closest('td');
                    if (!row || !cell) return;
                    row.classList.add('score-row-active');
                    Array.from(table.querySelectorAll('tr[data-gk2-entry-student]')).forEach(tr => {
                        const colCell = tr.children[cell.cellIndex];
                        if (colCell) colCell.classList.add('score-col-active');
                    });
                }

                _clearScoreCross(scope) {
                    const root = scope || document;
                    root.querySelectorAll('.score-row-active').forEach(row => row.classList.remove('score-row-active'));
                    root.querySelectorAll('.score-col-active').forEach(cell => cell.classList.remove('score-col-active'));
                }

                _focusNextScoreInput(input, step = 1) {
                    const wrapper = input && input.closest('[id^="e-tables-"]');
                    if (!wrapper) return;
                    const allInputs = Array.from(wrapper.querySelectorAll('tbody .score-input:not(:disabled)')).filter(input => input.getClientRects().length);
                    const idx = allInputs.indexOf(input);
                    const next = allInputs[idx + step];
                    if (next) {
                        next.focus();
                        next.select();
                    }
                }

                _openScoreMobilePad(input) {
                    if (!window.matchMedia || !window.matchMedia('(pointer: coarse), (max-width: 768px)').matches) return;
                    if (!input || !input.classList.contains('score-input')) return;
                    let pad = document.getElementById('score-mobile-pad');
                    if (!pad) {
                        pad = document.createElement('div');
                        pad.id = 'score-mobile-pad';
                        pad.className = 'score-mobile-pad';
                        pad.innerHTML = `<div class="score-mobile-display" id="score-mobile-display"></div><div class="score-mobile-keys">
                            ${['7','8','9','4','5','6','1','2','3','.','0','⌫'].map(k=>`<button type="button" class="secondary" data-key="${k}">${k === '⌫' ? window.gk2IconMarkup('backspace') : k}</button>`).join('')}
                            <button type="button" class="primary" data-action="done">完成</button>
                            <button type="button" class="secondary" data-action="close">收起</button>
                        </div>`;
                        document.body.appendChild(pad);
                        pad.addEventListener('click', e => {
                            const btn = e.target.closest('button');
                            const active = pad.__activeInput;
                            if (!btn || !active) return;
                            const key = btn.dataset.key;
                            const action = btn.dataset.action;
                            if (key) {
                                if (key === '⌫') active.value = active.value.slice(0, -1);
                                else if (key !== '.' || !active.value.includes('.')) active.value += key;
                                active.dispatchEvent(new Event('input', { bubbles: true }));
                            } else if (action === 'done') {
                                this._focusNextScoreInput(active, 1);
                            } else if (action === 'close') {
                                pad.classList.remove('open');
                                active.blur();
                            }
                            const display = document.getElementById('score-mobile-display');
                            if (display) display.textContent = active.value || '0';
                        });
                    }
                    pad.__activeInput = input;
                    const display = document.getElementById('score-mobile-display');
                    if (display) display.textContent = input.value || '0';
                    pad.classList.add('open');
                }

                _chartA11yColors() {
                    return {
                        blue: '#0071e3',
                        teal: '#007889',
                        amber: '#ffcc00',
                        vermillion: '#d70015',
                        sky: '#4aa3e5',
                        purple: '#8e44ad',
                        slate: '#6e6e73'
                    };
                }

                _radarAreaGradient(strong = 'rgba(0,113,227,0.42)', soft = 'rgba(74,163,229,0.08)') {
                    if (window.echarts && echarts.graphic && echarts.graphic.RadialGradient) {
                        return new echarts.graphic.RadialGradient(0.5, 0.5, 0.72, [
                            { offset: 0, color: strong },
                            { offset: 0.55, color: 'rgba(74,163,229,0.18)' },
                            { offset: 1, color: soft }
                        ]);
                    }
                    return strong;
                }

                _overviewLegend(data = [], extra = {}) {
                    const folded = window.matchMedia && window.matchMedia('(orientation: portrait), (pointer: coarse) and (max-width: 1024px)').matches;
                    return {
                        data,
                        type: data.length > 4 || folded ? 'scroll' : 'plain',
                        bottom: folded ? 0 : (Object.prototype.hasOwnProperty.call(extra, 'bottom') ? extra.bottom : 2),
                        left: folded ? 8 : (extra.left || 'center'),
                        right: folded ? 8 : extra.right,
                        orient: 'horizontal',
                        itemWidth: 10,
                        itemHeight: 10,
                        textStyle: { fontSize: folded ? 10 : 11, color: '#6c6c70', ...(extra.textStyle || {}) },
                        padding: folded ? [8, 8, 0, 8] : (extra.padding || [8, 0, 0, 0]),
                        ...extra
                    };
                }

                _resizeOverviewChartsSoon() {
                    const resizeAll = () => {
                        try { if (this.ovCharts) this.ovCharts.forEach(c => c && c.resize()); } catch(e) {}
                    };
                    requestAnimationFrame(resizeAll);
                    setTimeout(resizeAll, 120);
                }

                _bindOverviewResponsiveResize() {
                    if (this._overviewResponsiveBound) return;
                    this._overviewResponsiveBound = true;
                    const handler = () => this._resizeOverviewChartsSoon();
                    const queries = [
                        '(orientation: portrait)',
                        '(pointer: coarse) and (max-width: 1024px)',
                        '(min-width: 1441px)'
                    ];
                    queries.forEach(q => {
                        try {
                            const mq = window.matchMedia(q);
                            if (mq.addEventListener) mq.addEventListener('change', handler);
                            else if (mq.addListener) mq.addListener(handler);
                        } catch(e) {}
                    });
                }

                _bindOverviewSwipe() {
                    const board = document.getElementById('overview-dashboard-card');
                    if (!board || board.__swipeBound) return;
                    board.__swipeBound = true;
                    let startX = 0;
                    board.addEventListener('touchstart', e => { startX = e.touches && e.touches[0] ? e.touches[0].clientX : 0; }, { passive: true });
                    board.addEventListener('touchend', e => {
                        const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : startX;
                        const delta = endX - startX;
                        if (Math.abs(delta) < 50) return;
                        const cards = Array.from(board.querySelectorAll('[data-ov-card]'));
                        const firstVisible = cards.findIndex(card => card.getBoundingClientRect().top >= board.getBoundingClientRect().top - 20);
                        const nextIdx = Math.max(0, Math.min(cards.length - 1, (firstVisible < 0 ? 0 : firstVisible) + (delta < 0 ? 1 : -1)));
                        cards[nextIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }, { passive: true });
                }

                _setupMobileTopActionMenus() {
                    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
                    document.querySelectorAll('.top-actions').forEach(actions => {
                        if (actions.dataset.gk2RosterMoved === 'true') return;
                        let more = actions.querySelector('.mobile-top-more');
                        if (!more) {
                            more = document.createElement('div');
                            more.className = 'toolbar-more mobile-top-more';
                            more.innerHTML = `<button type="button" class="secondary btn--compact" onclick="this.parentElement.classList.toggle('open')">⋯</button><div class="toolbar-more-menu"></div>`;
                            actions.appendChild(more);
                        }
                        const menu = more.querySelector('.toolbar-more-menu');
                        const buttons = Array.from(actions.children).filter(el => el.tagName === 'BUTTON' && !el.classList.contains('mobile-keep'));
                        if (!isMobile) {
                            buttons.forEach(btn => btn.style.display = '');
                            more.style.display = 'none';
                            return;
                        }
                        more.style.display = buttons.length > 2 ? '' : 'none';
                        menu.innerHTML = '';
                        buttons.forEach((btn, idx) => {
                            const collapse = idx > 1 || /展开|折叠|导出/.test(btn.textContent || '');
                            btn.style.display = collapse ? 'none' : '';
                            if (collapse) {
                                const clone = btn.cloneNode(true);
                                clone.style.display = '';
                                menu.appendChild(clone);
                            }
                        });
                    });
                }

                scrollOverviewCard(key) {
                    const card = document.querySelector(`#overview-dashboard-card [data-ov-card="${key}"]`);
                    if (!card) return;
                    card.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                    document.querySelectorAll('#overview-dashboard-card .overview-mobile-nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.ovTarget === key));
                }

                _bindOverviewMobileNavObserver() {
                    const board = document.getElementById('overview-dashboard-card');
                    if (!board) return;
                    const buttons = Array.from(board.querySelectorAll('.overview-mobile-nav button[data-ov-target]'));
                    const cards = Array.from(board.querySelectorAll('[data-ov-card]'));
                    if (!buttons.length || !cards.length) return;
                    if (this._overviewMobileNavObserver) {
                        try { this._overviewMobileNavObserver.disconnect(); } catch(e) {}
                    }
                    const activate = (key) => buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.ovTarget === key));
                    activate(cards[0].dataset.ovCard);
                    if (!('IntersectionObserver' in window)) return;
                    this._overviewMobileNavObserver = new IntersectionObserver(entries => {
                        const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
                        if (visible && visible.target && visible.target.dataset.ovCard) activate(visible.target.dataset.ovCard);
                    }, { root: document.querySelector('#view-analysis .content-body') || null, threshold: [0.35, 0.55, 0.75] });
                    cards.forEach(card => this._overviewMobileNavObserver.observe(card));
                }

                initOverviewCardDrag() {
                    const board = document.getElementById('overview-dashboard-card');
                    if (!board || board.__dragBound) return;
                    board.__dragBound = true;
                    const applyOrder = () => {
                        const saved = JSON.parse(localStorage.getItem('gakuten_ov_card_order') || '[]');
                        saved.forEach(key => {
                            const card = board.querySelector(`[data-ov-card="${key}"]`);
                            if (card) board.appendChild(card);
                        });
                    };
                    applyOrder();
                    let dragging = null;
                    const placeholder = document.createElement('div');
                    placeholder.className = 'overview-drop-placeholder';
                    board.addEventListener('dragstart', e => {
                        dragging = e.target.closest('[data-ov-card]');
                        if (dragging) {
                            e.dataTransfer.effectAllowed = 'move';
                            dragging.classList.add('is-dragging');
                            setTimeout(() => dragging.after(placeholder), 0);
                        }
                    });
                    board.addEventListener('dragover', e => {
                        const over = e.target.closest('[data-ov-card]');
                        if (!dragging || !over || dragging === over) return;
                        e.preventDefault();
                        board.querySelectorAll('.drag-over').forEach(card => card.classList.remove('drag-over'));
                        over.classList.add('drag-over');
                        const cards = [...board.querySelectorAll('[data-ov-card]')];
                        if (cards.indexOf(dragging) < cards.indexOf(over)) over.after(placeholder);
                        else over.before(placeholder);
                    });
                    board.addEventListener('dragleave', e => {
                        const card = e.target.closest('[data-ov-card]');
                        if (card) card.classList.remove('drag-over');
                    });
                    board.addEventListener('drop', e => {
                        if (dragging) e.preventDefault();
                        if (dragging && placeholder.parentNode) placeholder.replaceWith(dragging);
                        if (dragging) {
                            dragging.classList.add('is-dropped');
                            setTimeout(() => dragging && dragging.classList.remove('is-dropped'), 380);
                        }
                        board.querySelectorAll('.drag-over').forEach(card => card.classList.remove('drag-over'));
                    });
                    board.addEventListener('dragend', () => {
                        if (dragging && placeholder.parentNode) placeholder.replaceWith(dragging);
                        if (dragging) dragging.classList.remove('is-dragging');
                        board.querySelectorAll('.drag-over').forEach(card => card.classList.remove('drag-over'));
                        localStorage.setItem('gakuten_ov_card_order', JSON.stringify([...board.querySelectorAll('[data-ov-card]')].map(c => c.dataset.ovCard)));
                        dragging = null;
                    });
                }

                startGuide() {
                    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
                    this.switchView('students');
                    const nav = document.querySelector('.nav-item[onclick*="students"]');
                    if (nav) nav.classList.add('tour-highlight');
                    Utils.msg('第 1 步：先在「学生名单管理」添加或导入学生名单');
                    localStorage.setItem('gakuten_tour_step', 'students');
                }

                switchView(vid, el) {
                    document.querySelectorAll('.tour-highlight').forEach(node => node.classList.remove('tour-highlight'));
                    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
                    document.querySelectorAll('.nav-item').forEach(n => {
                        n.classList.remove('active');
                        n.setAttribute('aria-selected', 'false');
                    });
                    document.querySelectorAll('.mobile-tab-bar button[data-view]').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.view === vid);
                    });
                    const viewEl = document.getElementById(`view-${vid}`);
                    if (viewEl) viewEl.classList.add('active');

                    if (el) {
                        el.classList.add('active');
                        el.setAttribute('aria-selected', 'true');
                    } else {
                        // 页面刷新或无元素传入时，依据 nav-item 的 onclick 属性手动激活对应项
                        document.querySelectorAll('.nav-item').forEach(n => {
                            const oc = n.getAttribute('onclick') || '';
                            if (oc && oc.indexOf('switchView') !== -1 && oc.indexOf(vid) !== -1) {
                                n.classList.add('active');
                                n.setAttribute('aria-selected', 'true');
                            }
                        });
                    }
                    this.closeSidebar();

	                    this.cur = vid;
	                    try { this.store.state.currentView = vid; } catch(e) {}
	                    if (this.pendingRemoteRefresh) {
	                        this.pendingRemoteRefresh = false;
	                        this._remoteRefreshNoticeShown = false;
	                    }
	                    if (typeof this.store.silentSave === 'function') {
                        try { this.store.silentSave(); } catch(e) {}
                    }

                    this.store.updateSaveIndicator();
                    this.store.updateUndoButton();
                    this.refresh();


                }

                _buildMultiSelect(panelId, headerId, options, callbackStr, placeholder = '请选择...', defaultAll = false, storedValues = null, isSidebar = false, isExamSelect = false, singleSelect = false) {
                    const panel = document.getElementById(panelId);
                    if(!panel) return;
                    
                    const isFirstTime = panel.innerHTML === '';
                    let oldChecked = [];
                    if (storedValues && storedValues.length > 0) {
                        oldChecked = singleSelect ? storedValues.slice(0, 1) : storedValues;
                    } else if (!isFirstTime) {
                        oldChecked = Array.from(panel.querySelectorAll('input:checked')).map(cb => cb.value);
                        if (singleSelect) oldChecked = oldChecked.slice(0, 1);
                    }
                    
                    const currentOptionsNodes = Array.from(panel.querySelectorAll('.ms-item input'));
                    const currentOptions = isExamSelect ? currentOptionsNodes.map(input => input.value) : currentOptionsNodes.map(input => input.value.replace(/&quot;/g, '"'));
                    
                    const optionsValues = isExamSelect ? options.map(o=>o.id) : options;
                    const singleSelectChanged = panel.dataset.singleSelect !== String(!!singleSelect);
                    const optionsChanged = JSON.stringify(currentOptions) !== JSON.stringify(optionsValues) || singleSelectChanged;

                    if (optionsChanged || isFirstTime) {
                        // 选项内容发生变化时，使用 fragment 逐项更新而非整体替换 innerHTML，
                        // 避免 DOM 重建导致的鼠标事件丢失
                        const fragment = document.createDocumentFragment();
                        options.forEach(opt => {
                            let val, label;
                            if (isExamSelect) {
                                val = opt.id;
                                label = opt.label;
                            } else {
                                val = String(opt).replace(/"/g, '&quot;');
                                label = opt;
                            }
                            const isChecked = oldChecked.includes(val) || ((isFirstTime || (!storedValues || storedValues.length===0)) && defaultAll);
                            const labelEl = document.createElement('label');
                            labelEl.className = 'ms-item';
                            const cb = document.createElement('input');
                            cb.type = 'checkbox';
                            cb.value = val;
                            cb.checked = isChecked;
                            cb.addEventListener('change', () => {
                                if (singleSelect && cb.checked) {
                                    panel.querySelectorAll('input[type="checkbox"]').forEach(other => {
                                        if (other !== cb) other.checked = false;
                                    });
                                }
                                window.gk2.dispatchFilterCallback(callbackStr);
                                window.app.ui._updateMsHeader(panelId, headerId, placeholder, isExamSelect);
                            });
                            labelEl.appendChild(cb);
                            labelEl.appendChild(document.createTextNode(' ' + label));
                            fragment.appendChild(labelEl);
                        });
                        panel.innerHTML = '';
                        if (options.length === 0) {
                            panel.innerHTML = `<div style="padding: 15px; color:var(--text-faint); font-size:12px; text-align:center;">暂无选项</div>`;
                        } else {
                            panel.appendChild(fragment);
                        }
                        panel.dataset.singleSelect = String(!!singleSelect);
                    } else {
                        panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            let valToMatch = isExamSelect ? cb.value : cb.value.replace(/&quot;/g, '"');
                            cb.checked = oldChecked.includes(valToMatch) || ((isFirstTime || (!storedValues || storedValues.length===0)) && defaultAll);
                        });
                        if (singleSelect) {
                            const checked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'));
                            checked.slice(1).forEach(cb => { cb.checked = false; });
                        }
                    }
                    this._updateMsHeader(panelId, headerId, placeholder, isExamSelect);
                }

                _updateMsHeader(panelId, headerId, placeholder = '请选择...', isExamSelect = false) {
                    const checked = Array.from(document.querySelectorAll(`#${panelId} input:checked`));
                    const total = document.querySelectorAll(`#${panelId} input`).length;
                    const header = document.getElementById(headerId);
                    if(!header) return;
                    const count = header.dataset.matchCount;
                    const badge = count !== undefined && count !== '' ? `<span class="ms-count-badge">${count}人</span>` : '';
                    
                    if (total === 0 || checked.length === 0) { 
                        header.innerHTML = `<span>${Utils.escapeHTML(placeholder)}</span>${badge}`; 
                        header.style.color = 'var(--text-faint)'; 
                    } else if (isExamSelect) {
                        header.innerHTML = `<span>已选 ${checked.length} 场考试</span>${badge}`; 
                        header.style.color = 'var(--score-fail)';
                    } else { 
                        const names = checked.map(cb => cb.value.replace(/&quot;/g, '"'));
                        let text = '';
                        if (names.length > 2 && checked.length !== total) {
                            text = `${names[0]}, ${names[1]} 等${names.length}项`;
                        } else if (checked.length === total && total > 2) {
                            text = `已全选 (${total}项)`;
                        } else {
                            text = names.join(', ');
                        }
                        header.innerHTML = `<span>${Utils.escapeHTML(text)}</span>${badge}`;
                        header.style.color = 'var(--primary)'; 
                    }
                }

                _countStudentsForFilter(partial = {}) {
                    const focus = { ...(this.store.state.globalFocus || {}), ...partial };
                    return (this.store.state.data.students || []).filter(s => {
                        if (focus.campuses && focus.campuses.length && !focus.campuses.includes(s.campus)) return false;
                        if (focus.grades && focus.grades.length && !focus.grades.includes(s.grade)) return false;
                        if (focus.tClasses && focus.tClasses.length && !focus.tClasses.includes(s.teachingClass)) return false;
                        if (focus.tags && focus.tags.length && !(s.tags || []).some(t => focus.tags.includes(t))) return false;
                        return true;
                    }).length;
                }

                _studentMatchesFocusForExam(student, exam = null, focus = this.store.state.globalFocus || {}) {
                    if (!Utils.canReadStudent(student, exam) || (!exam && student.rosterMembership?.archivedAt != null)) return false;
                    const classAtExam = exam ? Utils.getClassForExam(student, exam) : { campus: student.campus, teachingClass: student.teachingClass };
                    const campusAtExam = classAtExam.campus || student.campus || '';
                    const teachingClassAtExam = classAtExam.teachingClass || student.teachingClass || '';
                    const currentTeachingClass = student.teachingClass || '';

                    if (focus.campuses && focus.campuses.length > 0 && !focus.campuses.includes(campusAtExam)) return false;
                    if (focus.grades && focus.grades.length > 0 && !focus.grades.includes(student.grade)) return false;
                    if (focus.phases && focus.phases.length > 0) {
                        const phase = Utils.calculatePhase(student.grade, exam ? (exam.date || new Date().toISOString()) : new Date().toISOString());
                        if (!focus.phases.includes(phase)) return false;
                    }
                    if (focus.tClasses && focus.tClasses.length > 0) {
                        if (!focus.tClasses.includes(teachingClassAtExam)) return false;
                    }
                    if (focus.tags && focus.tags.length > 0 && !(student.tags || []).some(t => focus.tags.includes(t))) return false;
                    return true;
                }

                _decorateSidebarFilterFeedback() {
                    const isCompareMode = this.store && this.store.state && this.store.state.currentAnalysisType === 'compare';
                    const configs = [
                        ['sb-cam-panel', 'sb-cam-head', 'campuses', '查看全校区'],
                        ['sb-grd-panel', 'sb-grd-head', 'grades', isCompareMode ? '查看全年级（可多选）' : '查看全年级'],
                        ['sb-pha-panel', 'sb-pha-head', 'phases', '查看全学段'],
                        ['sb-cls-panel', 'sb-cls-head', 'tClasses', '查看全班级'],
                        ['sb-tags-panel', 'sb-tags-head', 'tags', '查看所有标签']
                    ];
                    configs.forEach(([panelId, headerId, key, placeholder]) => {
                        const header = document.getElementById(headerId);
                        const panel = document.getElementById(panelId);
                        if (!header || !panel) return;
                        header.dataset.matchCount = this._countStudentsForFilter({ [key]: this.store.state.globalFocus[key] || [] });
                        this._updateMsHeader(panelId, headerId, placeholder, false);
                        const oldClearRow = panel.previousElementSibling && panel.previousElementSibling.classList?.contains('ms-clear-row') ? panel.previousElementSibling : null;
                        if (oldClearRow) oldClearRow.remove();
                    });
                }

                _getSelectedClasses(panelId) {
                    const panel = document.getElementById(panelId);
                    if(!panel) return [];
                    return Array.from(panel.querySelectorAll(`input:checked`)).map(cb => cb.value.replace(/&quot;/g, '"'));
                }

                initGlobalFilters() {
                    const focus = this.store.state.globalFocus;
                    const students = this.store.state.data.students;
                    const exams = this.store.state.data.exams;
                    const auth = window.__gakutenAuth && typeof window.__gakutenAuth.getAuth === 'function' ? window.__gakutenAuth.getAuth() : null;

                    if (auth && auth.mode === 'teacher') {
                        focus.campuses = [auth.campus];
                        focus.grades = [auth.grade];
                        focus.tClasses = [auth.classId];
                    }

                    if (auth && auth.mode === 'admin') {
                        // 用 sessionStorage 标记是否真正是首次加载（页面刷新后重置）
                        // 教务主动点击清空后不再自动回填，避免清空按钮失效
                        const SESSION_KEY = 'gakuten_admin_inited';
                        const isFirstLoad = !sessionStorage.getItem(SESSION_KEY) &&
                                            !sessionStorage.getItem('gakuten_admin_user_cleared') &&
                                            (!focus.campuses || focus.campuses.length === 0) &&
                                            (!focus.grades || focus.grades.length === 0) &&
                                            (!focus.tClasses || focus.tClasses.length === 0);
                        if (isFirstLoad) {
                            sessionStorage.setItem(SESSION_KEY, '1');
                            const latestExam = this.store.state.data.exams
                                .filter(e => e.date)
                                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
                            if (latestExam) {
                                if (latestExam.grade) focus.grades = [latestExam.grade];
                                const examCamps = this._getExamCampuses(latestExam);
                                if (examCamps.length > 0) focus.campuses = examCamps;
                            }
                        }
                    }

                    // 1. Campus
                    const allCampuses = [...new Set(students.map(s => s.campus).filter(Boolean))].sort();
                    focus.campuses = (focus.campuses || []).filter(c => allCampuses.includes(c)).slice(0, 1); // 清理幽灵校区并兼容旧的多校区筛选状态
                    if (auth && auth.mode === 'teacher' && focus.campuses.length === 0 && allCampuses.length > 0) {
                        const normalize = s => String(s || '').trim().replace(/\s/g, '').toLowerCase();
                        const matched = allCampuses.find(c => normalize(c) === normalize(auth.campus));
                        if (matched) {
                            focus.campuses = [matched];
                            auth.campus = matched;
                        }
                    }
                    this._buildMultiSelect('sb-cam-panel', 'sb-cam-head', allCampuses, "window.app.ui.onGlobalFilterChange('campuses')", '查看全校区', false, focus.campuses, true, false, true);

                    // 2. Grade
                    const selectedCampuses = focus.campuses || [];
                    let poolGrd = selectedCampuses.length > 0 ? students.filter(s => selectedCampuses.includes(s.campus)) : students;
                    const availableGrades = [...new Set(poolGrd.map(s => s.grade).filter(Boolean))].sort();
                    focus.grades = (focus.grades || []).filter(g => availableGrades.includes(g)); // 清理幽灵年级
                    const isCompareMode = this.store && this.store.state && this.store.state.currentAnalysisType === 'compare';
                    if (!isCompareMode) focus.grades = focus.grades.slice(0, 1); // 非对比模式仍保持单选，可取消选择
                    this._buildMultiSelect('sb-grd-panel', 'sb-grd-head', availableGrades, "window.app.ui.onGlobalFilterChange('grades')", isCompareMode ? '查看全年级（可多选）' : '查看全年级', false, focus.grades, true, false, !isCompareMode);

                    // 3. Phase
                    const selectedGrades = focus.grades || [];
                    let poolPha = selectedGrades.length > 0 ? poolGrd.filter(s => selectedGrades.includes(s.grade)) : poolGrd;
                    
                    const phasesSet = new Set();
                    const currentDateStr = new Date().toISOString();
                    const activeGrades = selectedGrades.length > 0 ? selectedGrades : availableGrades;
                    const activeCampuses = selectedCampuses.length > 0 ? selectedCampuses : allCampuses;
                    
                    activeGrades.forEach(g => {
                        const p = Utils.calculatePhase(g, currentDateStr);
                        if (!p.includes('未知')) phasesSet.add(p);
                    });
                    exams.forEach(e => {
                        const examCampuses = this._getExamCampuses(e);
                        if (activeGrades.includes(e.grade) && (examCampuses.length === 0 || activeCampuses.some(c => examCampuses.includes(c)))) {
                            const p = Utils.calculatePhase(e.grade, e.date);
                            if (!p.includes('未知')) phasesSet.add(p);
                        }
                    });
                    const availablePhases = [...phasesSet].sort(Utils.sortPhaseStrict);
                    focus.phases = (focus.phases || []).filter(p => availablePhases.includes(p)); // 清理幽灵学段
                    this._buildMultiSelect('sb-pha-panel', 'sb-pha-head', availablePhases, "window.app.ui.onGlobalFilterChange('phases')", '查看全学段', false, focus.phases, true);

                    // 4. Class
                    const availableClassesBase = [...new Set(poolPha.map(s => s.teachingClass).filter(Boolean))];
                    const preservedClasses = (focus.tClasses || []).filter(Boolean);
                    if (auth && auth.mode === 'teacher' && auth.classId) preservedClasses.push(auth.classId);
                    const availableClasses = [...new Set(availableClassesBase.concat(preservedClasses))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
                    focus.tClasses = (focus.tClasses || []).filter(Boolean); // 保留已选班级，避免云同步或上级筛选短暂不完整时从界面消失
                    this._buildMultiSelect('sb-cls-panel', 'sb-cls-head', availableClasses, "window.app.ui.onGlobalFilterChange('tClasses')", '查看全班级', false, focus.tClasses, true);

                    // 5. Tags
                    const selectedClasses = focus.tClasses || [];
                    const poolTags = selectedClasses.length > 0 ? poolPha.filter(s => selectedClasses.includes(s.teachingClass)) : poolPha;
                    const allTags = [...new Set(poolTags.flatMap(s => (s.tags||[])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
                    focus.tags = (focus.tags || []).filter(t => allTags.includes(t)); // 清理幽灵标签
                    this._buildMultiSelect('sb-tags-panel', 'sb-tags-head', allTags, "window.app.ui.onGlobalFilterChange('tags')", '查看所有标签', false, focus.tags, true);
                    this._decorateSidebarFilterFeedback();

                    // 如果发生了自愈清理，静默同步底层存储
                    try { this.store.silentSave(); } catch(e) {}

                    this.applyAuthAccessControl(auth);
                }

                applyAuthAccessControl(auth = null) {
                    const currentAuth = auth || (window.__gakutenAuth && typeof window.__gakutenAuth.getAuth === 'function' ? window.__gakutenAuth.getAuth() : null);
                    const camPanel = document.getElementById('sb-cam-panel');
                    const grdPanel = document.getElementById('sb-grd-panel');
                    const clsPanel = document.getElementById('sb-cls-panel');
                    const camHeader = document.getElementById('sb-cam-head');
                    const grdHeader = document.getElementById('sb-grd-head');

                    const setPanelLockState = (panel, header, locked) => {
                        if (header) {
                            header.style.pointerEvents = locked ? 'none' : '';
                            header.style.opacity = locked ? '0.68' : '';
                            header.style.cursor = locked ? 'not-allowed' : '';
                        }
                        if (!panel) return;
                        panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            cb.disabled = !!locked;
                        });
                    };

                    if (!currentAuth) {
                        setPanelLockState(camPanel, camHeader, false);
                        setPanelLockState(grdPanel, grdHeader, false);
                        if (clsPanel) {
                            clsPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = false);
                        }
                        const note = document.getElementById('auth-lock-note');
                        if (note) note.style.display = 'none';
                        return;
                    }

                    if (currentAuth.mode === 'admin') {
                        setPanelLockState(camPanel, camHeader, false);
                        setPanelLockState(grdPanel, grdHeader, false);
                        if (clsPanel) {
                            clsPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = false);
                        }
                        const note = document.getElementById('auth-lock-note');
                        if (note) note.style.display = 'none';
                        return;
                    }

                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    focus.campuses = [currentAuth.campus];
                    focus.grades = [currentAuth.grade];

                    const classValues = clsPanel ? Array.from(clsPanel.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value.replace(/&quot;/g, '"')) : [];
                    const normalize = s => String(s || '').trim().replace(/\s/g, '').toLowerCase();
                    const matchedClass = classValues.find(v => normalize(v) === normalize(currentAuth.classId));
                    const forcedClass = matchedClass || currentAuth.classId;
                    focus.tClasses = [forcedClass];
                    this.store.state.globalFocus = focus;
                    this.store.state.filters = { campuses: [currentAuth.campus], grades: [currentAuth.grade], phases: [], tClasses: [forcedClass], tags: [] };

                    setPanelLockState(camPanel, camHeader, true);
                    setPanelLockState(grdPanel, grdHeader, true);
                    if (camPanel) {
                        camPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            cb.checked = cb.value.replace(/&quot;/g, '"') === currentAuth.campus;
                        });
                        this._updateMsHeader('sb-cam-panel', 'sb-cam-head', '查看全校区', false);
                    }
                    if (grdPanel) {
                        grdPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            cb.checked = cb.value.replace(/&quot;/g, '"') === currentAuth.grade;
                        });
                        this._updateMsHeader('sb-grd-panel', 'sb-grd-head', '查看全年级', false);
                    }
                    if (clsPanel) {
                        clsPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            cb.disabled = false;
                            cb.checked = focus.tClasses.includes(cb.value.replace(/&quot;/g, '"'));
                        });
                        this._updateMsHeader('sb-cls-panel', 'sb-cls-head', '查看全班级', false);
                    }

                    try { this.store.silentSave(); } catch(e) {}
                    const note = document.getElementById('auth-lock-note');
                    if (note) note.style.display = currentAuth && currentAuth.mode === 'teacher' ? 'block' : 'none';
                }

                _readSidebarFocusFromDom(changedKey = '') {
                    const isCompareMode = this.store && this.store.state && this.store.state.currentAnalysisType === 'compare';
                    const next = {
                        campuses: this._getSelectedClasses('sb-cam-panel'),
                        grades: isCompareMode ? this._getSelectedClasses('sb-grd-panel') : this._getSelectedClasses('sb-grd-panel').slice(0, 1),
                        phases: this._getSelectedClasses('sb-pha-panel'),
                        tClasses: this._getSelectedClasses('sb-cls-panel'),
                        tags: this._getSelectedClasses('sb-tags-panel')
                    };
                    if (changedKey === 'campuses') {
                        next.grades = [];
                        next.phases = [];
                        next.tClasses = [];
                        next.tags = [];
                    } else if (changedKey === 'grades') {
                        next.phases = [];
                        next.tClasses = [];
                        next.tags = [];
                    } else if (changedKey === 'phases') {
                        next.tClasses = [];
                        next.tags = [];
                    } else if (changedKey === 'tClasses') {
                        next.tags = [];
                    }
                    return next;
                }

                onGlobalFilterChange(changedKey = '') {
    this.store.state.globalFocus = this._readSidebarFocusFromDom(changedKey);
    const _authGuard = window.__gakutenAuth && typeof window.__gakutenAuth.getAuth === 'function'
        ? window.__gakutenAuth.getAuth() : null;
    if (_authGuard && _authGuard.mode === 'teacher') {
        this.store.state.globalFocus.campuses = [_authGuard.campus];
        this.store.state.globalFocus.grades = [_authGuard.grade];
    }
    this.store.save();
    
    this.initGlobalFilters();
    try { this.updateNavBadges(); } catch(e) {}
    
    if(this.cur === 'exams') this.renderExamsWorkflow();
    // 修复：无论在分析视图还是详情视图，只要全局下拉框存在，就必须同步刷新它
    if(this.cur === 'analysis' || this.cur === 'details') {
        this.initGlobalExamsDropdown(true, this.cur !== 'analysis');
    }
    if(this.cur === 'analysis') {
        this.updateAnalysisMultiSelect();
        if (this.store.state.currentAnalysisType === 'compare') {
            this.updateCompareExamsMultiSelect();
        }
        if (this._gk2FilterAnalysisFrame) cancelAnimationFrame(this._gk2FilterAnalysisFrame);
        this._gk2FilterAnalysisFrame = requestAnimationFrame(() => {
            this._gk2FilterAnalysisFrame = 0;
            if (this.cur !== 'analysis') return;
            this.runAnalysis();
            if (this.store.state.currentAnalysisType === 'overview') {
                requestAnimationFrame(() => {
                    if (window.resizeAllCharts) window.resizeAllCharts();
                });
            }
        });
    }
    if(this.cur === 'students') this.renderStudents();
    
    // 新增：实时响应学生成绩详情的过滤器更新
    if(this.cur === 'details') {
        this.renderDetailsView();
    }
}

                resetGlobalFocus() {
                    // 清除首次加载标记，但同时写入"用户主动清空"标记，防止 initGlobalFilters 自动回填
                    sessionStorage.removeItem('gakuten_admin_inited');
                    sessionStorage.setItem('gakuten_admin_user_cleared', '1');
                    this.store.state.globalFocus = { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    this.store.save();
                    this.initGlobalFilters(); 
                    this.refresh();
                    Utils.msg("已重置条件，显示全校数据");
                }

                renderStudents() {
                    const container = document.getElementById('tree-container-students');
                    if (!container.dataset.gk2RosterActionsBound) {
                        container.dataset.gk2RosterActionsBound = 'true';
                        container.addEventListener('click', event => {
                            const editGroup = event.target.closest('[data-student-group-edit]');
                            if (editGroup && container.contains(editGroup)) {
                                event.preventDefault();
                                event.stopPropagation();
                                this.editStudentGroup(editGroup.dataset.kind, editGroup.dataset.value, editGroup.dataset.campus || '', editGroup.dataset.grade || '');
                                return;
                            }
                            const action = event.target.closest('[data-roster-bulk-action]');
                            if (!action || !container.contains(action)) return;
                            event.preventDefault();
                            if (action.dataset.rosterBulkAction === 'delete') this.bulkDeleteStudents();
                            if (action.dataset.rosterBulkAction === 'edit') this.openBulkEditStudents();
                        });
                    }
                    const openStates = new Set();
                    document.querySelectorAll('#tree-container-students details.tree-level[open]').forEach(el => openStates.add(el.id));

                    const focus = this.store.state.globalFocus;

                    const tree = {};
                    this.store.state.data.students.forEach(s => {
                        if (s.rosterMembership?.archivedAt != null) return;
                        const cam = (s.campus || '').trim();
                        const grd = (s.grade || '').trim();
                        if (!cam) return;
                        const tCls = (s.teachingClass || '未分日语班').trim();

                        if (focus.campuses.length > 0 && !focus.campuses.includes(cam)) return;
                        if (focus.grades.length > 0 && !focus.grades.includes(grd)) return;
                        if (focus.tClasses.length > 0 && !focus.tClasses.includes(tCls)) return;

                        if(!tree[cam]) tree[cam] = {};
                        if(!tree[cam][grd]) tree[cam][grd] = {};
                        if(!tree[cam][grd][tCls]) tree[cam][grd][tCls] = [];
                        tree[cam][grd][tCls].push(s);
                    });

                    let html = '';
                    for (const cam in tree) {
                        const idCam = `stree-${cam}`;
                        const safeCampusLabel = Utils.escapeHTML(cam);
                        const groupEditButton = (kind, value, campus = '', grade = '') => `<button type="button" class="student-group-edit" data-student-group-edit data-kind="${kind}" data-value="${Utils.escapeHTML(value)}" data-campus="${Utils.escapeHTML(campus)}" data-grade="${Utils.escapeHTML(grade)}" aria-label="编辑${kind === 'campus' ? '校区' : kind === 'grade' ? '年级' : '班级'}名称" title="编辑名称"><svg class="gk2-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m14.5 6.5 3 3M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/><path d="M13 20h7"/></svg></button>`;
                        html += `<details class="tree-level" id="${idCam}"><summary class="tree-summary lv-1">${window.gk2IconMarkup('building')} <span>校区：${safeCampusLabel}</span></summary>${groupEditButton('campus', cam)}<div class="tree-content">`;
                        for (const grd in tree[cam]) {
                            const idGrd = `stree-${cam}-${grd}`;
                            const safeGradeLabel = Utils.escapeHTML(grd);
                            html += `<details class="tree-level" id="${idGrd}"><summary class="tree-summary lv-2">${window.gk2IconMarkup('calendar')} <span>年级：${safeGradeLabel}</span></summary>${groupEditButton('grade', grd, cam)}<div class="tree-content">`;
                            for (const tCls in tree[cam][grd]) {
                                const students = tree[cam][grd][tCls];
                                const idCls = `stree-${cam}-${grd}-${tCls}`;
                                const safeClassLabel = Utils.escapeHTML(tCls);
                                html += `<details class="tree-level" id="${idCls}"><summary class="tree-summary lv-3">${window.gk2IconMarkup('school')} <span>班级：${safeClassLabel}</span> <span class="auto-calc-badge">共 ${students.length} 人</span></summary>${groupEditButton('teachingClass', tCls, cam, grd)}`;
                                
                                const wrapId = `table-wrap-${idCls}`;
                                html += `<div class="tree-table-wrapper" id="${wrapId}"><table>
                                    <thead><tr>
                                        <th class="header-sticky-50"><input type="checkbox" class="select-all-checkbox" onchange="window.app.ui.toggleAllStudents(this, '${wrapId}')" title="全选"></th>
                                        <th>学生姓名</th><th>所在校区</th><th>所属年级</th><th>任教班级</th><th>原行政班</th><th>标签</th><th class="student-roster-actions-heading"><span class="student-roster-bulk-actions"><button type="button" class="student-roster-bulk-icon is-bulk-edit gk2-quick-hint" data-roster-bulk-action="edit" aria-label="批量编辑选中学生"><svg class="gk2-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m14.5 6.5 3 3M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/><path d="M13 20h7"/></svg><span class="gk2-quick-tooltip" role="tooltip">批量编辑选中学生</span></button><button type="button" class="student-roster-bulk-icon is-bulk-delete gk2-quick-hint" data-roster-bulk-action="delete" aria-label="删除选中学生"><svg class="gk2-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18 M8 6V4h8v2 M19 6l-1 15H6L5 6 M10 11v6 M14 11v6"/></svg><span class="gk2-quick-tooltip" role="tooltip">删除勾选学生</span></button></span></th>
                                    </tr></thead>
                                    <tbody>`;
                                
                                // V41.0 & V43.0: Array accumulate to prevent reflow
                                const rowHtmlArr = [];
                                students.sort((a,b) => {
                                    const classA = String(a.adminClass || '').trim();
                                    const classB = String(b.adminClass || '').trim();
                                    const cmp = classA.localeCompare(classB, 'zh-CN', {numeric: true});
                                    if (cmp !== 0) return cmp;
                                    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
                                }).forEach(s => {
                                    const safeName = String(s.name || '').replace(/"/g, '&quot;');
                                    const safeCampus = String(s.campus || '').replace(/"/g, '&quot;');
                                    const safeGrade = String(s.grade || '').replace(/"/g, '&quot;');
                                    const safeClass = String(s.teachingClass || '').replace(/"/g, '&quot;');
                                    const safeAdmin = String(s.adminClass || '').replace(/"/g, '&quot;');
                                    const transferMark = Utils.hasTransferred(s) ? `<span class="pill" style="font-size:10px; background:#fff2d4; color:#92400e; margin-left:4px;" title="班级变更记录：${Utils.escapeHTML(Utils.getTransferSummary(s))}">${window.gk2IconMarkup('swap')} 有换班记录</span>` : '';

                                    rowHtmlArr.push(`<tr>
                                        <td><input type="checkbox" class="stu-checkbox" value="${s.id}"></td>
                                        <td><input class="student-input" value="${safeName}" onchange="window.app.ui.updStu('${s.id}','name',this.value)"> <a href="#" class="table-link--student" onclick="window.app.ui.openStudentDashboardModal('${s.id}')">${window.gk2IconMarkup('chart')} 看档案</a></td>
                                        <td><input class="student-input" value="${safeCampus}" onchange="window.app.ui.updStu('${s.id}','campus',this.value)"></td>
                                        <td><input class="student-input" value="${safeGrade}" placeholder="如:2024级" onchange="window.app.ui.updStu('${s.id}','grade',this.value)"></td>
                                        <td><input class="student-input" value="${safeClass}" onchange="window.app.ui.updStu('${s.id}','teachingClass',this.value)">${transferMark}</td>
                                        <td><input class="student-input" value="${safeAdmin}" onchange="window.app.ui.updStu('${s.id}','adminClass',this.value)"></td>
                                        <td class="cell-min-120">
                                            <span id="stu-tags-${s.id}" class="table-side-note">${(s.tags||[]).map(t=>`<span class='tag-chip'>${Utils.escapeHTML(t)}</span>`).join('')}</span>
                                            <button class="secondary btn--inline-sm" onclick="window.app.ui.editStudentTags('${s.id}')">${window.gk2IconMarkup('tag')}</button>
                                        </td>
                                        <td><button class="secondary btn--danger-outline" onclick="window.app.ui.delStu('${s.id}')">删除</button></td>
                                    </tr>`);
                                });
                                html += rowHtmlArr.join('') + `</tbody></table></div></details>`;
                            }
                            html += `</div></details>`;
                        }
                        html += `</div></details>`;
                    }

                    if (Object.keys(tree).length === 0) {
                        html = Utils.getEmptyStateHTML('暂无学生数据', '请点击右上角的按钮添加学生，或者检查左侧的条件是否设置正确。', 'clipboard');
                    }
                    container.innerHTML = html;
                    openStates.forEach(id => { const el = document.getElementById(id); if(el) el.open = true; });
                    this._layoutStudentGroupEditButtons();
                    if ('ResizeObserver' in window) {
                        this._studentGroupEditResizeObserver ||= new ResizeObserver(() => this._layoutStudentGroupEditButtons());
                        this._studentGroupEditResizeObserver.disconnect();
                        container.querySelectorAll('details.tree-level').forEach(el => this._studentGroupEditResizeObserver.observe(el));
                    } else if (!this._studentGroupEditResizeBound) {
                        this._studentGroupEditResizeBound = true;
                        window.addEventListener('resize', () => this._layoutStudentGroupEditButtons(), { passive: true });
                    }
                }

                _layoutStudentGroupEditButtons() {
                    const container = document.getElementById('tree-container-students');
                    if (!container) return;
                    const compact = window.matchMedia('(max-width: 700px)').matches;
                    const buttonSize = compact ? 24 : 28;
                    const safeRight = compact ? 50 : 64;
                    container.querySelectorAll('details.tree-level').forEach(details => {
                        const summary = details.querySelector(':scope > summary.tree-summary');
                        const button = details.querySelector(':scope > .student-group-edit');
                        if (!summary || !button) return;
                        const title = summary.querySelector(':scope > span:not(.auto-calc-badge)');
                        const badge = summary.querySelector(':scope > .auto-calc-badge');
                        const anchor = badge && badge.getClientRects().length ? badge : title;
                        const detailsRect = details.getBoundingClientRect();
                        const summaryRect = summary.getBoundingClientRect();
                        const anchorRect = anchor ? anchor.getBoundingClientRect() : summaryRect;
                        if (details.clientWidth <= 0 || summaryRect.height <= 0) return;
                        const left = Math.max(0, Math.min(
                            anchorRect.right - detailsRect.left - details.clientLeft + 6,
                            details.clientWidth - buttonSize - safeRight
                        ));
                        const top = Math.max(0, summaryRect.top - detailsRect.top - details.clientTop + (summaryRect.height - buttonSize) / 2);
                        button.style.left = `${left}px`;
                        button.style.top = `${top}px`;
                    });
                }

                updStu(id, f, v) {
                    const s = this.store.state.data.students.find(i=>i.id===id);
                    if(!s) return;
                    const newVal = (v || '').trim();

                    if (f === 'teachingClass' || f === 'campus') {
                        const oldCampus = s.campus;
                        const oldClass = s.teachingClass;

                        s[f] = newVal;
                        s._ts = Date.now();

                        const newCampus = s.campus;
                        const newClass = s.teachingClass;

                        if (newCampus !== oldCampus || newClass !== oldClass) {
                            if (!Array.isArray(s.classHistory) || s.classHistory.length === 0) {
                                s.classHistory = [{ campus: oldCampus, teachingClass: oldClass, from: '2000-01-01', to: null }];
                            }
                            const today = new Date().toISOString().slice(0, 10);
                            const last = s.classHistory[s.classHistory.length - 1];
                            if (last.from === today) {
                                last.campus = newCampus;
                                last.teachingClass = newClass;
                            } else {
                                const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                                last.to = yesterday;
                                s.classHistory.push({ campus: newCampus, teachingClass: newClass, from: today, to: null });
                            }
                        }
                    } else {
                        s[f] = newVal;
                        s._ts = Date.now();
                    }
                    this.store.markAsUnsaved();
                }
                
                _archiveRosterStudents(ids) {
                    this.store.pushSnapshot();
                    const ts = Date.now(), selected = new Set(ids);
                    this.store.state.data.students.filter(s => selected.has(s.id)).forEach(student => {
                        if (student.rosterMembership?.archivedAt != null) return;
                        student.rosterMembership = {
                            version: 1, archivedAt: ts,
                            includedExamIds: this.store.state.data.exams.filter(exam => Utils.isStudentInExam(student, exam)).map(exam => exam.id),
                            excludedExamIds: student.rosterMembership?.excludedExamIds || []
                        };
                        student._ts = ts;
                    });
                    this.store.save();
                    this.refresh();
                }

                delStu(id) {
                    const stu = this.store.state.data.students.find(i=>i.id===id);
                    if(!stu || stu.rosterMembership?.archivedAt != null) return;
                    this.showConfirmDialog(
                        `将学生【${stu.name}】移出当前名单。已有考试名单和历史成绩全部保留，班级均分等统计不变；以后新建的考试不再包含该生。再次添加相同校区、年级、班级和姓名时，可选择恢复原学生。`,
                        () => {
                            this._archiveRosterStudents([id]);
                            Utils.msg('已移出名单，历史成绩已保留', 'success', true);
                        }
                    );
                }

                toggleAllStudents(checkboxElem, wrapId) {
                    const wrap = document.getElementById(wrapId);
                    if (wrap) wrap.querySelectorAll('.stu-checkbox').forEach(cb => cb.checked = checkboxElem.checked);
                }

                _getSelectedRosterStudentIds() {
                    const selected = new Set(Array.from(document.querySelectorAll('#tree-container-students .stu-checkbox:checked')).map(cb => cb.value));
                    return [...selected].filter(id => this.store.state.data.students.some(student => student.id === id));
                }

                openBulkEditStudents() {
                    const ids = this._getSelectedRosterStudentIds();
                    const operationContext=Utils.contextStamp(), operationData=JSON.stringify(this.store.state.data);
                    if (!ids.length) return Utils.msg('请先勾选需要批量编辑的学生', 'error');

                    const dialog = document.createElement('dialog');
                    dialog.className = 'dialog-shell dialog--lg gk2-roster-bulk-dialog';
                    dialog.setAttribute('aria-modal', 'true');
                    dialog.setAttribute('aria-label', '批量编辑学生信息');
                    const fields = [
                        ['campus', '所属校区', '如：织金育才', 'dl-campus'],
                        ['grade', '所属年级', '如：2025级', 'dl-grade'],
                        ['teachingClass', '任教班级', '如：高考日语班', 'dl-tclass'],
                        ['adminClass', '原行政班', '如：高三1班', 'dl-aclass']
                    ];
                    dialog.innerHTML = `
                        <header class="gk2-roster-dialog-header"><div><h3>批量编辑学生信息</h3><p>已选择 <strong>${ids.length}</strong> 名学生。勾选要修改的字段，未勾选的项目保持原样。</p></div><button type="button" class="secondary gk2-roster-dialog-close" aria-label="关闭">×</button></header>
                        <div class="gk2-roster-bulk-fields">${fields.map(([key,label,placeholder,list]) => `<label class="gk2-roster-bulk-field"><span class="gk2-roster-bulk-field-title"><input type="checkbox" data-bulk-field-toggle="${key}"> ${label}</span><input type="text" data-bulk-field="${key}" list="${list}" placeholder="${placeholder}" disabled autocomplete="off"></label>`).join('')}
                            <label class="gk2-roster-bulk-field gk2-roster-bulk-tags"><span class="gk2-roster-bulk-field-title"><input type="checkbox" data-bulk-tags-toggle> 学生标签</span><select data-bulk-tags-mode disabled><option value="replace">统一替换为</option><option value="add">添加标签</option><option value="remove">移除标签</option></select><input type="text" data-bulk-tags placeholder="多个标签用逗号分隔；替换模式留空可清空标签" disabled></label>
                        </div>
                        <p class="gk2-roster-bulk-note">变更任教班级或校区时，会为学生更新当前班级记录；历史考试成绩与原行政班记录保留。</p>
                        <footer class="dialog-footer"><button type="button" class="secondary" data-roster-cancel>取消</button><button type="button" class="primary" data-roster-apply>应用到 ${ids.length} 名学生</button></footer>`;
                    document.body.append(dialog);
                    const close = () => dialog.close();
                    dialog.querySelector('.gk2-roster-dialog-close').addEventListener('click', close);
                    dialog.querySelector('[data-roster-cancel]').addEventListener('click', close);
                    dialog.querySelectorAll('[data-bulk-field-toggle]').forEach(toggle => {
                        const input = dialog.querySelector(`[data-bulk-field="${toggle.dataset.bulkFieldToggle}"]`);
                        toggle.addEventListener('change', () => { input.disabled = !toggle.checked; if (toggle.checked) input.focus(); });
                    });
                    const tagsToggle = dialog.querySelector('[data-bulk-tags-toggle]');
                    const tagsMode = dialog.querySelector('[data-bulk-tags-mode]');
                    const tagsInput = dialog.querySelector('[data-bulk-tags]');
                    tagsToggle.addEventListener('change', () => { tagsMode.disabled = tagsInput.disabled = !tagsToggle.checked; if (tagsToggle.checked) tagsInput.focus(); });
                    dialog.querySelector('[data-roster-apply]').addEventListener('click', () => {
                        const changes = {};
                        dialog.querySelectorAll('[data-bulk-field-toggle]:checked').forEach(toggle => {
                            const field = toggle.dataset.bulkFieldToggle;
                            changes[field] = dialog.querySelector(`[data-bulk-field="${field}"]`).value.trim();
                        });
                        const tagChange = tagsToggle.checked ? { mode: tagsMode.value, values: tagsInput.value.split(/[，,]/).map(tag => tag.trim()).filter(Boolean) } : null;
                        if (!Object.keys(changes).length && !tagChange) return Utils.msg('请先勾选要修改的字段', 'error');
                        for (const field of ['campus', 'grade', 'teachingClass']) {
                            if (Object.prototype.hasOwnProperty.call(changes, field) && !changes[field]) return Utils.msg('校区、年级和任教班级不能为空', 'error');
                        }
                        if(operationContext!==Utils.contextStamp()||operationData!==JSON.stringify(this.store.state.data))return Utils.msg('身份、范围或数据已变化，请重新操作。','error');
                        if(this.store.state.data.students.filter(st=>ids.includes(st.id)).some(st=>!Utils.canReadStudent(st)||!Utils.canReadStudent({...st,...changes})))return Utils.msg('批量修改将影响适用范围外学生，请由管理员处理。','error');
                        this.store.pushSnapshot();
                        const selected = new Set(ids);
                        this.store.state.data.students.filter(student => selected.has(student.id)).forEach(student => {
                            Object.entries(changes).forEach(([field, value]) => this.updStu(student.id, field, value));
                            if (tagChange) {
                                const existing = Array.isArray(student.tags) ? student.tags : [];
                                if (tagChange.mode === 'replace') student.tags = [...tagChange.values];
                                else if (tagChange.mode === 'add') student.tags = [...new Set([...existing, ...tagChange.values])];
                                else student.tags = existing.filter(tag => !tagChange.values.includes(tag));
                                student._ts = Date.now();
                            }
                        });
                        this.store.save();
                        close();
                        this.refresh();
                        Utils.msg(`已批量更新 ${ids.length} 名学生的信息`, 'success', true);
                    });
                    dialog.addEventListener('close', () => dialog.remove(), { once: true });
                    dialog.showModal();
                }

                editStudentGroup(kind, oldValue, campus = '', grade = '') {
                    const config = {
                        campus: { field: 'campus', label: '校区名称', title: '编辑校区名称' },
                        grade: { field: 'grade', label: '年级名称', title: '编辑年级名称' },
                        teachingClass: { field: 'teachingClass', label: '班级名称', title: '编辑班级名称' }
                    }[kind];
                    if (!config || !oldValue) return;
                    const students = this.store.state.data.students || [];
                    const matches = student => kind === 'campus' ? String(student.campus || '').trim() === oldValue
                        : kind === 'grade' ? String(student.campus || '').trim() === campus && String(student.grade || '').trim() === oldValue
                        : String(student.campus || '').trim() === campus && String(student.grade || '').trim() === grade && (String(student.teachingClass || '').trim() || '未分日语班') === oldValue;
                    const affected = students.filter(matches);
                    if (!affected.length) return Utils.msg('没有找到该分组下的学生', 'error');

                    const dialog = document.createElement('dialog');
                    dialog.className = 'dialog-shell dialog--md gk2-roster-group-dialog';
                    dialog.setAttribute('aria-modal', 'true');
                    dialog.setAttribute('aria-label', config.title);
                    dialog.innerHTML = `<header class="gk2-roster-dialog-header"><div><h3>${config.title}</h3><p>将同时更新该分组中的 ${affected.length} 名学生。</p></div><button type="button" class="secondary gk2-roster-dialog-close" aria-label="关闭">×</button></header><label class="gk2-roster-group-field"><span>${config.label}</span><input type="text" data-group-name value="${Utils.escapeHTML(oldValue)}" autocomplete="off"></label><p class="gk2-roster-bulk-note">分组改名会同步更新对应的学生归属与相关考试范围；班级历史中的已结束记录会保留。</p><footer class="dialog-footer"><button type="button" class="secondary" data-roster-cancel>取消</button><button type="button" class="primary" data-roster-apply>保存修改</button></footer>`;
                    document.body.append(dialog);
                    const input = dialog.querySelector('[data-group-name]');
                    const close = () => dialog.close();
                    dialog.querySelector('.gk2-roster-dialog-close').addEventListener('click', close);
                    dialog.querySelector('[data-roster-cancel]').addEventListener('click', close);
                    dialog.querySelector('[data-roster-apply]').addEventListener('click', () => {
                        const nextValue = input.value.trim();
                        if (!nextValue) return Utils.msg(`${config.label}不能为空`, 'error');
                        if (nextValue === oldValue) return close();
                        const duplicate = students.some(student => {
                            if (!matches(student)) {
                                if (kind === 'campus') return String(student.campus || '').trim() === nextValue;
                                if (kind === 'grade') return String(student.campus || '').trim() === campus && String(student.grade || '').trim() === nextValue;
                                return String(student.campus || '').trim() === campus && String(student.grade || '').trim() === grade && String(student.teachingClass || '').trim() === nextValue;
                            }
                            return false;
                        });
                        if (duplicate) return Utils.msg(`“${nextValue}”已存在于同一层级，请使用其他名称`, 'error');

                        this.store.pushSnapshot();
                        const now = Date.now();
                        affected.forEach(student => {
                            student[config.field] = nextValue;
                            student._ts = now;
                            if (kind === 'campus') {
                                (student.classHistory || []).forEach(entry => { if (entry.campus === oldValue) entry.campus = nextValue; });
                            } else if (kind === 'teachingClass') {
                                const current = student.classHistory?.[student.classHistory.length - 1];
                                if (current && !current.to && current.campus === campus && (String(current.teachingClass || '').trim() || '未分日语班') === oldValue) current.teachingClass = nextValue;
                            }
                        });
                        if (kind === 'campus') {
                            (this.store.state.data.exams || []).forEach(exam => {
                                if (exam.campus === oldValue) exam.campus = nextValue;
                                if (Array.isArray(exam.campuses)) exam.campuses = [...new Set(exam.campuses.map(name => name === oldValue ? nextValue : name))];
                            });
                        } else if (kind === 'grade') {
                            (this.store.state.data.exams || []).forEach(exam => { if (exam.grade === oldValue) exam.grade = nextValue; });
                        }
                        const focus = this.store.state.globalFocus || {};
                        const focusKey = kind === 'campus' ? 'campuses' : kind === 'grade' ? 'grades' : 'tClasses';
                        if (Array.isArray(focus[focusKey])) focus[focusKey] = [...new Set(focus[focusKey].map(name => name === oldValue ? nextValue : name))];
                        this.store.state.globalFocus = focus;
                        this.store.save();
                        close();
                        this.refresh();
                        requestAnimationFrame(() => {
                            const path = kind === 'campus' ? [`stree-${nextValue}`]
                                : kind === 'grade' ? [`stree-${campus}`, `stree-${campus}-${nextValue}`]
                                : [`stree-${campus}`, `stree-${campus}-${grade}`, `stree-${campus}-${grade}-${nextValue}`];
                            path.forEach(id => { const node = document.getElementById(id); if (node) node.open = true; });
                        });
                        Utils.msg(`${config.label}已更新为“${nextValue}”`, 'success', true);
                    });
                    dialog.addEventListener('close', () => dialog.remove(), { once: true });
                    dialog.showModal();
                    requestAnimationFrame(() => { input.focus(); input.select(); });
                }

                bulkDeleteStudents() {
                    const ids = this._getSelectedRosterStudentIds();
                    if (!ids.length) return Utils.msg('请先勾选需要删除的学生', 'error');
                    this.showConfirmDialog(
                        `将选中的 ${ids.length} 名学生移出当前名单。已有考试名单和历史成绩全部保留，班级均分等统计不变；以后新建的考试不再包含这些学生。`,
                        () => {
                            this._archiveRosterStudents(ids);
                            Utils.msg('已批量移出名单，历史成绩已保留', 'success', true);
                        }
                    );
                }

                openStudentDashboardModal(studentId) {
                    ['spTrendChart', 'spRadarChart', 'spQuadChart'].forEach(key => {
                        try {
                            if (this[key]) {
                                this[key].dispose();
                                this[key] = null;
                            }
                        } catch (e) {}
                    });
                    const stu = this.store.state.data.students.find(s => s.id === studentId);
                    if (!stu) return;

                    // 获取该生有成绩记录的所有考试，按时间先后顺序排列
                    const allExams = this.store.state.data.exams.filter(e => {
                        if (e.grade !== stu.grade) return false;
                        const camps = this._getExamCampuses(e);
                        return camps.length === 0 || camps.includes(stu.campus);
                    }).sort((a,b) => (a.date||'').localeCompare(b.date||''));

                    let validExams = [];
                    let latestExamItem = null;
                    allExams.forEach(ex => {
                        const rec = this.store.getScore(stu.id, ex.id);
                        if (Utils.isActualScore(rec, ex)) {
                            validExams.push({ exam: ex, score: rec });
                            latestExamItem = { exam: ex, score: rec };
                        }
                    });

                    if (validExams.length === 0) {
                        Utils.msg("该生暂无成绩记录", "error");
                        return;
                    }

                    // 设置 modal 头部信息
                    document.getElementById('sp-name').textContent = stu.name;
                    document.getElementById('sp-campus').textContent = stu.campus;
                    document.getElementById('sp-grade').textContent = stu.grade;
                    const classText = Utils.hasTransferred(stu)
                        ? `${stu.teachingClass}（${Utils.getTransferSummary(stu)}）`
                        : stu.teachingClass;
                    document.getElementById('sp-class').textContent = classText;

                    this._syncStudentProfileAISummary(stu);

                    // 唤起弹窗
                    document.getElementById('modal-student-profile').showModal();

                    // 构建历次考试历史表格（按日期升序）
                    try {
                        const historyEl = document.getElementById('sp-history-table');
                        if (historyEl) {
                            const allExams = this.store.state.data.exams.slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
                            const rows = [];
                            allExams.forEach(ex => {
                                const rec = this.store.getScore(stu.id, ex.id);
                                const hasEnteredScore = !!rec && !rec.examAbsent && (ex.types || []).some(type => {
                                    const value = rec.details?.[type.name];
                                    return value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value));
                                });
                                if (Utils.isActualScore(rec, ex)) {
                                    const max = ex.maxTotal || (ex.types || []).reduce((a,b)=>a+(b.max||0),0) || 0;
                                    const rate = max > 0 ? Math.round((rec.total / max) * 1000) / 10 : 0;
                                    // 计算年级排名（在有成绩的同年级学生中）
                                    const gradeStus = this.store.state.data.students.filter(s => s.grade === ex.grade).map(s => s.id);
                                    const gradeScores = this.store.state.data.scores.filter(s => s.examId === ex.id && gradeStus.includes(s.studentId) && Utils.isActualScore(s)).sort((a,b)=>b.total - a.total);
                                    const rank = gradeScores.length > 0 ? (gradeScores.filter(gs=>gs.total>rec.total).length + 1) : null;
                                    const gradeCount = gradeScores.length || 0;
                                    rows.push({ exam: ex, rec, max, rate, rank, gradeCount });
                                }
                            });
                            if (rows.length === 0) {
                                historyEl.innerHTML = `<div class="table-note">暂无已录入成绩</div>`;
                            } else {
                                const lastExamId = rows[rows.length-1].exam.id;
                                let h = '<table class="table-shell table-shell--history"><thead><tr><th>考试名称</th><th style="width:110px;">考试日期</th><th style="width:110px;">所属班级</th><th style="width:80px; text-align:right;">总分</th><th style="width:90px; text-align:right;">得分率</th><th style="width:120px; text-align:center;">年级排名</th></tr></thead><tbody>';
                                rows.forEach(r => {
                                    const mark = r.exam.id === lastExamId ? ` <span class="text-primary">${window.gk2IconMarkup('circle')}</span>` : '';
                                    const rankText = r.rank ? `${r.rank}/${r.gradeCount}` : '-';
                                    const examClass = Utils.getClassForExam(stu, r.exam).teachingClass;
                                    const isOldClass = examClass !== stu.teachingClass;
                                    const classCellStyle = isOldClass ? 'color:#9a6700; font-style:italic;' : '';
                                    h += `<tr><td>${Utils.escapeHTML(r.exam.name)}${mark}</td><td>${Utils.escapeHTML(r.exam.date || '')}</td><td style="${classCellStyle}">${Utils.escapeHTML(examClass)}${isOldClass ? ` ${window.gk2IconMarkup('swap')}` : ''}</td><td style="text-align:right; font-weight:700;">${Number(r.rec.total).toFixed(1)}</td><td style="text-align:right;">${r.rate}%</td><td style="text-align:center;">${rankText}</td></tr>`;
                                });
                                h += '</tbody></table>';
                                historyEl.innerHTML = h;
                            }
                        }
                    } catch(e) { console.warn('build history table error', e); }

                    // 渲染图表
                    setTimeout(() => {
                        this._renderSPTrend(stu, validExams);
                        this._renderSPRadar(stu, latestExamItem);
                    }, 100);
                }

                _renderSPTrend(stu, validExams) {
                    const chart = echarts.init(document.getElementById('sp-chart-trend'));
                    const xAxisData = [], stuScores = [], avgScores = [];
                    let maxScoreOverall = 100;

                    validExams.forEach(item => {
                        const ex = item.exam;
                        xAxisData.push(ex.name);
                        stuScores.push(item.score.total);
                        if(ex.maxTotal > maxScoreOverall) maxScoreOverall = ex.maxTotal;

                        const avg = StatsEngine.classAverage(stu, ex, this._students, this._scores);
                        avgScores.push(avg);
                    });

                    

                    this._deferredChartSetOption(chart, {
                        title: { text: '历次考试总分变化', left: 'center' },
                        tooltip: { trigger: 'axis', confine: true, backgroundColor: 'rgba(28,28,30,0.92)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, textStyle: { color: '#f2f2f7' }, extraCssText: 'border-radius:10px;' },
                        legend: { data: ['个人得分', '班级均分'], bottom: 0, textStyle: { color: '#6c6c70' } },
                        xAxis: { type: 'category', data: xAxisData, axisLabel: { interval: 0, rotate: 15 } },
                        yAxis: { type: 'value', min: 0, max: maxScoreOverall, axisLine: { lineStyle: { color: '#aeaeb2' } }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'rgba(174,174,178,0.12)' } } },
                        series: [
                            { name: '个人得分', type: 'line', data: stuScores, smooth: true, itemStyle: { color: '#0071e3'}, label: {show:true, position:'top'}, lineStyle: { width: 3, shadowBlur: 14, shadowColor: 'rgba(0,113,227,0.28)', shadowOffsetY: 6 }, symbol: 'circle', symbolSize: 6 },
                            { name: '班级均分', type: 'line', data: avgScores, smooth: true, itemStyle: { color: '#aeaeb2'}, lineStyle:{ type: 'dashed', width: 2.2 }, symbol: 'circle', symbolSize: 6 }
                        ]
                    });
                }

                _renderSPRadar(stu, latestExamItem) {
                    const chart = echarts.init(document.getElementById('sp-chart-radar'));
                    const ex = latestExamItem.exam;
                    const rec = latestExamItem.score;

                    if (!ex.types || ex.types.length === 0) return;

                    const indicator = ex.types.map(t => ({ name: t.name, max: 100 }));
                    const stuPct = ex.types.map(t => parseFloat((((rec.details[t.name]||0) / t.max) * 100).toFixed(1)));
                    
                    const avgPct = ex.types.map(t => {
                        const rawAvg = StatsEngine.classTypeAverage(stu, ex, t.name, this._students, this._scores);
                        return parseFloat(((rawAvg / t.max) * 100).toFixed(1));
                    });

                    // 在渲染雷达图之前生成学情短评
                    try {
                        const insightEl = document.getElementById('sp-smart-insight');
                        if (insightEl) {
                            let bestType = '';
                            let worstType = '';
                            let maxDiff = -Infinity;
                            let minDiff = Infinity;
                            ex.types.forEach((t, idx) => {
                                const diff = (stuPct[idx] || 0) - (avgPct[idx] || 0);
                                if (diff > maxDiff) { maxDiff = diff; bestType = t.name; }
                                if (diff < minDiff) { minDiff = diff; worstType = t.name; }
                            });
                            insightEl.innerHTML = window.gk2IconMarkup('lightbulb') + " <b>学情速写</b>：本次考试中，你的 <b>[" + bestType + "]</b> 表现亮眼；但 <b>[" + worstType + "]</b> 显著低于班级均值，建议近期重点突破。";
                        }
                    } catch (e) {
                        console.warn('sp insight render error', e);
                    }

                    this._deferredChartSetOption(chart, {
                        title: { text: `最新考试题型能力雷达 (${ex.name})`, left: 'center' },
                        tooltip: {
                            confine: true,
                            position: (point, params, dom, rect, size) => {
                                const [viewWidth, viewHeight] = size.viewSize;
                                const [boxWidth, boxHeight] = size.contentSize;
                                const edge = 12, gap = 16, titleSafe = 60;
                                let left = point[0] + gap;
                                if (left + boxWidth > viewWidth - edge) left = point[0] - boxWidth - gap;
                                left = Math.max(edge, Math.min(left, viewWidth - boxWidth - edge));
                                const maxTop = viewHeight - boxHeight - edge;
                                const minTop = Math.min(titleSafe, maxTop);
                                let top = point[1] + gap;
                                if (top > maxTop) top = point[1] - boxHeight - gap;
                                top = Math.max(minTop, Math.min(top, maxTop));
                                return [left, top];
                            },
                            formatter: (p) => {
                                let str = `<b>${p.name}</b><br>`;
                                p.value.forEach((v, idx) => str += `${indicator[idx].name} 掌握率: ${v}%<br>`);
                                return str;
                            }
                        },
                        legend: { data: ['个人能力(%)', '班级均值(%)'], bottom: 0 },
                        radar: { indicator: indicator, center: ['50%', '50%'], radius: '60%' },
                        series: [{
                            type: 'radar',
                            data: [
                                { name: '个人能力(%)', value: stuPct, itemStyle: { color: '#0071e3' }, areaStyle: { color: this._radarAreaGradient(), opacity: 0.92 } },
                                { name: '班级均值(%)', value: avgPct, itemStyle: { color: Utils.cssVar('--text-faint', '#86868b') }, lineStyle: { type: 'dashed' } }
                            ]
                        }]
                    });
                }

                openAddStudentModal() {
                    const students = this.store.state.data.students;
                    
                    const dCampus = document.getElementById('dl-campus');
                    const dGrade = document.getElementById('dl-grade');
                    const dTClass = document.getElementById('dl-tclass');
                    const dAClass = document.getElementById('dl-aclass');
                    
                    dCampus.innerHTML = [...new Set(students.map(s=>s.campus))].filter(Boolean).map(c=>`<option value="${c}">`).join('');
                    dGrade.innerHTML = [...new Set(students.map(s=>s.grade))].filter(Boolean).map(g=>`<option value="${g}">`).join('');
                    dTClass.innerHTML = [...new Set(students.map(s=>s.teachingClass))].filter(Boolean).map(t=>`<option value="${t}">`).join('');
                    dAClass.innerHTML = [...new Set(students.map(s=>s.adminClass))].filter(Boolean).map(a=>`<option value="${a}">`).join('');
                    
                    document.getElementById('as-name').value = '';
                    document.getElementById('as-campus').value = '';
                    document.getElementById('as-grade').value = '';
                    document.getElementById('as-tclass').value = '';
                    document.getElementById('as-aclass').value = '';

                    document.getElementById('modal-add-student').showModal();
                }

                _sameRosterIdentity(a, b) {
                    return ['name','campus','grade','teachingClass'].every(key => String(a[key] || (key === 'teachingClass' ? '未分日语班' : '')).trim() === String(b[key] || (key === 'teachingClass' ? '未分日语班' : '')).trim());
                }

                async _chooseRosterIdentity(candidate) {
                    const matches = this.store.state.data.students.filter(s => s.rosterMembership?.archivedAt != null && this._sameRosterIdentity(s, candidate));
                    if (!matches.length) return { kind: 'new' };
                    return new Promise(resolve => {
                        const dialog = document.createElement('dialog');
                        dialog.className = 'gk2-drill';
                        dialog.id = 'roster-identity-dialog';
                        dialog.setAttribute('aria-label', '确认学生身份');
                        dialog.innerHTML = `<header><h3>确认学生身份</h3><button type="button" class="secondary" data-cancel>取消</button></header><div class="gk2-drill-body"><p>发现已移出名单的同名学生：<b>${Utils.escapeHTML(candidate.name)}</b>（${Utils.escapeHTML(candidate.campus)} / ${Utils.escapeHTML(candidate.grade)} / ${Utils.escapeHTML(candidate.teachingClass)}）。请选择本次添加的是谁。</p><label class="field-label">原学生记录<select data-previous>${matches.map((s,i) => `<option value="${i}">记录 ${i+1} · 移出时间 ${Utils.escapeHTML(new Date(s.rosterMembership.archivedAt).toLocaleString('zh-CN'))} · ${this.store.state.data.scores.filter(r=>r.studentId===s.id).length} 条历史成绩</option>`).join('')}</select></label><p>全新学生从零建立档案，不继承原学生成绩。恢复原学生将接回所选记录的全部历史成绩，离班期间新建的考试不会自动补入。</p><div class="dialog-actions"><button type="button" class="secondary" data-new>作为全新学生添加</button><button type="button" class="primary" data-restore>恢复原学生并合并历史成绩</button></div></div>`;
                        let choice = null;
                        dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
                        dialog.querySelector('[data-new]').onclick = () => { choice = { kind: 'new' }; dialog.close(); };
                        dialog.querySelector('[data-restore]').onclick = () => { choice = { kind: 'restore', id: matches[Number(dialog.querySelector('[data-previous]').value)].id }; dialog.close(); };
                        dialog.addEventListener('close', () => { dialog.remove(); resolve(choice); }, { once: true });
                        document.body.append(dialog);
                        dialog.showModal();
                    });
                }

                _applyRosterAddition(candidate, choice) {
                    const exams = this.store.state.data.exams, ts = Date.now();
                    if (choice.kind === 'restore') {
                        const student = this.store.state.data.students.find(s => s.id === choice.id);
                        if (!student || student.rosterMembership?.archivedAt == null || !this._sameRosterIdentity(student, candidate)) throw Error('原学生记录已变化，请重新添加');
                        const included = new Set(student.rosterMembership.includedExamIds);
                        student.rosterMembership = { version: 1, archivedAt: null, includedExamIds: [...included], excludedExamIds: exams.filter(e => !included.has(e.id)).map(e => e.id) };
                        student._ts = ts;
                        return student;
                    }
                    const student = { ...candidate, id: Utils.id(), _ts: ts, tags: [],
                        classHistory: [{ campus: candidate.campus, teachingClass: candidate.teachingClass, from: new Date().toISOString().slice(0,10), to: null }],
                        rosterMembership: { version: 1, archivedAt: null, includedExamIds: [], excludedExamIds: exams.map(e => e.id) }
                    };
                    this.store.state.data.students.push(student);
                    return student;
                }

                async doAddStudent() {
                    if (this._rosterAdding) return;
                    const value = id => document.getElementById(id).value.trim();
                    const candidate = { name: value('as-name'), campus: value('as-campus'), grade: value('as-grade'), teachingClass: value('as-tclass') || '未分日语班', adminClass: value('as-aclass') || '-' };
                    if (!candidate.name || !candidate.campus || !candidate.grade) return Utils.msg('姓名、校区和年级为必填项', 'error');
                    if (this.store.state.data.students.some(s => s.rosterMembership?.archivedAt == null && this._sameRosterIdentity(s, candidate))) return Utils.msg('当前名单中已存在该学生，请勿重复添加', 'error');
                    const context = Utils.contextStamp(), before = JSON.stringify(this.store.state.data);
                    this._rosterAdding = true;
                    try {
                        const choice = await this._chooseRosterIdentity(candidate);
                        if (!choice) return;
                        if (context !== Utils.contextStamp() || before !== JSON.stringify(this.store.state.data) || !document.getElementById('modal-add-student').open) return Utils.msg('身份、范围、数据或添加窗口已变化，请重新添加', 'error');
                        this.store.pushSnapshot();
                        this._applyRosterAddition(candidate, choice);
                        this.store.save();
                        document.getElementById('modal-add-student').close();
                        this.refresh();
                        Utils.msg(choice.kind === 'restore' ? `已恢复学生 ${candidate.name}，历史成绩已接回` : `已成功添加全新学生：${candidate.name}`);
                    } finally { this._rosterAdding = false; }
                }

                async handleImport(e) {
                    const operationContext=Utils.contextStamp(), operationData=JSON.stringify(this.store.state.data);
                    const f = e.target.files[0]; if(!f) return;
                    if (!await window.gk2Dependencies.ensure('xlsx')) { e.target.value = ''; return; }
                    const r = new FileReader();
                    r.onload = (evt) => {
                        try {
                            Utils.assertContext(operationContext);
                            if(operationData!==JSON.stringify(this.store.state.data))throw Error('读取期间数据已变化');
                            const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
                            const sheet = wb.Sheets[wb.SheetNames[0]];
                            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                            const headers = (rows[0] || []).map(h => String(h || '').trim());
                            const dataRows = rows.slice(1).filter(row => row.some(cell => String(cell || '').trim() !== ''));
                            this.showStudentImportPreview(headers, dataRows, e.target);
                        } catch(err) {
                            Utils.msg('文件读取失败，请检查 Excel 格式', 'error');
                            e.target.value = '';
                        }
                    };
                    r.readAsArrayBuffer(f);
                }

                _detectStudentImportMapping(headers = []) {
                    const aliases = {
                        name: ['姓名','学生姓名','名字','name'],
                        campus: ['校区','学校','分校','campus'],
                        grade: ['年级','届别','入学年级','grade'],
                        teachingClass: ['日语班','教学班','班级','日语教学班','teachingclass'],
                        adminClass: ['行政班','原班级','行政原班','adminclass']
                    };
                    const mapping = {};
                    Object.entries(aliases).forEach(([key, list]) => {
                        const idx = headers.findIndex(h => list.some(alias => String(h).toLowerCase() === String(alias).toLowerCase() || String(h).includes(alias)));
                        mapping[key] = idx;
                    });
                    return mapping;
                }

                showStudentImportPreview(headers, dataRows, inputEl) {
                    const operationContext=Utils.contextStamp(), operationData=JSON.stringify(this.store.state.data);
                    const dialog = document.getElementById('student-import-preview-modal');
                    const body = document.getElementById('student-import-preview-body');
                    const confirmBtn = document.getElementById('student-import-confirm');
                    const cancelBtn = document.getElementById('student-import-cancel');
                    if (!dialog || !body) return;
                    const fields = [
                        ['name', '姓名列'], ['campus', '校区列'], ['grade', '年级列'], ['teachingClass', '日语班/教学班列'], ['adminClass', '行政班列']
                    ];
                    const mapping = this._detectStudentImportMapping(headers);
                    const optionHtml = (selected) => ['<option value="-1">不导入</option>'].concat(headers.map((h, idx) => `<option value="${idx}" ${idx === selected ? 'selected' : ''}>${Utils.escapeHTML(h || `列 ${idx+1}`)}</option>`)).join('');
                    const getMapped = (row, key) => {
                        const idx = mapping[key];
                        return idx >= 0 ? String(row[idx] || '').trim() : '';
                    };
                    const existing = new Set((this.store.state.data.students || []).filter(s => s.rosterMembership?.archivedAt == null).map(s => JSON.stringify([s.name,s.campus,s.grade,s.teachingClass])));
                    const normalized = dataRows.map(row => ({ name: getMapped(row,'name'), campus: getMapped(row,'campus'), grade: getMapped(row,'grade'), teachingClass: getMapped(row,'teachingClass'), adminClass: getMapped(row,'adminClass') })).filter(x => x.name && x.campus && x.grade);
                    const existsCount = normalized.filter(x => existing.has(JSON.stringify([x.name,x.campus,x.grade,x.teachingClass || '未分日语班']))).length;
                    const newCount = normalized.length - existsCount;
                    const needsManual = ['name','campus','grade'].some(key => mapping[key] < 0);
                    body.innerHTML = `
                        <div class="mapping-grid">
                            ${fields.map(([key,label]) => `<label class="field-label">${label}<select data-map-key="${key}" class="student-import-map">${optionHtml(mapping[key])}</select></label>`).join('')}
                        </div>
                        ${needsManual ? '<div class="dialog-warning">检测到必要列头不完整，请先用下拉菜单指定姓名、校区和年级列。</div>' : ''}
                        <div class="student-import-stats">
                            <span class="pill pill--primary">共检测到 ${normalized.length} 名学生</span>
                            <span class="pill">新增 ${newCount} 名</span>
                            <span class="pill">已存在 ${existsCount} 名（将跳过）</span>
                        </div>
                        <div class="table-scroll-container" style="max-height:320px;"><table class="table-shell"><thead><tr>${headers.map(h=>`<th>${Utils.escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${dataRows.slice(0,10).map(row => `<tr>${headers.map((_,idx)=>`<td>${Utils.escapeHTML(row[idx] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
                    const rerenderFromSelects = () => {
                        body.querySelectorAll('.student-import-map').forEach(sel => { mapping[sel.dataset.mapKey] = parseInt(sel.value); });
                        this.showStudentImportPreview(headers, dataRows, inputEl);
                    };
                    body.querySelectorAll('.student-import-map').forEach(sel => sel.addEventListener('change', rerenderFromSelects, { once: true }));
                    const cleanup = () => { confirmBtn.onclick = null; cancelBtn.onclick = null; if (inputEl) inputEl.value = ''; };
                    cancelBtn.onclick = () => { cleanup(); dialog.close(); Utils.msg('已取消导入', 'info'); };
                    confirmBtn.onclick = async () => {
                        if(operationContext!==Utils.contextStamp()||operationData!==JSON.stringify(this.store.state.data))return Utils.msg('身份、范围或数据已变化，请重新导入。','error');
                        const candidates=dataRows.map(row=>({campus:getMapped(row,'campus'),grade:getMapped(row,'grade'),teachingClass:getMapped(row,'teachingClass')||'未分日语班'}));
                        if(candidates.some(st=>st.campus&&st.grade&&!Utils.canReadStudent(st)))return Utils.msg('导入包含适用范围外学生，请由管理员处理。','error');
                        body.querySelectorAll('.student-import-map').forEach(sel => { mapping[sel.dataset.mapKey] = parseInt(sel.value); });
                        if (['name','campus','grade'].some(key => mapping[key] < 0)) return Utils.msg('请先指定姓名、校区和年级列', 'error');
                        const val = (row, key) => mapping[key] >= 0 ? String(row[mapping[key]] || '').trim() : '';
                        if (this._rosterImporting) return;
                        this._rosterImporting = true;
                        let skipCount = 0, addCount = 0, restoreCount = 0;
                        const staged = [];
                        try {
                            for (const row of dataRows) {
                                const candidate = { name: val(row,'name'), campus: val(row,'campus'), grade: val(row,'grade'), teachingClass: val(row,'teachingClass') || '未分日语班', adminClass: val(row,'adminClass') || '-' };
                                if (!candidate.name || !candidate.campus || !candidate.grade) continue;
                                if (this.store.state.data.students.some(s => s.rosterMembership?.archivedAt == null && this._sameRosterIdentity(s,candidate)) || staged.some(s => this._sameRosterIdentity(s.candidate,candidate))) { skipCount++; continue; }
                                const choice = await this._chooseRosterIdentity(candidate);
                                if (!choice) return;
                                staged.push({candidate,choice});
                            }
                            if (operationContext !== Utils.contextStamp() || operationData !== JSON.stringify(this.store.state.data) || !dialog.open) return Utils.msg('身份、范围或数据已变化，请重新导入。','error');
                            if (staged.length) this.store.pushSnapshot();
                            staged.forEach(({candidate,choice}) => { this._applyRosterAddition(candidate,choice); choice.kind === 'restore' ? restoreCount++ : addCount++; });
                        } finally { this._rosterImporting = false; }
                        this.store.save();
                        this.refresh();
                        cleanup();
                        dialog.close();
                        Utils.msg(`名单导入完成！新增 ${addCount} 人，恢复 ${restoreCount} 人` + (skipCount > 0 ? `，跳过 ${skipCount} 名已存在学生。` : ''));
                    };
                    this._enhanceDialogs();
                    dialog.showModal();
                }

                _getExamEntryStudents(exam) {
                    if (!exam) return [];
                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    const exCampuses = this._getExamCampuses(exam);
                    return (this.store.state.data.students || []).filter(s => {
                        const classAtExam = Utils.getClassForExam(s, exam);
                        const campusAtExam = classAtExam.campus || s.campus;
                        if (s.grade !== exam.grade) return false;
                        if (exCampuses.length > 0 && !exCampuses.includes(campusAtExam)) return false;
                        return this._studentMatchesFocusForExam(s, exam, focus);
                    });
                }

                _isScoreCompleteForExam(studentId, exam) {
                    const rec = this.store.getScore(studentId, exam.id);
                    const types = exam.types || [];
                    if (!rec || !types.length) return false;
                    if (rec.examAbsent === true) return true;
                    return types.every(t => this._isEntryFieldFilled(rec, exam, t));
                }

                _isCountEntryField(exam, type) {
                    return exam?.entryMode === 'count' && !type?.manualScore && Number.isInteger(Number(type?.questionCount)) && Number(type.questionCount) > 0;
                }

                _hasCountEntryTypes(types) {
                    return (types || []).some(type => !type?.manualScore && Number.isInteger(Number(type?.questionCount)) && Number(type.questionCount) > 0);
                }

                _calculateExamEntryTotal(record, exam) {
                    if (!record) return 0;
                    // Both entry modes save type scores in details. A view switch
                    // must never discard scores that cannot represent whole counts.
                    return Math.round((Object.values(record.details || {}).reduce((sum, value) => sum + (parseFloat(value) || 0), 0) + Number.EPSILON) * 100) / 100;
                }

                _isEntryFieldFilled(rec, exam, type) {
                    if (!rec || !type) return false;
                    if (this._isCountEntryField(exam,type)) return window.gk2Statistics.typeValue(rec,exam,type).valid;
                    const value=rec.details?.[type.name];
                    return value !== undefined && value !== null && String(value).trim() !== '';
                }

                _getEntryInputValue(rec, exam, type) {
                    if (!rec || !type) return '';
                    if (this._isCountEntryField(exam,type)) return window.gk2Statistics.inferCorrectCount(rec,type) ?? '';
                    return rec.details?.[type.name] ?? '';
                }

                _syncCorrectCountFromScore(record, type) {
                    if (!type || type.manualScore || !Number.isInteger(Number(type.questionCount)) || Number(type.questionCount)<=0) return;
                    record.questionCounts ||= {};
                    const count=window.gk2Statistics.inferCorrectCount(record,type);
                    if (count===null) delete record.questionCounts[type.name];
                    else record.questionCounts[type.name]=count;
                }

                _getCountEntryScorePreview(countValue, maxScore, questionCount) {
                    const raw = String(countValue ?? '').trim();
                    const count = Number(raw);
                    const totalQuestions = Number(questionCount);
                    const maximum = Number(maxScore);
                    if (!raw || !/^\d+$/.test(raw) || !Number.isInteger(count) || count < 0 || !Number.isInteger(totalQuestions) || totalQuestions <= 0 || count > totalQuestions || !Number.isFinite(maximum)) return null;
                    return Math.round((count * maximum / totalQuestions + Number.EPSILON) * 10) / 10;
                }

                _formatCountEntryScorePreview(score) {
                    return `${Number(score).toFixed(1)}分`;
                }

                _updateCountEntryScorePreview(input, animate = false) {
                    const output = input?.closest?.('.gk2-count-entry-control')?.querySelector?.('[data-gk2-count-score]');
                    if (!output) return;
                    let score = this._getCountEntryScorePreview(input.value, input.dataset.scoreMax, input.dataset.questionCount);
                    if (score===null && String(input.value).trim()==='') {
                        const record=this.store.getScore(input.dataset.sid,input.dataset.eid);
                        const saved=record?.details?.[input.dataset.field];
                        if (typeof saved==='number' && Number.isFinite(saved)) score=saved;
                    }
                    const cancelCurrent = () => {
                        if (output._gk2CountFrame) cancelAnimationFrame(output._gk2CountFrame);
                        output._gk2CountFrame = 0;
                        clearTimeout(output._gk2CountTimer);
                        output._gk2CountTimer = 0;
                        (output._gk2CountAnimations || []).forEach(animation => animation.cancel());
                        output._gk2CountAnimations = [];
                        output._gk2CountToken = (output._gk2CountToken || 0) + 1;
                        output.classList.remove('is-rolling');
                    };
                    if (score === null) {
                        cancelCurrent();
                        output.dataset.scoreValue = '';
                        output._gk2DisplayedValue = null;
                        output.textContent = '—';
                        output.setAttribute('aria-label', '折算分数');
                        output.classList.add('is-empty');
                        Utils.setScoreHeatColor(output, '', Number(input.dataset.scoreMax) || 0);
                        output.style.backgroundColor = '';
                        output.style.color = '';
                        output.style.borderBottomColor = 'transparent';
                        output.style.borderBottomWidth = '';
                        output.style.borderBottomStyle = '';
                        return;
                    }

                    const target = Number(score);
                    const existingTarget = output.dataset.scoreValue === '' ? null : Number(output.dataset.scoreValue);
                    if (existingTarget === target && (output._gk2CountTimer || output._gk2DisplayedValue === target)) return;
                    const previous = Number.isFinite(output._gk2DisplayedValue)
                        ? output._gk2DisplayedValue
                        : (existingTarget === null || !Number.isFinite(existingTarget) ? 0 : existingTarget);
                    output.dataset.scoreValue = String(target);
                    output.setAttribute('aria-label', this._formatCountEntryScorePreview(target));
                    output.classList.remove('is-empty');
                    Utils.setScoreHeatColor(output, target, Number(input.dataset.scoreMax) || 0);
                    output.style.borderBottomColor = 'transparent';
                    output.style.borderBottomWidth = '';
                    output.style.borderBottomStyle = '';

                    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
                    if (!animate || reduceMotion || previous === target || typeof output.animate !== 'function') {
                        cancelCurrent();
                        output._gk2DisplayedValue = target;
                        output.textContent = this._formatCountEntryScorePreview(target);
                        return;
                    }

                    cancelCurrent();
                    const token = output._gk2CountToken;
                    const goingUp = target >= previous;
                    const duration = 290;
                    const easing = 'cubic-bezier(.14,.82,.22,1)';
                    const fromFixed = previous.toFixed(1);
                    const toFixed = target.toFixed(1);
                    const fromParts = fromFixed.split('.');
                    const toParts = toFixed.split('.');
                    const integerWidth = Math.max(fromParts[0].length, toParts[0].length);
                    const fromInteger = fromParts[0].padStart(integerWidth, '0');
                    const toInteger = toParts[0].padStart(integerWidth, '0');
                    const showDecimal = true;
                    const fragment = document.createDocumentFragment();
                    const wheels = [];
                    const reels = [];
                    const appendDigit = (fromDigit, toDigit, leading = false) => {
                        const windowEl = document.createElement('span');
                        windowEl.className = `gk2-count-score-wheel${leading ? ' is-leading' : ''}`;
                        windowEl.setAttribute('aria-hidden', 'true');
                        const track = document.createElement('span');
                        track.className = 'gk2-count-score-track';
                        const delta = (toDigit - fromDigit + 10) % 10;
                        const steps = delta;
                        const sequence = goingUp
                            ? Array.from({ length: steps + 1 }, (_, index) => (fromDigit + index) % 10)
                            : Array.from({ length: steps + 1 }, (_, index) => (toDigit + index) % 10);
                        sequence.forEach(digit => {
                            const row = document.createElement('span');
                            row.className = 'gk2-count-score-digit';
                            row.textContent = String(digit);
                            track.appendChild(row);
                        });
                        const startOffset = goingUp ? 0 : -steps;
                        const endOffset = goingUp ? -steps : 0;
                        track.style.transform = `translate3d(0,${startOffset}em,0)`;
                        windowEl.appendChild(track);
                        fragment.appendChild(windowEl);
                        reels.push({ track, windowEl, toDigit, endOffset, leading });
                        if (steps > 0) wheels.push({ track, windowEl, startOffset, endOffset });
                    };

                    for (let index = 0; index < integerWidth; index += 1) {
                        appendDigit(Number(fromInteger[index]), Number(toInteger[index]), index < integerWidth - 1 && /^0+$/.test(toInteger.slice(0, index + 1)));
                    }
                    if (showDecimal) {
                        const separator = document.createElement('span');
                        separator.className = 'gk2-count-score-separator';
                        separator.textContent = '.';
                        separator.setAttribute('aria-hidden', 'true');
                        fragment.appendChild(separator);
                        appendDigit(Number(fromParts[1]), Number(toParts[1]));
                    }
                    const unit = document.createElement('span');
                    unit.className = 'gk2-count-score-unit';
                    unit.textContent = '分';
                    unit.setAttribute('aria-hidden', 'true');
                    fragment.appendChild(unit);
                    output.replaceChildren(fragment);
                    output.setAttribute('aria-label', this._formatCountEntryScorePreview(target));
                    output.classList.add('is-rolling');
                    output._gk2DisplayedValue = target;
                    output._gk2CountAnimations = [];
                    wheels.forEach(({ track, windowEl, startOffset, endOffset }, index) => {
                        const delay = (wheels.length - index - 1) * 13;
                        const animation = track.animate([
                            { transform: `translate3d(0,${startOffset}em,0)` },
                            { transform: `translate3d(0,${endOffset}em,0)` }
                        ], { duration, delay, easing, fill: 'forwards' });
                        output._gk2CountAnimations.push(animation);
                        if (windowEl.classList.contains('is-leading')) {
                            const leadingWidth = windowEl.getBoundingClientRect().width;
                            const collapseDuration = Math.min(160, duration);
                            output._gk2CountAnimations.push(windowEl.animate([
                                { width: `${leadingWidth}px`, opacity: 1 },
                                { width: '0px', opacity: 0 }
                            ], {
                                duration: collapseDuration,
                                delay: delay + duration - collapseDuration,
                                easing: 'cubic-bezier(.45,0,.55,1)',
                                fill: 'forwards'
                            }));
                        }
                    });
                    const totalDuration = duration + Math.max(0, wheels.length - 1) * 13;
                    output._gk2CountTimer = window.setTimeout(() => {
                        if (output._gk2CountToken !== token || !output.isConnected) return;
                        output._gk2CountTimer = 0;
                        // Keep the decimal separator mounted so it never switches to a different text baseline on settle.
                        const finishedAnimations = output._gk2CountAnimations;
                        output._gk2CountAnimations = [];
                        output._gk2DisplayedValue = target;
                        reels.forEach(({ track, windowEl, toDigit, leading }) => {
                            const digit = document.createElement('span');
                            digit.className = 'gk2-count-score-digit';
                            digit.textContent = String(toDigit);
                            track.style.transform = 'none';
                            track.replaceChildren(digit);
                            if (leading) {
                                windowEl.remove();
                            } else {
                                windowEl.style.width = '';
                                windowEl.style.opacity = '';
                            }
                        });
                        output.classList.remove('is-rolling');
                        finishedAnimations.forEach(animation => animation.cancel());
                    }, totalDuration + 32);
                }

	                _getExamRosterStudents(exam) {
	                    if (!exam) return [];
	                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
	                    const auth = this._getAuth();
                    const exCampuses = this._getExamCampuses(exam);
                    const scoredStudentIds = new Set((this.store.state.data.scores || []).filter(s => s.examId === exam.id).map(s => s.studentId));
                    return (this.store.state.data.students || []).filter(s => {
                        const classAtExam = Utils.getClassForExam(s, exam);
                        const campusAtExam = classAtExam.campus || s.campus;
                        const configuredForExam = s.grade === exam.grade && (exCampuses.length === 0 || exCampuses.includes(campusAtExam));
                        if (!configuredForExam && !scoredStudentIds.has(s.id)) return false;
                        if (!this._studentMatchesFocusForExam(s, exam, focus)) return false;
                        if (auth && auth.mode === 'teacher') {
                            if (s.campus !== auth.campus || s.grade !== auth.grade) return false;
                            if (classAtExam.teachingClass !== auth.classId) return false;
                        }
	                        return true;
	                    });
	                }

	                _getAIExamRosterStudents(exam) {
	                    if (!exam) return [];
	                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
	                    const auth = this._getAuth();
	                    const exCampuses = this._getExamCampuses(exam);
	                    const scoredStudentIds = new Set((this.store.state.data.scores || []).filter(s => s.examId === exam.id).map(s => s.studentId));
	                    return (this.store.state.data.students || []).filter(s => {
	                        const classAtExam = Utils.getClassForExam(s, exam);
	                        const campusAtExam = classAtExam.campus || s.campus;
	                        const configuredForExam = s.grade === exam.grade && (exCampuses.length === 0 || exCampuses.includes(campusAtExam));
	                        if (!configuredForExam && !scoredStudentIds.has(s.id)) return false;
	                        if (!this._studentMatchesFocusForExam(s, exam, focus)) return false;
	                        if (auth && auth.mode === 'teacher') {
	                            if (s.campus !== auth.campus || s.grade !== auth.grade) return false;
	                            if (classAtExam.teachingClass !== auth.classId) return false;
	                        }
	                        return true;
	                    });
	                }

                _getExamProgress(exam, students = null) {
                    const pool = students || this._getExamRosterStudents(exam);
                    let absentCount = 0;
                    const done = pool.filter(stu => {
                        const rec = this.store.getScore(stu.id, exam.id);
                        if (rec && rec.examAbsent) {
                            absentCount++;
                            return true;
                        }
                        return this._isScoreCompleteForExam(stu.id, exam);
                    }).length;
                    return { done, total: pool.length, absentCount, complete: pool.length > 0 && done === pool.length };
                }

                _formatExamProgressText(progress) {
                    if (progress.complete) return `${window.gk2IconMarkup('check')} 已完成`;
                    if (progress.absentCount > 0) return `已录 ${progress.done - progress.absentCount}/${progress.total - progress.absentCount}，缺考 ${progress.absentCount} 人`;
                    return `已录 ${progress.done}/${progress.total}`;
                }

                _refreshExamProgressIndicators(eid) {
                    const exam = this.store.state.data.exams.find(e => e.id === eid);
                    if (!exam) return;
                    const progress = this._getExamProgress(exam);
                    const pill = document.querySelector(`#e-card-${eid} .exam-progress-pill`);
                    if (pill) {
                        pill.classList.toggle('complete', progress.complete);
                        pill.innerHTML = this._formatExamProgressText(progress);
                    }
                }

                toggleExamAbsent(studentId, examId, trigger) {
                    let rec = this.store.getScore(studentId, examId);
                    const currentAbsent = rec && rec.examAbsent === true;
                    const isAbsent = typeof trigger === 'boolean' ? trigger : !currentAbsent;
                    if (!rec) {
                        rec = {studentId, examId, details:{}, total:0, estimatedTotal:0, examAbsent:false};
                        this.store.state.data.scores.push(rec);
                        this.store.rebuildScoreIndex();
                    }
	                    rec.examAbsent = isAbsent;
	                    if (!rec._fieldTs) rec._fieldTs = {};
	                    if (isAbsent) {
	                        rec.details = {};
	                        rec.questionCounts = {};
	                        rec.total = 0;
	                    }
	                    rec._ts = Date.now();
	                    rec._fieldTs.__examAbsent = rec._ts;

                    const row = trigger && trigger.closest ? trigger.closest('tr') : null;
                    const tableDetailsId = row && row.closest('details') ? row.closest('details').id : '';
                    const scrollBox = row && row.closest('.table-scroll-container');
                    const keepScrollLeft = scrollBox ? scrollBox.scrollLeft : 0;
                    const keepScrollTop = scrollBox ? scrollBox.scrollTop : 0;
                    const keepWindowX = window.scrollX || 0;
                    const keepWindowY = window.scrollY || 0;
                    if (row) {
                        row.querySelectorAll('.score-input').forEach(input => {
                            input.disabled = isAbsent;
                            if (isAbsent) {
                                input.value = '';
                                this._setScoreWarning(input, '');
                                input.style.backgroundColor = '';
                                input.style.color = '';
                            }
                        });
                        row.classList.toggle('exam-absent-row', isAbsent);
                        const totalEl = document.getElementById(`t-${studentId}`);
                        if (totalEl) totalEl.innerHTML = isAbsent ? '<span class="exam-absent-pill">缺考</span>' : '0';
                    }

                    this.store.markAsUnsaved();
                    this._refreshExamProgressIndicators(examId);
                    const movedInPlace = row && window.gk2EntryAbsences?.moveRow(this, row, isAbsent);
                    if (!movedInPlace) {
                        this.renderExamTables(examId);
                        if (tableDetailsId) {
                            const nextBox = document.getElementById(tableDetailsId)?.querySelector('.table-scroll-container');
                            if (nextBox) {
                                nextBox.scrollLeft = keepScrollLeft;
                                nextBox.scrollTop = keepScrollTop;
                            }
                            window.scrollTo(keepWindowX, keepWindowY);
                        }
                    }
                    Utils.msg(isAbsent ? '已标记缺考' : '已取消缺考', isAbsent ? 'warning' : 'success');
                }

                _refreshScoreStatusDot(studentId, examId) {
                    const exam = this.store.state.data.exams.find(e => e.id === examId);
                    if (!exam) return;
                    const rec = this.store.getScore(studentId, examId) || { details: {}, examAbsent: false };
                    const dot = Array.from(document.querySelectorAll('.score-status-dot')).find(el => el.dataset.sid === studentId && el.dataset.eid === examId);
                    if (!dot) return;
                    const isExamAbsent = rec.examAbsent === true;
                    const rowComplete = this._isScoreCompleteForExam(studentId, exam);
                    const enteredCount = (exam.types || []).filter(t => this._isEntryFieldFilled(rec, exam, t)).length;
                    const statusState = isExamAbsent ? 'absent' : (rowComplete ? 'complete' : (enteredCount > 0 ? 'partial' : 'empty'));
                    const statusTitle = isExamAbsent ? '缺考：点击取消缺考标记' : (rowComplete ? '已完成：点击标记缺考' : (enteredCount > 0 ? '未填写完：点击标记缺考' : '未填写：点击标记缺考'));
                    dot.className = `score-status-dot score-status-dot--${statusState}`;
                    dot.title = statusTitle;
                    dot.setAttribute('aria-label', statusTitle);
                    const row = dot.closest('tr');
                    if (row) row.classList.toggle('exam-absent-row', isExamAbsent);
                }

                toggleExamEntryMode(eid) {
                    const exam = this.store.state.data.exams.find(e => e.id === eid);
                    if (!exam) return;
                    if (!this._hasCountEntryTypes(exam.types)) return Utils.msg('请先在题型设置中填写客观题题数', 'error');
                    this.store.pushSnapshot();
                    exam.entryMode = exam.entryMode === 'count' ? 'score' : 'count';
                    exam._ts = Date.now();
                    let retained=0;
                    this.store.state.data.scores.filter(r=>r.examId===eid).forEach(record=>{
                        for (const type of exam.types || []) {
                            if (type.manualScore || !Number.isInteger(Number(type.questionCount)) || Number(type.questionCount)<=0) continue;
                            // Derive old score-only records when reading the cell;
                            // a mode switch must not create a newer score version.
                            if (record.details?.[type.name]!==undefined && window.gk2Statistics.inferCorrectCount(record,type)===null) retained++;
                        }
                    });
                    this.store.markAsUnsaved();
                    this.refresh();
                    Utils.msg(exam.entryMode === 'count'
                        ? '已切换为按正确题数录入，分数已自动换算为答对题数' + (retained ? `；${retained} 个题型的分数无法对应整数题数，原分数和总分已保留，请核对` : '，主观题仍按分数录入')
                        : '已切换为按题型分数录入，已有成绩已保留');
                }

                renderExamsWorkflow() {
                    const focus = this.store.state.globalFocus;
                    const container = document.getElementById('flat-exam-container');

                    let validExams = this.store.state.data.exams.filter(e => {
                        const examCampuses = this._getExamCampuses(e); 
                        if (focus.campuses.length > 0 && examCampuses.length > 0 && !examCampuses.some(c => focus.campuses.includes(c))) return false;
                        if (focus.grades.length > 0 && !focus.grades.includes(e.grade)) return false;
	                        if (focus.phases.length > 0) {
	                            const p = Utils.calculatePhase(e.grade, e.date);
	                            if (!focus.phases.includes(p)) return false;
	                        }
	                        if (focus.tClasses.length > 0) {
	                            const hasClassInRoster = this._getExamRosterStudents(e).some(s => {
	                                const classAtExam = Utils.getClassForExam(s, e);
	                                return focus.tClasses.includes(classAtExam.teachingClass);
	                            });
	                            if (!hasClassInRoster) return false;
	                        }
                        return true;
                    });

                    validExams.sort((a,b) => (b.date||'').localeCompare(a.date||''));

                    const openStates = new Set();
                    document.querySelectorAll('#flat-exam-container details.exam-card[open]').forEach(el => openStates.add(el.id));
                    
                    let html = '';
                    if (validExams.length === 0) {
                        html = Utils.getEmptyStateHTML('当前没有找到考试数据', '请检查左侧的筛选条件是否过严，或者点击右上角新建一场考试。', 'file');
                    } else {
                        validExams.forEach(ex => {
                            const eid = ex.id;
                            const phase = Utils.calculatePhase(ex.grade, ex.date);
                            const cardId = `e-card-${eid}`;
                            const isOpenAttr = openStates.has(cardId) ? 'open' : '';

                            let msHtml = `
                                <div class="exam-header-row">
                                    <div class="exam-header-actions">
                                        <button class="secondary btn--compact" onclick="event.preventDefault(); window.app.ui.openExamTemplateManager()">${window.gk2IconMarkup('edit')} 管理题型</button>
                                        <button class="secondary btn--compact" onclick="document.getElementById('file-import-exam-${eid}').click()">${window.gk2IconMarkup('upload')} 从 Excel 导入/更新成绩</button>
                                        <input type="file" id="file-import-exam-${eid}" class="is-hidden" accept=".xlsx, .xls" onchange="window.app.ui.importScoresToExistingExam(event, '${eid}')">
                                        <button class="secondary btn--danger-outline btn--compact" onclick="event.preventDefault(); window.app.ui.deleteExam('${eid}')">${window.gk2IconMarkup('trash')} 删除此场考试</button>
                                    </div>
                                </div>
                                <div id="e-tables-${eid}"></div>`; 

                            const displayCampuses = this._getExamCampuses(ex).map(Utils.escapeHTML);
                            const campStr = displayCampuses.length > 0 ? displayCampuses.join('、') : '全域';
                            const liankaoTag = displayCampuses.length > 1 ? ' <span class="exam-flag">[联考]</span>' : '';

                            const progress = this._getExamProgress(ex);
                            const progressHtml = `<span class="exam-progress-pill ${progress.complete ? 'complete' : ''}">${this._formatExamProgressText(progress)}</span>`;
                            html += `<details class="exam-card" id="${cardId}" ${isOpenAttr} ontoggle="if(this.open && !this.querySelector('table')) window.app?.ui?.renderExamTables('${eid}'); window.app?.ui?.updateToggleAllExamCardsBtnState();">
                                <summary class="exam-header">
                                    <div class="exam-title-wrap">
                                        <span style="font-size:16px;">${window.gk2IconMarkup('edit')} ${Utils.escapeHTML(ex.name)}</span>
                                        <span class="exam-meta"><span class="exam-meta-tag">${window.gk2IconMarkup('calendar')} ${Utils.escapeHTML(ex.date)}</span> <span class="exam-meta-tag" style="border-color:#c5ddf7; color:#1d4ed8; background:#edf5ff;">${window.gk2IconMarkup('building')} ${campStr}${liankaoTag}</span> <span class="exam-meta-tag">${window.gk2IconMarkup('target')} ${Utils.escapeHTML(ex.grade)} - ${Utils.escapeHTML(phase)}</span></span>
                                    </div>
                                    ${progressHtml}
                                </summary>
                                <div class="exam-card-body">
                                    ${msHtml}
                                </div>
                            </details>`;
                        });
                    }

                    container.innerHTML = html;
                    openStates.forEach(id => {
                        const eid = id.replace('e-card-', '');
                        if(document.getElementById(id)) this.renderExamTables(eid);
                    });
                    this.updateToggleAllExamCardsBtnState();
                }

                deleteExamClass(eid, campus, className) {
                    this.showConfirmDialog(
	                        `即将清空【${campus} - ${className}】考试【${this.store.state.data.exams.find(e=>e.id===eid)?.name||eid}】的成绩，影响 ${this.store.state.data.scores.filter(r=>r.examId===eid&&this.store.state.data.students.some(st=>{const at=Utils.getClassForExam(st,this.store.state.data.exams.find(e=>e.id===eid));return st.id===r.studentId&&at.campus===campus&&at.teachingClass===className;})).length} 人。可在本次打开期间使用“撤销”恢复；关闭页面后撤销记录不保留。${window.app?.sync?.isEnabled && window.app.sync.isEnabled() ? '\n\n当前云同步已开启：清空结果会同步到其他设备。' : ''}`,
	                        () => {
	                            this.store.pushSnapshot();
	                            const exam = this.store.state.data.exams.find(e => e.id === eid);
	                            const targetStudentIds = this.store.state.data.students
                                .filter(s => {
                                    const classAtExam = Utils.getClassForExam(s, exam);
                                    return classAtExam.campus === campus && classAtExam.teachingClass === className;
                                })
	                                .map(s => s.id);
	                            const ts = Date.now();
	                            this.store.state.data.scores
	                                .filter(s => s.examId === eid && targetStudentIds.includes(s.studentId))
	                                .forEach(s => this.store.markScoreDeleted(s, ts));

	                            this.store.state.data.scores = this.store.state.data.scores.filter(s => {
	                                if (s.examId === eid && targetStudentIds.includes(s.studentId)) return false; 
                                return true; 
                            });

                            this.store.save();
                            this.renderExamTables(eid);
                            Utils.msg(`已清空 ${campus} - ${className} 的所有成绩数据`, 'success', true);
                        }
                    );
                }

                _renderExamEntryStats(exam, students) {
                    const eid = exam.id;
                    let statsHtml = `<tr><td colspan="3" class="table-side-note" style="font-weight:700;">录入进度与均分</td>`;
                    
                    // 计算预估分均分与录入进度
                    const estVals = students.map(stu => {
                        const rec = this.store.getScore(stu.id, eid);
                        if (rec && rec.examAbsent) return null;
                        const v = rec ? parseFloat(rec.estimatedTotal) : NaN;
                        return isNaN(v) ? null : v;
                    }).filter(v => v !== null);
                    const estEffective = students.filter(stu => {
                        const rec = this.store.getScore(stu.id, eid);
                        return !(rec && rec.examAbsent);
                    }).length;
                    const estAvg = estVals.length ? (estVals.reduce((a,b)=>a+b,0) / estVals.length).toFixed(1) : '-';
                    statsHtml += `<td class="table-side-note" style="background: var(--warning-soft); font-weight:700; color:#9a6700;">已填 ${estVals.length}/${estEffective}<br>均分 ${estAvg}</td>`;

                    (exam.types || []).forEach(t => {
                        const vals = students.map(stu => {
                            const rec = this.store.getScore(stu.id, eid);
                            if (rec && rec.examAbsent) return null;
                            if (!this._isEntryFieldFilled(rec, exam, t)) return null;
                            const v = rec && rec.details ? parseFloat(rec.details[t.name]) : NaN;
                            return isNaN(v) ? null : v;
                        }).filter(v => v !== null);
                        const effectiveTotal = students.filter(stu => {
                            const rec = this.store.getScore(stu.id, eid);
                            return !(rec && rec.examAbsent);
                        }).length;
                        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(1) : '-';
                        statsHtml += `<td class="table-side-note">已填 ${vals.length}/${effectiveTotal}<br>均分 ${avg}</td>`;
                    });
                    const totalVals = students.map(stu => {
                        const rec = this.store.getScore(stu.id, eid);
                        if (rec && rec.examAbsent) return null;
                        if (!this._isScoreCompleteForExam(stu.id, exam)) return null;
                        const v = rec ? parseFloat(rec.total) : NaN;
                        return isNaN(v) ? null : v;
                    }).filter(v => v !== null);
                    const totalEffective = students.filter(stu => {
                        const rec = this.store.getScore(stu.id, eid);
                        return !(rec && rec.examAbsent);
                    }).length;
                    const totalAvg = totalVals.length ? (totalVals.reduce((a,b)=>a+b,0) / totalVals.length).toFixed(1) : '-';
                    statsHtml += `<td class="table-side-note" style="font-weight:700; color:var(--primary);">已填 ${totalVals.length}/${totalEffective}<br>均分 ${totalAvg}</td></tr>`;
                    return statsHtml;
                }

                renderExamTables(eid) {
                    const wrapper = document.getElementById(`e-tables-${eid}`);
                    if(!wrapper) return;
                    
                    const exam = this.store.state.data.exams.find(e => e.id === eid);
                    if (!exam) return;

                    const isFirstRender = wrapper.innerHTML.trim() === '';
                    const openTables = new Set();
                    if (!isFirstRender) {
                        document.querySelectorAll(`#e-tables-${eid} details[open]`).forEach(el => openTables.add(el.id));
                    }
                    
                    let targetStudents = this._getExamRosterStudents(exam);
                    
                    if(targetStudents.length === 0) {
                        wrapper.innerHTML = `<div class="table-centered-note">当前考试暂无可录入班级名单，请前往“名单管理”添加对应的学生。</div>`;
                        return;
                    }
                    
                    const groups = {};
                    targetStudents.forEach(s => {
                        const classAtExam = Utils.getClassForExam(s, exam);
                        const clsKey = `${classAtExam.campus} - ${classAtExam.teachingClass}`;
                        if(!groups[clsKey]) groups[clsKey] = { campus: classAtExam.campus, className: classAtExam.teachingClass, students: [] };
                        groups[clsKey].students.push(s);
                    });
                    
                    let html = '';
                    const sortedGroups = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh-CN', {numeric: true}));
                    const isSingleClassRoster = sortedGroups.length === 1;

                    sortedGroups.forEach(clsKey => {
                        const groupData = groups[clsKey];
                        const cls = groupData.className;
                        const campus = groupData.campus;
                        const students = groupData.students;
                        
                        const detailsId = `e-tables-${eid}-camp-${campus}-cls-${cls}`;
                        const isOpenAttr = (isFirstRender || openTables.has(detailsId)) ? 'open' : '';
                        
                        html += `<details class="tree-level gk2-entry-class-group" id="${detailsId}" data-campus="${Utils.escapeHTML(campus)}" data-teaching-class="${Utils.escapeHTML(cls)}" data-gk2-entry-class-status ${isOpenAttr}>
                            <summary class="tree-summary flat-acc justify-between">
                                <div class="gk2-entry-class-heading"><span class="text-primary gk2-entry-campus"><svg class="gk2-campus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 21V3h16v18 M8 7h2 M14 7h2 M8 11h2 M14 11h2 M9 21v-6h6v6"/></svg> ${Utils.escapeHTML(campus)}</span><strong class="gk2-entry-class-name">${Utils.escapeHTML(cls)}</strong><span class="auto-calc-badge">共 ${students.length} 人</span><span class="gk2-entry-class-stats" data-gk2-entry-class-stats aria-label="本班录入情况"></span></div>
                                <button class="danger btn--danger-outline" onclick="event.preventDefault(); window.app.ui.deleteExamClass('${eid}', '${Utils.escapeHTML(campus)}', '${Utils.escapeHTML(cls)}')">清空本班数据</button>
                            </summary>`;
                        
                        html += `<div class="tree-table-wrapper flat-wrap table-scroll-container${isSingleClassRoster ? ' gk2-entry-single-class' : ''}"><table class="gk2-entry-score-table" style="min-width:${Math.max(1048, 571 + (exam.types || []).length * 98)}px">
                            <thead><tr>
                                <th class="sticky-col-left header-sticky-100">学生姓名</th>
                                <th class="header-sticky-80">校区</th>
                                <th class="header-sticky-80">原班级</th>
                                <th class="header-sticky-80 score-estimated-header" style="color: var(--score-pass); background: var(--warning-soft);">考前预估总分</th>`;
                            (exam.types || []).forEach(t => {
                                const countMode = this._isCountEntryField(exam, t);
                                const fieldMax = countMode ? Number(t.questionCount) : Number(t.max);
                                const quickFillLabel = countMode ? '题数' : '分数';
                                const hasQuestionCount = Number.isInteger(Number(t.questionCount)) && Number(t.questionCount) > 0;
                                const typeSummary = `${t.name}：${t.max}分${hasQuestionCount ? `/${t.questionCount}题` : ''}`;
                                html += `<th><div class="gk2-entry-type-header"><span class="gk2-entry-type-heading">${Utils.escapeHTML(typeSummary)}</span><button class="secondary btn--tiny gk2-entry-type-quickfill" onclick="event.preventDefault(); window.app.ui.quickFillScoreColumn(this, '${eid}', '${String(t.name).replace(/'/g, "\\'")}', ${fieldMax||0})">快速填充${quickFillLabel}</button></div></th>`;
                            });
                            html += `<th class="header-sticky-120" style="color: var(--primary);">实际获得总分</th></tr></thead><tbody class="gk2-entry-anchor-reserve" aria-hidden="true" hidden><tr><td colspan="${(exam.types || []).length + 5}"></td></tr></tbody><tbody class="gk2-entry-present-body">`;
                        
                        const rowHtmlArr = [], absentRowHtmlArr = [];
                        students.sort((a,b) => {
                            const classA = String(a.adminClass || '').trim();
                            const classB = String(b.adminClass || '').trim();
                            const cmp = classA.localeCompare(classB, 'zh-CN', {numeric: true});
                            if (cmp !== 0) return cmp;
                            return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
                        }).forEach((stu, entryOrder) => {
                            const rec = this.store.getScore(stu.id, eid) || {details:{}, total:0, estimatedTotal:0, examAbsent:false};
                            const isExamAbsent = rec.examAbsent === true;
                            
                            let deltaHtml = '';
                            if (rec.estimatedTotal > 0 && Utils.isActualScore(rec, exam)) {
                                let diff = rec.total - rec.estimatedTotal;
                                if (diff > 0) deltaHtml = `<br><span class="text-success" style="font-size:11px; font-weight:bold;">超出目标 +${diff}</span>`;
                                else if (diff < 0) deltaHtml = `<br><span class="text-danger" style="font-size:11px; font-weight:bold;">未达目标 ${diff}</span>`;
                                else deltaHtml = `<br><span class="table-side-note" style="font-weight:bold;">精准达成</span>`;
                            }

                            const safeStudentName = Utils.escapeHTML(stu.name);
                            const safeStudentCampus = Utils.escapeHTML(stu.campus || '-');
                            const safeStudentAdminClass = Utils.escapeHTML(stu.adminClass || '-');
                            const classAtExam = Utils.getClassForExam(stu, exam);
                            const transferMark = Utils.hasTransferred(stu) && (classAtExam.campus !== stu.campus || classAtExam.teachingClass !== stu.teachingClass)
                                ? `<span title="该生当前已转至 ${Utils.escapeHTML(stu.teachingClass)}" style="color:#9a6700; margin-left:4px;">${window.gk2IconMarkup('swap')}</span>`
                                : '';
                            const rowComplete = this._isScoreCompleteForExam(stu.id, exam);
                    const enteredCount = (exam.types || []).filter(t => this._isEntryFieldFilled(rec, exam, t)).length;
                            const statusState = isExamAbsent ? 'absent' : (rowComplete ? 'complete' : (enteredCount > 0 ? 'partial' : 'empty'));
                            const statusTitle = isExamAbsent ? '缺考：点击取消缺考标记' : (rowComplete ? '已完成：点击标记缺考' : (enteredCount > 0 ? '未填写完：点击标记缺考' : '未填写：点击标记缺考'));
                            let trHtml = `<tr data-gk2-entry-student="${Utils.escapeHTML(stu.id)}" data-gk2-entry-order="${entryOrder}" class="${isExamAbsent ? 'exam-absent-row' : ''}">
                                <td class="sticky-col-left" style="font-weight:600; color:#1d1d1f;"><button type="button" class="score-status-dot score-status-dot--${statusState}" data-sid="${stu.id}" data-eid="${eid}" onclick="event.preventDefault(); event.stopPropagation(); window.app.ui.toggleExamAbsent('${stu.id}','${eid}',this)" title="${statusTitle}" aria-label="${statusTitle}"></button>${safeStudentName}${transferMark}</td>
                                <td class="table-side-note">${safeStudentCampus}</td>
                                <td class="table-side-note">${safeStudentAdminClass}</td>`;
                            
                            trHtml += `<td class="score-cell" style="background: var(--warning-soft);"><input type="text" inputmode="decimal" pattern="[0-9]+([.][0-9]+)?" class="score-input" aria-label="${safeStudentName} 的考前预估总分" data-sid="${stu.id}" data-eid="${eid}" data-type="estimated" ${isExamAbsent ? 'disabled' : ''} value="${!isExamAbsent && rec.estimatedTotal !== undefined && rec.estimatedTotal !== null && String(rec.estimatedTotal).trim() !== '' ? rec.estimatedTotal : ''}"><span class="score-warning"></span></td>`;

                            (exam.types || []).forEach(t => {
                                const safeTName = String(t.name).replace(/"/g, '&quot;');
                                const countMode = this._isCountEntryField(exam, t);
                                const fieldMax = countMode ? Number(t.questionCount) : Number(t.max);
                                const fieldValue = this._getEntryInputValue(rec, exam, t);
                                const entryKind = countMode ? 'count' : 'score';
                                const inputLabel = countMode ? `${t.name} 正确题数（共 ${t.questionCount} 题）` : `${t.name} 分数（满分 ${t.max}）`;
                                const inputValue = !isExamAbsent ? fieldValue : '';
                                const inputHtml = `<input type="text" inputmode="${countMode ? 'numeric' : 'decimal'}" pattern="${countMode ? '[0-9]*' : '[0-9]+([.][0-9]+)?'}" placeholder="${countMode ? (fieldValue==='' && rec.details?.[t.name]!==undefined ? '保留原分' : '题数') : ''}" class="score-input" aria-label="${safeStudentName} 的 ${Utils.escapeHTML(inputLabel)}" data-sid="${stu.id}" data-eid="${eid}" data-type="detail" data-entry-kind="${entryKind}" data-field="${safeTName}" data-max="${fieldMax}" data-score-max="${t.max}" data-question-count="${Number(t.questionCount)||''}" ${isExamAbsent ? 'disabled' : ''} value="${inputValue}">`;
                                const previewScore = countMode && !isExamAbsent ? (this._getCountEntryScorePreview(inputValue, t.max, t.questionCount) ?? rec.details?.[t.name] ?? null) : null;
                                const inputControlHtml = countMode
                                    ? `<div class="gk2-count-entry-control">${inputHtml}<span class="gk2-count-score-preview${previewScore === null ? ' is-empty' : ''}" data-gk2-count-score data-score-value="${previewScore === null ? '' : previewScore}" aria-label="折算分数" aria-live="off">${previewScore === null ? '—' : this._formatCountEntryScorePreview(previewScore)}</span></div>`
                                    : inputHtml;
                                trHtml += `<td class="score-cell${countMode ? ' gk2-count-entry-cell' : ''}">${inputControlHtml}<span class="score-warning"></span></td>`;
                            });
                            trHtml += `<td class="gk2-entry-total-cell" style="font-weight:800; color:var(--primary); font-size:16px;"><span id="t-${stu.id}">${isExamAbsent ? '<span class="exam-absent-pill">缺考</span>' : Number(rec.total || 0).toFixed(1)}</span><button type="button" class="gk2-score-reset-trigger" data-sid="${stu.id}" data-eid="${eid}" aria-label="清空 ${safeStudentName} 本次考试成绩" aria-haspopup="dialog" aria-controls="gk2-score-reset-popover" aria-expanded="false" title="清空本次考试成绩">${window.gk2IconMarkup('reset')}</button><span id="delta-${stu.id}">${deltaHtml}</span></td></tr>`;
                            (isExamAbsent ? absentRowHtmlArr : rowHtmlArr).push(trHtml);
                        });
                        const statsHtml = this._renderExamEntryStats(exam, students);
                        const absentBodyId = Utils.escapeHTML(detailsId + '-absent');
                        const columns = (exam.types || []).length + 5;
                        html += rowHtmlArr.join('') + `</tbody><tbody class="gk2-entry-stats">${statsHtml}</tbody>
                            <tbody class="gk2-entry-absent-heading"><tr><td colspan="${columns}">
                                <button type="button" class="gk2-entry-absent-toggle" aria-expanded="false" aria-controls="${absentBodyId}" ${absentRowHtmlArr.length ? '' : 'disabled'}>
                                    <span class="gk2-entry-absent-label">${window.gk2IconMarkup('chevron-down')}<strong>缺考人员</strong><b data-gk2-absent-count>${absentRowHtmlArr.length} 人</b><span data-gk2-absent-hint>展开名单</span></span>
                                </button>
                            </td></tr></tbody>
                            <tbody id="${absentBodyId}" class="gk2-entry-absent-body" hidden>${absentRowHtmlArr.join('')}</tbody>
                        </table></div></details>`;
                    });
                    
                    wrapper.innerHTML = html;
                    this._bindScrollShadows(wrapper);
                    // 分数输入沿用热力色；题数输入保持黑字白底，热力色只用于旁侧折算分。
                    wrapper.querySelectorAll('.score-input[data-max]:not([data-entry-kind="count"])').forEach(input => {
                        if (input.value !== null && input.value !== undefined && String(input.value).trim() !== '') {
                            Utils.setScoreHeatColor(input, input.value, parseFloat(input.dataset.max) || 0);
                            this._updateScoreExtremeHint(input);
                        }
                    });
                    wrapper.querySelectorAll('.score-input[data-entry-kind="count"]').forEach(input => this._updateCountEntryScorePreview(input));
                    wrapper.oninput = (event) => {
                        const target = event.target;
                        if (!target || !target.classList.contains('score-input')) return;
                        const sid = target.dataset.sid;
                        const eid = target.dataset.eid;
                        const type = target.dataset.type;
                        if (!sid || !eid || !type) return;
                        const value = target.value;
                        const isCountInput = target.dataset.type === 'detail' && target.dataset.entryKind === 'count';
                        if (value === '') {
                            if (isCountInput) this._updateCountEntryScorePreview(target);
                            target.classList.remove('over-limit');
                            this._setScoreWarning(target, '');
                            this._updateScoreExtremeHint(target);
                            target.style.backgroundColor = '';
                            target.style.color = 'var(--text-main)';
                            if (type === 'estimated') window.app.ui.saveEstimated(sid, eid, '', target);
                            else if (isCountInput) window.app.ui.saveCorrectCount(sid, eid, target.dataset.field || '', '', `t-${sid}`, parseFloat(target.dataset.max) || 0, parseFloat(target.dataset.scoreMax) || 0, target);
                            else window.app.ui.saveVal(sid, eid, target.dataset.field || '', '', `t-${sid}`, parseFloat(target.dataset.max) || 0, target);
                            return;
                        }
                        if (isCountInput && !/^\d*$/.test(value)) {
                            target.value = value.replace(/\D/g, '');
                            this._updateCountEntryScorePreview(target);
                            this._signalScoreInputError(target);
                            this._setScoreWarning(target, '正确题数只能输入整数');
                            return;
                        }
                        if (!isCountInput && !/^\d*(?:\.\d*)?$/.test(value)) {
                            target.value = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
                            this._signalScoreInputError(target);
                            this._setScoreWarning(target, '仅可输入数字');
                            return;
                        }
                        
                        if (!window.gk2Policy.score(value) || (isCountInput && (!Number.isInteger(Number(value)) || Number(value) > (parseFloat(target.dataset.max) || 0)))) {
                            if (isCountInput) this._updateCountEntryScorePreview(target);
                            target.setAttribute('aria-invalid','true');
                            this._setScoreWarning(target, isCountInput ? `请输入 0–${target.dataset.max} 的整数，当前成绩未改变` : '请输入完整、有限的数字，当前成绩未改变');
                            return;
                        }
                        target.removeAttribute('aria-invalid');
                        // 检查超分
                        const max = parseFloat(target.dataset.max) || 0;
                        const numericVal = parseFloat(value);
                        if (max > 0 && numericVal > max && !isNaN(numericVal)) {
                            this._signalScoreInputError(target);
                            this._setScoreWarning(target, '超出满分');
                        } else {
                            target.classList.remove('over-limit');
                            this._setScoreWarning(target, '');
                        }
                        
                        if (type === 'estimated') {
                            window.app.ui.saveEstimated(sid, eid, value, target);
                            Utils.setScoreHeatColor(target, target.value, parseFloat(target.dataset.max) || 0);
                            this._updateScoreExtremeHint(target);
                        } else if (type === 'detail' && isCountInput) {
                            const field = target.dataset.field || '';
                            this._updateCountEntryScorePreview(target, true);
                            window.app.ui.saveCorrectCount(sid, eid, field, value, `t-${sid}`, max, parseFloat(target.dataset.scoreMax) || 0, target);
                            this._updateScoreExtremeHint(target);
                        } else if (type === 'detail') {
                            const field = target.dataset.field || '';
                            const max = parseFloat(target.dataset.max) || 0;
                            window.app.ui.saveVal(sid, eid, field, value, `t-${sid}`, max, target);
                            Utils.setScoreHeatColor(target, target.value, parseFloat(target.dataset.max) || 0);
                            this._updateScoreExtremeHint(target);
                        }
                    };
                    wrapper.onfocusin = (event) => {
                        const target = event.target;
                        if (!target || !target.classList.contains('score-input')) return;
                        this._highlightScoreCross(target);
                        this._openScoreMobilePad(target);
                    };
	                    wrapper.onfocusout = (event) => {
                        const input=event.target;
                        const countInput = input?.dataset?.entryKind === 'count';
                        const countInvalid = countInput && input.value !== '' && (!/^\d+$/.test(input.value) || Number(input.value) > (parseFloat(input.dataset.max) || 0));
                        if(input?.classList.contains('score-input')&&(!window.gk2Policy.score(input.value)||countInvalid)){
                            const record=this.store.getScore(input.dataset.sid,input.dataset.eid);
                            const exam=this.store.state.data.exams.find(e=>e.id===input.dataset.eid);
                            const value=input.dataset.type==='estimated'?record?.estimatedTotal:this._getEntryInputValue(record,exam,exam?.types?.find(t=>t.name===input.dataset.field));
                            input.value=value??'';input.removeAttribute('aria-invalid');if(countInput)this._updateCountEntryScorePreview(input);this._setScoreWarning(input,'未保存无效输入，已保留原成绩');
                        }

	                        if (!event.currentTarget.contains(event.relatedTarget)) this._clearScoreCross(event.currentTarget);
	                        setTimeout(() => {
	                            const activeScoreInput = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('score-input');
	                            if (this.pendingRemoteExamRefresh && !activeScoreInput) {
	                                this.pendingRemoteExamRefresh = false;
	                                this.refresh();
	                                Utils.msg("已刷新其他老师同步的更新", "success");
	                            }
	                        }, 120);
	                    };
                    wrapper.onbeforeinput = (event) => {
                        const target = event.target;
                        if (!target || !target.classList.contains('score-input')) return;
                        if (!event.data) return;
                        const isCountInput = target.dataset.type === 'detail' && target.dataset.entryKind === 'count';
                        if (isCountInput ? !/^[0-9]$/.test(event.data) : !/^[0-9.]$/.test(event.data)) {
                            event.preventDefault();
                            this._signalScoreInputError(target);
                            this._setScoreWarning(target, isCountInput ? '正确题数只能输入整数' : '仅可输入数字');
                        }
                    };
                    // 粘贴支持：带预览 / 自动对齐表头 / 超分处理
                    wrapper.addEventListener('paste', (e) => {
                        try {
                            const target = e.target;
                            if (!target || !target.classList.contains('score-input')) return;
                            e.preventDefault();
                            const raw = (e.clipboardData || window.clipboardData).getData('text') || '';
                            if (!raw) return;

                            // 解析为二维数组（行 -> 列），支持 \r\n, \n, \r 和制表符
                            let rows = raw.split(/\r\n|\n|\r/).filter(r => r.length > 0).map(r => r.split(/\t/));
                            const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

                            const startTd = target.closest('td');
                            const startTr = target.closest('tr');
                            if (!startTd || !startTr) return;
                            const tbody = startTr.parentElement;
                            if (!tbody) return;
                            const allRows = Array.from(tbody.querySelectorAll('tr'));
                            const startRowIndex = allRows.indexOf(startTr);

                            // 检测是否首行为题型表头（与 exam.types 对齐）
                            const sanitize = (s) => String(s || '').replace(/\s+/g, '').replace(/"|'/g, '').toLowerCase();
                            const typeNames = (exam.types || []).map(t => sanitize(t.name));
                            let headerMap = null;
                            if (rows.length > 0) {
                                const maybeHeader = rows[0];
                                let matches = 0;
                                headerMap = {};
                                maybeHeader.forEach((cell, idx) => {
                                    const s = sanitize(cell);
                                    const pos = typeNames.indexOf(s);
                                    if (pos >= 0) { headerMap[idx] = pos; matches++; }
                                });
                                if (matches === 0) headerMap = null; // not a header
                                else rows = rows.slice(1); // consume header row
                            }

                            // 单格粘贴：直接应用（无预览）
                            if (rows.length === 1 && maxCols === 1) {
                                const cellText = rows[0][0];
                                const rawVal = String(cellText || '').trim().replace(/，/g, ',').replace(/\s+/g, '');
                                const normalized = rawVal.replace(/,/g, '.');
                                const m = normalized.match(/[+-]?\d+(?:\.\d+)?/);
                                if (!m) return;
                                const val = m[0];
                                if (target.dataset.entryKind === 'count' && (!/^\d+$/.test(val) || Number(val) > (parseFloat(target.dataset.max) || 0))) return Utils.msg(`正确题数必须为 0–${target.dataset.max} 的整数`, 'error');
                                // 写入并触发保存
                                target.value = val;
                                const sid = target.dataset.sid;
                                const ieid = target.dataset.eid || eid;
                                const type = target.dataset.type;
                                if (type === 'estimated') {
                                    window.app.ui.saveEstimated && window.app.ui.saveEstimated(sid, ieid, val, target);
                                } else if (type === 'detail') {
                                    const field = target.dataset.field || '';
                                    const max = parseFloat(target.dataset.max) || 0;
                                    if (target.dataset.entryKind === 'count') window.app.ui.saveCorrectCount && window.app.ui.saveCorrectCount(sid, ieid, field, val, `t-${sid}`, max, parseFloat(target.dataset.scoreMax) || 0, target);
                                    else window.app.ui.saveVal && window.app.ui.saveVal(sid, ieid, field, val, `t-${sid}`, max, target);
                                }
                                return;
                            }

                            // 构建预览表格
                            const previewBody = document.getElementById('paste-preview-body');
                            const previewNote = document.getElementById('paste-preview-note');
                            if (!previewBody) return;

                            const baseTypesStartIndex = 4; // table: 0 name,1 campus,2 adminClass,3 estimated, types start at 4
                            const absentKeywords = ['缺考', '缺', '缺席', 'absent', '/', '-', '——'];
                            const isAbsentToken = (v) => absentKeywords.includes(String(v || '').trim().toLowerCase());
                            let colsCount = Math.max(...rows.map(r=>r.length));
                            let tableHtml = '<table class="table-shell table-shell--history">';
                            // header
                            tableHtml += '<thead><tr style="background:#fafafa;"><th>学生</th>';
                            for (let c=0;c<colsCount;c++){
                                let label = `列 ${c+1}`;
                                if (headerMap && headerMap[c] !== undefined) {
                                    label = (exam.types[headerMap[c]]||{name:label}).name;
                                } else {
                                    const tci = startTd.cellIndex + c;
                                    if (tci === 3) label = '考前预估总分';
                                    else if (tci >= baseTypesStartIndex) label = (exam.types[tci - baseTypesStartIndex]||{name:label}).name;
                                }
                                tableHtml += `<th>${label}</th>`;
                            }
                            tableHtml += '</tr></thead><tbody>';

                            // rows
                            rows.forEach((cols, rIdx) => {
                                const row = allRows[startRowIndex + rIdx];
                                const stuName = row ? (row.children[0]?.textContent || '') : '';
                                tableHtml += `<tr><td style="font-weight:600;">${stuName}</td>`;
                                for (let c=0;c<colsCount;c++){
                                    const cellText = cols[c] || '';
                                    // determine target cell index and real input metadata
                                    let targetCellIndex = startTd.cellIndex + c;
                                    if (headerMap && headerMap[c] !== undefined) {
                                        targetCellIndex = baseTypesStartIndex + headerMap[c];
                                    }
                                    const realRow = allRows[startRowIndex + rIdx];
                                    const realCell = realRow ? realRow.children[targetCellIndex] : null;
                                    const realInput = realCell?.querySelector?.('.score-input');

                                    let dataSid = realInput?.dataset?.sid || '';
                                    let dataType = realInput?.dataset?.type || 'detail';
                                    let dataField = realInput?.dataset?.field || '';
                                    let dataMax = parseFloat(realInput?.dataset?.max) || 0;

                                    // sanitize numeric
                                    const rawVal = String(cellText || '').trim().replace(/，/g, ',').replace(/\s+/g, '');
                                    const normalized = rawVal.replace(/,/g, '.');
                                    const m = normalized.match(/[+-]?\d+(?:\.\d+)?/);
                                    const displayVal = m ? m[0] : (isAbsentToken(rawVal) ? rawVal : '');
                                    const absentToken = !m && isAbsentToken(rawVal) ? '1' : '';

                                    const overClass = (displayVal !== '' && dataMax>0 && parseFloat(displayVal) > dataMax) ? 'style="outline:1px solid var(--danger); background:#fff7f7;"' : '';

                                    tableHtml += `<td><input class="preview-input" data-sid="${dataSid}" data-type="${dataType}" data-entry-kind="${realInput?.dataset?.entryKind || 'score'}" data-score-max="${realInput?.dataset?.scoreMax || ''}" data-field="${dataField}" data-max="${dataMax}" data-eid="${eid}" data-target-row="${startRowIndex + rIdx}" data-target-cell="${targetCellIndex}" data-score-absent-token="${absentToken}" value="${displayVal}" style="width:100%; padding:6px; border:1px solid var(--border); border-radius:4px;" ${overClass}></td>`;
                                }
                                tableHtml += '</tr>';
                            });

                            tableHtml += '</tbody></table>';
                            previewBody.innerHTML = tableHtml;
                            if (previewNote) previewNote.textContent = `预览 ${rows.length} 行 x ${colsCount} 列；首行 ${headerMap ? '已识别为题型表头并自动对齐' : '未检测到表头'}`;

                            const modal = document.getElementById('paste-preview-modal');
                            const confirmBtn = document.getElementById('paste-preview-confirm');
                            const cancelBtn = document.getElementById('paste-preview-cancel');
                            const undoBtn = document.getElementById('paste-preview-undo');
                            const truncateCheckbox = document.getElementById('paste-preview-truncate');
                            const overmaxListEl = document.getElementById('paste-preview-overmax');

                            // store initial preview state for undo
                            const previewInitial = {};
                            const previewLast = {};
                            const changeStack = [];

                            // initialize preview inputs metadata and initial state
                            Array.from(previewBody.querySelectorAll('.preview-input')).forEach(pi => {
                                const key = `${pi.dataset.targetRow}-${pi.dataset.targetCell}-${pi.dataset.eid}`;
                                previewInitial[key] = pi.value || '';
                                previewLast[key] = pi.value || '';
                            });

                            // render over-max list
                            const renderOverMax = () => {
                                const items = [];
                                Array.from(previewBody.querySelectorAll('.preview-input')).forEach(pi => {
                                    const val = (pi.value||'').toString().trim();
                                    const max = parseFloat(pi.dataset.max) || 0;
                                    if (val !== '' && max > 0 && !isNaN(parseFloat(val)) && parseFloat(val) > max) {
                                        const rowIdx = pi.dataset.targetRow;
                                        const cellIdx = pi.dataset.targetCell;
                                        const stuName = (allRows[rowIdx]?.children[0]?.textContent) || '';
                                        items.push({pi, rowIdx, cellIdx, stuName, val, max});
                                    }
                                });
                                if (!overmaxListEl) return;
                                if (items.length === 0) { overmaxListEl.innerHTML = ''; return; }
                                overmaxListEl.innerHTML = `<div class="table-side-note" style="font-weight:600; margin-bottom:6px;">检测到超分条目（点击定位）：</div>` + items.map((it, i) => `<div class="over-item table-note" style="padding:6px; border:1px dashed rgba(215,0,21,0.12); margin-bottom:6px; cursor:pointer;">${i+1}. ${it.stuName} — 值: ${it.val}，允许最大: ${it.max}</div>`).join('');
                                // bind click handlers
                                Array.from(overmaxListEl.querySelectorAll('.over-item')).forEach((el, idx) => {
                                    el.addEventListener('click', () => {
                                        const targetPi = items[idx].pi;
                                        targetPi.scrollIntoView({behavior:'smooth', block:'center'});
                                        targetPi.focus();
                                    });
                                });
                            };

                            // track changes in preview inputs
                            previewBody.addEventListener('input', (ev) => {
                                const pi = ev.target;
                                if (!pi || !pi.classList.contains('preview-input')) return;
                                const key = `${pi.dataset.targetRow}-${pi.dataset.targetCell}-${pi.dataset.eid}`;
                                const prev = previewLast[key] !== undefined ? previewLast[key] : previewInitial[key] || '';
                                const cur = (pi.value||'').toString();
                                changeStack.push({key, prev, cur, pi});
                                previewLast[key] = cur;
                                renderOverMax();
                            });

                            // undo last change
                            const undoLast = () => {
                                const last = changeStack.pop();
                                if (!last) return;
                                last.pi.value = last.prev;
                                previewLast[last.key] = last.prev;
                                renderOverMax();
                            };
                            undoBtn.addEventListener('click', undoLast);

                            // mapping selects: enhance header with mapping dropdowns
                            // create selects inside header cells
                            const headerCells = previewBody.querySelectorAll('thead th');
                            const mappingSelects = [];
                            for (let c=0;c<colsCount;c++) {
                                const th = headerCells[c+1]; // +1 because first is student name
                                if (!th) continue;
                                const selId = `paste-map-col-${c}`;
                                let selHtml = `<div class="mt-sm"><select id="${selId}" data-col="${c}" class="toolbar-select" style="font-size:12px; padding:4px;">`;
                                selHtml += `<option value="-1">不映射</option>`;
                                selHtml += `<option value="-2" selected>自动映射</option>`;
                                // estimated option
                                selHtml += `<option value="e_estimated">考前预估总分</option>`;
                                (exam.types || []).forEach((t, idx) => {
                                    selHtml += `<option value="${idx}">${t.name}</option>`;
                                });
                                selHtml += `</select></div>`;
                                th.innerHTML += selHtml;
                                mappingSelects.push(document.getElementById(selId));
                            }

                            // helper to update preview-inputs dataset when mapping changes
                            const applyMappingForCol = (col, mapVal) => {
                                const previewInputs = Array.from(previewBody.querySelectorAll('.preview-input')).filter(pi=>parseInt(pi.getAttribute('data-preview-col')||'-1')===col);
                                previewInputs.forEach(pi=>{
                                    let newTargetCell = parseInt(pi.dataset.targetCell) || parseInt(pi.dataset.targetCellOriginal) || (startTd.cellIndex + col);
                                    if (mapVal === '-1') {
                                        // unmap: set to a negative sentinel so confirm will skip
                                        pi.dataset.targetCell = -9999;
                                    } else if (mapVal === '-2') {
                                        // auto: revert to original target
                                        pi.dataset.targetCell = pi.dataset.targetCellOriginal || (startTd.cellIndex + col);
                                    } else if (mapVal === 'e_estimated') {
                                        pi.dataset.targetCell = 3; // estimated column index
                                    } else {
                                        const idx = parseInt(mapVal);
                                        if (!isNaN(idx)) {
                                            pi.dataset.targetCell = (baseTypesStartIndex + idx);
                                        }
                                    }
                                    // update dataset meta by probing real cell
                                    const trIdx = parseInt(pi.dataset.targetRow);
                                    const tc = parseInt(pi.dataset.targetCell);
                                    const realRow = allRows[trIdx];
                                    const realCell = realRow ? realRow.children[tc] : null;
                                    const realInput = realCell?.querySelector?.('.score-input');
                                    if (realInput) {
                                        pi.dataset.sid = realInput.dataset.sid || '';
                                        pi.dataset.type = realInput.dataset.type || '';
                                        pi.dataset.entryKind = realInput.dataset.entryKind || 'score';
                                        pi.dataset.scoreMax = realInput.dataset.scoreMax || '';
                                        pi.dataset.field = realInput.dataset.field || '';
                                        pi.dataset.max = realInput.dataset.max || '';
                                    }
                                });
                                renderOverMax();
                            };

                            // attach change listeners to mapping selects
                            mappingSelects.forEach(sel => {
                                if (!sel) return;
                                const col = sel.dataset.col;
                                sel.addEventListener('change', (ev) => {
                                    applyMappingForCol(parseInt(col), ev.target.value);
                                });
                            });

                            // mark preview inputs with preview col index and original target for mapping
                            Array.from(previewBody.querySelectorAll('.preview-input')).forEach((pi, idx) => {
                                const tr = pi.closest('tr');
                                const rowIndex = Array.from(previewBody.querySelectorAll('tbody tr')).indexOf(tr);
                                const previewCol = Array.from(tr.querySelectorAll('.preview-input')).indexOf(pi);
                                pi.dataset.previewCol = previewCol;
                                // store original target cell
                                if (!pi.dataset.targetCellOriginal) pi.dataset.targetCellOriginal = pi.dataset.targetCell;
                            });

                            renderOverMax();

                            const onDismiss = () => { if (!modal.open) cleanup(); };
                            const cleanup = () => {
                                modal.removeEventListener('close', onDismiss);
                                try { modal.close(); } catch(e){}
                                confirmBtn.removeEventListener('click', onConfirm);
                                cancelBtn.removeEventListener('click', onCancel);
                                undoBtn.removeEventListener('click', undoLast);
                            };

                            const onConfirm = () => {
                                this.store.pushSnapshot();
                                clearTimeout(this._scoreEditSnapshotTimer);
                                this._scoreEditSnapshotPushed = true;
                                const previewInputs = Array.from(previewBody.querySelectorAll('.preview-input'));
                                const doTruncate = !!(truncateCheckbox && truncateCheckbox.checked);
                                const invalidCount = previewInputs.find(pi => {
                                    if (pi.dataset.entryKind !== 'count' || !String(pi.value || '').trim()) return false;
                                    const value = String(pi.value).trim(), max = parseFloat(pi.dataset.max) || 0;
                                    return !/^\d+$/.test(value) || (!doTruncate && Number(value) > max);
                                });
                                if (invalidCount) { invalidCount.focus(); return Utils.msg(`正确题数必须为 0–${invalidCount.dataset.max} 的整数`, 'error'); }
                                const absentRows = new Set();
                                const rowsByTarget = {};
                                previewInputs.forEach(pi => {
                                    const targetRowIdx = parseInt(pi.dataset.targetRow);
                                    const targetCellIdx = parseInt(pi.dataset.targetCell);
                                    if (isNaN(targetRowIdx) || isNaN(targetCellIdx) || targetCellIdx < baseTypesStartIndex) return;
                                    if (!rowsByTarget[targetRowIdx]) rowsByTarget[targetRowIdx] = [];
                                    rowsByTarget[targetRowIdx].push(pi);
                                });
                                Object.keys(rowsByTarget).forEach(rowIdx => {
                                    const detailInputs = rowsByTarget[rowIdx].filter(pi => parseInt(pi.dataset.targetCell) >= baseTypesStartIndex);
                                    if (detailInputs.length > 0 && detailInputs.every(pi => pi.dataset.scoreAbsentToken === '1')) {
                                        const realRow = allRows[parseInt(rowIdx)];
                                        const statusDot = realRow?.querySelector?.('.score-status-dot');
                                        if (statusDot) {
                                            this.toggleExamAbsent(statusDot.dataset.sid, statusDot.dataset.eid || eid, true);
                                            absentRows.add(String(rowIdx));
                                        }
                                    }
                                });

                                previewInputs.forEach(pi => {
                                    if (absentRows.has(String(pi.dataset.targetRow))) return;
                                    const valStr = (pi.value || '').toString().trim();
                                    if (valStr === '') return;
                                    const targetRowIdx = parseInt(pi.dataset.targetRow);
                                    const targetCellIdx = parseInt(pi.dataset.targetCell);
                                    if (isNaN(targetCellIdx) || targetCellIdx < 0) return; // unmapped
                                    const realRow = allRows[targetRowIdx];
                                    const realCell = realRow ? realRow.children[targetCellIdx] : null;
                                    const realInput = realCell?.querySelector?.('.score-input');
                                    if (!realInput) return;
                                    const sid = realInput.dataset.sid;
                                    const ieid = realInput.dataset.eid || eid;
                                    const type = realInput.dataset.type;
                                    const field = realInput.dataset.field || '';
                                    const max = parseFloat(realInput.dataset.max) || 0;
                                    let vnormalized = valStr.replace(/，/g, ',').replace(/\s+/g, '').replace(/,/g, '.');
                                    const m = vnormalized.match(/[+-]?\d+(?:\.\d+)?/);
                                    if (!m) return;
                                    let v = m[0];
                                    if (doTruncate && max > 0 && parseFloat(v) > max) v = String(max);
                                    if (type === 'estimated') {
                                        window.app.ui.saveEstimated && window.app.ui.saveEstimated(sid, ieid, v, realInput);
                                    } else if (realInput.dataset.entryKind === 'count') {
                                        window.app.ui.saveCorrectCount && window.app.ui.saveCorrectCount(sid, ieid, field, v, `t-${sid}`, max, parseFloat(realInput.dataset.scoreMax) || 0, realInput);
                                    } else {
                                        window.app.ui.saveVal && window.app.ui.saveVal(sid, ieid, field, v, `t-${sid}`, max, realInput);
                                    }
                                });
                                cleanup();
                            };

                            const onCancel = () => { cleanup(); Utils.msg('已取消粘贴操作', 'info'); };

                            confirmBtn.addEventListener('click', onConfirm);
                            cancelBtn.addEventListener('click', onCancel);
                            modal.addEventListener('close', onDismiss);
                            try { modal.showModal(); } catch(e) { /* dialog not supported */ }

                        } catch (err) {
                            console.warn('paste handler error', err);
                        }
                    });
                    wrapper.onkeydown = (event) => {
                        const target = event.target;
                        if (!target || !target.classList.contains('score-input')) return;

                        const focusAndSelect = (input) => {
                            if (!input || input.disabled) return false;
                            input.focus();
                            input.select();
                            return true;
                        };
                        const findInputByCell = (row, cellIndex) => {
                            if (!row || cellIndex < 0) return null;
                            return row.children[cellIndex]?.querySelector?.('.score-input:not(:disabled)') || null;
                        };
                        const moveVertical = (direction) => {
                            const currentTd = target.closest('td');
                            const currentTr = target.closest('tr');
                            if (!currentTd || !currentTr) return false;
                            const tbody = currentTr.parentElement;
                            if (!tbody) return false;
                            const rows = Array.from(tbody.querySelectorAll('tr'));
                            const rowIndex = rows.indexOf(currentTr);
                            for (let i = rowIndex + direction; i >= 0 && i < rows.length; i += direction) {
                                const nextInput = findInputByCell(rows[i], currentTd.cellIndex);
                                if (nextInput) return focusAndSelect(nextInput);
                            }
                            return false;
                        };
                        const moveHorizontal = (direction) => {
                            const currentTr = target.closest('tr');
                            if (!currentTr) return false;
                            const inputsInRow = Array.from(currentTr.querySelectorAll('.score-input:not(:disabled)'));
                            const idx = inputsInRow.indexOf(target);
                            if (idx < 0) return false;
                            return focusAndSelect(inputsInRow[idx + direction]);
                        };

                        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                            event.preventDefault();
                            if (event.key === 'ArrowUp') moveVertical(-1);
                            else if (event.key === 'ArrowDown') moveVertical(1);
                            else if (event.key === 'ArrowLeft') moveHorizontal(-1);
                            else if (event.key === 'ArrowRight') moveHorizontal(1);
                            return;
                        }

                        if (event.key === 'Enter') {
                            event.preventDefault();
                            moveVertical(event.shiftKey ? -1 : 1);
                            return;
                        }

                        if (event.key === 'Tab') {
                            event.preventDefault();
                            const moved = moveHorizontal(event.shiftKey ? -1 : 1);
                            if (!moved) moveVertical(event.shiftKey ? -1 : 1);
                        }
                    };
                    wrapper.onblur = (event) => {
                        const target = event.target;
                        if (!target || !target.classList.contains('score-input')) return;
                        
                        // blur 时移除抖动动画，但保持红色边框如果仍超分
                        target.classList.remove('over-limit');
                        const max = parseFloat(target.dataset.max) || 0;
                        const numericVal = parseFloat(target.value);
                        if (max > 0 && numericVal > max && !isNaN(numericVal)) {
                            target.style.borderBottomColor = 'var(--danger)';
                            this._signalScoreInputError(target);
                            this._setScoreWarning(target, target.dataset.entryKind === 'count' ? '超过题数上限' : '超出满分');
                        } else if (String(target.value || '').trim() !== '' && !isNaN(numericVal)) {
                            this._setScoreWarning(target, '');
                            this._updateScoreExtremeHint(target);
                            this._flashScoreOk(target);
                        } else {
                            target.style.borderBottomColor = '';
                            this._setScoreWarning(target, '');
                            this._updateScoreExtremeHint(target);
                        }
                    };
                }

                _updateDeltaHTML(sid, r, scopeEl = null) {
                    const row = scopeEl && scopeEl.closest ? scopeEl.closest('tr') : null;
                    const deltaEl = (row && row.querySelector(`#delta-${sid}`)) || document.getElementById(`delta-${sid}`);
                    if (deltaEl) {
                        if (r.estimatedTotal > 0 && Utils.isActualScore(r)) {
                            let diff = r.total - r.estimatedTotal;
                            if (diff > 0) deltaEl.innerHTML = `<br><span style="font-size:11px; color: var(--success); font-weight:bold;">超出目标 +${diff}</span>`;
                            else if (diff < 0) deltaEl.innerHTML = `<br><span style="font-size:11px; color: var(--danger); font-weight:bold;">未达目标 ${diff}</span>`;
                            else deltaEl.innerHTML = `<br><span style="font-size:11px; color: #6e6e73; font-weight:bold;">精准达成</span>`;
                        } else {
                            deltaEl.innerHTML = '';
                        }
                    }
                }

                _updateScoreExtremeHint(input) {
                    const cell = input && input.closest ? input.closest('.score-cell') : null;
                    if (!cell) return;
                    const max = parseFloat(input.dataset.max) || 0;
                    const raw = String(input.value || '').trim();
                    const value = parseFloat(raw);
                    const needsCheck = max > 0 && raw !== '' && !isNaN(value) && value <= max && ((value > 0 && value < max * 0.2) || value === max);
                    cell.classList.toggle('score-cell-needs-check', needsCheck);
                    if (needsCheck) {
                        input.title = input.dataset.entryKind === 'count'
                            ? (value === max ? '请确认：正确题数已达题数上限' : '请确认：正确题数低于总题数的20%')
                            : (value === max ? '请确认：该题型为满分' : '请确认：该分数低于满分的20%');
                    } else if (['请确认：该题型为满分','请确认：该分数低于满分的20%','请确认：正确题数已达题数上限','请确认：正确题数低于总题数的20%'].includes(input.title)) {
                        input.removeAttribute('title');
                    }
                }

                _setScoreWarning(input, message = '') {
                    const cell = input && input.closest ? input.closest('.score-cell') : null;
                    if (!cell) return;
                    const warning = cell.querySelector('.score-warning');
                    cell.classList.toggle('has-warning', !!message);
                    if (warning) warning.textContent = message;
                }

                _signalScoreInputError(input) {
                    if (input && input.classList) {
                        input.classList.remove('over-limit');
                        void input.offsetWidth;
                        input.classList.add('over-limit');
                    }
                    try {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([50]);
                    } catch(e) {}
                }

                _flashScoreOk(input) {
                    const cell = input && input.closest ? input.closest('.score-cell') : null;
                    if (!cell) return;
                    const old = cell.querySelector('.score-ok-flash');
                    if (old) old.remove();
                    const ok = document.createElement('span');
                    ok.className = 'score-ok-flash';
                    ok.innerHTML = window.gk2IconMarkup('check');
                    cell.appendChild(ok);
                    setTimeout(() => { try { ok.remove(); } catch(e){} }, 750);
                }

                quickFillScoreColumn(btn, eid, field, max) {
                    const table = btn.closest('.gk2-sticky-table-shell')?.querySelector('.table-scroll-container > table') || btn.closest('table');
                    const sampleInput = Array.from(table?.querySelectorAll('.score-input') || []).find(input => input.dataset.eid === eid && input.dataset.field === field);
                    const isCount = sampleInput?.dataset.entryKind === 'count';
                    const val = prompt(`为【${field}】所有空单元格填充${isCount ? '正确题数' : '分数'}：`, String(max || ''));
                    if (val === null || val === '') return;
                    const num = parseFloat(val);
                    if (isCount && !Number.isInteger(num)) return Utils.msg('正确题数必须为整数', 'error');
                    if (isNaN(num) || num < 0 || (max > 0 && num > max)) return Utils.msg(`请输入不超过${isCount ? '题数上限' : '满分'}的数字`, 'error');
                    if (!table) return;
                    let count = 0;
                    const escField = window.CSS && CSS.escape ? CSS.escape(field) : String(field).replace(/"/g, '\"');
                    table.querySelectorAll(`.score-input:not(:disabled)[data-eid="${eid}"][data-field="${escField}"]`).forEach(input => {
                        if (String(input.value || '').trim() !== '') return;
                        input.value = String(num);
                        if (isCount) this.saveCorrectCount(input.dataset.sid, eid, field, String(num), `t-${input.dataset.sid}`, max, parseFloat(input.dataset.scoreMax) || 0, input);
                        else this.saveVal(input.dataset.sid, eid, field, String(num), `t-${input.dataset.sid}`, max, input);
                        if (isCount) this._updateCountEntryScorePreview(input);
                        else Utils.setScoreHeatColor(input, input.value, max);
                        this._flashScoreOk(input);
                        count++;
                    });
                    Utils.msg(`已填充 ${count} 个空单元格`);
                }

                saveVal(sid, eid, tn, val, tid, max = 0, inputEl) {
                    this._pushScoreEditSnapshot();
                    const input = inputEl || document.getElementById(tid);
                    const numericVal = parseFloat(val);
                    if (max > 0 && numericVal > max) {
                        if (input) input.style.borderBottomColor = 'var(--danger)';
                        this._setScoreWarning(input, '超出满分，请核对');
                    }
                    if (numericVal < 0) {
                        if (input) input.style.borderBottomColor = 'var(--danger)';
                        return;
                    }
                    if (input && !(max > 0 && numericVal > max)) input.style.borderBottomColor = '';
                    let r = this.store.getScore(sid, eid);
                    if(!r) { 
                        r = {studentId:sid, examId:eid, details:{}, total:0, estimatedTotal:0, examAbsent:false}; 
                        this.store.state.data.scores.push(r); 
                        this.store.rebuildScoreIndex();
                    }
	                    r.examAbsent = false;
	                    if (!r.details) r.details = {};
	                    if (!r.questionCounts) r.questionCounts = {};

	                    if (!r._fieldTs) r._fieldTs = {};
	                    if (String(val ?? '').trim() === '') delete r.details[tn];
	                    else r.details[tn] = numericVal || 0;
	                    const exam = this.store.state.data.exams.find(item => item.id === eid);
                        this._syncCorrectCountFromScore(r,exam?.types?.find(t=>t.name===tn));
	                    r.total = this._calculateExamEntryTotal(r, exam);
                    r._totalMode = 'details-v1';
	                    r._ts = Date.now(); 
	                    r._fieldTs[tn] = r._ts;
	                    r._fieldTs.__examAbsent = r._ts;
                    
                    this.store.markAsUnsaved();
                    const row = input && input.closest ? input.closest('tr') : null;
                    const el = (row && row.querySelector(`#${tid}`)) || document.getElementById(tid);
                    if(el) el.innerText = r.total;
                    this._updateDeltaHTML(sid, r, input);
                    this._refreshExamProgressIndicators(eid);
                    this._refreshScoreStatusDot(sid, eid);
                }

                saveCorrectCount(sid, eid, tn, val, tid, questionCount = 0, maxScore = 0, inputEl) {
                    const raw = String(val ?? '').trim();
                    const count = raw === '' ? null : Number(raw);
                    if (raw !== '' && (!/^\d+$/.test(raw) || !Number.isInteger(count) || count < 0 || count > questionCount)) {
                        this._setScoreWarning(inputEl, `请输入 0–${questionCount} 的整数`);
                        inputEl?.setAttribute?.('aria-invalid', 'true');
                        return false;
                    }
                    this._pushScoreEditSnapshot();
                    let r = this.store.getScore(sid, eid);
                    if (!r) {
                        r = {studentId:sid, examId:eid, details:{}, questionCounts:{}, total:0, estimatedTotal:0, examAbsent:false};
                        this.store.state.data.scores.push(r);
                        this.store.rebuildScoreIndex();
                    }
                    r.examAbsent = false;
                    r.details = r.details || {};
                    r.questionCounts = r.questionCounts || {};
                    r._fieldTs = r._fieldTs || {};
                    if (count === null) {
                        delete r.questionCounts[tn];
                        delete r.details[tn];
                    } else {
                        r.questionCounts[tn] = count;
                        const score = questionCount > 0 ? count * maxScore / questionCount : 0;
                        r.details[tn] = Math.round((score + Number.EPSILON) * 100) / 100;
                    }
	                    const exam = this.store.state.data.exams.find(item => item.id === eid);
	                    r.total = this._calculateExamEntryTotal(r, exam);
                    r._totalMode = 'details-v1';
                    r._ts = Date.now();
                    r._fieldTs[tn] = r._ts;
                    r._fieldTs.__examAbsent = r._ts;
                    this.store.markAsUnsaved();
                    inputEl?.removeAttribute?.('aria-invalid');
                    if (inputEl) inputEl.style.borderBottomColor = '';
                    const row = inputEl?.closest?.('tr');
                    const totalEl = (row && row.querySelector(`#${tid}`)) || document.getElementById(tid);
                    if (totalEl) totalEl.innerText = r.total.toFixed(1);
                    this._updateDeltaHTML(sid, r, inputEl);
                    this._refreshExamProgressIndicators(eid);
                    this._refreshScoreStatusDot(sid, eid);
                    return true;
                }

                saveEstimated(sid, eid, val, inputEl) {
                    this._pushScoreEditSnapshot();
                    let r = this.store.getScore(sid, eid);
                    if(!r) { 
                        r = {studentId:sid, examId:eid, details:{}, total:0, estimatedTotal:0, examAbsent:false}; 
                        this.store.state.data.scores.push(r); 
                        this.store.rebuildScoreIndex();
                    }
	                    if (r.examAbsent === undefined) r.examAbsent = false;
	                    if (!r._fieldTs) r._fieldTs = {};
	                    r.estimatedTotal = parseFloat(val) || 0;
	                    r._ts = Date.now(); 
	                    r._fieldTs.__estimatedTotal = r._ts;
                    this.store.markAsUnsaved();
                    if (inputEl) inputEl.style.borderBottomColor = '';
                    this._updateDeltaHTML(sid, r, inputEl);
                    this._refreshExamProgressIndicators(eid);
                }

                _pushScoreEditSnapshot() {
                    if (!this._scoreEditSnapshotPushed) {
                        this.store.pushSnapshot();
                        this._scoreEditSnapshotPushed = true;
                        clearTimeout(this._scoreEditSnapshotTimer);
                        this._scoreEditSnapshotTimer = setTimeout(() => { this._scoreEditSnapshotPushed = false; }, 2000);
                    }
                }

                _renderQuestionRow({ name = '', max = '', questionCount = '', manualScore = false, old = '', isNew = true } = {}) {
                    const safeName = Utils.escapeHTML(name);
                    const safeOld = Utils.escapeHTML(old);
                    return `
                        <button type="button" class="q-drag-handle" title="拖拽排序"><svg class="gk2-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 6h16 M4 12h16 M4 18h16"/></svg></button>
                        ${old !== null ? `<input type="hidden" class="q-old" value="${safeOld}">` : ''}
                        <input type="text" placeholder="题型名称" class="qn" aria-label="题型名称" value="${safeName}" oninput="window.app.ui._syncQuestionRows(this.closest('.dialog-input-list').id)">
                        <input type="number" min="0.01" step="any" placeholder="满分" class="qs" aria-label="题型满分" value="${max}" oninput="window.app.ui._syncQuestionRows(this.closest('.dialog-input-list').id)">
                        <input type="number" min="1" step="1" placeholder="题数" class="q-count" aria-label="题型题数" value="${questionCount ?? ''}" oninput="window.app.ui._syncQuestionRows(this.closest('.dialog-input-list').id)">
                        <label class="q-manual-label"><input type="checkbox" class="q-manual" ${manualScore ? 'checked' : ''} onchange="window.app.ui._syncQuestionRows(this.closest('.dialog-input-list').id)"><span>老师手动录分</span></label>
                        <button type="button" class="danger btn-xs q-delete" onclick="window.app.ui.removeQRow(this)" title="删除该题型">×</button>`;
                }

                _collectQuestionTypesFromList(listId) {
                    const list = document.getElementById(listId);
                    if (!list) return null;
                    const types = [];
                    const names = new Set();
                    for (const row of Array.from(list.querySelectorAll('.q-row'))) {
                        const name = (row.querySelector('.qn')?.value || '').trim();
                        const max = Number(row.querySelector('.qs')?.value);
                        const countRaw = (row.querySelector('.q-count')?.value || '').trim();
                        const manualScore = !!row.querySelector('.q-manual')?.checked;
                        if (!name || names.has(name) || !Number.isFinite(max) || max <= 0) return null;
                        if (countRaw && (!/^\d+$/.test(countRaw) || Number(countRaw) <= 0)) return null;
                        names.add(name);
                        const type = { name, max, manualScore };
                        if (countRaw) type.questionCount = Number(countRaw);
                        types.push(type);
                    }
                    return types.length ? types : null;
                }

                _syncQuestionRows(listId = 'q-list') {
                    const list = document.getElementById(listId);
                    if (!list) return;
                    const rows = Array.from(list.querySelectorAll('.q-row'));
                    const total = rows.reduce((sum, row) => sum + (parseFloat(row.querySelector('.qs')?.value) || 0), 0);
                    const totalEl = document.getElementById(`${listId}-total`);
                    if (totalEl) totalEl.textContent = `当前总分: ${total} 分`;
                    rows.forEach(row => {
                        row.draggable = true;
                        const manual = !!row.querySelector('.q-manual')?.checked;
                        const countInput = row.querySelector('.q-count');
                        if (countInput) countInput.disabled = manual;
                        const del = row.querySelector('.q-delete');
                        if (del) {
                            del.disabled = rows.length <= 1;
                            del.title = rows.length <= 1 ? '至少保留一个题型' : '删除该题型';
                        }
                    });
                    this._bindQuestionListDnD(listId);
                }

                removeQRow(btn) {
                    const row = btn.closest('.q-row');
                    const list = row && row.parentElement;
                    if (!row || !list || list.querySelectorAll('.q-row').length <= 1) return;
                    row.remove();
                    this._syncQuestionRows(list.id);
                }

                addCommonQ(listId, name, max) {
                    const list = document.getElementById(listId);
                    if (!list) return;
                    const row = document.createElement('div');
                    row.className = 'q-row';
                    row.draggable = true;
                    row.innerHTML = this._renderQuestionRow({ name, max, old: listId === 'edit-q-list' ? '' : null });
                    list.appendChild(row);
                    this._syncQuestionRows(listId);
                    row.querySelector('.qn')?.focus();
                }

                _bindQuestionListDnD(listId) {
                    const list = document.getElementById(listId);
                    if (!list || list.__qDndBound) return;
                    list.__qDndBound = true;
                    let dragging = null;
                    list.addEventListener('dragstart', e => {
                        const row = e.target.closest('.q-row');
                        if (!row) return;
                        dragging = row;
                        row.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                    });
                    list.addEventListener('dragover', e => {
                        if (!dragging) return;
                        e.preventDefault();
                        const over = e.target.closest('.q-row');
                        if (!over || over === dragging) return;
                        const rect = over.getBoundingClientRect();
                        const after = e.clientY > rect.top + rect.height / 2;
                        list.insertBefore(dragging, after ? over.nextSibling : over);
                    });
                    list.addEventListener('dragend', () => {
                        if (dragging) dragging.classList.remove('dragging');
                        dragging = null;
                        this._syncQuestionRows(listId);
                    });
                }

                moveQ(btn, direction) {
                    const row = btn.parentElement;
                    const container = row.parentElement;
                    if (direction === -1 && row.previousElementSibling) {
                        container.insertBefore(row, row.previousElementSibling);
                    } else if (direction === 1 && row.nextElementSibling) {
                        container.insertBefore(row.nextElementSibling, row);
                    }
                    this._syncQuestionRows(container.id);
                }

                openEditExamModal(eid) {
                    const exam = this.store.state.data.exams.find(e => e.id === eid);
                    if (!exam) return;

                    const gSelect = document.getElementById('me-grade');
                    const allGrades = [...new Set(this.store.state.data.students.map(s=>s.grade).filter(Boolean))];
                    if (!allGrades.includes(exam.grade)) allGrades.push(exam.grade);
                    gSelect.innerHTML = allGrades.map(g => `<option value="${g}">${g}</option>`).join('');
                    
                    const authForEdit = this._getAuth();
                    const allCampuses = [...new Set(this.store.state.data.students.map(s=>s.campus).filter(Boolean).concat(authForEdit && authForEdit.mode === 'teacher' && authForEdit.campus ? [authForEdit.campus] : []))].sort();
                    const actualCamps = this._getExamCampuses(exam);
                    const cContainer = document.getElementById('me-campuses-container');
                    cContainer.innerHTML = allCampuses.map((c, i) => {
                        const p = colorPalette[i % colorPalette.length];
                        return `
                            <label class="campus-tag-label" style="--tag-bg:${p.bg}; --tag-border:${p.border}; --tag-text:${p.text};">
                                <input type="checkbox" value="${c}" class="me-campus-cb" ${actualCamps.includes(c) ? 'checked' : ''}> ${c}
                            </label>
                        `;
                    }).join('');

                    document.getElementById('me-eid').value = eid;
                    document.getElementById('me-ename').value = exam.name;
                    document.getElementById('me-edate').value = exam.date;
                    gSelect.value = exam.grade;
                    this._applyTeacherExamScopeLock({ campusContainer: '#me-campuses-container', gradeSelect: '#me-grade', preserveOtherCampuses: true });

                    const qList = document.getElementById('edit-q-list');
                    qList.innerHTML = '';
                    if (exam.types) {
                        exam.types.forEach(t => {
                            const d = document.createElement('div');
                            d.className = 'q-row';
                            d.draggable = true;
                            d.innerHTML = this._renderQuestionRow({ name: t.name, max: t.max, questionCount: t.questionCount ?? '', manualScore: !!t.manualScore, old: t.name });
                            qList.appendChild(d);
                        });
                    }

                    this._syncQuestionRows('edit-q-list');
                    document.getElementById('modal-edit-exam').showModal();
                }

                _getExamBasicInfoCampusScope(exam) {
                    const configuredCampuses = Array.isArray(exam.campuses) && exam.campuses.length
                        ? [...new Set(exam.campuses.filter(Boolean))]
                        : (exam.campus ? [exam.campus] : []);
                    const isAllCampuses = configuredCampuses.length === 0;
                    const studentsById = new Map(this.store.state.data.students.map(student => [String(student.id), student]));
                    const recordedCampuses = [...new Set(this.store.state.data.scores
                        .filter(score => String(score.examId) === String(exam.id))
                        .map(score => studentsById.get(String(score.studentId))?.campus)
                        .filter(Boolean))];
                    return {
                        isAllCampuses,
                        configuredCampuses,
                        preservedCampuses: isAllCampuses ? [] : [...new Set([...configuredCampuses, ...recordedCampuses])]
                    };
                }

                openEditExamBasicInfoModal(eid) {
                    const exam = this.store.state.data.exams.find(e => e.id === eid);
                    if (!exam) return Utils.msg('未找到对应考试', 'error');
                    const campusScope = this._getExamBasicInfoCampusScope(exam);
                    const { isAllCampuses, preservedCampuses } = campusScope;
                    const campusContainer = document.getElementById('gk2-exam-basic-campuses');
                    const campuses = [...new Set(this.store.state.data.students.map(student => student.campus).filter(Boolean).concat(preservedCampuses))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
                    const preservedSet = new Set(preservedCampuses);
                    campusContainer.innerHTML = campuses.map((campus, index) => {
                        const palette = colorPalette[index % colorPalette.length];
                        const locked = isAllCampuses || preservedSet.has(campus);
                        return `<label class="campus-tag-label" title="${locked ? '已纳入的校区不能取消' : '勾选可将此校区加入本场考试'}" style="--tag-bg:${palette.bg}; --tag-border:${palette.border}; --tag-text:${palette.text};"><input type="checkbox" class="gk2-exam-basic-campus" value="${Utils.escapeHTML(campus)}" ${isAllCampuses || preservedSet.has(campus) ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${Utils.escapeHTML(campus)}</label>`;
                    }).join('');
                    const allCampusesToggle = document.getElementById('gk2-exam-basic-all-campuses');
                    allCampusesToggle.checked = isAllCampuses;
                    allCampusesToggle.disabled = isAllCampuses;
                    let subsetSelection = new Set(preservedCampuses);
                    const campusInputs = [...campusContainer.querySelectorAll('.gk2-exam-basic-campus')];
                    campusInputs.forEach(input => input.addEventListener('change', () => {
                        if (!allCampusesToggle.checked) subsetSelection = new Set(campusInputs.filter(item => item.checked).map(item => item.value));
                    }));
                    allCampusesToggle.onchange = () => {
                        if (allCampusesToggle.checked) {
                            subsetSelection = new Set(campusInputs.filter(input => input.checked).map(input => input.value));
                            campusInputs.forEach(input => { input.checked = true; input.disabled = true; });
                        } else {
                            campusInputs.forEach(input => {
                                const locked = preservedSet.has(input.value);
                                input.checked = locked || subsetSelection.has(input.value);
                                input.disabled = locked;
                            });
                        }
                    };
                    document.getElementById('gk2-exam-basic-id').value = exam.id;
                    document.getElementById('gk2-exam-basic-name').value = exam.name || '';
                    document.getElementById('gk2-exam-basic-date').value = exam.date || '';
                    const dialog = document.getElementById('modal-exam-basic-info');
                    dialog.showModal();
                    document.getElementById('gk2-exam-basic-name').focus({ preventScroll: true });
                }

                saveExamBasicInfo() {
                    const eid = document.getElementById('gk2-exam-basic-id').value;
                    const exam = this.store.state.data.exams.find(item => item.id === eid);
                    if (!exam) return Utils.msg('未找到对应考试', 'error');
                    const name = document.getElementById('gk2-exam-basic-name').value.trim();
                    const date = document.getElementById('gk2-exam-basic-date').value;
                    const allCampuses = document.getElementById('gk2-exam-basic-all-campuses').checked;
                    const campuses = [...document.querySelectorAll('#gk2-exam-basic-campuses .gk2-exam-basic-campus:checked')].map(input => input.value);
                    const campusScope = this._getExamBasicInfoCampusScope(exam);
                    if (!name || !date) return Utils.msg('考试名称和日期为必填项', 'error');
                    if (!allCampuses && !campuses.length) return Utils.msg('请至少选择一个参与校区，或勾选“全部校区”', 'error');
                    if (campusScope.isAllCampuses && !allCampuses) return Utils.msg('该考试已包含全部校区，不能缩小校区范围', 'error');
                    if (!allCampuses && campusScope.preservedCampuses.some(campus => !campuses.includes(campus))) {
                        return Utils.msg('已纳入的校区不能取消，请保留原有校区或扩大到全部校区', 'error');
                    }

                    // Keep grade and score data unchanged; the campus range may only stay the same or expand.
                    this.store.pushSnapshot();
                    exam.name = name;
                    exam.date = date;
                    exam.campuses = allCampuses ? [] : campuses;
                    exam.campus = allCampuses ? '' : campuses[0];
                    exam._ts = Date.now();
                    this.store.save();
                    document.getElementById('modal-exam-basic-info').close();
                    this.refresh();
                    window.gk2Comfort?.refresh?.();
                    Utils.msg('考试基本信息已更新，已录入成绩保持不变');
                }

                addEditQ() {
                    this.addCommonQ('edit-q-list', '', '');
                }

                doEditExam() {
                    const eid = document.getElementById('me-eid').value;
                    const n = document.getElementById('me-ename').value.trim();
                    const d = document.getElementById('me-edate').value;
                    const g = document.getElementById('me-grade').value;
                    const selectedCampuses = Array.from(document.querySelectorAll('.me-campus-cb:checked')).map(cb => cb.value);

                    if(!n || !d) return Utils.msg("名称与日期为必填项","error");
                    if(selectedCampuses.length === 0) return Utils.msg("请至少选择一个参与校区","error");

                    const currentExam = this.store.state.data.exams.find(e => e.id === eid);
                    if (!currentExam) return;

                    const newTypes = [];
                    let newMax = 0;
                    const renames = {}; 
                    const currentNames = [];
                    const survivingOldNames = [];

                    const typesFromForm = this._collectQuestionTypesFromList('edit-q-list');
                    if (!typesFromForm) return Utils.msg("请填写不重复的题型名称和有效满分；题数须为正整数", "error");
                    document.querySelectorAll('#edit-q-list .q-row').forEach((r, rowIndex) => {
                        const oldInput = r.querySelector('.q-old');
                        const oldName = oldInput ? oldInput.value : null;
                        const type = typesFromForm[rowIndex];
                        const newName = type.name;

                        newTypes.push(type);
                        newMax += type.max;
                        currentNames.push(newName);
                        
                        if (oldName) {
                            survivingOldNames.push(oldName);
                            if (oldName !== newName) {
                                renames[oldName] = newName;
                            }
                        }
                    });

                    if (newTypes.length === 0) return Utils.msg("至少需要一个题型", "error");

                    const questionCountByName = new Map(newTypes.map(t => [t.name, t]));
                    for (const record of this.store.state.data.scores.filter(s => s.examId === eid)) {
                        for (const [oldName, newName] of Object.entries(renames)) {
                            const count = record.questionCounts?.[oldName];
                            const nextType = questionCountByName.get(newName);
                            if (count !== undefined && nextType?.questionCount && Number(count) > nextType.questionCount) {
                                return Utils.msg(`题型“${newName}”的正确题数已有 ${count}，不能将题数改为 ${nextType.questionCount}`, 'error');
                            }
                        }
                        for (const type of newTypes) {
                            const oldName = Object.keys(renames).find(name => renames[name] === type.name) || type.name;
                            const count = record.questionCounts?.[oldName];
                            if (count !== undefined && type.questionCount && Number(count) > type.questionCount) {
                                return Utils.msg(`题型“${type.name}”的正确题数已有 ${count}，不能将题数改为 ${type.questionCount}`, 'error');
                            }
                        }
                    }

                    // push snapshot before modifying exam and related scores
                    this.store.pushSnapshot();

                    const deletedNames = currentExam.types.map(t => t.name).filter(n => !survivingOldNames.includes(n));

                    let hasScoreUpdates = false;
                    this.store.state.data.scores.forEach(s => {
                        if (s.examId === eid) {
                            let changed = false;
                            s.details = s.details || {};
                            s.questionCounts = s.questionCounts || {};
                            s._fieldTs = s._fieldTs || {};
                            const changedAt = Date.now();
                            
                            for (const [oldN, newN] of Object.entries(renames)) {
                                let renamed = false;
                                if (s.details[oldN] !== undefined) {
                                    s.details[newN] = s.details[oldN];
                                    delete s.details[oldN];
                                    changed = renamed = true;
                                }
                                if (s.questionCounts[oldN] !== undefined) {
                                    s.questionCounts[newN] = s.questionCounts[oldN];
                                    delete s.questionCounts[oldN];
                                    changed = renamed = true;
                                }
                                if (renamed) { s._fieldTs[oldN] = changedAt; s._fieldTs[newN] = changedAt; }
                            }
                            
                            deletedNames.forEach(delN => {
                                if (s.details[delN] !== undefined) {
                                    delete s.details[delN];
                                    changed = true;
                                }
                                if (s.questionCounts[delN] !== undefined) {
                                    delete s.questionCounts[delN];
                                    changed = true;
                                }
                                s._fieldTs[delN] = changedAt;
                            });

                            for (const type of newTypes) {
                                const oldName = Object.keys(renames).find(name => renames[name] === type.name) || type.name;
                                const count = s.questionCounts[type.name] ?? s.questionCounts[oldName];
                                if (count !== undefined && type.questionCount && !type.manualScore) {
                                    s.questionCounts[type.name] = Number(count);
                                    s.details[type.name] = Math.round((Number(count) * type.max / type.questionCount + Number.EPSILON) * 100) / 100;
                                    s._fieldTs[type.name] = changedAt;
                                    changed = true;
                                }
                            }
                            
                            if (changed) {
                                s.total = Math.round((Object.values(s.details).reduce((a,b)=>a+(parseFloat(b)||0), 0) + Number.EPSILON) * 100) / 100;
                                s._ts = changedAt;
                                hasScoreUpdates = true;
                            }
                        }
                    });

                    currentExam.types = newTypes;
                    if (!currentExam.entryMode) currentExam.entryMode = 'score';
                    currentExam.maxTotal = newMax;
                    currentExam.campuses = selectedCampuses;
                    currentExam._ts = Date.now();
                    this.store.state.data.scores.forEach(record => {
                        if (record.examId !== eid) return;
                        const nextTotal = this._calculateExamEntryTotal(record, currentExam);
                        if (Number(record.total || 0) === nextTotal) return;
                        const changedAt = Date.now();
                        record.total = nextTotal;
                        record._ts = changedAt;
                        record._fieldTs ||= {};
                        record._fieldTs.__total = changedAt;
                        hasScoreUpdates = true;
                    });

                    const targetExam = this.store.state.data.exams.find(e => e.id !== eid && e.name === n && e.grade === g);

                    if (targetExam) {
                        if (!targetExam.campuses) targetExam.campuses = targetExam.campus ? [targetExam.campus] : [];
                        const currCampuses = currentExam.campuses && currentExam.campuses.length > 0 ? currentExam.campuses : (currentExam.campus ? [currentExam.campus] : []);
                        
                        currCampuses.forEach(c => {
                            if (c && !targetExam.campuses.includes(c)) targetExam.campuses.push(c);
                        });

                        currentExam.types.forEach(t => {
                            if(!targetExam.types.some(tt => tt.name === t.name)) {
                                targetExam.types.push(t);
                                targetExam.maxTotal += t.max;
                            }
                        });

                        if (new Date(currentExam.date) < new Date(targetExam.date)) {
                            targetExam.date = currentExam.date;
                        }

                        const mergeTs = Date.now();
                        this.store.markDeleted('exams', eid, mergeTs);
                        this.store.state.data.scores.forEach(s => {
                            if (s.examId === eid) {
                                this.store.markScoreDeleted(s, mergeTs);
                                s.examId = targetExam.id;
                                s._ts = mergeTs;
                            }
                        });
                        targetExam._ts = mergeTs;

                        this.store.state.data.exams = this.store.state.data.exams.filter(e => e.id !== eid);
                        Utils.msg("已将该考试与已存在的同名联考合并，且底层题型已清洗对齐！");
                    } else {
                        currentExam.name = n;
                        currentExam.date = d;
                        currentExam.grade = g;
                        currentExam._ts = Date.now();
                        Utils.msg(hasScoreUpdates ? "考试属性及题型修改成功，相关学生数据已自动重算" : "考试属性已保存，题型已重新排序");
                    }

                    this.store.markAsUnsaved();
                    document.getElementById('modal-edit-exam').close();
                    this.refresh();
                }

                openExamModal() {
                    const focus = this.store.state.globalFocus;
                    const gSelect = document.getElementById('m-grade');
                    const allGrades = [...new Set(this.store.state.data.students.map(s=>s.grade).filter(Boolean))];
                    const gradesToPick = focus.grades.length > 0 ? focus.grades : allGrades;
                    gSelect.innerHTML = gradesToPick.map(g => `<option value="${g}">${g}</option>`).join('');
                    
                    const authForNewExam = this._getAuth();
                    const allCampuses = [...new Set(this.store.state.data.students.map(s=>s.campus).filter(Boolean).concat(authForNewExam && authForNewExam.mode === 'teacher' && authForNewExam.campus ? [authForNewExam.campus] : []))].sort();
                    const scopedCampuses = (focus.campuses || []).filter(c => allCampuses.includes(c));
                    const defaultCampuses = new Set(authForNewExam?.mode === 'teacher' && authForNewExam.campus
                        ? [authForNewExam.campus]
                        : (scopedCampuses.length < allCampuses.length ? scopedCampuses : []));
                    const cContainer = document.getElementById('m-campuses-container');
                    cContainer.innerHTML = allCampuses.map((c, i) => {
                        const p = colorPalette[i % colorPalette.length];
                        return `
                            <label class="campus-tag-label" style="--tag-bg:${p.bg}; --tag-border:${p.border}; --tag-text:${p.text};">
                                <input type="checkbox" value="${c}" class="m-campus-cb" ${defaultCampuses.has(c) ? 'checked' : ''}> ${c}
                            </label>
                        `;
                    }).join('');
	                    this._applyTeacherExamScopeLock({ campusContainer: '#m-campuses-container', gradeSelect: '#m-grade' });

	                    document.getElementById('m-edate').value = new Date().toISOString().split('T')[0];
	                    
	                    const qList = document.getElementById('q-list');
	                    const defaultTemplate = this.getDefaultExamTemplate();
	                    if (defaultTemplate) {
	                        this.refreshExamTemplateSelect(defaultTemplate.id);
	                        this.loadExamTemplate(defaultTemplate.id, { silent: true });
	                    } else {
	                        qList.innerHTML = `<div class="q-row" draggable="true">${this._renderQuestionRow({ name: '听力', max: 30, old: null })}</div>`;
	                        this._syncQuestionRows('q-list');
	                        this.refreshExamTemplateSelect();
	                    }
	                    document.getElementById('modal-exam').showModal();
	                }

                openImportExamModal() {
                    const focus = this.store.state.globalFocus;
                    const cSelect = document.getElementById('mi-campus');
                    const gSelect = document.getElementById('mi-grade');
                    
                    const allCampuses = [...new Set(this.store.state.data.students.map(s=>s.campus).filter(Boolean))];
                    const allGrades = [...new Set(this.store.state.data.students.map(s=>s.grade).filter(Boolean))];
                    
                    const campusesToPick = focus.campuses.length > 0 ? focus.campuses : allCampuses;
                    const gradesToPick = focus.grades.length > 0 ? focus.grades : allGrades;
                    
                    cSelect.innerHTML = campusesToPick.map(c => `<option value="${c}">${c}</option>`).join('');
                    gSelect.innerHTML = gradesToPick.map(g => `<option value="${g}">${g}</option>`).join('');
                    this._applyTeacherExamScopeLock({ campusSelect: '#mi-campus', gradeSelect: '#mi-grade' });
                    
                    document.getElementById('mi-edate').value = new Date().toISOString().split('T')[0];
                    document.getElementById('mi-file').value = '';
                    document.getElementById('modal-import-exam').showModal();
                }

	                addQ() {
	                    this.addCommonQ('q-list', '', '');
	                }

                refreshExamTemplateSelect(selectedId = '') {
                    const tmplSel = document.getElementById('m-template-select');
                    if (!tmplSel) return;
                    const templates = (this.store.state.data.examTemplates || []).filter(t => !t._deleted);
                    const defaultTemplate = this.getDefaultExamTemplate();
                    tmplSel.innerHTML = '<option value="">— 从模板加载题型 —</option>';
                    templates.forEach(t => {
                        const selected = selectedId && t.id === selectedId ? ' selected' : '';
                        const defaultLabel = defaultTemplate?.id === t.id ? '（默认）' : '';
                        tmplSel.innerHTML += `<option value="${Utils.escapeHTML(t.id)}"${selected}>${Utils.escapeHTML(t.name)}${defaultLabel}</option>`;
                    });
                }

                getDefaultExamTemplate() {
                    return (this.store.state.data.examTemplates || []).find(t => !t._deleted && t.isDefault === true) || null;
                }

                setDefaultExamTemplate(id) {
                    const templates = (this.store.state.data.examTemplates || []).filter(t => !t._deleted);
                    const target = templates.find(t => t.id === id);
                    if (!target) return Utils.msg('未找到对应模板', 'error');
                    const currentDefault = this.getDefaultExamTemplate();
                    const shouldSet = currentDefault?.id !== id;
                    const now = Date.now();
                    templates.forEach(t => {
                        const nextValue = shouldSet && t.id === id;
                        if (!!t.isDefault !== nextValue) {
                            t.isDefault = nextValue;
                            t._ts = now;
                        }
                    });
                    this.store.save();
                    this.refreshExamTemplateSelect(document.getElementById('m-template-select')?.value || '');
                    this.renderExamTemplateManager();
                    Utils.msg(shouldSet ? '已设为新建考试默认模板' : '已取消默认模板');
                }

                collectCurrentQuestionTypes() {
                    return this._collectQuestionTypesFromList('q-list');
                }
	                
	                loadExamTemplate(templateId = '', options = {}) {
	                    const sel = document.getElementById('m-template-select');
	                    if (!sel) return Utils.msg('未找到模板选择框', 'error');
	                    const id = templateId || sel.value;
                    if (!id) return Utils.msg('请选择一个模板再加载', 'error');
                    const tmpl = (this.store.state.data.examTemplates || []).find(t => t.id === id && !t._deleted);
                    if (!tmpl) return Utils.msg('未找到对应模板', 'error');
	                    sel.value = id;
                    const qList = document.getElementById('q-list');
                    if (!qList) return Utils.msg('题型列表未找到', 'error');
                    qList.innerHTML = '';
                    (tmpl.types || []).forEach(t => {
                        const row = document.createElement('div'); row.className = 'q-row';
                        row.innerHTML = this._renderQuestionRow({ name: t.name, max: t.max, questionCount: t.questionCount ?? '', manualScore: !!t.manualScore, old: null });
                        qList.appendChild(row);
                    });
	                    Array.from(qList.querySelectorAll('.q-row')).forEach(row => { row.draggable = true; });
	                    this._syncQuestionRows('q-list');
	                    if (!options.silent) Utils.msg('模板已加载');
	                }

                openExamTemplateManager() {
                    let dialog = document.getElementById('exam-template-manager-dialog');
                    if (!dialog) {
                        dialog = document.createElement('dialog');
                        dialog.id = 'exam-template-manager-dialog';
                        dialog.className = 'dialog-shell dialog--lg';
                        dialog.setAttribute('aria-modal', 'true');
                        dialog.setAttribute('aria-label', '题型模板管理');
                        dialog.innerHTML = `
                            <div class="dialog-title mb-sm">题型模板管理</div>
                            <div class="dialog-note mb-md">可设置新建考试默认模板；新建后修改题型只作用于本场考试，不会改动模板。</div>
                            <div id="exam-template-manager-body"></div>
                            <div class="dialog-footer">
                                <button class="primary" type="button" data-action="new-template">新建模板</button>
                                <button class="secondary" type="button" data-action="close">关闭</button>
                            </div>
                        `;
                        dialog.addEventListener('click', (event) => {
                            const btn = event.target.closest('[data-action]');
                            if (!btn) return;
                            const action = btn.dataset.action;
                            const id = btn.dataset.id || '';
                            if (action === 'close') dialog.close();
                            else if (action === 'new-template') this.beginNewExamTemplate();
                            else if (action === 'load') {
                                const sel = document.getElementById('m-template-select');
                                if (sel) sel.value = id;
                                this.loadExamTemplate();
                                dialog.close();
                            } else if (action === 'rename') {
                                this.renameExamTemplate(id);
                            } else if (action === 'edit') {
                                this.editExamTemplate(id);
                            } else if (action === 'add-template-type') {
                                this.addCommonQ('exam-template-edit-q-list', '', '');
                            } else if (action === 'cancel-template-edit') {
                                this.cancelExamTemplateEdit();
                            } else if (action === 'save-template-types') {
                                this.saveExamTemplateTypes();
                            } else if (action === 'save-new-template') {
                                this.saveNewExamTemplate();
                            } else if (action === 'set-default-template') {
                                this.setDefaultExamTemplate(id);
                            } else if (action === 'delete') {
                                this.deleteExamTemplate(id);
                            }
                        });
                        dialog.addEventListener('close', () => {
                            this.refreshExamTemplateSelect(document.getElementById('m-template-select')?.value || '');
                        });
                        document.body.appendChild(dialog);
                    }
                    this._creatingExamTemplate = false;
                    this._editingExamTemplateId = '';
                    this.renderExamTemplateManager();
                    dialog.showModal();
                }

                beginNewExamTemplate() {
                    this._creatingExamTemplate = true;
                    this._editingExamTemplateId = '';
                    this.renderExamTemplateManager();
                    this.addCommonQ('exam-template-edit-q-list', '', '');
                    document.getElementById('exam-template-new-name')?.focus();
                }

                saveNewExamTemplate() {
                    const name = (document.getElementById('exam-template-new-name')?.value || '').trim();
                    if (!name) return Utils.msg('模板名称不能为空', 'error');
                    const types = this._collectQuestionTypesFromList('exam-template-edit-q-list');
                    if (!types) return Utils.msg('请填写不重复的题型名称和有效满分；题数须为正整数', 'error');
                    const tmpl = { id: Utils.id(), name, types, _ts: Date.now() };
                    this.store.state.data.examTemplates = this.store.state.data.examTemplates || [];
                    this.store.state.data.examTemplates.push(tmpl);
                    this.store.save();
                    this._creatingExamTemplate = false;
                    this.refreshExamTemplateSelect(document.getElementById('m-template-select')?.value || '');
                    this.renderExamTemplateManager();
                    Utils.msg('题型模板已创建');
                }

                editExamTemplate(id) {
                    const tmpl = (this.store.state.data.examTemplates || []).find(t => t.id === id && !t._deleted);
                    if (!tmpl) return Utils.msg('未找到对应模板', 'error');
                    this._creatingExamTemplate = false;
                    this._editingExamTemplateId = id;
                    this.renderExamTemplateManager();
                }

                cancelExamTemplateEdit() {
                    this._creatingExamTemplate = false;
                    this._editingExamTemplateId = '';
                    this.renderExamTemplateManager();
                }

                saveExamTemplateTypes() {
                    const id = this._editingExamTemplateId;
                    const tmpl = (this.store.state.data.examTemplates || []).find(t => t.id === id && !t._deleted);
                    if (!tmpl) return Utils.msg('未找到对应模板', 'error');
                    const types = this._collectQuestionTypesFromList('exam-template-edit-q-list');
                    if (!types) return Utils.msg('请填写不重复的题型名称和有效满分；题数须为正整数', 'error');
                    tmpl.types = types;
                    tmpl._ts = Date.now();
                    this.store.save();
                    this._creatingExamTemplate = false;
                    this._editingExamTemplateId = '';
                    this.refreshExamTemplateSelect(document.getElementById('m-template-select')?.value || '');
                    this.renderExamTemplateManager();
                    Utils.msg('模板题型已更新');
                }

                renderExamTemplateManager() {
                    const body = document.getElementById('exam-template-manager-body');
                    if (!body) return;
                    const templates = (this.store.state.data.examTemplates || []).filter(t => !t._deleted);
                    const footer = document.querySelector('#exam-template-manager-dialog > .dialog-footer');
                    const editing = templates.find(t => t.id === this._editingExamTemplateId);
                    if (this._creatingExamTemplate) {
                        body.innerHTML = `
                            <section class="gk2-template-editor">
                                <div class="gk2-template-editor-heading">
                                    <strong>新建题型模板</strong>
                                    <p>设置模板名称和题型构成；保存后可将模板用于新建考试。</p>
                                </div>
                                <label class="field-label" for="exam-template-new-name" style="display:block; margin-top:12px;">模板名称</label>
                                <input id="exam-template-new-name" type="text" maxlength="60" placeholder="例如：高考标准试卷题型" autocomplete="off" style="width:100%; box-sizing:border-box;">
                                <div id="exam-template-edit-q-list" class="dialog-input-list gk2-template-question-list"></div>
                                <div class="gk2-template-editor-tools">
                                    <span id="exam-template-edit-q-list-total" class="dialog-note"></span>
                                    <button class="secondary btn--compact" type="button" data-action="add-template-type">＋ 添加题型</button>
                                </div>
                            </section>
                        `;
                        if (footer) footer.innerHTML = `
                            <button class="secondary" type="button" data-action="cancel-template-edit">取消</button>
                            <button class="primary" type="button" data-action="save-new-template">创建模板</button>
                        `;
                        return;
                    }
                    if (editing) {
                        body.innerHTML = `
                            <section class="gk2-template-editor">
                                <div class="gk2-template-editor-heading">
                                    <strong>编辑题型</strong>
                                    <span>${Utils.escapeHTML(editing.name || '未命名模板')}</span>
                                    <p>修改题型名称、满分、题数和录分方式；拖动左侧图标可调整顺序。</p>
                                </div>
                                <div id="exam-template-edit-q-list" class="dialog-input-list gk2-template-question-list"></div>
                                <div class="gk2-template-editor-tools">
                                    <span id="exam-template-edit-q-list-total" class="dialog-note"></span>
                                    <button class="secondary btn--compact" type="button" data-action="add-template-type">＋ 添加题型</button>
                                </div>
                            </section>
                        `;
                        const list = document.getElementById('exam-template-edit-q-list');
                        (editing.types || []).forEach(type => {
                            const row = document.createElement('div');
                            row.className = 'q-row';
                            row.draggable = true;
                            row.innerHTML = this._renderQuestionRow({ name: type.name, max: type.max, questionCount: type.questionCount ?? '', manualScore: !!type.manualScore, old: null });
                            list.appendChild(row);
                        });
                        this._syncQuestionRows('exam-template-edit-q-list');
                        if (footer) footer.innerHTML = `
                            <button class="secondary" type="button" data-action="cancel-template-edit">取消</button>
                            <button class="primary" type="button" data-action="save-template-types">保存修改</button>
                        `;
                        return;
                    }
                    if (footer) footer.innerHTML = '<button class="primary" type="button" data-action="new-template">新建模板</button><button class="secondary" type="button" data-action="close">关闭</button>';
                    if (templates.length === 0) {
                        body.innerHTML = `<div class="dialog-note" style="padding:24px; text-align:center; border:1px dashed var(--border); border-radius:var(--radius-md);">暂无题型模板。点击“新建模板”可直接设置模板名称和题型。</div>`;
                        return;
                    }
                    const defaultTemplate = this.getDefaultExamTemplate();
                    body.innerHTML = `
                        <div class="table-scroll-container" style="max-height:420px;">
                            <table class="table-shell gk2-template-manager-table">
                                <thead><tr><th>模板名称</th><th>题型构成</th><th class="gk2-template-default-heading">新建默认</th><th class="gk2-template-actions-heading">操作</th></tr></thead>
                                <tbody>
                                    ${templates.map(t => {
                                        const typesText = (t.types || []).map(x => `${Utils.escapeHTML(x.name)}(${Number(x.max) || 0}分${Number.isInteger(Number(x.questionCount)) && Number(x.questionCount) > 0 ? ` / ${Number(x.questionCount)}题${x.manualScore ? ' · 手动录分' : ''}` : ''}${x.manualScore && !(Number(x.questionCount) > 0) ? ' · 手动录分' : ''})`).join('、') || '未设置题型';
                                        const isDefault = defaultTemplate?.id === t.id;
                                        return `<tr>
                                            <td style="font-weight:700;">${Utils.escapeHTML(t.name || '未命名模板')}</td>
                                            <td class="dialog-note">${typesText}</td>
                                            <td class="gk2-template-default-cell">
                                                <button class="gk2-template-default-button${isDefault ? ' is-active' : ''}" type="button" data-action="set-default-template" data-id="${Utils.escapeHTML(t.id)}" aria-pressed="${isDefault}"${isDefault ? ' title="点击取消默认模板"' : ' title="设为新建考试默认模板"'}>${isDefault ? '取消默认' : '设为默认'}</button>
                                            </td>
                                            <td class="gk2-template-actions-cell">
                                                <div class="gk2-template-actions">
                                                    <button class="gk2-template-action gk2-template-action--load" type="button" data-action="load" data-id="${Utils.escapeHTML(t.id)}">加载</button>
                                                    <button class="gk2-template-action gk2-template-action--rename" type="button" data-action="rename" data-id="${Utils.escapeHTML(t.id)}">重命名</button>
                                                    <button class="gk2-template-action gk2-template-action--edit" type="button" data-action="edit" data-id="${Utils.escapeHTML(t.id)}">编辑</button>
                                                    <button class="gk2-template-action gk2-template-action--delete" type="button" data-action="delete" data-id="${Utils.escapeHTML(t.id)}">删除</button>
                                                </div>
                                            </td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                renameExamTemplate(id) {
                    const tmpl = (this.store.state.data.examTemplates || []).find(t => t.id === id && !t._deleted);
                    if (!tmpl) return Utils.msg('未找到对应模板', 'error');
                    const nextName = prompt('请输入新的模板名称：', tmpl.name || '未命名模板');
                    if (nextName === null) return;
                    const cleanName = nextName.trim();
                    if (!cleanName) return Utils.msg('模板名称不能为空', 'error');
                    tmpl.name = cleanName;
                    tmpl._ts = Date.now();
                    this.store.save();
                    this.refreshExamTemplateSelect(id);
                    this.renderExamTemplateManager();
                    Utils.msg('模板已重命名');
                }

                deleteExamTemplate(id) {
                    const tmpl = (this.store.state.data.examTemplates || []).find(t => t.id === id && !t._deleted);
                    if (!tmpl) return Utils.msg('未找到对应模板', 'error');
                    this.showConfirmDialog(`确定删除题型模板【${tmpl.name}】吗？`, () => {
                        tmpl._deleted = true;
                        tmpl._ts = Date.now();
                        this.store.save();
                        this.refreshExamTemplateSelect();
                        this.renderExamTemplateManager();
                        Utils.msg('模板已删除');
                    }, '确认删除');
                }

	                saveExamTemplate() {
	                    const name = prompt('请输入模板名称：', '新模板');
	                    if (name === null) return; // cancel
	                    const types = this.collectCurrentQuestionTypes();
                    if (!types) return Utils.msg('请填写题型名称、满分，并确保题数为正整数', 'error');
	                    const cleanName = name.trim();
	                    if (!cleanName) return Utils.msg('模板名称不能为空', 'error');
	                    const tmpl = { id: Utils.id(), name: cleanName, types, _ts: Date.now() };
	                    this.store.state.data.examTemplates = this.store.state.data.examTemplates || [];
	                    this.store.state.data.examTemplates.push(tmpl);
	                    this.store.save();
	                    Utils.msg('模板已保存');
	                    this.refreshExamTemplateSelect(tmpl.id);
	                    this.renderExamTemplateManager();
	                }

                editStudentTags(stuId) {
                    const stu = this.store.state.data.students.find(s => s.id === stuId);
                    if (!stu) return Utils.msg('未找到该学生', 'error');
                    const dialog = document.createElement('dialog');
                    dialog.className = 'dialog-shell dialog--md';
                    dialog.setAttribute('aria-modal', 'true');
                    dialog.setAttribute('aria-label', '编辑学生标签');
                    dialog.innerHTML = `
                        <div class="dialog-title mb-md">${window.gk2IconMarkup('tag')} 编辑 ${Utils.escapeHTML(stu.name)} 的标签</div>
                        <div class="dialog-note mb-sm">输入标签后按 Enter 添加；点击已有标签可删除。</div>
                        <div class="tag-editor-chips" id="tag-editor-chips"></div>
                        <input id="tag-editor-input" class="input--full mt-md" placeholder="输入新标签，按 Enter 添加">
                        <div class="dialog-footer">
                            <button class="secondary" onclick="this.closest('dialog').close()">取消</button>
                            <button class="primary" id="tag-editor-confirm">确认保存</button>
                        </div>
                    `;
                    document.body.appendChild(dialog);
                    let tags = [...new Set((stu.tags || []).map(t => String(t).trim()).filter(Boolean))];
                    const chips = dialog.querySelector('#tag-editor-chips');
                    const input = dialog.querySelector('#tag-editor-input');
                    const renderChips = () => {
                        chips.innerHTML = tags.length
                            ? tags.map((t, idx) => `<button type="button" class="tag-editor-chip" data-index="${idx}" title="点击删除">${Utils.escapeHTML(t)} ×</button>`).join('')
                            : '<span class="dialog-note">暂无标签</span>';
                    };
                    const addTag = () => {
                        const val = input.value.trim();
                        if (val && !tags.includes(val)) tags.push(val);
                        input.value = '';
                        renderChips();
                    };
                    chips.addEventListener('click', (e) => {
                        const chip = e.target.closest('.tag-editor-chip');
                        if (!chip) return;
                        tags.splice(Number(chip.dataset.index), 1);
                        renderChips();
                    });
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                        }
                    });
                    dialog.querySelector('#tag-editor-confirm').addEventListener('click', () => {
                        addTag();
                        stu.tags = tags;
                        stu._ts = Date.now();
                        this.store.save();
                        const tagsEl = document.getElementById(`stu-tags-${stuId}`);
                        if (tagsEl) tagsEl.innerHTML = (stu.tags||[]).map(t=>`<span style='background:#edf5ff;border:1px solid #c5ddf7;padding:1px 6px;border-radius:10px;margin-right:3px;'>${Utils.escapeHTML(t)}</span>`).join('');
                        try { this.initGlobalFilters(); } catch(e){}
                        try { this.renderStudents(); } catch(e){}
                        Utils.msg(`已更新 ${stu.name} 的标签`);
                        dialog.close();
                    });
                    dialog.addEventListener('close', () => dialog.remove());
                    renderChips();
                    dialog.showModal();
                    setTimeout(() => input.focus(), 0);
                }

                doCreateExam() {
                    const n = document.getElementById('m-ename').value.trim();
                    const d = document.getElementById('m-edate').value;
                    const g = document.getElementById('m-grade').value;
                    const selectedCampuses = Array.from(document.querySelectorAll('.m-campus-cb:checked')).map(cb => cb.value);
                    
                    if(!n || !d) return Utils.msg("请填写考试名称和日期","error");
                    if(selectedCampuses.length === 0) return Utils.msg("请至少勾选一个参与的校区","error");

                    const qs = this.collectCurrentQuestionTypes();
                    if (!qs) return Utils.msg('请填写题型名称、有效满分，并确保题数为正整数', 'error');
                    const max = qs.reduce((sum, type) => sum + type.max, 0);
                    const entryMode = this._hasCountEntryTypes(qs) ? 'count' : 'score';
                    
                    let existingExam = this.store.state.data.exams.find(e => e.name === n && e.grade === g);
                    
                    if (existingExam) {
                        if (!existingExam.campuses) existingExam.campuses = existingExam.campus ? [existingExam.campus] : [];
                        const newCampuses = selectedCampuses.filter(c => !existingExam.campuses.includes(c));
                        const newTypes = qs.filter(q => !existingExam.types.some(t => t.name === q.name));
                        const earlierDate = new Date(d).getTime() < new Date(existingExam.date).getTime() ? d : existingExam.date;
                        const mergeMsg = [
                            `检测到同年级同名考试【${n}】，将并入现有联考。`,
                            '',
                            `新增校区：${newCampuses.length ? newCampuses.join('、') : '无'}`,
                            `追加题型：${newTypes.length ? newTypes.map(t => `${t.name}(${t.max}分)`).join('、') : '无'}`,
                            `考试日期：${earlierDate === existingExam.date ? '保持现有日期' : `更新为较早日期 ${earlierDate}`}`,
                            '',
                            '确认后会保留已有成绩，并扩展这场联考的范围。'
                        ].join('\n');
                        this.showConfirmDialog(mergeMsg, () => {
                            this.store.pushSnapshot();
                            newTypes.forEach(q => {
                                existingExam.types.push(q);
                                existingExam.maxTotal += q.max;
                            });
                            if (!existingExam.entryMode) {
                                existingExam.entryMode = 'score';
                                this.store.state.data.scores.forEach(record => {
                                    if (record.examId !== existingExam.id) return;
                                    const nextTotal = this._calculateExamEntryTotal(record, existingExam);
                                    if (Number(record.total || 0) === nextTotal) return;
                                    const changedAt = Date.now();
                                    record.total = nextTotal;
                                    record._ts = changedAt;
                                    record._fieldTs ||= {};
                                    record._fieldTs.__total = changedAt;
                                });
                            }
                            newCampuses.forEach(c => existingExam.campuses.push(c));
                            existingExam.date = earlierDate;
                            existingExam._ts = Date.now();
                            this.store.markAsUnsaved();
                            document.getElementById('modal-exam').close();
                            this.refresh();
                            Utils.msg("已按确认内容并入联考。");
                        }, '确认合并');
                        return;
                    } else {
                        // snapshot before creating new exam
                        this.store.pushSnapshot();
                        const newId = Utils.id();
                        this.store.state.data.exams.push({ id: newId, _ts: Date.now(), name: n, date: d, maxTotal: max, types: qs, grade: g, campuses: selectedCampuses, entryMode });
                        Utils.msg("已成功创建考试。");
                    }
                    
                    this.store.markAsUnsaved(); 
                    document.getElementById('modal-exam').close(); 
                    this.refresh();
                }

                async doImportExamFromExcel() {
                    const operationContext=Utils.contextStamp(), operationData=JSON.stringify(this.store.state.data);
                    const n = document.getElementById('mi-ename').value.trim();
                    const d = document.getElementById('mi-edate').value;
                    const c = document.getElementById('mi-campus').value; 
                    const g = document.getElementById('mi-grade').value;
                    const fileInput = document.getElementById('mi-file');
                    
                    if(!n || !d) return Utils.msg("请填写完整的考试信息","error");
                    if(!fileInput.files || fileInput.files.length === 0) return Utils.msg("请选择一个 Excel 表格文件","error");

                    const file = fileInput.files[0];
                    if (!await window.gk2Dependencies.ensure('xlsx')) return;
                    const reader = new FileReader();

                    reader.onload = (evt) => {
                        try {
                            Utils.assertContext(operationContext);
                            if(operationData!==JSON.stringify(this.store.state.data))throw Error('读取期间数据已变化');
                            const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
                            const headers = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1})[0];
                            const dataRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                            
                            if(!headers || !headers.includes('姓名')) {
                                fileInput.value = '';
                                return Utils.msg("表格格式错误：找不到【姓名】列", "error");
                            }

                            const types = [];
                            let maxTotal = 0;
                            const scoreRegex = /(.+?)[(（](\d+)[)）]/; 
                            
                            headers.forEach(header => {
                                if (typeof header !== 'string') return;
                                const match = header.trim().match(scoreRegex);
                                if (match) {
                                    const typeName = match[1].trim();
                                    const typeMax = parseInt(match[2]);
                                    types.push({ name: typeName, max: typeMax });
                                    maxTotal += typeMax;
                                }
                            });

                            if(types.length === 0) {
                                fileInput.value = '';
                                return Utils.msg("找不到成绩列。请确认表头格式为【题型(满分)】", "error");
                            }

                            this.store.pushSnapshot();
                            let exam = this.store.state.data.exams.find(e => e.name === n && e.grade === g);
                            let newExamId;
                            
                            if (!exam) {
                                newExamId = Utils.id();
                                exam = { id: newExamId, _ts: Date.now(), name: n, date: d, maxTotal: maxTotal, types: types, grade: g, campuses: [c] };
                                this.store.state.data.exams.push(exam);
                            } else {
                                newExamId = exam.id;
                                if (!exam.campuses) exam.campuses = [];
                                if (!exam.campuses.includes(c)) exam.campuses.push(c);
                                if (d < exam.date) exam.date = d;
                                types.forEach(t => {
                                    if(!exam.types.some(et => et.name === t.name)) {
                                        exam.types.push(t);
                                        exam.maxTotal += t.max;
                                    }
                                });
                            }

                            const absentKeywords = ['缺考', '缺', '缺席', 'absent', '/', '-', '——'];
                            const isAbsentScoreToken = (v) => absentKeywords.includes(String(v || '').trim().toLowerCase());
                            let matchCount = 0;
                            let failCount = 0;
                            
                            dataRows.forEach(row => {
                                const stuName = (row['姓名'] || '').toString().trim();
                                const stuTClass = (row['日语班'] || '').toString().trim();
                                if(!stuName) return;

                                const targetStudent = this.store.state.data.students.find(s => {
                                    if(s.campus !== c || s.grade !== g || !Utils.isStudentInExam(s, {id:newExamId})) return false;
                                    if(s.name !== stuName) return false;
                                    if(stuTClass) {
                                        const classAtExam = Utils.getClassAtDate(s, d);
                                        if (classAtExam.teachingClass !== stuTClass && s.teachingClass !== stuTClass) return false;
                                    }
                                    return true;
                                });

                                if(targetStudent) {
                                    matchCount++;
	                                    const importTs = Date.now();
	                                    let scoreRec = { studentId: targetStudent.id, examId: newExamId, details: {}, total: 0, estimatedTotal: 0, examAbsent: false, _ts: importTs, _fieldTs: { __examAbsent: importTs } };
                                    const scoreHeaders = headers.filter(header => (header || '').toString().trim().match(scoreRegex));
                                    const allAbsent = scoreHeaders.length > 0 && scoreHeaders.every(header => isAbsentScoreToken(row[header]));
                                    if (allAbsent) {
                                        scoreRec.examAbsent = true;
                                        scoreRec.details = {};
                                        scoreRec.total = 0;
                                    } else {
                                        scoreHeaders.forEach(header => {
                                            const match = (header || '').toString().trim().match(scoreRegex);
	                                            if(match) {
	                                                let val = parseFloat(row[header]);
	                                                const fieldName = match[1].trim();
	                                                scoreRec.details[fieldName] = isNaN(val) ? 0 : val;
	                                                scoreRec._fieldTs[fieldName] = importTs;
	                                            }
                                        });
                                        scoreRec.total = Object.values(scoreRec.details).reduce((a,b)=>a+b, 0);
                                    }
                                    
                                    const oldIdx = this.store.state.data.scores.findIndex(s => s.studentId === targetStudent.id && s.examId === newExamId);
	                                    if (oldIdx >= 0) {
	                                        const oldScore = this.store.state.data.scores[oldIdx];
	                                        scoreRec.estimatedTotal = oldScore.estimatedTotal;
	                                        scoreRec._fieldTs.__estimatedTotal = (oldScore._fieldTs && oldScore._fieldTs.__estimatedTotal) || oldScore._ts || importTs;
	                                        this.store.state.data.scores[oldIdx] = scoreRec;
                                    } else {
                                        this.store.state.data.scores.push(scoreRec);
                                    }
                                } else {
                                    failCount++;
                                }
                            });

                            this.store.rebuildScoreIndex();
                            this.store.markAsUnsaved();
                            document.getElementById('modal-import-exam').close();
                            this.refresh();
                            if (matchCount > 0) {
                                Utils.msg(`联考聚合成功！共为 ${matchCount} 名学生导入成绩。` + (failCount>0?` (有${failCount}条数据未找到匹配学生)`:''));
                            } else {
                                Utils.msg(`未找到匹配的学生！请检查Excel中的姓名/班级与系统是否一致。`, "error");
                            }

                        } catch(err) { 
                            Utils.msg("文件读取失败，请检查文件是否损坏或格式不支持", "error"); 
                        } finally {
                            fileInput.value = '';
                        }
                    };
                    reader.readAsArrayBuffer(file);
                }

                async importScoresToExistingExam(e, eid) {
                    const file = e.target.files[0]; if(!file) return;
                    if (!await window.gk2Dependencies.ensure('xlsx')) { e.target.value = ''; return; }
                    const exam = this.store.state.data.exams.find(ex => ex.id === eid);
                    if(!exam) return;

                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        try {
                            const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'});
                            const headers = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1})[0];
                            const dataRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

                            if(!headers || !headers.includes('姓名')) {
                                e.target.value = '';
                                return Utils.msg("格式错误：找不到【姓名】列", "error");
                            }

                            const scoreRegex = /(.+?)[(（](\d+)[)）]/;
                            const parsedHeaders = [];

                            headers.forEach(header => {
                                if (typeof header !== 'string') return;
                                const match = header.trim().match(scoreRegex);
                                if (match) {
                                    const typeName = match[1].trim();
                                    const typeMax = parseInt(match[2]);
                                    parsedHeaders.push({ raw: header, name: typeName, max: typeMax });
                                    
                                    if (!exam.types.some(t => t.name === typeName)) {
                                        exam.types.push({ name: typeName, max: typeMax });
                                        exam.maxTotal += typeMax;
                                    }
                                }
                            });

                            if(parsedHeaders.length === 0) {
                                e.target.value = '';
                                return Utils.msg("格式错误：未找到带有满分的题型表头", "error");
                            }

                            const absentKeywords = ['缺考', '缺', '缺席', 'absent', '/', '-', '——'];
                            const isAbsentScoreToken = (v) => absentKeywords.includes(String(v || '').trim().toLowerCase());
                            let matchCount = 0;
                            let failCount = 0;
                            
                            dataRows.forEach(row => {
                                const stuName = (row['姓名'] || '').toString().trim();
                                const stuTClass = (row['日语班'] || '').toString().trim();
                                if(!stuName) return;

                                const targetStudent = this.store.state.data.students.find(s => {
                                    if(s.grade !== exam.grade || !Utils.isStudentInExam(s, exam)) return false;
                                    if(s.name !== stuName) return false;
                                    if(stuTClass) {
                                        const classAtExam = Utils.getClassAtDate(s, exam.date);
                                        if (classAtExam.teachingClass !== stuTClass && s.teachingClass !== stuTClass) return false;
                                    }
                                    return true;
                                });

                                if(targetStudent) {
                                    matchCount++;
                                    if (!exam.campuses) exam.campuses = [];
                                    if (!exam.campuses.includes(targetStudent.campus)) exam.campuses.push(targetStudent.campus);

	                                    let scoreRec = this.store.getScore(targetStudent.id, eid);
	                                    if (!scoreRec) {
	                                        scoreRec = { studentId: targetStudent.id, examId: eid, details: {}, total: 0, estimatedTotal: 0, examAbsent: false, _ts: Date.now(), _fieldTs: {} };
	                                        this.store.state.data.scores.push(scoreRec);
	                                    }
	                                    if (!scoreRec._fieldTs) scoreRec._fieldTs = {};

	                                    const importTs = Date.now();
	                                    const allAbsent = parsedHeaders.length > 0 && parsedHeaders.every(ph => isAbsentScoreToken(row[ph.raw]));
	                                    if (allAbsent) {
	                                        scoreRec.examAbsent = true;
	                                        scoreRec.details = {};
	                                        scoreRec.total = 0;
	                                        scoreRec._fieldTs.__examAbsent = importTs;
	                                    } else {
	                                        scoreRec.examAbsent = false;
	                                        scoreRec._fieldTs.__examAbsent = importTs;
	                                        parsedHeaders.forEach(ph => {
	                                            let val = parseFloat(row[ph.raw]);
	                                            scoreRec.details[ph.name] = isNaN(val) ? 0 : val;
	                                            scoreRec._fieldTs[ph.name] = importTs;
	                                        });
	                                        scoreRec.total = Object.values(scoreRec.details).reduce((a,b)=>a+b, 0);
	                                    }
	                                    scoreRec._ts = importTs;
                                } else {
                                    failCount++;
                                }
                            });

                            this.store.rebuildScoreIndex();
                            this.store.markAsUnsaved();
                            this.renderExamTables(eid);
                            
                            if (matchCount > 0) {
                                Utils.msg(`覆盖成功！已更新 ${matchCount} 名学生的成绩。` + (failCount>0?` (有${failCount}条数据未找到匹配学生)`:''));
                            } else {
                                Utils.msg(`未找到匹配的学生！请检查Excel中的姓名与系统是否一致。`, "error");
                            }
                        } catch(err) {
                            Utils.msg("处理时发生错误，请检查您的 Excel", "error");
                        } finally {
                            e.target.value = ''; 
                        }
                    };
                    reader.readAsArrayBuffer(file);
                }

                deleteExam(eid) {
                    const exam = this.store.state.data.exams.find(e => e.id === eid);
                    if(!exam) return;
                    this.showConfirmDialog(
		                        `即将删除考试【${exam.name}】（${exam.grade}），影响 ${this.store.state.data.scores.filter(r=>r.examId===eid).length} 条成绩；涉及 ${[...new Set(this.store.state.data.students.filter(st=>this.store.state.data.scores.some(r=>r.examId===eid&&r.studentId===st.id)).map(st=>{const at=Utils.getClassForExam(st,exam);return at.campus+'/'+at.teachingClass;}))].join('、')}。可在本次打开期间使用“撤销”恢复；关闭页面后撤销记录不保留。${window.app?.sync?.isEnabled && window.app.sync.isEnabled() ? '\n\n当前云同步已开启：删除结果会同步到其他设备。' : ''}`,
	                        () => {
	                            this.store.pushSnapshot();
	                            const ts = Date.now();
	                            this.store.markDeleted('exams', eid, ts);
	                            this.store.state.data.scores
	                                .filter(s => s.examId === eid)
	                                .forEach(s => this.store.markScoreDeleted(s, ts));
	                            this.store.state.data.exams = this.store.state.data.exams.filter(e => e.id !== eid);
	                            this.store.state.data.scores = this.store.state.data.scores.filter(s => s.examId !== eid);
	                            this.store.save();
                            this.refresh();
                            Utils.msg("考试已删除", 'success', true);
                        }
                    );
                }

                _getExamScoreCountForFocus(exam, focus = this.store.state.globalFocus || {}) {
                    if (!exam) return 0;
                    const actualCamps = this._getExamCampuses(exam);
                    const validStudentIds = new Set((this.store.state.data.students || []).filter(s => {
                        const classAtExam = Utils.getClassForExam(s, exam);
                        const campusAtExam = classAtExam.campus || s.campus;
                        if (s.grade !== exam.grade) return false;
                        if (actualCamps.length > 0 && !actualCamps.includes(campusAtExam)) return false;
                        return this._studentMatchesFocusForExam(s, exam, focus);
                    }).map(s => s.id));
                    if (validStudentIds.size === 0) return 0;
                    return (this.store.state.data.scores || []).filter(sc => (
                        sc.examId === exam.id &&
                        validStudentIds.has(sc.studentId) &&
                        Utils.isActualScore(sc, exam)
                    )).length;
                }

                initGlobalExamsDropdown(forceLatest = false, refreshAnalysis = true) {
    const focus = this.store.state.globalFocus;
    const sel = document.getElementById('global-exam'); 
    if (!sel) return;
    const oldVal = sel.value || this.store.state.currentExamId || '';
    
    let validExams = this.store.state.data.exams.filter(e => {
        const examCampuses = this._getExamCampuses(e); 
        if (focus.campuses.length > 0 && examCampuses.length > 0 && !examCampuses.some(c=>focus.campuses.includes(c))) return false;
        if (focus.grades.length > 0 && !focus.grades.includes(e.grade)) return false;
        if (focus.phases.length > 0) {
            const p = Utils.calculatePhase(e.grade, e.date);
            if (!focus.phases.includes(p)) return false;
        }
	        if (focus.tClasses.length > 0) {
	            const hasClassInRoster = this._getExamRosterStudents(e).some(s => {
	                const classAtExam = Utils.getClassForExam(s, e);
	                return focus.tClasses.includes(classAtExam.teachingClass);
	            });
	            if (!hasClassInRoster) return false;
	        }
        return true;
    });
    
    if (validExams.length === 0) {
        sel.innerHTML = '<option value="">当前条件下暂无考试数据，请调整筛选</option>';
        sel.disabled = true;
        sel.title = '当前条件下暂无考试数据，请调整左侧筛选条件';
    } else {
        sel.disabled = false;
        sel.title = '';
        sel.innerHTML = '<option value="">点击选择诊断考试...</option>';
        validExams.sort((a,b) => (b.date||'').localeCompare(a.date||''));
        validExams.forEach(e => {
            const phaseName = Utils.calculatePhase(e.grade, e.date);
            const actualCampuses = this._getExamCampuses(e);
            const campStr = actualCampuses.length > 0 ? actualCampuses.join('、') : '全域';
            const isLian = actualCampuses.length > 1 ? ' 联考' : '';
            const scope = `${campStr}${isLian} / ${e.grade} / ${phaseName}`;
            sel.innerHTML += `<option value="${e.id}">[${scope}] ${e.name}</option>`;
        });
    }

    const latestWithScores = validExams.find(e => this._getExamScoreCountForFocus(e, focus) > 0);

    // 修复：严谨安全的备用回退逻辑
    if (forceLatest && validExams.length > 0) {
        sel.value = (latestWithScores || validExams[0]).id; // 左侧筛选变化时，优先切到当前条件下最近且有成绩的考试
    } else if (oldVal && validExams.some(e => e.id === oldVal)) {
        sel.value = oldVal; // 若原考试在当前过滤下依然合法，则保持选中
    } else if (validExams.length > 0) {
        sel.value = validExams[0].id; // 若原考试不合法，强制顶替为合法列表中的第一项
    } else {
        sel.value = '';
    }

    this.store.state.currentExamId = sel.value || '';
    
    // 仅在分析视图中主动切换 Tab
    if (this.cur === 'analysis' && refreshAnalysis) {
        this.switchAnalysisTab(this.store.state.currentAnalysisType || 'overview'); 
    }
}

                // 顺便加上联动事件
                onGlobalExamChange() {
                    const sel = document.getElementById('global-exam');
                    this.store.state.currentExamId = sel ? (sel.value || '') : '';
                    if (this.cur === 'analysis') {
                        this.updateAnalysisMultiSelect();
                        this.runAnalysis();
                    } else if (this.cur === 'details') {
                        this.renderDetailsView();
                    }
                }

                _showAnalysisSkeleton() {
                    const card = document.getElementById('chart-wrapper-card');
                    if (!card || document.getElementById('analysis-loading-overlay')) return;
                    card.style.position = card.style.position || 'relative';
                    const overlay = document.createElement('div');
                    overlay.id = 'analysis-loading-overlay';
                    overlay.className = 'analysis-loading-overlay';
                    overlay.innerHTML = '<div class="analysis-skeleton-line"></div><div class="analysis-skeleton-block"></div>';
                    card.appendChild(overlay);
                }

                _hideAnalysisSkeletonSoon() {
                    clearTimeout(this._analysisSkeletonTimer);
                    this._analysisSkeletonTimer = setTimeout(() => {
                        this._clearAnalysisSkeleton();
                    }, 180);
                }

                _clearAnalysisSkeleton() {
                    clearTimeout(this._analysisSkeletonTimer);
                    document.querySelectorAll('#analysis-loading-overlay').forEach(overlay => overlay.remove());
                }

                _syncToolbarMoreMenu() {
                    const toolbar = document.getElementById('analysis-toolbar');
                    if (!toolbar) return;
                    this._enhanceToolbarLabels();
                    let more = document.getElementById('analysis-toolbar-more');
                    if (!more) {
                        more = document.createElement('div');
                        more.id = 'analysis-toolbar-more';
                        more.className = 'toolbar-more';
                        more.innerHTML = `<button type="button" class="secondary btn--compact" onclick="this.parentElement.classList.toggle('open')">${window.gk2IconMarkup('settings')} 高级选项</button><div class="toolbar-more-menu"></div>`;
                        toolbar.appendChild(more);
                    }
                    const menu = more.querySelector('.toolbar-more-menu');
                    const allIds = [
                        'compare-direction-wrap', 'compare-phase-wrap', 'compare-multi-exam-wrap', 'compare-dimension-wrap', 'compare-advanced-wrap', 'compare-chart-type-wrap',
                        'trend-phase-wrap', 'trend-score-toggle-wrap', 'baseline-scope-wrap',
                        'avg-type-wrap', 'student-selector-wrap', 'trend-predict-wrap'
                    ];
                    const type = this.store.state.currentAnalysisType || 'overview';
                    const primaryMap = {
                        compare: ['compare-direction-wrap', 'compare-multi-exam-wrap', 'compare-advanced-wrap'],
                        // Trend controls are used together, so keep the full working set inline.
                        // Other analysis views retain the shared advanced-options menu.
                        trend: ['trend-phase-wrap', 'student-selector-wrap', 'compare-chart-type-wrap', 'trend-score-toggle-wrap', 'baseline-scope-wrap', 'trend-predict-wrap'],
                        avg: ['avg-type-wrap'],
                    };
                    const primaryIds = primaryMap[type] || [];
                    toolbar.classList.toggle('is-trend-toolbar', type === 'trend');
                    const visible = allIds.map(id => document.getElementById(id)).filter(g => {
                        if (!g || getComputedStyle(g).display === 'none') return false;
                        if (type === 'compare' && g.closest('#compare-advanced-panel')) return false;
                        return true;
                    });
                    const predict = document.getElementById('trend-predict-wrap');
                    const advanced = [];
                    visible.forEach(g => {
                        g.classList.remove('toolbar-secondary-collapsed');
                        g.classList.remove('toolbar-reveal');
                        void g.offsetWidth;
                        g.classList.add('toolbar-reveal');
                        if (g.id === 'trend-predict-wrap') {
                            toolbar.insertBefore(g, more);
                        } else if (primaryIds.includes(g.id)) {
                            toolbar.insertBefore(g, more);
                        } else {
                            advanced.push(g);
                        }
                    });
                    advanced.forEach(g => {
                        g.style.display = 'flex';
                        menu.appendChild(g);
                    });
                    toolbar.classList.toggle('has-more', advanced.length > 0);
                    more.style.display = advanced.length > 0 ? '' : 'none';
                    if (advanced.length === 0) more.classList.remove('open');
                    // Determine emptiness from controls that remain visible in the toolbar itself.
                    // Hidden compatibility controls and items inside a closed advanced menu must
                    // not leave an empty white toolbar shell behind.
                    const hasVisibleDirectGroup = Array.from(toolbar.children).some(child =>
                        child.classList?.contains('toolbar-group') &&
                        child.id !== 'ms-analysis-container' &&
                        getComputedStyle(child).display !== 'none' &&
                        getComputedStyle(child).visibility !== 'hidden'
                    );
                    const hasVisibleMoreButton = more.style.display !== 'none' && getComputedStyle(more).display !== 'none';
                    const isEmpty = !hasVisibleDirectGroup && !hasVisibleMoreButton;
                    toolbar.classList.toggle('is-empty', isEmpty);
                    // Target and radar views use the global selectors and have no controls in this toolbar.
                    // Hide the shared shell to avoid leaving an empty bar or orphaned advanced-options button.
                    const hideForView = type === 'radar' || type === 'target';
                    toolbar.style.display = (isEmpty || hideForView) ? 'none' : '';
                    this._syncTrendPredictIcon();
                }

                _enhanceToolbarLabels() {
                    document.querySelectorAll('#analysis-toolbar .toolbar-group').forEach(group => {
                        const label = group.querySelector('.toolbar-label');
                        if (!label) return;
                        const tip = label.getAttribute('title') || group.querySelector('.toolbar-help')?.getAttribute('title') || '';
                        if (tip) {
                            label.dataset.help = tip;
                            label.removeAttribute('title');
                        }
                        group.querySelectorAll('.toolbar-help').forEach(btn => btn.remove());
                    });
                    this._syncScoreAlgorithmNote();
                }

                _syncScoreAlgorithmNote() {
                    const sel = document.getElementById('a-trend-score-type');
                    const note = document.getElementById('score-algo-note');
                    if (!sel || !note) return;
                    const notes = {
                        raw: '原始分适合看同一张试卷的卷面表现。',
                        pct: '得分率适合跨满分或跨届考试对比。',
                        std: 'T-标准分适合排除试卷难度后看相对位置。',
                        ratio: '均分贡献指数适合观察班级或学生对整体均分的拉动。'
                    };
                    note.textContent = notes[sel.value] || notes.raw;
                    sel.title = note.textContent;
                }

                _showCompareGuideOnce() {
                    const key = 'gakuten_compare_toolbar_guide_seen';
                    try {
                        if (localStorage.getItem(key) === '1') return;
                    } catch(e) {}
                    const toolbar = document.getElementById('analysis-toolbar');
                    if (!toolbar || document.getElementById('compare-guide-bubble')) return;
                    const bubble = document.createElement('div');
                    bubble.id = 'compare-guide-bubble';
                    bubble.className = 'compare-guide-bubble';
                    bubble.textContent = '先选「对比谁」，再决定要不要调高级参数。';
                    toolbar.appendChild(bubble);
                    try { localStorage.setItem(key, '1'); } catch(e) {}
                    setTimeout(() => {
                        try { bubble.remove(); } catch(e) {}
                    }, 5200);
                }

                _syncTrendPredictIcon() {
                    const checkbox = document.getElementById('a-trend-predict-toggle');
                    const wrap = document.querySelector('#trend-predict-wrap .trend-predict-icon');
                    if (wrap && checkbox) wrap.classList.toggle('active', checkbox.checked);
                }

                switchAnalysisTab(type) {
                    if (type === 'avg') type = 'compare';
                    this.store.state.currentAnalysisType = type;
                    const analysisBody = document.querySelector('#view-analysis .content-body');
                    if (analysisBody) analysisBody.classList.toggle('overview-mode', type === 'overview');
                    try { this.initGlobalFilters(); } catch(e) {}
                    this.store.state.lastAnalysisTabs = this.store.state.lastAnalysisTabs || {};
                    const groupForType = ['overview', 'compare'].includes(type) ? 'common' : 'deep';
                    this.store.state.lastAnalysisTabs[groupForType] = type;
                    // 使用静默保存，避免触发同步或未保存指示
                    try { this.store.silentSave(); } catch(e) {}
                    this._showAnalysisSkeleton();
                    const compactStats = document.getElementById('analysis-compact-stats');
                    if (compactStats) compactStats.style.display = type === 'overview' ? 'none' : '';

                    document.querySelectorAll('.analysis-tab').forEach(tab => {
                        tab.classList.remove('active');
                        if (tab.hasAttribute('data-type')) tab.setAttribute('aria-pressed', tab.getAttribute('data-type') === type ? 'true' : 'false');
                        if (tab.getAttribute('data-type') === type) {
                            tab.classList.add('active');
                            setTimeout(() => tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 0);
                        }
                    });
                    const activeGroup = groupForType;

                    const baseWrap = document.getElementById('base-exam-wrap') || { style: {} }; // 修复：加入容错防崩溃
                    const compMultiExamWrap = document.getElementById('compare-multi-exam-wrap');
                    const compDirectionWrap = document.getElementById('compare-direction-wrap');
                    const compPhaseWrap = document.getElementById('compare-phase-wrap');
                    const compDimWrap = document.getElementById('compare-dimension-wrap');
                    const compAdvancedWrap = document.getElementById('compare-advanced-wrap');
                    const compTrackingWrap = document.getElementById('compare-tracking-wrap');
                    const compAliasWrap = document.getElementById('compare-alias-wrap');
                    const stuWrap = document.getElementById('student-selector-wrap');
                    const trendPhaWrap = document.getElementById('trend-phase-wrap');
                    const trendScoreWrap = document.getElementById('trend-score-toggle-wrap');
                    const trendPredictWrap = document.getElementById('trend-predict-wrap');
                    const avgTypeWrap = document.getElementById('avg-type-wrap');
                    const baselineScopeWrap = document.getElementById('baseline-scope-wrap');
                    const compChartTypeWrap = document.getElementById('compare-chart-type-wrap');

                    baseWrap.style.display = 'flex';
                    compDirectionWrap.style.display = 'none';
                    compPhaseWrap.style.display = 'none';
                    compMultiExamWrap.style.display = 'none';
                    compDimWrap.style.display = 'none';
                    compAdvancedWrap.style.display = 'none';
                    compChartTypeWrap.style.display = 'none';
                    if (compTrackingWrap) compTrackingWrap.style.display = 'none';
                    if (compAliasWrap) compAliasWrap.style.display = 'none';
                    stuWrap.style.display = 'none';
                    trendPhaWrap.style.display = 'none';
                    trendScoreWrap.style.display = 'none';
                    trendPredictWrap.style.display = 'none';
                    avgTypeWrap.style.display = 'none';
                    baselineScopeWrap.style.display = 'none';

                    if (type === 'compare') {
                        baseWrap.style.display = 'none';
                    } else if (type === 'target') {
                        // Keep visible
                    } else if (type === 'trend') {
                        baseWrap.style.display = 'none'; 
                        trendPhaWrap.style.display = 'flex';
                        trendScoreWrap.style.display = 'flex';
                        trendPredictWrap.style.display = 'flex';
                        stuWrap.style.display = 'flex';
                        compChartTypeWrap.style.display = 'flex'; 
                        
                        // 重置趋势线checkbox为未选中
                        document.getElementById('a-trend-predict-toggle').checked = false;
                        this._syncTrendPredictIcon();
                        
                        this.updateTrendPhaseMultiSelect();
                        
                        const scoreType = document.getElementById('a-trend-score-type').value;
                        if(scoreType === 'std' || scoreType === 'ratio') baselineScopeWrap.style.display = 'flex';
                    } else if (type === 'avg') {
                        avgTypeWrap.style.display = 'flex';
                    } else if (type === 'borderline' || type === 'segment' || type === 'weakness') {
                        // V43: segment and weakness uses base exam
                        if (type === 'borderline') baseWrap.style.display = 'none'; 
                    }
                    
                    // Rebuild the toolbar first; its sync routine hides the shell if no controls remain.
                    try {
                        const toolbar = document.getElementById('analysis-toolbar');
                        if (toolbar) {
                            this._syncToolbarMoreMenu();
                            if (type === 'compare' && !window.gk2Comparison) this._showCompareGuideOnce();
                        }
                    } catch (e) {}

                    const radarCard = document.getElementById('chart-wrapper-card');
                    clearTimeout(this._radarAnimationTimer);
                    if (radarCard) radarCard.classList.remove('gk2-radar-entering');
                    if (type === 'radar' && radarCard) {
                        void radarCard.offsetWidth;
                        radarCard.classList.add('gk2-radar-entering');
                        this._radarAnimationTimer = setTimeout(() => {
                            radarCard.classList.remove('gk2-radar-entering');
                            this._radarAnimationTimer = null;
                        }, 760);
                    }

                    this.runAnalysis();
                    if (type === 'overview') {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                if (window.resizeAllCharts) window.resizeAllCharts();
                            });
                        });
                    }
                    this._hideAnalysisSkeletonSoon();
                    if (type === 'overview' && compactStats) compactStats.style.display = 'none';
                }

                switchAnalysisTabGroup(group) {
                    const remembered = this.store.state.lastAnalysisTabs && this.store.state.lastAnalysisTabs[group];
                    const candidates = group === 'deep'
                        ? ['radar', 'trend', 'target', 'borderline']
                        : ['overview', 'compare'];
                    const targetType = (remembered && candidates.includes(remembered) ? remembered : null) || candidates.find(type => {
                        const tab = document.querySelector(`.analysis-tab[data-type="${type}"]`);
                        return tab && tab.style.display !== 'none';
                    }) || (group === 'deep' ? 'radar' : 'overview');
                    this.switchAnalysisTab(targetType);
                }

                switchDetailsTab(tabId) {
                    this.store.state.currentDetailsTab = tabId;
                    try { this.store.silentSave(); } catch(e) {}
                    this.renderDetailsView();
                }

                _getPinyinInitials(str) {
                    const text = String(str || '');
                    const collator = new Intl.Collator('zh-Hans-CN', { numeric: true });
                    const letters = 'abcdefghjklmnopqrstwxyz';
                    const boundaries = ['阿','八','嚓','哒','妸','发','旮','哈','击','喀','垃','妈','拿','哦','啪','期','然','撒','塌','挖','昔','压','匝'];
                    const surnameInitials = {
                        '曾': 'z', '解': 'x', '仇': 'q', '查': 'z', '单': 's',
                        '区': 'o', '乐': 'y', '重': 'c', '种': 'c', '长': 'z',
                        '句': 'g', '繁': 'p', '折': 's', '秘': 'b', '冼': 'x',
                        '盖': 'g', '朴': 'p', '翟': 'z', '尉': 'y', '燕': 'y',
                        '沈': 's', '黑': 'h', '宁': 'n', '缪': 'm', '华': 'h'
                    };
                    let res = '';
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        if (i === 0 && surnameInitials[char]) { res += surnameInitials[char]; continue; }
                        if (!/[\u4e00-\u9fa5]/.test(char)) { res += char.toLowerCase(); continue; }
                        let found = false;
                        for (let j = boundaries.length - 1; j >= 0; j--) {
                            if (collator.compare(char, boundaries[j]) >= 0) { res += letters[j]; found = true; break; }
                        }
                        if (!found) res += char.toLowerCase();
                    }
                    return res;
                }

                searchStudentInDetails(keyword) {
                    const kw = String(keyword || '').trim().toLowerCase();
                    const container = document.getElementById('view-details');
                    if (!container) return;
                    container.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
                    if (!kw) return;
                    let firstMatch = null;
                    container.querySelectorAll('tr[data-student-name]').forEach(tr => {
                        const name = tr.dataset.studentName || '';
                        if (this._matchesPinyin(name, kw)) {
                            tr.classList.add('search-highlight');
                            if (!firstMatch) firstMatch = tr;
                        }
                    });
                    if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                async exportDetailsToExcel(examName) {
                    if (!await window.gk2Dependencies.ensure('xlsx')) return;
                    if (typeof XLSX === 'undefined') {
                        alert('Excel 导出库未加载完成，请稍后再试');
                        return;
                    }
                    const container = document.getElementById('view-details');
                    if (!container) return alert('详情视图未渲染');
                    const tables = container.querySelectorAll('table');
                    if (!tables || tables.length < 4) {
                        alert('未找到足够的表格数据进行导出');
                        return;
                    }

                    const wb = XLSX.utils.book_new();
                    const sheetNames = [
                        "成绩数据明细",
                        "班级均分明细",
                        "题型得分率",
                        "临界生关注"
                    ];

                    tables.forEach((table, index) => {
                        if (index < sheetNames.length) {
                            const ws = XLSX.utils.table_to_sheet(table, { raw: false });
                            XLSX.utils.book_append_sheet(wb, ws, sheetNames[index]);
                        }
                    });

                    XLSX.writeFile(wb, `${examName}_成绩详情报表.xlsx`);
                }

                async downloadBlankStudentTemplate() {
                    if (!await window.gk2Dependencies.ensure('xlsx')) return;
                    if (typeof XLSX === 'undefined') {
                        alert('Excel 库未加载完成，请稍后再试');
                        return;
                    }
                    const headers = ['姓名', '校区', '年级', '日语班', '行政班'];
                    const sampleRows = [
                        ['张三', '主校区', '2024级', '24A', '高二1班'],
                        ['李四', '西校区', '2024级', '24B', '高二2班']
                    ];
                    const data = [headers].concat(sampleRows);
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    
                    // 设置列宽
                    ws['!cols'] = [
                        { wch: 12 }, // 姓名
                        { wch: 15 }, // 校区
                        { wch: 15 }, // 年级
                        { wch: 15 }, // 日语班
                        { wch: 15 }  // 行政班
                    ];

                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "学生名单模板");
                    XLSX.writeFile(wb, "学生名单导入模板.xlsx");
                    Utils.msg('空白学生名单模板下载成功！', 'success');
                }

                handleExamChange() {
                    this.updateAnalysisMultiSelect();
                    this.runAnalysis();
                }

                handleTrendPredictToggle() {
                    const checkbox = document.getElementById('a-trend-predict-toggle');
                    this._syncTrendPredictIcon();
                    if (!this.chartInstance || !this.store.state.currentTrendPredictSeries) return;
                    
                    const isChecked = checkbox.checked;
                    
                    // 遍历预测线系列，发送绝对的选中/取消选中指令
                    this.store.state.currentTrendPredictSeries.forEach(item => {
                        this.chartInstance.dispatchAction({
                            type: isChecked ? 'legendSelect' : 'legendUnSelect',
                            name: item.seriesName
                        });
                    });
                }

                updateCompactStatValue(id, value) {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const next = String(value);
                    if (el.textContent === next) return;
                    el.classList.add('is-updating');
                    setTimeout(() => {
                        el.textContent = next;
                        el.classList.remove('is-updating');
                    }, 50);
                }

                updateCompareExamsMultiSelect() {
                    const focus = this.store.state.globalFocus;
                    let validExams = this.store.state.data.exams.filter(e => {
                        const examCampuses = this._getExamCampuses(e);
                        if (focus.campuses.length > 0 && examCampuses.length > 0 && !examCampuses.some(c=>focus.campuses.includes(c))) return false;
                        if (focus.phases.length > 0) {
                            const p = Utils.calculatePhase(e.grade, e.date);
                            if (!focus.phases.includes(p)) return false;
                        }
                        return true;
                    });
                    
                    validExams.sort((a,b) => {
                        const ag = String(a.grade || '');
                        const bg = String(b.grade || '');
                        if (ag !== bg) return ag.localeCompare(bg, 'zh-CN', { numeric: true });
                        const ap = Utils.calculatePhase(a.grade, a.date);
                        const bp = Utils.calculatePhase(b.grade, b.date);
                        const phaseCmp = Utils.sortPhaseStrict(ap, bp);
                        if (phaseCmp) return phaseCmp;
                        return (a.date||'').localeCompare(b.date||'');
                    });
                    
                    const options = validExams.map(ex => {
                        const phase = Utils.calculatePhase(ex.grade, ex.date);
                        const actualCampuses = this._getExamCampuses(ex);
                        const campStr = actualCampuses.length > 0 ? actualCampuses.join('、') : '全域';
                        return { id: ex.id, label: `[${campStr} / ${ex.grade} / ${phase}] ${ex.name}` };
                    });

                    this._buildMultiSelect('ms-compare-exams-panel', 'ms-compare-exams-header', options, 'window.app.ui.runAnalysis()', '请勾选您要对比的考试...', false, null, false, true);
                    this._decorateCompareExamPanel(validExams);
                }

                _decorateCompareExamPanel(validExams = []) {
                    const panel = document.getElementById('ms-compare-exams-panel');
                    if (!panel) return;
                    panel.querySelectorAll('.compare-phase-shortcut, .compare-exam-group-title, .ms-search-wrap').forEach(el => el.remove());
                    
                    // 1. 动态挂载检索输入框，确保 build 之后不会丢失
                    const searchWrap = document.createElement('div');
                    searchWrap.className = 'ms-search-wrap';
                    searchWrap.style.cssText = 'padding: 6px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: #ffffff; z-index: 10;';
                    searchWrap.innerHTML = `
                        <input type="text" id="a-compare-exam-search" class="toolbar-select" style="width: 100%; border-radius: 6px; border: 1px solid var(--border); padding: 4px 8px; font-size: 11px; box-sizing: border-box;" placeholder="搜索考试名称" oninput="window.app.ui.filterCompareExams(this.value)" onclick="event.stopPropagation()">
                    `;
                    panel.prepend(searchWrap);

                    const phases = [...new Set(validExams.map(ex => Utils.calculatePhase(ex.grade, ex.date)).filter(p => p && !p.includes('未知')))].sort(Utils.sortPhaseStrict);
                    if (phases.length > 0) {
                        const shortcut = document.createElement('div');
                        shortcut.className = 'compare-phase-shortcut';
                        shortcut.innerHTML = phases.map(p => `<button type="button" class="secondary" onclick="window.app.ui.selectCompareExamsByPhase('${Utils.escapeHTML(p)}')">全选${Utils.escapeHTML(p)}</button>`).join('');
                        panel.appendChild(shortcut);
                    }
                    let lastKey = '';
                    Array.from(panel.querySelectorAll('.ms-item')).forEach(label => {
                        const input = label.querySelector('input');
                        const ex = validExams.find(e => e.id === input?.value);
                        if (!ex) return;
                        const key = `${ex.grade || '未知年级'} / ${Utils.calculatePhase(ex.grade, ex.date)}`;
                        if (key !== lastKey) {
                            const title = document.createElement('div');
                            title.className = 'compare-exam-group-title';
                            title.textContent = key;
                            panel.appendChild(title);
                            lastKey = key;
                        }
                        panel.appendChild(label);
                    });
                }

                filterCompareExams(keyword = '') {
                    const panel = document.getElementById('ms-compare-exams-panel');
                    if (!panel) return;
                    const cleanKeyword = keyword.trim().toLowerCase();
                    
                    const labels = Array.from(panel.querySelectorAll('.ms-item'));
                    labels.forEach(label => {
                        const text = label.textContent.toLowerCase();
                        if (!cleanKeyword || text.includes(cleanKeyword)) {
                            label.style.display = 'flex';
                        } else {
                            label.style.display = 'none';
                        }
                    });
                    
                    let currentGroupTitle = null;
                    let hasVisibleInGroup = false;
                    const children = Array.from(panel.childNodes);
                    children.forEach(node => {
                        if (node.classList && node.classList.contains('compare-exam-group-title')) {
                            if (currentGroupTitle) {
                                currentGroupTitle.style.display = hasVisibleInGroup ? 'block' : 'none';
                            }
                            currentGroupTitle = node;
                            hasVisibleInGroup = false;
                        } else if (node.classList && node.classList.contains('ms-item')) {
                            if (node.style.display !== 'none') {
                                hasVisibleInGroup = true;
                            }
                        }
                    });
                    if (currentGroupTitle) {
                        currentGroupTitle.style.display = hasVisibleInGroup ? 'block' : 'none';
                    }
                }

                sortDetailsScore(col) {
                    if (this.detailsScoreSort?.col === col) {
                        this.detailsScoreSort.asc = !this.detailsScoreSort.asc;
                    } else {
                        this.detailsScoreSort = { col, asc: false };
                    }
                    const scroll = document.querySelector('#view-details .gk2-detail-score-scroll');
                    const scrollTop = scroll?.scrollTop || 0;
                    this.renderDetailsView();
                    const nextScroll = document.querySelector('#view-details .gk2-detail-score-scroll');
                    if (nextScroll) nextScroll.scrollTop = scrollTop;
                }

                quickTriggerCompareScenario(scenarioType) {
                    const storeExams = this.store.state.data.exams || [];
                    const panel = document.getElementById('ms-compare-exams-panel');
                    if (!panel) return;
                    
                    const focus = this.store.state.globalFocus;

                    if (scenarioType === 'cross-grade-pk') {
                        const dirEl = document.getElementById('a-compare-direction');
                        if (dirEl) dirEl.value = 'cross-grade';
                        
                        this._syncCompareDirectionUI();
                        this.updateComparePhaseSelect();
                        
                        const phaseEl = document.getElementById('a-compare-phase');
                        if (phaseEl && phaseEl.options.length > 0) {
                            let targetPhase = phaseEl.options[0].value;
                            for (let i = 0; i < phaseEl.options.length; i++) {
                                if (phaseEl.options[i].value.includes('高一下') || phaseEl.options[i].value.includes('高一上')) {
                                    targetPhase = phaseEl.options[i].value;
                                    break;
                                }
                            }
                            phaseEl.value = targetPhase;
                        }
                        
                        this.handleComparePhaseChange();
                        
                        const chartTypeEl = document.getElementById('a-compare-chart-type');
                        if (chartTypeEl) chartTypeEl.value = 'line';
                        const scoreTypeEl = document.getElementById('a-trend-score-type');
                        if (scoreTypeEl) scoreTypeEl.value = 'pct';
                        
                        this.runAnalysis();
                        toast("已智能关联跨届同期考试并切换至总均分折线图！", "success");
                    }
                    
                    if (scenarioType === 'class-trajectory') {
                        const dirEl = document.getElementById('a-compare-direction');
                        if (dirEl) dirEl.value = 'class';
                        
                        this._syncCompareDirectionUI();
                        
                        const trackingEl = document.getElementById('a-compare-tracking');
                        if (trackingEl) trackingEl.value = 'current';
                        const chartTypeEl = document.getElementById('a-compare-chart-type');
                        if (chartTypeEl) chartTypeEl.value = 'line';
                        const scoreTypeEl = document.getElementById('a-trend-score-type');
                        if (scoreTypeEl) scoreTypeEl.value = 'pct';
                        
                        const examsSorted = [...storeExams].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
                        if (examsSorted.length > 0) {
                            const activeGrade = focus.grades.length > 0 ? focus.grades[0] : examsSorted[0].grade;
                            const targetExams = examsSorted.filter(ex => ex.grade === activeGrade).slice(0, 5);
                            const targetIds = new Set(targetExams.map(e => e.id));
                            
                            panel.querySelectorAll('.ms-item input').forEach(cb => {
                                cb.checked = targetIds.has(cb.value);
                            });
                        }
                        this._updateMsHeader('ms-compare-exams-panel', 'ms-compare-exams-header', '请勾选您要对比的考试...', true);
                        
                        this.runAnalysis();
                        toast("已自动切换至【当前最新班级口径】，追踪这届班级在历次考试中的均分成长曲线！", "success");
                    }
                    
                    if (scenarioType === 'history-restore') {
                        const dirEl = document.getElementById('a-compare-direction');
                        if (dirEl) dirEl.value = 'class';
                        
                        this._syncCompareDirectionUI();
                        
                        const trackingEl = document.getElementById('a-compare-tracking');
                        if (trackingEl) trackingEl.value = 'history';
                        const chartTypeEl = document.getElementById('a-compare-chart-type');
                        if (chartTypeEl) chartTypeEl.value = 'bar';
                        const scoreTypeEl = document.getElementById('a-trend-score-type');
                        if (scoreTypeEl) scoreTypeEl.value = 'pct';
                        
                        const examsSorted = [...storeExams].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
                        if (examsSorted.length > 0) {
                            const activeGrade = focus.grades.length > 0 ? focus.grades[0] : examsSorted[0].grade;
                            const targetExams = examsSorted.filter(ex => ex.grade === activeGrade).slice(0, 4);
                            const targetIds = new Set(targetExams.map(e => e.id));
                            
                            panel.querySelectorAll('.ms-item input').forEach(cb => {
                                cb.checked = targetIds.has(cb.value);
                            });
                        }
                        this._updateMsHeader('ms-compare-exams-panel', 'ms-compare-exams-header', '请勾选您要对比的考试...', true);
                        
                        this.runAnalysis();
                        toast("已还原当时考场的历史现场！按考试当时的历史分班展示柱状图分差对比。", "success");
                    }
                }

                selectCompareExamsByPhase(phase) {
                    const panel = document.getElementById('ms-compare-exams-panel');
                    if (!panel) return;
                    const exams = this.store.state.data.exams || [];
                    const ids = new Set(exams.filter(ex => Utils.calculatePhase(ex.grade, ex.date) === phase).map(ex => ex.id));
                    panel.querySelectorAll('.ms-item input').forEach(cb => { cb.checked = ids.has(cb.value); });
                    this._updateMsHeader('ms-compare-exams-panel', 'ms-compare-exams-header', '请勾选您要对比的考试...', true);
                    this.runAnalysis();
                }

                getCustomAliasMap() {
                    const el = document.getElementById('a-compare-alias');
                    if (!el) return new Map();
                    const text = el.value || '';
                    const map = new Map();
                    text.split('\n').forEach(line => {
                        const parts = line.split('=>');
                        if (parts.length === 2) {
                            const src = parts[0].trim();
                            const target = parts[1].trim();
                            if (src && target) map.set(src, target);
                        }
                    });
                    return map;
                }

                normalizeExamLabel(examName = '', aliasMap = new Map()) {
                    let text = String(examName || '').trim();
                    
                    // 1. 先应用用户自定义的别名映射关系
                    if (aliasMap && aliasMap.size > 0) {
                        for (const [src, dst] of aliasMap.entries()) {
                            if (text.includes(src)) {
                                text = text.replace(src, dst);
                            }
                        }
                    }
                    
                    // 2. 默认的别名对齐合并
                    if (text.includes('半期') || text.includes('半学期') || text.includes('段考1')) {
                        text = text.replace(/半期|半学期|段考1/, '期中');
                    }
                    if (text.includes('段考2')) {
                        text = text.replace(/段考2/, '期末');
                    }
                    
                    const patterns = [
                        /期中/, /期末/,
                        /月考\s*\d*/i, /周测\s*\d*/i,
                        /[零一二三四五六七八九十\d]+模/,
                        /第[一二三四五六七八九十\d]+次/,
                        /联考/, /统考/, /质检/, /调研考?/, /诊断考?/,
                        /模[拟考]/, /开学考/, /摸底/,
                        /阶段[测检]/, /单元[测检]/, /综合[测检]/,
                        /检测\s*\d*/
                    ];
                    for (const p of patterns) {
                        const m = text.match(p);
                        if (m) return m[0].replace(/\s+/g, '');
                    }
                    return text || '未命名考试';
                }

                updateComparePhaseSelect() {
                    const sel = document.getElementById('a-compare-phase');
                    if (!sel) return;
                    const old = sel.value;
                    const phases = [...new Set((this.store.state.data.exams || []).map(ex => Utils.calculatePhase(ex.grade, ex.date)).filter(p => p && !p.includes('未知')))].sort(Utils.sortPhaseStrict);
                    sel.innerHTML = phases.map(p => `<option value="${Utils.escapeHTML(p)}">${Utils.escapeHTML(p)}</option>`).join('');
                    if (old && phases.includes(old)) sel.value = old;
                    else if (this.store.state.comparePhase && phases.includes(this.store.state.comparePhase)) sel.value = this.store.state.comparePhase;
                    else if (phases.length) sel.value = phases[0];
                    this.store.state.comparePhase = sel.value || '';
                }

                _syncCompareDirectionUI() {
                    const dir = document.getElementById('a-compare-direction')?.value || 'class';
                    const advancedPanel = document.getElementById('compare-advanced-panel');
                    const chartWrap = document.getElementById('compare-chart-type-wrap');
                    const scoreWrap = document.getElementById('trend-score-toggle-wrap');
                    const baselineWrap = document.getElementById('baseline-scope-wrap');
                    const phaseWrap = document.getElementById('compare-phase-wrap');
                    const examWrap = document.getElementById('compare-multi-exam-wrap');
                    const dimWrap = document.getElementById('compare-dimension-wrap');
                    const trackingWrap = document.getElementById('compare-tracking-wrap');
                    const aliasWrap = document.getElementById('compare-alias-wrap');
                    
                    if (advancedPanel) {
                        [phaseWrap, dimWrap, chartWrap, scoreWrap, baselineWrap, trackingWrap, aliasWrap].forEach(el => {
                            if (el && el.parentElement !== advancedPanel) advancedPanel.appendChild(el);
                        });
                    }
                    const advancedWrap = document.getElementById('compare-advanced-wrap');
                    const dimSel = document.getElementById('a-compare-dim');
                    const scoreSel = document.getElementById('a-trend-score-type');
                    const baselineNeeds = scoreSel && (scoreSel.value === 'std' || scoreSel.value === 'ratio');
                    if (dir === 'class' && dimSel) dimSel.value = 'class';
                    if (dir === 'campus' && dimSel) dimSel.value = 'campus';
                    if (dir === 'cross-grade') {
                        if (dimSel) dimSel.value = 'grade';
                        if (scoreSel && scoreSel.value === 'raw') scoreSel.value = 'pct';
                    }
                    if (examWrap) examWrap.style.display = 'flex';
                    if (phaseWrap) phaseWrap.style.display = dir === 'cross-grade' ? 'flex' : 'none';
                    if (dimWrap) dimWrap.style.display = dir === 'custom' ? 'flex' : 'none';
                    if (trackingWrap) trackingWrap.style.display = 'flex';
                    if (aliasWrap) aliasWrap.style.display = dir === 'cross-grade' ? 'flex' : 'none';
                    if (advancedWrap) advancedWrap.style.display = 'flex';
                    if (chartWrap) chartWrap.style.display = 'flex';
                    if (scoreWrap) scoreWrap.style.display = 'flex';
                    if (baselineWrap) baselineWrap.style.display = baselineNeeds ? 'flex' : 'none';
                    if (dimSel) dimSel.disabled = false;
                    this._syncScoreAlgorithmNote();
                }

                handleCompareDirectionChange() {
                    const dir = document.getElementById('a-compare-direction')?.value || 'class';
                    this.store.state.compareDirection = dir;
                    this._syncCompareDirectionUI();
                    this.updateComparePhaseSelect();
                    this.updateCompareExamsMultiSelect();
                    if (dir === 'cross-grade') this._autoCheckExamsByPhase();
                    this.updateAnalysisMultiSelect();
                    try { this._syncToolbarMoreMenu(); } catch(e) {}
                    try { this.store.silentSave(); } catch(e) {}
                    this.runAnalysis();
                }

                handleComparePhaseChange() {
                    this.store.state.comparePhase = document.getElementById('a-compare-phase')?.value || '';
                    this.updateCompareExamsMultiSelect();
                    if ((document.getElementById('a-compare-direction')?.value || 'class') === 'cross-grade') this._autoCheckExamsByPhase();
                    this.updateAnalysisMultiSelect();
                    this.runAnalysis();
                }

                _autoCheckExamsByPhase() {
                    const phase = document.getElementById('a-compare-phase')?.value || '';
                    const panel = document.getElementById('ms-compare-exams-panel');
                    if (!phase || !panel) return;
                    const ids = new Set((this.store.state.data.exams || [])
                        .filter(ex => Utils.calculatePhase(ex.grade, ex.date) === phase)
                        .map(ex => ex.id));
                    panel.querySelectorAll('.ms-item input').forEach(cb => {
                        cb.checked = ids.has(cb.value);
                    });
                    this._updateMsHeader('ms-compare-exams-panel', 'ms-compare-exams-header', '请勾选您要对比的考试...', true);
                }

                toggleCompareAdvanced() {
                    const panel = document.getElementById('compare-advanced-panel');
                    const btn = document.getElementById('compare-advanced-toggle');
                    if (!panel) return;
                    const isOpen = panel.style.display !== 'none';
                    panel.style.display = isOpen ? 'none' : 'flex';
                    if (btn) btn.textContent = isOpen ? '▸ 调整算法 / 范围 / 图表类型' : '▾ 收起高级参数';
                }

                updateTrendPhaseMultiSelect() {
                    const focus = this.store.state.globalFocus;
                    const exams = this.store.state.data.exams;
                    
                    let validExams = exams.filter(e => {
                        const examCampuses = this._getExamCampuses(e);
                        if (focus.campuses.length > 0 && examCampuses.length > 0 && !examCampuses.some(c=>focus.campuses.includes(c))) return false;
                        if (focus.grades.length > 0 && !focus.grades.includes(e.grade)) return false;
                        if (focus.phases.length > 0) {
                            const p = Utils.calculatePhase(e.grade, e.date);
                            if (!focus.phases.includes(p)) return false;
                        }
                        return true;
                    });

                    const phases = [...new Set(validExams.map(e => Utils.calculatePhase(e.grade, e.date)))].filter(p => !p.includes('未知')).sort(Utils.sortPhaseStrict);
                    const stored = this.store.state.trendPhases && this.store.state.trendPhases.length > 0 ? this.store.state.trendPhases : focus.phases;
                    this._buildMultiSelect('ms-trend-pha-panel', 'ms-trend-pha-header', phases, 'window.app.ui.onTrendPhaseChange()', '请勾选对比学期...', true, stored);
                }

                onTrendPhaseChange() {
                    this.store.state.trendPhases = this._getSelectedClasses('ms-trend-pha-panel');
                    this.store.markAsUnsaved();
                    this.runAnalysis();
                }

                updateAnalysisMultiSelect() {
                    const examEl = document.getElementById('global-exam');
                    const eid = examEl ? examEl.value : null; // 修复：安全读取最新的全局考试ID
                    const type = this.store.state.currentAnalysisType;
                    const focus = this.store.state.globalFocus;
                    let pool = this.store.state.data.students;
                    const activeExam = eid ? this.store.state.data.exams.find(e => e.id === eid) : null;

                    if (activeExam && type !== 'compare') {
                        pool = pool.filter(s => this._studentMatchesFocusForExam(s, activeExam, focus));
                    } else {
                        pool = pool.filter(s => this._studentMatchesFocusForExam(s, null, focus));
                    }
                    
                    if (type === 'compare') {
                        let checkedExamIds = Array.from(document.querySelectorAll('#ms-compare-exams-panel input:checked')).map(cb => cb.value);
                        const dir = document.getElementById('a-compare-direction')?.value || 'class';
                        if (dir === 'cross-grade' && checkedExamIds.length === 0) {
                            const phase = document.getElementById('a-compare-phase')?.value || '';
                            checkedExamIds = (this.store.state.data.exams || [])
                                .filter(ex => !phase || Utils.calculatePhase(ex.grade, ex.date) === phase)
                                .map(ex => ex.id);
                        }
                        let examStuIds = [];
                        if (checkedExamIds.length > 0) {
                            const checkedSet = new Set(checkedExamIds);
                            examStuIds = this.store.state.data.scores
                                .filter(sc => checkedSet.has(sc.examId) && (!sc.examAbsent && (sc.total > 0 || sc.estimatedTotal > 0)))
                                .map(sc => sc.studentId);
                        }
                        if (examStuIds.length > 0) pool = pool.filter(s => examStuIds.includes(s.id));
                    } else if (eid && type !== 'trend' && type !== 'borderline') {
                        const examStuIds = this.store.state.data.scores.filter(s => s.examId === eid && (!s.examAbsent && (s.total > 0 || s.estimatedTotal > 0))).map(s => s.studentId);
                        if (examStuIds.length > 0) {
                            pool = pool.filter(s => examStuIds.includes(s.id));
                        } else {
                            const exam = this.store.state.data.exams.find(e => e.id === eid);
                            if (exam) {
                                const exCamp = this._getExamCampuses(exam);
                                if (exCamp.length > 0) pool = pool.filter(s => exCamp.includes(s.campus) && s.grade === exam.grade);
                            }
                        }
                    }

                    const classes = [...new Set(pool.map(s => {
                        const cls = activeExam ? Utils.getClassForExam(s, activeExam) : { campus: s.campus, teachingClass: s.teachingClass };
                        const campus = cls.campus || s.campus || '';
                        const teachingClass = cls.teachingClass || s.teachingClass || '';
                        return campus && teachingClass ? `${campus} - ${teachingClass}` : '';
                    }).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'zh-CN', {numeric:true}));
                    
                    this._buildMultiSelect('ms-analysis-panel', 'ms-analysis-header', classes, 'window.app.ui.runAnalysis()', '查看所有班级', true);
                }

                _buildCurrentExamDetailExportContext() {
                    const selectedExamId = this.store.state.currentExamId || document.getElementById('global-exam')?.value || '';
                    const fallbackExamId = this.analysisCache && this.analysisCache.exam ? this.analysisCache.exam.id : '';
                    const exam = (this.store.state.data.exams || []).find(e => e.id === (selectedExamId || fallbackExamId));
                    if (!exam) return null;

                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    const studentsById = new Map((this.store.state.data.students || []).map(s => [s.id, s]));
                    const inCurrentScope = row => {
                        if (!row) return false;
                        return this._studentMatchesFocusForExam(row, exam, focus);
                    };
                    const toExportRow = sc => {
                        const stu = studentsById.get(sc.studentId);
                        if (!stu) return null;
                        return {
                            ...stu,
                            id: stu.id,
                            total: Number(sc.total || 0),
                            estimatedTotal: Number(sc.estimatedTotal || 0),
                            details: sc.details || {},
                            examAbsent: sc.examAbsent === true
                        };
                    };
                    const pool = (this.store.state.data.scores || [])
                        .filter(sc => sc.examId === exam.id && Utils.isActualScore(sc, exam))
                        .map(toExportRow)
                        .filter(inCurrentScope);
                    const absentRows = (this.store.state.data.scores || [])
                        .filter(sc => sc.examId === exam.id && sc.examAbsent === true)
                        .map(toExportRow)
                        .filter(inCurrentScope)
                        .sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN', {numeric:true}));
                    return { exam, pool, absentRows };
                }

                _buildCurrentExamScoreListExportContext() {
                    const examId = this.store.state.currentExamId || document.getElementById('global-exam')?.value || '';
                    const exam = (this.store.state.data.exams || []).find(e => e.id === examId);
                    if (!exam) return null;

                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    const students = this.store.state.data.students || [];
                    const studentsById = new Map(students.map((student, index) => [student.id, { student, index }]));
                    const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value));
                    const hasEnteredScore = score => Utils.isActualScore(score, exam);
                    const toRow = score => {
                        const entry = studentsById.get(score.studentId);
                        if (!entry || !this._studentMatchesFocusForExam(entry.student, exam, focus)) return null;
                        const student = entry.student;
                        const position = Utils.getClassForExam(student, exam) || {};
                        return {
                            name: student.name || '',
                            className: student.adminClass || position.adminClass || position.teachingClass || student.teachingClass || '-',
                            total: score.total,
                            examAbsent: score.examAbsent === true,
                            studentOrder: entry.index
                        };
                    };
                    const records = (this.store.state.data.scores || [])
                        .filter(score => score.examId === exam.id && (score.examAbsent === true || hasEnteredScore(score)))
                        .map(toRow)
                        .filter(Boolean)
                        .sort((a, b) => a.studentOrder - b.studentOrder);
                    return { exam, records, students: records.map(record => students[record.studentOrder]) };
                }

                _buildScoreExportFilename(kind, exam, students = []) {
                    const focus = this.store.state.globalFocus || {};
                    const unique = values => [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))];
                    const positions = students.map(student => Utils.getClassForExam(student, exam) || {});
                    const campuses = unique(focus.campuses?.length ? focus.campuses : positions.map(position => position.campus));
                    if (!campuses.length) campuses.push(...unique(exam.campuses?.length ? exam.campuses : [exam.campus]));
                    const classes = unique(focus.tClasses?.length ? focus.tClasses : positions.map(position => position.teachingClass));
                    const grades = unique(exam.grade ? [exam.grade] : (focus.grades?.length ? focus.grades : students.map(student => student.grade)));
                    const shortGrade = value => {
                        const match = value.match(/^(\d{4}|\d{2})\s*级?$/);
                        return match ? match[1].slice(-2) + '级' : value;
                    };
                    const date = String(exam.date || '').match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
                    const dateLabel = date ? `${date[1].slice(-2)}${date[2].padStart(2, '0')}${date[3].padStart(2, '0')}` : (exam.date || '未设考试日期');
                    const campusLabel = campuses.join('、') || '未设校区';
                    const classLabel = grades.map(shortGrade).join('、') + (classes.join('、') || '未设班级');
                    const safe = value => String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');
                    return `[${kind}]${[dateLabel, campusLabel, classLabel, exam.name || '考试'].map(safe).join('-')}.xls`;
                }

                exportClassScoreListExcel() {
                    const context = this._buildCurrentExamScoreListExportContext();
                    if (!context?.exam) return Utils.msg("请先选择一场考试，再导出成绩。", "error");
                    if (!context.records.length) return Utils.msg("当前筛选范围内暂无已录入的成绩。", "error");

                    const esc = value => Utils.escapeHTML(value === undefined || value === null ? '' : String(value));
                    const formatScore = value => Number.isFinite(Number(value)) ? String(Number(Number(value).toFixed(1))) : '';
                    const rows = context.records.map(record => `<tr><td>${esc(record.name)}</td><td>${esc(record.className)}</td><td>${record.examAbsent ? '缺考' : formatScore(record.total)}</td></tr>`).join('');
                    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:'Microsoft YaHei',Arial,sans-serif;color:#1f2937}table{border-collapse:collapse;text-align:center}th,td{border:1px solid #c7c7cc;padding:7px 14px;font-size:12px;vertical-align:middle}th{background:#eef2f7;font-weight:700;color:#344258}tbody tr:nth-child(even) td{background:#f8fafc}td:first-child{text-align:left}</style></head><body><table><thead><tr><th>姓名</th><th>班级</th><th>分数</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = this._buildScoreExportFilename('成绩速报', context.exam, context.students);
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    Utils.msg("成绩速报已导出。");
                }

                // V43: Dedicated Export Excel logic inside UI
                exportAnalysisExcel() {
                    const context = this._buildCurrentExamDetailExportContext();
                    if (!context || !context.exam) return Utils.msg("请先选择一场考试，再导出成绩明细表。", "error");
                    if ((!context.pool || context.pool.length === 0) && (!context.absentRows || context.absentRows.length === 0)) {
                        return Utils.msg("当前考试在筛选范围内暂无可导出的成绩明细。", "error");
                    }

                    const previousCache = this.analysisCache;
                    this.analysisCache = {
                        ...(previousCache || {}),
                        exam: context.exam,
                        pool: context.pool,
                        absentRows: context.absentRows || [],
                        sortCol: 'total',
                        sortAsc: false
                    };
                    try {
                        this.exportDetailTableExcel();
                    } finally {
                        this.analysisCache = previousCache;
                    }
                }

               // ================= 综合报表导出引擎 =================
                exportDetailTableExcel() {
                    if(!this.analysisCache || !this.analysisCache.exam || !this.analysisCache.pool) {
                        return Utils.msg("当前没有可以导出的成绩明细数据", "error");
                    }

                    const exam = this.analysisCache.exam;
                    const pool = this.analysisCache.pool;
                    const absentRows = this.analysisCache.absentRows || [];
                    if (pool.length === 0 && absentRows.length === 0) {
                        return Utils.msg("当前筛选范围内暂无可导出的成绩数据。", "error");
                    }

                    const maxScore = exam.maxTotal || 150;
                    const passLine = maxScore * 0.6;
                    const excLine = maxScore * 0.8;
                    const esc = value => Utils.escapeHTML(value === undefined || value === null ? '' : String(value));
                    const fmt = value => Number.isFinite(Number(value)) ? parseFloat(Number(value).toFixed(1)) : '';
                    const td = (value, className = '', style = '') => `<td${className ? ` class="${className}"` : ''}${style ? ` style="${style}"` : ''}>${value === '' || value === undefined || value === null ? '&nbsp;' : value}</td>`;
                    const th = value => `<th>${esc(value)}</th>`;

                    // 1. 计算本次考试整体名次
                    const sortedPool = [...pool].sort((a,b) => b.total - a.total);
                    const currentRanks = {};
                    sortedPool.forEach((d, idx) => { currentRanks[d.id] = sortedPool.filter(r => r.total > d.total).length + 1; });

                    // 2. 提前计算各班级均分
                    const classStats = {};
                    pool.forEach(p => {
                        const pClass = Utils.getClassForExam(p, exam);
                        const cKey = `${pClass.campus}-${pClass.teachingClass}`;
                        if (!classStats[cKey]) classStats[cKey] = { totalSum: 0, count: 0 };
                        classStats[cKey].totalSum += p.total;
                        classStats[cKey].count++;
                    });

                    // 3. 构建更适合打印和填写的表头
                    const headers = ['名次', '学生姓名', '班级', '卷面总分', '班级均分', '预估分', '目标差', '成绩状态'];
                    (exam.types || []).forEach(t => headers.push(`${t.name} (满分${t.max})`));
                    (exam.types || []).forEach(t => headers.push(`${t.name} 得分率`));
                    const teacherFillCols = Math.max(2, headers.length - 2);
                    const teacherAnalysisSpan = Math.max(1, Math.floor(teacherFillCols / 2));
                    const teacherStrategySpan = Math.max(1, teacherFillCols - teacherAnalysisSpan);

                    // 4. 构建 Excel 可识别的富文本 HTML
                    let htmlStr = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: 'Microsoft YaHei', Arial, sans-serif; color: #1f2937; }
                            h2 { margin: 0 0 8px 0; font-size: 18px; color: #1d1d1f; }
                            .meta { margin: 0 0 12px 0; color: #6e6e73; font-size: 12px; }
                            table { border-collapse: collapse; font-family: 'Microsoft YaHei', Arial, sans-serif; text-align: center; }
                            th, td { border: 1px solid #c7c7cc; padding: 6px 10px; font-size: 12px; vertical-align: middle; }
                            th { background-color: #dedee3; font-weight: bold; color: #1d1d1f; height: 30px; }
                            .score-table tbody tr:nth-child(even) td { background-color: #f7f7f9; }
                            .name { font-weight: bold; color: #1d1d1f; text-align: left; }
                            .class-cell { color: #515156; }
                            .num { text-align: right; font-weight: bold; }
                            .blue { color: #0071e3; }
                            .amber { color: #9a6700; }
                            .red { color: #d70015; }
                            .green { color: #1f7a35; }
                            .muted { color: #86868b; }
                            .status-excellent { background-color: #eaf7ee; color: #176b34; font-weight: bold; }
                            .status-pass { background-color: #fff2d4; color: #92400e; font-weight: bold; }
                            .status-risk { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
                            .rate-good { background-color: #eaf7ee; color: #176b34; font-weight: bold; }
                            .rate-low { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
                            .summary td { background-color: #e5e7eb; font-weight: bold; border-top: 2px solid #6e6e73; }
                            .absent td { background-color: #f2f2f5; color: #6e6e73; }
                            .absent-label { color: #0071e3; font-weight: bold; }
                            .section-title td { background-color: #e3f0ff; color: #1e3a8a; font-weight: bold; text-align: left; border: 1px solid #93c5fd; }
                            .teacher-table th, .teacher-table td { border: 1px solid #1d1d1f; }
                            .teacher-table th { background-color: #f3f4f6; }
                            .fill-cell { height: 72px; text-align: left; vertical-align: top; }
                        </style>
                    </head>
                    <body>
                    <h2>${esc(exam.name || '考试综合报表')}</h2>
                    <p class="meta">导出日期：${new Date().toLocaleDateString('zh-CN')}　统计范围：当前筛选条件内学生</p>
                    <table class="score-table">`;
                    
                    htmlStr += `<thead><tr>`;
                    headers.forEach(h => { htmlStr += th(h); });
                    htmlStr += `</tr></thead><tbody>`;

                    // 填充学生行数据（并应用颜色判据）
                    sortedPool.forEach(d => {
                        htmlStr += `<tr>`;
                        const dClass = Utils.getClassForExam(d, exam);
                        const cKey = `${dClass.campus}-${dClass.teachingClass}`;
                        const cAvg = classStats[cKey] ? (classStats[cKey].totalSum / classStats[cKey].count) : d.total;
                        
                        let rank = currentRanks[d.id];
                        htmlStr += td(rank);
                        htmlStr += td(esc(d.name), 'name');
                        const dClassForDisplay = Utils.getClassForExam(d, exam);
                        const classLabel = d.adminClass || dClassForDisplay.adminClass || dClassForDisplay.teachingClass || d.teachingClass || '-';
                        htmlStr += td(esc(classLabel), 'class-cell');
                        htmlStr += td(fmt(d.total), 'num blue');
                        htmlStr += td(fmt(cAvg), 'num');

                        if (d.estimatedTotal && d.estimatedTotal > 0) {
                            htmlStr += td(fmt(d.estimatedTotal), 'num amber');
                            const targetDiffNum = d.total - d.estimatedTotal;
                            const targetDiff = targetDiffNum.toFixed(1);
                            const tDiffColor = targetDiffNum > 0 ? '#1f7a35' : (targetDiffNum < 0 ? '#d70015' : '#6e6e73');
                            htmlStr += td(targetDiffNum > 0 ? `+${targetDiff}` : targetDiff, 'num', `color:${tDiffColor};font-weight:bold;`);
                        } else {
                            htmlStr += td('', 'muted');
                            htmlStr += td('', 'muted');
                        }

                        let status = '待提高', statusClass = 'status-risk';
                        if (d.total >= excLine) { status = '优秀'; statusClass = 'status-excellent'; }
                        else if (d.total >= passLine) { status = '及格'; statusClass = 'status-pass'; }
                        htmlStr += td(status, statusClass);

                        (exam.types || []).forEach(t => {
                            const hasScore = Object.prototype.hasOwnProperty.call(d.details || {}, t.name);
                            htmlStr += td(hasScore ? fmt(d.details[t.name]) : '', 'num');
                        });

                        (exam.types || []).forEach(t => {
                            const hasScore = Object.prototype.hasOwnProperty.call(d.details || {}, t.name);
                            if (!hasScore) {
                                htmlStr += td('', 'muted');
                                return;
                            }
                            const s = Number(d.details[t.name] || 0);
                            const rNum = t.max > 0 ? (s / t.max) * 100 : 0;
                            const rStr = rNum.toFixed(1) + '%';
                            let rateClass = '';
                            if (rNum >= 80) rateClass = 'rate-good';
                            else if (rNum < 60) rateClass = 'rate-low';
                            htmlStr += td(rStr, rateClass);
                        });

                        htmlStr += `</tr>`;
                    });

                    // 5. 添加整体平均与缺考学生
                    const allTotals = pool.map(p => p.total);
                    const overallAvg = allTotals.length > 0 ? (allTotals.reduce((a,b)=>a+b,0)/allTotals.length).toFixed(1) : 0;
                    const estimatedTotals = pool.map(p => Number(p.estimatedTotal || 0)).filter(v => v > 0);
                    const estimatedAvgNum = estimatedTotals.length ? estimatedTotals.reduce((a,b)=>a+b,0) / estimatedTotals.length : null;
                    const estimatedAvg = estimatedAvgNum !== null ? estimatedAvgNum.toFixed(1) : '';
                    const targetDiffAvgNum = estimatedAvgNum !== null ? Number(overallAvg) - estimatedAvgNum : null;
                    const targetDiffAvg = targetDiffAvgNum !== null ? targetDiffAvgNum.toFixed(1) : '';
                    const targetDiffAvgColor = targetDiffAvgNum === null ? '#6e6e73' : (targetDiffAvgNum >= 0 ? '#1f7a35' : '#d70015');
                    const overallStatus = targetDiffAvgNum === null ? '无预估' : (targetDiffAvgNum >= 0 ? '整体达标' : '未达标');
                    const overallStatusClass = targetDiffAvgNum === null ? 'muted' : (targetDiffAvgNum >= 0 ? 'status-excellent' : 'status-risk');
                    
                    htmlStr += `<tr class="summary">
                        ${td('-')}${td('整体平均')}${td('-')}${td(overallAvg, 'num blue')}${td(overallAvg, 'num')}${td(estimatedAvg, 'num amber')}${td(targetDiffAvgNum !== null && targetDiffAvgNum > 0 ? `+${targetDiffAvg}` : targetDiffAvg, 'num', `color:${targetDiffAvgColor};font-weight:bold;`)}${td(overallStatus, overallStatusClass)}`;
                    
                    (exam.types || []).forEach(t => {
                        const tScores = pool.map(p => p.details[t.name] || 0);
                        const tAvg = tScores.length ? (tScores.reduce((a,b)=>a+b,0)/tScores.length).toFixed(1) : 0;
                        htmlStr += td(tAvg, 'num');
                    });

                    (exam.types || []).forEach(t => {
                        const tScores = pool.map(p => p.details[t.name] || 0);
                        const tAvg = tScores.length ? (tScores.reduce((a,b)=>a+b,0)/tScores.length) : 0;
                        const rNum = t.max > 0 ? (tAvg / t.max) * 100 : 0;
                        const rStr = rNum.toFixed(1) + '%';
                        let rateClass = '';
                        if (rNum >= 80) rateClass = 'rate-good';
                        else if (rNum < 60) rateClass = 'rate-low';
                        htmlStr += td(rStr, rateClass);
                    });
                    
                    htmlStr += `</tr>`;

                    absentRows.forEach(d => {
                        const dClassForDisplay = Utils.getClassForExam(d, exam);
                        htmlStr += `<tr class="absent">`;
                        htmlStr += td('-');
                        htmlStr += td(esc(d.name), 'name');
                        const classLabel = d.adminClass || dClassForDisplay.adminClass || dClassForDisplay.teachingClass || d.teachingClass || '-';
                        htmlStr += td(esc(classLabel), 'class-cell');
                        htmlStr += td('缺考', 'absent-label');
                        htmlStr += td('');
                        htmlStr += td('');
                        htmlStr += td('');
                        htmlStr += td('缺考', 'absent-label');
                        (exam.types || []).forEach(() => { htmlStr += td(''); });
                        (exam.types || []).forEach(() => { htmlStr += td(''); });
                        htmlStr += `</tr>`;
                    });
                    
                    htmlStr += `</tbody></table>`;

                    htmlStr += `<br><table class="teacher-table">
                        <thead>
                            <tr class="section-title"><td colspan="${headers.length}">学生成绩分析与对策（教师填写）</td></tr>
                            <tr><th>名次</th><th>学生姓名</th><th colspan="${teacherAnalysisSpan}">成绩分析</th><th colspan="${teacherStrategySpan}">对策</th></tr>
                        </thead>
                        <tbody>`;
                    sortedPool.forEach(d => {
                        htmlStr += `<tr>
                            ${td(currentRanks[d.id])}
                            ${td(esc(d.name), 'name')}
                            <td colspan="${teacherAnalysisSpan}" class="fill-cell">&nbsp;</td>
                            <td colspan="${teacherStrategySpan}" class="fill-cell">&nbsp;</td>
                        </tr>`;
                    });
                    htmlStr += `</tbody></table></body></html>`;

                    // 6. 通过 Blob 将 HTML 推送下载为 .xls 文件
                    const blob = new Blob([htmlStr], { type: 'application/vnd.ms-excel' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = this._buildScoreExportFilename('成绩分析表', exam, [...pool, ...absentRows]);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    // 延迟释放对象URL，确保浏览器有充足时间完成异步文件流读取
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    
                    Utils.msg("成绩分析表已生成并导出。");
                }


                _setAnalysisTableFillMode(enabled, hideChart = true) {
                    const body = document.querySelector('#view-analysis .content-body');
                    const table = document.getElementById('analysis-table-area');
                    const chartCard = document.getElementById('chart-wrapper-card');
                    if (body) {
                        body.classList.toggle('analysis-table-fill-mode', !!enabled && !!hideChart);
                        body.classList.toggle('analysis-table-fill-with-chart', !!enabled && !hideChart);
                    }
                    if (table) table.classList.toggle('table-fill-page', !!enabled);
                    if (enabled && hideChart && chartCard) chartCard.style.display = 'none';
                }

                sortAnalysis(col) {
                    if (!this.analysisCache || !this.analysisCache.exam) return;
                    if (this.store.state.currentAnalysisType === 'compare' || this.store.state.currentAnalysisType === 'target') return;
                    
                    if (this.analysisCache.sortCol === col) {
                        this.analysisCache.sortAsc = !this.analysisCache.sortAsc;
                    } else {
                        this.analysisCache.sortCol = col;
                        this.analysisCache.sortAsc = false; 
                    }
                    this.renderAnalysisTableRows();
                    const area = document.getElementById('analysis-table-area');
                    if (area) {
                        area.classList.remove('sort-flash');
                        void area.offsetWidth;
                        area.classList.add('sort-flash');
                        setTimeout(() => area.classList.remove('sort-flash'), 220);
                    }
                }

                switchHeatmapDetailPage(mode = 'chart') {
                    const chartCard = document.getElementById('chart-wrapper-card');
                    const tableArea = document.getElementById('analysis-table-area');
                    if (this.store.state.currentAnalysisType !== 'heatmap' || !chartCard || !tableArea) return;
                    const showTable = mode === 'table';
                    chartCard.style.display = showTable ? 'none' : 'flex';
                    tableArea.style.display = showTable ? 'flex' : 'none';
                    tableArea.classList.toggle('heatmap-table-page', showTable);
                    if (!showTable) {
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            try { if (this.chartInstance && typeof this.chartInstance.resize === 'function') this.chartInstance.resize(); } catch(e) {}
                        }));
                    } else {
                        const scroller = tableArea.querySelector('.table-scroll-container');
                        if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                        try { this._bindScrollShadows(tableArea); } catch(e) {}
                    }
                    const body = document.querySelector('#view-analysis .content-body');
                    if (body) body.scrollTo({ top: 0, behavior: 'auto' });
                }

                // V43: Student Profile Open

                _displaySegmentStudents(segmentKey, thresholds, exam, maxScore) {
                    const segment = thresholds[segmentKey];
                    if (!segment || segment.students.length === 0) return;

                    const segmentTitles = {
                        exc: '优秀学生',
                        good: '良好学生',
                        fair: '待提高学生',
                        poor: '困难学生'
                    };

                    document.getElementById('analysis-table-area').style.display = 'flex';
                    document.getElementById('table-title').innerHTML = `${segmentTitles[segmentKey]} (${segment.students.length}人) - ${segment.label}`;
                    
                    const thead = document.getElementById('thead-analysis');
                    const tbody = document.getElementById('tbody-analysis');
                    
                    thead.innerHTML = `<tr>
                        <th style="z-index:var(--z-sticky); width:60px;">排名</th>
                        <th style="z-index:var(--z-sticky); width:100px;">姓名</th>
                        <th style="z-index:var(--z-sticky); width:100px;">校区</th>
                        <th style="z-index:var(--z-sticky); width:100px;">班级</th>
                        <th style="z-index:var(--z-sticky); width:80px;">总分</th>
                        <th style="z-index:var(--z-sticky); width:80px;">得分率</th>
                        <th style="z-index:var(--z-sticky);">各题型得分</th>
                    </tr>`;
                    
                    let tbHtml = '';
                    segment.students.forEach((stu, idx) => {
                        const rate = ((stu.total / maxScore) * 100).toFixed(1);
                        
                        let typeDetailsHtml = '';
                        if (exam.types && exam.types.length > 0) {
                            const ratios = exam.types.map(t => {
                                const stuScore = stu.details[t.name] || 0;
                                return t.max > 0 ? (stuScore / t.max) * 100 : 0;
                            });
                            const avgRatio = ratios.length ? ratios.reduce((a,b)=>a+b,0) / ratios.length : 0;
                            exam.types.forEach((t, idx) => {
                                const stuScore = stu.details[t.name] || 0;
                                const ratio = t.max > 0 ? ((stuScore / t.max) * 100) : 0;
                                const abnormal = Math.abs(ratio - avgRatio) > 30;
                                const warnHtml = abnormal ? ` ${window.gk2IconMarkup('alert')}` : '';
                                const warnAttr = abnormal ? ' title="该题型得分异常，请核查"' : '';
                                typeDetailsHtml += `<span style="margin-right:8px; padding:4px 8px; background:#f2f2f5; border-radius:4px; font-size:12px;"${warnAttr}>${Utils.escapeHTML(t.name)}: ${stuScore}/${t.max} (${ratio.toFixed(0)}%)${warnHtml}</span>`;
                            });
                        }
                        
                        const safeStuName = Utils.escapeHTML(stu.name);
                        const safeCampus = Utils.escapeHTML(stu.campus);
                        const classAtExam = Utils.getClassForExam(stu, exam);
                        const safeTClass = Utils.escapeHTML(classAtExam.teachingClass || stu.teachingClass || '-');
                        tbHtml += `<tr data-profile-student-id="${Utils.escapeHTML(stu.id)}">
                            <td style="font-weight:bold; text-align:center;">${idx + 1}</td>
                            <td style="font-weight:bold;"><a href="#" onclick="event.preventDefault(); window.app.ui.openStudentProfile('${stu.id}', this)" style="cursor:pointer; text-decoration:underline; color:var(--primary);">${safeStuName}</a></td>
                            <td style="color:var(--text-sub);">${safeCampus}</td>
                            <td style="color:var(--text-sub);">${safeTClass}</td>
                            <td style="font-weight:bold; font-size:15px;">${stu.total}</td>
                            <td style="font-weight:bold; color:${segment.color};">${rate}%</td>
                            <td>${typeDetailsHtml}</td>
                        </tr>`;
                    });
                    tbody.innerHTML = tbHtml;
                }

                openStudentProfile(sid, sourceElement = null) {
                    const stu = this.store.state.data.students.find(s => s.id === sid);
                    if(!stu) return;
                    const modal = document.getElementById('modal-student-profile');
                    const wasOpen = !!modal?.open;
                    const sourceTable = this._getProfileTable(sourceElement);
                    const table = sourceTable || (wasOpen ? this._profileOrderTable : this._findVisibleProfileTable(sid));
                    const tableOrder = this._getProfileTableStudentOrder(table || sourceElement, sid);
                    if (tableOrder) {
                        this._profileOrderTable = table;
                        this._profileStudentOrder = tableOrder;
                    } else if (!wasOpen) {
                        this._profileOrderTable = null;
                        this._profileStudentOrder = null;
                    }
                    this._profileCurrentStudentId = sid;
                    this._syncProfileJumpList();

                    document.getElementById('sp-name').innerText = stu.name;
                    document.getElementById('sp-campus').innerText = stu.campus;
                    document.getElementById('sp-grade').innerText = stu.grade;
                    document.getElementById('sp-class').innerText = Utils.hasTransferred(stu) ? `${stu.teachingClass}（${Utils.getTransferSummary(stu)}）` : stu.teachingClass;

                    this._syncStudentProfileAISummary(stu);

                    if (!modal.open) modal.showModal();

                    // Generate Charts after modal opens to ensure valid DOM dimensions
                    setTimeout(() => {
                            if (!modal.open || this._profileCurrentStudentId !== sid) return;
                            this._renderProfileTrendChart(stu);
                            this._renderProfileRadarChart(stu);
                            this._renderProfileQuadrant(stu);
                            this._resizeStudentProfileChartsSoon();
                    }, 50);
                    this._bindStudentProfileResizeObserver();
                }

                showStudentProfile(sid) {
                    return this.openStudentProfile(sid);
                }

                _getProfileTable(sourceElement) {
                    const sourceRow = sourceElement?.closest?.('tr');
                    return sourceRow?.closest('table')
                        || (sourceElement?.matches?.('table') ? sourceElement : sourceElement?.closest?.('table'))
                        || null;
                }

                _getProfileTableStudentOrder(sourceElement, currentStudentId) {
                    const sourceRow = sourceElement?.closest?.('tr');
                    const table = sourceRow?.closest('table') || this._getProfileTable(sourceElement);
                    const tbody = sourceRow?.closest('tbody') || table?.tBodies?.[0] || sourceElement?.closest?.('tbody');
                    if (!tbody) return null;
                    const order = [];
                    tbody.querySelectorAll('tr').forEach(row => {
                        if (row.hidden) return;
                        const style = window.getComputedStyle(row);
                        const rect = row.getBoundingClientRect();
                        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return;
                        const id = row.dataset.profileStudentId || row.querySelector('[data-profile-student-id]')?.dataset.profileStudentId;
                        if (id && !order.includes(id)) order.push(id);
                    });
                    return order.includes(String(currentStudentId)) ? order : null;
                }

                _findVisibleProfileTable(currentStudentId) {
                    const profile = document.getElementById('modal-student-profile');
                    const candidates = [...document.querySelectorAll('table')]
                        .filter(table => !profile?.contains(table) && table.getClientRects().length)
                        .map(table => ({
                            table,
                            order: this._getProfileTableStudentOrder(table, currentStudentId)
                        }))
                        .filter(candidate => candidate.order);
                    candidates.sort((a, b) => b.order.length - a.order.length);
                    return candidates[0]?.table || null;
                }

                _getProfileStudentList() {
                    if (Array.isArray(this._profileStudentOrder)) {
                        const studentsById = new Map((this.store.state.data.students || []).map(student => [String(student.id), student]));
                        const orderedStudents = this._profileStudentOrder.map(id => studentsById.get(String(id))).filter(Boolean);
                        if (orderedStudents.length) return orderedStudents;
                    }
                    const focus = this.store.state.globalFocus || {};
                    return (this.store.state.data.students || []).filter(s => {
                        if (focus.campuses && focus.campuses.length && !focus.campuses.includes(s.campus)) return false;
                        if (focus.grades && focus.grades.length && !focus.grades.includes(s.grade)) return false;
                        if (focus.tClasses && focus.tClasses.length && !focus.tClasses.includes(s.teachingClass)) return false;
                        if (focus.tags && focus.tags.length && !(s.tags || []).some(t => focus.tags.includes(t))) return false;
                        return true;
                    }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'zh-CN',{numeric:true}));
                }

                _syncProfileJumpList() {
                    const list = document.getElementById('sp-jump-list');
                    const input = document.getElementById('sp-jump-search');
                    if (!list) return;
                    const students = this._getProfileStudentList();
                    list.innerHTML = students.map(s => `<option value="${Utils.escapeHTML(s.name)}">${Utils.escapeHTML(s.campus || '')} ${Utils.escapeHTML(s.teachingClass || '')}</option>`).join('');
                    const cur = students.find(s => String(s.id) === String(this._profileCurrentStudentId));
                    if (input && cur) input.value = cur.name;
                }

                jumpStudentProfile(name) {
                    const text = String(name || '').trim();
                    if (!text) return;
                    const stu = this._getProfileStudentList().find(s => s.name === text || `${s.name} ${s.campus || ''} ${s.teachingClass || ''}`.includes(text));
                    if (stu) this.openStudentProfile(stu.id);
                    else Utils.msg('没有找到匹配学生', 'warning');
                }

                navigateStudentProfile(step) {
                    const tableOrder = this._getProfileTableStudentOrder(this._profileOrderTable, this._profileCurrentStudentId);
                    if (tableOrder) this._profileStudentOrder = tableOrder;
                    const list = this._getProfileStudentList();
                    if (!list.length) return;
                    const idx = list.findIndex(s => String(s.id) === String(this._profileCurrentStudentId));
                    if (idx < 0) return;
                    const next = list[(idx + step + list.length) % list.length];
                    this.openStudentProfile(next.id);
                }

                _resizeStudentProfileChartsSoon() {
                    const resize = () => {
                        ['sp-chart-trend','sp-chart-radar','sp-chart-quadrant'].forEach(id => {
                            const el = document.getElementById(id);
                            try { const chart = el && echarts.getInstanceByDom(el); if (chart) chart.resize(); } catch(e) {}
                        });
                    };
                    requestAnimationFrame(resize);
                    setTimeout(resize, 120);
                }

                _bindStudentProfileResizeObserver() {
                    const modal = document.getElementById('modal-student-profile');
                    if (!modal || modal.__profileResizeBound) return;
                    modal.__profileResizeBound = true;
                    if ('ResizeObserver' in window) {
                        this._profileResizeObserver = new ResizeObserver(() => this._resizeStudentProfileChartsSoon());
                        this._profileResizeObserver.observe(modal);
                    }
                    modal.addEventListener('close', () => {
                        try { if (this._profileResizeObserver) this._profileResizeObserver.disconnect(); } catch(e) {}
                        modal.__profileResizeBound = false;
                    }, { once: true });
                }

                _syncStudentProfileAISummary(stu) {
                    const aiSummaryEl = document.getElementById('ai-summary-content');
                    if (!aiSummaryEl) return;

	                    const defaultText = '<div class="ai-summary-cta"><strong>生成一份学生学情小结</strong><span>结合当次成绩、班级均分和题型表现，自动整理优势、风险和下一步建议。</span></div>';

                    const currentExamId = this.store.state.currentExamId;
                    const currentScore = currentExamId && Utils.canReadStudent(stu,this.store.state.data.exams.find(e=>e.id===currentExamId)) ? this.store.state.data.scores.find(s => s.examId === currentExamId && s.studentId === stu.id) : null;
                    const commentText = currentScore && currentScore.aiComment ? String(currentScore.aiComment) : '';
                    const hasComment = commentText.trim().length > 0;

                    aiSummaryEl.innerHTML = hasComment ? commentText.replace(/\r?\n/g, '<br>') : defaultText;
                    this._updateStudentProfileAIButton(stu);
                }

                _updateStudentProfileAIButton(stu) {
                    const aiButton = document.querySelector('#modal-student-profile #gk2-profile-ai-summary-button');
                    if (!aiButton || !stu) return;

                    const currentExamId = this.store.state.currentExamId;
                    const currentScore = currentExamId ? this.store.getScore(stu.id, currentExamId) : null;
                    const hasComment = !!(currentScore && String(currentScore.aiComment || '').trim());

                    aiButton.className = 'secondary no-export';
                    aiButton.textContent = hasComment ? '重新生成AI摘要' : '生成AI摘要';
                }

	                _findAISummaryScoreRecord(examId, studentRef) {
	                    const ref = String(studentRef || '').trim();
	                    const student = this.store.state.data.students?.find(s => s.id === ref || s.name === ref);
	                    if (!student) return { student: null, studentScore: null, studentScoreIndex: -1 };

	                    const studentScoreIndex = this.store.state.data.scores.findIndex(s => s.examId === examId && s.studentId === student.id);
	                    const studentScore = studentScoreIndex !== -1 ? this.store.state.data.scores[studentScoreIndex] : this.store.getScore(student.id, examId);


                    return { student, studentScore, studentScoreIndex };
                }

                _renderInlineMarkedCell(primaryHtml, markersHtml = '', prefixHtml = '') {
                    const markers = markersHtml ? `<span class="inline-marked-cell-markers">${markersHtml}</span>` : '';
                    if (prefixHtml) {
                        return `<span class="inline-marked-cell"><span class="inline-marked-cell-prefix">${prefixHtml}</span><span class="inline-marked-cell-main">${primaryHtml}</span>${markers}</span>`;
                    }
                    return `<span class="inline-marked-cell"><span class="inline-marked-cell-main">${primaryHtml}</span>${markers}</span>`;
                }

                _getDetailsChangeExams(exam) {
                    if (!exam) return [];
                    const focus = this.store.state.globalFocus || {};
                    const selectedCampuses = Array.isArray(focus.campuses) ? focus.campuses.filter(Boolean) : [];
                    // 未指定校区时沿用当前考试的校区范围；空校区配置表示全部校区。
                    const campusScope = selectedCampuses.length ? selectedCampuses : this._getExamCampuses(exam);
                    return (this.store.state.data.exams || []).filter(candidate => {
                        if (candidate.grade !== exam.grade) return false;
                        const campuses = this._getExamCampuses(candidate);
                        return !campusScope.length || !campuses.length || campuses.some(campus => campusScope.includes(campus));
                    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                }

                _getDetailsViewScoreRows(eid, options = {}) {
                    const state = this.store && this.store.state ? this.store.state : {};
                    const data = state.data || { students: [], exams: [], scores: [] };
                    const exam = (data.exams || []).find(e => e.id === eid);
                    if (!exam) return { exam: null, scoreRows: [] };
                    const includeAbsent = options.includeAbsent === true;

                    const studentsById = new Map((data.students || []).map(s => [s.id, s]));
                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    const allowedStudents = (data.students || []).filter(s => this._studentMatchesFocusForExam(s, exam, focus));
                    const allowedIds = new Set(allowedStudents.map(s => s.id));

                    const scoreRows = (data.scores || [])
                        .filter(s => s.examId === eid && allowedIds.has(s.studentId) && (Utils.isActualScore(s, exam) || (includeAbsent && s.examAbsent)))
                        .map(s => {
                            const stu = studentsById.get(s.studentId) || {};
                            const classAtExam = Utils.getClassForExam(stu, exam);
                            return {
                                id: s.studentId,
                                name: stu.name || s.studentId || '-',
                                campus: stu.campus || '-',
                                teachingClass: classAtExam.teachingClass || stu.teachingClass || '-',
                                adminClass: stu.adminClass || '-',
                                total: Number(s.total || 0),
                                estimatedTotal: Number(s.estimatedTotal || 0),
                                isEstimated: s.isEstimated === true,
                                details: s.details || {},
                                questionCounts: s.questionCounts || {},
                                aiComment: s.aiComment || '',
                                examAbsent: s.examAbsent === true
                            };
                        })
                        .sort((a, b) => {
                            if (a.examAbsent !== b.examAbsent) return a.examAbsent ? 1 : -1;
                            return b.total - a.total;
                        });

                    return { exam, scoreRows };
                }

	                _buildAISummaryContext(studentRef) {
	                    const exam = this.store.state.data.exams?.find(e => e.id === this.store.state.currentExamId);
	                    if (!exam) return null;

	                    const { student, studentScore, studentScoreIndex } = this._findAISummaryScoreRecord(exam.id, studentRef);
	                    if (!student || !Utils.isActualScore(studentScore, exam)) return null;
                    if (!studentScore) return null;

                    const examsByDateDesc = [...(this.store.state.data.exams || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    const currentExamIndex = examsByDateDesc.findIndex(e => e.id === exam.id);
                    let prevExamData = null;
                    if (currentExamIndex >= 0) {
                        for (let i = currentExamIndex + 1; i < examsByDateDesc.length; i++) {
                            const prevExam = examsByDateDesc[i];
                            const prevScore = this.store.getScore(student.id, prevExam.id);
                            if (Utils.isActualScore(prevScore, prevExam)) {
                                prevExamData = { name: prevExam.name, total: prevScore.total, maxTotal:prevExam.maxTotal, scoreRate:prevExam.maxTotal>0?prevScore.total/prevExam.maxTotal*100:null };
                                break;
                            }
                        }
                    }

                    const scores = this.store.state.data.scores?.filter(s => s.examId === exam.id && Utils.isActualScore(s) && this._studentMatchesFocusForExam(this.store.state.data.students.find(st=>st.id===s.studentId),exam)) || [];
                    const totalStudents = scores.length;
                    let rank = 1;
                    scores.forEach(s => { if (s.total > studentScore.total) rank++; });

                    const gradeScores = scores;
                    const classStudentIds = this.store.state.data.students
                        .filter(s => {
                            const classAtExam = Utils.getClassForExam(s, exam);
                            const studentClassAtExam = Utils.getClassForExam(student, exam);
                            return classAtExam.campus === studentClassAtExam.campus && classAtExam.teachingClass === studentClassAtExam.teachingClass;
                        })
                        .map(s => s.id);
                    const classScores = scores.filter(s => classStudentIds.includes(s.studentId));

                    const summarizeStudents = students => window.gk2Statistics.summarize(students.map(st=>({studentId:st.id,record:this.store.getScore(st.id,exam.id)})),exam);
                    const scopeStudents=this.store.state.data.students.filter(st=>this._studentMatchesFocusForExam(st,exam));
                    const gradeParts=summarizeStudents(scopeStudents).types;
                    const classParts=summarizeStudents(scopeStudents.filter(st=>classStudentIds.includes(st.id))).types;
                    const averages=parts=>Object.fromEntries(parts.map(t=>[t.name,t.average==null?null:Number(t.average.toFixed(1))]));
                    const counts=parts=>Object.fromEntries(parts.map(t=>[t.name,t.count]));
                    const gradeAvgScores=averages(gradeParts),classAvgScores=averages(classParts);
                    const gradeTypeCounts=counts(gradeParts),classTypeCounts=counts(classParts);

                    return {
                        exam,
                        student,
                        studentScore,
                        prevExamData,
                        totalStudents,
                        rank,
                        gradeAvgScores,
                        classAvgScores,
                        gradeTypeCounts, classTypeCounts,
                        studentScoreIndex
                    };
                }

		                _buildAISummaryPrompt(studentName, ctx) {
	                    return `你是一位有经验、说话温和的高中日语老师。请根据以下数据，为教师生成一份客观、具体、不过度施压的学生学情记录。

核心规则：
1. 格式：必须分三点陈述，且每一点必须另起一行：1. 亮点 2. 需要留意 3. 下一步建议。
2. 语气：采用第三人称、教师记录式表达，客观、温和、具体；不要直接对学生说话。
3. 人称：只能使用“该生”“学生姓名”或“其”等第三人称表达，严禁使用“你”“你的”“你在”“建议你”等第二人称。
4. 内容：先肯定一个具体亮点，再温和指出一个最值得关注的模块，最后给出1-2个可执行的小建议。
5. 波动分析：${ctx.prevExamData ? `参考该生上次考试（${ctx.prevExamData.name}）总分为${ctx.prevExamData.total}/${ctx.prevExamData.maxTotal}（得分率${ctx.prevExamData.scoreRate?.toFixed(1)}%），当前总分为${ctx.studentScore.total}/${ctx.exam.maxTotal}（得分率${(ctx.studentScore.total/ctx.exam.maxTotal*100).toFixed(1)}%）。跨满分以得分率辅助比较，不能单凭原始分差判断进退步或难度。` : '由于该生此前无历史成绩，无需分析波动，请聚焦本次表现和下一步建议。'}
6. 禁令：严禁使用 ** 等任何 Markdown 符号；不要说“根据数据”“报告如下”；不要夸大结论；总字数控制在 170 字以内。

数据上下文：
- 学生：${studentName}
- 本次考试：${ctx.exam.name} (满分${ctx.exam.maxTotal || ctx.exam.fullScore})
- 本次表现：总分${ctx.studentScore.total}，当前范围排名${ctx.rank}/${ctx.totalStudents}
- 各模块详情：${JSON.stringify(ctx.studentScore.scores || ctx.studentScore.details || {})}
- 当前筛选范围题型均分：${JSON.stringify(ctx.gradeAvgScores)}；各题型有效人数：${JSON.stringify(ctx.gradeTypeCounts)}
- 班级题型均分：${JSON.stringify(ctx.classAvgScores)}；各题型有效人数：${JSON.stringify(ctx.classTypeCounts)}

请直接输出正文，绝对不要包含“好的”、“根据数据”等任何多余的开头或结尾语。`;
	                }

	                async _generateAISummaryComment(studentRef, options = {}) {
	                    const ctx = this._buildAISummaryContext(studentRef);
	                    if (!ctx) throw new Error('未找到该生当次考试数据');
                    const operationContext=Utils.contextStamp(), originalRecord=JSON.stringify(ctx.studentScore);

                    const apiKey = localStorage.getItem('gakuten_ai_key');
                    if (!apiKey) throw new Error('请先在系统设置中填写 AI API Key！');

                    const providerSelect = document.getElementById('ai-provider-select');
                    const baseUrlInput = document.getElementById('ai-base-url');
                    const modelInput = document.getElementById('ai-model-input');
                    const provider = (localStorage.getItem('gakuten_ai_provider') || (providerSelect && providerSelect.value) || 'deepseek').trim();
                    const rawBaseUrl = (localStorage.getItem('gakuten_ai_base_url') || (baseUrlInput && baseUrlInput.value) || '').trim();
                    const modelFromInput = (localStorage.getItem('gakuten_ai_model') || (modelInput && modelInput.value) || '').trim();
                    const defaultModelMap = {
                        deepseek: 'deepseek-v4-flash',
                        gemini: 'gemini-3-flash-preview',
                        qwen: 'qwen3.6-plus',
                        'openai-compatible': 'gpt-4o-mini'
                    };
                    const modelName = modelFromInput || defaultModelMap[provider] || 'deepseek-v4-flash';
                    const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
                    const defaultBaseUrlMap = {
                        deepseek: 'https://api.deepseek.com',
                        gemini: 'https://generativelanguage.googleapis.com/v1beta',
                        qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
                    };
                    const apiBaseUrl = normalizedBaseUrl || defaultBaseUrlMap[provider] || '';
                    if (provider === 'openai-compatible' && !apiBaseUrl) {
                        throw new Error('请选择并填写 OpenAI 兼容中转 API 的 Base URL');
                    }

	                    const prompt = this._buildAISummaryPrompt(ctx.student.name, ctx);
                    const systemPrompt = '你是一位温和、细致、擅长记录学情的高中日语老师。你会基于成绩数据给教师提供客观、第三人称的学生学情记录，避免第二人称和直接训导式表达。';
                    let response;
                    let data;
                    let commentText = '';
                    if (provider === 'gemini') {
                        response = await fetch(`${apiBaseUrl}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                systemInstruction: { parts: [{ text: systemPrompt }] },
                                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                                generationConfig: { temperature: 0.7 }
                            })
                        });
                        data = await response.json();
                        if (data.error) throw new Error(data.error.message || 'Gemini 请求失败');
                        commentText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
                    } else {
                        response = await fetch(`${apiBaseUrl}/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: modelName,
                                messages: [
	                                { role: 'system', content: systemPrompt },
                                    { role: 'user', content: prompt }
                                ],
                                temperature: 0.7
                            })
                        });
                        data = await response.json();
                        if (data.error) throw new Error(data.error.message || 'AI 请求失败');
                        commentText = (data.choices?.[0]?.message?.content || '').trim();
                    }
                    if (!commentText) throw new Error('未返回有效内容');
                    commentText = commentText
                        .replace(/你的/g, '该生的')
                        .replace(/你在/g, '该生在')
                        .replace(/建议你/g, '建议该生')
                        .replace(/你需要/g, '该生需要')
                        .replace(/你可以/g, '该生可以')
                        .replace(/你应/g, '该生应')
                        .replace(/你/g, '该生');

	                    Utils.assertContext(operationContext);
                    if(JSON.stringify(ctx.studentScore)!==originalRecord||!Utils.isActualScore(ctx.studentScore))throw Error('成绩已变化，请重新生成。');
                    ctx.studentScore.aiComment = commentText;
	                    ctx.studentScore._ts = Date.now();
	                    if (ctx.studentScoreIndex !== -1) {
	                        this.store.state.data.scores[ctx.studentScoreIndex] = ctx.studentScore;
	                    }
	                    if (!options.deferSave) {
	                        this.store.save();
	                        if (this.cur === 'details') this.renderDetailsView();
	                    }

	                    return { commentText, ctx };
	                }

                async generateAISummary(studentName, btnElement) {
                    let contentDiv = document.getElementById('ai-summary-content');
                    if (!contentDiv && btnElement) {
                        alert('未找到 AI 评语容器，请重新打开学生档案');
                        return;
                    }

	                    const studentRef = this._profileCurrentStudentId || studentName;
	                    const ctx = this._buildAISummaryContext(studentRef);
                    if (!ctx) {
                        alert('未找到该生当次考试数据');
                        return;
                    }

                    if (ctx.studentScore.aiComment && btnElement && !confirm('重新生成将覆盖现有的 AI 评语，确定继续吗？')) return;

                    if (btnElement) {
                        btnElement.innerHTML = `<span style="visibility:hidden;">${window.gk2IconMarkup('clock')} 思考中...</span><span class="ai-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
                        btnElement.disabled = true;
                    }
                    if (contentDiv) contentDiv.innerHTML = '<span style="color:var(--primary);">AI 正在深度读取数据并生成诊断报告，请稍候...</span>';

                    try {
	                        const { commentText } = await this._generateAISummaryComment(studentRef);

                        if (contentDiv) {
                            contentDiv.innerHTML = commentText.replace(/\r?\n/g, '<br>');
                            contentDiv.scrollTo({ top: contentDiv.scrollHeight, behavior: 'smooth' });
                        }
                    } catch (error) {
                        console.error(error);
                        if (contentDiv) contentDiv.innerHTML = `<span style="color:var(--danger);">分析生成失败：${error.message}</span>`;
                    } finally {
                        if (btnElement) btnElement.disabled = false;
                        if (ctx && ctx.student) this._updateStudentProfileAIButton(ctx.student);
                    }
                }

                _getFilterHash(focus) {
                    const parts = [
                        [...(focus.campuses || [])].sort().join(','),
                        [...(focus.grades || [])].sort().join(','),
                        [...(focus.phases || [])].sort().join(','),
                        [...(focus.tClasses || [])].sort().join(','),
                        [...(focus.tags || [])].sort().join(',')
                    ];
                    return parts.join('|') || 'ALL_GRADE';
                }

                /** Exact, read-only input identity shared by display, generation and all exits.
                 * Includes actual identities even when their aggregates happen to be identical.
                 * Only the current and selected comparison exam contribute data; clocks/UI/keys do not.
                 */
                _getClassAiCacheContext(eid) {
                    const state = this.store.state, data = state.data;
                    const exam = data.exams.find(e => e.id === eid);
                    const auth = window.__gakutenAuth?.getAuth();
                    if (!exam || !auth) return null;
                    const summary = this._buildClassAISummaryContext(eid);
                    const ordered = [...data.exams].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
                    const previous = ordered.slice(ordered.findIndex(e => e.id === eid) + 1).find(e => data.scores.some(r => r.examId === e.id && Utils.isActualScore(r, e)));
                    const projectExam = e => ({
                        id:e.id, name:e.name, date:e.date, grade:e.grade, campuses:e.campuses, campus:e.campus,
                        fullScore:e.fullScore, maxTotal:e.maxTotal, entryMode:e.entryMode,
                        types:(e.types || []).map(t => ({name:t.name,max:t.max,manualScore:t.manualScore,questionCount:t.questionCount})),
                        people:data.students.filter(st => Utils.canReadStudent(st,e)).map(st => ({
                            id:st.id, name:st.name, campus:st.campus, grade:st.grade, teachingClass:st.teachingClass,
                            atExam:Utils.getClassForExam(st,e), selected:this._studentMatchesFocusForExam(st,e),
                            score:(() => {const r=this.store.getScore(st.id,e.id);return r ? {
                                total:r.total, details:r.details, questionCounts:r.questionCounts,
                                estimatedTotal:r.estimatedTotal, examAbsent:r.examAbsent, isEstimated:r.isEstimated
                            } : null;})()
                        }))
                    });
                    const focus = state.globalFocus || {};
                    const filters = Object.fromEntries(['campuses','grades','phases','tClasses','tags'].map(k => [k,[...new Set(focus[k] || [])]]));
                    const identity = Object.fromEntries(['mode','campus','grade','classId','teacherId','id','name'].filter(k => auth[k] !== undefined).map(k => [k,auth[k]]));
                    const signature = window.gk2ClassAiCache.signature({
                        version:window.gk2ClassAiCache.VERSION, policy:window.gk2Statistics.POLICY_ID,
                        identity, filters, exam:projectExam(exam), previous:previous ? projectExam(previous) : null,
                        summary, prompt:summary ? this._buildClassAISummaryPrompt(summary.examName,summary) : null
                    });
                    return {signature, summary, key:window.gk2ClassAiCache.key(exam.classAiReports || {},signature)};
                }

                _getCurrentClassAiReport(eid = this.store.state.currentExamId) {
                    const context = this._getClassAiCacheContext(eid);
                    const reports = this.store.state.data.exams.find(e => e.id === eid)?.classAiReports || {};
                    const report = context && reports[context.key];
                    return {context, report:window.gk2ClassAiCache.matches(report,context) ? report : null, hasPrevious:Object.keys(reports).length > 0};
                }

                exportClassAiReport() {
                    const {report} = this._getCurrentClassAiReport();
                    if (!report) { Utils.msg('当前范围或成绩已变化，请重新生成报告。','warning'); return false; }
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(new Blob([report.commentText],{type:'text/plain;charset=utf-8'}));
                    link.href = url;
                    link.download = '班级AI报告.txt';
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url),1000);
                    return true;
                }

                _getFilterDescription(focus) {
                    const parts = [];
                    if (focus.campuses && focus.campuses.length > 0) parts.push(`校区: ${focus.campuses.join(', ')}`);
                    if (focus.grades && focus.grades.length > 0) parts.push(`年级: ${focus.grades.join(', ')}`);
                    if (focus.phases && focus.phases.length > 0) parts.push(`学期阶段: ${focus.phases.join(', ')}`);
                    if (focus.tClasses && focus.tClasses.length > 0) parts.push(`班级: ${focus.tClasses.join(', ')}`);
                    if (focus.tags && focus.tags.length > 0) parts.push(`标签: ${focus.tags.join(', ')}`);
                    return parts.join(' | ') || '全年级所有班级';
                }

                _buildClassAISummaryContext(eid) {
                    const { exam, scoreRows } = this._getDetailsViewScoreRows(eid);
                    if (!exam || scoreRows.length === 0) return null;

                    const studentCount = scoreRows.length;
                    const totals = scoreRows.map(r => r.total);
                    const maxScore = Math.max(...totals);
                    const minScore = Math.min(...totals);
                    const sumScore = totals.reduce((a, b) => a + b, 0);
                    const classAvg = Number((sumScore / studentCount).toFixed(1));
                    const fullScore = Number(exam.fullScore || exam.maxTotal || ((exam.types || []).reduce((sum, t) => sum + Number(t.max || 0), 0)) || 150);
                    const passLine = fullScore * 0.6;
                    const excellentLine = fullScore * 0.8;
                    const passCount = scoreRows.filter(r => r.total >= passLine).length;
                    const excellentCount = scoreRows.filter(r => r.total >= excellentLine).length;
                    const passRate = Number(((passCount / studentCount) * 100).toFixed(1));
                    const excellentRate = Number(((excellentCount / studentCount) * 100).toFixed(1));
                    
                    const mean = sumScore / studentCount;
                    const variance = totals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / studentCount;
                    const stdDev = Number(Math.sqrt(variance).toFixed(1));

                    // T-Score Distribution
                    const activeStats = StatsEngine.gradeStats(exam, this.store.state.data.students, this.store.state.data.scores, null);
                    let t60 = 0, t50 = 0, t40 = 0, tUnder40 = 0;
                    scoreRows.forEach(row => {
                        const t = StatsEngine.convertScore(row.total, exam, 'std', activeStats);
                        if (t >= 60) t60++;
                        else if (t >= 50) t50++;
                        else if (t >= 40) t40++;
                        else tUnder40++;
                    });

                    // Per-type means have independent denominators, including valid
                    // fields from partial records. Overall totals remain complete-only.
                    const summarizeStudents = students => window.gk2Statistics.summarize(students.map(st=>({studentId:st.id,record:this.store.getScore(st.id,exam.id)})),exam);
                    const classTypes=summarizeStudents(this.store.state.data.students.filter(st=>this._studentMatchesFocusForExam(st,exam))).types;
                    const gradeTypes=summarizeStudents(this.store.state.data.students.filter(st=>Utils.canReadStudent(st,exam))).types;
                    const moduleDetails=classTypes.map(t=>{const grade=gradeTypes.find(g=>g.name===t.name);return {name:t.name,max:exam.types.find(x=>x.name===t.name).max,classAvg:t.average==null?null:Number(t.average.toFixed(1)),classRate:t.scoreRate==null?null:Number(t.scoreRate.toFixed(1)),classCount:t.count,gradeAvg:grade.average==null?null:Number(grade.average.toFixed(1)),gradeRate:grade.scoreRate==null?null:Number(grade.scoreRate.toFixed(1)),gradeCount:grade.count};});

                    // Top Performers (Top 5)
                    const topStus = scoreRows.slice(0, 5).map(r => `${r.name}(${r.total}分, T:${StatsEngine.convertScore(r.total, exam, 'std', activeStats)})`);

                    // Borderline Students (50%-70% of fullScore) - up to 5
                    const bStus = scoreRows.filter(r => r.total >= fullScore * 0.5 && r.total <= fullScore * 0.7).slice(0, 5).map(r => `${r.name}(${r.total}分)`);

                    // Struggling Students (< 40% of fullScore) - up to 5
                    const sStus = scoreRows.filter(r => r.total < fullScore * 0.4).slice(0, 5).map(r => `${r.name}(${r.total}分)`);

                    // Progressive Stars (based on T-Score delta from prior exam)
                    const examsByDateDesc = [...(this.store.state.data.exams || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    const currentExamIndex = examsByDateDesc.findIndex(e => e.id === exam.id);
                    let prevExam = null;
                    if (currentExamIndex >= 0) {
                        for (let i = currentExamIndex + 1; i < examsByDateDesc.length; i++) {
                            const pe = examsByDateDesc[i];
                            const peScores = this.store.state.data.scores.filter(s => s.examId === pe.id && Utils.isActualScore(s));
                            if (peScores.length > 0) {
                                prevExam = pe;
                                break;
                            }
                        }
                    }

                    const progressDeltaList = [];
                    if (prevExam) {
                        const prevStats = StatsEngine.gradeStats(prevExam, this.store.state.data.students, this.store.state.data.scores, null);
                        scoreRows.forEach(row => {
                            const curT = StatsEngine.convertScore(row.total, exam, 'std', activeStats);
                            const prevScore = this.store.getScore(row.id, prevExam.id);
                            if (Utils.isActualScore(prevScore, prevExam)) {
                                const prevT = StatsEngine.convertScore(prevScore.total, prevExam, 'std', prevStats);
                                progressDeltaList.push({
                                    name: row.name,
                                    delta: Number((curT - prevT).toFixed(1)),
                                    curT,
                                    prevT
                                });
                            }
                        });
                    }
                    progressDeltaList.sort((a, b) => b.delta - a.delta);
                    const topProgressStus = progressDeltaList.slice(0, 5).map(p => `${p.name}(T分提高:${p.delta > 0 ? '+' : ''}${p.delta})`);

                    return {
                        examName: exam.name,
                        fullScore,
                        studentCount,
                        classAvg,
                        gradeAvg: activeStats.mean ? Number(activeStats.mean.toFixed(1)) : classAvg,
                        maxScore,
                        minScore,
                        passRate,
                        excellentRate,
                        t60,
                        t50,
                        t40,
                        tUnder40,
                        moduleDetails,
                        topStudents: topStus.join('、') || '无',
                        borderlineStudents: bStus.join('、') || '无',
                        strugglingStudents: sStus.join('、') || '无',
                        progressiveStudents: topProgressStus.join('、') || '无'
                    };
                }

                _buildClassAISummaryPrompt(examName, ctx) {
                    const moduleLines = ctx.moduleDetails.map(m => 
                        `- ${m.name}：满分${m.max}分，班级均分${m.classAvg}(得分率${m.classRate}%，${m.classCount}人)，年级均分${m.gradeAvg}(得分率${m.gradeRate}%，${m.gradeCount}人)`
                    ).join('\n  ');

                    return `你是一位资深的高中日语教研组长。请对以下筛选出的班级/年级考试成绩数据进行深度学术诊断。

【数据上下文】
- 考试名称：${examName} (满分 ${ctx.fullScore} 分)
- 参考生数：共 ${ctx.studentCount} 人参考
- 宏观成绩：班均分 ${ctx.classAvg} (年级均分 ${ctx.gradeAvg})，最高分 ${ctx.maxScore}，及格率 ${ctx.passRate}%，优秀率 ${ctx.excellentRate}%
- 正态化 T 分数区间分布：优秀带 [T≥60] 共 ${ctx.t60}人，主力带 [50≤T<60] 共 ${ctx.t50}人，关注带 [40≤T<50] 共 ${ctx.t40}人，困难带 [T<40] 共 ${ctx.tUnder40}人
- 各题型模块表现（班均得分率 vs 年级得分率）：
  ${moduleLines}
- 重点关注群体：
  * 高分拔尖：${ctx.topStudents}
  * 进步黑马：${ctx.progressiveStudents}
  * 临界关注生 (及格边缘)：${ctx.borderlineStudents}
  * 需特别关怀：${ctx.strugglingStudents}

【诊断核心规则】
1. 报告结构必须为以下三个清晰板块，每板块以 Markdown 标题或列表呈现：
   - 一、班级学情多维透视 (优势与短板总结，指出偏科或两极分化情况)
   - 二、题型模块精准诊断 (对比年级平均水平，详细解析哪项题型偏弱，并分析可能的原因)
   - 三、分层教学与教学改进动作方案 (提供对高分生、临界生、学困生的具体分层教学建议，以及对后续课堂教学的 2 条具体策略调整)
2. 语气：客观严谨、具备学术教研高度，同时温暖务实、贴近实际教学场景。
3. 禁令：严禁包含任何图形表情符号，不要以“根据上述数据”等生硬开场，字数控制在 500-600 字以内，直接输出正文。`;
                }

                _renderClassAiTabContent(eid) {
                    const exam = this.store.state.data.exams?.find(e => e.id === eid);
                    if (!exam) return '<div style="padding:20px; text-align:center; color:var(--text-sub);">考试数据未找到</div>';

                    const focus = this.store.state.globalFocus || { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
                    const filterDesc = this._getFilterDescription(focus);
                    const {report, hasPrevious} = this._getCurrentClassAiReport(eid);

                    if (!report) {
                        return `
                        <div class="class-ai-empty-state" style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, rgba(239,246,255,0.4) 0%, rgba(219,234,254,0.3) 100%); border: 1px dashed rgba(0,113,227,0.3); border-radius: var(--radius-lg); margin: 10px 0; box-shadow: var(--shadow-sm);">
                            <div class="class-ai-empty-icon">${window.gk2IconMarkup('spark')}</div>
                            <h3 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 16px;">AI 智能学情诊断报告</h3>
                            ${hasPrevious ? '<p role="status">当前范围或成绩已变化，请重新生成报告。</p>' : ''}
                            <p style="margin: 0 auto 20px; max-width: 500px; color: var(--text-sub); font-size: 13px; line-height: 1.6;">
                                提炼当前筛选条件 <b>(${filterDesc})</b> 下的多维指标（均分、分段、临界生、高频错题模块、进步黑马等），AI 引擎将自动定制一份深度的班级/年级学情诊断与教学策略报告。
                            </p>
                            <button class="primary" onclick="window.app.ui.generateClassAISummary('${eid}', this)" style="padding: 10px 24px; font-size: 14px; font-weight: 700; border-radius: var(--radius-pill); border: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; background: var(--primary); box-shadow: 0 4px 14px rgba(0,113,227,0.18); transition: all var(--motion-base);">
                                ${window.gk2IconMarkup('spark')} 一键生成学情诊断
                            </button>
                        </div>
                        `;
                    }

                    const dateStr = new Date(report.timestamp).toLocaleString();
                    const sumData = report.summaryData || {};
                    const gapText = sumData.classAvg && sumData.gradeAvg 
                        ? (sumData.classAvg >= sumData.gradeAvg ? `↑ 超年级 ${(sumData.classAvg - sumData.gradeAvg).toFixed(1)}分` : `↓ 低年级 ${(sumData.gradeAvg - sumData.classAvg).toFixed(1)}分`)
                        : '';
                    const gapColor = sumData.classAvg >= sumData.gradeAvg ? '#1f7a35' : '#d70015';

                    let partsHtml = '';
                    if (report.commentText) {
                        const lines = report.commentText.split(/\r?\n/);
                        const formattedLines = lines.map(line => {
                            let trimmed = line.trim();
                            if (!trimmed) {
                                return '<div style="height: 10px;"></div>';
                            }
                            let escaped = Utils.escapeHTML(line);
                            if (escaped.startsWith('###')) {
                                return `<h3 style="margin: 18px 0 8px 0; color: var(--primary); font-size: 15px; border-bottom: 1px solid var(--border); padding-bottom: 6px; font-weight: 700;">${escaped.replace(/^###\s*/, '')}</h3>`;
                            }
                            if (escaped.startsWith('##')) {
                                return `<h2 style="margin: 22px 0 10px 0; color: var(--primary); font-size: 16px; font-weight: 700;">${escaped.replace(/^##\s*/, '')}</h2>`;
                            }
                            if (escaped.startsWith('#')) {
                                return `<h1 style="margin: 26px 0 12px 0; color: var(--primary); font-size: 18px; font-weight: 700;">${escaped.replace(/^#\s*/, '')}</h1>`;
                            }
                            if (escaped.startsWith('-') || escaped.startsWith('*')) {
                                let content = escaped.replace(/^[\-\*]\s*/, '');
                                content = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>');
                                return `<li style="margin-left: 18px; margin-bottom: 6px; list-style-type: disc; color: var(--text-main); line-height: 1.65;">${content}</li>`;
                            }
                            let content = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>');
                            return `<div style="margin-bottom: 6px; line-height: 1.65;">${content}</div>`;
                        });
                        partsHtml = `<div class="ai-report-body" style="font-size:14px; line-height:1.75; color:var(--text-main); background: #fafafa; padding:20px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-sm);">${formattedLines.join('')}</div>`;
                    }

                    return `
                    <div class="class-ai-report-dashboard" style="display:flex; flex-direction:column; gap:16px;">
                        <div class="report-meta-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="background:#eaf7ee; color:#1f7a35; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#34c759; border-radius:50%;"></span>已生成</span>
                                <span style="font-size:12px; color:var(--text-sub);">生成于: ${dateStr}</span>
                                <span style="font-size:12px; color:var(--text-sub);">范围: <b style="color:var(--text-main);">${Utils.escapeHTML(filterDesc)}</b></span>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button data-class-ai-export class="secondary" onclick="window.app.ui.exportClassAiReport()" style="font-size:12px; padding:6px 12px;">导出报告</button>
                                <button class="secondary" onclick="window.app.ui.copyClassAiReportToClipboard(this)" style="font-size:12px; padding:6px 12px; border-radius:6px; border:1px solid var(--border); background:white; cursor:pointer;">${window.gk2IconMarkup('copy')} 复制报告</button>
                                <button class="secondary" onclick="window.app.ui.generateClassAISummary('${eid}', this)" style="font-size:12px; padding:6px 12px; border-radius:6px; border:1px solid var(--border); background:white; cursor:pointer;">${window.gk2IconMarkup('spark')} 重新生成</button>
                            </div>
                        </div>

                        <!-- Mini metrics cards -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                                <span style="font-size:11px; color:var(--text-sub);">参考学生人数</span>
                                <span style="font-size:20px; font-weight:800; color:var(--text-main);">${sumData.studentCount || 0} <small style="font-size:12px; font-weight:normal; color:var(--text-sub);">人</small></span>
                            </div>
                            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                                <span style="font-size:11px; color:var(--text-sub);">总分平均分</span>
                                <span style="font-size:20px; font-weight:800; color:var(--text-main);">${sumData.classAvg || 0} <small style="font-size:12px; font-weight:normal; color:${gapColor}; font-weight:700; margin-left:4px;">${gapText}</small></span>
                            </div>
                            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                                <span style="font-size:11px; color:var(--text-sub);">及格率 / 优秀率</span>
                                <span style="font-size:18px; font-weight:800; color:var(--text-main);">${sumData.passRate || 0}% <span style="font-size:12px; font-weight:normal; color:var(--text-sub);">/</span> ${sumData.excellentRate || 0}%</span>
                            </div>
                            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                                <span style="font-size:11px; color:var(--text-sub);">最高分 / 最低分</span>
                                <span style="font-size:18px; font-weight:800; color:var(--text-main);">${sumData.maxScore || 0} <span style="font-size:12px; font-weight:normal; color:var(--text-sub);">/</span> ${sumData.minScore || 0}</span>
                            </div>
                        </div>

                        ${partsHtml}
                    </div>
                    `;
                }

                copyClassAiReportToClipboard(btn) {
                    const state = this.store && this.store.state ? this.store.state : {};
                    const eid = state.currentExamId;
                    if (!eid) return;
                    const {report} = this._getCurrentClassAiReport(eid);
                    if (!report) return Utils.msg('当前范围或成绩已变化，请重新生成报告。','warning');

                    navigator.clipboard.writeText(report.commentText).then(() => {
                        const originalText = btn.innerHTML;
                        btn.innerHTML = `${window.gk2IconMarkup('check')} 已复制`;
                        btn.style.color = '#1f7a35';
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.style.color = '';
                        }, 2000);
                    }).catch(err => {
                        console.error('Copy failed', err);
                        alert('复制失败，请手动选中文本复制');
                    });
                }

                async generateClassAISummary(eid, btnElement) {
                    const card = document.getElementById('class-ai-tab-card');
                    if (!card || this.store.state.currentExamId !== eid) return;
                    const cacheContext = this._getClassAiCacheContext(eid);
                    const ctx = cacheContext?.summary;
                    if (!ctx) {
                        alert('当前没有筛选出的成绩数据，请先调整过滤条件');
                        return;
                    }

                    this._classAiRequest?.abort();
                    const controller = new AbortController();
                    this._classAiRequest = controller;
                    const scopeStamp = () => window.gk2ClassAiCache.signature([window.__gakutenAuth?.getAuth(),this.store.state.currentExamId,this.store.state.globalFocus]);
                    const initialScope = scopeStamp();
                    const isViewCurrent = () => !controller.signal.aborted && card.isConnected && document.getElementById('class-ai-tab-card') === card
                        && this.store.state.currentExamId === eid && this.store.state.currentDetailsTab === 'classAi'
                        && document.getElementById('view-details')?.classList.contains('active')
                        && scopeStamp() === initialScope;
                    const isCurrent = () => isViewCurrent() && this._getClassAiCacheContext(eid)?.signature === cacheContext.signature;
                    let timeout;
                    const cancelled = new Promise((resolve,reject) => {
                        controller.signal.addEventListener('abort',() => reject(new Error(controller.signal.reason || '已取消生成')),{once:true});
                        timeout = setTimeout(() => controller.abort('请求超时，请重试。'),window.gk2ClassAiCache.REQUEST_TIMEOUT_MS);
                    });
                    const staleCheck = setInterval(() => { if (!isViewCurrent()) controller.abort('当前范围或成绩已变化，请重新生成报告。'); },150);
                    const request = async (url, options) => Promise.race([
                        (async () => { const response = await fetch(url,{...options,signal:controller.signal});
                            if (response.ok === false) throw new Error('AI 请求失败：HTTP ' + response.status);
                            return response.json(); })(), cancelled
                    ]);
                    // Also handle cancellation before the first network call (e.g. missing configuration).
                    cancelled.catch(() => {});
                    card.innerHTML = `
                    <div class="class-ai-loading-screen" style="padding: 50px 20px; text-align: center; background: rgba(255,255,255,0.7); backdrop-filter: saturate(180%) blur(12px); -webkit-backdrop-filter: saturate(180%) blur(12px); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
                        <div class="ai-loading-brain-icon" style="font-size: 48px; position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; background: rgba(37,99,235,0.06); border-radius: 50%;">
                            ${window.gk2IconMarkup('brain')}
                            <div class="pulse-ring" style="position: absolute; inset: 0; border: 2px solid rgba(0,113,227,0.3); border-radius: 50%; animation: pulseRing 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;"></div>
                        </div>
                        <h4 style="margin: 0; font-size: 15px; color: var(--text-main);">正在为您生成智能学情诊断报告...</h4>
                        <button data-class-ai-cancel type="button" onclick="window.app.ui._classAiRequest?.abort('已取消生成')">取消生成</button>
                        <div id="ai-loading-status" style="font-size: 13px; color: var(--primary); font-weight: 600; min-height: 20px;">${window.gk2IconMarkup('chart')} 正在提炼班级/年级多维成绩指标与分段常模...</div>
                        <style>
                            @keyframes pulseRing {
                                0% { transform: scale(0.6); opacity: 0; }
                                50% { opacity: 0.5; }
                                100% { transform: scale(1.3); opacity: 0; }
                            }
                        </style>
                    </div>
                    `;

                    const statusText = document.getElementById('ai-loading-status');
                    let statusStep = 1;
                    const statusInterval = setInterval(() => {
                        if (statusStep === 1) {
                            if (statusText) statusText.innerHTML = `${window.gk2IconMarkup('plug')} 正在建立安全加密 AI 引擎通道...`;
                            statusStep = 2;
                        } else if (statusStep === 2) {
                            if (statusText) statusText.innerHTML = `${window.gk2IconMarkup('brain')} 智能诊断学情中，正在为您构思精准课堂分层教学策略...`;
                            statusStep = 3;
                        }
                    }, 2000);

                    try {
                        const apiKey = localStorage.getItem('gakuten_ai_key');
                        if (!apiKey) throw new Error('请先在系统设置中填写 AI API Key！');

                        const providerSelect = document.getElementById('ai-provider-select');
                        const baseUrlInput = document.getElementById('ai-base-url');
                        const modelInput = document.getElementById('ai-model-input');
                        const provider = (localStorage.getItem('gakuten_ai_provider') || (providerSelect && providerSelect.value) || 'deepseek').trim();
                        const rawBaseUrl = (localStorage.getItem('gakuten_ai_base_url') || (baseUrlInput && baseUrlInput.value) || '').trim();
                        const modelFromInput = (localStorage.getItem('gakuten_ai_model') || (modelInput && modelInput.value) || '').trim();
                        const defaultModelMap = {
                            deepseek: 'deepseek-v4-flash',
                            gemini: 'gemini-3-flash-preview',
                            qwen: 'qwen3.6-plus',
                            'openai-compatible': 'gpt-4o-mini'
                        };
                        const modelName = modelFromInput || defaultModelMap[provider] || 'deepseek-v4-flash';
                        const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
                        const defaultBaseUrlMap = {
                            deepseek: 'https://api.deepseek.com',
                            gemini: 'https://generativelanguage.googleapis.com/v1beta',
                            qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
                        };
                        const apiBaseUrl = normalizedBaseUrl || defaultBaseUrlMap[provider] || '';

                        const prompt = this._buildClassAISummaryPrompt(ctx.examName, ctx);
                        const systemPrompt = '你是一位拥有多年丰富教学经验的杰出高中日语学科带带头人与教研组长。你擅长通过精确的定量成绩数据，诊断班级和年级在不同题型板块中的优劣势，并为老师提供极具可操作性、科学合理的个性化分层教学改进策略方案。';

                        let responseData;
                        let commentText = '';

                        if (provider === 'gemini') {
                            responseData = await request(`${apiBaseUrl}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    systemInstruction: { parts: [{ text: systemPrompt }] },
                                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                                    generationConfig: { temperature: 0.7 }
                                })
                            });
                            if (responseData.error) throw new Error(responseData.error.message || 'Gemini 请求失败');
                            commentText = (responseData.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
                        } else {
                            responseData = await request(`${apiBaseUrl}/chat/completions`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${apiKey}`
                                },
                                body: JSON.stringify({
                                    model: modelName,
                                    messages: [
                                        { role: 'system', content: systemPrompt },
                                        { role: 'user', content: prompt }
                                    ],
                                    temperature: 0.7
                                })
                            });
                            if (responseData.error) throw new Error(responseData.error.message || 'AI 请求失败');
                            commentText = (responseData.choices?.[0]?.message?.content || '').trim();
                        }

                        if (!commentText) throw new Error('未返回有效内容');

                        if (!isCurrent()) throw new Error('当前范围或成绩已变化，请重新生成报告。');
                        const exam = this.store.state.data.exams.find(e => e.id === eid);
                        exam.classAiReports = exam.classAiReports || {};
                        exam.classAiReports[window.gk2ClassAiCache.key(exam.classAiReports,cacheContext.signature)] = {
                            commentText, timestamp:Date.now(), summaryData:ctx,
                            cacheContext:{version:window.gk2ClassAiCache.VERSION,signature:cacheContext.signature}
                        };
                        this.store.save();

                        Utils.msg('AI 学情诊断报告生成成功！', 'success');
                    } catch (err) {
                        console.error('AI Report generation failed', err);
                        Utils.msg(`生成未完成：${err.message}`,'warning');
                    } finally {
                        clearInterval(statusInterval);
                        clearInterval(staleCheck);
                        clearTimeout(timeout);
                        if (this._classAiRequest === controller) {
                            this._classAiRequest = null;
                            if (btnElement) btnElement.disabled = false;
                            if (card.isConnected && document.getElementById('class-ai-tab-card') === card) {
                                if (this.store.state.currentDetailsTab === 'classAi' && document.getElementById('view-details')?.classList.contains('active')) {
                                    card.innerHTML = this._renderClassAiTabContent(this.store.state.currentExamId);
                                } else card.replaceChildren();
                            }
                        }
                    }
                }

                handleDetailsAIStatusClick(button) {
                    const studentId = button?.dataset.detailsAiStudent || '';
                    const examId = button?.dataset.examId || '';
                    if (!studentId || !examId) return;
                    if (String(this.store.state.currentExamId || '') !== String(examId)) {
                        return Utils.msg('当前考试已变化，请在当前考试列表中重新操作。', 'warning');
                    }
                    const record = this.store.getScore(studentId, examId);
                    if (!record || record.examAbsent) return Utils.msg('该生暂无可用于学情分析的本次考试成绩。', 'warning');
                    const hasEnteredScore = Number(record.total || 0) > 0 ||
                        (record.details && Object.keys(record.details).length > 0) ||
                        Number(record.estimatedTotal || 0) > 0;
                    if (!hasEnteredScore) return Utils.msg('该生暂无有效成绩，暂不能生成学情分析。', 'warning');
                    if (String(record.aiComment || '').trim()) {
                        this._openDetailsAIRegeneratePopover(button, studentId, examId);
                        return;
                    }
                    return this._generateDetailsAISummary(studentId, examId, button);
                }

                _closeDetailsAIRegeneratePopover(restoreFocus = false) {
                    const state = this._detailsAIRegeneratePopover;
                    if (!state) return;
                    document.removeEventListener('pointerdown', state.onPointerDown, true);
                    document.removeEventListener('keydown', state.onKeyDown, true);
                    document.removeEventListener('scroll', state.onScroll, true);
                    window.removeEventListener('resize', state.onResize);
                    state.button?.setAttribute('aria-expanded', 'false');
                    state.button?.removeAttribute('aria-controls');
                    state.popover.remove();
                    this._detailsAIRegeneratePopover = null;
                    if (restoreFocus && state.button?.isConnected) state.button.focus({ preventScroll: true });
                }

                _openDetailsAIRegeneratePopover(button, studentId, examId) {
                    if (this._detailsAIRegeneratePopover?.button === button) {
                        this._closeDetailsAIRegeneratePopover(true);
                        return;
                    }
                    this._closeDetailsAIRegeneratePopover();
                    const student = (this.store.state.data.students || []).find(item => item.id === studentId);
                    const popover = document.createElement('div');
                    popover.className = 'gk2-details-ai-confirm';
                    popover.id = 'gk2-details-ai-confirm-popover';
                    popover.setAttribute('role', 'alertdialog');
                    popover.setAttribute('aria-labelledby', 'gk2-details-ai-confirm-title');
                    popover.setAttribute('aria-describedby', 'gk2-details-ai-confirm-description');
                    const title = document.createElement('strong');
                    title.id = 'gk2-details-ai-confirm-title';
                    title.textContent = `重新生成${student?.name || '该生'}的学情分析？`;
                    const description = document.createElement('p');
                    description.id = 'gk2-details-ai-confirm-description';
                    description.textContent = '现有分析将被覆盖，并再次调用 AI API。';
                    const actions = document.createElement('div');
                    actions.className = 'gk2-details-ai-confirm-actions';
                    const cancel = document.createElement('button');
                    cancel.type = 'button';
                    cancel.dataset.action = 'cancel';
                    cancel.className = 'gk2-details-ai-confirm-cancel';
                    cancel.textContent = '取消';
                    const confirmButton = document.createElement('button');
                    confirmButton.type = 'button';
                    confirmButton.dataset.action = 'confirm';
                    confirmButton.className = 'gk2-details-ai-confirm-submit';
                    confirmButton.textContent = '确认重新生成';
                    actions.append(cancel, confirmButton);
                    popover.append(title, description, actions);
                    document.body.append(popover);

                    const position = () => {
                        if (!button.isConnected) return this._closeDetailsAIRegeneratePopover();
                        const rect = button.getBoundingClientRect();
                        const bounds = popover.getBoundingClientRect();
                        const margin = 12;
                        const left = Math.max(margin, Math.min(rect.right - bounds.width, window.innerWidth - bounds.width - margin));
                        let top = rect.bottom + 7;
                        if (top + bounds.height > window.innerHeight - margin) top = rect.top - bounds.height - 7;
                        top = Math.max(margin, Math.min(top, window.innerHeight - bounds.height - margin));
                        popover.style.left = `${left}px`;
                        popover.style.top = `${top}px`;
                    };
                    const onPointerDown = event => {
                        if (!popover.contains(event.target) && !button.contains(event.target)) this._closeDetailsAIRegeneratePopover();
                    };
                    const onKeyDown = event => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            this._closeDetailsAIRegeneratePopover(true);
                        }
                    };
                    const onScroll = () => this._closeDetailsAIRegeneratePopover();
                    const onResize = () => position();
                    this._detailsAIRegeneratePopover = { button, popover, onPointerDown, onKeyDown, onScroll, onResize };
                    button.setAttribute('aria-expanded', 'true');
                    button.setAttribute('aria-controls', popover.id);
                    popover.addEventListener('click', event => {
                        const action = event.target.closest('[data-action]')?.dataset.action;
                        if (action === 'cancel') this._closeDetailsAIRegeneratePopover(true);
                        if (action === 'confirm') {
                            this._closeDetailsAIRegeneratePopover(true);
                            this._generateDetailsAISummary(studentId, examId, button);
                        }
                    });
                    document.addEventListener('pointerdown', onPointerDown, true);
                    document.addEventListener('keydown', onKeyDown, true);
                    document.addEventListener('scroll', onScroll, true);
                    window.addEventListener('resize', onResize);
                    position();
                    cancel.focus({ preventScroll: true });
                }

                async _generateDetailsAISummary(studentId, examId, button) {
                    button.disabled = true;
                    button.classList.add('is-loading');
                    button.setAttribute('aria-busy', 'true');
                    button.textContent = '生成中';
                    try {
                        await this._generateAISummaryComment(studentId, { deferSave: true });
                        this.store.save();
                        Utils.msg('该生的 AI 学情分析已生成。', 'success');
                        if (this.cur === 'details' && String(this.store.state.currentExamId || '') === String(examId)) this.renderDetailsView();
                    } catch (error) {
                        console.error('单个学生 AI 学情分析生成失败', error);
                        if (button.isConnected) {
                            const generated = String(this.store.getScore(studentId, examId)?.aiComment || '').trim().length > 0;
                            const student = (this.store.state.data.students || []).find(item => item.id === studentId);
                            button.disabled = false;
                            button.classList.remove('is-loading');
                            button.classList.toggle('is-generated', generated);
                            button.classList.toggle('is-pending', !generated);
                            button.removeAttribute('aria-busy');
                            button.textContent = generated ? '已生成' : '未生成';
                            button.title = generated ? '点击重新生成该生 AI 学情分析' : '点击生成该生 AI 学情分析';
                            button.setAttribute('aria-label', `${student?.name || '该生'}：${generated ? '已生成，点击确认重新生成学情分析' : '未生成，点击单独生成学情分析'}`);
                        }
                        Utils.msg(`AI 学情分析生成失败：${error.message || '请检查 AI 设置后重试。'}`, 'error');
                    }
                }

                showDetailsAiHint(event) {
                    let tip = document.getElementById('details-ai-tooltip');
                    if (!tip) {
                        tip = document.createElement('div');
                        tip.id = 'details-ai-tooltip';
                        tip.className = 'details-ai-tooltip';
                        tip.textContent = '点击批量生成评语';
                        document.body.appendChild(tip);
                    }
                    const rect = event && event.currentTarget ? event.currentTarget.getBoundingClientRect() : null;
                    const x = rect ? rect.left + rect.width / 2 : (event ? event.clientX : window.innerWidth / 2);
                    const y = rect ? rect.top : (event ? event.clientY : 0);
                    tip.style.left = `${x}px`;
                    tip.style.top = `${Math.max(12, y)}px`;
                    tip.classList.add('is-visible');
                }

                hideDetailsAiHint() {
                    const tip = document.getElementById('details-ai-tooltip');
                    if (tip) tip.classList.remove('is-visible');
                }

                showOverviewKpiHint(event, html) {
                    if (!html) return;
                    let tip = document.getElementById('overview-kpi-tooltip');
                    if (!tip) {
                        tip = document.createElement('div');
                        tip.id = 'overview-kpi-tooltip';
                        tip.className = 'overview-kpi-tooltip';
                        document.body.appendChild(tip);
                    }
                    tip.innerHTML = html;
                    const rect = event && event.currentTarget ? event.currentTarget.getBoundingClientRect() : null;
                    const x = rect ? rect.left + rect.width / 2 : (event ? event.clientX : window.innerWidth / 2);
                    const y = rect ? rect.bottom + 8 : (event ? event.clientY + 8 : 24);
                    tip.style.left = `${Math.min(Math.max(x, 190), window.innerWidth - 190)}px`;
                    tip.style.top = `${Math.min(Math.max(12, y), window.innerHeight - 24)}px`;
                    tip.classList.add('is-visible');
                }

                hideOverviewKpiHint() {
                    const tip = document.getElementById('overview-kpi-tooltip');
                    if (tip) tip.classList.remove('is-visible');
                }

                showImportFormatHint(event, type) {
                    let tip = document.getElementById('import-format-tooltip');
                    if (!tip) {
                        tip = document.createElement('div');
                        tip.id = 'import-format-tooltip';
                        tip.className = 'import-format-tooltip';
                        document.body.appendChild(tip);
                    }
                    const isScores = type === 'scores';
                    tip.innerHTML = isScores ? `
                        <div class="import-format-tooltip-title">成绩单表头范例</div>
                        <table>
                            <thead><tr><th>姓名</th><th>日语班</th><th>听力(30)</th><th>阅读(50)</th><th>作文(30)</th></tr></thead>
                            <tbody><tr><td>张三</td><td>24A</td><td>26</td><td>42</td><td>25</td></tr></tbody>
                        </table>
                        <div class="import-format-tooltip-note">题型列请使用“题型(满分)”格式；必须包含“姓名”和“日语班”。</div>
                    ` : `
                        <div class="import-format-tooltip-title">学生名单表头范例</div>
                        <table>
                            <thead><tr><th>姓名</th><th>校区</th><th>年级</th><th>日语班</th><th>行政班</th></tr></thead>
                            <tbody><tr><td>张三</td><td>师上</td><td>2024级</td><td>24A</td><td>高二1班</td></tr></tbody>
                        </table>
                        <div class="import-format-tooltip-note">至少建议包含“姓名、校区、年级、日语班”；有行政班时请一并导入。</div>
                    `;
                    const rect = event && event.currentTarget ? event.currentTarget.getBoundingClientRect() : null;
                    const x = rect ? rect.left + rect.width / 2 : (event ? event.clientX : window.innerWidth / 2);
                    const y = rect ? rect.bottom + 34 : (event ? event.clientY + 34 : 34);
                    tip.style.left = `${Math.min(Math.max(x, 260), window.innerWidth - 260)}px`;
                    tip.style.top = `${Math.min(Math.max(16, y), window.innerHeight - 24)}px`;
                    tip.classList.add('is-visible');
                }

                hideImportFormatHint() {
                    const tip = document.getElementById('import-format-tooltip');
                    if (tip) tip.classList.remove('is-visible');
                }

                async batchGenerateAIComments() {
                    this.hideDetailsAiHint();
                    const batchBtn = document.getElementById('btn-batch-ai');
                    const container = document.getElementById('view-details');
                    if (!container) return;

                    const state = this.store && this.store.state ? this.store.state : {};
                    let eid = state.currentExamId || '';
                    if (!eid) {
                        const sel = document.getElementById('global-exam');
                        if (sel && sel.value) eid = sel.value;
                    }
	                    if (!eid) return Utils.msg('请先选择考试', 'error');
	                    this.store.state.currentExamId = eid;

		                    const exam = (this.store.state.data.exams || []).find(e => e.id === eid);
	                    if (!exam) return Utils.msg('未找到当前考试', 'error');

		                    const roster = this._getExamRosterStudents(exam);
		                    const auth = this._getAuth();
		                    const scopeText = auth && auth.mode === 'teacher' ? '当前教师权限和左侧筛选范围内名单' : '当前左侧筛选范围内名单';
		                    const pendingRows = [];
	                    let skippedNoScore = 0;
	                    let skippedGenerated = 0;
	                    roster.forEach(stu => {
	                        const rec = this.store.getScore(stu.id, eid);
	                        const hasEnteredScore = !!(rec && !rec.examAbsent && (
	                            Number(rec.total || 0) > 0 ||
	                            (rec.details && Object.keys(rec.details).length > 0) ||
	                            Number(rec.estimatedTotal || 0) > 0
	                        ));
	                        if (!hasEnteredScore) {
	                            skippedNoScore += 1;
	                            return;
	                        }
	                        if (String(rec.aiComment || '').trim()) {
	                            skippedGenerated += 1;
	                            return;
	                        }
	                        pendingRows.push({
	                            id: stu.id,
	                            name: stu.name || stu.id,
	                            rec
	                        });
	                    });
	                    if (pendingRows.length === 0) {
	                        const extra = skippedNoScore > 0 ? `；${skippedNoScore} 名暂无当次成绩或已标记缺考` : '';
	                        return Utils.msg(`当前考试名单中没有需要生成评语的学生${extra}`, 'success');
	                    }

		                    const confirmText = `是否为${scopeText}中 ${pendingRows.length} 名学生批量生成 AI 评语？（将消耗 API 额度）${skippedGenerated ? `\n\n已跳过 ${skippedGenerated} 名已生成评语的学生。` : ''}${skippedNoScore ? `\n已跳过 ${skippedNoScore} 名暂无当次成绩或缺考的学生。` : ''}`;
	                    const confirmed = typeof confirm === 'function' ? confirm(confirmText) : true;
	                    if (!confirmed) return;

	                    pendingRows.forEach(row => {
	                        const cell = document.getElementById(`ai-status-cell-${row.id}`);
	                        if (cell) {
	                            cell.innerHTML = `<span style="color:#6e6e73; background:rgba(134,134,139,0.1); padding:2px 6px; border-radius:4px; font-size:11px;">${window.gk2IconMarkup('clock')} 排队中...</span>`;
                        }
                    });

                    const originalText = batchBtn ? batchBtn.innerHTML : '';
                    const originalDisabled = batchBtn ? batchBtn.disabled : false;
                    if (batchBtn) batchBtn.disabled = true;

                    try {
                        let successCount = 0;
                        let failCount = 0;
                        for (let i = 0; i < pendingRows.length; i++) {
                            const row = pendingRows[i];
	                            if (batchBtn) batchBtn.innerText = `正在生成 (${i + 1}/${pendingRows.length})...`;

	                            try {
	                                await this._generateAISummaryComment(row.id, { deferSave: true });
	                                const cell = document.getElementById(`ai-status-cell-${row.id}`);
	                                if (cell) {
	                                    cell.innerHTML = '<span style="color:#1f7a35; background:rgba(31,122,53,0.1); padding:2px 6px; border-radius:4px; font-size:11px;">已生成</span>';
	                                }
                                successCount += 1;
	                            } catch (rowError) {
	                                failCount += 1;
	                                console.error(`批量生成评语失败：${row.name}`, rowError);
	                                const cell = document.getElementById(`ai-status-cell-${row.id}`);
	                                if (cell) {
	                                    cell.innerHTML = '<span style="color:#d70015; background:rgba(215,0,21,0.1); padding:2px 6px; border-radius:4px; font-size:11px;">生成失败</span>';
	                                }
	                            }
	                        }

	                        if (successCount > 0) {
	                            this.store.save();
	                        }
	                        this.renderDetailsView();
                        Utils.msg(`批量生成完成${successCount > 0 ? `，成功 ${successCount} 名` : ''}${failCount > 0 ? `，失败 ${failCount} 名` : ''}`);
                    } catch (error) {
                        console.error(error);
                        Utils.msg(`批量生成失败：${error.message}`, 'error');
                    } finally {
                        if (batchBtn) {
                            batchBtn.innerHTML = originalText || `${window.gk2IconMarkup('spark')} 批量生成评语`;
                            batchBtn.disabled = originalDisabled;
                        }
                    }
                }

                _getAnimatedChartStartOption(option) {
                    if (!option || !Array.isArray(option.series)) return null;
                    const zeroValue = (value, seriesType) => {
                        if (value === null || value === undefined) return value;
                        if (typeof value === 'number') return 0;
                        if (Array.isArray(value)) {
                            if (seriesType === 'heatmap' && value.length >= 3) return [value[0], value[1], 0];
                            return value.map(v => typeof v === 'number' ? 0 : v);
                        }
                        if (typeof value === 'object') {
                            const next = { ...value };
                            if (Array.isArray(next.value)) next.value = zeroValue(next.value, seriesType);
                            else if (typeof next.value === 'number') next.value = 0;
                            return next;
                        }
                        return value;
                    };
                    const startSeries = option.series.map(series => {
                        const type = series && series.type;
                        const next = { ...series };
                        delete next.animation;
                        delete next.animationDuration;
                        delete next.animationDurationUpdate;
                        delete next.animationDelay;
                        delete next.animationDelayUpdate;
                        if (Array.isArray(series.data)) {
                            next.data = series.data.map(item => zeroValue(item, type));
                        }
                        return next;
                    });
                    return { ...option, animation: false, animationDuration: 0, animationDurationUpdate: 0, series: startSeries };
                }

                _forceChartDrawAnimation(option, duration = 1200) {
                    if (!option || typeof option !== 'object') return option;
                    const next = { ...option, animation: true, animationDuration: duration, animationDurationUpdate: duration, animationEasing: 'cubicOut', animationEasingUpdate: 'cubicOut', animationThreshold: 10000 };
                    if (Array.isArray(option.series)) {
                        next.series = option.series.map((series, idx) => ({
                            ...series,
                            animation: true,
                            animationDuration: series.animationDuration || duration,
                            animationDurationUpdate: series.animationDurationUpdate || duration,
                            animationEasing: series.animationEasing || 'cubicOut',
                            animationEasingUpdate: series.animationEasingUpdate || 'cubicOut',
                            animationDelay: series.animationDelay !== undefined ? series.animationDelay : (i => idx * 90 + i * 35),
                            animationDelayUpdate: series.animationDelayUpdate !== undefined ? series.animationDelayUpdate : (i => idx * 90 + i * 35)
                        }));
                    }
                    return next;
                }

                _animateLineChartReveal(chart, option, dom, duration = 1200) {
                    if (!chart || !option || !Array.isArray(option.series) || !dom) return false;
                    const lineSeries = option.series.filter(s => s && s.type === 'line' && Array.isArray(s.data));
                    if (!lineSeries.length) return false;
                    try {
                        dom.style.position = dom.style.position || 'relative';
                        dom.querySelectorAll('.chart-line-reveal-mask').forEach(mask => mask.remove());
                        const mask = document.createElement('div');
                        mask.className = 'chart-line-reveal-mask';
                        mask.style.animationDuration = `${Math.max(420, duration)}ms`;
                        dom.appendChild(mask);
                        if (typeof chart.clear === 'function') chart.clear();
                        chart.setOption({
                            ...option,
                            animation: true,
                            animationDuration: Math.max(420, duration),
                            animationEasing: 'cubicOut',
                            series: option.series.map(series => series && series.type === 'line'
                                ? { ...series, animation: true, animationDuration: Math.max(420, duration), animationEasing: 'cubicOut' }
                                : series)
                        }, { notMerge: true, lazyUpdate: false });
                        if (dom) dom.dataset.rendered = '1';
                        mask.addEventListener('animationend', () => { try { mask.remove(); } catch(e) {} }, { once: true });
                        setTimeout(() => { try { mask.remove(); } catch(e) {} }, Math.max(900, duration + 180));
                        return true;
                    } catch (e) {
                        console.warn('line reveal animation failed', e);
                        return false;
                    }
                }

                _animateHeatmapTiles(chart, option, dom, duration = 780) {
                    if (!chart || !option || !Array.isArray(option.series)) return false;
                    const heatIndex = option.series.findIndex(s => s && s.type === 'heatmap' && Array.isArray(s.data));
                    if (heatIndex < 0) return false;
                    const fullData = option.series[heatIndex].data || [];
                    if (!fullData.length) return false;
                    const axisData = axis => Array.isArray(axis) ? (axis[0] && axis[0].data) : (axis && axis.data);
                    const xData = axisData(option.xAxis) || [];
                    const yData = axisData(option.yAxis) || [];
                    if (!xData.length || !yData.length) return false;
                    const colorFor = value => {
                        const v = Number(value || 0);
                        if (v >= 85) return '#176b34';
                        if (v >= 70) return '#bce8c8';
                        if (v >= 55) return '#fff2d4';
                        if (v >= 40) return '#f4ae56';
                        return '#d70015';
                    };
                    const emptyOption = {
                        ...option,
                        animation: false,
                        series: option.series.map((series, idx) => idx === heatIndex
                            ? { ...series, data: [], animation: false }
                            : series)
                    };
                    try {
                        if (chart.__gakutenHeatmapTileTimer) clearTimeout(chart.__gakutenHeatmapTileTimer);
                        if (chart.__gakutenHeatmapFadeTimer) clearTimeout(chart.__gakutenHeatmapFadeTimer);
                        if (chart.__gakutenHeatmapSyncFrame) cancelAnimationFrame(chart.__gakutenHeatmapSyncFrame);
                        if (chart.__gakutenHeatmapSyncHandler && chart.off) {
                            try { chart.off('datazoom', chart.__gakutenHeatmapSyncHandler); } catch(e) {}
                        }
                        if (chart.__gakutenHeatmapResizeObserver) {
                            try { chart.__gakutenHeatmapResizeObserver.disconnect(); } catch(e) {}
                        }
                        chart.__gakutenHeatmapSyncFrame = null;
                        chart.__gakutenHeatmapSyncHandler = null;
                        chart.__gakutenHeatmapResizeObserver = null;
                        dom.querySelectorAll('.heatmap-tile-overlay').forEach(el => el.remove());
                        dom.style.position = dom.style.position || 'relative';
                        if (typeof chart.clear === 'function') chart.clear();
                        chart.setOption(emptyOption, { notMerge: true, lazyUpdate: false, silent: true });
                        if (typeof chart.resize === 'function') chart.resize();
                    } catch(e) { return false; }

                    requestAnimationFrame(() => {
                        if (chart && typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
                        const overlay = document.createElement('div');
                        overlay.className = 'heatmap-tile-overlay';
                        dom.appendChild(overlay);

                        const point = (x, y) => {
                            try { return chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]); }
                            catch(e) { return null; }
                        };
                        const maxDiag = Math.max(1, (xData.length - 1) + (yData.length - 1));
                        let maxDelay = 0;

                        const renderTiles = (animate = false) => {
                            const p00 = point(0, 0);
                            if (!p00) return false;
                            const p10 = xData.length > 1 ? point(1, 0) : null;
                            const p01 = yData.length > 1 ? point(0, 1) : null;
                            const isOverviewHeatmap = dom && dom.id === 'chart-ov-heatmap';
                            const maxTileW = isOverviewHeatmap ? 76 : 220;
                            const maxTileH = isOverviewHeatmap ? 48 : 92;
                            const tileW = Math.max(18, Math.min(maxTileW, Math.abs((p10 ? p10[0] - p00[0] : chart.getWidth() / xData.length)) * (isOverviewHeatmap ? 0.94 : 0.985)));
                            const tileH = Math.max(14, Math.min(maxTileH, Math.abs((p01 ? p01[1] - p00[1] : chart.getHeight() / yData.length)) * 0.965));
                            overlay.innerHTML = '';
                            const tooltip = document.createElement('div');
                            tooltip.className = 'heatmap-tile-tooltip';
                            overlay.appendChild(tooltip);
                            maxDelay = 0;
                            fullData.forEach((item, index) => {
                                if (!Array.isArray(item)) return;
                                const x = Number(item[0] || 0);
                                const y = Number(item[1] || 0);
                                const v = Number(item[2] || 0);
                                const center = point(x, y);
                                if (!center) return;
                                const diag = (x + y) / maxDiag;
                                const wave = Math.sin((x * 1.7 + y * 2.3) * Math.PI / 6) * 18;
                                const delay = animate ? Math.max(0, Math.round(diag * 300 + y * 8 + (x % 2) * 16 + wave)) : 0;
                                maxDelay = Math.max(maxDelay, delay);
                                const tile = document.createElement('div');
                                tile.className = 'heatmap-fly-tile';
                                tile.style.left = `${center[0] - tileW / 2}px`;
                                tile.style.top = `${center[1] - tileH / 2}px`;
                                tile.style.width = `${tileW}px`;
                                tile.style.height = `${tileH}px`;
                                tile.style.background = colorFor(v);
                                tile.setAttribute('aria-label', `${yData[y] || '学生'} ${xData[x] || '题型'} 得分率 ${Number.isFinite(v) ? v : 0}%`);
                                tile.dataset.tooltip = `<b>${Utils.escapeHTML(yData[y] || '学生')}</b><br>${Utils.escapeHTML(xData[x] || '题型')}：${Number.isFinite(v) ? v : 0}%`;
                                if (animate) {
                                    tile.style.setProperty('--delay', `${delay}ms`);
                                    tile.style.setProperty('--dur', `${Math.max(520, Math.min(760, duration - 80 + (index % 5) * 22))}ms`);
                                    tile.style.setProperty('--tx', `${-34 + (x % 3) * 7}px`);
                                    tile.style.setProperty('--ty', `${28 + (y % 4) * 5}px`);
                                    tile.style.setProperty('--rot', `${((x + y) % 2 ? 1 : -1) * 1.5}deg`);
                                } else {
                                    tile.style.animation = 'none';
                                    tile.style.opacity = '1';
                                    tile.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
                                }
                                tile.addEventListener('mouseenter', () => {
                                    tooltip.innerHTML = tile.dataset.tooltip || '';
                                    tooltip.style.left = `${center[0]}px`;
                                    tooltip.style.top = `${center[1] - tileH / 2}px`;
                                    tooltip.classList.add('is-visible');
                                });
                                tile.addEventListener('mouseleave', () => {
                                    tooltip.classList.remove('is-visible');
                                });
                                overlay.appendChild(tile);
                            });
                            return true;
                        };

                        if (!renderTiles(true)) {
                            chart.setOption(emptyOption, { notMerge: true, lazyUpdate: false });
                            if (dom) dom.dataset.rendered = '1';
                            return;
                        }

                        const finish = () => {
                            if (chart && typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
                            try {
                                chart.setOption(emptyOption, { notMerge: true, lazyUpdate: false });
                                if (dom) dom.dataset.rendered = '1';
                                renderTiles(false);
                            } catch(e) {
                                try { chart.setOption(emptyOption, { notMerge: true, lazyUpdate: false }); } catch(err) {}
                            }
                        };
                        chart.__gakutenHeatmapTileTimer = setTimeout(finish, maxDelay + duration + 80);
                    });
                    return true;
                }

                _animateRadarChartMorph(chart, option, dom, duration = 1100) {
                    if (!chart || !option || !Array.isArray(option.series)) return false;
                    const radarSeries = option.series.filter(s => s && s.type === 'radar' && Array.isArray(s.data));
                    if (!radarSeries.length) return false;
                    const scaleValue = (item, progress) => {
                        if (!item || typeof item !== 'object') return item;
                        const next = { ...item };
                        if (Array.isArray(item.value)) {
                            next.value = item.value.map(v => typeof v === 'number' ? parseFloat((v * progress).toFixed(2)) : v);
                        }
                        return next;
                    };
                    const build = (progress) => ({
                        ...option,
                        animation: false,
                        series: option.series.map(series => {
                            if (!series || series.type !== 'radar' || !Array.isArray(series.data)) return series;
                            return {
                                ...series,
                                animation: false,
                                data: series.data.map(item => scaleValue(item, progress))
                            };
                        })
                    });
                    try { chart.clear(); } catch(e) {}
                    chart.setOption(build(0), { notMerge: true, lazyUpdate: false, silent: true });
                    const start = performance.now();
                    const step = (now) => {
                        if (chart && typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
                        const progress = Math.min(1, (now - start) / duration);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        chart.setOption(build(eased), { notMerge: false, lazyUpdate: true, silent: true });
                        if (progress < 1) {
                            chart.__gakutenRadarAnimFrame = requestAnimationFrame(step);
                        } else {
                            chart.setOption(option, { notMerge: false, lazyUpdate: false });
                            if (dom) dom.dataset.rendered = '1';
                        }
                    };
                    chart.__gakutenRadarAnimFrame = requestAnimationFrame(step);
                    return true;
                }

                _deferredChartSetOption(chart, option, delay = 50) {
                    if (!chart || typeof chart.setOption !== 'function') return;
                    const renderDelay = Math.max(delay || 0, 60);
                    let dom = null;
                    try { dom = chart.getDom && chart.getDom(); } catch(e) {}
                    const firstRender = !!(dom && dom.dataset.rendered !== '1');
                    const domId = dom && dom.id ? dom.id : '';
                    const isOverviewChart = domId.indexOf('chart-ov-') === 0;
                    const isProfileChart = domId.indexOf('sp-chart-') === 0;
                    const useSkeleton = firstRender && !isOverviewChart && !isProfileChart;
                    const doRender = () => {
                        try {
                            if (chart && typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
                            const animatedOption = option && typeof option === 'object'
                                ? this._forceChartDrawAnimation(option, 1200)
                                : option;
                            if (dom) dom.classList.remove('skeleton-chart');
                            requestAnimationFrame(() => {
                                if (chart && typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
                                const seriesTypes = Array.isArray(animatedOption && animatedOption.series) ? animatedOption.series.map(s => s && s.type).filter(Boolean) : [];
                                const isPureLineChart = seriesTypes.length > 0 && seriesTypes.every(type => type === 'line');
                                const hasHeatmapSeries = seriesTypes.includes('heatmap');
                                const hasRadarSeries = seriesTypes.includes('radar');
                                const startOption = this._getAnimatedChartStartOption(animatedOption);
                                const skipStartFrame = domId === 'sp-chart-quadrant';
                                const shouldDrawFromStart = !!startOption && !skipStartFrame && !hasHeatmapSeries && (firstRender || isOverviewChart || isProfileChart);
                                try { if (typeof chart.resize === 'function') chart.resize(); } catch(e) {}

                                if (isPureLineChart && (isOverviewChart || isProfileChart || firstRender)) {
                                    if (this._animateLineChartReveal(chart, animatedOption, dom, isOverviewChart ? 1400 : isProfileChart ? 560 : 1200)) return;
                                }

                                if (hasHeatmapSeries) {
                                    if (domId === 'chart-ov-heatmap' && this._animateHeatmapTiles(chart, option, dom, 560)) return;
                                    try { if (typeof chart.clear === 'function') chart.clear(); } catch(e) {}
                                    chart.setOption(option, { notMerge: true, lazyUpdate: false });
                                    if (dom) dom.dataset.rendered = '1';
                                    requestAnimationFrame(() => {
                                        try { if (typeof chart.resize === 'function') chart.resize(); } catch(e) {}
                                    });
                                    return;
                                }

                                if (hasRadarSeries && (isProfileChart || firstRender)) {
                                    if (this._animateRadarChartMorph(chart, animatedOption, dom, isProfileChart ? 620 : 1150)) return;
                                }

                                if (shouldDrawFromStart) {
                                    chart.setOption(startOption, { notMerge: true, lazyUpdate: false, silent: true });
                                    setTimeout(() => {
                                        if (chart && typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
                                        const replayAsInitialDraw = (isOverviewChart || isProfileChart) && !hasRadarSeries;
                                        chart.setOption(animatedOption, { notMerge: replayAsInitialDraw, lazyUpdate: false });
                                        if (dom) dom.dataset.rendered = '1';
                                    }, hasRadarSeries ? 220 : 180);
                                } else {
                                    chart.setOption(animatedOption, { notMerge: true, lazyUpdate: false });
                                    if (dom) dom.dataset.rendered = '1';
                                }
                            });
                            try {
                                chart.off('click');
                                if (!isProfileChart) {
                                    chart.on('click', (params) => {
                                        if (params && (params.name || params.seriesName)) Utils.msg(`已选中：${params.name || params.seriesName}`);
                                    });
                                }
                            } catch(e) {}
                        } catch (e) {
                            console.warn('deferred chart render failed', e);
                        } finally {
                            chart.__gakutenDeferredRenderTimer = null;
                        }
                    };
                    try {
                        if (chart.__gakutenDeferredRenderTimer) clearTimeout(chart.__gakutenDeferredRenderTimer);
                        if (chart.__gakutenAnimFrame) cancelAnimationFrame(chart.__gakutenAnimFrame);
                        if (chart.__gakutenLineAnimFrame) cancelAnimationFrame(chart.__gakutenLineAnimFrame);
                        if (chart.__gakutenRadarAnimFrame) cancelAnimationFrame(chart.__gakutenRadarAnimFrame);
                        if (chart.__gakutenHeatmapTileTimer) clearTimeout(chart.__gakutenHeatmapTileTimer);
                        if (chart.__gakutenHeatmapFadeTimer) clearTimeout(chart.__gakutenHeatmapFadeTimer);
                    } catch (e) {}
                    if (useSkeleton && dom) dom.classList.add('skeleton-chart');
                    if (isOverviewChart && firstRender && 'IntersectionObserver' in window) {
                        const rect = dom.getBoundingClientRect();
                        const inView = rect.bottom > 0 && rect.top < window.innerHeight;
                        if (!inView) {
                            if (!this._overviewChartObserver) {
                                this._overviewChartObserver = new IntersectionObserver(entries => {
                                    entries.forEach(entry => {
                                        if (!entry.isIntersecting) return;
                                        const target = entry.target;
                                        const task = target.__gakutenPendingChartRender;
                                        if (task) {
                                            target.__gakutenPendingChartRender = null;
                                            this._overviewChartObserver.unobserve(target);
                                            task();
                                        }
                                    });
                                }, { root: document.querySelector('#view-analysis .content-body') || null, rootMargin: '80px 0px', threshold: 0.08 });
                            }
                            dom.__gakutenPendingChartRender = () => setTimeout(doRender, renderDelay);
                            this._overviewChartObserver.observe(dom);
                            return;
                        }
                    }
                    chart.__gakutenDeferredRenderTimer = setTimeout(doRender, firstRender ? renderDelay : 0);
                }

                _renderProfileTrendChart(stu) {
                    const dom = document.getElementById('sp-chart-trend');
                    if(this.spTrendChart) { this.spTrendChart.dispose(); }
                    dom.replaceChildren();
                    this.spTrendChart = echarts.init(dom);

                    const allExams = this.store.state.data.exams.filter(e => {
                        if (e.grade !== stu.grade) return false;
                        const camps = this._getExamCampuses(e);
                        return camps.length === 0 || camps.includes(stu.campus);
                    }).sort((a,b) => (a.date||'').localeCompare(b.date||''));

                    const xAxisData = [];
                    const xAxisDates = [];
                    const stuScores = [];
                    const avgScores = [];

                    allExams.forEach(ex => {
                        const scoreRec = this.store.getScore(stu.id, ex.id);
                        if (Utils.isActualScore(scoreRec, ex)) {
                            xAxisData.push(ex.name);
                            xAxisDates.push(String(ex.date || '').slice(5, 10).replace('-', '/'));
                            stuScores.push(Number(scoreRec.total));
                            
                            // Class Average
                            const avg = StatsEngine.classAverage(stu, ex, this._students, this._scores);
                            avgScores.push(avg == null ? null : Number(avg));
                        }
                    });

                    if(xAxisData.length === 0) {
                        if (this.spTrendChart) { this.spTrendChart.dispose(); this.spTrendChart = null; }
                        dom.innerHTML = Utils.getEmptyStateHTML('暂无历史成绩', '该学生还未参加过任何有成绩的考试。', 'inbox', '');
                        return;
                    }

                    const profileMax = Math.max(0, ...allExams.map(ex => Number(ex.maxTotal) || (ex.types || []).reduce((sum, type) => sum + Number(type.max || 0), 0)), ...stuScores.filter(v => v !== null), ...avgScores.filter(v => v !== null));
                    const yAxisInterval = Math.max(10, Math.ceil(profileMax / 50) * 10);
                    const yAxisMax = yAxisInterval * 5;
                    this._deferredChartSetOption(this.spTrendChart, {
                        animation: true,
                        animationDuration: 900,
                        animationEasing: 'cubicOut',
                        title: { text: '历史总分轨迹', left: 'center', top: 10, textStyle: {fontSize: 14, fontWeight: 650, color: '#334155'} },
                        tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'line', lineStyle: { color: '#a8b5c8', type: 'dashed' } } },
                        legend: { data: ['个人得分', '班级均分'], bottom: 2, itemWidth: 9, itemHeight: 8, itemGap: 10, textStyle: {fontSize: 11, color: '#64748b'} },
                        grid: { top: 48, bottom: 32, left: 24, right: 32, containLabel: true },
                        xAxis: { type: 'category', data: xAxisData, boundaryGap: false, axisTick: {show: false}, axisLine: {lineStyle: {color: '#d8deea'}}, axisLabel: { interval: 'auto', rotate: 0, hideOverlap: true, alignMinLabel: 'left', alignMaxLabel: 'right', fontSize: 9, lineHeight: 13, color: '#64748b', width: 112, overflow: 'break', formatter: (value, index) => xAxisDates[index] ? `${String(value || '')}\n${xAxisDates[index]}` : String(value || '') } },
                        yAxis: { type: 'value', min: 0, max: yAxisMax, interval: yAxisInterval, splitNumber: 5, axisTick: {show: false}, axisLine: {show: false}, axisLabel: {fontSize: 10, color: '#64748b', margin: 8}, splitLine: {lineStyle: {color: '#edf1f6'}} },
                        series: [
                            { name: '个人得分', type: 'line', data: stuScores, smooth: .3, symbol: 'circle', symbolSize: 7, itemStyle: { color: '#1684df'}, label: {show:true, position:'top', color:'#1684df', fontSize:12, formatter: params => params.dataIndex === stuScores.length - 1 ? (Number.isInteger(Number(params.value)) ? params.value : Number(params.value).toFixed(1)) : ''}, lineStyle: { width: 3 }, animationDuration: 850, animationDelay: idx => idx * 55 },
                            { name: '班级均分', type: 'line', data: avgScores, smooth: .3, symbol: 'circle', symbolSize: 5, itemStyle: { color: '#9aa6b6'}, lineStyle:{ color:'#9aa6b6', type: 'dashed', width:2 }, animationDuration: 850, animationDelay: idx => 100 + idx * 55 }
                        ]
                    }, 120);
                }

                _renderProfileRadarChart(stu) {
                    const dom = document.getElementById('sp-chart-radar');
                    if(this.spRadarChart) { this.spRadarChart.dispose(); }
                    dom.replaceChildren();
                    this.spRadarChart = echarts.init(dom);

                    // Find latest exam with score
                    const scoreRecs = this.store.state.data.scores.filter(s => s.studentId === stu.id && s.examId === this.store.state.currentExamId && Utils.isActualScore(s));
                    if (scoreRecs.length === 0) {
                        if (this.spRadarChart) { this.spRadarChart.dispose(); this.spRadarChart = null; }
                        dom.innerHTML = Utils.getEmptyStateHTML('暂无单科分析', '缺乏有效的题型得分数据。', 'chart', '');
                        return;
                    }

                    // Sort by exam date descending to find the latest
                    scoreRecs.sort((a,b) => {
                        const ea = this.store.state.data.exams.find(e=>e.id===a.examId);
                        const eb = this.store.state.data.exams.find(e=>e.id===b.examId);
                        return (eb?.date||'').localeCompare(ea?.date||'');
                    });

                    const latestScore = scoreRecs[0];
                    const latestExam = this.store.state.data.exams.find(e=>e.id===latestScore.examId);

                    if (!latestExam || !latestExam.types || latestExam.types.length === 0) {
                        if (this.spRadarChart) { this.spRadarChart.dispose(); this.spRadarChart = null; }
                        dom.innerHTML = Utils.getEmptyStateHTML('暂无题型数据', '该考试未设置题型信息。', 'chart', '');
                        return;
                    }

                    const indicator = latestExam.types.map(t => ({ name: t.name, max: 100 }));
                    
                    const stuPct = latestExam.types.map(t => {
                        const val = latestScore.details?.[t.name] || 0;
                        return t.max > 0 ? parseFloat(((val / t.max) * 100).toFixed(1)) : 0;
                    });
                    
                    // Grade average logic (use all valid scores for this exam)
                    const gradeScores = this.store.state.data.scores.filter(s => s.examId === latestExam.id && Utils.isActualScore(s));
                    const avgPct = latestExam.types.map(t => {
                        let sum = 0;
                        gradeScores.forEach(gs => sum += (gs.details?.[t.name]||0));
                        const rawAvg = gradeScores.length > 0 ? sum / gradeScores.length : 0;
                        return t.max > 0 ? parseFloat(((rawAvg / t.max) * 100).toFixed(1)) : 0;
                    });

                    // 生成扩展 AI 智能点评：进步最大的题型 / 最需关注题型 / 整体趋势
                    try {
                        const insightEl = document.getElementById('sp-smart-insight');
                        if (insightEl) {
                            // previous exam (按时间降序排好，scoreRecs[0] 为最新)
                            const prevScore = scoreRecs.length > 1 ? scoreRecs[1] : null;
                            let prevPctMap = {};
                            if (prevScore) {
                                const prevExam = this.store.state.data.exams.find(e=>e.id===prevScore.examId);
                                if (prevExam && prevExam.types) {
                                    prevExam.types.forEach(t => {
                                        const v = prevScore.details?.[t.name] || 0;
                                        prevPctMap[t.name] = t.max > 0 ? parseFloat(((v / t.max) * 100).toFixed(1)) : 0;
                                    });
                                }
                            }

                            // 计算各题型涨幅
                            let bestIncName = null; let bestIncVal = -Infinity;
                            latestExam.types.forEach((t, idx) => {
                                const latestVal = stuPct[idx] || 0;
                                const prevVal = prevPctMap[t.name] || 0;
                                const diff = parseFloat((latestVal - prevVal).toFixed(1));
                                if (diff > bestIncVal) { bestIncVal = diff; bestIncName = t.name; }
                            });

                            // 最需关注题型：学生得分率低且低于年级均分（按差值排序）
                            const needArr = [];
                            latestExam.types.forEach((t, idx) => {
                                const sVal = stuPct[idx] || 0;
                                const aVal = avgPct[idx] || 0;
                                if (sVal < aVal) {
                                    needArr.push({ name: t.name, diff: parseFloat((aVal - sVal).toFixed(1)), val: sVal });
                                }
                            });
                            needArr.sort((a,b) => b.diff - a.diff);
                            const needTop = needArr.length > 0 ? needArr[0] : null;

                            // 整体趋势：最近 3 次总分（按日期升序）
                            const sortedByDate = scoreRecs.slice().sort((a,b)=>{
                                const ea = this.store.state.data.exams.find(e=>e.id===a.examId);
                                const eb = this.store.state.data.exams.find(e=>e.id===b.examId);
                                return (ea.date||'').localeCompare(eb.date||'');
                            });
                            const recent = sortedByDate.slice(-3).map(s => s.total);
                            let trendText = '成绩波动';
                            if (recent.length >= 3) {
                                if (recent[0] < recent[1] && recent[1] < recent[2]) trendText = `${window.gk2IconMarkup('trend')} 持续上升`;
                                else if (recent[0] > recent[1] && recent[1] > recent[2]) trendText = `${window.gk2IconMarkup('alert')} 连续下滑`;
                                else trendText = '成绩波动';
                            } else if (recent.length === 2) {
                                trendText = recent[0] < recent[1] ? '上升趋势' : (recent[0] > recent[1] ? '下降趋势' : '持平');
                            }

                            // 构建文案
                            const parts = [];
                            parts.push(`<b>学情总结</b>：最新考试能力对比已呈现。`);
                            if (bestIncName && bestIncVal > 0) parts.push(`进步最多的题型：<b>${bestIncName}</b> （提升 ${bestIncVal}%）`);
                            if (needTop) parts.push(`最需关注的题型：<b>${needTop.name}</b>（低于年均 ${needTop.diff}%，当前 ${needTop.val}%）`);
                            parts.push(`整体趋势：<b>${trendText}</b>`);

                            insightEl.innerHTML = parts.map(p => `<div style="margin-bottom:6px;">${p}</div>`).join('');
                        }
                    } catch (e) { console.warn('sp insight render error', e); }

                    this._deferredChartSetOption(this.spRadarChart, {
                        animation: true,
                        animationDuration: 860,
                        animationEasing: 'cubicOut',
                        title: { text: `能力雷达 · ${latestExam.name}`, left: 'center', top: 10, textStyle: {fontSize: 14, fontWeight: 650, color: '#334155'} },
                        tooltip: {
                            trigger: 'item',
                            triggerOn: 'mousemove|click',
                            confine: true,
                            showDelay: 0,
                            hideDelay: 90,
                            transitionDuration: 0.12,
                            position: (point, params, dom, rect, size) => {
                                const [viewWidth, viewHeight] = size.viewSize;
                                const [boxWidth, boxHeight] = size.contentSize;
                                const edge = 10, gap = 14, titleSafe = 52;
                                const maxLeft = Math.max(edge, viewWidth - boxWidth - edge);
                                const maxTop = Math.max(edge, viewHeight - boxHeight - edge);
                                let left = point[0] + gap;
                                if (left > maxLeft) left = point[0] - boxWidth - gap;
                                left = Math.max(edge, Math.min(left, maxLeft));
                                let top = point[1] + gap;
                                if (top > maxTop) top = point[1] - boxHeight - gap;
                                top = Math.max(Math.min(titleSafe, maxTop), Math.min(top, maxTop));
                                return [left, top];
                            },
                            backgroundColor: 'rgba(255,255,255,.98)',
                            borderColor: '#dce5f1',
                            borderWidth: 1,
                            padding: [10, 12],
                            textStyle: { color: '#334155', fontSize: 13, lineHeight: 21 },
                            extraCssText: 'max-width:240px;white-space:normal;border-radius:12px;box-shadow:0 10px 28px rgba(31,55,84,.18);',
                            formatter: (p) => {
                            if (!p || !Array.isArray(p.value)) return '';
                            let str = `<b>${p.name}</b><br>`; 
                            p.value.forEach((v, idx) => str += `${indicator[idx].name} 掌握率: ${v}%<br>`); 
                            return str; 
                        }},
                        legend: { data: ['个人能力', '年级均分'], bottom: 0, padding: [5, 5, 0, 5], itemWidth: 9, itemHeight: 9, itemGap: 10, textStyle: {fontSize: 11, color: '#64748b'} },
                        radar: { indicator: indicator, center: ['50%', '51%'], radius: '62%', splitNumber: 4, axisNameGap: 10, axisName: {color: '#64748b', fontSize: 13}, axisLine: {lineStyle: {color: '#d9e1ec'}}, splitLine: {lineStyle: {color: '#dfe6ef'}}, splitArea: {areaStyle: {color: ['rgba(248,250,252,.72)', 'rgba(255,255,255,.9)']}} },
                        series: [{
                            type: 'radar',
                            animationDuration: 860,
                            animationDelay: 80,
                            data: [
                                { value: stuPct, name: '个人能力', areaStyle: { color: this._radarAreaGradient(), opacity: 0.92 }, lineStyle: { color: '#0071e3', width: 2.5 } },
                                { value: avgPct, name: '年级均分', areaStyle: { color: 'rgba(142, 142, 147, 0.2)' }, lineStyle: { color: '#8e8e93', type: 'dashed' } }
                            ]
                        }]
                    }, 120);
                }

                _renderProfileQuadrant(stu) {
                    const dom = document.getElementById('sp-chart-quadrant');
                    if (!dom) return;
                    try { if (this.spQuadChart) { this.spQuadChart.dispose(); this.spQuadChart = null; } } catch(e){}
                    dom.replaceChildren();
                    this.spQuadChart = echarts.init(dom);

                    // Find latest exam with score for this student
                    const scoreRecs = this.store.state.data.scores.filter(s => s.studentId === stu.id && s.examId === this.store.state.currentExamId && Utils.isActualScore(s));
                    if (scoreRecs.length === 0) {
                        try { if (this.spQuadChart) { this.spQuadChart.dispose(); this.spQuadChart = null; } } catch(e){}
                        dom.innerHTML = Utils.getEmptyStateHTML('暂无单科分析', '缺乏有效的题型得分数据。', 'chart', '');
                        return;
                    }
                    // get latest by exam date
                    scoreRecs.sort((a,b)=>{
                        const ea = this.store.state.data.exams.find(e=>e.id===a.examId);
                        const eb = this.store.state.data.exams.find(e=>e.id===b.examId);
                        return (eb?.date||'').localeCompare(ea?.date||'');
                    });
                    const latest = scoreRecs[0];
                    const ex = this.store.state.data.exams.find(e=>e.id===latest.examId);
                    if (!ex || !ex.types || ex.types.length === 0) {
                        try { if (this.spQuadChart) { this.spQuadChart.dispose(); this.spQuadChart = null; } } catch(e){}
                        dom.innerHTML = Utils.getEmptyStateHTML('暂无题型数据', '该考试未设置题型信息。', 'chart', '');
                        return;
                    }

                    const stuClassAtExam = Utils.getClassForExam(stu, ex);
                    const clsStus = this.store.state.data.students.filter(s => {
                        const sClass = Utils.getClassForExam(s, ex);
                        return sClass.campus === stuClassAtExam.campus && sClass.teachingClass === stuClassAtExam.teachingClass;
                    }).map(s=>s.id);
                    const clsScores = this.store.state.data.scores.filter(s => s.examId === ex.id && clsStus.includes(s.studentId) && Utils.isActualScore(s));

                    let clsTotalScoreSum = clsScores.reduce((a, b) => a + b.total, 0);
                    let clsTotalAvg = clsScores.length > 0 ? clsTotalScoreSum / clsScores.length : 0;
                    let clsTotalRate = ex.maxTotal > 0 ? (clsTotalAvg / ex.maxTotal) * 100 : 60;

                    const scatterData = [];
                    ex.types.forEach(t => {
                        const stuScore = latest.details?.[t.name] || 0;
                        const stuRate = t.max > 0 ? (stuScore / t.max) * 100 : 0;

                        let clsSum = 0;
                        clsScores.forEach(cs => clsSum += (cs.details?.[t.name]||0));
                        const clsAvg = clsScores.length > 0 ? clsSum / clsScores.length : 0;
                        const clsRate = t.max > 0 ? (clsAvg / t.max) * 100 : 0;

                        scatterData.push({
                            name: t.name,
                            value: [parseFloat(clsRate.toFixed(1)), parseFloat(stuRate.toFixed(1))],
                            itemStyle: { color: stuRate >= clsRate ? '#0071e3' : '#d70015' }
                        });
                    });

                    this._deferredChartSetOption(this.spQuadChart, {
                        animation: true,
                        animationDuration: 760,
                        animationEasing: 'cubicOut',
                        title: { text: '模块优劣势四象限', left: 20, top: 12, textStyle: {fontSize: 16, fontWeight: 650, color: '#334155'} },
                        grid: { top: 54, bottom: 32, left: 72, right: 30, containLabel: true },
                        tooltip: {
                            confine: true,
                            formatter: function (params) {
                                if(params.componentType === 'markLine') return null;
                                return `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #dedee3;padding-bottom:4px;">${params.data.name}</div>班级平均得分率: ${params.value[0]}%<br/>个人得分率: <span style="color:${params.color};font-weight:bold;">${params.value[1]}%</span>`;
                            }
                        },
                        xAxis: { type: 'value', name: '班级得分率 (%)', nameLocation: 'middle', nameGap: 28, nameTextStyle: {fontSize: 12, color: '#64748b'}, scale: true, splitLine: { show: false }, axisLine: {lineStyle: {color: '#cbd5e1'}}, axisTick: {show: false}, axisLabel: {fontSize: 11, color: '#64748b', hideOverlap: true, margin: 10} },
                        yAxis: { type: 'value', name: '个人得分率 (%)', nameLocation: 'middle', nameGap: 42, nameTextStyle: {fontSize: 12, color: '#64748b'}, scale: true, splitLine: { show: false }, axisLine: {lineStyle: {color: '#cbd5e1'}}, axisTick: {show: false}, axisLabel: {fontSize: 11, color: '#64748b', hideOverlap: true, margin: 10} },
                            series: [{
                            type: 'scatter', data: scatterData, symbolSize: 13,
                            animationDelay: idx => idx * 80,
                            animationDuration: 760,
                            label: { show:true, formatter: '{b}', position: 'top', distance: 7, color: '#334155', fontSize: 11, fontWeight: 600, backgroundColor: 'rgba(255,255,255,.9)', padding: [3, 5], borderRadius: 5 },
                            labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
                            markLine: { lineStyle: { type: 'dashed', color: '#8e8e93', width: 1 }, symbol: 'none', label: { show: false }, data: [ { xAxis: clsTotalRate }, { yAxis: clsTotalRate } ] },
                            markArea: { silent: true, data: [ [ { xAxis: clsTotalRate, yAxis: clsTotalRate, itemStyle: { color: 'rgba(52, 199, 89, 0.05)' }, label: { formatter: '优势拓展', position: 'insideTopRight', color: '#24743a', fontSize: 9, fontWeight: 600, opacity: 0.7, backgroundColor: 'rgba(255,255,255,.78)', padding: [2, 4], borderRadius: 4 } }, { xAxis: 'max', yAxis: 'max' } ], [ { xAxis: 'min', yAxis: clsTotalRate, itemStyle: { color: 'rgba(0, 122, 255, 0.05)' }, label: { formatter: '强势抢分', position: 'insideTopLeft', color: '#356da8', fontSize: 9, fontWeight: 600, opacity: 0.7, backgroundColor: 'rgba(255,255,255,.78)', padding: [2, 4], borderRadius: 4 } }, { xAxis: clsTotalRate, yAxis: 'max' } ], [ { xAxis: 'min', yAxis: 'min', itemStyle: { color: 'rgba(100, 116, 139, 0.05)' }, label: { formatter: '共同盲区', position: 'insideBottomLeft', color: '#5b6573', fontSize: 9, fontWeight: 600, opacity: 0.7, backgroundColor: 'rgba(255,255,255,.78)', padding: [2, 4], borderRadius: 4 } }, { xAxis: clsTotalRate, yAxis: clsTotalRate } ], [ { xAxis: clsTotalRate, yAxis: 'min', itemStyle: { color: 'rgba(255, 59, 48, 0.05)' }, label: { formatter: '紧急补漏', position: 'insideBottomRight', color: '#a74343', fontSize: 9, fontWeight: 600, opacity: 0.7, backgroundColor: 'rgba(255,255,255,.78)', padding: [2, 4], borderRadius: 4 } }, { xAxis: 'max', yAxis: clsTotalRate } ] ] }
                        }]
                    }, 120);
                }

                runAnalysis() {
                    this._clearAnalysisSkeleton();
                    if (this.store.state.currentAnalysisType === 'compare' && window.gk2Comparison) {
                        if (this.chartInstance) { try { this.chartInstance.dispose(); } catch(e) {} this.chartInstance = null; }
                        if (this.ovCharts) { this.ovCharts.forEach(c => { try { c.dispose(); } catch(e) {} }); this.ovCharts = []; }
                        const body = document.querySelector('#view-analysis .content-body');
                        if (body) body.classList.remove('overview-mode', 'analysis-radar-grid-mode', 'analysis-heatmap-mode', 'analysis-table-fill-mode', 'analysis-table-fill-with-chart');
                        for (const key of ['distSegmentChart', 'distNormalChart']) { try { this[key]?.dispose(); } catch(e) {} this[key] = null; }
                        return window.gk2Comparison.render(this);
                    }
                    window.gk2Comparison?.leave();
                    
                    if (this.chartInstance) {
                        try { this.chartInstance.dispose(); } catch(e) {}
                        this.chartInstance = null;
                    }
                    if (this.ovCharts) {
                        this.ovCharts.forEach(c => { try { if (c) c.dispose(); } catch(e) {} });
                        this.ovCharts = [];
                    }
                    const examEl = document.getElementById('global-exam');
                    if (!examEl || !examEl.value) {
                        // 如果没选考试，安全隐藏新版的统计容器并退出，防止阻塞生命周期
                        const compactStats = document.getElementById('analysis-compact-stats');
                        if (compactStats) compactStats.style.display = 'none';
                        const chartCard = document.getElementById('chart-wrapper-card');
                        if (chartCard && chartCard.querySelector('.gk2-student-radar-grid') && this._chartWrapperOriginalHTML) {
                            chartCard.innerHTML = this._chartWrapperOriginalHTML;
                        }
                        const analysisBody = document.querySelector('#view-analysis .content-body');
                        if (analysisBody) analysisBody.classList.remove('analysis-radar-grid-mode');
                        return; 
                    }
                    const eid = examEl.value; 
                    const exam = this.store.state.data.exams.find(i => i.id === eid);
                    if (!exam) return;
    
                    // 2. 清理旧的容器引用逻辑
                    // 确保不再去寻找已经搬走的 student-dashboard-container
                    const type = this.store.state.currentAnalysisType;
                    const stuSelector = document.getElementById('af-stu'); 
                    const chartCard = document.getElementById('chart-wrapper-card');
                    const analysisBody = document.querySelector('#view-analysis .content-body');
                    if (analysisBody) {
                        analysisBody.classList.toggle('overview-mode', type === 'overview');
                        analysisBody.classList.toggle('analysis-detail-mode', type !== 'overview');
                        analysisBody.classList.toggle('analysis-heatmap-mode', type === 'heatmap');
                        analysisBody.classList.toggle('analysis-radar-grid-mode', type === 'radar');
                    }
                    // 保存 chart-wrapper-card 的原始结构，首次运行时记录以便安全恢复
                    try { if (chartCard && !this._chartWrapperOriginalHTML) this._chartWrapperOriginalHTML = chartCard.innerHTML; } catch(e) {}
                    const ovCard = document.getElementById('overview-dashboard-card');
                    if (ovCard) {
                        const isOverview = type === 'overview';
                        ovCard.style.display = isOverview ? 'grid' : 'none';
                        ovCard.classList.toggle('is-hidden', !isOverview);
                    }
                    chartCard.style.display = type === 'overview' ? 'none' : 'block'; 
                    if (chartCard && type !== 'heatmap') chartCard.style.minHeight = '';
                    const tableArea = document.getElementById('analysis-table-area');
                    if (tableArea) {
                        tableArea.style.display = 'none';
                        tableArea.classList.toggle('analysis-repeated-title-hidden', type === 'target' || type === 'borderline');
                    }
                    this._setAnalysisTableFillMode(false);
                    const tbody = document.getElementById('tbody-analysis');
                    if (tbody) tbody.innerHTML = '';

                    const compactStats = document.getElementById('analysis-compact-stats');
                    if (compactStats) compactStats.style.display = 'none'; 

                    // 核心修复：彻底销毁旧图表，解决切换时的残影重叠问题！
                    if (this.chartInstance) {
                        this.chartInstance.dispose();
                        this.chartInstance = null;
                    }
                    if (type !== 'overview' && this.ovCharts) {
                        this.ovCharts.forEach(c => { try { if (c) c.dispose(); } catch(e) {} });
                        this.ovCharts = [];
                    }

                    // 离开成绩分布页时，恢复默认单图容器，避免后续分析页继续沿用双图布局
                    if (type !== 'dist' && chartCard) {
                        try { if (this.distSegmentChart) { this.distSegmentChart.dispose(); this.distSegmentChart = null; } } catch (e) {}
                        try { if (this.distNormalChart) { this.distNormalChart.dispose(); this.distNormalChart = null; } } catch (e) {}
                        // 优先使用首次保存的原始结构恢复，更稳健；若无记录则回退到默认单图容器
                        try {
                            if (this._chartWrapperOriginalHTML) chartCard.innerHTML = this._chartWrapperOriginalHTML;
                            else chartCard.innerHTML = '<div id="chart-main" class="chart-container"></div>';
                        } catch (e) {
                            chartCard.innerHTML = '<div id="chart-main" class="chart-container"></div>';
                        }
                    }

                    const focus = this.store.state.globalFocus;

                    const baselineScopeWrap = document.getElementById('baseline-scope-wrap');
                    if (type === 'trend' || type === 'compare') {
                        const sType = document.getElementById('a-trend-score-type').value;
                        if (sType === 'std' || sType === 'ratio') baselineScopeWrap.style.display = 'flex';
                        else baselineScopeWrap.style.display = 'none';
                    } else {
                        baselineScopeWrap.style.display = 'none';
                    }

                    const getValidStudentsForExam = (examObj) => {
                        const actualCamps = this._getExamCampuses(examObj);
                        return this.store.state.data.students.filter(s => {
                            const classAtExam = Utils.getClassForExam(s, examObj);
                            const campusAtExam = classAtExam.campus || s.campus;
                            if (s.grade !== examObj.grade) return false;
                            if (actualCamps.length > 0 && !actualCamps.includes(campusAtExam)) return false;
                            return this._studentMatchesFocusForExam(s, examObj, focus);
                        });
                    };

                    const hasScoreValue = value => value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value));
                    const hasEnteredExamScore = (record, examObj = exam) => Utils.isActualScore(record, examObj);

                    const getOverviewStudentsForExam = (examObj) => getValidStudentsForExam(examObj);

                    const renderEmptyState = (title, desc, actionHtml = `<button class="secondary" onclick="window.app.ui.openExamModal()">${window.gk2IconMarkup('plus')} 新建考试</button>`) => {
                        this._clearAnalysisSkeleton();
                        if (chartCard) chartCard.style.display = 'none';
                        const tableArea = document.getElementById('analysis-table-area');
                        if (tableArea) tableArea.style.display = 'none';
                        const emptyCard = document.getElementById('empty-state-card');
                        if (emptyCard) {
                            emptyCard.style.display = 'block';
                            emptyCard.innerHTML = Utils.getEmptyStateHTML(title, desc, 'chart', actionHtml);
                        }
                    };

                    const hideEmptyState = () => {
                        document.getElementById('empty-state-card').style.display = 'none';
                    };

                    const getGradeStats = (examObj, targetCampus = null) => {
                        let pool = this.store.state.data.scores.filter(s => s.examId === examObj.id && Utils.isActualScore(s));
                        const baselineScope = document.getElementById('a-baseline-scope').value;
                        
                        if (baselineScope === 'campus' && targetCampus) {
                            const campStuIds = this.store.state.data.students.filter(s => s.campus === targetCampus).map(s=>s.id);
                            pool = pool.filter(s => campStuIds.includes(s.studentId));
                        }
                        
                        const validScores = pool.map(s => s.total);
                        if (validScores.length === 0) return { mean: 0, stdDev: 1 };
                        const mean = validScores.reduce((a,b)=>a+b, 0) / validScores.length;
                        const variance = validScores.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / validScores.length;
                        const stdDev = Math.sqrt(variance) || 1;
                        return { mean, stdDev };
                    };

                    hideEmptyState();
                    if (type === 'overview' && window.gk2) {
                        window.gk2.renderOverview(this, exam, getValidStudentsForExam, Utils.getClassForExam);
                        return;
                    }


                    // ================= 0. 学生跨期趋势追踪 =================
                    if (type === 'trend') {
                        const msPanel = document.getElementById('ms-analysis-panel');
                        const checkedClasses = msPanel ? Array.from(msPanel.querySelectorAll('input:checked')).map(cb => cb.value.replace(/&quot;/g, '"')) : [];

                        let trendStudents = this.store.state.data.students.filter(s => {
                            if (!this._studentMatchesFocusForExam(s, exam, focus)) return false;
                            if (checkedClasses.length > 0) {
                                const cls = Utils.getClassForExam(s, exam);
                                const keyAtExam = `${cls.campus || s.campus || ''} - ${cls.teachingClass || s.teachingClass || ''}`;
                                const keyCurrent = `${s.campus || ''} - ${s.teachingClass || ''}`;
                                if (!checkedClasses.includes(keyAtExam) && !checkedClasses.includes(keyCurrent)) return false;
                            }
                            return true;
                        });

                        const currStu = stuSelector.value;
                        stuSelector.innerHTML = '<option value="">班级均分趋势（或选择学生）</option>';
                        trendStudents
                            .sort((a, b) => `${a.campus}-${a.teachingClass}-${a.name}`.localeCompare(`${b.campus}-${b.teachingClass}-${b.name}`, 'zh-CN', { numeric: true }))
                            .forEach(s => {
                                stuSelector.innerHTML += `<option value="${s.id}">${s.name} (${s.campus} - ${s.teachingClass})</option>`;
                            });
                        if (currStu && trendStudents.some(s => s.id === currStu)) stuSelector.value = currStu;

                        const selectedPhases = this.store.state.trendPhases && this.store.state.trendPhases.length > 0 ? this.store.state.trendPhases : focus.phases;
                        const scoreType = document.getElementById('a-trend-score-type').value;
                        const chartType = document.getElementById('a-compare-chart-type').value;

                        let targetStu = null;
                        if (stuSelector.value) {
                            targetStu = trendStudents.find(s => s.id === stuSelector.value);
                            if (!targetStu) {
                                return renderEmptyState("学生不在筛选范围内", "当前筛选条件下找不到所选学生，请放宽筛选后重试。");
                            }
                        }

                        let candidateExams = this.store.state.data.exams.filter(ex => {
                            if (targetStu) {
                                if (ex.grade !== targetStu.grade) return false;
                            } else {
                                if (focus.grades.length > 0 && !focus.grades.includes(ex.grade)) return false;
                            }
                            const exCamps = this._getExamCampuses(ex);
                            if (focus.campuses.length > 0 && exCamps.length > 0 && !exCamps.some(c => focus.campuses.includes(c))) return false;
                            if (selectedPhases.length > 0) {
                                const exPhase = Utils.calculatePhase(ex.grade, ex.date);
                                if (!selectedPhases.includes(exPhase)) return false;
                            }
                            if (targetStu && exCamps.length > 0 && !exCamps.includes(targetStu.campus)) return false;
                            return true;
                        }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

                        if (candidateExams.length === 0) {
                            return renderEmptyState("暂无可对比考试", "当前筛选学期下没有可用于趋势分析的考试。");
                        }

                        const xAxisData = [];
                        const stuData = [];
                        const classAvgData = [];

                        const calcScoreByType = (rawScore, examObj, targetCampus = null) => {
                            if (scoreType === 'std') {
                                const stats = getGradeStats(examObj, targetCampus);
                                const z = (rawScore - stats.mean) / stats.stdDev;
                                return parseFloat((z * 10 + 50).toFixed(1));
                            }
                            if (scoreType === 'pct') {
                                if (!examObj.maxTotal) return 0;
                                return parseFloat(((rawScore / examObj.maxTotal) * 100).toFixed(1));
                            }
                            if (scoreType === 'ratio') {
                                const stats = getGradeStats(examObj, targetCampus);
                                if (stats.mean === 0) return 0;
                                return parseFloat(((rawScore / stats.mean) * 100).toFixed(1));
                            }
                            return parseFloat(rawScore.toFixed(1));
                        };

                        candidateExams.forEach(ex => {
                            const phase = Utils.calculatePhase(ex.grade, ex.date);
                            xAxisData.push(`${ex.name}\n${ex.grade} · ${ex.date}`);

                            if (targetStu) {
                                const stuRec = this.store.getScore(targetStu.id, ex.id);
                                if (Utils.isActualScore(stuRec, ex)) stuData.push(calcScoreByType(stuRec.total, ex, targetStu.campus));
                                else stuData.push(null);
                            }

                            const targetClassAtExam = targetStu ? Utils.getClassForExam(targetStu, ex) : null;
                            const classStudents = getValidStudentsForExam(ex).filter(s => {
                                if (targetClassAtExam && Utils.getClassForExam(s, ex).campus !== targetClassAtExam.campus) return false;
                                if (targetClassAtExam && Utils.getClassForExam(s, ex).teachingClass !== targetClassAtExam.teachingClass) return false;
                                return true;
                            });

                            const classScores = [];
                            classStudents.forEach(s => {
                                const r = this.store.getScore(s.id, ex.id);
                                if (Utils.isActualScore(r)) classScores.push(r.total);
                            });
                            if (classScores.length === 0) classAvgData.push(null);
                            else {
                                const avg = classScores.reduce((a, b) => a + b, 0) / classScores.length;
                                classAvgData.push(calcScoreByType(avg, ex, targetClassAtExam ? targetClassAtExam.campus : null));
                            }
                        });

                        if (!classAvgData.some(v => v !== null)) {
                            return renderEmptyState("暂无班级均分数据", "当前所选学期与班级范围内没有可用于计算平均分的有效成绩。请检查您的筛选条件或录入成绩。");
                        }

                        document.getElementById('chart-wrapper-card').style.display = 'block';
                        this.chartInstance = echarts.init(document.getElementById('chart-main'));

                        const trendMaxTotal = Math.max(...candidateExams.map(e => e.maxTotal || 0));
                        const yAxisConfig = { type: 'value', min: 0, scale: false, name: '卷面绝对分' };
                        if (scoreType === 'raw') { yAxisConfig.max = trendMaxTotal; }
                        else if (scoreType === 'pct') { yAxisConfig.max = 100; yAxisConfig.name = '得分率 (%)'; }
                        else if (scoreType === 'std') { yAxisConfig.name = 'T-标准分 (基准50)'; }
                        else if (scoreType === 'ratio') { yAxisConfig.name = '均分指数 (基准100)'; }

                        const trendSeries = [];
                        const trendSeriesMap = {}; // 用于存储原始系列数据和颜色，用于生成预测线
                        
                        if (targetStu) {
                            trendSeries.push({
                                name: targetStu.name,
                                type: chartType,
                                data: stuData,
                                smooth: chartType === 'line',
                                symbol: 'circle',
                                symbolSize: 8,
                                itemStyle: chartType === 'bar' ? { color: '#0071e3', borderRadius: [4, 4, 0, 0] } : { color: '#0071e3' },
                                lineStyle: chartType === 'line' ? { width: 3, color: '#0071e3' } : undefined,
                                label: chartType === 'bar' ? { show: true, position: 'top', formatter: (p) => p.value === null ? '' : p.value } : undefined,
                                z: 5
                            });
                            trendSeriesMap['student'] = { data: stuData, color: '#0071e3', name: targetStu.name };
                        } else {
                            // 未选学生时，显示该年级各班级的折线
                            const classColors = ['#0071e3', '#5e5ce6', '#007889', '#1f7a35', '#ffcc00', '#8e44ad', '#d70015', '#6e6e73'];
                            
                            // 从当前考试范围的有效学生中按考试日期提取所有出现过的班级
                            const allClassNameSet = new Set();
                            candidateExams.forEach(ex => {
                                const validForEx = getValidStudentsForExam(ex);
                                validForEx.forEach(s => {
                                    const cls = Utils.getClassForExam(s, ex);
                                    allClassNameSet.add(`${cls.campus} - ${cls.teachingClass}`);
                                });
                            });
                            const allClassNames = [...allClassNameSet]
                                .filter(n => n !== ' - ')
                                .sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));

                            allClassNames.forEach((className, colorIdx) => {
                                const classLineData = [];
                                candidateExams.forEach(ex => {
                                    const [campus, cls] = className.split(' - ');
                                    const classStudentsForLine = getValidStudentsForExam(ex).filter(s => {
                                        const sc = Utils.getClassForExam(s, ex);
                                        return sc.campus === campus && sc.teachingClass === cls;
                                    });
                                    
                                    const classScores = [];
                                    classStudentsForLine.forEach(s => {
                                        const r = this.store.getScore(s.id, ex.id);
                                        if (Utils.isActualScore(r)) classScores.push(r.total);
                                    });
                                    
                                    if (classScores.length === 0) classLineData.push(null);
                                    else {
                                        const avg = classScores.reduce((a, b) => a + b, 0) / classScores.length;
                                        classLineData.push(calcScoreByType(avg, ex, campus));
                                    }
                                });

                                if (classLineData.some(v => v !== null)) {
                                    const seriesObj = {
                                        name: className,
                                        type: chartType, // <--- 修复1：使用动态选定的图表类型，而不是写死 'line'
                                        data: classLineData,
                                        smooth: chartType === 'line', // <--- 修复2：只有折线图才使用平滑曲线
                                        symbol: 'circle',
                                        symbolSize: 5,
                                        // 修复3：根据图表类型动态赋予不同的样式（柱状图加圆角和顶部数值标签）
                                        lineStyle: chartType === 'line' ? { width: 2, color: classColors[colorIdx % classColors.length] } : undefined,
                                        itemStyle: chartType === 'bar' ? { color: classColors[colorIdx % classColors.length], borderRadius: [4, 4, 0, 0] } : { color: classColors[colorIdx % classColors.length] },
                                        label: chartType === 'bar' ? { show: true, position: 'top', formatter: (p) => p.value > 0 ? p.value : '', color: classColors[colorIdx % classColors.length] } : undefined,
                                        z: 2
                                    };
                                    trendSeries.push(seriesObj);
                                    trendSeriesMap[`class_${className}`] = { data: classLineData, color: classColors[colorIdx % classColors.length], name: className };
                                }
                            });
                        }

                        trendSeries.push({
                            name: targetStu ? '班级均值' : '全年级均分',
                            type: 'line',
                            data: classAvgData,
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 6,
                            lineStyle: { width: 2, type: 'dashed', color: Utils.cssVar('--text-faint', '#86868b') },
                            itemStyle: { color: Utils.cssVar('--text-faint', '#86868b') },
                            z: 10
                        });
                        trendSeriesMap['avgLine'] = { data: classAvgData, color: Utils.cssVar('--text-faint', '#86868b'), name: targetStu ? '班级均值' : '全年级均分' };

                        // 生成预测线系列
                        const xAxisNumbers = candidateExams.map((_, i) => i);
                        const predictSeries = [];
                        
                        for (const key in trendSeriesMap) {
                            const seriesInfo = trendSeriesMap[key];
                            const regressionResult = Utils.linearRegression(xAxisNumbers, seriesInfo.data);
                            
                            if (regressionResult) {
                                const predictData = [];
                                // 生成现有数据点和最后一个数据点之后的预测点
                                for (let i = 0; i <= xAxisNumbers.length; i++) {
                                    if (i < xAxisNumbers.length) {
                                        // 现有数据点不显示
                                        predictData.push(null);
                                    } else {
                                        // 预测下一个点
                                        predictData.push(parseFloat(regressionResult.predict(i).toFixed(1)));
                                    }
                                }
                                
                                predictSeries.push({
                                    name: `${seriesInfo.name} (趋势)`,
                                    type: 'line',
                                    data: predictData,
                                    smooth: true,
                                    symbol: 'none',
                                    lineStyle: { type: 'dashed', opacity: 0.6, color: seriesInfo.color, width: 2 },
                                    z: 1,
                                    _isTrendPredict: true
                                });
                            }
                        }

                        // 扩展xAxisData以容纳预测点
                        const nextPhaseEstimate = '预测';
                        xAxisData.push(nextPhaseEstimate);

                        const chartTitle = targetStu
                            ? `学生成长轨迹：${targetStu.name} (${targetStu.campus} - ${targetStu.teachingClass}${Utils.hasTransferred(targetStu) ? '（曾转班）' : ''})`
                            : '班级均分变化趋势';

                        // 修复：读取当前开关状态，并通过 ECharts 的 legend.selected 来控制隐藏/显示
                        const isPredictChecked = document.getElementById('a-trend-predict-toggle').checked;
                        const legendSelectedState = {};
                        predictSeries.forEach(s => {
                            legendSelectedState[s.name] = isPredictChecked; // 强绑定物理开关的状态
                        });
                        
                        const allSeries = [...trendSeries, ...predictSeries];

                        this._deferredChartSetOption(this.chartInstance, {
                            title: { text: chartTitle, left: 'center' },
                            tooltip: {
                                trigger: 'axis',
                                formatter: function(params) {
                                    let res = `<b>${params[0].axisValue.replace('\n', ' / ')}</b><br/>`;
                                    params.forEach(p => {
                                        if (p.value === null) return;
                                        const unit = scoreType === 'pct' ? '%' : (scoreType === 'raw' ? ' 分' : '');
                                        const val = p.value;
                                        res += `${p.marker} ${p.seriesName}: <span style="font-weight:bold; color:var(--text-main);">${val}</span>${unit}<br/>`;
                                    });
                                    return res;
                                }
                            },
                            legend: { 
                                data: allSeries.map(s => s.name), 
                                bottom: 8,
                                selected: legendSelectedState // 注入初始的显隐字典
                            },
                            // Reserve a distinct lower band for the legend, clear of the rotated exam labels.
                            grid: { bottom: 112, containLabel: true },
                            xAxis: { type: 'category', data: xAxisData, axisLabel: { interval: 0, rotate: 12, margin: 26 } },
                            yAxis: yAxisConfig,
                            series: allSeries
                        });
                        
                        // 在Store中保存当前预测系列的信息，便于checkbox切换时使用
                        this.store.state.currentTrendPredictSeries = predictSeries.map((s, i) => ({ seriesName: s.name, seriesIndex: trendSeries.length + i }));


                        document.getElementById('analysis-table-area').style.display = 'flex';
                        const thead = document.getElementById('thead-analysis');
                        const tbody = document.getElementById('tbody-analysis');
                        let thHtml = `<tr><th style="z-index:var(--z-sticky); width:150px;">指标</th>`;
                        candidateExams.forEach(ex => { thHtml += `<th>${ex.name}</th>`; });
                        thHtml += `</tr>`;
                        thead.innerHTML = thHtml;

                        if (targetStu) {
                            document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('trend')} 成长轨迹明细 <small style="color:var(--text-sub); font-weight:normal;">(学生 vs 班级均值)</small>`;
                            const stuRow = stuData.map(v => `<td style="font-weight:600; color:var(--primary);">${v !== null ? v : '<span style="color:var(--line-strong);">-</span>'}</td>`).join('');
                            const avgRow = classAvgData.map(v => `<td style="font-weight:600; color:var(--text-muted);">${v !== null ? v : '<span style="color:var(--line-strong);">-</span>'}</td>`).join('');
                            tbody.innerHTML = `<tr><td style="font-weight:700; color:#1d1d1f;">${targetStu.name}</td>${stuRow}</tr><tr><td style="font-weight:700; color:#424245;">班级均值</td>${avgRow}</tr>`;
                        } else {
                            document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('chart')} 班级均分明细 <small style="color:var(--text-sub); font-weight:normal;">(默认展示当前筛选范围内的平均趋势)</small>`;
                            this._setAnalysisTableFillMode(true, false);
                            const avgRow = classAvgData.map(v => `<td style="font-weight:600; color:var(--text-muted);">${v !== null ? v : '<span style="color:var(--line-strong);">-</span>'}</td>`).join('');
                            tbody.innerHTML = `<tr><td style="font-weight:700; color:#424245;">班级均值</td>${avgRow}</tr>`;
                        }
                        return;
                    }

                    

                    // ================= 1. 跨考次自由多选对比 =================
                    if (type === 'compare') {
                        const panel = document.getElementById('ms-compare-exams-panel');
                        const checkedExamIds = panel ? Array.from(panel.querySelectorAll('input:checked')).map(cb => cb.value) : [];
                        const compareDirection = document.getElementById('a-compare-direction')?.value || 'class';
                        const compareDimRaw = document.getElementById('a-compare-dim').value;
                        const compareDim = compareDirection === 'custom'
                            ? compareDimRaw
                            : (compareDirection === 'cross-grade' ? 'grade' : compareDirection);
                        const useNormalizedX = compareDirection === 'cross-grade';
                        const scoreType = document.getElementById('a-trend-score-type').value; 
                        const chartType = document.getElementById('a-compare-chart-type').value; 
                        
                        // 获取方案二自定义的别名对齐映射字典
                        const aliasMap = this.getCustomAliasMap();
                        
                        // 获取方案三的班级追踪口径配置（当前最新班级或当时历史班级）
                        const compareTracking = document.getElementById('a-compare-tracking')?.value || 'current';
                        const getStudentClassInfo = (stu, examObj) => {
                            if (compareTracking === 'current') {
                                return { campus: stu.campus || '', teachingClass: stu.teachingClass || '' };
                            } else {
                                return Utils.getClassForExam(stu, examObj);
                            }
                        };

                        let selectedExams = this.store.state.data.exams.filter(e => checkedExamIds.includes(e.id));
                        selectedExams.sort((a,b) => (a.date||'').localeCompare(b.date||''));
                        
                        if (selectedExams.length === 0) {
                            const guideHtml = `
                                <div class="compare-guide-container" style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-top:15px; width:100%; box-sizing:border-box;">
                                    <!-- 场景一：跨代PK -->
                                    <div class="compare-guide-card" style="flex:1 1 240px; max-width:300px; background:rgba(255,255,255,0.85); border:1px solid rgba(139,92,246,0.25); border-radius:12px; padding:16px; box-shadow:0 6px 20px -5px rgba(139,92,246,0.15); backdrop-filter:blur(10px); display:flex; flex-direction:column; text-align:left;">
                                        <div class="gk2-scenario-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 18h2"/></svg></div>
                                        <h4 style="font-size:14px; font-weight:700; color:var(--text-main); margin:0 0 6px;">历届同期对比</h4>
                                        <p style="font-size:11px; color:var(--text-sub); line-height:1.4; margin:0 0 16px; flex-grow:1;">对比不同届学生在<b>同一学段、同期考试</b>中的平均成绩，观察历届表现。</p>
                                        <button type="button" class="primary" style="background:var(--primary); border:none; color:#ffffff; font-weight:600; font-size:11px; padding:8px 12px; border-radius:6px; width:100%; cursor:pointer;" onclick="window.app.ui.quickTriggerCompareScenario('cross-grade-pk')">对比同期成绩</button>
                                    </div>
                                    
                                    <!-- 场景二：现有班级轨迹 -->
                                    <div class="compare-guide-card" style="flex:1 1 240px; max-width:300px; background:rgba(255,255,255,0.85); border:1px solid rgba(14,165,233,0.25); border-radius:12px; padding:16px; box-shadow:0 6px 20px -5px rgba(14,165,233,0.15); backdrop-filter:blur(10px); display:flex; flex-direction:column; text-align:left;">
                                        <div class="gk2-scenario-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v17h17 M7 15l4-5 4 2 5-7 M16 5h4v4"/></svg></div>
                                        <h4 style="font-size:14px; font-weight:700; color:var(--text-main); margin:0 0 6px;">班级成绩追踪</h4>
                                        <p style="font-size:11px; color:var(--text-sub); line-height:1.4; margin:0 0 16px; flex-grow:1;">按学生<b>当前所在班级</b>追踪历史考试成绩，观察班级变化，可调整参与对比的考试。</p>
                                        <button type="button" class="primary" style="background:var(--primary); border:none; color:#ffffff; font-weight:600; font-size:11px; padding:8px 12px; border-radius:6px; width:100%; cursor:pointer;" onclick="window.app.ui.quickTriggerCompareScenario('class-trajectory')">追踪班级成绩</button>
                                    </div>
                                    
                                    <!-- 场景三：历史现场还原 -->
                                    <div class="compare-guide-card" style="flex:1 1 240px; max-width:300px; background:rgba(255,255,255,0.85); border:1px solid rgba(249,115,22,0.25); border-radius:12px; padding:16px; box-shadow:0 6px 20px -5px rgba(249,115,22,0.15); backdrop-filter:blur(10px); display:flex; flex-direction:column; text-align:left;">
                                        <div class="gk2-scenario-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9h5v11 M15 20V4h5v16 M3 20h19"/></svg></div>
                                        <h4 style="font-size:14px; font-weight:700; color:var(--text-main); margin:0 0 6px;">历史班级对比</h4>
                                        <p style="font-size:11px; color:var(--text-sub); line-height:1.4; margin:0 0 16px; flex-grow:1;">按<b>考试当时的班级归属</b>对比成绩，查看各班在不同考试中的表现。</p>
                                        <button type="button" class="primary" style="background:var(--primary); border:none; color:#ffffff; font-weight:600; font-size:11px; padding:8px 12px; border-radius:6px; width:100%; cursor:pointer;" onclick="window.app.ui.quickTriggerCompareScenario('history-restore')">按历史班级对比</button>
                                    </div>
                                </div>
                            `;
                            return renderEmptyState("选择一种成绩对比方式", "在上方选择考试，或从下方常用场景开始。", guideHtml);
                        }
                        
                        let pool = this.store.state.data.students;
                        if (focus.campuses.length > 0) pool = pool.filter(s => focus.campuses.includes(s.campus));
                        
                        // 【方案一：智能旁路全局年级过滤器】以勾选考试所覆盖的年级为依据拉取学生，不再受全局单选过滤的影响
                        const examGrades = new Set(selectedExams.map(ex => ex.grade).filter(Boolean));
                        if (examGrades.size > 0) {
                            pool = pool.filter(s => examGrades.has(s.grade));
                        } else if (focus.grades.length > 0) {
                            pool = pool.filter(s => focus.grades.includes(s.grade));
                        }

                        const checkedClasses = Array.from(document.querySelectorAll('#ms-analysis-panel input:checked')).map(cb => cb.value.replace(/&quot;/g, '"'));
                        if (checkedClasses.length === 0 && focus.tClasses.length > 0) pool = pool.filter(s => focus.tClasses.includes(s.teachingClass));
                        const studentById = new Map(this.store.state.data.students.map(s => [s.id, s]));
                        const selectedExamIds = new Set(selectedExams.map(ex => ex.id));
                        const scoreRecords = (this.store.state.data.scores || [])
                             .filter(sc => selectedExamIds.has(sc.examId) && Utils.isActualScore(sc));
                        const scoreByExam = new Map();
                        scoreRecords.forEach(sc => {
                            if (!scoreByExam.has(sc.examId)) scoreByExam.set(sc.examId, []);
                            scoreByExam.get(sc.examId).push(sc);
                        });
                        const poolIds = new Set(pool.map(s => s.id));
                        
                        // 【方案三：根据口径配置解析追踪实体的分组名称】
                        const getLineName = (stu, examObj) => {
                            if (compareDim === 'class') {
                                const classAtExam = getStudentClassInfo(stu, examObj);
                                return `${classAtExam.campus || '-'} - ${classAtExam.teachingClass || '未分班'}`;
                            }
                            if (compareDim === 'grade') return stu.grade || '未知年级';
                            if (compareDim === 'campus') return stu.campus || '未知校区';
                            return '选定范围';
                        };
                        const getScoreValue = (record, examObj, stu) => {
                            const raw = Number(record.total || 0);
                            if (scoreType === 'pct') return examObj.maxTotal > 0 ? (raw / examObj.maxTotal) * 100 : null;
                            if (scoreType === 'std') {
                                const stats = getGradeStats(examObj, stu && stu.campus ? stu.campus : null);
                                return ((raw - stats.mean) / stats.stdDev) * 10 + 50;
                            }
                            if (scoreType === 'ratio') {
                                const stats = getGradeStats(examObj, stu && stu.campus ? stu.campus : null);
                                return stats.mean ? (raw / stats.mean) * 100 : null;
                            }
                            return raw;
                        };
                        const xItems = [];
                        const xKeySet = new Set();
                        selectedExams.forEach(ex => {
                            // 【方案二：传入 aliasMap 自定义字典对齐横轴类目】
                            const key = useNormalizedX ? this.normalizeExamLabel(ex.examType || ex.name, aliasMap) : ex.id;
                            if (xKeySet.has(key)) return;
                            xKeySet.add(key);
                            xItems.push({ key, label: useNormalizedX ? key : ex.name });
                        });
                        const xAxisData = xItems.map(x => x.label);
                        const allRows = [];
                        selectedExams.forEach(ex => {
                            const examScores = scoreByExam.get(ex.id) || [];
                            examScores.forEach(sc => {
                                const stu = studentById.get(sc.studentId);
                                if (!stu || !poolIds.has(stu.id)) return;
                                const line = getLineName(stu, ex);
                                
                                // 【方案三：根据选定班级与口径过滤学生】
                                if (checkedClasses.length > 0) {
                                    const classAtExam = getStudentClassInfo(stu, ex);
                                    if (!checkedClasses.includes(`${classAtExam.campus} - ${classAtExam.teachingClass}`)) return;
                                }
                                
                                // 【方案二：归一化横轴对齐】
                                const xKey = useNormalizedX ? this.normalizeExamLabel(ex.examType || ex.name, aliasMap) : ex.id;
                                const val = getScoreValue(sc, ex, stu);
                                if (val === null || !isFinite(val)) return;
                                allRows.push({ exam: ex, score: sc, stu, line, xKey, value: val });
                            });
                        });
                        const agg = new Map();
                        const addAgg = (key, val) => {
                            const prev = agg.get(key) || { sum: 0, count: 0 };
                            prev.sum += val;
                            prev.count += 1;
                            agg.set(key, prev);
                        };
                        allRows.forEach(r => {
                            addAgg(`__overall__||${r.xKey}`, r.value);
                            addAgg(`${r.line}||${r.xKey}`, r.value);
                        });
                        const meanForKey = (key) => {
                            const bucket = agg.get(key);
                            return bucket && bucket.count ? parseFloat((bucket.sum / bucket.count).toFixed(1)) : null;
                        };
                        let lines = [...new Set(allRows.map(r => r.line).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
                        if (useNormalizedX) {
                            lines = [...new Set(selectedExams.map(ex => ex.grade).concat(lines).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
                        }
                        
                        // ================= 【需求三：跨实体成绩累计分布对比模式】 =================
                        if (chartType === 'cumulative') {
                            document.getElementById('chart-wrapper-card').style.display = 'block';
                            this.chartInstance = echarts.init(document.getElementById('chart-main'));
                            
                            const seriesData = [];
                            const tableData = [];
                            
                            const groups = [...new Set(allRows.map(r => r.line).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
                            
                            groups.forEach((groupName, idx) => {
                                const groupRows = allRows.filter(r => r.line === groupName);
                                const totals = groupRows.map(r => Number(r.score.total)).filter(v => isFinite(v) && v >= 0).sort((a,b)=>a-b);
                                
                                if (totals.length > 0) {
                                    const xPoints = [...new Set(totals)].sort((a,b)=>a-b);
                                    const totalCount = totals.length;
                                    
                                    const seriesPairs = xPoints.map(x => {
                                        const cnt = totals.filter(v => v <= x).length;
                                        const pct = parseFloat(((cnt / totalCount) * 100).toFixed(1));
                                        return [x, pct];
                                    });
                                    
                                    seriesData.push({
                                        name: groupName,
                                        type: 'line',
                                        smooth: true,
                                        data: seriesPairs,
                                        encode: { x: 0, y: 1 },
                                        lineStyle: { width: 3, color: barColors[idx % barColors.length] },
                                        itemStyle: { color: barColors[idx % barColors.length] },
                                        symbol: 'none'
                                    });
                                    
                                    tableData.push({ name: groupName, count: totalCount, median: totals[Math.floor(totalCount / 2)], max: totals[totalCount - 1] });
                                }
                            });
                            
                            if (seriesData.length === 0) {
                                return renderEmptyState("暂无分布数据", "当前选定的对比群体内没有足够的有效成绩以生成累计分布曲线。", '');
                            }
                            
                            const maxTotalScore = Math.max(...selectedExams.map(ex => Number(ex.maxTotal || 0)), 150);
                            
                            this._deferredChartSetOption(this.chartInstance, {
                                title: { text: `跨校区/年级同一学段成绩累计分布对比`, left: 'center' },
                                tooltip: {
                                    trigger: 'item',
                                    formatter: function(param) {
                                        const d = param && param.data ? param.data : null;
                                        if (!d) return '';
                                        return `<b>${param.seriesName}</b><br/>分数: ${d[0]} 分，包含本群体内累计 ${d[1]}% 的学生`;
                                    }
                                },
                                legend: { data: seriesData.map(s => s.name), bottom: 0 },
                                xAxis: { type: 'value', name: '分数', min: 0, max: maxTotalScore },
                                yAxis: { type: 'value', min: 0, max: 100, name: '累计百分比 (%)' },
                                series: seriesData
                            });
                            
                            document.getElementById('analysis-table-area').style.display = 'flex';
                            document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('chart')} 分布对比概要 <small style="color:var(--text-sub); font-weight:normal;">(对比维度：${compareDim === 'class' ? '班级' : (compareDim === 'grade' ? '年级' : '校区')})</small>`;
                            const thead = document.getElementById('thead-analysis');
                            const tbody = document.getElementById('tbody-analysis');
                            thead.innerHTML = `<tr><th style="z-index:var(--z-sticky); width:180px;">追踪实体</th><th>参考人数</th><th>中位数成绩 (分)</th><th>最高分 (分)</th></tr>`;
                            tbody.innerHTML = tableData.map(row => `
                                <tr>
                                    <td style="font-weight:700; color:#1d1d1f;">${row.name}</td>
                                    <td>${row.count} 人</td>
                                    <td style="font-weight:600; color:var(--primary);">${row.median} 分</td>
                                    <td style="font-weight:600; color:var(--success);">${row.max} 分</td>
                                </tr>
                            `).join('');
                            return;
                        }

                        // ================= 【需求二：跨实体题型得分率热力图对比模式】 =================
                        if (chartType === 'heatmap') {
                            const typeMap = new Map();
                            selectedExams.forEach(ex => {
                                const types = Array.isArray(ex.types) ? ex.types : [];
                                types.forEach(t => {
                                    if (t && t.name) typeMap.set(t.name, Math.max(typeMap.get(t.name) || 0, Number(t.max || t.maxScore || t.full || t.fullScore || 0)));
                                });
                            });
                            
                            const xAxisNames = [...typeMap.keys()];
                            const yAxisNames = [...new Set(allRows.map(r => r.line).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
                            
                            if (xAxisNames.length === 0 || yAxisNames.length === 0) {
                                return renderEmptyState("题型信息缺失", "选定考试内未录入任何题型结构划分，无法生成对比热力图。", '');
                            }
                            
                            const statsMap = new Map();
                            allRows.forEach(r => {
                                const details = r.score.details || {};
                                const examTypes = Array.isArray(r.exam.types) ? r.exam.types : [];
                                
                                examTypes.forEach(t => {
                                    if (!t || !t.name) return;
                                    const val = Number(details[t.name]);
                                    if (isFinite(val) && val >= 0) {
                                        const key = `${r.line}||${t.name}`;
                                        const prev = statsMap.get(key) || { got: 0, full: 0 };
                                        prev.got += val;
                                        const typeMax = Number(t.max || t.maxScore || t.full || t.fullScore || 0);
                                        prev.full += typeMax;
                                        statsMap.set(key, prev);
                                    }
                                });
                            });
                            
                            const heatData = [];
                            yAxisNames.forEach((groupName, yIdx) => {
                                xAxisNames.forEach((typeName, xIdx) => {
                                    const bucket = statsMap.get(`${groupName}||${typeName}`);
                                    const pct = (bucket && bucket.full > 0) ? parseFloat(((bucket.got / bucket.full) * 100).toFixed(1)) : 0;
                                    heatData.push([xIdx, yIdx, pct]);
                                });
                            });
                            
                            document.getElementById('chart-wrapper-card').style.display = 'block';
                            this.chartInstance = echarts.init(document.getElementById('chart-main'));
                            
                            this._deferredChartSetOption(this.chartInstance, {
                                title: { text: `跨校区/年级同一学段题型综合得分率对比热力图`, left: 'center' },
                                tooltip: {
                                    position: 'top',
                                    formatter: function (params) {
                                        return `<b>${yAxisNames[params.value[1]]}</b><br/>题型: ${xAxisNames[params.value[0]]}<br/>平均得分率: <span style="font-weight:bold; color:var(--text-main);">${params.value[2]}%</span>`;
                                    }
                                },
                                animation: false,
                                grid: { height: '50%', top: '15%' },
                                xAxis: { type: 'category', data: xAxisNames, splitArea: { show: true } },
                                yAxis: { type: 'category', data: yAxisNames, splitArea: { show: true } },
                                visualMap: {
                                    min: 0,
                                    max: 100,
                                    calculable: true,
                                    orient: 'horizontal',
                                    left: 'center',
                                    bottom: '5%',
                                    inRange: { color: ['#f7f7f9', '#bbf7d0', '#34c759', '#1f7a35'] }
                                },
                                series: [{
                                    name: '题型得分率',
                                    type: 'heatmap',
                                    data: heatData,
                                    label: { show: true, formatter: (p) => `${p.value[2]}%`, color: '#000000', fontSize: 10 },
                                    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
                                }]
                            });
                            
                            document.getElementById('analysis-table-area').style.display = 'flex';
                            document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('chart')} 题型均分得分率明细 <small style="color:var(--text-sub); font-weight:normal;">(对比维度：${compareDim === 'class' ? '班级' : (compareDim === 'grade' ? '年级' : '校区')})</small>`;
                            const thead = document.getElementById('thead-analysis');
                            const tbody = document.getElementById('tbody-analysis');
                            
                            let thHtml = `<tr><th style="z-index:var(--z-sticky); width:180px;">追踪实体</th>`;
                            xAxisNames.forEach(name => { thHtml += `<th>${Utils.escapeHTML(name)}得分率</th>`; });
                            thHtml += `</tr>`;
                            thead.innerHTML = thHtml;
                            
                            let tbHtml = '';
                            yAxisNames.forEach(groupName => {
                                tbHtml += `<tr><td style="font-weight:700; color:#1d1d1f;">${groupName}</td>`;
                                xAxisNames.forEach(typeName => {
                                    const bucket = statsMap.get(`${groupName}||${typeName}`);
                                    const pct = (bucket && bucket.full > 0) ? parseFloat(((bucket.got / bucket.full) * 100).toFixed(1)) : null;
                                    tbHtml += `<td style="font-weight:600; color:var(--primary);">${pct !== null ? pct + '%' : '<span style="color:var(--line-strong);">-</span>'}</td>`;
                                });
                                tbHtml += `</tr>`;
                            });
                            tbody.innerHTML = tbHtml;
                            return;
                        }

                        document.getElementById('chart-wrapper-card').style.display = 'block';
                        this.chartInstance = echarts.init(document.getElementById('chart-main'));
                        
                        const seriesData = [];
                        const tableData = []; 
                        
                        // 选定范围整体均分
                        const overallLineData = xItems.map(x => meanForKey(`__overall__||${x.key}`));

                        if (overallLineData.some(d => d !== null)) {
                            seriesData.push({ 
                                name: '选定范围总均分', 
                                type: chartType === 'bar' ? 'line' : chartType, 
                                data: overallLineData, 
                                smooth: true, 
                                symbol: 'circle', 
                                symbolSize: 8, 
                                lineStyle: { width: 4, type: 'dashed', color: '#ffcc00' },
                                itemStyle: { color: '#ffcc00', borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : 0 },
                                label: chartType === 'bar' ? { show: true, position: 'top', formatter: (p) => p.value > 0 ? p.value : '', color: '#1d1d1f', fontWeight: 'bold' } : undefined,
                                z: 10
                            });
                        }

                        lines.forEach((lineName, idx) => {
                            const lineData = xItems.map(x => meanForKey(`${lineName}||${x.key}`));
                            
                            if (lineData.some(d => d !== null)) {
                                seriesData.push({ 
                                    name: lineName, 
                                    type: chartType, 
                                    data: lineData, 
                                    smooth: true, 
                                    symbol: 'circle', 
                                    symbolSize: 6, 
                                    itemStyle: chartType === 'bar' ? { color: barColors[idx % barColors.length], borderRadius: [4, 4, 0, 0] } : { color: barColors[idx % barColors.length] },
                                    lineStyle: chartType === 'line' ? { width: 3, color: barColors[idx % barColors.length] } : undefined,
                                    label: chartType === 'bar' ? { show: true, position: 'top', formatter: (p) => p.value > 0 ? p.value : '' } : undefined
                                });
                                tableData.push({ name: lineName, scores: lineData });
                            }
                        });

                        if (seriesData.length === 0) {
                            return renderEmptyState("暂无可对比成绩", "已找到考试，但当前筛选范围内没有可用于对比的有效成绩。请检查校区、年级、班级或缺考状态。", '');
                        }
                        
                        let yName = '卷面分';
                        const maxExamTotal = Math.max(...selectedExams.map(ex => Number(ex.maxTotal || 0)), 0);
                        let yAxisConfig = { type: 'value', min: 0, max: (scoreType === 'pct' ? 100 : maxExamTotal || undefined), scale: false, name: '卷面绝对分' };
                        let ttipFormatter = `{b}<br/>{a}: {c} 分`;

                        if (scoreType === 'std') { yName = 'T-标准分'; delete yAxisConfig.max; yAxisConfig.name = 'T-标准分 (基准50)'; ttipFormatter = `{b}<br/><span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:{color};"></span>{a}: {c}`; }
                        if (scoreType === 'pct') { yName = '得分率'; yAxisConfig.name = '得分率 (%)'; ttipFormatter = `{b}<br/><span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:{color};"></span>{a}: {c}%`; }
                        if (scoreType === 'ratio') { yName = '均分指数'; delete yAxisConfig.max; yAxisConfig.name = '均分指数 (基准100)'; ttipFormatter = `{b}<br/><span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:{color};"></span>{a}: {c}`; }

                        this._deferredChartSetOption(this.chartInstance, {
                            title: { text: `${useNormalizedX ? '各届纵向对比矩阵' : '多考次联考对比矩阵'} (${yName})`, left: 'center' },
                            tooltip: { trigger: 'axis', formatter: function(params) {
                                let res = `<b>${params[0].name}</b><br/>`;
                                params.forEach(p => {
                                    let unit = scoreType === 'pct' ? '%' : (scoreType==='raw'?' 分':'');
                                    res += `${p.marker} ${p.seriesName}: <span style="font-weight:bold; color:var(--text-main);">${p.value}</span>${unit}<br/>`;
                                });
                                return res;
                            } },
                            legend: { data: seriesData.map(s => s.name), bottom: 0 },
                            xAxis: { type: 'category', data: xAxisData, axisLabel: { interval: 0, rotate: 15 } },
                            yAxis: yAxisConfig,
                            series: seriesData
                        });

                        document.getElementById('analysis-table-area').style.display = 'flex';
                        let dimText = compareDim==='class' ? '校区及班级' : (compareDim==='grade' ? '年级' : '校区');
                        document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('trend')} 横跨追踪明细 <small style="color:var(--text-sub); font-weight:normal;">(对比维度：${dimText})</small>`;
                        
                        const thead = document.getElementById('thead-analysis');
                        const tbody = document.getElementById('tbody-analysis');
                        
                        let thHtml = `<tr><th style="z-index:var(--z-sticky); width:150px;">追踪实体 (${dimText})</th>`;
                        xAxisData.forEach(label => { thHtml += `<th>${Utils.escapeHTML(label)}</th>`; });
                        thHtml += `</tr>`;
                        thead.innerHTML = thHtml;
                        
                        let tbHtml = '';
                        tableData.forEach(row => {
                            tbHtml += `<tr><td style="font-weight:700; color:#1d1d1f;">${row.name}</td>`;
                            row.scores.forEach(s => {
                                tbHtml += `<td style="font-weight:600; color:var(--primary);">${s !== null ? s : '<span style="color:var(--line-strong);">-</span>'}</td>`;
                            });
                            tbHtml += `</tr>`;
                        });
                        tbody.innerHTML = tbHtml;
                        return;
                    }

                    // ====== 后续为单次特定考试分析 ======
                    if(!eid) return renderEmptyState("还没有选择考试", "您正在进行单次考试的分析。\n请先在上方选择一场考试。", type === 'radar' ? '' : undefined);
                    let validStudentsForExam = getValidStudentsForExam(exam);
                    const maxScore = exam.maxTotal;
                    
                    const msPanel = document.getElementById('ms-analysis-panel');
                    const checkedClasses = msPanel ? Array.from(msPanel.querySelectorAll('input:checked')).map(cb => cb.value.replace(/&quot;/g, '"')) : [];
                    if (checkedClasses.length > 0) {
                        validStudentsForExam = validStudentsForExam.filter(s => {
                            const sc = Utils.getClassForExam(s, exam);
                            return checkedClasses.includes(`${sc.campus} - ${sc.teachingClass}`);
                        });
                    }

                    const res = []; 
                    validStudentsForExam.forEach(s => {
                        const r = this.store.getScore(s.id, eid);
                        if (hasEnteredExamScore(r, exam)) res.push({...r, ...s, total: Number(r.total || 0), estimatedTotal: Number(r.estimatedTotal || 0), details: r.details || {}, questionCounts: r.questionCounts || {}, examId: r.examId, examAbsent: r.examAbsent, hasEnteredScore: true});
                    });

                    // ================= 新增: 成绩累计分布曲线 (放在 res 构建之后以确保数据可用) =================
                    if (type === 'cumulative') {
                        const totals = res.map(r => Number(r.total)).filter(v => isFinite(v) && v >= 0).sort((a,b)=>a-b);
                        if (!totals || totals.length === 0) {
                            return renderEmptyState('暂无成绩数据', '当前筛选范围内没有可用于生成累计分布的数据。');
                        }

                        // 使用去重的实际分数点作为 x 值，但改为直接把数据打包为 [score, percent] 的二维数组
                        const xPoints = [...new Set(totals)].sort((a,b)=>a-b);
                        const totalCount = totals.length;

                        const seriesPairs = xPoints.map(x => {
                            const cnt = totals.filter(v => v <= x).length;
                            const pct = parseFloat(((cnt / totalCount) * 100).toFixed(1));
                            return [x, pct];
                        });

                        // x 轴范围：最小分到满分（exam.maxTotal），确保数值轴覆盖完整刻度
                        const minScore = xPoints.length > 0 ? xPoints[0] : 0;
                        const maxScore = (exam && exam.maxTotal) ? exam.maxTotal : Math.max(...xPoints, 0);

                        document.getElementById('chart-wrapper-card').style.display = 'block';
                        this.chartInstance = echarts.init(document.getElementById('chart-main'));

                        const chartTitle = exam ? `【${Utils.escapeHTML(exam.name)}】成绩累计分布曲线 (看及格率/优秀率阈值)` : '成绩累计分布曲线';
                        this._deferredChartSetOption(this.chartInstance, {
                            title: { text: chartTitle, left: 'center' },
                            tooltip: {
                                trigger: 'item',
                                formatter: function(param) {
                                    const d = param && param.data ? param.data : null;
                                    if (!d) return '';
                                    return `分数: ${d[0]} 分，累计包含全班 ${d[1]}% 的学生`;
                                }
                            },
                            xAxis: { type: 'value', name: '分数', min: minScore, max: maxScore },
                            yAxis: { type: 'value', min: 0, max: 100, name: '累计百分比 (%)' },
                            series: [{
                                name: '累计覆盖率',
                                type: 'line',
                                smooth: true,
                                // 使用二维数组 [score, percent]
                                data: seriesPairs,
                                encode: { x: 0, y: 1 },
                                areaStyle: { color: 'rgba(0,113,227,0.12)' },
                                lineStyle: { color: '#0071e3', width: 2 },
                                symbol: 'none'
                            }]
                        });

                        document.getElementById('analysis-table-area').style.display = 'flex';
                        const thead = document.getElementById('thead-analysis');
                        const tbody = document.getElementById('tbody-analysis');
                        thead.innerHTML = `<tr><th style="z-index:var(--z-sticky); width:200px;">分数</th><th>累计覆盖率 (%)</th></tr>`;
                        tbody.innerHTML = seriesPairs.map(([x, p]) => `<tr><td style="font-weight:600;">${x}</td><td>${p}%</td></tr>`).join('');

                        return;
                    }

                        // ================= 新增: 题型得分率热力图 =================
                        if (type === 'heatmap') {
                            // 准备数据：使用 res 中的学生与每题得分
                            // 按总分从高到低排序（descending），并明确使用该顺序作为 y 轴从上到下的显示顺序
                            const students = res.slice().sort((a,b) => (b.total || 0) - (a.total || 0));
                            if (!students || students.length === 0) {
                                return renderEmptyState('暂无成绩数据', '当前筛选范围内没有可用于生成热力图的数据。');
                            }

                            const typeList = (exam && Array.isArray(exam.types)) ? exam.types : [];
                            if (!typeList.length) {
                                return renderEmptyState('题型信息缺失', '当前考试未包含题型信息，热力图无法生成。');
                            }

                            const xAxisNames = typeList.map(t => Utils.escapeHTML(t.name));
                            // yAxisNames 顺序与 students 保持一致（students[0] 应为最高分，显示在顶部）
                            const yAxisNames = students.map(s => Utils.escapeHTML(s.name));

                            // 构建 heatmap 格式的数据 [xIndex, yIndex, value]
                            const heatData = [];
                            students.forEach((stu, yIdx) => {
                                const details = stu.details || {};
                                typeList.forEach((t, xIdx) => {
                                    const raw = details[t.name];
                                    const got = Number(raw);
                                    const score = isFinite(got) ? got : 0;
                                    const maxForType = (t && (t.max || t.maxScore || t.full || t.fullScore)) ? (t.max || t.maxScore || t.full || t.fullScore) : 0;
                                    const pct = maxForType > 0 ? parseFloat(((score / maxForType) * 100).toFixed(1)) : 0;
                                    heatData.push([xIdx, yIdx, pct]);
                                });
                            });

                            const chartEl = document.getElementById('chart-main');
                            chartEl.style.height = '';
                            chartEl.style.minHeight = '';
                            chartEl.style.display = 'block';

                            // 计算 dataZoom 初始 end 值以显示约 15 条学生记录（若学生较少则显示全部）
                            const visibleCount = 15;
                            const endPercent = students.length <= visibleCount ? 100 : Math.round((visibleCount / students.length) * 100);

                            const heatmapChartCard = document.getElementById('chart-wrapper-card');
                            heatmapChartCard.style.display = 'block';
                            heatmapChartCard.style.minHeight = '';
                            heatmapChartCard.querySelectorAll('.heatmap-page-actions').forEach(el => el.remove());
                            heatmapChartCard.insertAdjacentHTML('afterbegin', `
                                <div class="heatmap-page-actions">
                                    <button type="button" class="secondary" onclick="window.app.ui.switchHeatmapDetailPage('table')">查看题型得分率明细 →</button>
                                </div>
                            `);
                            this.chartInstance = echarts.init(chartEl);

                            this._deferredChartSetOption(this.chartInstance, {
                                title: { show: false },
                                tooltip: {
                                    formatter: function (params) {
                                        const xIdx = params.value[0];
                                        const yIdx = params.value[1];
                                        const val = params.value[2];
                                        const tName = xAxisNames[xIdx] || params.name || xIdx;
                                        const sName = yAxisNames[yIdx] || yIdx;
                                        return `学生: ${sName}, 题型: ${tName}, 得分率: ${val}%`;
                                    }
                                },
                                grid: { left: '120', right: 100, top: 54, bottom: 60 },
                                dataZoom: [
                                    {
                                        type: 'slider',
                                        yAxisIndex: 0,
                                        orient: 'vertical',
                                        right: 12,
                                        start: 0,
                                        end: endPercent
                                    }
                                ],
                                // 将横坐标放在图表顶端（标题下方一侧）
                                xAxis: { position: 'top', type: 'category', data: xAxisNames, name: '题型', axisLabel: { interval: 0, rotate: 30 } },
                                // 保证 y 轴从上到下按 students 的顺序（已按总分降序排列）显示
                                yAxis: { type: 'category', data: yAxisNames, name: '学生', axisLabel: { interval: 0 }, inverse: true },
                                visualMap: {
                                    type: 'piecewise',
                                    dimension: 2,
                                    pieces: [
                                        { min: 85, max: 100, color: '#176b34', label: '85-100' },
                                        { min: 70, max: 85, color: '#bce8c8', label: '70-85' },
                                        { min: 55, max: 70, color: '#fff2d4', label: '55-70' },
                                        { min: 40, max: 55, color: '#f4ae56', label: '40-55' },
                                        { min: 0,  max: 40, color: '#d70015', label: '<40' }
                                    ],
                                    orient: 'horizontal',
                                    bottom: 10,
                                    left: 'center',
                                    itemWidth: 40,
                                    itemHeight: 12,
                                    textStyle: { fontSize: 12 }
                                },
                                series: [{
                                    name: '得分率',
                                    type: 'heatmap',
                                    data: heatData,
                                    label: { show: false },
                                    itemStyle: { borderColor: '#e5e7eb', borderWidth: 1 },
                                    emphasis: { itemStyle: { borderColor: '#000', borderWidth: 1 } }
                                }]
                            });
                            requestAnimationFrame(() => requestAnimationFrame(() => {
                                try { if (this.chartInstance) this.chartInstance.resize(); } catch(e) {}
                            }));

                            // 同步显示明细表（复用现有明细渲染）
                            this.analysisCache = { exam, pool: res.filter(r=>Utils.isActualScore(r)), prevRanks: {}, sortCol: 'total', sortAsc: false };
                            const heatmapTableArea = document.getElementById('analysis-table-area');
                            heatmapTableArea.style.display = 'none';
                            heatmapTableArea.classList.remove('heatmap-table-page');
                            document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('flame')} 题型得分率明细 <small style="color:var(--text-sub); font-weight:normal;">(表格列可排序)</small><button type="button" class="secondary heatmap-table-back" onclick="window.app.ui.switchHeatmapDetailPage('chart')">← 返回热力图</button>` +
                                `<span style="margin-left:12px; font-size:12px; color:var(--text-sub); display:inline-flex; gap:8px; align-items:center;">
                                    <span class="diag-dot diag-pianke" title="偏科警告"></span><span style="margin-right:6px;">偏科</span>
                                    <span class="diag-dot diag-improved" title="进步明显"></span><span style="margin-right:6px;">进步</span>
                                    <span class="diag-dot diag-near-pass" title="差一点就及格"></span><span style="margin-right:6px;">差一点及格</span>
                                    <span class="diag-dot diag-near-excellent" title="差一点就优秀"></span><span>差一点优秀</span>
                                </span>`;
                            this.renderAnalysisTableRows();
                            this.switchHeatmapDetailPage('chart');
                            return;
                        }

                    // V43: New Target needs estimatedTotal check as well
                    if (type === 'target') {
                        validStudentsForExam.forEach(s => {
                            const scores = this.store.state.data.scores.filter(i => i.studentId === s.id && i.examId === eid && i.estimatedTotal > 0 && !i.examAbsent);
                            if (scores.length > 0) {
                                const latest = scores.sort((a,b)=> (b._ts||0) - (a._ts||0))[0];
                                const existing = res.find(x => x.id === s.id);
                                if(existing) {
                                    existing.estimatedTotal = latest.estimatedTotal;
                                    existing.total = Number(latest.total || existing.total || 0);
                                    existing.details = latest.details || existing.details || {};
                                    existing.examId = latest.examId;
                                } else {
                                    res.push({...s, total: Number(latest.total || 0), estimatedTotal: Number(latest.estimatedTotal || 0), details: latest.details || {}, questionCounts: latest.questionCounts || {}, examId: latest.examId, examAbsent: false, hasEnteredScore: hasEnteredExamScore(latest, exam)});
                                }
                            }
                        });
                    }

                    if(!res.length) {
                        const radarEmptyAction = type === 'radar' ? '' : undefined;
                        return renderEmptyState("未录入成绩", "您关注的班级在这场考试中，目前还没有录入任何成绩。", radarEmptyAction);
                    }
                    // ================= 核心修复：点亮常驻的极简数据模块 =================
                    const allValidScores = res.filter(r=>r.hasEnteredScore !== false).map(i=>Number(i.total)).filter(Number.isFinite);
                    const overallAvgNum = allValidScores.length > 0 ? parseFloat((allValidScores.reduce((a,b)=>a+b,0)/allValidScores.length).toFixed(1)) : null;
                    if (compactStats && type !== 'trend' && type !== 'compare') {
                        compactStats.style.display = 'flex';
                        this.updateCompactStatValue('st-max', maxScore);
                        this.updateCompactStatValue('st-avg', overallAvgNum === null ? '—' : overallAvgNum);
                        this.updateCompactStatValue('st-pass', allValidScores.length > 0 ? (res.filter(i=>i.hasEnteredScore !== false && i.total >= maxScore*0.6).length/allValidScores.length*100).toFixed(1)+'%' : '—');
                        this.updateCompactStatValue('st-exc', allValidScores.length > 0 ? (res.filter(i=>i.hasEnteredScore !== false && i.total >= maxScore*0.8).length/allValidScores.length*100).toFixed(1)+'%' : '—');
                        
                        const sortedScoresForMedian = [...allValidScores].sort((a, b) => a - b);
                        this.updateCompactStatValue('st-med', sortedScoresForMedian.length > 0 ? (sortedScoresForMedian.length % 2 !== 0 ? sortedScoresForMedian[Math.floor(sortedScoresForMedian.length / 2)] : parseFloat(((sortedScoresForMedian[Math.floor(sortedScoresForMedian.length / 2) - 1] + sortedScoresForMedian[Math.floor(sortedScoresForMedian.length / 2)]) / 2).toFixed(1))) : '—');

                        let stdDevVal = null;
                        if (allValidScores.length > 0) {
                            const meanForStd = overallAvgNum;
                            const varianceForStd = allValidScores.reduce((a, b) => a + Math.pow(b - meanForStd, 2), 0) / allValidScores.length;
                            stdDevVal = parseFloat(Math.sqrt(varianceForStd).toFixed(1));
                        }
                        this.updateCompactStatValue('st-std', stdDevVal === null ? '—' : stdDevVal);

                        let targetAchieved = 0, targetTotal = 0;
                        res.forEach(r => {
                            if (r.hasEnteredScore !== false && r.estimatedTotal > 0) {
                                targetTotal++;
                                if ((r.total || 0) >= r.estimatedTotal) targetAchieved++;
                            }
                        });
                        this.updateCompactStatValue('st-tgt-tot', targetTotal || '—');
                        this.updateCompactStatValue('st-tgt-ach', targetTotal ? targetAchieved : '—');
                        this.updateCompactStatValue('st-tgt-rate', targetTotal > 0 ? ((targetAchieved / targetTotal) * 100).toFixed(1) + '%' : '—');
                        this.updateCompactStatValue('st-tgt-mis', targetTotal ? targetTotal - targetAchieved : '—');
                    }

                    // ================= V43 新增：目标达成情况 (Target) =================
                    if (type === 'target') {
                        chartCard.style.display = 'none';  // 目标达成不需要图表

                        // 筛选有预估分的学生
                        const targetRes = res.filter(r => r.estimatedTotal > 0).sort((a, b) => {
                            if (a.hasEnteredScore !== b.hasEnteredScore) return a.hasEnteredScore ? -1 : 1;
                            if (!a.hasEnteredScore) return b.estimatedTotal - a.estimatedTotal;
                            const aGap = (a.estimatedTotal - (a.total || 0));
                            const bGap = (b.estimatedTotal - (b.total || 0));
                            return bGap - aGap;  // 按差距从大到小排序
                        });

                        if (targetRes.length === 0) {
                            return renderEmptyState("未设置目标", "当前班级还未录入任何预估/目标分数，无法进行目标达成评估。请先在成绩录入页面填写预估分。");
                        }

                        document.getElementById('analysis-table-area').style.display = 'flex';
                        this._setAnalysisTableFillMode(true, true);
                        document.getElementById('table-analysis')?.setAttribute('aria-label', `已设置目标分数的学生成绩表，共 ${targetRes.length} 名学生`);
                        
                        const thead = document.getElementById('thead-analysis');
                        const tbody = document.getElementById('tbody-analysis');
                        
                        thead.innerHTML = `<tr>
                            <th style="z-index:var(--z-sticky); width:80px;">姓名</th>
                            <th style="z-index:var(--z-sticky); width:100px;">校区</th>
                            <th style="z-index:var(--z-sticky); width:100px;">班级</th>
                            <th style="z-index:var(--z-sticky); width:80px;">当前成绩</th>
                            <th style="z-index:var(--z-sticky); width:80px;">目标分数</th>
                            <th style="z-index:var(--z-sticky); width:100px;">差距</th>
                            <th style="z-index:var(--z-sticky); width:80px;">完成度</th>
                            <th style="z-index:var(--z-sticky); width:120px;">达成状态</th>
                        </tr>`;
                        
                        let tbHtml = '';
                        
                        targetRes.forEach((stu) => {
                            const hasEnteredScore = stu.hasEnteredScore !== false;
                            const current = hasEnteredScore ? Number(stu.total || 0) : null;
                            const target = stu.estimatedTotal;
                            const gap = hasEnteredScore ? parseFloat((current - target).toFixed(1)) : null;
                            const remainingGap = hasEnteredScore ? target - current : null;
                            const completionRate = hasEnteredScore && target > 0 ? ((current / target) * 100).toFixed(1) : null;
                            const achieved = hasEnteredScore && current >= target;
                            const needsEffort = hasEnteredScore && remainingGap > 5;
                            
                            const statusColor = !hasEnteredScore ? 'var(--text-sub)' : (achieved ? '#1f7a35' : (needsEffort ? '#d70015' : '#9a6700'));
                            const statusText = !hasEnteredScore ? '未录入' : (achieved ? `${window.gk2IconMarkup('check')} 已达成` : (needsEffort ? `${window.gk2IconMarkup('alert')} 需努力` : `${window.gk2IconMarkup('spark')} 即将达成`));
                            const bgColor = !hasEnteredScore ? 'transparent' : (achieved ? 'var(--success-soft)' : (needsEffort ? 'var(--danger-soft)' : 'var(--warning-soft)'));
                            
                            tbHtml += `<tr data-profile-student-id="${Utils.escapeHTML(stu.id)}" style="background:${bgColor};">
                                <td style="font-weight:bold;"><a href="#" onclick="event.preventDefault(); window.app.ui.openStudentProfile('${stu.id}', this)" style="cursor:pointer; text-decoration:underline; color:var(--primary);">${Utils.escapeHTML(stu.name)}</a></td>
                                <td style="color:var(--text-sub);">${Utils.escapeHTML(stu.campus)}</td>
                                <td style="color:var(--text-sub);">${Utils.escapeHTML(Utils.getClassForExam(stu, exam).teachingClass || stu.teachingClass || '-')}</td>
                                <td style="font-weight:bold; font-size:15px;">${hasEnteredScore ? current : '<span style="color:var(--text-sub); font-weight:500;">未录入</span>'}</td>
                                <td style="font-weight:bold; font-size:15px; color:var(--primary);">${target}</td>
                                <td style="color:${!hasEnteredScore ? 'var(--text-sub)' : (gap < 0 ? '#d70015' : (gap > 0 ? '#1f7a35' : '#6e6e73'))}; font-weight:bold;">${hasEnteredScore ? `${gap > 0 ? '+' : ''}${gap}` : '未录入'}</td>
                                <td style="font-weight:bold; color:${statusColor};">${hasEnteredScore ? `${completionRate}%` : '未录入'}</td>
                                <td style="color:${statusColor}; font-weight:bold;"><span class="gk2-target-status-label">${statusText}</span></td>
                            </tr>`;
                        });
                        
                        tbody.innerHTML = tbHtml;
                        
                       
                        
                        return;
                    }

                    chartCard.style.display = 'block';

                    // ================= V43 新增：题型失分分析 (Weakness) =================
                    if (type === 'weakness') {
                        if (!exam.types || exam.types.length === 0) {
                            return renderEmptyState('暂无题型数据', '该考试未设置题型信息，无法进行题型失分分析。');
                        }
                        this.chartInstance = echarts.init(document.getElementById('chart-main'));
                        
                        const typeRates = [];
                        (exam.types || []).forEach(t => {
                            let sum = 0;
                            let count = 0;
                            res.forEach(r => {
                                if (Utils.isActualScore(r, exam) && r.details && r.details[t.name] !== undefined) {
                                    sum += Number(r.details[t.name]) || 0;
                                    count++;
                                }
                            });
                            const avg = count > 0 ? sum / count : 0;
                            const rate = t.max > 0 ? (avg / t.max) * 100 : 0;
                            typeRates.push({ name: t.name, rate: parseFloat(rate.toFixed(1)), max: t.max, avg: parseFloat(avg.toFixed(1)) });
                        });

                        // ECharts horizontal bar renders bottom up, so to put the lowest at top natively, 
                        // we sort ascending, and ECharts does the rest automatically if inverse is set, 
                        // but actually sorting ascending and setting inverse: true is the best.
                        typeRates.sort((a,b) => a.rate - b.rate);

                        const yData = typeRates.map(t => t.name);
                        const sData = typeRates.map(t => t.rate);

                        this._deferredChartSetOption(this.chartInstance, {
                            title: { text: `【${exam.name}】题型得分率横评诊断`, subtext: '一眼看出班级薄弱模块 (得分率越低越靠前)', left: 'center' },
                            tooltip: { formatter: (p) => {
                                const t = typeRates[p.dataIndex];
                                return `<b>${t.name}</b><br/>班级均分: ${t.avg} / ${t.max}<br/>平均得分率: <b style="color:${p.color}">${t.rate}%</b>`;
                            } },
                            xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
                            yAxis: { type: 'category', data: yData, inverse: true },
                            series: [{
                                type: 'bar',
                                data: sData,
                                label: { show: true, position: 'right', formatter: '{c}%' },
                                itemStyle: {
                                    color: (params) => {
                                        const v = params.value;
                                        if (v < 60) return '#d70015'; // Red
                                        if (v <= 80) return '#ffcc00'; // Yellow
                                        return '#1f7a35'; // Green
                                    },
                                    borderRadius: [0, 4, 4, 0]
                                }
                            }]
                        });
                        return;
                    }

                    // ================= V43 新增：临界生重点关注 (Borderline) =================
                    if (type === 'borderline') {
                        // 临界生定义：成绩在及格线附近 (50%-70% 区间) 的学生
                        const passLine = maxScore * 0.6;
                        const upperLine = maxScore * 0.7;
                        const lowerLine = maxScore * 0.5;

                        const borderlineStudents = res.filter(r => r.total >= lowerLine && r.total < upperLine).sort((a, b) => b.total - a.total);

                        if (borderlineStudents.length === 0) {
                            return renderEmptyState("未发现临界生", "当前班级没有成绩在50%-70%区间的临界生，说明成绩两极分化严重或整体较强。");
                        }

                        document.getElementById('analysis-table-area').style.display = 'flex';
                        this._setAnalysisTableFillMode(true, true);
                        document.getElementById('table-analysis')?.setAttribute('aria-label', `成绩在 ${lowerLine.toFixed(0)} 至 ${upperLine.toFixed(0)} 分之间的临界学生，共 ${borderlineStudents.length} 人`);
                        
                        const thead = document.getElementById('thead-analysis');
                        const tbody = document.getElementById('tbody-analysis');
                        
                        thead.innerHTML = `<tr>
                            <th style="z-index:var(--z-sticky); width:60px;">排名</th>
                            <th style="z-index:var(--z-sticky); width:100px;">姓名</th>
                            <th style="z-index:var(--z-sticky); width:100px;">校区</th>
                            <th style="z-index:var(--z-sticky); width:100px;">班级</th>
                            <th style="z-index:var(--z-sticky); width:80px;">总分</th>
                            <th style="z-index:var(--z-sticky); width:80px;">距及格线</th>
                            <th style="z-index:var(--z-sticky); width:120px;">离及格差距</th>
                            <th style="z-index:var(--z-sticky);">各题型得分</th>
                        </tr>`;
                        
                        let tbHtml = '';
                        borderlineStudents.forEach((stu, idx) => {
                            const gapToPassing = (passLine - stu.total).toFixed(1);
                            const gapPercentage = maxScore > 0 ? ((gapToPassing / maxScore) * 100).toFixed(1) : '0';
                            
                            let typeDetailsHtml = '';
                            if (exam.types && exam.types.length > 0) {
                                exam.types.forEach(t => {
                                    const stuScore = stu.details?.[t.name] || 0;
                                    const ratio = t.max > 0 ? ((stuScore / t.max) * 100).toFixed(0) : '0';
                                    typeDetailsHtml += `<span style="margin-right:8px; padding:4px 8px; background:#f2f2f5; border-radius:4px; font-size:12px;">${t.name}: ${stuScore}/${t.max} (${ratio}%)</span>`;
                                });
                            }
                            
                            const bgColor = stu.total < passLine ? 'var(--danger-soft)' : 'var(--warning-soft)';
                            const borderColor = stu.total < passLine ? 'rgba(215,0,21,0.22)' : 'rgba(255,159,10,0.22)';
                            
                            tbHtml += `<tr data-profile-student-id="${Utils.escapeHTML(stu.id)}" style="background:${bgColor}; border-left: 4px solid ${borderColor};">
                                <td style="font-weight:bold; text-align:center;">${idx + 1}</td>
                                <td style="font-weight:bold; color:var(--score-fail);"><a href="#" onclick="event.preventDefault(); window.app.ui.openStudentProfile('${stu.id}', this)" style="cursor:pointer; text-decoration:underline;">${Utils.escapeHTML(stu.name)}</a></td>
                                <td style="color:var(--text-sub);">${Utils.escapeHTML(stu.campus)}</td>
                                <td style="color:var(--text-sub);">${Utils.escapeHTML(Utils.getClassForExam(stu, exam).teachingClass || stu.teachingClass || '-')}</td>
                                <td style="font-weight:bold; font-size:15px; color:${stu.total < passLine ? 'var(--score-fail)' : 'var(--score-pass)'}">${stu.total}</td>
                                <td style="color:${stu.total < passLine ? 'var(--score-fail)' : 'var(--score-pass)'}; font-weight:bold;">${gapToPassing}</td>
                                <td style="color:var(--text-sub);">${gapPercentage}% (${gapToPassing}分)</td>
                                <td>${typeDetailsHtml}</td>
                            </tr>`;
                        });
                        tbody.innerHTML = tbHtml;
                        return;
                    }

                    // ================= V43 新增：分段统计模型 (Segment) =================
                    if (type === 'segment') {
                        this.chartInstance = echarts.init(document.getElementById('chart-main'));
                        
                        const thresholds = {
                            exc: { label: '优秀 (≥80%)', count: 0, color: '#0071e3', min: maxScore, max: 0, sum: 0, students: [] },
                            good: { label: '良好 (60-80%)', count: 0, color: '#1f7a35', min: maxScore, max: 0, sum: 0, students: [] },
                            fair: { label: '待提高 (40-60%)', count: 0, color: '#ffcc00', min: maxScore, max: 0, sum: 0, students: [] },
                            poor: { label: '困难 (<40%)', count: 0, color: '#d70015', min: maxScore, max: 0, sum: 0, students: [] }
                        };

                        const validScores = res.filter(r => Utils.isActualScore(r, exam)).map(r => r.total);
                        if (validScores.length === 0) return renderEmptyState('暂无分数数据', '无法进行分段统计');

                        res.filter(r => Utils.isActualScore(r, exam)).forEach(r => {
                            const v = r.total;
                            const pct = maxScore > 0 ? (v / maxScore) : 0;
                            let target;
                            if (pct >= 0.8) target = thresholds.exc;
                            else if (pct >= 0.6) target = thresholds.good;
                            else if (pct >= 0.4) target = thresholds.fair;
                            else target = thresholds.poor;

                            target.count++;
                            target.sum += v;
                            target.students.push(r);
                            if (v > target.max) target.max = v;
                            if (v < target.min) target.min = v;
                        });

                        // 按分数降序排列各分段内的学生
                        Object.keys(thresholds).forEach(k => {
                            thresholds[k].students.sort((a, b) => b.total - a.total);
                        });

                        const pieData = [
                            { value: thresholds.exc.count, name: thresholds.exc.label, itemStyle: { color: thresholds.exc.color } },
                            { value: thresholds.good.count, name: thresholds.good.label, itemStyle: { color: thresholds.good.color } },
                            { value: thresholds.fair.count, name: thresholds.fair.label, itemStyle: { color: thresholds.fair.color } },
                            { value: thresholds.poor.count, name: thresholds.poor.label, itemStyle: { color: thresholds.poor.color } }
                        ].filter(d => d.value > 0);

                        // 保存分段数据以供点击时使用
                        this.segmentThresholds = thresholds;
                        this.segmentExam = exam;
                        this.segmentMaxScore = maxScore;

                        const chartOption = {
                            title: { text: `【${exam.name}】梯队分布图`, subtext: `满分基准: ${maxScore} 分 (点击分段查看该组学生)`, left: 'center', top: 15, textStyle: { fontSize: 16 }, subtextStyle: { fontSize: 12, lineHeight: 20 } },
                            tooltip: { trigger: 'item', formatter: '{b} : {c}人 ({d}%)' },
                            legend: { bottom: 0 },
                            series: [{ 
                                type: 'pie', 
                                center: ['50%', '52%'],
                                radius: ['30%', '55%'], 
                                avoidLabelOverlap: false, 
                                itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 }, 
                                label: { show: true, formatter: '{b}: {c}人 ({d}%)', fontSize: 11, edgeDistance: 10 }, 
                                labelLayout: { hideOverlap: true }, 
                                data: pieData 
                            }]
                        };

                        this.chartInstance.setOption(chartOption);

                        // 为图表添加点击事件
                        this.chartInstance.off('click');
                        this.chartInstance.on('click', (params) => {
                            if (params.componentSubType === 'pie') {
                                const segmentName = params.name;
                                let segmentKey = null;
                                
                                if (segmentName.includes('优秀')) segmentKey = 'exc';
                                else if (segmentName.includes('良好')) segmentKey = 'good';
                                else if (segmentName.includes('待提高')) segmentKey = 'fair';
                                else if (segmentName.includes('困难')) segmentKey = 'poor';

                                if (segmentKey && this.segmentThresholds[segmentKey].students.length > 0) {
                                    this._displaySegmentStudents(segmentKey, this.segmentThresholds, this.segmentExam, this.segmentMaxScore);
                                }
                            }
                        });

                        document.getElementById('analysis-table-area').style.display = 'flex';
                        document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('chart')} 分段统计概览 <small style="color:var(--text-sub); font-weight:normal;">(点击饼图的分段可查看该组学生详情)</small>`;
                        
                        const thead = document.getElementById('thead-analysis');
                        const tbody = document.getElementById('tbody-analysis');
                        
                        thead.innerHTML = `<tr><th style="z-index:var(--z-sticky);">分数梯队</th><th style="z-index:var(--z-sticky);">分段标准</th><th style="z-index:var(--z-sticky);">覆盖人数</th><th style="z-index:var(--z-sticky);">总体占比</th><th style="z-index:var(--z-sticky);">该段最高分</th><th style="z-index:var(--z-sticky);">该段最低分</th><th style="z-index:var(--z-sticky);">该段平均分</th></tr>`;
                        
                        let tbHtml = '';
                        Object.keys(thresholds).forEach(k => {
                            const t = thresholds[k];
                            if (t.count > 0) {
                                const avg = (t.sum / t.count).toFixed(1);
                                const pct = ((t.count / validScores.length) * 100).toFixed(1);
                                tbHtml += `<tr style="cursor:pointer; background:rgba(${t.color === '#0071e3' ? '0, 113, 227' : t.color === '#1f7a35' ? '31, 122, 53' : t.color === '#ffcc00' ? '255, 204, 0' : '215, 0, 21'}, 0.1);" onclick="window.app.ui._displaySegmentStudents('${k}', window.app.ui.segmentThresholds, window.app.ui.segmentExam, window.app.ui.segmentMaxScore)">
                                    <td style="font-weight:bold; color:${k === 'fair' ? 'var(--score-pass)' : t.color};">${t.label.split(' ')[0]}</td>
                                    <td style="color:var(--text-sub);">${t.label.split(' ')[1]}</td>
                                    <td style="font-weight:bold;">${t.count}</td>
                                    <td>${pct}%</td>
                                    <td style="color:var(--primary);">${t.max}</td>
                                    <td style="color:var(--danger);">${t.min}</td>
                                    <td style="font-weight:bold;">${avg}</td>
                                </tr>`;
                            }
                        });
                        tbody.innerHTML = tbHtml;
                        return;
                    }

                    // ================= 5. 单科雷达 =================
                    if (type === 'radar') {
                        this._clearAnalysisSkeleton();
                        const radarTypes = (exam.types || []).filter(t => t && t.name);
                        if (radarTypes.length === 0) {
                            return renderEmptyState('暂无题型数据', '该考试未设置题型信息，无法生成雷达图。', '');
                        }
                        const radarWrap = document.getElementById('chart-wrapper-card');
                        if (radarWrap) radarWrap.style.display = 'block';
                        if (!radarWrap) return renderEmptyState('图表容器异常', '当前图表容器未能正确初始化，请重新切换一次分析视图。', '');

                        const studentById = new Map(this.store.state.data.students.map(student => [student.id, student]));
                        const examCampuses = this._getExamCampuses(exam);
                        const gradeScores = this.store.state.data.scores.filter(score => {
                            if (score.examId !== exam.id || !Utils.isActualScore(score, exam)) return false;
                            const stu = studentById.get(score.studentId);
                            if (!stu || stu.grade !== exam.grade) return false;
                            const classAtExam = Utils.getClassForExam(stu, exam);
                            const campusAtExam = classAtExam.campus || stu.campus;
                            if (examCampuses.length > 0 && !examCampuses.includes(campusAtExam)) return false;
                            if (focus.campuses.length > 0 && !focus.campuses.includes(campusAtExam)) return false;
                            if (focus.tags && focus.tags.length > 0) {
                                const tags = stu.tags || [];
                                if (!tags.some(t => focus.tags.includes(t))) return false;
                            }
                            return true;
                        });
                        const gradeAvgValues = radarTypes.map(t => {
                            if (!gradeScores.length || !(t.max > 0)) return 0;
                            const sum = gradeScores.reduce((acc, score) => acc + Number((score.details || {})[t.name] || 0), 0);
                            return parseFloat((((sum / gradeScores.length) / t.max) * 100).toFixed(1));
                        });

                        const classGroups = new Map();
                        res.forEach(student => {
                            const classAtExam = Utils.getClassForExam(student, exam);
                            const campus = String(classAtExam.campus || student.campus || '').trim();
                            const className = String(classAtExam.teachingClass || student.teachingClass || '未分班').trim();
                            const key = `${campus}\u0000${className}`;
                            if (!classGroups.has(key)) classGroups.set(key, { campus, className, students: [] });
                            classGroups.get(key).students.push(student);
                        });
                        const orderedGroups = [...classGroups.values()].sort((a, b) =>
                            `${a.campus} ${a.className}`.localeCompare(`${b.campus} ${b.className}`, 'zh-CN', { numeric: true })
                        );
                        const angles = radarTypes.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index / radarTypes.length));
                        const cx = 200, cy = 170, radius = 140;
                        const makeRadarPoints = values => angles.map((angle, index) => {
                            const percent = Math.max(0, Math.min(100, Number(values[index]) || 0));
                            const pointRadius = radius * percent / 100;
                            return `${(cx + Math.cos(angle) * pointRadius).toFixed(1)},${(cy + Math.sin(angle) * pointRadius).toFixed(1)}`;
                        }).join(' ');
                        const radarRingPoints = level => angles.map(angle =>
                            `${(cx + Math.cos(angle) * radius * level).toFixed(1)},${(cy + Math.sin(angle) * radius * level).toFixed(1)}`
                        ).join(' ');
                        const axisMarkup = angles.map(angle =>
                            `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(angle) * radius).toFixed(1)}" y2="${(cy + Math.sin(angle) * radius).toFixed(1)}" />`
                        ).join('');
                        const groupMarkup = orderedGroups.map((group, groupIndex) => {
                            const groupTitle = group.campus ? `${group.campus} · ${group.className}` : group.className;
                            const studentMarkup = group.students.map((student, radarIndex) => {
                                const values = radarTypes.map(t => {
                                    const score = Number((student.details || {})[t.name] || 0);
                                    return t.max > 0 ? Number(((score / t.max) * 100).toFixed(1)) : 0;
                                });
                                const hasTypeScore = radarTypes.map(t => {
                                    const raw = (student.details || {})[t.name];
                                    return raw !== undefined && raw !== null && String(raw).trim() !== '' && Number.isFinite(Number(raw));
                                });
                                const labelMarkup = radarTypes.map((typeInfo, index) => {
                                    const angle = angles[index];
                                    const fullName = String(typeInfo.name);
                                    const shortName = fullName.length > 3 ? `${fullName.slice(0, 2)}…` : fullName;
                                    const x = cx + Math.cos(angle) * 148;
                                    const y = cy + Math.sin(angle) * 148;
                                    const anchor = Math.cos(angle) > .28 ? 'start' : Math.cos(angle) < -.28 ? 'end' : 'middle';
                                    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle">${Utils.escapeHTML(shortName)}</text>`;
                                }).join('');
                                const pointMarkup = angles.map((angle, index) => {
                                    if (!hasTypeScore[index]) return '';
                                    const percent = Math.max(0, Math.min(100, Number(values[index]) || 0));
                                    const pointRadius = radius * percent / 100;
                                    return `<circle cx="${(cx + Math.cos(angle) * pointRadius).toFixed(1)}" cy="${(cy + Math.sin(angle) * pointRadius).toFixed(1)}" r="4.4" />`;
                                }).join('');
                                const safeName = Utils.escapeHTML(student.name || '未命名学生');
                                const total = Number(student.total) || 0;
                                const totalText = Number.isInteger(total) ? String(total) : total.toFixed(1);
                                const rateText = maxScore > 0 ? `${((total / maxScore) * 100).toFixed(1)}%` : '—';
                                const detailText = radarTypes.map((t, index) => `${t.name} ${hasTypeScore[index] ? `${values[index]}%` : '未录入'}`).join('，');
                                const chartTitle = Utils.escapeHTML(`${student.name || '未命名学生'} · ${detailText}`);
                                const radarTooltipData = Utils.escapeHTML(JSON.stringify(radarTypes.map((t, index) => ({
                                    name: t.name,
                                    studentRate: hasTypeScore[index] ? values[index] : null,
                                    gradeRate: gradeAvgValues[index]
                                }))));
                                return `<article class="gk2-student-radar-card" style="--radar-delay:${(radarIndex % 12) * 14}ms">
                                    <div class="gk2-student-radar-card__info">
                                        <div class="gk2-student-radar-card__head"><strong title="${safeName}">${safeName}</strong></div>
                                        <div class="gk2-student-radar-card__sub"><div><span>总分</span><b>${totalText}</b></div><span>得分率 ${rateText}</span></div>
                                    </div>
                                    <div class="gk2-student-radar-plot">
                                    <svg class="gk2-student-radar-svg" viewBox="-16 -14 432 368" role="img" tabindex="0" data-radar-student="${safeName}" data-radar-tooltip="${radarTooltipData}" aria-describedby="gk2-radar-hovercard" aria-label="${chartTitle}">
                                        <g class="gk2-radar-grid-lines">
                                            <polygon points="${radarRingPoints(1)}" />
                                            <polygon points="${radarRingPoints(.75)}" />
                                            <polygon points="${radarRingPoints(.5)}" />
                                            <polygon points="${radarRingPoints(.25)}" />
                                            ${axisMarkup}
                                        </g>
                                        <polygon class="gk2-radar-grade" points="${makeRadarPoints(gradeAvgValues)}"></polygon>
                                        <polygon class="gk2-radar-student" points="${makeRadarPoints(values)}"></polygon>
                                        <g class="gk2-radar-student-points">${pointMarkup}</g>
                                        <g class="gk2-radar-axis-labels">${labelMarkup}</g>
                                    </svg>
                                    </div>
                                </article>`;
                            }).join('');
                            return `<section class="gk2-radar-class-group">
                                <header class="gk2-radar-class-heading"><h3>${Utils.escapeHTML(groupTitle)}</h3><span>${group.students.length} 名学生</span>${groupIndex === 0 ? `<div class="gk2-radar-legend"><span><i class="is-personal"></i>个人得分率</span><span><i class="is-grade"></i>年级均分</span></div>` : ''}</header>
                                <div class="gk2-student-radar-grid">${studentMarkup}</div>
                            </section>`;
                        }).join('');

                        radarWrap.innerHTML = `<div class="gk2-radar-class-list">${groupMarkup}</div>`;
                        return; 
                    }

                    

                    this.chartInstance = echarts.init(document.getElementById('chart-main'));

                    if(type === 'dist') {
                        const p1 = Math.floor(maxScore*0.6), p2 = Math.floor(maxScore*0.7), p3 = Math.floor(maxScore*0.8), p4 = Math.floor(maxScore*0.9);
                        const bins = [0,0,0,0,0]; 
                        res.filter(r=>Utils.isActualScore(r)).forEach(v => { 
                            const t = v.total;
                            if(t < p1) bins[0]++; 
                            else if(t < p2) bins[1]++; 
                            else if(t < p3) bins[2]++;
                            else if(t < p4) bins[3]++;
                            else bins[4]++; 
                        });
                        
                        const colors = ['#d70015', '#ffcc00', '#ffe27a', '#1f7a35', '#0071e3'];
                        const barsData = bins.map((val, idx) => ({
                            value: val,
                            itemStyle: { color: colors[idx], borderRadius: [4, 4, 0, 0] }
                        }));
                        
                        // 将 chart-wrapper-card 替换为两个容器：上方为五梯队分布，下方为正态拟合直方图
                        const wrapper = document.getElementById('chart-wrapper-card');
                        wrapper.style.display = 'block';
                        wrapper.innerHTML = '<div id="chart-dist-segment" class="chart-container" style="height:320px;"></div>' +
                                            '<div id="chart-dist-normal" class="chart-container" style="height:400px; margin-top:16px;"></div>';

                        // 清理旧的实例（如存在）
                        try { if (this.distSegmentChart) { this.distSegmentChart.dispose(); this.distSegmentChart = null; } } catch(e){}
                        try { if (this.distNormalChart) { this.distNormalChart.dispose(); this.distNormalChart = null; } } catch(e){}

                        // 五梯队分布渲染到 chart-dist-segment（保留原有样式和交互）
                        const segEl = document.getElementById('chart-dist-segment');
                        this.distSegmentChart = echarts.init(segEl);
                        this._deferredChartSetOption(this.distSegmentChart, { 
                            title: { text: `【${exam.name}】全班成绩分布`, subtext: '直观了解不及格、及格与优秀的人数', left: 'center' },
                            tooltip: { trigger: 'axis' },
                            xAxis:{type:'category', data:[`不及格(<${p1})`,`及格(${p1}-${p2-1})`,`中等(${p2}-${p3-1})`,`良好(${p3}-${p4-1})`,`优秀(≥${p4})`]}, 
                            yAxis:{type:'value', min: 0, name:'人数'}, 
                            series:[{data:barsData, type:'bar', label:{show:true, position:'top'}, itemStyle:{borderRadius: [4, 4, 0, 0]}}] 
                        });

                        // 点击分布图柱子后，按分段过滤下方表格（并展示提示）
                        try {
                            this.distSegmentChart.off('click');
                            this.distSegmentChart.on('click', (params) => {
                                try {
                                    const idx = params.dataIndex;
                                    let low = Number.NEGATIVE_INFINITY, high = Number.POSITIVE_INFINITY;
                                    if (idx === 0) { low = 0; high = p1 - 1; }
                                    else if (idx === 1) { low = p1; high = p2 - 1; }
                                    else if (idx === 2) { low = p2; high = p3 - 1; }
                                    else if (idx === 3) { low = p3; high = p4 - 1; }
                                    else { low = p4; high = Number.POSITIVE_INFINITY; }

                                    const filtered = res.filter(r => (r.total || 0) >= low && (r.total || 0) <= high);
                                        // 备份原始 pool，避免重复覆盖导致的数据死锁
                                        this.analysisCache = this.analysisCache || {};
                                        if (!this.analysisCache.originalPool) this.analysisCache.originalPool = this.analysisCache.pool;
                                        this.analysisCache.pool = filtered;

                                        document.getElementById('analysis-table-area').style.display = 'flex';
                                        document.getElementById('table-title').innerHTML = `${window.gk2IconMarkup('chart')} 分段过滤结果 <small style="color:var(--text-sub); font-weight:normal;">(共 ${filtered.length} 人)</small><span style="color:#d70015; margin-left:10px;">已过滤显示: ${params.name} 段的学生 (点击表头排序可重置)</span>` +
                                            ` <button class="secondary" style="padding: 2px 6px; font-size: 11px; margin-left: 10px;" onclick="if(window.app.ui.analysisCache && window.app.ui.analysisCache.originalPool){ window.app.ui.analysisCache.pool = window.app.ui.analysisCache.originalPool; delete window.app.ui.analysisCache.originalPool; window.app.ui.renderAnalysisTableRows(); document.getElementById('table-title').innerHTML = '成绩数据明细 <small style="font-weight:normal; font-size:12px; color:var(--text-sub); background: #f2f2f5; padding: 4px 8px; border-radius: 4px;">已恢复全班数据</small>'; }">${window.gk2IconMarkup('close')} 清除过滤</button>`;
                                        this.renderAnalysisTableRows();
                                } catch (innerE) { console.warn('dist click inner error', innerE); }
                            });
                        } catch(e) { console.warn('bind dist click error', e); }

                        // 正态分布拟合图（等距直方图 + 高斯拟合曲线）渲染到 chart-dist-normal
                        try {
                            const normalEl = document.getElementById('chart-dist-normal');
                            if (normalEl) {
                                // 清理旧实例
                                try { if (this.distNormalChart) { this.distNormalChart.dispose(); this.distNormalChart = null; } } catch(e){}
                                const normalChart = echarts.init(normalEl);

                                const validScores = res.filter(r => typeof r.total === 'number' && isFinite(r.total)).map(r => r.total);
                                const totalN = validScores.length;
                                if (totalN > 0) {
                                    const maxScoreVal = (typeof maxScore === 'number' && isFinite(maxScore)) ? maxScore : (exam && exam.maxTotal) ? exam.maxTotal : Math.max(...validScores);
                                    const binCount = 10;
                                    const binWidth = maxScoreVal / binCount;
                                    const bins = new Array(binCount).fill(0);
                                    validScores.forEach(s => {
                                        let idx = Math.floor(s / (binWidth || 1));
                                        if (idx >= binCount) idx = binCount - 1;
                                        if (idx < 0) idx = 0;
                                        bins[idx]++;
                                    });

                                    // 计算均值与标准差
                                    const mean = validScores.reduce((a,b)=>a+b,0) / totalN;
                                    const variance = validScores.reduce((a,b)=> a + Math.pow(b-mean,2), 0) / totalN;
                                    const stdDev = Math.sqrt(variance) || (maxScoreVal/50);

                                    // 生成曲线（100 个点），并按 (n * binWidth) 缩放到直方图量级
                                    const curvePoints = [];
                                    const steps = 100;
                                    for (let i=0;i<=steps;i++){
                                        const x = (i/steps) * maxScoreVal;
                                        const expo = Math.exp(-0.5 * Math.pow((x - mean)/stdDev, 2));
                                        const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * expo;
                                        const y = pdf * totalN * binWidth;
                                        curvePoints.push([x, parseFloat(y.toFixed(3))]);
                                    }

                                    // 直方图数据：使用每段中心点作为 x 值
                                    const barData = bins.map((cnt, i) => {
                                        const center = (i + 0.5) * binWidth;
                                        return [parseFloat(center.toFixed(3)), cnt];
                                    });

                                    // 计算合适的 barWidth（像素），基于容器宽度与数值域比例
                                    const containerW = normalEl.clientWidth || 800;
                                    const approxBarPx = Math.max(6, Math.floor((binWidth / (maxScoreVal || 1)) * containerW * 0.9));

                                    this._deferredChartSetOption(normalChart, {
                                        title: { text: `【${Utils.escapeHTML(exam.name)}】成绩直方与正态拟合`, left: 'center' },
                                        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
                                        xAxis: { type: 'value', min: 0, max: maxScoreVal, name: '分数' },
                                        yAxis: { type: 'value', name: '人数' },
                                        series: [
                                            { name: '频数', type: 'bar', data: barData, barWidth: approxBarPx, itemStyle: { color: '#0071e3' } },
                                            { name: '正态拟合', type: 'line', smooth: true, showSymbol: false, data: curvePoints, lineStyle: { color: '#ffcc00', width: 2 } }
                                        ]
                                    });
                                    // 保存实例以便后续 dispose
                                    this.distNormalChart = normalChart;
                                }
                            }
                        } catch (eNorm) { console.warn('normal fit render error', eNorm); }
                    } else if (type === 'avg') {
                        const avgType = document.getElementById('a-avg-type').value; 
                        
                        const cMap = {}; 
                        res.filter(r=>Utils.isActualScore(r)).forEach(r => { 
                            const clsKey = `${r.campus} - ${r.teachingClass}`;
                            if(!cMap[clsKey]) cMap[clsKey]=[]; 
                            cMap[clsKey].push(r.total); 
                        });
                        
                        const x = Object.keys(cMap).sort(); 
                        
                        if (avgType === 'bar') {
                            const yData = x.map(k => parseFloat((cMap[k].reduce((a,b)=>a+b,0)/cMap[k].length).toFixed(1)));
                            
                            const enhancedY = yData.map((val, idx) => ({ 
                                value: val,
                                itemStyle: { color: barColors[idx % barColors.length], borderRadius: [4, 4, 0, 0] }
                            }));

                            const avgYAxisConfig = { type:'value', min: 0, scale: false, name:'班级平均分', max: exam.maxTotal };

                            this._deferredChartSetOption(this.chartInstance, { 
                                title: { text: `【${Utils.escapeHTML(exam.name)}】各班级平均分对比`, left: 'center' },
                                tooltip: { trigger: 'axis' },
                                xAxis:{type:'category', data:x, axisLabel: { interval: 0, rotate: 15 }}, 
                                yAxis: avgYAxisConfig, 
                                series:[{
                                    data:enhancedY, 
                                    type:'bar', 
                                    label:{show:true, position:'top'}, 
                                    markLine: {
                                        symbol: 'none',
                                        label: { show: true, position: 'end', formatter: '总均分: {c}', backgroundColor: '#ffcc00', color: '#1d1d1f', padding: [4, 8], borderRadius: 4, fontWeight: 'bold' },
                                        lineStyle: { color: '#ffcc00', type: 'dashed', width: 2 },
                                        data: [{ yAxis: overallAvgNum, name: '总均分' }]
                                    }
                                }] 
                            });
                        } else {
                            const boxData = x.map(k => Utils.getBoxplotData(cMap[k]));
                            
                            const enhancedBoxData = boxData.map((val, idx) => ({ 
                                value: val,
                                itemStyle: { borderColor: barColors[idx % barColors.length], borderWidth: 2, color: barColors[idx % barColors.length] + '33' }
                            }));

                            const boxYAxisConfig = { type:'value', min:0, scale:false, name:'分数极差分布', max: exam.maxTotal };

                            this._deferredChartSetOption(this.chartInstance, {
                                title: { text: `【${Utils.escapeHTML(exam.name)}】各班两极分化情况 (箱线图)`, subtext: '箱子越长代表分差越大；横线越低代表差生越多', left: 'center' },
                                tooltip: { 
                                    trigger: 'item', axisPointer: { type: 'shadow' },
                                    formatter: function (param) {
                                        const v = param.data && param.data.value ? param.data.value : param.data;
                                        if(param.componentType === 'markLine') return `${param.name}: ${param.value}`;
                                        return [
                                            `<b>${param.name} 的数据分布:</b>`,
                                            `最高极值: <span style="color:var(--success)">${v[4] !== undefined ? v[4] : ''}</span>`,
                                            `上四分位(Q3): ${v[3] !== undefined ? v[3] : ''}`,
                                            `中位线: <b>${v[2] !== undefined ? v[2] : ''}</b>`,
                                            `下四分位(Q1): ${v[1] !== undefined ? v[1] : ''}`,
                                            `最低极值: <span style="color:var(--danger)">${v[0] !== undefined ? v[0] : ''}</span>`
                                        ].join('<br/>');
                                    }
                                },
                                xAxis: { type: 'category', data: x, axisLabel: { interval: 0, rotate: 15 } },
                                yAxis: boxYAxisConfig,
                                series: [
                                    { 
                                        name: '班级分数分布', 
                                        type: 'boxplot', 
                                        data: enhancedBoxData,
                                        markLine: {
                                            symbol: 'none',
                                            label: { show: true, position: 'end', formatter: '总均分: {c}', backgroundColor: '#ffcc00', color: '#1d1d1f', padding: [4, 8], borderRadius: 4, fontWeight: 'bold' },
                                            lineStyle: { color: '#ffcc00', type: 'dashed', width: 2 },
                                            data: [{ yAxis: overallAvgNum, name: '总均分' }]
                                        }
                                    }
                                ]
                            });
                        }
                    }

                    const prevRanks = {};
                    const priorExams = this.store.state.data.exams.filter(e => e.grade === exam.grade && e.date < exam.date).sort((a,b) => (b.date||'').localeCompare(a.date||''));
                    if (priorExams.length > 0) {
                        const prevExamId = priorExams[0].id;
                        const prevRes = [];
                        validStudentsForExam.forEach(s => {
                            const r = this.store.getScore(s.id, prevExamId);
                            if(Utils.isActualScore(r)) prevRes.push({id: s.id, total: r.total});
                        });
                        prevRes.sort((a,b) => b.total - a.total).forEach((d, idx) => { prevRanks[d.id] = prevRes.filter(r => r.total > d.total).length + 1; });
                    }

                    this.analysisCache = { exam, pool: res.filter(r=>Utils.isActualScore(r)), prevRanks, sortCol: 'total', sortAsc: false };
                    document.getElementById('analysis-table-area').style.display = 'flex';
                    document.getElementById('table-title').innerHTML = `成绩数据明细 <small style="font-weight:normal; font-size:12px; color:var(--text-sub); background: #f2f2f5; padding: 4px 8px; border-radius: 4px;">点击表头的题型名称，可以给学生排序</small>`;
                    this.renderAnalysisTableRows();
                }

                renderAnalysisTableRows() {
                    if (!this.analysisCache || !this.analysisCache.exam) return;
                    const cache = this.analysisCache;
                    const maxScore = cache.exam.maxTotal;
                    const thead = document.getElementById('thead-analysis');
                    
                    const renderTh = (label, colKey, width = 'auto') => {
                        const isActive = cache.sortCol === colKey;
                        const iconPath = isActive
                            ? (cache.sortAsc ? '<path d="M6 3l-3.5 3.5h7L6 3z"/><path d="M6 9V4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>' : '<path d="M6 9l3.5-3.5h-7L6 9z"/><path d="M6 3v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>')
                            : '<path d="M6 2.5l-2.8 3h5.6L6 2.5zM6 9.5l2.8-3H3.2L6 9.5z"/>';
                        const icon = `<svg class="sort-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">${iconPath}</svg>`;
                        return `<th class="sortable-th ${isActive ? 'is-sort-active' : ''}" data-sort-dir="${isActive ? (cache.sortAsc ? 'asc' : 'desc') : 'none'}" style="width:${width}; z-index:var(--z-sticky);" onclick="window.app.ui.sortAnalysis('${colKey}')">${label}${icon}</th>`;
                    };

                    const getScoreBandClass = (rate, isSorted = false) => {
                        const sortedClass = isSorted ? ' is-sort-col' : '';
                        if (rate >= 0.85) return `score-band-cell band-excellent score-heat-high${sortedClass}`;
                        if (rate >= 0.6) return `score-band-cell band-warning score-heat-mid${sortedClass}`;
                        return `score-band-cell band-danger score-heat-low${sortedClass}`;
                    };
                    const formatScore = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

                    let thHtml = `<tr><th class="th-left-1" style="width:80px; min-width:80px; max-width:80px;">总名次</th><th class="th-left-2" style="left:80px; width:120px; min-width:120px; max-width:120px;">学生姓名</th><th>校区</th><th>日语班</th><th>行政班</th>`;
                    (cache.exam.types||[]).forEach(t => { thHtml += renderTh(t.name, t.name); });
                    thHtml += renderTh('最终总分', 'total');
                    thHtml += `</tr>`;
                    thead.innerHTML = thHtml;

                    const data = [...cache.pool];
                    data.sort((a, b) => {
                        let valA = cache.sortCol === 'total' ? a.total : (a.details[cache.sortCol] || 0);
                        let valB = cache.sortCol === 'total' ? b.total : (b.details[cache.sortCol] || 0);
                        return cache.sortAsc ? (valA - valB) : (valB - valA);
                    });

                    const passLine = maxScore * 0.6;
                    const excLine = maxScore * 0.8;
                    const tbody = document.getElementById('tbody-analysis'); 
                    
                    const currentRanks = {};
                    [...cache.pool].sort((a,b) => b.total - a.total).forEach((d, idx) => { currentRanks[d.id] = cache.pool.filter(r => r.total > d.total).length + 1; });

                    const rowsHTML = [];

                    data.forEach((d, idx) => {
                        const currRank = currentRanks[d.id];
                        const rankPrefixHtml = currRank === 1 ? window.gk2IconMarkup('medal-gold') : currRank === 2 ? window.gk2IconMarkup('medal-silver') : currRank === 3 ? window.gk2IconMarkup('medal-bronze') : '';
                        let rankValueHtml = currRank <= 3 ? `${currRank}` : `<b>${currRank}</b>`;
                        
                        if (cache.prevRanks[d.id]) {
                            const diff = cache.prevRanks[d.id] - currRank;
                            if (diff > 0) rankValueHtml += `<span class="rank-up" title="比上次同联考上升了 ${diff} 名">↑${diff}</span>`;
                            else if (diff < 0) rankValueHtml += `<span class="rank-down" title="比上次同联考退步了 ${-diff} 名">↓${-diff}</span>`;
                            else rankValueHtml += `<span style="color:var(--text-faint); font-size:11px; margin-left:6px;" title="联考排名没变">-</span>`;
                        }

                        let rowClass = '';
                        // '差一点' 类别将以圆点代替原有文本 badge
                        if (d.total >= passLine - 5 && d.total < passLine) {
                            rowClass = 'row-warning';
                        } else if (d.total >= excLine - 5 && d.total < excLine) {
                            rowClass = 'row-excellent';
                        }

                        const nameLink = `<a href="#" class="student-link" onclick="event.preventDefault(); window.app.ui.openStudentProfile('${d.id}', this)" title="查看档案">${Utils.escapeHTML(d.name)}</a>`;

                        // 智能动态诊断：使用简洁圆点（与标题图例对应）
                        let diagDots = '';
                        try {
                            const types = cache.exam.types || [];
                            const rates = types.map(t => {
                                const s = d.details[t.name] || 0; return t.max > 0 ? (s / t.max) : 0;
                            });
                            const maxRate = rates.length ? Math.max(...rates) : 0;
                            const minRate = rates.length ? Math.min(...rates) : 0;
                            // 严重偏科：最高与最低差>40% 且 存在低于50%的题型
                            if ((maxRate - minRate) > 0.4 && rates.some(r => r < 0.5)) {
                                diagDots += `<span class="diag-dot diag-pianke" title="偏科警告：最高与最低题型得分率相差超过40%，且至少一项低于50%"></span>`;
                            }
                            // 进步明显：相比上次名次上升 > 班级总人数的20%
                            const totalStudents = (cache.pool || []).length || 0;
                            if (cache.prevRanks && cache.prevRanks[d.id]) {
                                const prev = cache.prevRanks[d.id];
                                const diffRank = prev - currentRanks[d.id];
                                if (diffRank > Math.max(1, Math.floor(totalStudents * 0.2))) {
                                    diagDots += `<span class="diag-dot diag-improved" title="进步明显：较上次同联考排名提升超过班级人数的20%"></span>`;
                                }
                            }
                            // 差一点就及格 / 差一点就优秀：用圆点表示
                            if (d.total >= passLine - 5 && d.total < passLine) {
                                diagDots += `<span class="diag-dot diag-near-pass" title="临界及格：距离及格线不足5分"></span>`;
                            } else if (d.total >= excLine - 5 && d.total < excLine) {
                                diagDots += `<span class="diag-dot diag-near-excellent" title="临界优秀：距离优秀线不足5分"></span>`;
                            }
                        } catch (diagE) { console.warn('diag label error', diagE); }

                        const totalScore = Number(d.total || 0);
                        const fullScoreVal = (cache && cache.exam && (cache.exam.fullScore || cache.exam.maxTotal))
                            ? (cache.exam.fullScore || cache.exam.maxTotal)
                            : ((cache && cache.exam && cache.exam.types) ? (cache.exam.types.reduce((s,t)=>s + Number(t.max || 0), 0) || 150) : (maxScore || 150));
                        const passScoreVal = fullScoreVal * 0.6;
                        const excellentScoreVal = fullScoreVal * 0.8;
                        let rowBgColor = 'transparent';
                        const rankCellHtml = this._renderInlineMarkedCell(rankValueHtml, '', rankPrefixHtml);
                        const nameCellHtml = this._renderInlineMarkedCell(nameLink, diagDots);
                        let trHtml = `<tr data-profile-student-id="${Utils.escapeHTML(d.id)}" data-student-name="${Utils.escapeHTML(d.name || '')}" style="background: ${rowBgColor}; transition: background var(--motion-base);" class="${rowClass}"><td class="sticky-col-left" style="width:80px; min-width:80px; max-width:80px;">${rankCellHtml}</td><td class="sticky-col-left" style="left:80px; width:120px; min-width:120px; max-width:120px; font-weight:700;">${nameCellHtml}</td><td class="table-meta">${Utils.escapeHTML(d.campus||'-')}</td><td class="table-meta">${Utils.escapeHTML(d.teachingClass||'-')}</td><td class="table-meta">${Utils.escapeHTML(d.adminClass||'-')}</td>`;
                        (cache.exam.types||[]).forEach(t => {
                            const stuScore = d.details[t.name] || 0;
                            const stuRate = t.max > 0 ? (stuScore / t.max) : 0;
                            const otherRates = (cache.exam.types || [])
                                .filter(ot => ot.name !== t.name)
                                .map(ot => ot.max > 0 ? ((d.details[ot.name] || 0) / ot.max) : 0);
                            const avgOtherRate = otherRates.length > 0 ? otherRates.reduce((a, b) => a + b, 0) / otherRates.length : 0;
                            const isAnomaly = Math.abs(stuRate - avgOtherRate) > 0.3 && (cache.exam.types || []).length > 1;
                            const anomalyIcon = isAnomaly ? ` <span class="score-anomaly" title="该题型得分率与其他题型相差超过30%，请核查">${window.gk2IconMarkup('alert')}</span>` : '';
                            trHtml += `<td class="${getScoreBandClass(stuRate, cache.sortCol === t.name)}">${formatScore(stuScore)}${anomalyIcon}</td>`;
                        });
                        const rate = (cache.exam && cache.exam.maxTotal) ? (d.total / cache.exam.maxTotal) : 0;
                        trHtml += `<td class="${getScoreBandClass(rate, cache.sortCol === 'total')} score-total-cell">${formatScore(d.total)}</td></tr>`;
                        rowsHTML.push(trHtml);
                    });
                    
                    tbody.innerHTML = rowsHTML.join('');
                    this._bindScrollShadows(document.getElementById('analysis-table-area') || document);
                }

                // ================== 重构：独立的学生专属大屏看板引擎 ==================

                // 班级学情页的搜索框：实现重定向到档案页
                handleAnalysisSearch(keyword) {
                    if ((this.store.state.data.students || []).length === 0) {
                        Utils.msg('请先添加学生数据', 'error');
                        this.syncStudentSearchAvailability();
                        return;
                    }
                    if (!keyword.trim()) return;
                    // 自动跳转到“个人学情档案”视图
                    const targetNav = document.querySelector('.nav-item[onclick*="student-dashboard"]');
                    this.switchView('student-dashboard', targetNav);
                    
                    // 将关键词传递给新的搜索框并执行检索
                    const newSearchInput = document.getElementById('dashboard-search-student');
                    newSearchInput.value = keyword;
                    newSearchInput.focus();
                    this.handleDashboardSearch(keyword);
                    
                    // 清空旧输入框，防止回退时遗留
                    const oldAnalysisSearch = document.getElementById('analysis-search-student');
                    if (oldAnalysisSearch) oldAnalysisSearch.value = '';
                }

                // 真正的档案页搜索逻辑
                handleDashboardSearch(keyword) {
                    if ((this.store.state.data.students || []).length === 0) {
                        Utils.msg('请先添加学生数据', 'error');
                        this.syncStudentSearchAvailability();
                        return;
                    }
                    const kw = (keyword || '').trim().toLowerCase();
                    const emptyState = document.getElementById('student-dashboard-empty');
                    const dashboard = document.getElementById('student-dashboard-container');
                    
                    if (!kw) {
                        emptyState.style.display = 'block';
                        dashboard.style.display = 'none';
                        return;
                    }

                    const getPinyinInitials = (str) => {
                        const collator = new Intl.Collator('zh-Hans-CN', { numeric: true });
                        const letters = 'abcdefghjklmnopqrstwxyz';
                        const boundaries = ['阿','八','嚓','哒','妸','发','旮','哈','击','喀','垃','妈','拿','哦','啪','期','然','撒','塌','挖','昔','压','匝'];
                        const surnameInitials = {'曾':'z','解':'x','仇':'q','查':'z','单':'s','区':'o','乐':'y','重':'c','种':'c','长':'z','句':'g','繁':'p','折':'s','秘':'b','冼':'x','盖':'g','朴':'p','翟':'z','尉':'y','燕':'y','沈':'s','黑':'h','宁':'n','缪':'m','华':'h'};
                        let res = '';
                        for (let i = 0; i < str.length; i++) {
                            let char = str[i];
                            if (i === 0 && surnameInitials[char]) { res += surnameInitials[char]; continue; }
                            if (!/[\u4e00-\u9fa5]/.test(char)) { res += char.toLowerCase(); continue; }
                            let found = false;
                            for (let j = boundaries.length - 1; j >= 0; j--) {
                                if (collator.compare(char, boundaries[j]) >= 0) { res += letters[j]; found = true; break; }
                            }
                            if (!found) res += char.toLowerCase();
                        }
                        return res;
                    };

                    const focus = this.store.state.globalFocus;
                    const matchingStudents = this.store.state.data.students.filter(s => {
                        if (focus.campuses.length > 0 && !focus.campuses.includes(s.campus)) return false;
                        if (focus.grades.length > 0 && !focus.grades.includes(s.grade)) return false;
                        if (focus.tClasses.length > 0 && !focus.tClasses.includes(s.teachingClass)) return false;

                        return this._matchesPinyin(s.name || '', kw);
                    });

                    if (matchingStudents.length === 0) {
                        emptyState.innerHTML = Utils.getEmptyStateHTML('搜索无结果', '没有找到匹配的学生，请检查姓名或拼音首字母。', 'search', '');
                        emptyState.style.display = 'block';
                        dashboard.style.display = 'none';
                        return;
                    }

                    emptyState.style.display = 'none';
                    this.openStudentProfile(matchingStudents[0].id);
                }

                renderStudentDashboard(stu) {
                    if (this.dashCharts) { this.dashCharts.forEach(c => c.dispose()); }
                    this.dashCharts = [];

                    const dashboard = document.getElementById('student-dashboard-container');
                    dashboard.style.display = 'block';

                    const allExams = this.store.state.data.exams.filter(e => {
                        if (e.grade !== stu.grade) return false;
                        const camps = this._getExamCampuses(e);
                        return camps.length === 0 || camps.includes(stu.campus);
                    }).sort((a,b) => (a.date||'').localeCompare(b.date||''));

                    let validExams = [];
                    let latestExamItem = null;
                    allExams.forEach(ex => {
                        const rec = this.store.getScore(stu.id, ex.id);
                        if (Utils.isActualScore(rec, ex)) {
                            validExams.push({ exam: ex, score: rec });
                            latestExamItem = { exam: ex, score: rec };
                        }
                    });

                    dashboard.innerHTML = `
                        <div class="dashboard-header">
                            <div>
                                <h2 style="margin:0 0 8px 0; color:var(--text-main); display:flex; align-items:center; gap:10px;">
                                    <span style="font-size:24px;">${window.gk2IconMarkup('graduation')}</span> ${Utils.escapeHTML(stu.name)} 的专属学情简报
                                </h2>
                                <div style="color:var(--text-sub); font-size:13px; display:flex; gap:12px;">
                                    <span style="background:#f2f2f5; padding:4px 10px; border-radius:20px;">${window.gk2IconMarkup('building')} ${Utils.escapeHTML(stu.campus)}</span>
                                    <span style="background:#f2f2f5; padding:4px 10px; border-radius:20px;">${window.gk2IconMarkup('calendar')} ${Utils.escapeHTML(stu.grade)}</span>
                                    <span style="background:#edf5ff; color:var(--primary); padding:4px 10px; border-radius:20px; font-weight:bold;">${window.gk2IconMarkup('school')} ${Utils.escapeHTML(stu.teachingClass)}${Utils.hasTransferred(stu) ? ` ${window.gk2IconMarkup('swap')}` : ''}</span>
                                    <span style="background:var(--danger-soft); color:var(--danger); padding:4px 10px; border-radius:20px;">原行政班: ${Utils.escapeHTML(stu.adminClass)}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${validExams.length === 0 ? Utils.getEmptyStateHTML('缺乏数据', '该生目前暂未录入任何有效成绩，无法生成图表矩阵。', 'inbox', `<button class="primary" onclick="window.app.ui.openImportExamModal()">${window.gk2IconMarkup('upload')} 导入成绩</button>`) : `
                        <div class="dashboard-grid">
                            <div class="dashboard-card"><div id="sdash-trend" style="height:350px;"></div></div>
                            <div class="dashboard-card"><div id="sdash-radar" style="height:350px;"></div></div>
                            <div class="dashboard-card"><div id="sdash-quadrant" style="height:350px;"></div></div>
                        </div>
                        `}
                    `;

                    if (validExams.length > 0) {
                        setTimeout(() => {
                            this._renderSDashTrend(stu, validExams);
                            this._renderSDashRadar(stu, latestExamItem);
                            this._renderSDashQuadrant(stu, latestExamItem);
                        }, 300);
                    }
                }

                renderDetailsView() {
                    this._closeDetailsAIRegeneratePopover();
                    const container = document.getElementById('view-details');
                    if (!container) return;

                    const state = this.store && this.store.state ? this.store.state : {};
                    const data = state.data || { students: [], exams: [], scores: [] };
                    let eid = state.currentExamId || '';
                    if (!eid) {
                        const sel = document.getElementById('global-exam');
                        if (sel && sel.value) eid = sel.value;
                    }

                    if (!eid) {
                        container.classList.remove('details-score-active', 'details-changes-active');
                        container.innerHTML = '<div class="top-navbar"><div class="page-title"><svg class="gk2-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 4h6 M9 3h6v3H9z M7 5H5v17h14V5h-2 M8 12h8 M8 16h8"/></svg> 学生成绩详情</div></div><div class="content-body"><div style="padding:40px; text-align:center; color:var(--text-sub);">请先在左侧选择需要查看的单次考试</div></div>';
                        return;
                    }

                    const exam = (data.exams || []).find(e => e.id === eid);
                    if (!exam) {
                        container.classList.remove('details-score-active', 'details-changes-active');
                        container.innerHTML = '<div class="top-navbar"><div class="page-title"><svg class="gk2-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 4h6 M9 3h6v3H9z M7 5H5v17h14V5h-2 M8 12h8 M8 16h8"/></svg> 学生成绩详情</div></div><div class="content-body"><div style="padding:40px; text-align:center; color:var(--text-sub);">请先在左侧选择需要查看的单次考试</div></div>';
                        return;
                    }

                    const { scoreRows: detailRows } = this._getDetailsViewScoreRows(eid, { includeAbsent: true });
                    const hasScoreValue = value => value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value));
                    const hasEnteredExamScore = (record, scoreExam = exam) => Utils.isActualScore(record, scoreExam);
                    const hasActualScore = row => hasEnteredExamScore(row, exam);
                    const scoreRows = detailRows.filter(hasActualScore);

                    const maxScore = Number(exam.maxTotal || ((exam.types || []).reduce((sum, t) => sum + Number(t.max || 0), 0)) || 0);
                    // Build rich rows similar to renderAnalysisTableRows()
                    const prevRanks = {}; // no previous-exam ranks available here
                    const maxScoreLocal = maxScore;
                    const passLineLocal = maxScoreLocal * 0.6;
                    const excLineLocal = maxScoreLocal * 0.8;
                    const dataRows = [...detailRows];
                    // compute current ranks
                    const currentRanksLocal = {};
                    [...scoreRows].sort((a,b) => b.total - a.total).forEach((d, idx) => { currentRanksLocal[d.id] = scoreRows.filter(r => r.total > d.total).length + 1; });

                    const sortState = this.detailsScoreSort || { col: null, asc: false };
                    if (sortState.col) {
                        const { col, asc } = sortState;
                        const compareNumeric = (a, b) => asc ? a - b : b - a;
                        dataRows.sort((a, b) => {
                            if (a.examAbsent !== b.examAbsent) return a.examAbsent ? 1 : -1;
                            if (a.examAbsent) return 0;
                            let valueA, valueB, missingA = false, missingB = false;
                            if (col.startsWith('type:')) {
                                const typeName = col.slice(5);
                                const rawA = a.details?.[typeName], rawB = b.details?.[typeName];
                                missingA = rawA == null || String(rawA).trim() === '' || !Number.isFinite(Number(rawA));
                                missingB = rawB == null || String(rawB).trim() === '' || !Number.isFinite(Number(rawB));
                                valueA = Number(rawA); valueB = Number(rawB);
                            } else if (col === 'targetScore') {
                                valueA = Number(a.estimatedTotal); valueB = Number(b.estimatedTotal);
                                missingA = !(valueA > 0); missingB = !(valueB > 0);
                            } else if (col === 'gap') {
                                const targetA = Number(a.estimatedTotal), targetB = Number(b.estimatedTotal);
                                missingA = !(targetA > 0) || !hasActualScore(a); missingB = !(targetB > 0) || !hasActualScore(b);
                                valueA = Number(a.total || 0) - targetA;
                                valueB = Number(b.total || 0) - targetB;
                            } else if (col === 'total') {
                                valueA = Number(a.total || 0); valueB = Number(b.total || 0);
                                missingA = !hasActualScore(a); missingB = !hasActualScore(b);
                            } else {
                                valueA = Number(a.total || 0); valueB = Number(b.total || 0);
                            }
                            if (missingA !== missingB) return missingA ? 1 : -1;
                            if (!missingA && valueA !== valueB) return compareNumeric(valueA, valueB);
                            return Number(b.total || 0) - Number(a.total || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN', { numeric: true });
                        });
                    }

                    const renderSortableTh = (label, colKey, helpMarkup = '') => {
                        const active = sortState.col === colKey;
                        const direction = active ? (sortState.asc ? 'asc' : 'desc') : 'none';
                        const iconPath = direction === 'asc'
                            ? '<path d="m3 8 3-3 3 3 M6 5v6"/>'
                            : direction === 'desc'
                                ? '<path d="m3 4 3 3 3-3 M6 7V1"/>'
                                : '<path d="m3 5 3-3 3 3 M3 9l3 3 3-3"/>';
                        const icon = `<svg class="gk2-detail-sort-icon" viewBox="0 0 12 12" aria-hidden="true">${iconPath}</svg>`;
                        const key = Utils.escapeHTML(JSON.stringify(colKey));
                        return `<th class="sortable-th ${active ? 'is-sort-active' : ''}" data-sort-dir="${direction}" aria-sort="${direction === 'none' ? 'none' : direction === 'asc' ? 'ascending' : 'descending'}" onclick="window.app.ui.sortDetailsScore(${key})" title="点击按${label}排序"><span class="gk2-header-title-group">${label}${helpMarkup}${icon}</span></th>`;
                    };

                    const rateHelpMarkup = `<span class="gk2-header-help" tabindex="0" role="img" aria-label="题型达成颜色说明" aria-describedby="gk2-rate-help-popover" onclick="event.stopPropagation()"><svg class="gk2-header-help-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path></svg><span class="gk2-header-help-popover gk2-rate-help-popover" id="gk2-rate-help-popover" role="tooltip"><span class="gk2-rate-help-item"><i style="--rate-color:#F07F70"></i>&lt;40%</span><span class="gk2-rate-help-item"><i style="--rate-color:#F2C13F"></i>40–59%</span><span class="gk2-rate-help-item"><i style="--rate-color:#4FC4B3"></i>60–79%</span><span class="gk2-rate-help-item"><i style="--rate-color:#75A7F5"></i>80–100%</span><span class="gk2-rate-help-item"><i style="--rate-color:#B879E3"></i>&gt;100%</span><span class="gk2-rate-help-item"><i class="is-empty"></i>未录入</span></span></span>`;

                    const rowsHTML = [];
                    dataRows.forEach((d) => {
                        const currRank = currentRanksLocal[d.id];
                        const hasEnteredScore = hasActualScore(d);
                        const rankPrefixHtml = currRank === 1 ? window.gk2IconMarkup('medal-gold') : currRank === 2 ? window.gk2IconMarkup('medal-silver') : currRank === 3 ? window.gk2IconMarkup('medal-bronze') : '';
                        let rankValueHtml = d.examAbsent ? '<span class="exam-absent-pill">缺考</span>' : (currRank ? (currRank <= 3 ? `${currRank}` : `<b>${currRank}</b>`) : '<span title="本次考试未录入成绩">—</span>');

                        if (prevRanks[d.id]) {
                            const diff = prevRanks[d.id] - currRank;
                            if (diff > 0) rankValueHtml += `<span class="rank-up" title="比上次同联考上升了 ${diff} 名">↑${diff}</span>`;
                            else if (diff < 0) rankValueHtml += `<span class="rank-down" title="比上次同联考退步了 ${-diff} 名">↓${-diff}</span>`;
                            else rankValueHtml += `<span style="color:var(--text-faint); font-size:11px; margin-left:6px;" title="联考排名没变">-</span>`;
                        }

                        let rowClass = '';
                        if (hasEnteredScore && d.total >= passLineLocal - 5 && d.total < passLineLocal) {
                            rowClass = 'row-warning';
                        } else if (hasEnteredScore && d.total >= excLineLocal - 5 && d.total < excLineLocal) {
                            rowClass = 'row-excellent';
                        }

                        const nameLink = `<a href="#" class="student-link" onclick="event.preventDefault(); window.app.ui.openStudentProfile('${d.id}', this)" title="查看档案">${Utils.escapeHTML(d.name)}</a>`;

                        // diagnostic dots / badges
                        let diagDots = '';
                        if (hasEnteredScore) {
                            try {
                                const types = exam.types || [];
                                const rates = types.map(t => {
                                    const s = d.details?.[t.name];
                                    return hasScoreValue(s) && Number(t.max) > 0 ? Number(s) / Number(t.max) : null;
                                }).filter(Number.isFinite);
                                const maxRate = rates.length ? Math.max(...rates) : 0;
                                const minRate = rates.length ? Math.min(...rates) : 0;
                                if ((maxRate - minRate) > 0.4 && rates.some(r => r < 0.5)) {
                                    diagDots += `<span class="diag-dot diag-pianke" title="偏科警告"></span>`;
                                }
                                const totalStudents = (data.students || []).length || 0;
                                if (false && prevRanks && prevRanks[d.id]) { /* preserved structure, no prev ranks here */ }
                                if (d.total >= passLineLocal - 5 && d.total < passLineLocal) {
                                    diagDots += `<span class="diag-dot diag-near-pass" title="差一点就及格"></span>`;
                                } else if (d.total >= excLineLocal - 5 && d.total < excLineLocal) {
                                    diagDots += `<span class="diag-dot diag-near-excellent" title="差一点就优秀"></span>`;
                                }
                            } catch (diagE) { console.warn('diag label error', diagE); }
                        }

                        const totalScore = Number(d.total || 0);
                        const fullScoreVal = (exam && (exam.fullScore || exam.maxTotal))
                            ? (exam.fullScore || exam.maxTotal)
                            : ((exam && exam.types) ? (exam.types.reduce((s,t)=>s + Number(t.max || 0), 0) || (maxScoreLocal || 150)) : (maxScoreLocal || 150));
                        const passScoreVal = fullScoreVal * 0.6;
                        const excellentScoreVal = fullScoreVal * 0.8;
                        let rowBgColor = 'transparent';
                        const hasAiComment = String(d.aiComment || '').trim().length > 0;
                        const aiStatus = d.examAbsent ? '-' : `<button type="button" class="gk2-details-ai-status ${hasAiComment ? 'is-generated' : 'is-pending'}" data-details-ai-student="${Utils.escapeHTML(d.id)}" data-exam-id="${Utils.escapeHTML(eid)}" aria-label="${Utils.escapeHTML(`${d.name || '该生'}：${hasAiComment ? '已生成，点击确认重新生成学情分析' : '未生成，点击单独生成学情分析'}`)}" title="${hasEnteredScore ? (hasAiComment ? '点击重新生成该生 AI 学情分析' : '点击生成该生 AI 学情分析') : '暂无有效成绩，暂不能生成学情分析'}" ${hasAiComment ? 'aria-haspopup="dialog" aria-expanded="false"' : ''} ${hasEnteredScore ? '' : 'disabled'}>${hasAiComment ? '已生成' : '未生成'}</button>`;
                        const rankCellHtml = this._renderInlineMarkedCell(rankValueHtml, '', rankPrefixHtml);
                        const nameCellHtml = this._renderInlineMarkedCell(nameLink, diagDots);
                        
                        let targetScoreHtml = '—';
                        let gapHtml = '—';
                        let statusHtml = d.examAbsent ? '-' : (hasEnteredScore ? '-' : '<span style="color:var(--text-sub); font-weight:600;">未录入</span>');
                        let goalCellClass = '';
                        let goalCellTitle = '';
                        
                        if (!d.examAbsent && d.estimatedTotal && d.estimatedTotal > 0) {
                            targetScoreHtml = `${d.estimatedTotal}`;
                            if (hasEnteredScore) {
                            const gap = parseFloat(((d.total || 0) - d.estimatedTotal).toFixed(1));
                            const remainingGap = d.estimatedTotal - (d.total || 0);
                            const status = (d.total || 0) >= d.estimatedTotal ? '已达成' : (remainingGap > 5 ? '需努力' : '接近达成');
                            const statusColor = (d.total || 0) >= d.estimatedTotal ? '#1f7a35' : (remainingGap > 5 ? '#d70015' : '#9a6700');
                            const goalState = (d.total || 0) >= d.estimatedTotal ? 'achieved' : (remainingGap > 5 ? 'effort' : 'near');
                            if (hasEnteredScore && !d.isEstimated) {
                                goalCellClass = ` gk2-goal-${goalState}`;
                                goalCellTitle = `目标${status}`;
                            }
                            const gapColor = gap < 0 ? '#d70015' : (gap > 0 ? '#1f7a35' : '#6e6e73');
                            gapHtml = `<span style="color:${gapColor}; font-weight:700;">${gap > 0 ? '+' : ''}${gap}</span>`;
                            statusHtml = `<span style="color:${statusColor}; font-weight:700;">${status}</span>`;
                            }
                        }

                        let trHtml = `<tr data-profile-student-id="${Utils.escapeHTML(d.id)}" data-student-name="${Utils.escapeHTML(d.name || '')}" style="background: ${rowBgColor}; transition: background var(--motion-base);" class="${d.examAbsent ? 'details-absent-row' : rowClass}"><td class="sticky-col-left" style="width:58px; min-width:58px; max-width:58px;">${d.examAbsent ? rankValueHtml : (currRank ? rankCellHtml : rankValueHtml)}</td><td class="sticky-col-left gk2-score-name" style="left:58px; width:104px; min-width:104px; max-width:104px; font-weight:700; text-align:center;">${nameCellHtml}</td><td class="table-meta">${Utils.escapeHTML(d.adminClass||'-')}</td><td class="score-total-cell${goalCellClass}"${goalCellTitle ? ` title="${goalCellTitle}"` : ''}>${d.examAbsent || !hasEnteredScore ? '—' : d.total}</td><td>${targetScoreHtml}</td><td>${gapHtml}</td>`;
                        (exam.types||[]).forEach(t => {
                            if (d.examAbsent) {
                                trHtml += `<td class="gk2-score-type" style="color:var(--text-faint);">-</td>`;
                                return;
                            }
                            const rawScore = d.details?.[t.name];
                            const hasScore = rawScore !== undefined && rawScore !== null && String(rawScore).trim() !== '' && Number.isFinite(Number(rawScore));
                            const stuScore = hasScore ? Number(rawScore) : 0;
                            const stuRate = hasScore && Number(t.max) > 0 ? stuScore / Number(t.max) : null;
                            const otherRates = (exam.types || [])
                                .filter(ot => ot.name !== t.name)
                                .map(ot => {
                                    const value = d.details?.[ot.name];
                                    return Number(ot.max) > 0 && value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value))
                                        ? Number(value) / Number(ot.max) : null;
                                }).filter(Number.isFinite);
                            const avgOtherRate = otherRates.length ? otherRates.reduce((a, b) => a + b, 0) / otherRates.length : null;
                            const isAnomaly = stuRate !== null && avgOtherRate !== null && Math.abs(stuRate - avgOtherRate) > 0.3 && (exam.types || []).length > 1;
                            const anomalyIcon = isAnomaly ? ` <span class="score-anomaly" title="该题型得分率与其他题型相差超过30%，请核查">${window.gk2IconMarkup('alert')}</span>` : '';
                            const ratePercent = stuRate === null ? null : stuRate * 100;
                            const rateColor = ratePercent === null ? '' : ratePercent < 40 ? '#F07F70' : ratePercent < 60 ? '#F2C13F' : ratePercent < 80 ? '#4FC4B3' : ratePercent <= 100 ? '#75A7F5' : '#B879E3';
                            const cellAttrs = ratePercent === null
                                ? 'class="gk2-detail-rate-empty gk2-score-type" title="该题型尚未录入"'
                                : `class="score-cell gk2-detail-rate-cell gk2-score-type" data-gk2-rate="" style="--gk2-rate:${Math.max(0, Math.min(100, ratePercent))}%;--gk2-rate-color:${rateColor}" title="得分率 ${ratePercent.toFixed(1)}%"`;
                            trHtml += `<td ${cellAttrs}><span class="gk2-detail-rate-value">${hasScore ? stuScore : '—'}${anomalyIcon}</span>${ratePercent === null ? '' : '<span class="gk2-detail-progress" aria-hidden="true"><i></i></span>'}</td>`;
                        });
                        trHtml += `<td>${statusHtml}</td><td id="ai-status-cell-${d.id}">${d.examAbsent ? '-' : aiStatus}</td></tr>`;
                        rowsHTML.push(trHtml);
                    });

                    const scoreRowsHtml = rowsHTML.length > 0 ? rowsHTML.join('') : `<tr><td colspan="${8 + (exam.types || []).length}" style="text-align:center; color:var(--text-sub); padding:18px;">暂无成绩数据</td></tr>`;

                    const subjectAverages = (exam.types || []).map(t => {
                        const vals = scoreRows.map(r => r.details?.[t.name]).filter(hasScoreValue).map(Number);
                        const avg = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
                        const rate = avg !== null && Number(t.max || 0) > 0 ? parseFloat((avg / Number(t.max || 0) * 100).toFixed(1)) : null;
                        return { name: t.name, avg, max: Number(t.max || 0), rate };
                    });

                    const subjectAvgRows = subjectAverages.length > 0 ? subjectAverages.map(item => {
                        return `<tr><td>${Utils.escapeHTML(item.name)}</td><td>${item.avg === null ? '未录入' : item.avg.toFixed(1)}</td><td>${item.max}</td><td>${item.rate === null ? '未录入' : `${item.rate.toFixed(1)}%`}</td></tr>`;
                    }).join('') : `<tr><td colspan="4" style="text-align:center; color:var(--text-sub); padding:18px;">本次考试尚未录入成绩</td></tr>`;

                    const typeRateRows = subjectAverages.length > 0 ? subjectAverages.map(item => {
                        return `<tr><td>${Utils.escapeHTML(item.name)}</td><td>${item.avg === null ? '未录入' : item.avg.toFixed(1)}</td><td>${item.rate === null ? '未录入' : `${item.rate.toFixed(1)}%`}</td></tr>`;
                    }).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-sub); padding:18px;">本次考试尚未录入成绩</td></tr>`;

                    const segments = {
                        exc: { label: '优秀 (≥80%)', range: '80% 及以上', students: [], color: '#0071e3' },
                        good: { label: '良好 (60-80%)', range: '60%-80%', students: [], color: '#1f7a35' },
                        fair: { label: '待提高 (40-60%)', range: '40%-60%', students: [], color: '#ffcc00' },
                        poor: { label: '困难 (<40%)', range: '40% 以下', students: [], color: '#d70015' }
                    };
                    scoreRows.forEach(row => {
                        const pct = maxScore > 0 ? row.total / maxScore : 0;
                        if (pct >= 0.8) segments.exc.students.push(row);
                        else if (pct >= 0.6) segments.good.students.push(row);
                        else if (pct >= 0.4) segments.fair.students.push(row);
                        else segments.poor.students.push(row);
                    });

                    const segmentBlocks = Object.values(segments).map(seg => {
                        const studentChips = seg.students.length > 0
                            ? seg.students.map(s => `<a href="javascript:void(0)" onclick="window.app.ui.showStudentProfile('${s.id}')" class="student-link" style="display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(0,113,227,0.08);">${Utils.escapeHTML(s.name)}</a>`).join('')
                            : `<span style="color:var(--text-sub);">暂无学生</span>`;
                        return `<div style="border:1px solid var(--border); border-radius:12px; padding:12px; background:rgba(255,255,255,0.72); margin-bottom:10px;">
                            <div style="font-weight:600; color:var(--primary); margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">${seg.label} · ${seg.range} · ${seg.students.length} 人</div>
                            <div style="display:flex; flex-wrap:wrap; gap:8px;">${studentChips}</div>
                        </div>`;
                    }).join('');

                    const targetRows = scoreRows.filter(r => r.estimatedTotal > 0).sort((a, b) => {
                        // 计算差距
                        const gapA = a.estimatedTotal - a.total;
                        const gapB = b.estimatedTotal - b.total;
                        
                        // 定义状态优先级（数字越小越靠前）
                        const getStatusLevel = (gap) => {
                            if (gap <= 0) return 1;      // 已达成
                            if (gap <= 5) return 2;      // 接近达成
                            return 3;                    // 需努力
                        };
                        
                        const levelA = getStatusLevel(gapA);
                        const levelB = getStatusLevel(gapB);
                        
                        // 1. 首先按目标达成状态排序
                        if (levelA !== levelB) {
                            return levelA - levelB;
                        }
                        
                        // 2. 状态相同时，按当前总分从高到低排序
                        return b.total - a.total;
                    });
                    const targetRowsHtml = targetRows.length > 0 ? targetRows.map(row => {
                        const gap = parseFloat(((row.total || 0) - row.estimatedTotal).toFixed(1));
                        const remainingGap = row.estimatedTotal - (row.total || 0);
                        const rate = row.estimatedTotal > 0 ? (((row.total || 0) / row.estimatedTotal) * 100).toFixed(1) : '0.0';
                        const status = (row.total || 0) >= row.estimatedTotal ? '已达成' : (remainingGap > 5 ? '需努力' : '接近达成');
                        const statusColor = (row.total || 0) >= row.estimatedTotal ? '#1f7a35' : (remainingGap > 5 ? '#d70015' : '#9a6700');
                        const gapColor = gap < 0 ? '#d70015' : (gap > 0 ? '#1f7a35' : '#6e6e73');
                        return `<tr><td><a href="javascript:void(0)" onclick="window.app.ui.showStudentProfile('${row.id}')" class="student-link">${Utils.escapeHTML(row.name)}</a></td><td>${row.total}</td><td>${row.estimatedTotal}</td><td style="color:${gapColor}; font-weight:700;">${gap > 0 ? '+' : ''}${gap}</td><td>${rate}%</td><td style="color:${statusColor}; font-weight:700;">${status}</td></tr>`;
                    }).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:18px;">暂无目标数据</td></tr>`;

                    const passLine = maxScore * 0.6;
                    const borderlineRows = scoreRows
                        .filter(r => r.total >= maxScore * 0.5 && r.total < maxScore * 0.7)
                        .sort((a, b) => b.total - a.total);
                    const borderlineRowsHtml = borderlineRows.length > 0 ? borderlineRows.map((row, idx) => {
                        const gapToPass = (passLine - row.total).toFixed(1);
                        return `<tr><td style="text-align:center; font-weight:700;">${idx + 1}</td><td><a href="javascript:void(0)" onclick="window.app.ui.showStudentProfile('${row.id}')" class="student-link">${Utils.escapeHTML(row.name)}</a></td><td>${Utils.escapeHTML(row.campus)}</td><td>${Utils.escapeHTML(row.teachingClass)}</td><td>${row.total}</td><td>${gapToPass}</td></tr>`;
                    }).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:18px;">暂无临界生</td></tr>`;

                    // 列表和上次成绩比较共用当前校区、年级范围，避免混入其他校区的考试。
                    const allExamsForDetails = this._getDetailsChangeExams(exam);

                    const activeExamIndex = allExamsForDetails.findIndex(e => e.id === eid);
                    const examsUpToActive = activeExamIndex >= 0 ? allExamsForDetails.slice(0, activeExamIndex + 1) : allExamsForDetails;
                    const gradeLast4 = examsUpToActive.slice(-4);

                    let changesRowsHtml = '';
                    let currentTab = this.store.state.currentDetailsTab || 'score';
                    if (currentTab === 'target') {
                        currentTab = 'score';
                    }

                    if (currentTab === 'changes') {
                        // 预计算每个学生在本次考试较上一次考试的年级标准分变化，用于默认排序
                        const activeStats = StatsEngine.gradeStats(exam, data.students, data.scores, null);
                        const prevExam = activeExamIndex > 0 ? allExamsForDetails[activeExamIndex - 1] : null;
                        const prevStats = prevExam ? StatsEngine.gradeStats(prevExam, data.students, data.scores, null) : null;

                        const studentChanges = new Map();
                        detailRows.forEach(d => {
                            const currentRec = this.store.getScore(d.id, eid);
                            if (!hasEnteredExamScore(currentRec, exam)) {
                                studentChanges.set(d.id, -99999); // 缺考或无本次成绩的学生排最后
                                return;
                            }
                            const currentStd = StatsEngine.convertScore(currentRec.total, exam, 'std', activeStats);
                            
                            if (prevExam) {
                                const prevRec = this.store.getScore(d.id, prevExam.id);
                                if (hasEnteredExamScore(prevRec, prevExam)) {
                                    const prevStd = StatsEngine.convertScore(prevRec.total, prevExam, 'std', prevStats);
                                    const stdDiff = parseFloat((currentStd - prevStd).toFixed(1));
                                    studentChanges.set(d.id, stdDiff);
                                } else {
                                    studentChanges.set(d.id, -9999); // 本生为首考
                                }
                            } else {
                                studentChanges.set(d.id, -9999); // 全年级首考
                            }
                        });

                        const changesScoreRows = [...detailRows].sort((a, b) => {
                            const changeA = studentChanges.get(a.id);
                            const changeB = studentChanges.get(b.id);
                            if (changeA !== changeB) {
                                return changeB - changeA; // 按照标准分变化降序排列 (进步幅度最大排最前)
                            }
                            return b.total - a.total; // 同等变化或无变化时，按本次考试总分降序排列
                        });

                        const rows = [];
                        changesScoreRows.forEach((d) => {
                            let tr = `<tr class="${d.examAbsent ? 'details-absent-row' : ''}" data-profile-student-id="${Utils.escapeHTML(d.id)}" data-student-name="${Utils.escapeHTML(d.name || '')}">
                                <td class="sticky-col-left" style="font-weight:700; text-align:center; left: 0; z-index: 2;"><a href="#" onclick="event.preventDefault(); window.app.ui.openStudentProfile('${d.id}', this)" class="student-link">${Utils.escapeHTML(d.name)}</a></td>
                                <td style="color:var(--text-sub); text-align:center;">${Utils.escapeHTML(d.adminClass || '-')}</td>`;
                            
                            gradeLast4.forEach(ex => {
                                const currentRec = this.store.getScore(d.id, ex.id);
                                if (currentRec && currentRec.examAbsent) {
                                    tr += `<td style="text-align:center;"><span class="exam-absent-pill">缺考</span></td>
                                           <td style="text-align:center; color:var(--text-faint);">-</td>`;
                                    return;
                                }
                                if (!hasEnteredExamScore(currentRec, ex)) {
                                    tr += `<td style="text-align:center; color:var(--text-faint);">-</td>
                                           <td style="text-align:center; color:var(--text-faint);">-</td>`;
                                    return;
                                }

                                const exIndex = allExamsForDetails.findIndex(e => e.id === ex.id);
                                let rawChangeHtml = '<span style="color:var(--text-faint);">-</span>';
                                let stdChangeHtml = '<span style="color:var(--text-faint);">-</span>';

                                // 计算当前考试全年级标准分
                                const currentStats = StatsEngine.gradeStats(ex, data.students, data.scores, null);
                                const currentStd = StatsEngine.convertScore(currentRec.total, ex, 'std', currentStats);

                                if (exIndex > 0) {
                                    const prevExam = allExamsForDetails[exIndex - 1];
                                    const prevRec = this.store.getScore(d.id, prevExam.id);
                                    if (hasEnteredExamScore(prevRec, prevExam)) {
                                        const prevStats = StatsEngine.gradeStats(prevExam, data.students, data.scores, null);
                                        const prevStd = StatsEngine.convertScore(prevRec.total, prevExam, 'std', prevStats);

                                        const rawDiff = currentRec.total - prevRec.total;
                                        const stdDiff = parseFloat((currentStd - prevStd).toFixed(1));

                                        if (rawDiff > 0) {
                                            rawChangeHtml = `<span style="color:#1f7a35; font-weight:700;">+${rawDiff.toFixed(1)}</span>`;
                                        } else if (rawDiff < 0) {
                                            rawChangeHtml = `<span style="color:#d70015; font-weight:700;">${rawDiff.toFixed(1)}</span>`;
                                        } else {
                                            rawChangeHtml = `<span style="color:#8e8e93;">0</span>`;
                                        }

                                        if (stdDiff > 0) {
                                            stdChangeHtml = `<span style="color:#1f7a35; font-weight:700;">+${stdDiff.toFixed(1)}</span>`;
                                        } else if (stdDiff < 0) {
                                            stdChangeHtml = `<span style="color:#d70015; font-weight:700;">${stdDiff.toFixed(1)}</span>`;
                                        } else {
                                            stdChangeHtml = `<span style="color:#8e8e93;">0.0</span>`;
                                        }
                                    } else {
                                        rawChangeHtml = `<span style="color:#8e8e93; font-size:11px;">首考</span>`;
                                        stdChangeHtml = `<span style="color:#8e8e93; font-size:11px;">-</span>`;
                                    }
                                } else {
                                    rawChangeHtml = `<span style="color:#8e8e93; font-size:11px;">首考</span>`;
                                    stdChangeHtml = `<span style="color:#8e8e93; font-size:11px;">-</span>`;
                                }

                                tr += `<td style="text-align:center; font-weight:600;">${currentRec.total} (${rawChangeHtml})</td>
                                       <td style="text-align:center; font-weight:600;">${currentStd.toFixed(1)} (${stdChangeHtml})</td>`;
                            });
                            
                            tr += `</tr>`;
                            rows.push(tr);
                        });
                        
                        if (rows.length === 0) {
                            changesRowsHtml = `<tr><td colspan="${2 + gradeLast4.length * 2}" style="text-align:center; color:var(--text-sub); padding:18px;">暂无成绩数据</td></tr>`;
                        } else {
                            changesRowsHtml = rows.join('');
                        }
                    }

                    const html = `
    <div class="top-navbar details-top-navbar" style="display: flex; justify-content: space-between; align-items: center; padding-right: 20px;">
        <div class="details-top-main">
            <div class="page-title" style="flex:0 0 auto;">${window.gk2IconMarkup('clipboard')} 学生成绩详情</div>
            <div class="analysis-tabs details-tabs--inline">
                <button type="button" class="analysis-tab ${currentTab === 'score' ? 'active' : ''}" aria-pressed="${currentTab === 'score'}" onclick="window.app.ui.switchDetailsTab('score')">成绩数据明细</button>
                <button type="button" class="analysis-tab ${currentTab === 'changes' ? 'active' : ''}" aria-pressed="${currentTab === 'changes'}" onclick="window.app.ui.switchDetailsTab('changes')">近四次成绩变化</button>
                <button type="button" class="analysis-tab ${currentTab === 'avg' ? 'active' : ''}" aria-pressed="${currentTab === 'avg'}" onclick="window.app.ui.switchDetailsTab('avg')">班级均分明细</button>
                <button type="button" class="analysis-tab ${currentTab === 'rate' ? 'active' : ''}" aria-pressed="${currentTab === 'rate'}" onclick="window.app.ui.switchDetailsTab('rate')">题型得分率明细</button>
                <button type="button" class="analysis-tab ${currentTab === 'segment' ? 'active' : ''}" aria-pressed="${currentTab === 'segment'}" onclick="window.app.ui.switchDetailsTab('segment')">分段统计概览</button>
                <button type="button" class="analysis-tab ${currentTab === 'borderline' ? 'active' : ''}" aria-pressed="${currentTab === 'borderline'}" onclick="window.app.ui.switchDetailsTab('borderline')">临界生重点关注</button>
                <button type="button" class="analysis-tab ${currentTab === 'classAi' ? 'active' : ''}" aria-pressed="${currentTab === 'classAi'}" onclick="window.app.ui.switchDetailsTab('classAi')">AI 智能学情诊断</button>
            </div>
        </div>
        <div class="details-top-actions">
            <input type="text" id="details-search-student" placeholder="搜索姓名或拼音" style="width:160px; border-color:#c5ddf7;" oninput="window.app.ui.searchStudentInDetails(this.value)">
	            
        </div>
    </div>
    <div class="content-body">
        <div class="details-tab-content" style="display:flex; flex-direction:column; gap:12px; padding:2px 0 14px;">
            <div class="card gk2-detail-score-card" style="padding:14px 16px; margin-bottom:0; display: ${currentTab === 'score' ? 'flex' : 'none'};">
                <div class="table-scroll-container gk2-detail-score-scroll" style="max-height:none;">
                    <table class="gk2-details-score-table" style="border-collapse:separate; border-spacing:0; background:var(--bg-secondary);">
                        <thead><tr><th>排名</th><th><span class="gk2-header-title-group">姓名<span class="gk2-header-help" tabindex="0" role="img" aria-label="排名标记说明" aria-describedby="gk2-marker-help-popover" onclick="event.stopPropagation()"><svg class="gk2-header-help-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path></svg><span class="gk2-header-help-popover gk2-marker-help-popover" id="gk2-marker-help-popover" role="tooltip"><span class="gk2-marker-help-item"><i class="diag-dot diag-pianke"></i><span><b>偏科</b>最高与最低题型得分率相差超过40%，且至少有一项低于50%。</span></span><span class="gk2-marker-help-item"><i class="diag-dot diag-improved"></i><span><b>进步</b>较上次同联考排名提升超过班级人数的20%。</span></span><span class="gk2-marker-help-item"><i class="diag-dot diag-near-pass"></i><span><b>差一点及格</b>总分达到及格线前5分以内，且尚未达到及格线。</span></span><span class="gk2-marker-help-item"><i class="diag-dot diag-near-excellent"></i><span><b>差一点优秀</b>总分达到优秀线前5分以内，且尚未达到优秀线。</span></span></span></span></span></th><th>行政班</th>${renderSortableTh('总分', 'total', rateHelpMarkup)}${renderSortableTh('目标分数', 'targetScore')}${renderSortableTh('差距', 'gap')}${(exam.types || []).map(t => renderSortableTh(Utils.escapeHTML(t.name), 'type:' + t.name)).join('')}<th>达成状态</th><th id="btn-batch-ai" class="details-ai-batch-th" style="width:86px;" tabindex="0" onmouseenter="window.app.ui.showDetailsAiHint(event)" onfocus="window.app.ui.showDetailsAiHint(event)" onmouseleave="window.app.ui.hideDetailsAiHint()" onblur="window.app.ui.hideDetailsAiHint()" onclick="window.app.ui.batchGenerateAIComments()">AI 诊断</th></tr></thead>
                        <tbody>${scoreRowsHtml}</tbody>
                    </table>
                </div>
            </div>

            <!-- 近四次考试较上次成绩与标准分变化明细表 -->
            <div class="card gk2-detail-changes-card" style="padding:16px; margin-bottom:0; display: ${currentTab === 'changes' ? 'flex' : 'none'};">
                <h3 style="margin:0 0 10px 0; display:flex; align-items:center; justify-content:space-between;">
                    <span>${window.gk2IconMarkup('trend')} 近四次考试成绩与标准分变化波动明细表 (全年级标准分比对)</span>
                    <small style="font-weight:normal; font-size:12px; color:var(--text-sub); background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 4px;">
                        标准分变化基于全年级数据比对，不受当前筛选器影响
                    </small>
                </h3>
                <div class="table-scroll-container gk2-detail-changes-scroll" style="max-height:none;">
                    <table style="width:100%; border-collapse:separate; border-spacing:0; background:var(--bg-secondary);">
                        <thead style="position: sticky; top: 0; z-index: var(--z-sticky);">
                            <tr>
                                <th rowspan="2" class="sticky-col-left" style="text-align:center; vertical-align:middle; width:120px; z-index:var(--z-sticky); left: 0;">姓名</th>
                                <th rowspan="2" style="text-align:center; vertical-align:middle; width:100px;">行政班</th>
                                ${gradeLast4.map(ex => `<th colspan="2" style="text-align:center;">${Utils.escapeHTML(ex.name)}</th>`).join('')}
                            </tr>
                            <tr>
                                ${gradeLast4.map(() => `<th style="text-align:center; width:140px;">卷面总分 (变化)</th><th style="text-align:center; width:140px;">标准分 (变化)</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${changesRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="padding:14px 16px; margin-bottom:0; display: ${currentTab === 'avg' ? 'block' : 'none'};">
                <h3 style="margin:0 0 10px 0;">班级均分明细表</h3>
                <div class="table-scroll-container" style="max-height:none;">
                        <table style="width:100%; border-collapse:separate; border-spacing:0; background:var(--bg-secondary);">
                        <thead><tr><th>题型</th><th>均分</th><th>满分</th><th>得分率</th></tr></thead>
                        <tbody>${subjectAvgRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="padding:14px 16px; margin-bottom:0; display: ${currentTab === 'rate' ? 'block' : 'none'};">
                <h3 style="margin:0 0 10px 0;">题型得分率明细表</h3>
                <div class="table-scroll-container" style="max-height:none;">
                    <table style="width:100%; border-collapse:separate; border-spacing:0; background:var(--bg-secondary);">
                        <thead><tr><th>题型</th><th>平均分</th><th>得分率</th></tr></thead>
                        <tbody>${typeRateRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="padding:14px 16px; margin-bottom:0; display: ${currentTab === 'segment' ? 'block' : 'none'};">
                <h3 style="margin:0 0 10px 0;">分段统计概览表</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">${segmentBlocks}</div>
            </div>

            <div class="card" style="padding:14px 16px; margin-bottom:0; display: ${currentTab === 'borderline' ? 'block' : 'none'};">
                <h3 style="margin:0 0 10px 0;">临界生重点关注表</h3>
                <div class="table-scroll-container" style="max-height:none;">
                    <table style="width:100%; border-collapse:separate; border-spacing:0; background:var(--bg-secondary);">
                        <thead><tr><th>排名</th><th>姓名</th><th>校区</th><th>班级</th><th>总分</th><th>距及格线</th></tr></thead>
                        <tbody>${borderlineRowsHtml}</tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="padding:14px 16px; margin-bottom:0; display: ${currentTab === 'classAi' ? 'block' : 'none'};" id="class-ai-tab-card">
                ${this._renderClassAiTabContent(eid)}
            </div>
        </div>
    </div>
    `;

                    container.innerHTML = html;
                    container.classList.toggle('details-score-active', currentTab === 'score');
                    container.classList.toggle('details-changes-active', currentTab === 'changes');
                    this._bindAnalysisTabsEdgeIndicators(container);
                    const aiStatusBody = container.querySelector('.gk2-details-score-table tbody');
                    if (aiStatusBody) {
                        aiStatusBody.addEventListener('click', event => {
                            const button = event.target.closest('.gk2-details-ai-status');
                            if (button && aiStatusBody.contains(button) && !button.disabled) this.handleDetailsAIStatusClick(button);
                        });
                    }
                }

                _renderSDashTrend(stu, validExams) {
                    const chart = echarts.init(document.getElementById('sdash-trend'));
                    const xAxisData = [], stuScores = [], avgScores = [];
                    let maxScoreOverall = 100;

                    validExams.forEach(item => {
                        const ex = item.exam;
                        xAxisData.push(ex.name);
                        stuScores.push(item.score.total);
                        if(ex.maxTotal > maxScoreOverall) maxScoreOverall = ex.maxTotal;

                        const stuClassAtExam = Utils.getClassForExam(stu, ex);
                        const clsStus = this.store.state.data.students.filter(s => {
                            const sClass = Utils.getClassForExam(s, ex);
                            return sClass.campus === stuClassAtExam.campus && sClass.teachingClass === stuClassAtExam.teachingClass;
                        }).map(s=>s.id);
                        const clsScores = this.store.state.data.scores.filter(s => s.examId === ex.id && clsStus.includes(s.studentId) && Utils.isActualScore(s));
                        if (clsScores.length > 0) {
                            avgScores.push(parseFloat((clsScores.reduce((a,b)=>a+b.total,0)/clsScores.length).toFixed(1)));
                        } else {
                            avgScores.push(null);
                        }
                    });

                    this._deferredChartSetOption(chart, {
                        title: { text: '历史总分长线轨迹', left: 'center' },
                        tooltip: { trigger: 'axis' },
                        legend: { data: ['个人得分', '班级均分'], bottom: 0 },
                        xAxis: { type: 'category', data: xAxisData, axisLabel: { interval: 0, rotate: 15 } },
                        yAxis: { type: 'value', min: 0, max: maxScoreOverall },
                        series: [
                            { name: '个人得分', type: 'line', data: stuScores, smooth: true, itemStyle: { color: '#0071e3'}, label: {show:true, position:'top'}, lineStyle: { width: 3, shadowBlur: 14, shadowColor: 'rgba(0,113,227,0.28)', shadowOffsetY: 6 } },
                            { name: '班级均分', type: 'line', data: avgScores, smooth: true, itemStyle: { color: '#8e8e93'}, lineStyle:{ type: 'dashed' } }
                        ]
                    });
                    this.dashCharts.push(chart);
                }

                _renderSDashRadar(stu, latestExamItem) {
                    const chart = echarts.init(document.getElementById('sdash-radar'));
                    const ex = latestExamItem.exam;
                    const rec = latestExamItem.score;

                    if (!ex.types || ex.types.length === 0) return;

                    const indicator = ex.types.map(t => ({ name: t.name, max: 100 }));
                    const stuPct = ex.types.map(t => parseFloat((((rec.details[t.name]||0) / t.max) * 100).toFixed(1)));
                    
                    const stuClassAtExam = Utils.getClassForExam(stu, ex);
                    const clsStus = this.store.state.data.students.filter(s => {
                        const sClass = Utils.getClassForExam(s, ex);
                        return sClass.campus === stuClassAtExam.campus && sClass.teachingClass === stuClassAtExam.teachingClass;
                    }).map(s=>s.id);
                    const clsScores = this.store.state.data.scores.filter(s => s.examId === ex.id && clsStus.includes(s.studentId) && Utils.isActualScore(s));
                    
                    const avgPct = ex.types.map(t => {
                        let sum = 0;
                        clsScores.forEach(cs => sum += (cs.details[t.name]||0));
                        const rawAvg = clsScores.length > 0 ? sum / clsScores.length : 0;
                        return parseFloat(((rawAvg / t.max) * 100).toFixed(1));
                    });

                    this._deferredChartSetOption(chart, {
                        title: { text: `六边形能力雷达 (${ex.name})`, left: 'center' },
                        tooltip: { formatter: (p) => { 
                            let str = `<b>${p.name}</b><br>`; 
                            p.value.forEach((v, idx) => str += `${indicator[idx].name} 掌握率: ${v}%<br>`); 
                            return str; 
                        }},
                        legend: { data: ['个人能力(%)', '班级均值(%)'], bottom: 0 },
                        radar: { indicator: indicator, center: ['50%', '50%'], radius: '60%' },
                        series: [{
                            type: 'radar',
                            data: [
                                { value: stuPct, name: '个人能力(%)', areaStyle: { color: this._radarAreaGradient(), opacity: 0.92 }, lineStyle: { color: '#0071e3', width: 2.5 } },
                                { value: avgPct, name: '班级均值(%)', areaStyle: { color: 'rgba(142, 142, 147, 0.2)' }, lineStyle: { color: '#8e8e93', type: 'dashed' } }
                            ]
                        }]
                    });
                    this.dashCharts.push(chart);
                }

                _renderSDashQuadrant(stu, latestExamItem) {
                    const chart = echarts.init(document.getElementById('sdash-quadrant'));
                    const ex = latestExamItem.exam;
                    const rec = latestExamItem.score;

                    if (!ex.types || ex.types.length === 0) return;

                    const stuClassAtExam = Utils.getClassForExam(stu, ex);
                    const clsStus = this.store.state.data.students.filter(s => {
                        const sClass = Utils.getClassForExam(s, ex);
                        return sClass.campus === stuClassAtExam.campus && sClass.teachingClass === stuClassAtExam.teachingClass;
                    }).map(s=>s.id);
                    const clsScores = this.store.state.data.scores.filter(s => s.examId === ex.id && clsStus.includes(s.studentId) && Utils.isActualScore(s));

                    let clsTotalScoreSum = clsScores.reduce((a, b) => a + b.total, 0);
                    let clsTotalAvg = clsScores.length > 0 ? clsTotalScoreSum / clsScores.length : 0;
                    let clsTotalRate = ex.maxTotal > 0 ? (clsTotalAvg / ex.maxTotal) * 100 : 60; 

                    const scatterData = [];

                    ex.types.forEach(t => {
                        const stuScore = rec.details[t.name] || 0;
                        const stuRate = t.max > 0 ? (stuScore / t.max) * 100 : 0;

                        let clsSum = 0;
                        clsScores.forEach(cs => clsSum += (cs.details[t.name]||0));
                        const clsAvg = clsScores.length > 0 ? clsSum / clsScores.length : 0;
                        const clsRate = t.max > 0 ? (clsAvg / t.max) * 100 : 0;

                        scatterData.push({
                            name: t.name,
                            value: [parseFloat(clsRate.toFixed(1)), parseFloat(stuRate.toFixed(1))],
                            itemStyle: { color: stuRate >= clsRate ? '#0071e3' : '#d70015' } 
                        });
                    });

                    this._deferredChartSetOption(chart, {
                        title: { text: `模块优劣势四象限诊断`, subtext: '对比班级均分，定位提分突破口', left: 'center', top: 0 },
                        grid: { top: 65, bottom: '28%', left: 40, right: 40, containLabel: true },
                        tooltip: {
                            formatter: function (params) {
                                if(params.componentType === 'markLine') return null;
                                return `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #dedee3;padding-bottom:4px;">${params.data.name}</div>
                                        班级平均得分率: ${params.value[0]}%<br/>
                                        个人实际得分率: <span style="color:${params.color};font-weight:bold;">${params.value[1]}%</span>`;
                            }
                        },
                        xAxis: { type: 'value', name: '班级得分率(%)', nameLocation: 'center', nameGap: 55, scale: true, splitLine: { show: false }, axisLabel: { fontSize: 11 } },
                        yAxis: { type: 'value', name: '个人得分率', nameLocation: 'center', nameGap: 35, nameRotate: 90, scale: true, splitLine: { show: false }, axisLabel: { fontSize: 11 } },
                        series: [{
                            type: 'scatter',
                            data: scatterData,
                            symbolSize: 14,
                            label: { 
                                show: true, formatter: '{b}', position: 'bottom', distance: 8, 
                                color: '#1d1d1f', fontSize: 12, fontWeight: 'bold',
                                textBorderColor: '#ffffff', textBorderWidth: 2 
                            },
                            markLine: {
                                lineStyle: { type: 'dashed', color: Utils.cssVar('--text-faint', '#86868b'), width: 1 },
                                symbol: 'none',
                                label: { show: false }, 
                                data: [ { xAxis: clsTotalRate }, { yAxis: clsTotalRate } ]
                            },
                            markArea: {
                                silent: true,
                                data: [
                                    [ { xAxis: clsTotalRate, yAxis: clsTotalRate, itemStyle: { color: 'rgba(31, 122, 53, 0.05)' }, label: { formatter: '优势拓展', position: 'insideTopRight', color: '#1f7a35', fontSize: 12, fontWeight: 'bold', opacity: 0.3 } }, { xAxis: 'max', yAxis: 'max' } ],
                                    [ { xAxis: 'min', yAxis: clsTotalRate, itemStyle: { color: 'rgba(0, 113, 227, 0.05)' }, label: { formatter: '强势抢分', position: 'insideTopLeft', color: '#0071e3', fontSize: 12, fontWeight: 'bold', opacity: 0.3 } }, { xAxis: clsTotalRate, yAxis: 'max' } ],
                                    [ { xAxis: 'min', yAxis: 'min', itemStyle: { color: 'rgba(100, 116, 139, 0.05)' }, label: { formatter: '共同盲区', position: 'insideBottomLeft', color: '#515156', fontSize: 12, fontWeight: 'bold', opacity: 0.3 } }, { xAxis: clsTotalRate, yAxis: clsTotalRate } ],
                                    [ { xAxis: clsTotalRate, yAxis: 'min', itemStyle: { color: 'rgba(215, 0, 21, 0.05)' }, label: { formatter: '紧急补漏', position: 'insideBottomRight', color: '#d70015', fontSize: 12, fontWeight: 'bold', opacity: 0.3 } }, { xAxis: 'max', yAxis: clsTotalRate } ]
                                ]
                            }
                        }]
                    });
                    this.dashCharts.push(chart);
                }

                searchStudentInExams(keyword) {
                    const kw = (keyword || '').trim().toLowerCase();
                    const container = document.getElementById('flat-exam-container');
                    if (!container) return;
                    
                    // 1. 清除之前的高亮状态（通过类名控制样式，避免内联样式残留）
                    container.querySelectorAll('.search-highlight').forEach(el => {
                        el.classList.remove('search-highlight');
                    });
                    
                    if (!kw) return;

                    // 核心优化：轻量级拼音首字母提取器（加入多音字姓氏特判字典）
                    const getPinyinInitials = (str) => {
                        const collator = new Intl.Collator('zh-Hans-CN', { numeric: true });
                        const letters = 'abcdefghjklmnopqrstwxyz';
                        const boundaries = ['阿','八','嚓','哒','妸','发','旮','哈','击','喀','垃','妈','拿','哦','啪','期','然','撒','塌','挖','昔','压','匝'];
                        
                        // 常见多音字姓氏字典（强制纠正首字母映射）
                        const surnameInitials = {
                            '曾': 'z', '解': 'x', '仇': 'q', '查': 'z', '单': 's', 
                            '区': 'o', '乐': 'y', '重': 'c', '种': 'c', '长': 'z', 
                            '句': 'g', '繁': 'p', '折': 's', '秘': 'b', '冼': 'x',
                            '盖': 'g', '朴': 'p', '翟': 'z', '尉': 'y', '燕': 'y',
                            '沈': 's', '黑': 'h', '宁': 'n', '缪': 'm', '华': 'h'
                        };

                        let res = '';
                        for (let i = 0; i < str.length; i++) {
                            let char = str[i];
                            
                            // 针对姓名的第一个字进行多音字姓氏特判拦截
                            if (i === 0 && surnameInitials[char]) {
                                res += surnameInitials[char];
                                continue;
                            }

                            if (!/[\u4e00-\u9fa5]/.test(char)) { 
                                res += char.toLowerCase(); 
                                continue; 
                            }
                            let found = false;
                            for (let j = boundaries.length - 1; j >= 0; j--) {
                                if (collator.compare(char, boundaries[j]) >= 0) {
                                    res += letters[j];
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) res += char.toLowerCase();
                        }
                        return res;
                    };
                    
                    // 2. 底层匹配：同时匹配【汉字】和【拼音首字母】
                    const matchingStudents = this.store.state.data.students.filter(s => {
                        return this._matchesPinyin(s.name || '', kw);
                    });
                    
                    // 静默处理：如果找不到匹配项，直接返回，不打断用户输入法
                    if (matchingStudents.length === 0) return;
                    
                    // 3. 找出这些学生所在的考试卡片并自动展开
                    container.querySelectorAll('details.exam-card').forEach(card => {
                        const eid = card.id.replace('e-card-', '');
                        const exam = this.store.state.data.exams.find(e => e.id === eid);
                        if (!exam) return;
                        
                        const exCampuses = this._getExamCampuses(exam);
                        const hasMatch = matchingStudents.some(s => s.grade === exam.grade && (exCampuses.length === 0 || exCampuses.includes(s.campus)));
                        
                        if (hasMatch) {
                            if (!card.open) {
                                card.open = true;
                                this.renderExamTables(eid); 
                            }
                            card.querySelectorAll('details.tree-level').forEach(innerCard => {
                                innerCard.open = true;
                            });
                        }
                    });
                    
                    // 4. 等待 DOM 渲染后进行页面高亮和滚动定位
                    setTimeout(() => {
                        const allRows = container.querySelectorAll('tbody tr');
                        let firstMatch = null;
                        
                        allRows.forEach(tr => {
                            const nameCell = tr.querySelector('td:first-child');
                            // 在表格实际行中再次用拼音+汉字双重校验
                            if (nameCell) {
                                const studentName = nameCell.textContent.trim();
                                const nameLower = studentName.toLowerCase();
                                const initials = getPinyinInitials(studentName);
                                const full = (window.pinyinPro && window.pinyinPro.pinyin) ? window.pinyinPro.pinyin(studentName, { toneType:'none', type:'string' }).replace(/\s+/g,'').toLowerCase() : '';
                                
                                if (nameLower.includes(kw) || initials.includes(kw) || full.includes(kw)) {
                                    tr.classList.add('search-highlight');
                                    if (!firstMatch) firstMatch = tr;
                                }
                            }
                        });
                        
                        if (firstMatch) {
                            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100);
                }
            }
/* Validate without rewriting records: legacy combined scores and stored totals stay authoritative. */
(() => {
 const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
 window.gk2ValidateCloud=function(c){
  if(!plain(c)||!plain(c.data)||['students','exams','scores','examTemplates'].some(k=>!Array.isArray(c.data[k])))throw Error('云端数据结构不完整');
  const check=window.gk2Migration.stage(JSON.stringify(c));
  if(check.errors.length)throw Error('云端数据校验未通过：'+check.errors.slice(0,3).join('；'));
  const stamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  if(c.ts!==undefined&&!stamp(c.ts))throw Error('云端版本无效');
  for(const k of ['students','exams','scores','examTemplates']){
   const deleted=c.deleted?.[k]??c.data.__deleted?.[k]??{};
   if(!plain(deleted)||Object.entries(deleted).some(([id,ts])=>!id||!stamp(ts)))throw Error('云端删除记录无效');
   for(const r of c.data[k]){
    if(r._fieldTs!==undefined&&(!plain(r._fieldTs)||Object.values(r._fieldTs).some(t=>!stamp(t))))throw Error('字段版本无效');
    const id=k==='scores'?`${r.studentId}_${r.examId}`:r.id;
    if(deleted[id]!==undefined&&deleted[id]>=(r._ts||0))throw Error('现存记录与删除版本冲突');
   }
  }
  return c;
 };
})();

/* Installed inside AppCore before construction. Local-only queue metadata never enters cloud payloads. */
(function installSafeSync(Store, Sync) {
 const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
 const kinds=['students','exams','scores','examTemplates'];
 const time=v=>Number.isFinite(Number(v))?Number(v):0;
 const key=(kind,r)=>kind==='scores'?`${r.studentId}_${r.examId}`:r.id;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 const canonical=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
 const newer=(a,b)=>!a?b:!b?a:time(a._ts)>time(b._ts)?a:time(b._ts)>time(a._ts)?b:canonical(a)>=canonical(b)?a:b;
 const originalShape=Store.prototype.ensureSyncShape,originalWrite=Store.prototype.writeLocalState;
 Store.prototype.ensureSyncShape=function(){originalShape.call(this);this.state.deleted.examTemplates ||= {};};
 Store.prototype._makeDeltaBucket=function(){return {students:{},exams:{},scores:{},examTemplates:null,deleted:Object.fromEntries(kinds.map(k=>[k,{}])),last_synced_at:this.state.syncMeta?.lastCloudTs||0};};
 Store.prototype.hasPendingDelta=function(d=this.pendingDelta){return !!d&&(kinds.some(k=>Object.keys(d.deleted?.[k]||{}).length)||kinds.slice(0,3).some(k=>Object.keys(d[k]||{}).length)||Array.isArray(d.examTemplates));};
 Store.prototype.mergePendingDelta=function(d){
  if(!d)return;const had=this.hasPendingDelta();const p=this.pendingDelta ||= this._makeDeltaBucket();
  if(!had&&d.operationId)p.operationId=d.operationId;else delete p.operationId;
  for(const k of kinds){p.deleted[k] ||= {};for(const [id,ts] of Object.entries(d.deleted?.[k]||{}))p.deleted[k][id]=Math.max(time(p.deleted[k][id]),time(ts));
   if(k!=='examTemplates')for(const [id,r] of Object.entries(d[k]||{}))p[k][id]=k==='scores'&&p[k][id]?Sync.prototype.mergeScoreRecord.call({store:this,recordWarning(){}},p[k][id],r):clone(newer(p[k][id],r));
  }
  if(Array.isArray(d.examTemplates)){const map=new Map((p.examTemplates||[]).map(r=>[r.id,r]));for(const r of d.examTemplates)map.set(r.id,clone(newer(map.get(r.id),r)));p.examTemplates=[...map.values()];}
  p.last_synced_at=Math.min(time(p.last_synced_at),time(d.last_synced_at));this.isDataChangedRef.current=this.hasPendingDelta();
 };
 Store.prototype.resetDeltaTracking=function(){
  this.lastLocalDataSnapshot=this.cloneSyncState();this.pendingDelta=null;
  const saved=this.state.localSync;
  if(saved?.format===1&&saved.deviceId===this.deviceId){this.mergePendingDelta(saved.inFlight);this.mergePendingDelta(saved.pending);}
  else {const d=this._makeDeltaBucket();for(const k of kinds){if(k==='examTemplates'){if(this.state.data[k].length)d[k]=clone(this.state.data[k]);}else for(const r of this.state.data[k])d[k][key(k,r)]=clone(r);Object.assign(d.deleted[k],this.state.deleted[k]);}if(this.hasPendingDelta(d))this.mergePendingDelta(d);}
  this.isDataChangedRef.current=this.hasPendingDelta();
 };
 Store.prototype.buildDeltaSinceSnapshot=function(){
  const before=this.lastLocalDataSnapshot||{data:{},deleted:{}},d=this._makeDeltaBucket();this.ensureSyncShape();
  for(const k of kinds){const prev=new Map((before.data[k]||[]).map(r=>[key(k,r),r])),next=new Map(this.state.data[k].map(r=>[key(k,r),r]));
   const changed=[];for(const [id,r] of next)if(JSON.stringify(prev.get(id))!==JSON.stringify(r)){
    const old=prev.get(id),priorRecordTs=time(r._ts);
    const observedDeletion=Math.max(time(before.deleted?.[k]?.[id]),time(this.state.deleted[k]?.[id]));
    const ts=Math.max(Date.now(),priorRecordTs,time(old?._ts)+1,observedDeletion+1);r._ts=ts;
    if(k==='scores'){
     r._fieldTs ||= {};
     // Legacy rows may have only a record timestamp. Seed unchanged fields from
     // the PREVIOUS snapshot before advancing _ts, or an untouched field would
     // incorrectly inherit this edit's timestamp and overwrite a peer's change.
     const seed=(field,present)=>{if(!own(r._fieldTs,field))r._fieldTs[field]=own(old?._fieldTs,field)?time(old._fieldTs[field]):present?time(old?._ts??priorRecordTs):0;};
     for(const f of new Set([...Object.keys(old?.details||{}),...Object.keys(r.details||{}),...Object.keys(old?.questionCounts||{}),...Object.keys(r.questionCounts||{})])){
      seed(f,own(old?.details,f)||own(old?.questionCounts,f));
      if(JSON.stringify(old?.details?.[f])!==JSON.stringify(r.details?.[f])||JSON.stringify(old?.questionCounts?.[f])!==JSON.stringify(r.questionCounts?.[f]))r._fieldTs[f]=ts;
     }
     for(const [prop,f] of [['total','__total'],['estimatedTotal','__estimatedTotal'],['examAbsent','__examAbsent']]){
      seed(f,own(old,prop));
      if(JSON.stringify(old?.[prop])!==JSON.stringify(r[prop]))r._fieldTs[f]=ts;
     }
    }
    changed.push(clone(r));
   }
   if(k==='examTemplates'){if(changed.length)d[k]=changed;}else for(const r of changed)d[k][key(k,r)]=r;
   for(const [id,r] of prev)if(!next.has(id))this.state.deleted[k][id]=Math.max(time(this.state.deleted[k][id]),Date.now(),time(r._ts)+1);
   for(const [id,ts] of Object.entries(this.state.deleted[k]))if(time(before.deleted?.[k]?.[id])!==time(ts))d.deleted[k][id]=ts;
  }
  return this.hasPendingDelta(d)?d:null;
 };
 Store.prototype.writeLocalState=function(){
  this.stagePendingDeltaFromCurrent();
  this.state.localSync={format:1,deviceId:this.deviceId,pending:clone(this.pendingDelta),inFlight:clone(this._syncInFlight||null),warnings:(this.state.localSync?.warnings||[]).slice(-50)};
  try{
   const signature=JSON.stringify(this.state);
   if(signature===this._lastWrittenState){
    const migration=window.gk2Migration;
    if(this._migrationRaw!==undefined&&migration&&localStorage.getItem(migration.key)!==this._migrationRaw)throw Error('副本已被其他页面修改，请先重新加载');
    return;
   }
   originalWrite.call(this);this._lastWrittenState=signature;this._syncLocalError='';
  }catch(e){this._syncLocalError=e.message||'本机保存失败';this.hasUnsavedChanges=true;throw e;}
 };
 Store.prototype.silentSave=function(){try{this.writeLocalState();}catch(e){this._syncLocalError=e.message||'本机保存失败';this.state.syncMeta.lastError=this._syncLocalError;throw e;}};
 // hasUnsavedChanges also spans the upload debounce; it is not a local-write
 // receipt. Keep the local persistence label independent of cloud queue state.
 Store.prototype.getLocalSaveStatus=function(){return this._syncLocalError||(this._scoreLocalSaveTimer?'等待保存':'已保存');};
 // Diagnostics stay local; no protocol change and no silent total correction.
 Sync.prototype.recordWarning=function(code,record,detail){
  const local=this.store.state.localSync ||= {format:1,deviceId:this.store.deviceId};
  const warnings=local.warnings ||= [];
  const item={code,studentId:record?.studentId,examId:record?.examId,detail};
  if(!warnings.some(w=>JSON.stringify({...w,time:undefined})===JSON.stringify(item)))warnings.push({...item,time:Date.now()});
  local.warnings=warnings.slice(-50);
 };
 // Explicit stored totals and absent-with-values records are authoritative; never derive them during transport.
 Sync.prototype.mergeScoreRecord=function(a,b){
  if(!a||!b)return clone(a||b);if(JSON.stringify(a)===JSON.stringify(b))return clone(a);
  const out=clone(newer(a,b));out.details={};out._fieldTs={};
  const hasCounts=own(a,'questionCounts')||own(b,'questionCounts');if(hasCounts)out.questionCounts={};
  const stamp=(r,f,present)=>own(r._fieldTs,f)?time(r._fieldTs[f]):present?time(r._ts):0;
  for(const f of new Set([...Object.keys(a.details||{}),...Object.keys(b.details||{}),...Object.keys(a.questionCounts||{}),...Object.keys(b.questionCounts||{}),...Object.keys(a._fieldTs||{}),...Object.keys(b._fieldTs||{})])){
   if(f.startsWith('__'))continue;const ah=own(a.details,f)||own(a.questionCounts,f),bh=own(b.details,f)||own(b.questionCounts,f),at=stamp(a,f,ah),bt=stamp(b,f,bh);
   if(at===bt&&at>0&&ah&&bh){const left={score:a.details?.[f],count:a.questionCounts?.[f]},right={score:b.details?.[f],count:b.questionCounts?.[f]};if(JSON.stringify(left)!==JSON.stringify(right))this.recordWarning('same-version-field-choice',a,{field:f,left,right,timestamp:at});}
   const fieldValue=r=>({scorePresent:own(r.details,f),score:r.details?.[f],countPresent:own(r.questionCounts,f),count:r.questionCounts?.[f]});
   const r=at>bt?a:bt>at?b:canonical(fieldValue(a))>=canonical(fieldValue(b))?a:b;if(own(r.details,f))out.details[f]=r.details[f];if(hasCounts&&own(r.questionCounts,f))out.questionCounts[f]=r.questionCounts[f];out._fieldTs[f]=Math.max(at,bt);
  }
  for(const [prop,f] of [['total','__total'],['estimatedTotal','__estimatedTotal'],['examAbsent','__examAbsent']]){
   const at=stamp(a,f,own(a,prop)),bt=stamp(b,f,own(b,prop)),r=at>bt?a:bt>at?b:canonical({present:own(a,prop),value:a[prop]})>=canonical({present:own(b,prop),value:b[prop]})?a:b;
   if(own(r,prop))out[prop]=clone(r[prop]);else delete out[prop];out._fieldTs[f]=Math.max(at,bt);
  }
  // Only recompute totals whose contributors are known derived totals. A
  // historical explicit total or absent-with-values row remains authoritative.
  const derived=r=>!r.examAbsent&&Number.isFinite(r.total)&&Object.values(r.details||{}).every(Number.isFinite)&&Math.abs(Object.values(r.details||{}).reduce((n,v)=>n+v,0)-r.total)<.011&&(r._totalMode==='details-v1'||own(r._fieldTs,'__total'));
  if(!out.examAbsent&&derived(a)&&derived(b)){
   out.total=Math.round((Object.values(out.details).reduce((n,v)=>n+v,0)+Number.EPSILON)*100)/100;
   out._totalMode='details-v1';
   out._fieldTs.__total=Math.max(time(out._fieldTs.__total),...Object.keys(out.details).map(f=>time(out._fieldTs[f])));
  }
  out._ts=Math.max(time(a._ts),time(b._ts),...Object.values(out._fieldTs));
  const exam=this.store.state.data.exams.find(e=>e.id===out.examId);
  if(exam){const result=window.gk2Statistics.inspect(out,exam);if(result.issues.includes('total-detail-mismatch')||result.issues.includes('absent-with-values'))this.recordWarning('merged-values-review',out,{storedTotal:out.total,detailTotal:result.detailTotal,details:out.details,examAbsent:!!out.examAbsent,issues:result.issues});}
  return out;
 };
 const normalize=Sync.prototype.normalizeCloud;
 Sync.prototype.normalizeCloud=function(c){
  if(!c||typeof c!=='object'||!c.data||kinds.some(k=>!Array.isArray(c.data[k])))throw Error('云端数据结构不完整，已停止合并；本机数据保留。');
  window.gk2ValidateCloud(c);
  const out=normalize.call(this,clone(c));out.deleted ||= {};
  for(const k of kinds){const seen=new Set();out.deleted[k] ||= {};if(typeof out.deleted[k]!=='object'||Array.isArray(out.deleted[k]))throw Error('云端删除记录格式无效');for(const r of out.data[k]){if(!r||typeof r!=='object'||(k==='scores'? !r.studentId||!r.examId:!r.id))throw Error('云端记录缺少标识');const id=key(k,r);if(seen.has(id))throw Error('云端存在重复记录，已停止合并');seen.add(id);}}
  return out;
 };
 Sync.prototype.applyDeltaToCloud=function(c,d={}){
  const out=this.normalizeCloud(c);
  for(const k of kinds){const map=new Map(out.data[k].map(r=>[key(k,r),r])),incoming=k==='examTemplates'?(d[k]||[]):Object.values(d[k]||{});
   for(const r of incoming){const id=key(k,r),old=map.get(id);map.set(id,k==='scores'&&old?this.mergeScoreRecord(old,r):clone(newer(old,r)));}
   for(const [id,ts] of Object.entries(d.deleted?.[k]||{}))out.deleted[k][id]=Math.max(time(out.deleted[k][id]),time(ts));
   out.data[k]=[...map.values()].filter(r=>{
    const id=key(k,r),deletedTs=out.deleted[k][id],keep=!own(out.deleted[k],id)||time(deletedTs)<time(r._ts);
    if(!keep)this.recordWarning('deletion-suppressed-record',r,{kind:k,id,recordTs:time(r._ts),deletedTs:time(deletedTs)});
    return keep;
   });
  }
  out.ts=Math.max(Date.now(),time(out.ts)+1);out.syncMeta={...out.syncMeta,deviceId:this.store.deviceId,last_synced_at:d.last_synced_at||0,lastPushedAt:Date.now()};return out;
 };
 // Reconcile ALL retained local versions, including changes that received an
 // earlier acknowledgement but were later overwritten by a competing snapshot.
 Sync.prototype.repairDelta=function(remote,merged){
  const d=this.store._makeDeltaBucket();
  for(const k of kinds){
   const records=new Map(remote.data[k].map(r=>[key(k,r),r]));
   const changed=merged.data[k].filter(r=>canonical(records.get(key(k,r)))!==canonical(r));
   if(k==='examTemplates'){if(changed.length)d[k]=clone(changed);}else for(const r of changed)d[k][key(k,r)]=clone(r);
   for(const [id,ts] of Object.entries(merged.deleted[k]||{}))if(time(ts)>time(remote.deleted[k]?.[id]))d.deleted[k][id]=ts;
  }
  return this.store.hasPendingDelta(d)?d:null;
 };
 Sync.prototype.merge=function(c){
  const remote=this.normalizeCloud(c),s=this.store;s.ensureSyncShape();
  if(time(remote.ts)<time(s.state.syncMeta.lastCloudTs))this.recordWarning('older-cloud-snapshot',null,{received:remote.ts,previous:s.state.syncMeta.lastCloudTs});
  const d=s._makeDeltaBucket();for(const k of kinds){if(k==='examTemplates')d[k]=clone(s.state.data[k]);else for(const r of s.state.data[k])d[k][key(k,r)]=clone(r);Object.assign(d.deleted[k],s.state.deleted[k]);}
  const merged=this.applyDeltaToCloud(remote,d),before=canonical([s.state.data,s.state.deleted]);
  const repair=this.repairDelta(remote,merged);
  s.state.data=merged.data;s.state.deleted=merged.deleted;s.state.ts=Math.max(time(s.state.ts),time(remote.ts));s.rebuildScoreIndex();s.lastLocalDataSnapshot=s.cloneSyncState();
  if(repair)s.mergePendingDelta(repair);
  return before!==canonical([s.state.data,s.state.deleted]);
 };
 Sync.prototype.refreshMergedView=function(options={}){
  const ui=window.app?.ui;if(!ui)return;
  if(document.activeElement?.classList.contains('score-input')&&ui.cur==='exams')ui.pendingRemoteExamRefresh=true;
  else if(document.querySelector('dialog[open]')||(options.silent&&['analysis','details','student-dashboard'].includes(ui.cur)))ui.pendingRemoteRefresh=true;
  else ui.refresh();
 };
 Sync.prototype._push=async function(){
  if(!this.isEnabled()||!this.store.hasPendingDelta()||(this._testEnabled&&!this._testWriteEnabled))return;
  if(this.isPushing||this.isPulling){this.pendingPush=true;return;}
  const s=this.store,identity=JSON.stringify(window.__gakutenAuth?.getAuth());
  const checkIdentity=()=>{if(identity!==JSON.stringify(window.__gakutenAuth?.getAuth()))throw Error('身份已变化，未继续确认上传；本机队列保留。');};
  let d=null,success=false;this.isPushing=true;
  try{
   s.stagePendingDeltaFromCurrent();s.writeLocalState();d=s.consumePendingDelta();d.operationId ||= s.deviceId+':'+Date.now()+':'+Math.random().toString(36).slice(2);s._syncInFlight=clone(d);s.writeLocalState();this.setDot('unsaved','正在同步；修改已保存在本机');
   let merged;
   for(let attempt=0;attempt<3;attempt++){
    const remote=this._serverSyncProtocol==='kv-replicas-v2'?this.normalizeCloud({...s.state,ts:s.state.syncMeta.lastCloudTs||0}):await this.fetchCloud();checkIdentity();if(!this.isEnabled())throw Error('同步已关闭，未继续上传');d.last_synced_at=remote.ts;
    const local=s._makeDeltaBucket();for(const k of kinds){if(k==='examTemplates')local[k]=clone(s.state.data[k]);else for(const r of s.state.data[k])local[k][key(k,r)]=clone(r);Object.assign(local.deleted[k],s.state.deleted[k]);}
    merged=this.applyDeltaToCloud(this.applyDeltaToCloud(remote,local),d);
    try{checkIdentity();if(!this.isEnabled())throw Error('同步已关闭，未继续上传');const ack=await this.postCloud(merged,d);checkIdentity();if(ack?.data)merged=ack;break;}catch(e){if(e.code!=='STALE_CLOUD_VERSION'||attempt===2)throw e;}
   }
   // Flush edits made during the request before merging the acknowledged snapshot.
   s.stagePendingDeltaFromCurrent();const changed=this.merge(merged);if(changed)this.refreshMergedView();s.state.syncMeta.lastCloudTs=Math.max(time(s.state.syncMeta.lastCloudTs),time(merged.ts));s.state.syncMeta.lastPushedAt=Date.now();s.state.syncMeta.lastError='';
   s._syncInFlight=null;s.hasUnsavedChanges=s.hasPendingDelta();s.writeLocalState();success=true;
   this.setDot(s.hasPendingDelta()?'unsaved':'synced',s.hasPendingDelta()?'仍有新修改待上传':'云端已确认，本机已保存');
  }catch(e){if(d)s.mergePendingDelta(d);s._syncInFlight=null;s.state.syncMeta.lastError=e.message||'同步失败';try{s.writeLocalState();}catch(saveError){s._syncLocalError=saveError.message;s.state.syncMeta.lastError=saveError.message;}
   this.setDot('error',s._syncLocalError||s.state.syncMeta.lastError);
  }finally{this.isPushing=false;const again=this.pendingPush;this.pendingPush=false;if(success&&(again||s.hasPendingDelta()))this.push();}
 };
 Sync.prototype.pull=async function(options={}){
  if(!this.isEnabled()||this.isPulling||this.isPushing)return false;
  const s=this.store;this.isPulling=true;let changed=false;
  try{s.stagePendingDeltaFromCurrent();s.writeLocalState();const remote=await this.fetchCloud(options);if(!this.isEnabled())throw Error('同步已关闭，未应用读取结果');s.stagePendingDeltaFromCurrent();changed=this.merge(remote);s.state.syncMeta.lastPulledAt=Date.now();s.state.syncMeta.lastCloudTs=Math.max(time(s.state.syncMeta.lastCloudTs),time(remote.ts));s.state.syncMeta.lastError='';s.writeLocalState();
   if(changed)this.refreshMergedView(options);
   this.setDot(s.hasPendingDelta()?'unsaved':'synced',s.hasPendingDelta()?'本机修改待上传':'云端已读取，本机已保存');return changed;
  }catch(e){s.state.syncMeta.lastError=e.message||'读取失败';this.setDot('error',s.state.syncMeta.lastError);return false;}
  finally{this.isPulling=false;if(this.pendingPush||(!this._testEnabled&&s.hasPendingDelta())){this.pendingPush=false;this.push();}}
 };
})(Store, Sync);

/* Local range checks prevent mistakes; the browser password is not authentication. */
(function(Store,UI){
 const P=window.gk2Policy={
  auth:()=>window.__gakutenAuth?.getAuth()||null,
  admin(){return this.auth()?.mode==='admin';},
  student(s){const a=this.auth();return !!s&&(a?.mode==='admin'||a?.mode==='teacher'&&s.campus===a.campus&&s.grade===a.grade&&s.teachingClass===a.classId);},
  studentForExam(s,exam){return !!exam&&Utils.canReadStudent(s,exam);},
  examParticipant(s,exam){const campuses=exam?.campuses?.length?exam.campuses:exam?.campus?[exam.campus]:[];return !!s&&!!exam&&Utils.isStudentInExam(s,exam)&&s.grade===exam.grade&&(!campuses.length||campuses.includes(Utils.getClassForExam(s,exam).campus));},
  score(value){const raw=String(value??'').trim();return raw===''||/^\d+(?:\.\d*)?$|^\.\d+$/.test(raw)&&Number.isFinite(Number(raw))&&Number(raw)>=0;},
  deny(message='当前身份没有此操作权限'){Utils.msg(message,'error');return false;}
 };
 Store.prototype.exportBackup=function(){
  if(!P.admin())return P.deny('整套数据备份仅管理员可导出。教师请使用成绩详情导出。');
  const url=URL.createObjectURL(new Blob([JSON.stringify(this.state)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download='Gakuten_Data_Backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);
  try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  Utils.msg('备份文件已生成，请查看浏览器下载列表');
 };
 const reset=Store.prototype.reset;
 Store.prototype.reset=function(){
  if(!P.admin())return P.deny('仅管理员可以清空本机数据。');
  const M=window.gk2Migration;
  if(!localStorage.getItem(M.key))return reset.call(this);
  window.app.ui.showConfirmDialog('将清空当前浏览器中的学生、考试和成绩。上一份数据及原始导入文件会保留，可在“导入备份 / 恢复数据”中恢复。正式云端不会改变。',()=>{
   try{window.app?.sync?.pauseForLocalReset?.();this.writeLocalState();M.clear(localStorage,this._migrationRaw);clearTimeout(this.saveTimeout);this.saveTimeout=null;location.reload();}
   catch(error){Utils.msg('未清空：'+error.message,'error');}
  },'清空本机数据（可恢复）');
 };
 for(const name of ['saveVal','saveEstimated','saveCorrectCount','toggleExamAbsent','openStudentProfile']){
  const original=UI.prototype[name];UI.prototype[name]=function(...args){
   const student=this.store.state.data.students.find(s=>s.id===args[0]);
   const exam=name==='openStudentProfile'?null:this.store.state.data.exams.find(e=>e.id===args[1]);
   if(!(name==='openStudentProfile'?P.student(student):P.studentForExam(student,exam)))return P.deny('只能查看或修改当前身份与考试时归属范围内的学生。');
   if(name==='saveVal'||name==='saveEstimated'||name==='saveCorrectCount'){
    const value=args[name==='saveEstimated'?2:3],input=args[name==='saveEstimated'?3:name==='saveCorrectCount'?7:6];
    if(!P.score(value)){this._setScoreWarning(input,'请输入有效的非负数字，当前成绩未改变');input?.setAttribute?.('aria-invalid','true');return false;}
    input?.removeAttribute?.('aria-invalid');if(input)this._setScoreWarning(input,'');
   }
   return original.apply(this,args);
  };
 }
 const sanitizeCache=cache=>{
  if(!cache||P.auth()?.mode!=='teacher')return;
  if(cache.pool)cache.pool=cache.pool.filter(row=>P.student(row));
  if(cache.originalPool)cache.originalPool=cache.originalPool.filter(row=>P.student(row));
  if(cache.absentRows)cache.absentRows=cache.absentRows.filter(row=>P.student(row));
 };
 const details=UI.prototype.exportDetailTableExcel;
 UI.prototype.exportDetailTableExcel=function(){
  if(!P.auth())return P.deny('请先登录。');
  if(this.analysisCache)sanitizeCache(this.analysisCache);
  return details.call(this);
 };
 const applyAuth=UI.prototype.applyAuthAccessControl;
 UI.prototype.applyAuthAccessControl=function(...args){
  const ret=applyAuth.apply(this,args);
  if(this.analysisCache)sanitizeCache(this.analysisCache);
  return ret;
 };
 const renderRows=UI.prototype.renderAnalysisTableRows;
 UI.prototype.renderAnalysisTableRows=function(...args){
  if(this.analysisCache)sanitizeCache(this.analysisCache);
  return renderRows.apply(this,args);
 };
 // Confirmations are invalidated by identity, filters or data changes. This also
 // protects delayed destructive actions which were opened by a previous identity.
 const confirmation=UI.prototype.showConfirmDialog;
 UI.prototype.showConfirmDialog=function(message,onConfirm,...args){
  const stamp=()=>JSON.stringify([P.auth(),this.store.state.globalFocus,this.store.state.data]);
  const before=stamp();
  return confirmation.call(this,message,()=>{
   if(before!==stamp()||!P.auth())return P.deny('身份、范围或数据已变化，请重新检查后操作。');
   return onConfirm();
  },...args);
 };
 const bulkDelete=UI.prototype.bulkDeleteStudents;
 const updateStudent=UI.prototype.updStu;
 UI.prototype.updStu=function(id,field,value){
  const student=this.store.state.data.students.find(s=>s.id===id);
  if(!P.student(student)||!P.student({...student,[field]:String(value??'').trim()}))return P.deny('只能修改本人适用范围内的信息；转班或变更校区、年级请由管理员处理。');
  return updateStudent.call(this,id,field,value);
 };
 const addStudent=UI.prototype.doAddStudent;
 UI.prototype.doAddStudent=function(...args){
  const value=id=>document.getElementById(id)?.value.trim();
  if(!P.student({campus:value('as-campus'),grade:value('as-grade'),teachingClass:value('as-tclass')||'未分日语班'}))return P.deny('新学生必须属于当前身份的适用范围。');
  return addStudent.apply(this,args);
 };
 const deleteStudent=UI.prototype.delStu;
 UI.prototype.delStu=function(id){
  const data=this.store.state.data,student=data.students.find(s=>s.id===id);
  if(!P.student(student)||(!P.admin()&&data.scores.some(r=>r.studentId===id&&!P.studentForExam(student,data.exams.find(e=>e.id===r.examId)))))return P.deny('此学生或其历史成绩超出当前适用范围，请由管理员处理。');
  return deleteStudent.call(this,id);
 };
 UI.prototype.bulkDeleteStudents=function(...args){
  const ids=this._getSelectedRosterStudentIds(),data=this.store.state.data;
  if(!P.auth()||ids.some(id=>!P.student(data.students.find(s=>s.id===id))))return P.deny();
  if(!P.admin()&&data.scores.some(r=>ids.includes(r.studentId)&&!P.studentForExam(data.students.find(s=>s.id===r.studentId),data.exams.find(e=>e.id===r.examId))))return P.deny('所选学生含适用范围外的历史成绩，请由管理员处理。');
  return bulkDelete.apply(this,args);
 };
 const deleteClass=UI.prototype.deleteExamClass;
 UI.prototype.deleteExamClass=function(eid,campus,className){
  const data=this.store.state.data,exam=data.exams.find(e=>e.id===eid);
  if(!exam||!P.auth())return P.deny();
  const auth=P.auth();if(!P.admin()&&(auth.campus!==campus||auth.grade!==exam.grade||auth.classId!==className))return P.deny();
  const scored=new Set(data.scores.filter(r=>r.examId===eid).map(r=>r.studentId));
  const affected=data.students.filter(s=>{const at=Utils.getClassForExam(s,exam);return scored.has(s.id)&&at.campus===campus&&at.teachingClass===className;});
  if(affected.some(s=>!P.studentForExam(s,exam)))return P.deny('本次清空包含适用范围外学生，请由管理员处理。');
  return deleteClass.call(this,eid,campus,className);
 };
 const deleteExam=UI.prototype.deleteExam;
 UI.prototype.deleteExam=function(eid){
  const data=this.store.state.data,exam=data.exams.find(e=>e.id===eid);
  if(!exam||!P.auth())return P.deny();
  const outsideRoster=data.students.some(s=>P.examParticipant(s,exam)&&!P.studentForExam(s,exam));
  const outsideScores=data.scores.some(r=>r.examId===eid&&!P.studentForExam(data.students.find(s=>s.id===r.studentId),exam));
  if(!P.admin()&&(outsideRoster||outsideScores))return P.deny('整场考试影响其他教师范围，请由管理员处理。');
  return deleteExam.call(this,eid);
 };
 window.addEventListener('gk2-auth-changed',()=>{
  const ui=window.app?.ui;if(!ui)return;
  ui._classAiRequest?.abort('身份已变化，请重新生成报告。');
  document.getElementById('class-ai-tab-card')?.replaceChildren();
  window.gk2Comfort?.close(true);document.getElementById('gk2-inspector-content')?.replaceChildren();
  ui._pendingConfirmAction=null;ui.analysisCache=null;ui._profileCurrentStudentId=null;
  ui._profileStudentOrder=null;ui._profileOrderTable=null;ui.store.history=[];
  const G=window.gk2;if(G){G.snapshot=null;G.linkBack=null;G.chartContexts?.clear();G.entryStates?.clear();}
  const assistant=window.gk2BI;
  if(assistant){assistant.request?.controller.abort();assistant.suggestionRequest?.controller.abort();clearTimeout(assistant.suggestionTimer);assistant.request=null;assistant.suggestionRequest=null;assistant.history=[];assistant.suggestionBundle=null;assistant.suggestionKey=null;assistant.messageContext=null;assistant.setBusy?.(false);}
  for(const id of ['gk2-bi-messages','gk2-bi-prompts','gk2-bi-suggestion-state'])document.getElementById(id)?.replaceChildren();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  document.querySelectorAll('input[type="checkbox"][data-sid],.stu-checkbox,.roster-student-checkbox').forEach(input=>input.checked=false);
 });
})(Store,UI);

/* Only an explicitly configured loopback test service is reachable. No production toggle. */
(function(Sync,UI){
 const target=window.gk2CloudTarget;
 const endpoint=target?.endpoint||'http://127.0.0.1:8976/api/gakuten-v2';
 Sync.prototype.isEnabled=function(){return this._testEnabled===true&&window.gk2Policy?.admin()===true&&!!this._testToken;};
 Sync.prototype.setEnabled=function(enabled){
  this._connectionEpoch=(this._connectionEpoch||0)+1;this._testEnabled=false;this.pendingPush=false;
  clearTimeout(this.pollTimer);this.debouncedPush?.cancel?.();this._requestController?.abort();
  if(enabled)throw Error('请在“数据保存与同步”中验证测试连接，再启用。');
  this._testToken='';this._serverRevision=null;this._preview=null;window.gk2TestTransportActive=false;
  this.setDot('unsaved','测试连接已关闭；已发出的提交需要重连核对，本机队列保留');
 };
 Sync.prototype._testRequest=async function(method,body){
  if(!this.isEnabled())throw Error('测试连接未开启，或当前身份不是管理员');
  const epoch=this._connectionEpoch||0,controller=new AbortController();this._requestController=controller;
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(endpoint,{method,signal:controller.signal,redirect:'error',credentials:'omit',headers:{'Content-Type':'application/json','Authorization':'Bearer '+this._testToken,'X-Gakuten-Protocol':'2'},...(body?{body:JSON.stringify(body)}:{})});
   if(epoch!==(this._connectionEpoch||0)||!this.isEnabled())throw Error('连接状态已变化，请重新验证');
   if(response.status===409){const e=Error('测试云端版本已变化');e.code='STALE_CLOUD_VERSION';throw e;}
   if(!response.ok)throw Error('测试服务请求失败：HTTP '+response.status);
   const result=await response.json();
   if(epoch!==(this._connectionEpoch||0)||!this.isEnabled())throw Error('连接状态已变化，请重新验证');
   if(result.protocol!==2||result.environment!==(target?.environment||'local-test')||result.minClientVersion!==2||result.atomicRevision!==true||!Number.isSafeInteger(result.revision)||result.revision<0)throw Error('服务端协议不匹配，禁止连接');
   if(target&&typeof result.writable!=='boolean')throw Error('云端写入能力声明无效');
   window.gk2ValidateCloud(result);this._serverWritable=result.writable!==false;return result;
  }finally{clearTimeout(timer);if(this._requestController===controller)this._requestController=null;}
 };
 Sync.prototype.connectTest=async function(token){
  this.setEnabled(false);
  if(!window.gk2Policy?.admin())throw Error('仅管理员可以连接测试服务');
  if(!localStorage.getItem(window.gk2Migration.key))throw Error('请先导入数据副本；演示数据禁止上传。');
  if(!token?.trim())throw Error('请输入测试服务令牌');
  this._testToken=token.trim();this._testEnabled=true;window.gk2TestTransportActive=true;
  try{const preview=await this._testRequest('GET');this._serverRevision=preview.revision;this._preview=preview;this.setDot('unsaved','测试连接已验证；仅预览，尚未合并或上传');return preview;}
  catch(e){this.setEnabled(false);throw e;}
 };
 Sync.prototype.fetchCloud=async function(){const r=await this._testRequest('GET');this._serverRevision=r.revision;return r;};
 Sync.prototype.postCloud=async function(merged,delta){
  if(!this.isEnabled()||!Number.isSafeInteger(this._serverRevision))throw Error('请先验证测试连接');
  if(this._serverWritable===false)throw Error('服务端目前只允许读取，尚未启用写入');
  window.gk2ValidateCloud(merged);
  const operation={...delta};delete operation.last_synced_at;
  const result=await this._testRequest('POST',{expectedRevision:this._serverRevision,operationId:delta.operationId,operation,snapshot:{data:merged.data,deleted:merged.deleted,ts:merged.ts}});
  if(result.acknowledgedOperationId!==delta.operationId)throw Error('服务端未确认本次操作，队列保留');
  this._serverRevision=result.revision;return result;
 };
 Sync.prototype.manualSync=async function(){throw Error('请使用同页同步面板中的测试读取或测试上传。');};
 Sync.prototype.checkpointTest=function(){
  if(!this.isEnabled())throw Error('请先验证测试连接');
  const s=this.store,M=window.gk2Migration;s.writeLocalState();const raw=localStorage.getItem(M.key);
  if(raw!==s._migrationRaw)throw Error('本机副本已改变，请重新载入');
  const slot=M.read(localStorage);slot.previous=JSON.parse(JSON.stringify(slot.state));const next=M.encode(slot);
  localStorage.setItem(M.key,next);if(localStorage.getItem(M.key)!==next)throw Error('恢复点保存失败，已停止同步');
  s._migrationRaw=next;
 };
 Sync.prototype.startAutoSync=function(){};
 Sync.prototype.pullIfDue=function(){};
 const apply=UI.prototype.applyAuthAccessControl;
 UI.prototype.applyAuthAccessControl=function(...args){
  const r=apply.apply(this,args),sync=window.app?.sync;
  if(sync?._testEnabled&&!window.gk2Policy.admin())sync.setEnabled(false);
  return r;
 };
})(Sync,UI);

            return { Store, Sync, UI };
        })();

        window.app = {};
        window.onload = () => {
            window.app.store = new AppCore.Store();
            window.app.isDataChangedRef = window.app.store.isDataChangedRef;
            window.app.sync = new AppCore.Sync(window.app.store);
            window.app.ui = new AppCore.UI(window.app.store);
            window.gk2AISettings.init();
            window.app.ui.switchView('analysis');
            window.app.store.updateUndoButton();
            window.app.sync.pull().catch(()=>{});

            // 移动端点击遮罩关闭侧边栏
            document.addEventListener('click', (e) => {
                const sidebar = document.querySelector('.sidebar');
                const btn = document.getElementById('mobile-menu-btn');
                if (window.innerWidth <= 768 && sidebar.classList.contains('sidebar-open')) {
                    if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
                        window.app.ui.closeSidebar();
                    }
                }
            });

                window.resizeAllCharts = function() {
                    try {
                        const map = window.__gakutenChartInstances;
                        if (map && typeof map.forEach === 'function') {
                            map.forEach(inst => {
                                try { if (inst && !(typeof inst.isDisposed === 'function' && inst.isDisposed())) inst.resize(); } catch(e) {}
                            });
                            return;
                        }
                        document.querySelectorAll('#sp-chart-trend, #sp-chart-radar, .chart-container, .chart').forEach(el => {
                            try { const inst = echarts.getInstanceByDom(el); if (inst) inst.resize(); } catch(e){}
                        });
                    } catch (e) { console.warn('resizeAllCharts error', e); }
                };

                

            // 新用户引导
            if (window.app.store.state.data.students.length === 0 && window.app.store.state.data.exams.length === 0 && !localStorage.getItem(window.gk2Migration.key)) {
                setTimeout(() => {
                    if (document.querySelector('dialog[open]')) return;
                    const guideHtml = `
                    <div class="empty-state empty-state--transparent">
                        <div class="empty-state-icon">${window.gk2IconMarkup('users')}</div>
                        <div class="empty-state-title">欢迎使用 Gakuten</div>
                        <div class="empty-state-desc">快速上手只需三步，系统会带你完成名单、成绩和诊断的第一轮闭环。</div>
                        <div class="guide-note" style="width:100%; max-width:360px;">
                            <div class="guide-step-card"><span>${window.gk2IconMarkup('users')}</span><b>添加学生</b><small>导入名单或手动添加学生</small></div>
                            <div class="guide-step-card"><span>${window.gk2IconMarkup('file')}</span><b>录入成绩</b><small>新建考试并录入或导入成绩</small></div>
                            <div class="guide-step-card"><span>${window.gk2IconMarkup('target')}</span><b>查看诊断</b><small>自动生成图表和报告</small></div>
                        </div>
                        <div class="empty-state-actions"><button class="primary" onclick="this.closest('dialog').close(); window.app.ui.startGuide();">开始引导</button></div>
                    </div>`;
                    const dialog = document.createElement('dialog');
                    dialog.className = 'dialog-shell dialog--md';
                    dialog.innerHTML = guideHtml;
                    document.body.appendChild(dialog);
                    dialog.showModal();
                    dialog.addEventListener('close', () => dialog.remove());
                }, 500);
            }
        };
    
