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
            orbitX: -0.6,
            orbitY: 0.75,
            zoom: 12,
            target: { x: 0, y: 0, z: 0 }
        },
        object: {
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scl: { x: 1, y: 1, z: 1 }
        },
        config: {
            zOffset: 0,
            thickness: 1,
            fg: '#00ffd2',
            polyColor: '#1a1a1a',
            bg: '#0a0a0a',
            auto: false,
            showGrid: true,
            showHUD: true,
            viewMode: 'SHADED_WIRE',
            fov: 1.5
        },
        ui: {
            isSidebarCollapsed: false,
            transformMode: 'ORBIT',
            currentPrimitive: 'pyramid',
            info: { verts: 0, faces: 0 },
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
                return { ...state, config: { ...state.config, ...action.payload } };
            case 'UPDATE_CAMERA':
                return { ...state, camera: { ...state.camera, ...action.payload } };
            case 'UPDATE_OBJECT':
                return { ...state, object: { ...state.object, ...action.payload } };

            case 'SET_PRIMITIVE': {
                const primGen = window.ENGINE.Data.primitives[action.payload];
                if (!primGen) return state;
                const data = primGen.get();
                return {
                    ...state,
                    vertices: data.vertices,
                    indices: data.indices,
                    ui: {
                        ...state.ui,
                        currentPrimitive: action.payload,
                        info: {
                            verts: data.vertices.length / 3,
                            faces: data.indices.length / 3
                        }
                    }
                };
            }

            case 'SET_MODEL': {
                // Expects { vertices: Float32Array, indices: TypedArray }
                return {
                    ...state,
                    vertices: action.payload.vertices,
                    indices: action.payload.indices,
                    ui: {
                        ...state.ui,
                        currentPrimitive: null,
                        info: {
                            verts: action.payload.vertices.length / 3,
                            faces: action.payload.indices.length / 3
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

            default:
                return state;
        }
    }

    window.ENGINE.Store = new Store(reducer, initialState);
})();
