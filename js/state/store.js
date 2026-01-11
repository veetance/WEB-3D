/**
 * VFE State Engine (VSE)
 * Centralized Reactive Store - Buffer Edition
 */
window.ENGINE = window.ENGINE || {};

(function () {
    const initialState = {
        renderMode: 'CPU',
        vertices: null, // Float32Array
        indices: null,  // Uint16Array or Uint32Array

        // Transform Matrices (Float32Array)
        modelMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),

        camera: {
            orbitX: -0.8,
            orbitY: 0,
            zoom: 15.6,
            target: { x: 0, y: 0, z: 0 },
            // Physics Properties
            velX: 0,
            velY: 0,
            panVelX: 0,
            panVelY: 0,
            damping: 0.98, // Professional Friction (0.98 = 2% drag per frame)
            mass: 1.0
        },
        object: {
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scl: { x: 1, y: 1, z: 1 },
            edges: null,
            clusters: null
        },
        config: {
            zOffset: 0,
            thickness: 1,
            fg: '#00ffd2',
            polyColor: '#474747',
            hardwareMode: 'CPU', // PURE SOFTWARE RENDERER
            bg: '#0a0a0a',
            auto: false,
            showGrid: true,
            showDiagonals: false, // Default: Clean Wireframe
            showHUD: true,
            viewMode: 'SHADED_WIRE',
            fov: 45,
            pointBudget: 20000
        },
        ui: {
            isSidebarCollapsed: false,
            transformMode: 'SELECT',
            currentPrimitive: 'pyramid',
            selectedObjectId: null, // Only set when user clicks to select
            hoveredObjectId: null, // Object being hovered (for outline)
            dragAxis: null, // 'x', 'y', 'z', or null
            hoveredAxis: null, // 'x', 'y', 'z', or null (for visual feedback)
            hoveredFrontArrow: false, // For "Front Direction" hover text
            info: { verts: 0, faces: 0 },
            centroid: { x: 0, y: 0, z: 0 },
            stats: { fps: 0, mem: 0 }
        }
    };

    class Store {
        constructor(reducer, state) {
            this.reducer = reducer;
            this.state = state;
            this.subscribers = [];
        }

        getState() { return this.state; }

        dispatch(action) {
            this.state = this.reducer(this.state, action);
            this.subscribers.forEach(cb => cb(this.state));
        }

        subscribe(cb) {
            this.subscribers.push(cb);
            return () => { this.subscribers = this.subscribers.filter(s => s !== cb); };
        }
    }

    function reducer(state, action) {
        switch (action.type) {
            case 'UPDATE_CONFIG':
                return {
                    ...state,
                    config: { ...state.config, ...action.payload }
                };
            case 'UPDATE_CAMERA':
                return {
                    ...state,
                    camera: { ...state.camera, ...action.payload }
                };
            case 'UPDATE_OBJECT':
                return {
                    ...state,
                    object: { ...state.object, ...action.payload }
                };
            case 'UPDATE_STATS':
                return {
                    ...state,
                    ui: {
                        ...state.ui,
                        stats: { ...state.ui.stats, ...action.payload }
                    }
                };
            case 'TOGGLE_SIDEBAR':
                return {
                    ...state,
                    ui: {
                        ...state.ui,
                        isSidebarCollapsed: !state.ui.isSidebarCollapsed
                    }
                };

            case 'SET_PRIMITIVE': {
                const primGen = window.ENGINE.Data.primitives[action.payload];
                if (!primGen) return state;
                const data = primGen.get();
                return {
                    ...state,
                    vertices: data.vertices,
                    indices: data.indices,
                    object: {
                        ...state.object,
                        edges: data.edges || null,
                        clusters: action.payload.clusters || window.ENGINE.Optimizer.buildClusters(data.vertices, data.indices, 128)
                    },
                    ui: {
                        ...state.ui,
                        currentPrimitive: action.payload,
                        centroid: action.payload.centroid || window.ENGINE.MathOps.computeCentroid(data.vertices),
                        info: {
                            verts: data.vertices.length / 3,
                            faces: data.indices.length / 3
                        }
                    }
                };
            }

            case 'SET_MODEL': {
                const fCount = action.payload.indices.length / 3;
                let viewMode = state.config.viewMode;

                // Auto Point Cloud for high-poly models
                if (fCount > 50000) viewMode = 'POINTS';

                return {
                    ...state,
                    vertices: action.payload.vertices,
                    indices: action.payload.indices,
                    config: {
                        ...state.config,
                        viewMode
                    },
                    object: {
                        ...state.object,
                        edges: null, // PURGE GHOST EDGES
                        clusters: action.payload.clusters || window.ENGINE.Optimizer.buildClusters(action.payload.vertices, action.payload.indices, 128)
                    },
                    ui: {
                        ...state.ui,
                        currentPrimitive: action.payload.name || 'EXTERNAL',
                        selectedObjectId: null, // CLEAR STALE SELECTION
                        hoveredObjectId: null,  // CLEAR STALE HOVER
                        centroid: action.payload.centroid || window.ENGINE.MathOps.computeCentroid(action.payload.vertices),
                        info: {
                            verts: action.payload.vertices.length / 3,
                            faces: fCount
                        }
                    }
                };
            }

            case 'SET_RENDER_MODE':
                return { ...state, renderMode: action.payload };

            case 'SET_VIEW_MODE':
                return { ...state, config: { ...state.config, viewMode: action.payload } };

            case 'SET_TRANSFORM_MODE':
                return { ...state, ui: { ...state.ui, transformMode: action.payload } };

            case 'SET_DRAG_AXIS':
                return { ...state, ui: { ...state.ui, dragAxis: action.payload } };

            case 'SET_HOVERED_AXIS':
                return { ...state, ui: { ...state.ui, hoveredAxis: action.payload } };

            case 'SET_HOVERED_FRONT_ARROW':
                return { ...state, ui: { ...state.ui, hoveredFrontArrow: action.payload } };



            case 'SET_HOVERED_OBJECT':
                return { ...state, ui: { ...state.ui, hoveredObjectId: action.payload } };

            case 'SET_SELECTED_OBJECT':
                return { ...state, ui: { ...state.ui, selectedObjectId: action.payload } };

            default:
                return state;
        }
    }

    window.ENGINE.Store = new Store(reducer, initialState);
})();
