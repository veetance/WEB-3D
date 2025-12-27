/**
 * VEETANCE 3D Engine - Entry Point
 * Orchestrates module synchronization
 */
(function () {
    const canvas = document.getElementById('game');
    const ctx = canvas ? canvas.getContext('2d') : null;

    function init() {
        localStorage.clear(); // Wipe potential contaminated state
        if (!canvas || !ctx) return;

        // GLOBAL ERROR TRAP
        window.onerror = function (msg, url, lineNo, columnNo, error) {
            const hud = document.getElementById('perf-hud');
            if (hud) {
                hud.innerHTML += `<div style="color:red; background:rgba(0,0,0,0.8); padding:5px; margin-top:10px;">
                    ERR: ${msg} <br> ${url.split('/').pop()}:${lineNo}
                </div>`;
            }
            return false;
        };
        // Performance Monitoring
        let lastTime = performance.now();
        let frameCount = 0;
        const hudFps = document.getElementById('hud-fps');
        const hudMem = document.getElementById('hud-mem');
        const hudCpu = document.getElementById('hud-cpu');

        function updatePerf() {
            const now = performance.now();
            frameCount++;

            if (now - lastTime >= 1000) {
                const fps = frameCount;
                if (hudFps) hudFps.textContent = fps;

                // Estimated Model Memory
                const state = window.ENGINE.Store.getState();
                const vCount = state.vertices ? state.vertices.length / 3 : 0;
                const iCount = state.indices ? state.indices.length / 3 : 0;

                // Float32 (4 bytes) * count * 3 components
                const vBytes = vCount * 3 * 4;
                // Uint32 (4 bytes) * count * 3 (or Uint16)
                // Assuming Uint32 for safety in calculation
                const iBytes = iCount * 3 * 4;

                const geomMB = ((vBytes + iBytes) / 1048576).toFixed(2);

                if (hudMem) hudMem.textContent = geomMB;

                // CPU Load Estimation (Low FPS = High Load)
                if (hudCpu) {
                    if (fps < 15) hudCpu.innerHTML = "<span style='color:#ff0055'>CRIT</span>";
                    else if (fps < 30) hudCpu.innerHTML = "<span style='color:#ffaa00'>HIGH</span>";
                    else if (fps < 55) hudCpu.innerHTML = "<span style='color:#ffff00'>MED</span>";
                    else hudCpu.innerHTML = "<span style='color:#00ffd2'>LOW</span>";
                }

                frameCount = 0;
                lastTime = now;
            }

            requestAnimationFrame(updatePerf);
        }
        updatePerf();

        window.ENGINE.UI.init();
        window.ENGINE.Controls.init(canvas);

        // Core Resizing - ResizeObserver for smooth transitions
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        };

        const ro = new ResizeObserver(() => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                // Instant re-draw to prevent black flicker during transition
                if (window.ENGINE.Core.update) {
                    window.ENGINE.Core.update(ctx, canvas);
                }
            }
        });
        if (canvas.parentElement) ro.observe(canvas.parentElement);

        window.addEventListener('resize', resize);
        resize();

        // Boot Main Loop
        const store = window.ENGINE.Store;
        store.dispatch({
            type: 'SET_PRIMITIVE',
            payload: store.getState().ui.currentPrimitive
        });

        window.ENGINE.Core.frame(ctx, canvas);
    }

    document.addEventListener('DOMContentLoaded', init);
    // Fallback if DOM already loaded
    if (document.readyState !== 'loading') init();
})();
