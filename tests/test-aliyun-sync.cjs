/* Actual release page + existing SQLite backend, fictional fixture only.
 * One in-memory database and two isolated browsers; all external traffic blocked.
 * NODE_PATH=<bundled node_modules> node tests/test-aliyun-sync.cjs <built site> <backend repo>
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');
const site = path.resolve(process.argv[2]);
const { createApp } = require(path.resolve(process.argv[3], 'src/server.js'));
const group = 'gakuten_prod_stable_v1';
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/statistics.json')));
fixture.groupId = group;
fixture.deleted.examTemplates ||= {};
fixture.globalFocus = { campuses: [], grades: [], phases: [], tClasses: [], tags: [] };
fixture.currentExamId = 'fixture-exam';
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE kv_items(key TEXT PRIMARY KEY,value BLOB NOT NULL,expiration INTEGER,metadata_json TEXT);' +
    'CREATE TABLE gakuten_rooms(group_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,mirrored_revision INTEGER NOT NULL);' +
    'CREATE TABLE gakuten_snapshots(group_id TEXT NOT NULL,revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL,PRIMARY KEY(group_id,revision));');
const api = createApp(db);
const web = http.createServer((req, res) => {
    const file = path.resolve(site, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(file));
});
let hold = false, dropAck = false, gates = [], traffic = [], errors = [], networkDown = [false, false];
const contexts = [], pages = [];
const listen = app => new Promise(r => app.listen(0, '127.0.0.1', r));
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000) {
    const end = Date.now() + ms;
    while (!await fn()) { if (Date.now() > end) throw Error('Timed out: ' + fn); await wait(30); }
}
function seed() {
    db.exec('DELETE FROM gakuten_snapshots; DELETE FROM gakuten_rooms; DELETE FROM kv_items;');
    db.prepare('INSERT INTO gakuten_rooms VALUES(?,?,?)').run(group, 1, 1);
    db.prepare('INSERT INTO gakuten_snapshots VALUES(?,?,?)').run(group, 1, JSON.stringify(fixture));
}
const cloud = () => JSON.parse(db.prepare('SELECT snapshot_json FROM gakuten_snapshots ORDER BY revision DESC LIMIT 1').get().snapshot_json);
const score = (s, id = 'zero') => s.data.scores.find(r => r.studentId === id && r.examId === 'fixture-exam');
async function reset() {
    await until(async () => (await Promise.all(pages.map(p => p.evaluate(() => !app.sync.isPushing && !app.sync.isPulling)))).every(Boolean));
    seed(); traffic = []; hold = false; dropAck = false; gates = [];
    for (const p of pages) await p.evaluate(f => {
        const s = app.store, y = app.sync;
        clearTimeout(s.saveTimeout); clearTimeout(y._uploadTimer); clearTimeout(y.pollTimer);
        s.state = structuredClone(f); s.pendingDelta = null; s._syncInFlight = null;
        s.state.localSync = { format: 1, deviceId: s.deviceId, pending: null, inFlight: null };
        s.ensureSyncShape(); s.rebuildScoreIndex(); s.lastLocalDataSnapshot = s.cloneSyncState();
        s.state.syncMeta.lastCloudRevision = 1; s.state.syncMeta.lastError = ''; s.hasUnsavedChanges = false;
        s.writeLocalState();
        Object.assign(y, { _responseRevision: 1, _uploadStartedAt: 0, _retryAt: 0, _uploadFailures: 0, _firstDirtyAt: 0, pendingPush: false, _lampState: 'healthy' });
        app.ui.refresh(); gk2.navigate('exams'); y.startAutoSync();
    }, fixture);
}
const edit = (p, id, field, value) => p.evaluate(({ id, field, value }) => app.ui.saveVal(id, 'fixture-exam', field, String(value)), { id, field, value });
const push = p => p.evaluate(() => app.sync.manualSync());
const clean = p => p.evaluate(() => !app.store.hasPendingDelta() && !app.store._syncInFlight && !app.sync.isPushing && !app.store.state.syncMeta.lastError);
async function concurrent(left, right) {
    hold = true;
    await left(); await right();
    const a = push(pages[0]), b = push(pages[1]);
    await until(() => gates.length === 2);
    hold = false;
    gates[1](); await b; gates[0](); await a;
    assert(await clean(pages[0])); assert(await clean(pages[1]));
    await Promise.all(pages.map(p => p.evaluate(() => app.sync.pull({ silent: true }))));
}
(async () => {
    seed(); await listen(api); await listen(web);
    const origin = 'http://127.0.0.1:' + web.address().port;
    const apiOrigin = 'http://127.0.0.1:' + api.address().port;
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    try {
        for (let i = 0; i < 2; i++) {
            const context = await browser.newContext(); contexts.push(context);
            await context.route('**/*', async route => {
                const req = route.request(), url = new URL(req.url());
                if (url.origin === origin) return route.continue();
                if (url.hostname !== 'sync.nekosensei.cn' || url.pathname !== '/gakuten-all') return route.abort();
                if (networkDown[i]) return route.abort('failed');
                traffic.push({ device: i, method: req.method(), mode: url.searchParams.get('mode'), at: Date.now() });
                if (hold && req.method() === 'POST') await new Promise(resolve => gates.push(resolve));
                const response = await fetch(apiOrigin + url.pathname + url.search, {
                    method: req.method(), ...(req.postData() ? { headers: { 'Content-Type': 'application/json' }, body: req.postData() } : {})
                });
                const body = await response.text();
                if (dropAck && req.method() === 'POST') { dropAck = false; return route.abort('failed'); }
                await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body });
            });
            await context.addInitScript(f => {
                for (const prefix of ['', 'gk2_live_v1:']) {
                    if (!localStorage.getItem(prefix + 'gakuten_data_v1')) localStorage.setItem(prefix + 'gakuten_data_v1', JSON.stringify(f));
                    localStorage.setItem(prefix + 'gakuten_auth', JSON.stringify({ mode: 'admin' }));
                }
                window.alert = () => {}; window.confirm = () => true;
            }, fixture);
            const p = await context.newPage(); pages.push(p); p.on('pageerror', e => errors.push(e.message));
            await p.goto(origin + '/Gakuten-2.0.html');
            await p.waitForFunction(() => window.app?.ui && !document.getElementById('gk2-startup'));
            await until(() => clean(p));
        }

        await reset();
        await edit(pages[0], 'zero', 'A', 15);
        assert(await pages[0].evaluate(() => {
            const disk = gk2Migration.read(localStorage).state;
            return disk.localSync.pending.scores['zero_fixture-exam'].details.A === 15 && app.sync.connectionStatus().state === 'pending';
        }));
        await wait(1000); assert.equal(traffic.filter(r => r.method === 'POST').length, 0);
        await until(() => clean(pages[0])); assert.equal(score(cloud()).details.A, 15);
        assert.equal(traffic.filter(r => r.method === 'POST').length, 1);
        await pages[1].evaluate(() => app.sync.checkRemote());
        assert.equal(await pages[1].evaluate(() => app.store.getScore('zero', 'fixture-exam').details.A), 15);
        traffic = []; await pages[1].evaluate(() => app.sync.checkRemote());
        assert.deepEqual(traffic.map(r => r.mode), ['manifest']);
        console.log('PASS immediate durable save, 2s debounce, authoritative receipt, lightweight cross-device refresh');

        await reset();
        const started = Date.now();
        for (let n = 0; n < 9; n++) { await edit(pages[0], 'zero', 'A', n + 1); await wait(900); }
        await until(() => traffic.some(r => r.method === 'POST'), 3000);
        assert(traffic.find(r => r.method === 'POST').at - started < 10000);
        await until(() => clean(pages[0])); assert.equal(score(cloud()).details.A, 9);
        console.log('PASS continuous entry uploads within the bounded batch window');

        await reset();
        await concurrent(() => edit(pages[0], 'zero', 'A', 17), () => edit(pages[1], 'partial', 'B', 23));
        assert.equal(score(cloud()).details.A, 17); assert.equal(score(cloud(), 'partial').details.B, 23);
        await reset();
        await concurrent(() => edit(pages[0], 'zero', 'A', 18), () => edit(pages[1], 'zero', 'B', 22));
        assert.deepEqual(score(cloud()).details, { A: 18, B: 22 });
        assert.equal(score(cloud()).total, 40);
        for (const p of pages) assert.equal(await p.evaluate(() => app.store.getScore('zero', 'fixture-exam').total), 40);
        await reset();
        await edit(pages[0], 'zero', 'A', 18); await edit(pages[1], 'zero', 'B', 22);
        await push(pages[1]); await push(pages[0]);
        assert.deepEqual(score(cloud()).details, { A: 18, B: 22 }); assert.equal(score(cloud()).total, 40);
        const historic = await pages[0].evaluate(() => {
            const a = { studentId: 'zero', examId: 'fixture-exam', details: { A: 20, B: 40 }, total: 61, _ts: 20, _fieldTs: { A: 20, B: 1, __total: 20 } };
            const b = { studentId: 'zero', examId: 'fixture-exam', details: { A: 40, B: 10 }, total: 50, _ts: 30, _fieldTs: { A: 1, B: 30, __total: 30 } };
            return app.sync.mergeScoreRecord(a, b).total;
        });
        assert.equal(historic, 50);
        await reset();
        await concurrent(() => edit(pages[0], 'zero', 'A', 19), async () => { await wait(5); await edit(pages[1], 'zero', 'A', 29); });
        assert.equal(score(cloud()).details.A, 29);
        console.log('PASS out-of-order concurrent writes: different students, different fields/totals, same-field conflict');

        await reset();
        await concurrent(() => pages[0].evaluate(() => {
            const s = app.store; s.state.data.scores = s.state.data.scores.filter(r => r.studentId !== 'zero'); s.markAsUnsaved();
        }), () => pages[1].evaluate(() => {
            const s = app.store, student = { ...s.state.data.students[0], id: 'synthetic-new', name: '虚构新增学生', _ts: Date.now() };
            s.state.data.students.push(student); s.markAsUnsaved();
        }));
        assert(!score(cloud())); assert(cloud().data.students.some(s => s.id === 'synthetic-new'));
        console.log('PASS deletion and independent addition survive concurrent uploads');

        await reset(); await edit(pages[0], 'zero', 'A', 21); hold = true;
        const inflight = push(pages[0]); await until(() => gates.length === 1);
        await edit(pages[0], 'partial', 'B', 24);
        hold = false; gates[0](); await inflight;
        assert(await pages[0].evaluate(() => app.store.hasPendingDelta()));
        assert.equal(await pages[0].evaluate(() => app.sync.connectionStatus().state), 'pending');
        await until(() => clean(pages[0])); assert.equal(score(cloud(), 'partial').details.B, 24);
        console.log('PASS editing during upload remains pending and is automatically uploaded next');

        await reset(); await edit(pages[0], 'zero', 'A', 25); dropAck = true;
        await push(pages[0]);
        assert.equal(score(cloud()).details.A, 25);
        assert(await pages[0].evaluate(() => app.store.hasPendingDelta()));
        assert.equal(await pages[0].evaluate(() => app.sync.connectionStatus().state), 'error');
        await until(() => clean(pages[0]));
        const methods = traffic.filter(t => t.device === 0).map(t => t.method);
        assert.equal(methods.filter(x => x === 'POST').length, 2);
        assert(methods.indexOf('GET', methods.indexOf('POST') + 1) > methods.indexOf('POST'));
        console.log('PASS lost POST response retains queue and retries only after reading current cloud');

        await reset(); await contexts[0].setOffline(true);
        await edit(pages[0], 'zero', 'A', 27);
        networkDown[0] = true;
        // Allow the HTML to reload while the sync link stays unavailable.
        await contexts[0].setOffline(false);
        await pages[0].reload();
        await pages[0].waitForFunction(() => window.app?.ui && !document.getElementById('gk2-startup'));
        assert(await pages[0].evaluate(() => app.store.hasPendingDelta() && app.store.getScore('zero', 'fixture-exam').details.A === 27));
        networkDown[0] = false;
        await pages[0].evaluate(() => window.dispatchEvent(new Event('online')));
        await until(() => clean(pages[0])); assert.equal(score(cloud()).details.A, 27);
        await contexts[0].setOffline(true); await edit(pages[0], 'partial', 'B', 28);
        await wait(2200); assert(await pages[0].evaluate(() => app.store.hasPendingDelta()));
        await contexts[0].setOffline(false);
        await until(() => clean(pages[0])); assert.equal(score(cloud(), 'partial').details.B, 28);
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        assert.deepEqual(errors, []);
        console.log('PASS legacy snapshot, offline/reopen queue recovery, online automatic retry, SQLite integrity, no page errors');
    } finally {
        hold = false; for (const resolve of gates) resolve();
        await browser.close(); await new Promise(r => web.close(r)); await new Promise(r => api.close(r)); db.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
