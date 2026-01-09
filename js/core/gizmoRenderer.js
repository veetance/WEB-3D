/**
 * VEETANCE Gizmo Renderer (Facade)
 * Orchestrates specialized gizmo sub-modules for high-fidelity 3D interaction.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoRenderer = (function () {
    return {
        // Exposed Utilities
        projectPoint: (...args) => window.ENGINE.GizmoUtils.projectPoint(...args),
        getAxisDirection: (...args) => window.ENGINE.GizmoUtils.getAxisDirection(...args),
        AXIS_COLORS: window.ENGINE.GizmoUtils.AXIS_COLORS,

        // Delegated Rendering
        drawTranslate: (...args) => window.ENGINE.GizmoTranslate.draw(...args),
        drawRotate: (...args) => window.ENGINE.GizmoRotate.draw(...args),
        drawScale: (...args) => window.ENGINE.GizmoScale.draw(...args),
        drawSelectionOutline: (...args) => window.ENGINE.GizmoOutlines.drawSelection(...args),
        drawHoverOutline: (...args) => window.ENGINE.GizmoOutlines.drawHover(...args)
    };
})();
