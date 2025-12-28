/**
 * VEETANCE Renderer – combines 2D drawing helpers with GPU/CPU mode switching.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Renderer = (function () {
    let mode = 'GPU'; // default mode
    let canvas = null;

    // --- GPU/CPU Mode API ---
    const setMode = (m) => { mode = m; };
    const getMode = () => mode;
    const initGL = (c) => {
        canvas = c;
        if (mode === 'GPU') {
            return window.ENGINE.GL.init(canvas);
        } else {
            const ctx2d = canvas.getContext('2d');
            if (ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            return false;
        }
    };
    const renderGL = (vertices, indices, modelView, projection, config) => {
        if (mode === 'GPU') {
            window.ENGINE.GL.render(vertices, indices, modelView, projection, config);
        } else {
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    // --- Legacy 2D Drawing Helpers (used by engine.js CPU path) ---
    const clear = (ctx, width, height, color) => {
        if (color === 'transparent') {
            ctx.clearRect(0, 0, width, height);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
        }
    };

    const fillPolygon = (ctx, points, color) => {
        if (points.length < 3) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
    };

    const strokePolygon = (ctx, points, color, thickness = 1) => {
        if (points.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.stroke();
    };

    const line = (ctx, p1, p2, color, thickness = 1) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    };

    const point = (ctx, p, color, size = 1) => {
        ctx.fillStyle = color;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    };

    return {
        setMode,
        getMode,
        init: initGL,
        render: renderGL,
        clear,
        fillPolygon,
        strokePolygon,
        line,
        point
    };
})();
