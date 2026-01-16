/** 
 * VEETANCE Engine Configuration
 * The single source of truth for all engine constants.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Config = {
    // Limits (increased for 1M+ face models like LABUBU)
    MAX_VERTICES: 1000000,
    MAX_FACES: 1500000,

    // Rendering
    DEFAULT_FOV: 60,
    Z_OFFSET: 5,
    GRID_SIZE: 10,
    GRID_DIVISIONS: 10,
    debug: true,

    // View Mode
    viewMode: 'WIRE',

    // Initial State
    COLORS: {
        primary: '#00ffd2',
        background: '#0a0a0a',
        poly: '#1a1a1a',
        muted: '#666666'
    },

    // UI
    AUTO_ROTATE_SPEED: 0.005,
    SIDEBAR_WIDTH_VW: 20
};
