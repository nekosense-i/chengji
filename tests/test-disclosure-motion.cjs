// Exercise the actual release UI with existing fictional data and blocked external requests.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/statistics.json')));
fixture.globalFocus = { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
fixture.currentExamId = 'fixture-exam';
fixture.data.exams[0].types[0].questionCount = 20;
const web = http.createServer((req, res) => {
    const file = path.resolve(site, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(file));
});
(async () => {
    await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const origin = 'http://127.0.0.1:' + web.address().port;
        await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
        await page.addInitScript(data => {
            for (const prefix of ['', 'gk2_live_v1:']) {
                localStorage.setItem(prefix + 'gakuten_data_v1', JSON.stringify(data));
                localStorage.setItem(prefix + 'gakuten_auth', JSON.stringify({ mode: 'admin' }));
            }
        }, fixture);
        await page.goto(origin + '/Gakuten-2.0.html');
        await page.waitForFunction(() => window.app?.ui && !document.getElementById('gk2-startup'));
        await page.evaluate(() => gk2.navigate('exams'));
        const before = await page.evaluate(() => JSON.stringify(app.store.state.data));
        const settled = selector => page.waitForFunction(selector => {
            const node = document.querySelector(selector);
            return node && !node.getAnimations().some(animation => animation.playState === 'running');
        }, selector);
        await page.locator('#gk2-exam-operations > summary').click();
        await settled('#gk2-exam-operations > .gk2-action-menu-body');

        for (const [trigger, panel] of [
            ['.gk2-entry-mode-settings-toggle', '#gk2-entry-mode-settings'],
            ['#gk2-entry-mode-toggle', '#gk2-entry-mode-options'],
            ['.gk2-entry-quickfill-settings-toggle', '#gk2-entry-quickfill-settings']
        ]) {
            const start = await page.evaluate(({ trigger, panel }) => {
                document.querySelector(trigger).click();
                const node = document.querySelector(panel), animation = node.getAnimations()[0];
                return { hidden: node.hidden, easing: animation?.effect.getTiming().easing, duration: animation?.effect.getTiming().duration };
            }, { trigger, panel });
            assert.equal(start.hidden, false); assert.match(start.easing, /cubic-bezier/); assert(start.duration >= 200);
            await settled(panel);
            const height = await page.locator(panel).evaluate(node => node.getBoundingClientRect().height);
            assert(height > 30);
            const closing = await page.evaluate(({ trigger, panel }) => {
                document.querySelector(trigger).click();
                const node = document.querySelector(panel);
                return { hidden: node.hidden, inert: node.inert, expanded: document.querySelector(trigger).getAttribute('aria-expanded') };
            }, { trigger, panel });
            assert.deepEqual(closing, { hidden: false, inert: true, expanded: 'false' });
            await page.waitForFunction(panel => document.querySelector(panel).hidden, panel);
            const clean = await page.locator(panel).evaluate(node => ({ height: node.style.height, overflow: node.style.overflow, inert: node.inert }));
            assert.deepEqual(clean, { height: '', overflow: '', inert: false });
        }
        console.log('PASS all three entry submenus animate both directions and release temporary styles.');

        await page.locator('.gk2-entry-mode-settings-toggle').click();
        await settled('#gk2-entry-mode-settings');
        await page.locator('input[name="gk2-entry-mode-default"]').first().focus();
        await page.evaluate(() => document.querySelector('.gk2-entry-mode-settings-toggle').click());
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains('gk2-entry-mode-settings-toggle')), true);
        await page.evaluate(() => {
            const gear = document.querySelector('.gk2-entry-mode-settings-toggle');
            gear.click(); gear.click(); gear.click();
        });
        await settled('#gk2-entry-mode-settings');
        assert.equal(await page.locator('#gk2-entry-mode-settings').evaluate(node => node.hidden || node.inert), false);
        await page.locator('#gk2-exam-operations > .gk2-action-menu-body').screenshot({ path: '/tmp/gakuten-disclosure-desktop.png' });
        console.log('PASS rapid reversal reaches the final open state and collapsing settings restores focus.');

        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#gk2-exam-operations').evaluate(node => node.open), true);
        await page.waitForFunction(() => !document.getElementById('gk2-exam-operations').open);

        const group = page.locator('#view-exams details.gk2-entry-class-group').first();
        await group.locator(':scope > summary').evaluate(node => node.click());
        assert.equal(await group.evaluate(node => node.getAnimations().length > 0), true);
        await page.waitForFunction(() => !document.querySelector('#view-exams details.gk2-entry-class-group').open);
        await group.locator(':scope > summary').evaluate(node => node.click());
        await settled('#view-exams details.gk2-entry-class-group');
        assert.equal(await group.evaluate(node => node.open && node.style.height === ''), true);
        console.log('PASS existing class disclosure uses the coordinated easing and restores its natural height.');

        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#gk2-exam-operations > summary').click();
        await settled('#gk2-exam-operations > .gk2-action-menu-body');
        await page.locator('.gk2-entry-quickfill-settings-toggle').click();
        await settled('#gk2-entry-quickfill-settings');
        await page.locator('#gk2-exam-operations > .gk2-action-menu-body').screenshot({ path: '/tmp/gakuten-disclosure-mobile.png' });
        const bounds = await page.locator('#gk2-exam-operations > .gk2-action-menu-body').boundingBox();
        assert(bounds.x >= 64 && bounds.x + bounds.width <= 390);
        console.log('PASS parent menu closes smoothly with Escape and mobile settings fit the content area.');

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => {
            const gear = document.querySelector('.gk2-entry-quickfill-settings-toggle'); gear.click(); gear.click(); gear.click();
        });
        assert.equal(await page.locator('#gk2-entry-quickfill-settings').evaluate(node => node.hidden), true);
        assert.equal(await page.locator('#gk2-entry-quickfill-settings').evaluate(node => node.getAnimations().length), 0);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#gk2-exam-operations').evaluate(node => node.open), false);
        assert.equal(await page.evaluate(() => JSON.stringify(app.store.state.data)), before);
        assert.deepEqual(errors, []);
        console.log('PASS reduced-motion interactions are immediate and leave exam and score data unchanged.');
    } finally { await browser.close(); await new Promise(resolve => web.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
