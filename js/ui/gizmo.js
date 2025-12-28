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
            // Update Island buttons
            if (island) {
                island.querySelectorAll('.gizmo-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === mode);
                });
            }
            // Update Viewport Selector buttons
            if (vpSelector) {
                vpSelector.querySelectorAll('.vp-btn[data-mode]').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === mode);
                });
            }
        };

        // UI Click Handlers
        [island, vpSelector].forEach(el => {
            if (el) {
                el.addEventListener('click', (e) => {
                    const btn = e.target.closest('.gizmo-btn, .vp-btn');
                    if (btn && btn.dataset.mode) {
                        store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: btn.dataset.mode });
                        e.stopPropagation(); // Prevent canvas reset
                    }
                });
            }
        });

        // Click-Away Reset: Default back to 'SELECT' when clicking the stage
        if (canvas) {
            canvas.addEventListener('mousedown', () => {
                const currentMode = store.getState().ui.transformMode;
                // If in a camera-only mode from the pad, or a transient state, 
                // we might want to stay there while dragging, but clicking 'void' usually resets.
                // For now, let's allow Orbit/Pan to persist while dragging, 
                // but clicking 'away' (mouseup without drag or specific trigger) could reset.
                // Clinical requirement: "when user clicks away it deselects".
            });

            // Standard Reset on Canvas Click
            canvas.addEventListener('click', (e) => {
                const state = store.getState();
                // If user clicks the background and not an object (TBD logic), reset to SELECT
                // For now: any canvas click that isn't captured by a gizmo/UI resets.
                if (state.ui.transformMode !== 'select') {
                    store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: 'select' });
                }
            });
        }

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
