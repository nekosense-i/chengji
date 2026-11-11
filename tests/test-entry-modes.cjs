// Actual release UI, existing fictional fixture, isolated browser storage.
// External requests are blocked; no backend or production records are used.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/statistics.json')));
fixture.globalFocus = { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
fixture.currentExamId = 'fixture-exam';
fixture.data.scores = [];
Object.assign(fixture.data.exams[0], { entryMode: 'count', maxTotal: 80, types: [
    { name: 'A', max: 30, questionCount: 20 }, { name: 'B', max: 50, manualScore: true }
] });
const errors = [];
const web = http.createServer((req, res) => {
    const file = path.resolve(site, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(file));
});
(async () => {
    await new Promise(r => web.listen(0, '127.0.0.1', r));
    const origin = 'http://127.0.0.1:' + web.address().port;
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    try {
        async function open() {
            const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
            await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
            await context.addInitScript(f => {
                for (const prefix of ['', 'gk2_live_v1:']) {
                    if (!localStorage.getItem(prefix + 'gakuten_data_v1')) localStorage.setItem(prefix + 'gakuten_data_v1', JSON.stringify(f));
                    localStorage.setItem(prefix + 'gakuten_auth', JSON.stringify({ mode: 'admin' }));
                }
            }, fixture);
            const page = await context.newPage();
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(origin + '/Gakuten-2.0.html');
            await ready(page);
            return page;
        }
        async function ready(page) {
            await page.waitForFunction(() => window.app?.ui && !document.getElementById('gk2-startup'));
            await page.evaluate(() => { app.sync.stopAutoSync?.(); gk2.navigate('exams'); });
        }
        const page = await open();
        const field = name => page.locator(`input[data-sid="zero"][data-field="${name}"]`).first();
        async function edit(name, value) { await field(name).fill(''); if (value) await field(name).pressSequentially(value); }
        const record = () => page.evaluate(() => structuredClone(app.store.getScore('zero', 'fixture-exam')));
        const footer = () => field('A').evaluate(input => [...input.closest('table').querySelector('.gk2-entry-stats tr').cells].map(cell => cell.textContent));
        const data = () => page.evaluate(() => JSON.stringify(app.store.state.data));
        const menu = async () => { await page.locator('#gk2-exam-operations > summary').click(); };
        async function choose(mode) {
            await menu();
            await page.locator('#gk2-entry-mode-toggle').click();
            await page.locator(`[data-entry-mode-choice="${mode}"]`).click();
            await page.mouse.move(800, 700);
        }

        if (!process.env.ENTRY_UI_ONLY) {
        await field('A').fill('5');
        assert.equal((await record()).details.A, 7.5);
        assert.match((await footer())[2], /已填 1\/\d+均分 7.5/);
        assert.equal(await field('A').inputValue(), '5');
        await edit('B', '37');
        assert.equal((await record()).total, 44.5);
        assert.match((await footer()).at(-1), /均分 44.5/);
        console.log('PASS correct-count entry immediately refreshes type and total averages without switching.');

        const before = await data();
        await choose('wrong');
        assert.equal(await field('A').inputValue(), '15');
        assert.equal(await field('B').inputValue(), '37');
        assert.equal(await field('B').getAttribute('data-entry-kind'), 'score');
        assert.match(await field('A').getAttribute('aria-label'), /错误题数/);
        assert.equal(await data(), before);
        await field('A').fill('0');
        assert.equal((await record()).details.A, 30);
        assert.equal((await record()).questionCounts.A, 20);
        await edit('A', '20');
        assert.equal((await record()).details.A, 0);
        assert.equal((await record()).questionCounts.A, 0);
        assert.match((await footer())[2], /均分 0.0/);
        const valid = await record();
        await field('A').evaluate(input => { input.value = '21'; input.dispatchEvent(new Event('input', { bubbles: true })); });
        assert.equal(await field('A').getAttribute('aria-invalid'), 'true');
        await field('A').blur();
        assert.equal(await field('A').inputValue(), '20');
        assert.deepEqual(await record(), valid);
        await field('A').fill('');
        assert.equal((await record()).details.A, undefined);
        assert.equal((await record()).questionCounts.A, undefined);
        assert.match((await footer())[2], /已填 0\/\d+均分 -/);
        console.log('PASS wrong counts preserve canonical records, manual fields, zero, blanks, and invalid-input recovery.');

        page.once('dialog', dialog => dialog.accept('2'));
        await field('A').evaluate(input => input.closest('table').querySelector('.gk2-entry-type-quickfill').click());
        assert.equal((await record()).details.A, 27);
        assert.equal(await field('A').inputValue(), '2');
        await field('A').evaluate(input => input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: (() => { const d = new DataTransfer(); d.setData('text', '3'); return d; })() })));
        assert.equal((await record()).details.A, 25.5);
        assert.equal(await field('A').inputValue(), '3');
        await field('A').evaluate(input => input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: (() => { const d = new DataTransfer(); d.setData('text', '4\t35'); return d; })() })));
        await page.locator('#paste-preview-confirm').click();
        assert.equal((await record()).details.A, 24);
        assert.equal((await record()).details.B, 35);
        assert.equal(await field('A').inputValue(), '4');
        console.log('PASS quick fill, single-cell paste, and previewed multi-cell paste save wrong counts correctly.');

        await choose('score');
        assert.equal(await field('A').inputValue(), '24');
        await edit('A', '12');
        const offStep = await data();
        await choose('count');
        assert.equal(await field('A').inputValue(), '8');
        await choose('wrong');
        assert.equal(await field('A').inputValue(), '12');
        assert.equal(await data(), offStep);
        await choose('score');
        await edit('A', '12.1');
        const preserved = await data();
        await choose('wrong');
        assert.equal(await field('A').inputValue(), '');
        assert.equal(await field('A').getAttribute('placeholder'), '保留原分');
        assert.equal(await data(), preserved);
        assert.match(await field('A').locator('..').innerText(), /12.1分/);
        console.log('PASS three-mode round trips preserve scores, including scores without whole-question equivalents.');

        await menu();
        const heights = await page.locator('#gk2-exam-operations > .gk2-action-menu-body > button, #gk2-exam-operations .gk2-entry-quickfill-menu-control, #gk2-exam-operations .gk2-entry-mode-control').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
        assert(heights.length >= 6); assert(heights.every(height => height === 42), JSON.stringify(heights));
        await page.getByRole('button', { name: '设置默认录入模式', exact: true }).click();
        const localBefore = await data();
        await page.locator('input[name="gk2-entry-mode-default"][value="wrong"]').check();
        assert.equal(await data(), localBefore);
        assert.equal(await page.evaluate(() => localStorage.getItem('gk2_entry_mode_default_v1')), 'wrong');
        await page.reload(); await ready(page);
        assert.equal(await field('A').getAttribute('data-count-mode'), 'wrong');
        const other = await open();
        assert.equal(await other.evaluate(() => localStorage.getItem('gk2_entry_mode_default_v1')), null);
        assert.equal(await other.locator('input[data-sid="zero"][data-field="A"]').first().getAttribute('data-count-mode'), 'count');
        console.log('PASS menu row heights match, defaults survive reload, and a second browser keeps its own mode.');
        }
        if (process.env.ENTRY_UI_ONLY) {
            await page.evaluate(() => app.ui.toggleExamEntryMode('fixture-exam', 'wrong'));
            assert.equal(await field('A').getAttribute('placeholder'), '错题');
            assert.equal(await field('B').getAttribute('placeholder'), '');
            const gears = await page.evaluate(() => ['.gk2-entry-mode-settings-toggle svg', '.gk2-entry-quickfill-settings-toggle svg'].map(selector => document.querySelector(selector).outerHTML));
            assert.equal(gears[0], gears[1]);
            await page.evaluate(() => app.ui.toggleExamEntryMode('fixture-exam', 'count'));
            assert.equal(await field('A').getAttribute('placeholder'), '题数');
            await page.evaluate(() => app.ui.toggleExamEntryMode('fixture-exam', 'wrong'));
            console.log('PASS wrong-mode placeholder is 错题, correct-mode placeholder stays 题数, and both gear icons match.');
        }
        if (process.env.ENTRY_SCREENSHOT) {
            await menu(); await page.locator('#gk2-entry-mode-toggle').click();
            await page.screenshot({ path: process.env.ENTRY_SCREENSHOT });
            await page.setViewportSize({ width: 390, height: 844 });
            await page.locator('#gk2-exam-operations > summary').scrollIntoViewIfNeeded();
            await menu();
            const bounds = await page.locator('#gk2-exam-operations > .gk2-action-menu-body').boundingBox();
            const contentLeft = await page.locator('.main-content').evaluate(node => node.getBoundingClientRect().left);
            assert(bounds.x >= contentLeft && bounds.x + bounds.width <= 390, JSON.stringify(bounds));
            await page.getByRole('button', { name: '设置默认录入模式', exact: true }).click();
            await page.screenshot({ path: process.env.ENTRY_SCREENSHOT.replace('.png', '-mobile.png') });
            console.log('PASS mobile menu fits the viewport and exposes local default settings.');
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await new Promise(r => web.close(r)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
