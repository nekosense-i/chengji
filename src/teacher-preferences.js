(() => {
    const storage = window.gk2TeacherPreferenceStorage;
    if (!storage) return;
    const auth = () => window.__gakutenAuth.getAuth();
    let syncing, timer;
    async function sync() {
        const teacher = auth();
        if (!teacher?.sharedDirectory || syncing || !navigator.onLine) return;
        syncing = true;
        try {
            const sent = storage.pending();
            const {preferences} = await window.gk2TeacherAccounts.directoryRequest(
                'gakuten-preferences',Object.keys(sent).length ? {preferences:sent} : undefined);
            if (auth()?.teacherId !== teacher.teacherId) return;
            storage.accept(sent,preferences);
            const diagnostic = localStorage.getItem('gk2_diagnostic_view') !== 'false';
            window.gk2.diagnostic = diagnostic;
            document.body.classList.toggle('gk2-diagnostic',diagnostic);
            const toggle = document.getElementById('gk2-diagnostic-setting');
            if (toggle) toggle.checked = diagnostic;
            window.gk2.syncDisplayDefaultControls?.();
            window.app?.ui?.reloadTeacherEntryDefault?.();
            const navigation = window.gk2Navigation;
            const quickFill = localStorage.getItem('gk2_entry_quickfill_default_v1') !== 'hidden';
            if (navigation && navigation.entryQuickFillDefaultVisible !== quickFill) {
                navigation.entryQuickFillDefaultVisible = quickFill;
                navigation.entryQuickFillVisible = quickFill;
                navigation.syncEntryQuickFillControls?.();
            }
        } catch {
            // Local changes stay queued until the next cloud connection.
        } finally {
            syncing = false;
        }
    }
    window.addEventListener('gk2-auth-changed',sync);
    window.addEventListener('online',sync);
    window.addEventListener('focus',sync);
    window.addEventListener('gk2-teacher-preference-changed',()=>{
        clearTimeout(timer);
        timer=setTimeout(sync,350);
    });
    function install() {
        const ui = window.app?.ui;
        if (!ui) return;
        const switchTab = ui.switchSettingsTab;
        ui.switchSettingsTab = function (tab) {
            return switchTab.call(this,auth()?.sharedDirectory ? 'display' : tab);
        };
        const update = () => {
            const teacher = auth()?.sharedDirectory;
            for (const name of ['ai','data']) {
                document.querySelector('[data-settings-tab="'+name+'"]').hidden = !!teacher;
            }
        };
        update();
        window.addEventListener('gk2-auth-changed',update);
        sync();
    }
    if (window.app?.ui) install();
    else document.addEventListener('DOMContentLoaded',install,{once:true});
})();
