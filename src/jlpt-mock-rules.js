/* JLPT teaching estimates: equal question weights within each scoring section. */
(() => {
    'use strict';
    const levels = Object.freeze({
        N1: { counts: [25, 20, 26, 30], pass: 100 },
        N2: { counts: [32, 22, 21, 32], pass: 90 },
        N3: { counts: [35, 23, 16, 28], pass: 95 },
        N4: { counts: [28, 21, 8, 28], pass: 90 },
        N5: { counts: [21, 17, 5, 24], pass: 80 }
    });
    const names = ['词汇', '文法', '阅读', '听力'];
    function evaluate(level, counts, correct) {
        const config = levels[level];
        if (!config || !Array.isArray(counts) || !Array.isArray(correct) || counts.length !== 4 || correct.length !== 4) return null;
        if (!counts.every(n => Number.isInteger(n) && n > 0)) return null;
        if (correct.some(n => n === null || n === undefined || n === '')) return { complete: false };
        if (!correct.every((n, i) => Number.isInteger(n) && n >= 0 && n <= counts[i])) return null;
        const ratio = indexes => indexes.reduce((sum, i) => sum + correct[i], 0) / indexes.reduce((sum, i) => sum + counts[i], 0);
        const sections = level === 'N4' || level === 'N5'
            ? [{ name: '语言知识＋阅读', score: ratio([0, 1, 2]) * 120, max: 120, minimum: 38 }, { name: '听力', score: ratio([3]) * 60, max: 60, minimum: 19 }]
            : [{ name: '语言知识', score: ratio([0, 1]) * 60, max: 60, minimum: 19 }, { name: '阅读', score: ratio([2]) * 60, max: 60, minimum: 19 }, { name: '听力', score: ratio([3]) * 60, max: 60, minimum: 19 }];
        const total = sections.reduce((sum, section) => sum + section.score, 0);
        return { complete: true, total, sections, passed: total >= config.pass && sections.every(section => section.score >= section.minimum), percentages: correct.map((n, i) => n / counts[i] * 100) };
    }
    window.gk2JLPTMock = Object.freeze({ levels, names, evaluate });
})();
