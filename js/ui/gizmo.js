/** 
 * VEETANCE Gizmo Module
 * Handles the floating transform control island.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Gizmo = (function () {
    const store = window.ENGINE.Store;

    function init() {
        const island = document.getElementById('gizmo-island');
        const vpSelector = document.getElementById('viewpoints-selector');
        const canvas = document.getElementById('game');

        const updateUI = (mode) => {
            if (!mode) return;
            const targetMode = mode.toLowerCase();

            // Update Island buttons
            if (island) {
                island.querySelectorAll('.gizmo-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode?.toLowerCase() === targetMode);
                });
            }
            // Update Viewport Selector buttons
            if (vpSelector) {
                vpSelector.querySelectorAll('.vp-btn[data-mode]').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode?.toLowerCase() === targetMode);
                });
            }
        };

        // UI Click Handlers - Toggle behavior (click active = back to SELECT)
        [island, vpSelector].forEach(el => {
            if (el) {
                el.addEventListener('click', (e) => {
                    const btn = e.target.closest('.gizmo-btn, .vp-btn');
                    if (btn && btn.dataset.mode) {
                        const currentMode = store.getState().ui.transformMode;
                        const clickedMode = btn.dataset.mode;
                        // If clicking the active button, go back to SELECT
                        if (currentMode.toUpperCase() === clickedMode.toUpperCase()) {
                            store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: 'SELECT' });
                        } else {
                            store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: clickedMode });
                        }
                        e.stopPropagation();
                    }
                });
            }
        });

        // Mode persistence: DO NOT auto-reset to SELECT on canvas click.
        // User must explicitly click a mode button to change modes.

        // Sync with State
        store.subscribe(() => {
            const state = store.getState();
            updateUI(state.ui.transformMode);
        });

        // Initial sync
        updateUI(store.getState().ui.transformMode);
    }

    return { init };
})();
