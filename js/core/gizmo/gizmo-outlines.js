/**
 * VEETANCE Selection & Hover Outlines
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoOutlines = (function () {
    const Utils = window.ENGINE.GizmoUtils;

    function drawSelection(ctx, origin, mView, width, height, fovScale) {
        const center = Utils.projectPoint(origin, mView, width, height, fovScale);
        if (!center) return;
        ctx.strokeStyle = '#66ccff'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.arc(center.x, center.y, 4, 0, Math.PI * 2); ctx.stroke();
    }

    function drawHover(ctx, screenBuffer, indices, faceCount, color) {
        if (!screenBuffer || !indices) return;
        const edgeCount = new Map();
        const edgeCoords = new Map();

        for (let i = 0; i < faceCount; i++) {
            const i3 = i * 3, i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2], i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
            if (screenBuffer[i04 + 3] < 0 || screenBuffer[i14 + 3] < 0 || screenBuffer[i24 + 3] < 0) continue;
            const x0 = screenBuffer[i04], y0 = screenBuffer[i04 + 1], x1 = screenBuffer[i14], y1 = screenBuffer[i14 + 1], x2 = screenBuffer[i24], y2 = screenBuffer[i24 + 1];
            const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
            if (area > 0) continue;
            const edges = [[i0, i1], [i1, i2], [i2, i0]];
            edges.forEach(([a, b]) => {
                const key = a < b ? `${a}-${b}` : `${b}-${a}`; edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
                if (!edgeCoords.has(key)) edgeCoords.set(key, { ax: screenBuffer[a << 2], ay: screenBuffer[(a << 2) + 1], bx: screenBuffer[b << 2], by: screenBuffer[(b << 2) + 1] });
            });
        }

        ctx.strokeStyle = color || '#00ffd2'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        edgeCount.forEach((count, key) => { if (count === 1) { const e = edgeCoords.get(key); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.bx, e.by); } });
        ctx.stroke();
    }

    return { drawSelection, drawHover };
})();
