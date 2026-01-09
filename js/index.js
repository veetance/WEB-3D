/**
 * VEETANCE 3D Engine - Entry Point
 * Orchestrates module synchronization
 */
(function () {
    const canvas = document.getElementById('game');
    const overlay = document.getElementById('bio-overlay');
    const ctx = canvas ? canvas.getContext('2d') : null; // Baseline fallback

    function init() {
        localStorage.clear();
        if (!canvas || !overlay) return;

        // Dual-Stage Context Initialization
        const isGL = window.ENGINE.GL.init(canvas);
        const mainCtx = isGL ? canvas.getContext('webgl') : canvas.getContext('2d');
        const overlayCtx = overlay.getContext('2d');

        window.ENGINE.isGL = isGL;
        window.ENGINE.mainCtx = mainCtx;
        window.ENGINE.overlayCtx = overlayCtx;

        // GLOBAL ERROR TRAP
        window.onerror = function (msg, url, lineNo, columnNo, error) {
            const log = document.getElementById('error-log');
            if (log) {
                const item = document.createElement('div');
                item.className = 'error-item';
                const file = url ? url.split('/').pop() : 'INTERNAL';
                item.innerHTML = `<strong>ERR:</strong> ${msg} <br> <span style="opacity:0.5; font-size:9px;">${file}:${lineNo}</span>`;
                log.appendChild(item);
                setTimeout(() => item.remove(), 5000);
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

            const state = window.ENGINE.Store.getState();

            if (now - lastTime >= 1000) {
                const fps = frameCount;
                if (hudFps) hudFps.textContent = fps;

                const vCount = state.vertices ? state.vertices.length / 3 : 0;
                const iCount = state.indices ? state.indices.length / 3 : 0;
                const vBytes = vCount * 3 * 4;
                const iBytes = iCount * 3 * 4;
                const geomMB = ((vBytes + iBytes) / 1048576).toFixed(2);
                if (hudMem) hudMem.textContent = geomMB;

                if (hudCpu) {
                    if (fps < 15) hudCpu.innerHTML = "<span style='color:#ff0055'>CRIT</span>";
                    else if (fps < 30) hudCpu.innerHTML = "<span style='color:#ffaa00'>HIGH</span>";
                    else if (fps < 55) hudCpu.innerHTML = "<span style='color:#ffff00'>MED</span>";
                    else hudCpu.innerHTML = "<span style='color:#00ffd2'>LOW</span>";
                }

                const vboHud = document.getElementById('hud-vbo');
                if (vboHud && state.config.hardwareMode === 'CPU') {
                    vboHud.textContent = "N/A";
                    vboHud.style.color = "rgba(255,255,255,0.2)";
                }

                frameCount = 0;
                lastTime = now;
            }

            requestAnimationFrame(updatePerf);
        }
        updatePerf();

        window.ENGINE.UI.init();
        window.ENGINE.Controls.init(canvas);

        // Core Resizing - ResizeObserver for dual-canvas synchronization
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                const w = parent.clientWidth, h = parent.clientHeight;
                canvas.width = overlay.width = w;
                canvas.height = overlay.height = h;
            }
        };

        const ro = new ResizeObserver(() => {
            const parent = canvas.parentElement;
            if (parent) {
                const w = parent.clientWidth, h = parent.clientHeight;
                canvas.width = overlay.width = w;
                canvas.height = overlay.height = h;
                if (window.ENGINE.Core.update) {
                    window.ENGINE.Core.update(mainCtx, overlayCtx, canvas);
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

        window.ENGINE.Core.frame(mainCtx, overlayCtx, canvas);
    }

    document.addEventListener('DOMContentLoaded', init);
    // Fallback if DOM already loaded
    if (document.readyState !== 'loading') init();
})();
