// Small disclosures share one reversible transition; stored application data is untouched.
(() => {
    const states = new WeakMap(), menus = new WeakMap(), active = new Set();
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const properties = ['overflow', 'box-sizing', 'min-height'];
    const frameProperties = ['opacity', 'transform', 'height', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth', 'marginTop', 'marginBottom'];
    const isOpen = panel => !!panel && !panel.hidden && (states.get(panel)?.open ?? panel.style.display !== 'none');
    const restore = (panel, state) => {
        state.styles.forEach(([name, value, priority]) => value ? panel.style.setProperty(name, value, priority) : panel.style.removeProperty(name));
        panel.inert = state.inert;
    };
    function set(panel, open, options = {}) {
        if (!panel) return;
        open = !!open;
        const previous = states.get(panel);
        if (!previous && !open && panel.hidden) { options.after?.(); return; }
        if (!options.immediate && previous?.open === open && (previous.animation || isOpen(panel) === open)) return;
        const visible = !panel.hidden && panel.getClientRects().length > 0;
        const current = visible ? getComputedStyle(panel) : null;
        const from = current ? Object.fromEntries(frameProperties.map(key => [key, current[key]])) : null;
        if (from) from.height = panel.getBoundingClientRect().height + 'px';
        previous?.animation?.cancel();
        if (previous) restore(panel, previous);
        const state = {
            open, options, animation: null,
            styles: properties.map(name => [name, panel.style.getPropertyValue(name), panel.style.getPropertyPriority(name)]),
            inert: panel.inert
        };
        states.set(panel, state);
        const finish = () => {
            if (states.get(panel) !== state) return;
            panel.hidden = !open;
            if (options.display) panel.style.display = open ? options.display : 'none';
            state.animation?.cancel(); state.animation = null;
            restore(panel, state); active.delete(panel);
            options.after?.();
        };
        if (options.immediate || preference.matches || document.hidden || !panel.isConnected || typeof panel.animate !== 'function') return finish();
        panel.hidden = false;
        if (options.display) panel.style.display = options.display;
        const height = panel.getBoundingClientRect().height;
        if (!height) return finish();
        panel.setAttribute('data-gk2-disclosure', '');
        const style = getComputedStyle(panel);
        const full = Object.fromEntries(frameProperties.map(key => [key, style[key]]));
        full.height = height + 'px'; full.opacity = '1'; full.transform = 'translateY(0)';
        const parent = getComputedStyle(panel.parentElement);
        const gap = parent.display === 'flex' && parent.flexDirection === 'column' ? parseFloat(parent.rowGap) || 0 : 0;
        const collapsed = {
            ...full, height: '0px', opacity: '0', transform: 'translateY(-4px)',
            paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px',
            marginTop: '0px', marginBottom: -gap + 'px'
        };
        panel.inert = !open || state.inert;
        let first = from || collapsed, last = open ? full : collapsed;
        if (options.floating) {
            first = { opacity: from?.opacity ?? '0', transform: from?.transform ?? 'translateY(-5px)' };
            last = { opacity: open ? '1' : '0', transform: open ? 'translateY(0)' : 'translateY(-5px)' };
        } else {
            panel.style.overflow = 'hidden'; panel.style.boxSizing = 'border-box'; panel.style.minHeight = '0';
        }
        state.animation = panel.animate([first, last], {
            duration: open ? 280 : 210,
            easing: open ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.4,0,.2,1)', fill: 'both'
        });
        active.add(panel);
        state.animation.finished.then(finish, () => {});
    }
    function menuOpen(root) { return !!root?.open && (menus.get(root) ?? true); }
    function setMenu(root, open) {
        if (!root) return;
        const body = root.querySelector(':scope > .gk2-action-menu-body');
        if (!body) { root.open = !!open; return; }
        open = !!open;
        if (menuOpen(root) === open) return;
        menus.set(root, open);
        root.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(open));
        if (open) {
            root.open = true;
            // A newly opened details element reveals its body before the first paint.
            if (!states.has(body)) body.hidden = true;
        }
        set(body, open, { floating: true, after: () => {
            if (!open) { root.open = false; body.hidden = false; }
        } });
    }
    function finishActive() {
        for (const panel of [...active]) {
            const state = states.get(panel);
            set(panel, state.open, { ...state.options, immediate: true });
        }
    }
    preference.addEventListener('change', finishActive);
    window.addEventListener('resize', finishActive, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finishActive(); });
    window.gk2Disclosure = { set, isOpen, setMenu, menuOpen };
})();
