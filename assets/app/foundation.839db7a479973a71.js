
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
                    btn.classList.toggle('is-loading', loading);
                    btn.disabled = loading;
                    const text = btn.querySelector('.auth-btn-text');
                    if (text) text.textContent = ready ? '登录' : loading ? '正在准备...' : window.__gakutenPinyinStatus === 'failed' ? '重试拼音组件' : '登录';
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
                    return parsed;
                } catch (e) {
                    return null;
                }
            };

            const saveAuth = (auth) => {
                localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
            };

            const clearAuth = () => {
                localStorage.removeItem(AUTH_KEY);
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
                if (!window.pinyinPro && !await window.__gakutenLoadPinyin()) {
                    setErrorVisible(true, '拼音组件未能加载，请检查 assets/pinyin-pro.js 后重试。');
                    return false;
                }
                const auth = resolveAuthByPassword(input ? input.value : '');
                if (auth && auth.__error === 'PINYIN_UNAVAILABLE') {
                    setErrorVisible(true, '拼音组件正在加载，请稍候3秒后重试。');
                    return false;
                }
                if (!auth) {
                    setErrorVisible(true, '账号或密码错误（请注意大小写）');
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
                const doLogout = () => {
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
    