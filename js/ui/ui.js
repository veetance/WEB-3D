/**
 * VEETANCE User Interface Orchestrator
 * Delegating to Sidebar, HUD, and Input modules.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.UI = {
    init: () => {
        const store = window.ENGINE.Store;

        // Initialize fragmented modules
        if (window.ENGINE.Sidebar) window.ENGINE.Sidebar.init();
        if (window.ENGINE.HUD) window.ENGINE.HUD.init();
        if (window.ENGINE.Gizmo) window.ENGINE.Gizmo.init();

        // --- Shared Inputs binding ---
        const bind = (id, event, actionType, payloadFn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, (e) => store.dispatch({ type: actionType, payload: payloadFn(e) }));
        };

        bind('wireDensity', 'input', 'UPDATE_CONFIG', e => ({ wireDensity: parseFloat(e.target.value) / 100 }));
        bind('auto', 'change', 'UPDATE_CONFIG', e => ({ auto: e.target.checked }));
        bind('show-grid', 'change', 'UPDATE_CONFIG', e => ({ showGrid: e.target.checked }));
        bind('show-ui', 'change', 'UPDATE_CONFIG', e => ({ showHUD: e.target.checked }));

        // Custom Color Pickers
        const setupColorPicker = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', (e) => {
                e.preventDefault();
                window.ENGINE.ColorPicker.open(el, store.getState().config[key], (newHex) => {
                    el.value = newHex;
                    store.dispatch({ type: 'UPDATE_CONFIG', payload: { [key]: newHex } });
                });
            });
        };
        setupColorPicker('color', 'fg');
        setupColorPicker('polyColor', 'polyColor');

        // Optimization & Geometry Logic
        const rBtn = document.getElementById('reduceBtn');
        const rS = document.getElementById('reduceStrength');
        if (rBtn && rS) rBtn.addEventListener('click', () => {
            const state = store.getState();
            const optimized = window.ENGINE.Optimizer.cluster(state.vertices, state.indices, parseFloat(rS.value));
            store.dispatch({ type: 'SET_MODEL', payload: optimized });
        });

        const resetBtn = document.getElementById('resetGeomBtn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            const state = store.getState();
            store.dispatch({ type: 'SET_PRIMITIVE', payload: state.ui.currentPrimitive || 'cube' });
        });

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (window.ENGINE.Transfer) window.ENGINE.Transfer.exportOBJ();
            });
        }



        // Point Budget Scroll Control
        const pointContainer = document.querySelector('.point-cloud-container');
        const pointSlider = document.getElementById('point-budget');
        if (pointContainer && pointSlider) {
            pointContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const step = 2000;
                const direction = e.deltaY > 0 ? -1 : 1;
                let newValue = parseInt(pointSlider.value) + (direction * step);
                newValue = Math.max(parseInt(pointSlider.min), Math.min(parseInt(pointSlider.max), newValue));

                pointSlider.value = newValue;
                store.dispatch({ type: 'UPDATE_CONFIG', payload: { pointBudget: newValue } });
            }, { passive: false });

            pointSlider.addEventListener('input', (e) => {
                store.dispatch({ type: 'UPDATE_CONFIG', payload: { pointBudget: parseInt(e.target.value) } });
            });
        }
    }
};
