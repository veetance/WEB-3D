/**
 * VEETANCE Custom Color Picker Logic
 * Zero-dependency, pure JS implementation.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.ColorPicker = (() => {
    let activeInput = null;
    let onUpdate = null;
    let overlay = null;
    let popup = null;
    let canvas = null;
    let cursor = null;
    let hueSlider = null;
    let hueHandle = null;
    let hexInput = null;
    let preview = null;

    let h = 0, s = 100, v = 100;
    let isDraggingCanvas = false;
    let isDraggingHue = false;

    const hsvToHex = (h, s, v) => {
        s /= 100; v /= 100;
        let i = Math.floor(h / 60);
        let f = h / 60 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        let r, g, b;
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const hexToHsv = (hex) => {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    };

    const updateUI = () => {
        const hex = hsvToHex(h, s, v);
        canvas.style.backgroundColor = hsvToHex(h, 100, 100);
        cursor.style.left = `${s}%`;
        cursor.style.top = `${100 - v}%`;
        hueHandle.style.left = `${(h / 360) * 100}%`;
        hexInput.value = hex.toUpperCase();
        preview.style.backgroundColor = hex;
        if (onUpdate) onUpdate(hex);
    };

    const handleCanvas = (e) => {
        const rect = canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        let y = (e.clientY - rect.top) / rect.height;
        s = Math.max(0, Math.min(100, x * 100));
        v = Math.max(0, Math.min(100, 100 - y * 100));
        updateUI();
    };

    const handleHue = (e) => {
        const rect = hueSlider.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        h = Math.max(0, Math.min(360, x * 360));
        updateUI();
    };

    const init = () => {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'color-picker-overlay';
        overlay.style.display = 'none';

        overlay.innerHTML = `
            <div class="color-picker-popup">
                <div class="cp-canvas-area">
                    <div class="cp-canvas-white"></div>
                    <div class="cp-canvas-black"></div>
                    <div class="cp-cursor"></div>
                </div>
                <div class="cp-hue-slider">
                    <div class="cp-hue-handle"></div>
                </div>
                <div class="cp-footer">
                    <div class="cp-preview"></div>
                    <input type="text" class="cp-hex-input" spellcheck="false">
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        popup = overlay.querySelector('.color-picker-popup');
        canvas = overlay.querySelector('.cp-canvas-area');
        cursor = overlay.querySelector('.cp-cursor');
        hueSlider = overlay.querySelector('.cp-hue-slider');
        hueHandle = overlay.querySelector('.cp-hue-handle');
        hexInput = overlay.querySelector('.cp-hex-input');
        preview = overlay.querySelector('.cp-preview');

        canvas.addEventListener('mousedown', e => { isDraggingCanvas = true; handleCanvas(e); });
        hueSlider.addEventListener('mousedown', e => { isDraggingHue = true; handleHue(e); });

        window.addEventListener('mousemove', e => {
            if (isDraggingCanvas) handleCanvas(e);
            if (isDraggingHue) handleHue(e);
        });

        window.addEventListener('mouseup', () => {
            isDraggingCanvas = false;
            isDraggingHue = false;
        });

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) close();
        });

        hexInput.addEventListener('change', () => {
            if (/^#[0-9A-F]{6}$/i.test(hexInput.value)) {
                const hsv = hexToHsv(hexInput.value);
                h = hsv.h; s = hsv.s; v = hsv.v;
                updateUI();
            }
        });
    };

    const open = (inputEl, currentHex, callback) => {
        init();
        activeInput = inputEl;
        onUpdate = callback;
        const hsv = hexToHsv(currentHex);
        h = hsv.h; s = hsv.s; v = hsv.v;

        const rect = inputEl.getBoundingClientRect();
        popup.style.left = `${rect.left - 210}px`; // Display to the left of sidebar
        popup.style.top = `${Math.min(window.innerHeight - 200, rect.top)}px`;

        overlay.style.display = 'block';
        updateUI();
    };

    const close = () => {
        overlay.style.display = 'none';
        activeInput = null;
        onUpdate = null;
    };

    return { open, close };
})();
