/** 
 * VEETANCE Sidebar Module
 * Manages the collapsible side panel and its specific sub-components.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Sidebar = (function () {
    const store = window.ENGINE.Store;
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleBtn');

    function init() {
        if (!sidebar || !toggleBtn) return;

        // Toggle Expand/Collapse
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const isCollapsed = sidebar.classList.contains('collapsed');
            store.dispatch({ type: 'TOGGLE_SIDEBAR' });

            const btnText = toggleBtn.querySelector('.btn-text');
            if (btnText) btnText.textContent = isCollapsed ? "CONTROLS" : "";
        });

        // Event Delegation for Sidebar Buttons
        sidebar.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const mode = btn.dataset.mode;
            const view = btn.dataset.view;
            const hw = btn.dataset.hw;

            if (mode) {
                store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: mode });
            } else if (view) {
                store.dispatch({ type: 'SET_VIEW_MODE', payload: view });
            } else if (hw) {
                store.dispatch({ type: 'UPDATE_CONFIG', payload: { hardwareMode: hw } });
            }
        });

        // REACTIVE UI SYNC: Subscribe to Store to update button 'active' states
        store.subscribe((state) => {
            // Update Transform Mode Buttons
            const mode = state.ui.transformMode;
            document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            // Update View Mode Buttons
            const view = state.config.viewMode;
            document.querySelectorAll('.mode-btn[data-view]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });

            // Update Hardware Mode Buttons
            const hw = state.config.hardwareMode;
            document.querySelectorAll('.mode-btn[data-hw]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.hw === hw);
            });

            // Sync Checkboxes
            const diagCheck = document.getElementById('show-diagonals');
            if (diagCheck) diagCheck.checked = state.config.showDiagonals;

            const gridCheck = document.getElementById('show-grid');
            if (gridCheck) gridCheck.checked = state.config.showGrid;
        });

        const diagCheck = document.getElementById('show-diagonals');
        if (diagCheck) {
            diagCheck.addEventListener('change', (e) => {
                store.dispatch({ type: 'UPDATE_CONFIG', payload: { showDiagonals: e.target.checked } });
            });
        }

        // Initialize Virtual Scrollbar
        initScrollbar();
    }

    function initScrollbar() {
        const area = sidebar.querySelector('.scroll-area');
        const thumb = document.getElementById('side-thumb');
        if (!area || !thumb) return;

        const updateThumb = () => {
            const ratio = area.clientHeight / area.scrollHeight;
            if (ratio >= 1) {
                thumb.style.display = 'none';
                return;
            }
            thumb.style.display = 'block';

            const height = Math.max(20, ratio * area.clientHeight);
            const top = (area.scrollTop / (area.scrollHeight - area.clientHeight)) * (area.clientHeight - height);

            thumb.style.height = `${height}px`;
            thumb.style.transform = `translateY(${top}px)`;
        };

        area.addEventListener('scroll', updateThumb);
        window.addEventListener('resize', updateThumb);

        // ResizeObserver for dynamic content changes
        const ro = new ResizeObserver(updateThumb);
        ro.observe(area);

        // Initial sync
        setTimeout(updateThumb, 100);

        // Drag Logic
        let isDragging = false;
        let startY, startScrollTop;

        thumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startScrollTop = area.scrollTop;
            thumb.classList.add('active');
            document.body.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const delta = e.clientY - startY;
            const ratio = delta / (area.clientHeight - thumb.clientHeight);
            area.scrollTop = startScrollTop + ratio * (area.scrollHeight - area.clientHeight);
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            thumb.classList.remove('active');
            document.body.style.cursor = '';
        });
    }

    return { init };
})();
