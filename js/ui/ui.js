/**
 * VEETANCE User Interface Manager
 * Handles Sidebar, HUD, and Input bindings.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.UI = {
    init: () => {
        const store = window.ENGINE.Store;

        // --- Sidebar Logic ---
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('toggleBtn');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                store.dispatch({ type: 'TOGGLE_SIDEBAR' });
                const btnText = toggleBtn.querySelector('.btn-text');
                if (btnText) btnText.textContent = isCollapsed ? "CONTROLS" : "";
            });
        }

        // --- Inputs binding ---
        const bind = (id, event, actionType, payloadFn) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, (e) => {
                    store.dispatch({
                        type: actionType,
                        payload: payloadFn(e)
                    });
                });
            }
        };

        // Transform Modes
        document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: btn.dataset.mode });
            });
        });

        // View Modes
        document.querySelectorAll('.mode-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn[data-view]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                store.dispatch({ type: 'SET_VIEW_MODE', payload: btn.dataset.view });
            });
        });

        // Sliders
        bind('thickness', 'input', 'UPDATE_CONFIG', e => ({ thickness: parseFloat(e.target.value) }));

        // Custom Color Pickers
        const setupColorPicker = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                // Prevent native picker
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    const state = store.getState();
                    window.ENGINE.ColorPicker.open(el, state.config[key], (newHex) => {
                        el.value = newHex; // Update input visual (swatch)
                        store.dispatch({
                            type: 'UPDATE_CONFIG',
                            payload: { [key]: newHex }
                        });
                    });
                });
            }
        };

        setupColorPicker('color', 'fg');
        setupColorPicker('polyColor', 'polyColor');

        bind('auto', 'change', 'UPDATE_CONFIG', e => ({ auto: e.target.checked }));
        bind('show-grid', 'change', 'UPDATE_CONFIG', e => ({ showGrid: e.target.checked }));
        bind('show-ui', 'change', 'UPDATE_CONFIG', e => ({ showHUD: e.target.checked }));

        // Primitives
        document.querySelectorAll('.prim-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.prim-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                store.dispatch({ type: 'SET_PRIMITIVE', payload: btn.dataset.type });
            });
        });

        // Viewpoints
        document.querySelectorAll('.vp-btn, .vp-btn-sm').forEach(btn => {
            btn.addEventListener('click', () => {
                const ox = parseFloat(btn.dataset.orbitX);
                const oy = parseFloat(btn.dataset.orbitY);
                store.dispatch({ type: 'UPDATE_CAMERA', payload: { orbitX: ox, orbitY: oy } });
            });
        });

        // --- Subscription for UI Updates ---
        store.subscribe(state => {
            // Update Info Bar
            const stats = state.ui.info;
            const vertDisplay = document.getElementById('vertCount');
            const faceDisplay = document.getElementById('faceCount');
            const modeDisplay = document.getElementById('modeDisplay');

            if (vertDisplay) vertDisplay.textContent = stats.verts;
            if (faceDisplay) faceDisplay.textContent = stats.faces;
            if (modeDisplay) modeDisplay.textContent = state.ui.transformMode;

            // Handle UI Overlay visibility
            const viewport = document.getElementById('viewport');
            if (viewport) {
                if (state.config.showHUD) {
                    viewport.classList.remove('no-ui');
                } else {
                    viewport.classList.add('no-ui');
                }
            }
        });

        // --- Geometry Optimization ---
        const reduceBtn = document.getElementById('reduceBtn');
        const resetGeomBtn = document.getElementById('resetGeomBtn');
        const reduceStrength = document.getElementById('reduceStrength');

        if (reduceBtn && reduceStrength) {
            reduceBtn.addEventListener('click', () => {
                const state = store.getState();
                const strength = parseFloat(reduceStrength.value);
                // Perform Clustering
                const optimized = window.ENGINE.Optimizer.cluster(state.vertices, state.indices, strength);
                store.dispatch({ type: 'SET_MODEL', payload: optimized });
            });
        }

        if (resetGeomBtn) {
            resetGeomBtn.addEventListener('click', () => {
                const state = store.getState();
                let prim = state.ui.currentPrimitive || 'cube';
                store.dispatch({ type: 'SET_PRIMITIVE', payload: prim });
            });
        }

        // --- Manifold Transfer (Upload/Export) ---
        const fileInput = document.getElementById('fileInput');
        const exportBtn = document.getElementById('exportBtn');
        const downloadAnchor = document.getElementById('downloadAnchor');

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const buffer = event.target.result;
                    let model;
                    if (file.name.toLowerCase().endsWith('.glb')) {
                        model = window.ENGINE.Parser.parseGLB(buffer);
                    } else {
                        model = window.ENGINE.Parser.parseOBJ(buffer);
                    }
                    store.dispatch({ type: 'SET_MODEL', payload: model });
                };
                reader.readAsArrayBuffer(file);
            });
        }

        if (exportBtn && downloadAnchor) {
            exportBtn.addEventListener('click', () => {
                const state = store.getState();
                const objData = window.ENGINE.Parser.exportOBJ(state.vertices, state.indices);
                const blob = new Blob([objData], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                downloadAnchor.href = url;
                downloadAnchor.download = "veetance_manifold.obj";
                downloadAnchor.click();
                URL.revokeObjectURL(url);
            });
        }

        // --- Custom Scrollbar Logic ---
        const scrollArea = document.querySelector('.scroll-area');
        const thumb = document.getElementById('side-thumb');

        if (scrollArea && thumb) {
            let isDragging = false;
            let startY = 0;
            let startScrollTop = 0;

            const updateThumb = () => {
                const height = scrollArea.clientHeight;
                const scrollHeight = scrollArea.scrollHeight;
                const scrollTop = scrollArea.scrollTop;

                if (scrollHeight <= height + 1) { // 1px buffer
                    thumb.style.display = 'none';
                    return;
                }

                thumb.style.display = 'block';
                // Ratio of visible area to total area
                const visibleRatio = height / scrollHeight;
                const thumbHeight = Math.max(30, height * visibleRatio);

                // Ratio of current scroll to max scroll
                const maxScroll = scrollHeight - height;
                const scrollRatio = scrollTop / maxScroll;

                // Max distance thumb can travel
                const maxTravel = height - thumbHeight - 8; // 8px for top/bottom margins
                const thumbTop = scrollRatio * maxTravel;

                thumb.style.height = `${thumbHeight}px`;
                thumb.style.top = `${thumbTop + 4}px`; // 4px top offset
            };

            scrollArea.addEventListener('scroll', () => {
                if (!isDragging) updateThumb();
            });
            window.addEventListener('resize', updateThumb);

            thumb.addEventListener('mousedown', (e) => {
                isDragging = true;
                startY = e.clientY;
                startScrollTop = scrollArea.scrollTop;
                thumb.classList.add('active');
                document.body.classList.add('grabbing');
                e.stopPropagation();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const deltaY = e.clientY - startY;
                const height = scrollArea.clientHeight;
                const scrollHeight = scrollArea.scrollHeight;
                const thumbHeight = thumb.offsetHeight;

                const maxTravel = height - thumbHeight - 8;
                const maxScroll = scrollHeight - height;

                // Calculate how much we've moved as a percentage of available track
                const dragRatio = deltaY / maxTravel;
                scrollArea.scrollTop = startScrollTop + (dragRatio * maxScroll);

                updateThumb(); // Forced update during drag
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    thumb.classList.remove('active');
                    document.body.classList.remove('grabbing');
                }
            });

            // Initial check
            setTimeout(updateThumb, 500);

            // MutationObserver to catch dynamic content changes
            const observer = new MutationObserver(updateThumb);
            observer.observe(scrollArea, { childList: true, subtree: true, attributes: true });
        }
    }
};
