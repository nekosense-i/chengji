
        (function() {
            let request = null;
            window.__gakutenPinyinStatus = window.pinyinPro && typeof window.pinyinPro.pinyin === 'function' ? 'ready' : 'idle';
            window.__gakutenUpdatePinyinStatus = function() {
                const ready = !!(window.pinyinPro && typeof window.pinyinPro.pinyin === 'function');
                const loading = window.__gakutenPinyinStatus === 'loading';
                if (ready) window.__gakutenPinyinStatus = 'ready';
                document.querySelectorAll('.pinyin-status-dot').forEach(dot => {
                    dot.classList.toggle('ready', ready);
                    dot.title = ready ? '拼音搜索可用' : loading ? '拼音组件正在准备' : '使用拼音搜索时加载组件';
                });
                document.querySelectorAll('.auth-btn').forEach(btn => {
                    const field = document.getElementById('auth-teacher-id');
                    const teacherEntry = field && !field.hidden;
                    btn.classList.toggle('is-loading', loading && !teacherEntry);
                    btn.disabled = loading && !teacherEntry;
                    const text = btn.querySelector('.auth-btn-text');
                    if (text) text.textContent = teacherEntry || ready ? '登录' : loading ? '正在准备...' : window.__gakutenPinyinStatus === 'failed' ? '重试拼音组件' : '登录';
                });
            };
            window.__gakutenLoadPinyin = function() {
                if (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function') {
                    window.__gakutenPinyinStatus = 'ready';
                    window.__gakutenUpdatePinyinStatus();
                    return Promise.resolve(true);
                }
                if (request) return request;
                window.__gakutenPinyinStatus = 'loading';
                window.__gakutenUpdatePinyinStatus();
                request = window.gk2Dependencies.ensure('pinyin').then(ready => {
                    window.__gakutenPinyinStatus = ready ? 'ready' : 'failed';
                    window.__gakutenUpdatePinyinStatus();
                    return ready;
                }).finally(() => { request = null; });
                return request;
            };
            document.addEventListener('DOMContentLoaded', () => {
                window.__gakutenUpdatePinyinStatus();
                const input = document.getElementById('auth-password');
                input?.addEventListener('focus', () => {
                    if (!window.__gakutenAuth?.getAuth()) window.__gakutenLoadPinyin();
                });
                document.addEventListener('focusin', event => {
                    const target = event.target;
                    if (!(target instanceof HTMLInputElement) || window.pinyinPro) return;
                    const label = [target.id, target.placeholder, target.getAttribute('aria-label')].join(' ');
                    if (/姓名|拼音/.test(label)) window.__gakutenLoadPinyin();
                });
            }, { once: true });
        })();
    
