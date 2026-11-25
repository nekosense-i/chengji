/* Present JLPT scaled-score results without borrowing gaokao pass/excellent bands. */
(() => {
    'use strict';
    const G = window.gk2;
    const K = window.gk2KPI;
    if (!G || !K) return;

    const genericRender = K.render;
    K.render = function(summary) {
        if (summary.assessmentRule?.kind !== 'jlpt-official') return genericRender.call(this, summary);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = genericRender.call(this, summary);
        const cards = wrapper.querySelectorAll('.gk2-kpi-card');
        if (cards.length >= 4) {
            const title = (card, text) => { const node = card.querySelector('.gk2-kpi-top > span:first-child'); if (node) node.textContent = text; };
            const status = (card, text) => { const node = card.querySelector('.gk2-kpi-status'); if (node) node.textContent = text; };
            const sub = (card, text) => { const node = card.querySelector('.gk2-kpi-sub'); if (node) node.textContent = text; };
            const foot = (card, text) => { const node = card.querySelector('.gk2-kpi-foot'); if (node) node.textContent = text; };
            title(cards[1], '平均尺度分');
            status(cards[1], `JLPT ${summary.assessmentRule.level}`);
            sub(cards[1], '官方尺度分平均值；不表示答对率');
            title(cards[2], '官方合格率');
            status(cards[2], summary.valid ? `${summary.passCount} 人合格` : '暂无成绩');
            sub(cards[2], `${summary.passCount}/${summary.valid} 人 · 总分 ≥ ${summary.assessmentRule.passTotal}，且各项达到基准`);
            foot(cards[2], summary.valid ? `未合格 ${summary.valid - summary.passCount} 人` : '等待成绩录入');
            title(cards[3], '分项达标率');
            status(cards[3], summary.valid ? `${summary.sectionPassCount} 人各项达标` : '暂无成绩');
            sub(cards[3], `${summary.sectionPassCount}/${summary.valid} 人 · 每个成绩项均达到基准分`);
            foot(cards[3], summary.valid ? `未达分项基准 ${summary.valid - summary.sectionPassCount} 人` : '等待成绩录入');
            cards[2].setAttribute('aria-label', '查看 JLPT 官方合格学生明细');
            cards[3].setAttribute('aria-label', '查看 JLPT 分项达标学生明细');
        }
        return wrapper.innerHTML;
    };

    const genericOverview = G.renderOverview;
    G.renderOverview = function(...args) {
        const result = genericOverview.apply(this, args);
        const snapshot = G.snapshot;
        const rule = window.gk2JLPT?.ruleForExam(snapshot?.exam);
        if (!rule) return result;

        const cards = document.querySelectorAll('#overview-summary .gk2-kpi-card');
        const bind = (card, title, rows, explanation) => {
            if (!card) return;
            const activate = () => G.drill(title, rows, snapshot.exam, explanation);
            card.onclick = activate;
            card.onkeydown = event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            };
        };
        bind(cards[2], 'JLPT 官方合格学生', snapshot.passRows || [], `官方规则：总分至少 ${rule.passTotal}/180，且所有成绩项达到各自基准分。`);
        bind(cards[3], 'JLPT 分项达标学生', snapshot.sectionPassRows || [], '所有成绩项达到各自的分项基准分；此项统计不代表总分已达到合格线。');

        const heatHeading = document.querySelector('#ov-card-heatmap .gk2-chart-heading b');
        const heatFoot = document.querySelector('#ov-card-heatmap .gk2-chart-foot');
        if (heatHeading) heatHeading.textContent = '各成绩项尺度分';
        if (heatFoot) heatFoot.textContent = '各项平均尺度分占该项满分比例';
        const bands = document.querySelectorAll('#ov-card-dist .gk2-dist-legend-item');
        ['<40% 满分占比', '40–60% 满分占比', '60–80% 满分占比', '≥80% 满分占比'].forEach((label, index) => {
            if (bands[index]?.querySelector('.full')) bands[index].querySelector('.full').textContent = label;
            if (bands[index]?.querySelector('.short')) bands[index].querySelector('.short').textContent = label;
        });
        return result;
    };
})();
