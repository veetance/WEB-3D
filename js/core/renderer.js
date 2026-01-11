/**
 * VEETANCE Renderer – combines 2D drawing helpers with GPU/CPU mode switching.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Renderer = (function () {
    // --- Pure Software Renderer API ---
    const init = (canvas) => {
        if (!canvas) return;
        const ctx2d = canvas.getContext('2d');
        if (ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        return false; // isGL = false
    };

    const render = () => {
        // No-op for legacy sync
    };

    // --- Legacy 2D Drawing Helpers (used by engine.js CPU path and Overlay) ---
    const clear = (ctx, width, height, color) => {
        if (!(ctx instanceof CanvasRenderingContext2D)) return;
        if (color === 'transparent') {
            ctx.clearRect(0, 0, width, height);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
        }
    };

    const fillPolygon = (ctx, points, color) => {
        if (!(ctx instanceof CanvasRenderingContext2D)) return;
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
        if (!(ctx instanceof CanvasRenderingContext2D)) return;
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
        if (!(ctx instanceof CanvasRenderingContext2D)) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    };

    const point = (ctx, p, color, size = 1) => {
        if (!(ctx instanceof CanvasRenderingContext2D)) return;
        ctx.fillStyle = color;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    };

    return {
        init,
        render,
        clear,
        fillPolygon,
        strokePolygon,
        line,
        point
    };
})();