;

        (function() {
            if (window.__gakutenEChartsThemePatched) return;
            window.__gakutenEChartsThemePatched = true;

            const THEME_COLORS = ['#4E79A7','#F28E2C','#E15759','#76B7B2','#59A14F','#EDC949','#AF7AA1','#FF9DA7','#9C755F','#BAB0AB'];
            const TOOLTIP_THEME = { showDelay: 220, hideDelay: 100, transitionDuration: 0.12,
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderWidth: 0.5,
                textStyle: { color: '#334155', fontSize: 14 },
                extraCssText: 'border-radius:12px;',
                axisPointer: { type: 'line', lineStyle: { color: 'rgba(174,174,178,0.45)', width: 1 } }
            };

            function clone(value) {
                if (value == null || typeof value !== 'object') return value;
                if (Array.isArray(value)) return value.map(clone);
                const out = {};
                for (const key in value) out[key] = clone(value[key]);
                return out;
            }

            const SOFT_CHART_SHADOW = 'rgba(49,65,92,0.12)';
            const SOFT_TEXT_SHADOW = 'rgba(49,65,92,0.14)';

            function addSoftShadow(style, blur, offsetY) {
                if (!style || typeof style !== 'object' || Array.isArray(style)) style = {};
                const next = { ...style };
                const currentBlur = Number(next.shadowBlur);
                next.shadowBlur = Number.isFinite(currentBlur) ? Math.max(currentBlur, blur) : blur;
                if (!next.shadowColor || next.shadowColor === 'transparent') next.shadowColor = SOFT_CHART_SHADOW;
                if (next.shadowOffsetX == null) next.shadowOffsetX = 0;
                if (next.shadowOffsetY == null) next.shadowOffsetY = offsetY;
                return next;
            }

            function removeItemShadow(style) {
                if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
                const next = { ...style };
                delete next.shadowBlur;
                delete next.shadowColor;
                delete next.shadowOffsetX;
                delete next.shadowOffsetY;
                return next;
            }

            function addSoftTextShadow(style) {
                if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
                const next = { ...style };
                if (!next.textShadowColor || next.textShadowColor === 'transparent') next.textShadowColor = SOFT_TEXT_SHADOW;
                const currentBlur = Number(next.textShadowBlur);
                next.textShadowBlur = Number.isFinite(currentBlur) ? Math.max(currentBlur, 1.5) : 1.5;
                if (next.textShadowOffsetX == null) next.textShadowOffsetX = 0;
                if (next.textShadowOffsetY == null) next.textShadowOffsetY = 1;
                if (next.rich && typeof next.rich === 'object' && !Array.isArray(next.rich)) {
                    next.rich = Object.fromEntries(Object.entries(next.rich).map(([key, fragment]) => [key, addSoftTextShadow(fragment)]));
                }
                return next;
            }

            function mergeVisualMap(visualMap) {
                if (!visualMap) return visualMap;
                const applyOne = (item) => {
                    if (!item || typeof item !== 'object') return item;
                    const next = clone(item);
                    if (next.textStyle) next.textStyle = addSoftTextShadow(next.textStyle);
                    return next;
                };
                return Array.isArray(visualMap) ? visualMap.map(applyOne) : applyOne(visualMap);
            }

            function mergeAxis(axis) {
                if (!axis) return axis;
                const applyOne = (item) => {
                    if (!item || typeof item !== 'object') return item;
                    const next = clone(item);
                    next.axisLine = { ...(next.axisLine || {}), lineStyle: { ...(next.axisLine && next.axisLine.lineStyle ? next.axisLine.lineStyle : {}), color: '#aeaeb2' } };
                    next.axisTick = { ...(next.axisTick || {}), lineStyle: { ...(next.axisTick && next.axisTick.lineStyle ? next.axisTick.lineStyle : {}), color: '#aeaeb2' } };
                    next.splitLine = { ...(next.splitLine || {}), lineStyle: { ...(next.splitLine && next.splitLine.lineStyle ? next.splitLine.lineStyle : {}), color: 'rgba(174,174,178,0.18)' } };
                    if (next.axisLabel) next.axisLabel = addSoftTextShadow(next.axisLabel);
                    if (next.nameTextStyle) next.nameTextStyle = addSoftTextShadow(next.nameTextStyle);
                    return next;
                };
                return Array.isArray(axis) ? axis.map(applyOne) : applyOne(axis);
            }

            function mergeSeries(series, opt) {
                if (!series) return series;
                const applyOne = (item) => {
                    if (!item || typeof item !== 'object') return item;
                    const next = clone(item);
                    const type = next.type;
                    const addLabelShadow = label => {
                        if (label === true) return addSoftTextShadow({ show: true });
                        return addSoftTextShadow(label);
                    };
                    if (next.label) next.label = addLabelShadow(next.label);
                    if (next.labelLine && next.labelLine.lineStyle) {
                        next.labelLine = { ...next.labelLine, lineStyle: addSoftShadow(next.labelLine.lineStyle, 1.5, 1) };
                    }
                    ['emphasis', 'blur', 'select'].forEach(state => {
                        if (!next[state] || typeof next[state] !== 'object') return;
                        next[state] = { ...next[state] };
                        if (next[state].label) next[state].label = addLabelShadow(next[state].label);
                        if (next[state].itemStyle && type === 'heatmap') {
                            next[state].itemStyle = removeItemShadow(next[state].itemStyle);
                        } else if (next[state].itemStyle && ['bar', 'pie'].includes(type)) {
                            next[state].itemStyle = addSoftShadow(next[state].itemStyle, type === 'pie' ? 6 : 5, 1);
                        }
                        if (next[state].lineStyle && type === 'line') next[state].lineStyle = addSoftShadow(next[state].lineStyle, 3, 1);
                    });
                    if (Array.isArray(next.data)) {
                        next.data = next.data.map(dataItem => {
                            if (!dataItem || typeof dataItem !== 'object' || Array.isArray(dataItem)) return dataItem;
                            const styled = { ...dataItem };
                            if (styled.label) styled.label = addLabelShadow(styled.label);
                            if (styled.itemStyle && type === 'heatmap') {
                                styled.itemStyle = removeItemShadow(styled.itemStyle);
                            } else if (styled.itemStyle && ['bar', 'pie', 'line'].includes(type)) {
                                styled.itemStyle = addSoftShadow(styled.itemStyle, type === 'pie' ? 6 : type === 'bar' ? 5 : 3, 1);
                            }
                            return styled;
                        });
                    }
                    if (next.type === 'bar') {
                        next.itemStyle = next.itemStyle || {};
                        // 基于 Y 轴判断是否为横向柱状图：
                        // 仅当 Y 轴为类目轴（显式 type === 'category' 或提供了 data）时，视为横向柱图
                        let isHorizontal = false;
                        if (opt && opt.yAxis) {
                            const ya = Array.isArray(opt.yAxis) ? opt.yAxis[0] : opt.yAxis;
                            if (ya && (ya.type === 'category' || ya.data)) {
                                isHorizontal = true;
                            }
                        }
                        next.itemStyle.borderRadius = isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0];
                        next.itemStyle = addSoftShadow(next.itemStyle, 5, 1);
                        if (!next.barMaxWidth) next.barMaxWidth = 48;
                    }
                    if (next.type === 'line') {
                        next.smooth = true;
                        next.symbol = next.symbol || 'circle';
                        next.symbolSize = next.symbolSize || 6;
                        next.lineStyle = addSoftShadow({ ...(next.lineStyle || {}), width: 2.5 }, 3, 1);
                        next.itemStyle = addSoftShadow(next.itemStyle, 3, 1);
                    }
                    if (next.type === 'pie') {
                        next.itemStyle = addSoftShadow(next.itemStyle, 6, 1);
                    }
                    if (next.type === 'heatmap') {
                        next.itemStyle = removeItemShadow(next.itemStyle || {});
                        if (next.itemStyle.borderRadius == null) next.itemStyle.borderRadius = 4;
                    }
                    return next;
                };
                return Array.isArray(series) ? series.map(applyOne) : applyOne(series);
            }

            function mergeTheme(option) {
                if (!option || typeof option !== 'object') return option;
                const next = clone(option);
                next.color = THEME_COLORS;
                next.textStyle = addSoftTextShadow({ color: '#1d1d1f', ...(next.textStyle || {}) });
                next.title = next.title ? { ...(next.title || {}), textStyle: addSoftTextShadow({ color: '#1d1d1f', fontWeight: 700, ...(next.title.textStyle || {}) }), subtextStyle: addSoftTextShadow({ color: '#6e6e73', ...(next.title.subtextStyle || {}) }) } : next.title;
                next.legend = next.legend ? {
                    type: next.legend.type || 'scroll',
                    backgroundColor: next.legend.backgroundColor || 'rgba(255,255,255,0.86)',
                    borderRadius: next.legend.borderRadius || 8,
                    pageIconColor: next.legend.pageIconColor || '#0071e3',
                    pageIconInactiveColor: next.legend.pageIconInactiveColor || '#d1d5db',
                    pageButtonGap: next.legend.pageButtonGap || 6,
                    animation: next.legend.animation !== undefined ? next.legend.animation : true,
                    ...(next.legend || {}),
                    pageTextStyle: addSoftTextShadow({ color: '#8e8e93', fontSize: 11, ...(next.legend.pageTextStyle || {}) }),
                    textStyle: addSoftTextShadow({ color: '#6e6e73', ...(next.legend.textStyle || {}) }),
                    itemHeight: next.legend.itemHeight || 10,
                    itemWidth: next.legend.itemWidth || 12
                } : next.legend;
                if (next.tooltip) { const tip = Array.isArray(next.tooltip) ? next.tooltip[0] : next.tooltip; next.tooltip = { ...(tip || {}), ...TOOLTIP_THEME, showDelay: tip?.showDelay ?? TOOLTIP_THEME.showDelay, hideDelay: tip?.hideDelay ?? TOOLTIP_THEME.hideDelay }; }
                next.xAxis = mergeAxis(next.xAxis);
                next.yAxis = mergeAxis(next.yAxis);
                next.visualMap = mergeVisualMap(next.visualMap);
                next.series = mergeSeries(next.series, next);
                return next;
            }

            const install = () => {
                if (!window.echarts || window.__gakutenEChartsThemeInstalled) return;
                window.__gakutenEChartsThemeInstalled = true;
                window.__gakutenChartInstances = window.__gakutenChartInstances || new Map();
                const originalInit = window.echarts.init.bind(window.echarts);
                window.echarts.init = function(dom) {
                    if (dom && window.__gakutenChartInstances) {
                        const existing = window.__gakutenChartInstances.get(dom);
                        if (existing && !(typeof existing.isDisposed === 'function' && existing.isDisposed())) {
                            existing.__gakutenReuseNextSetOption = true;
                            return existing;
                        }
                    }
                    if (dom && dom.dataset) delete dom.dataset.rendered;
                    const chart = originalInit.apply(this, arguments);
                    if (dom && window.__gakutenChartInstances) window.__gakutenChartInstances.set(dom, chart);
                    if (chart && !chart.__gakutenThemeWrapped) {
                        const originalSetOption = chart.setOption.bind(chart);
                        chart.setOption = function(option, ...rest) {
                            if (chart.__gakutenReuseNextSetOption && rest.length === 0) {
                                chart.__gakutenReuseNextSetOption = false;
                                return originalSetOption(mergeTheme(option), { notMerge: true, lazyUpdate: false });
                            }
                            chart.__gakutenReuseNextSetOption = false;
                            return originalSetOption(mergeTheme(option), ...rest);
                        };
                        const originalDispose = chart.dispose ? chart.dispose.bind(chart) : null;
                        if (originalDispose) {
                            chart.dispose = function() {
                                try {
                                    const chartDom = chart.getDom && chart.getDom();
                                    if (chartDom && chartDom.dataset) delete chartDom.dataset.rendered;
                                    if (chartDom && window.__gakutenChartInstances) window.__gakutenChartInstances.delete(chartDom);
                                } catch(e) {}
                                return originalDispose();
                            };
                        }
                        chart.__gakutenThemeWrapped = true;
                    }
                    return chart;
                };
            };

            if (window.echarts) {
                install();
            } else {
                // ECharts is loaded with defer. Its deferred scripts execute before
                // DOMContentLoaded, so install the theme wrapper before the app's
                // window.onload chart initialization runs.
                document.addEventListener('DOMContentLoaded', install, { once: true });
                const timer = setInterval(() => {
                    if (window.echarts) {
                        clearInterval(timer);
                        install();
                    }
                }, 50);
                setTimeout(() => clearInterval(timer), 5000);
            }
        })();
    
