/* Installed after the durable queue and field merge, before construction.
 * Use the deployed snapshot + manifest endpoints; no database migration. */
(function (Store, Sync) {
    'use strict';
    const QUIET = 2000, MIN_UPLOAD = 4000, MAX_WAIT = 8000, POLL = 12000;
    const pending = s => s.hasPendingDelta() || !!s._syncInFlight;
    const online = () => navigator.onLine !== false;
    const render = () => window.gk2RenderCloudLamp?.();

    // Match the deployed gakuten-merge.js rule. Recalculate only when BOTH
    // inputs have internally consistent derived totals; retain historical totals.
    Sync.prototype._mergeDerivedTotal = function (a, b, out) {
        const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
        const derived = r => !r.examAbsent && Number.isFinite(r.total) &&
            Object.values(r.details || {}).every(Number.isFinite) &&
            Math.abs(Object.values(r.details || {}).reduce((n, v) => n + v, 0) - r.total) < 0.011 &&
            (r._totalMode === 'details-v1' || own(r._fieldTs, '__total'));
        if (!out.examAbsent && derived(a) && derived(b)) {
            out.total = Math.round((Object.values(out.details).reduce((n, v) => n + v, 0) + Number.EPSILON) * 100) / 100;
            out._totalMode = 'details-v1';
            out._fieldTs.__total = Math.max(Number(out._fieldTs.__total) || 0, ...Object.keys(out.details).map(f => Number(out._fieldTs[f]) || 0));
        }
    };

    Store.prototype.markAsUnsaved = function () {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
        clearTimeout(this._scoreLocalSaveTimer);
        this._scoreLocalSaveTimer = 0;
        this.hasUnsavedChanges = true;
        try {
            // Persist the value AND durable pending queue in one localStorage write.
            this.writeLocalState();
            this.hasUnsavedChanges = false;
        } catch (e) {
            this.state.syncMeta.lastError = this._syncLocalError = e.message;
            if (e.name === 'QuotaExceededError') this.showStorageQuotaWarning();
        }
        this.updateSaveIndicator();
        window.app?.sync?.push();
        render();
    };

    Sync.prototype.connectionStatus = function () {
        const s = this.store;
        const state = !this.isEnabled() ? 'paused'
            : !online() || s._syncLocalError || s.state.syncMeta.lastError ? 'error'
            : this._lampActive || this.isPulling || this.isPushing ? 'busy'
            : pending(s) ? 'pending' : this._lampState || 'busy';
        return { state };
    };
    const indicator = Store.prototype.updateSaveIndicator;
    Store.prototype.updateSaveIndicator = function () {
        indicator.call(this);
        const dot = document.getElementById('sync-dot');
        if (dot && pending(this) && !this.state.syncMeta.lastError) {
            dot.className = 'sync-dot unsaved';
            dot.title = '已保存到本机，等待云端确认';
        }
    };

    // GET may retry once. HTTP transport never replays a POST: queue retries
    // always read and merge the current server snapshot before submitting.
    Sync.prototype._legacyRequest = async function (method, payload, query = '') {
        if (!this.isEnabled()) throw Error('云同步已关闭，数据保留在本机');
        if (!online()) throw Error('网络已断开，修改保留在本机，联网后自动补传');
        if (method === 'POST' && !window.__gakutenAuth?.getAuth()) throw Error('请先登录，再上传成绩');
        const epoch = this._legacyEpoch || 0;
        for (let attempt = 0; ; attempt++) {
            const controller = new AbortController();
            this._legacyController = controller;
            const timer = setTimeout(() => controller.abort(), method === 'POST' ? 15000 : 12000);
            try {
                if (method === 'POST') window.gk2LegacyWriteAllowed = true;
                const url = method === 'GET' ? this.api + '?groupId=' + encodeURIComponent(this.groupId) + '&t=' + Date.now() + query : this.api;
                const response = await fetch(url, {
                    method, signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
                    ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {})
                });
                if (!this.isEnabled() || epoch !== (this._legacyEpoch || 0)) throw Error('同步已暂停，未继续确认返回数据');
                if (!response.ok) {
                    const e = Error('云端' + (method === 'GET' ? '读取' : '保存') + '失败：HTTP ' + response.status);
                    e.status = response.status;
                    if (response.status === 409 || response.status === 412) e.code = 'STALE_CLOUD_VERSION';
                    throw e;
                }
                const body = await response.json();
                if (!this.isEnabled() || epoch !== (this._legacyEpoch || 0)) throw Error('同步已暂停，未继续确认返回数据');
                return body;
            } catch (e) {
                if (!this.isEnabled() || epoch !== (this._legacyEpoch || 0)) throw e;
                if (method === 'GET' && attempt === 0 && online() && !document.hidden &&
                    (e.name === 'TypeError' || e.name === 'AbortError' || e.status >= 502 && e.status <= 504)) continue;
                if (e.name === 'TypeError' || e.name === 'AbortError') {
                    throw Error(method === 'POST' ? '上传结果未确认，修改保留在本机，将读取云端后重试' : '云端读取失败，修改保留在本机，将自动重试');
                }
                throw e;
            } finally {
                clearTimeout(timer);
                if (method === 'POST') window.gk2LegacyWriteAllowed = false;
                if (this._legacyController === controller) this._legacyController = null;
            }
        }
    };

    Sync.prototype.fetchCloud = async function () {
        this.lastPullAttemptAt = Date.now();
        const cloud = await this._legacyRequest('GET');
        if (cloud.groupId !== this.groupId || !Number.isSafeInteger(cloud.revision) || cloud.revision < 0) throw Error('云端房间或版本无效，本机修改保留');
        const normalized = this.normalizeCloud(cloud);
        this._responseRevision = cloud.revision;
        return normalized;
    };
    Sync.prototype.postCloud = async function (merged, delta) {
        if (this.isPulling) throw Error('正在读取，请稍后再上传');
        if (['students', 'exams', 'examTemplates'].some(k => merged.data[k].some(r => String(r.id).startsWith('demo-')))) throw Error('演示数据禁止上传');
        window.gk2ValidateCloud(merged);
        const payload = {
            groupId: this.groupId, ts: merged.ts, last_synced_at: delta.last_synced_at || 0,
            operationId: delta.operationId, data: { ...merged.data, __deleted: merged.deleted },
            deleted: merged.deleted, syncMeta: merged.syncMeta
        };
        const ack = await this._legacyRequest('POST', payload);
        // A peer's fields and the server timestamp can differ from the request.
        // Validate the authoritative snapshot AND exact operation receipt.
        if (ack.success !== true || ack.project !== this.groupId || ack.acceptedPayloadTs !== payload.ts ||
            ack.acknowledgedOperationId !== delta.operationId || !Number.isSafeInteger(ack.revision) ||
            ack.revision <= this._responseRevision || ack.data?.groupId !== this.groupId || ack.data.ts < payload.ts) {
            throw Error('云端未确认本次操作，修改仍在待同步队列');
        }
        const normalized = this.normalizeCloud(ack.data);
        this._responseRevision = ack.revision;
        return normalized;
    };

    Sync.prototype.push = function () {
        if (!this.isEnabled() || !this.store.hasPendingDelta()) return;
        if (!window.__gakutenAuth?.getAuth()) return;
        if (!online()) { render(); return; }
        if (this.isPulling || this.isPushing) { this.pendingPush = true; return; }
        const now = Date.now();
        this._firstDirtyAt ||= now;
        const due = Math.max(Math.min(now + QUIET, this._firstDirtyAt + MAX_WAIT),
            (this._uploadStartedAt || 0) + MIN_UPLOAD, this._retryAt || 0);
        clearTimeout(this._uploadTimer);
        this._uploadTimer = setTimeout(() => { this._uploadTimer = null; return this._push(); }, Math.max(0, due - now));
        render();
    };
    const upload = Sync.prototype._push;
    Sync.prototype._push = async function () {
        if (!this.isEnabled() || !this.store.hasPendingDelta()) return;
        if (this.isPushing || this.isPulling) { this.pendingPush = true; return; }
        if (!online()) { render(); return; }
        clearTimeout(this._uploadTimer);
        this._uploadTimer = null;
        this._uploadStartedAt = Date.now();
        this._firstDirtyAt = 0;
        await upload.call(this);
        if (!this.store.state.syncMeta.lastError) {
            this._retryAt = 0;
            this._uploadFailures = 0;
            this.store.state.syncMeta.lastCloudRevision = this._responseRevision;
            this.store.writeLocalState();
        } else {
            this._uploadFailures = (this._uploadFailures || 0) + 1;
            this._retryAt = Date.now() + Math.min(60000, 3000 * 2 ** Math.min(5, this._uploadFailures - 1));
        }
        if (this.store.hasPendingDelta()) this.push();
        else this._firstDirtyAt = 0;
        render();
    };
    const pull = Sync.prototype.pull;
    Sync.prototype.pull = async function (options = {}) {
        if (this.isPulling || this.isPushing) return false;
        const result = await pull.call(this, options);
        if (this.isEnabled() && !this.store.state.syncMeta.lastError) {
            this.store.state.syncMeta.lastCloudRevision = this._responseRevision;
            this.store.writeLocalState();
        }
        if (this.store.hasPendingDelta()) this.push();
        return result;
    };
    Sync.prototype.manualSync = async function () {
        clearTimeout(this.store.saveTimeout);
        this.store.saveTimeout = null;
        this.store.writeLocalState();
        this._retryAt = 0;
        if (this.store.hasPendingDelta()) await this._push();
        else await this.pull({ manual: true });
    };

    Sync.prototype.checkRemote = async function () {
        if (!this.isEnabled() || !online() || document.hidden || this._checkingRemote || this.isPulling || this.isPushing) return;
        if (this.store.hasPendingDelta()) { this.push(); return; }
        this._checkingRemote = true;
        try {
            const manifest = await this._legacyRequest('GET', null, '&mode=manifest');
            if (manifest.groupId !== this.groupId || !Number.isSafeInteger(manifest.revision) || manifest.revision < 0) throw Error('云端版本检查失败');
            if (manifest.revision !== this.store.state.syncMeta.lastCloudRevision) await this.pull({ silent: true });
            else if (!pending(this.store)) { this.store.state.syncMeta.lastError = ''; this._lampState = 'healthy'; }
        } catch (e) {
            this.store.state.syncMeta.lastError = e.message;
            this._lampState = 'error';
        } finally { this._checkingRemote = false; render(); }
    };
    // Replace 30s -> 5min idle backoff and discarded full-snapshot warmups.
    Sync.prototype.startAutoSync = function () {
        clearTimeout(this.pollTimer);
        if (!this.isEnabled() || document.hidden) return;
        this.pollTimer = setTimeout(async () => {
            try { await this.checkRemote(); } finally { this.startAutoSync(); }
        }, POLL);
    };
    Sync.prototype.prewarmConnection = function () { return this.checkRemote(); };
    Sync.prototype.pullIfDue = function () {
        if (!this.isEnabled() || document.hidden || !online()) return;
        this.startAutoSync();
        if (this.store.hasPendingDelta()) this.push();
        else this.checkRemote();
    };
    Sync.prototype.initNetworkEvents = function () {
        if (this._eventsBound) return;
        this._eventsBound = true;
        const resume = () => {
            this._retryAt = 0;
            this.startAutoSync();
            if (this.store.hasPendingDelta()) this.manualSync().catch(() => render());
            else this.checkRemote();
        };
        window.addEventListener('online', resume);
        window.addEventListener('focus', () => { if (!document.hidden && online()) resume(); });
        window.addEventListener('offline', () => {
            clearTimeout(this._uploadTimer);
            this.store.state.syncMeta.lastError = '网络已断开，修改保留在本机，联网后自动补传';
            render();
        });
        const persist = () => {
            try { this.store.writeLocalState(); } catch (e) { this.store._syncLocalError = e.message; }
            // No unload POST: durable in-flight data recovers on reopen.
        };
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { persist(); clearTimeout(this.pollTimer); }
            else if (online()) resume();
        });
        window.addEventListener('pagehide', persist);
        window.addEventListener('gk2-auth-changed', () => { if (online()) resume(); });
    };
    const enable = Sync.prototype.setEnabled;
    Sync.prototype.setEnabled = function (enabled) {
        clearTimeout(this._uploadTimer);
        this._uploadTimer = null;
        return enable.call(this, enabled);
    };
})(Store, Sync);
