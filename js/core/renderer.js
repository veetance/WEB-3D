/**
 * VEETANCE Effect Layer - Renderer
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Renderer = {
    clear: (ctx, width, height, color) => {
        if (color === 'transparent') {
            ctx.clearRect(0, 0, width, height);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
        }
    },

    fillPolygon: (ctx, points, color) => {
        if (points.length < 3) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
    },

    strokePolygon: (ctx, points, color, thickness = 1) => {
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
    },

    line: (ctx, p1, p2, color, thickness = 1) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    },

    point: (ctx, p, color, size = 1) => {
        ctx.fillStyle = color;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
};