;

        // 多音字修正词典（可按校区/姓名持续扩充）
        const POLYPHONE_DICT = {
            '成都': 'cheng du',
            '重庆': 'chong qing',
            '曾': 'zeng',
            '查': 'zha',
            '区': 'qu',
            '长': 'chang',
            '行': 'hang',
            '师上': 'shi shang',
            '育才': 'yu cai'
        };

        (function() {
            const AUTH_KEY = 'gakuten_auth';
            let __polyphoneInited = false;

            const ensurePolyphoneDict = () => {
                if (__polyphoneInited) return true;
                if (!window.pinyinPro) return false;
                const { customPinyin } = window.pinyinPro;
                if (typeof customPinyin !== 'function') return false;
                customPinyin(POLYPHONE_DICT);
                __polyphoneInited = true;
                return true;
            };

            const getOverlay = () => document.getElementById('auth-overlay');
            const getErrorBox = () => document.getElementById('auth-error');

            const getAuth = () => {
                try {
                    const raw = localStorage.getItem(AUTH_KEY);
                    if (!raw) return null;
                    const parsed = JSON.parse(raw);
                    if (!parsed || !parsed.mode) return null;
                    return window.gk2TeacherAccounts?.validateSession(parsed) ?? (parsed.teacherId ? null : parsed);
                } catch (e) {
                    return null;
                }
            };

            const saveAuth = (auth) => {
                const before = localStorage.getItem(AUTH_KEY);
                localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
                if (before !== JSON.stringify(auth)) window.dispatchEvent(new Event('gk2-auth-changed'));
            };

            const clearAuth = () => {
                localStorage.removeItem(AUTH_KEY);
                window.dispatchEvent(new Event('gk2-auth-changed'));
            };

            const createEmptyFilters = () => ({ campuses: [], grades: [], phases: [], tClasses: [], tags: [] });

            const resetCachedFilters = () => {
                try {
                    const STORE_KEY = 'gakuten_data_v1';
                    const raw = localStorage.getItem(STORE_KEY);
                    if (raw) {
                        const data = JSON.parse(raw);
                        if (data && typeof data === 'object') {
                            data.globalFocus = createEmptyFilters();
                            if (data.filters !== undefined) {
                                data.filters = createEmptyFilters();
                            }
                            localStorage.setItem(STORE_KEY, JSON.stringify(data));
                        }
                    }
                } catch (e) {}
                sessionStorage.removeItem('gakuten_admin_inited');
                sessionStorage.removeItem('gakuten_admin_user_cleared');
            };

            const buildAuthCandidates = () => {
                if (!ensurePolyphoneDict()) return [];
                const students = (window.app && window.app.ui && window.app.ui.store && window.app.ui.store.state && window.app.ui.store.state.data)
                    ? (window.app.ui.store.state.data.students || [])
                    : [];
                const { pinyin } = window.pinyinPro || {};
                if (typeof pinyin !== 'function') return [];

                const unique = new Map();
                students.forEach(s => {
                    const campus = String((s && s.campus) || '').trim();
                    const grade = String((s && s.grade) || '').trim();
                    const classId = String((s && (s.teachingClass || s.classId || s.class)) || '').trim();
                    if (!campus || !grade || !classId) return;

                    const key = `${campus}__${grade}__${classId}`;
                    if (unique.has(key)) return;

                    const campusCode = pinyin(campus, { pattern: 'first', toneType: 'none', type: 'array' })
                        .join('')
                        .toLowerCase()
                        .replace(/\s+/g, '');
                    const gradeDigits = ((grade.match(/\d+/g) || []).join('')).slice(-2);
                    const classCode = pinyin(classId, { toneType: 'none', type: 'array', nonZh: 'consecutive' })
                        .join('')
                        .replace(/\s+/g, '');
                    const expectedPassword = `${campusCode}${gradeDigits}${classCode}`;

                    unique.set(key, { campus, grade, classId, expectedPassword });
                });

                return [...unique.values()];
            };

            const resolveAuthByPassword = (password) => {
                const raw = String(password || '').trim();
                if (!raw) return null;
                if (raw === 'nekosensei') return { mode: 'admin' };

                if (!ensurePolyphoneDict() || !window.pinyinPro || typeof window.pinyinPro.pinyin !== 'function') {
                    return { __error: 'PINYIN_UNAVAILABLE' };
                }

                const candidates = buildAuthCandidates();
                const matched = candidates.find(item => item.expectedPassword === raw);
                if (!matched) return null;

                return {
                    mode: 'teacher',
                    campus: matched.campus,
                    grade: matched.grade,
                    classId: matched.classId
                };
            };

            const setErrorVisible = (visible, text) => {
                const box = getErrorBox();
                if (!box) return;
                box.textContent = text || '口令错误，请检查后重试。';
                box.style.display = visible ? 'block' : 'none';
                if (visible) {
                    box.classList.remove('shake');
                    void box.offsetWidth;
                    box.classList.add('shake');
                } else {
                    box.classList.remove('shake');
                }
            };

            const syncOverlayState = () => {
                const auth = getAuth();
                const body = document.body;
                const overlay = getOverlay();
                if (!body || !overlay) return auth;
                const locked = !auth;
                body.classList.toggle('auth-locked', locked);
                body.classList.toggle('auth-ready', !locked);
                overlay.style.display = locked ? 'flex' : 'none';
                if (!locked) setErrorVisible(false);
                return auth;
            };

            const applyAuthToUI = () => {
                const auth = syncOverlayState();
                if (auth && window.app && window.app.ui && typeof window.app.ui.applyAuthAccessControl === 'function') {
                    try { window.app.ui.applyAuthAccessControl(auth); } catch (e) {}
                }
                return auth;
            };

            const login = async () => {
                const input = document.getElementById('auth-password');
                const teacherField = document.getElementById('auth-teacher-id');
                const teacherId = teacherField && !teacherField.hidden ? teacherField.value.trim() : null;
                if (teacherId === '') { setErrorVisible(true, '请输入教师 ID。'); return false; }
                if (!teacherId && !window.pinyinPro && !await window.__gakutenLoadPinyin()) {
                    setErrorVisible(true, '拼音组件未能加载，请检查 assets/pinyin-pro.js 后重试。');
                    return false;
                }
                let auth;
                try {
                    auth = teacherId ? await window.gk2TeacherAccounts.signIn(teacherId) : resolveAuthByPassword(input ? input.value : '');
                } catch (error) {
                    setErrorVisible(true, error.message);
                    return false;
                }
                if (auth && auth.__error === 'PINYIN_UNAVAILABLE') {
                    setErrorVisible(true, '拼音组件正在加载，请稍候3秒后重试。');
                    return false;
                }
                if (!auth) {
                    setErrorVisible(true, teacherId ? '教师 ID 不存在或账号已停用。' : '账号或密码错误（请注意大小写）');
                    return false;
                }

                resetCachedFilters();
                saveAuth(auth);
                setErrorVisible(false);
                syncOverlayState();
                if (window.app && window.app.ui) {
                    try {
                        const emptyFilters = createEmptyFilters();
                        if (window.app.ui.store && window.app.ui.store.state) {
                            if (auth.mode === 'teacher') {
                                const forcedFilters = { ...emptyFilters, campuses: [auth.campus], grades: [auth.grade], tClasses: [auth.classId] };
                                window.app.ui.store.state.globalFocus = { ...forcedFilters };
                                window.app.ui.store.state.filters = { ...forcedFilters };
                            } else {
                                window.app.ui.store.state.globalFocus = { ...emptyFilters };
                                window.app.ui.store.state.filters = { ...emptyFilters };
                            }
                            if (typeof window.app.ui.store.save === 'function') {
                                window.app.ui.store.save();
                            }
                        }
                        window.app.ui.applyAuthAccessControl(auth);
                        window.app.ui.refresh();
                    } catch (e) {}
                }
                return true;
            };

            const logout = () => {
                const doLogout = async () => {
                    await window.gk2TeacherAccounts?.disconnectDirectory().catch(() => {});
                    if (window.gk2ReleaseTest) sessionStorage.setItem('gk2_logged_out', '1');
                    clearAuth();
                    resetCachedFilters();
                    if (window.app && window.app.ui && window.app.ui.store && window.app.ui.store.state) {
                        try {
                            const emptyFilters = createEmptyFilters();
                            window.app.ui.store.state.globalFocus = emptyFilters;
                            window.app.ui.store.state.filters = emptyFilters;
                            if (typeof window.app.ui.store.save === 'function') {
                                window.app.ui.store.save();
                            }
                        } catch (e) {}
                    }
                    try {
                        window.app && window.app.ui && window.app.ui.refresh && window.app.ui.refresh();
                    } catch (e) {}
                    location.reload();
                };
                if (window.app && window.app.ui && typeof window.app.ui.showConfirmDialog === 'function') {
                    window.app.ui.showConfirmDialog('确定要退出登录吗？', doLogout, '退出登录');
                } else if (confirm('确定要退出登录吗？')) {
                    doLogout();
                }
            };

            const togglePassword = () => {
                const input = document.getElementById('auth-password');
                const btn = document.querySelector('.auth-eye-btn');
                if (!input) return;
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                if (btn) btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
            };

            window.__gakutenAuth = { getAuth, saveAuth, clearAuth, resolveAuthByPassword, syncOverlayState, applyAuthToUI, login, logout };
            document.addEventListener('DOMContentLoaded', async () => {
                try {
                    const identity = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
                    if (!identity?.sharedDirectory) return;
                    const auth = await window.gk2TeacherAccounts.restoreSharedSession(identity);
                    const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
                    if (!stored?.sharedDirectory || stored.teacherId !== identity.teacherId) return;
                    if (auth) saveAuth(auth);
                    else clearAuth();
                    applyAuthToUI();
                    window.app?.ui?.refresh?.();
                } catch (error) {
                    setErrorVisible(true, '暂时无法连接云端教师账号，请重试。');
                }
            });
            window.__gakutenLogin = login;
            window.__gakutenLogout = logout;
            window.__gakutenTogglePassword = togglePassword;

            document.addEventListener('DOMContentLoaded', () => {
                if (window.__gakutenUpdatePinyinStatus) window.__gakutenUpdatePinyinStatus();
                const input = document.getElementById('auth-password');
                if (input) {
                    input.disabled = false;
                    input.readOnly = false;
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            login();
                        }
                    });
                }
                const passwordWrap = document.querySelector('.auth-password-wrap');
                if (passwordWrap && input) {
                    passwordWrap.addEventListener('pointerdown', () => {
                        if (getAuth()) return;
                        requestAnimationFrame(() => {
                            try { input.focus({ preventScroll: true }); } catch(e) { input.focus(); }
                        });
                    }, true);
                }
                syncOverlayState();
            });
        })();
    
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
            if (useSharedDirectory()) {
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
