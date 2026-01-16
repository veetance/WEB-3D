/** 
 * VEETANCE HUD Module
 * Manages floating UI elements, info bars, and performance stats.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.HUD = (function () {
    const store = window.ENGINE.Store;
    const viewport = document.getElementById('viewport');

    function init() {
        if (!viewport) return;

        // Floating UI Delegation (Primitives, Viewpoints)
        viewport.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const type = btn.dataset.type;
            const ox = btn.dataset.orbitX;
            const oy = btn.dataset.orbitY;

            if (type) {
                document.querySelectorAll('.prim-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                store.dispatch({ type: 'SET_PRIMITIVE', payload: type });
            } else if (ox !== undefined && oy !== undefined) {
                store.dispatch({ type: 'UPDATE_CAMERA', payload: { orbitX: parseFloat(ox), orbitY: parseFloat(oy) } });
            }
        });

        // Continuous State Updates
        store.subscribe(state => {
            const { ui, config } = state;
            const vCount = document.getElementById('vertCount');
            const fCount = document.getElementById('faceCount');
            const modelName = document.getElementById('modelNameDisplay');

            if (vCount) vCount.textContent = ui.info.verts;
            if (fCount) fCount.textContent = ui.info.faces;
            if (modelName && ui.currentPrimitive) {
                modelName.textContent = ui.currentPrimitive.toUpperCase();
            }

            viewport.classList.toggle('no-ui', !config.showHUD);

            // Resonance Monitoring
            const cpuHUD = document.getElementById('hud-cpu');
            if (cpuHUD) {
                const isIsolated = window.crossOriginIsolated;
                const coreCount = window.ENGINE.RasterizerWASM.getWorkerCount ? window.ENGINE.RasterizerWASM.getWorkerCount() : 0;
                const coreStatus = isIsolated ? (coreCount > 0 ? `CORE:${coreCount}` : 'WAITING') : 'SCALAR';
                cpuHUD.textContent = coreStatus;
                cpuHUD.style.color = isIsolated ? "#00ffd2" : "#ffbe3e";
                cpuHUD.title = isIsolated ? "Full Multi-core Resonance Active" : "Isolation Limited. Running on Scalar Core.";
            }
        });
    }

    return { init };
})();
