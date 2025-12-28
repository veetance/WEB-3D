/**
 * VEETANCE Manifold - Geometry Data (Buffer Optimized)
 * Standardized for Z-UP Manifold. All solids sit FLAT on Z=0.
 * CCW (Counter-Clockwise) winding is the front-face standard.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Data = {
    primitives: {
        pyramid: {
            get: () => {
                const s = 2.0; // Half-size of base
                const h = 4.0; // Height
                const v = new Float32Array([
                    0.0, 0.0, h,
                    -s, -s, 0.0,
                    s, -s, 0.0,
                    s, s, 0.0,
                    -s, s, 0.0
                ]);
                const i = new Uint16Array([
                    1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 0,
                    1, 3, 2, 1, 4, 3
                ]);
                return {
                    vertices: v,
                    indices: i,
                    edges: new Uint32Array([
                        1, 2, 2, 3, 3, 4, 4, 1, // Base
                        0, 1, 0, 2, 0, 3, 0, 4  // Sides
                    ])
                };
            }
        },
        cube: {
            get: () => {
                const s = 2.0; // Half-size of base
                const h = 4.0; // Height
                const v = new Float32Array([
                    -s, -s, 0.0, s, -s, 0.0, s, s, 0.0, -s, s, 0.0,
                    -s, -s, h, s, -s, h, s, s, h, -s, s, h
                ]);
                const i = new Uint16Array([
                    0, 2, 1, 0, 3, 2,
                    4, 5, 6, 4, 6, 7,
                    0, 1, 5, 0, 5, 4,
                    1, 2, 6, 1, 6, 5,
                    2, 3, 7, 2, 7, 6,
                    3, 0, 4, 3, 4, 7
                ]);
                return {
                    vertices: v,
                    indices: i,
                    edges: new Uint32Array([
                        0, 1, 1, 2, 2, 3, 3, 0,
                        4, 5, 5, 6, 6, 7, 7, 4,
                        0, 4, 1, 5, 2, 6, 3, 7
                    ])
                };
            }
        },
        octahedron: {
            get: () => {
                const s = 1.4; // Reduced by 30% (2.0 * 0.7)
                const v = new Float32Array([
                    0, 0, s * 2,  // Top (Z=2.8)
                    0, 0, -s * 2, // Bottom (Z=-2.8)
                    s * 2, 0, 0,
                    0, s * 2, 0,
                    -s * 2, 0, 0,
                    0, -s * 2, 0
                ]);
                // Shift to Z=0
                for (let j = 2; j < v.length; j += 3) v[j] += s * 2;

                const i = new Uint16Array([
                    0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 2,
                    1, 3, 2, 1, 4, 3, 1, 5, 4, 1, 2, 5
                ]);
                return {
                    vertices: v,
                    indices: i,
                    edges: new Uint32Array([
                        2, 3, 3, 4, 4, 5, 5, 2,   // Ring
                        0, 2, 0, 3, 0, 4, 0, 5,   // Top
                        1, 2, 1, 3, 1, 4, 1, 5    // Bottom
                    ])
                };
            }
        },
        dodecahedron: {
            get: () => {
                const t = (1 + Math.sqrt(5)) / 2;
                const r = 1 / t;
                const s = 1.35; // Scale to ~4 units height

                // Standard Three.js Dodecahedron Vertices
                const rawVertices = [
                    -1, -1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
                    1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1,
                    0, -r, -t, 0, -r, t, 0, r, -t, 0, r, t,
                    -r, -t, 0, -r, t, 0, r, -t, 0, r, t, 0,
                    -t, 0, -r, t, 0, -r, -t, 0, r, t, 0, r
                ];

                const v = new Float32Array(rawVertices.length);
                let minZ = Infinity;

                // Scale and find min Z for flattening
                for (let j = 0; j < rawVertices.length; j += 3) {
                    v[j] = rawVertices[j] * s;
                    v[j + 1] = rawVertices[j + 1] * s;
                    v[j + 2] = rawVertices[j + 2] * s;
                    if (v[j + 2] < minZ) minZ = v[j + 2];
                }
                // Flatten to Z=0
                for (let j = 2; j < v.length; j += 3) v[j] -= minZ;

                // Standard Three.js Dodecahedron Indices (CCW)
                const indices = new Uint32Array([
                    3, 11, 7, 3, 7, 15, 3, 15, 13,
                    7, 19, 17, 7, 17, 6, 7, 6, 15,
                    17, 4, 8, 17, 8, 10, 17, 10, 6,
                    8, 0, 16, 8, 16, 2, 8, 2, 10,
                    0, 12, 1, 0, 1, 18, 0, 18, 16,
                    6, 10, 2, 6, 2, 13, 6, 13, 15,
                    2, 16, 18, 2, 18, 3, 2, 3, 13,
                    18, 1, 9, 18, 9, 11, 18, 11, 3,
                    4, 14, 12, 4, 12, 0, 4, 0, 8,
                    11, 9, 5, 11, 5, 19, 11, 19, 7,
                    19, 5, 14, 19, 14, 4, 19, 4, 17,
                    1, 12, 14, 1, 14, 5, 1, 5, 9
                ]);

                return {
                    vertices: v,
                    indices: indices,
                    edges: new Uint32Array([
                        // Face 1: 3-11-7-15-13
                        3, 11, 11, 7, 7, 15, 15, 13, 13, 3,
                        // Face 2: 7-19-17-6-15
                        7, 19, 19, 17, 17, 6, 6, 15, 15, 7,
                        // Face 3: 17-4-8-10-6
                        17, 4, 4, 8, 8, 10, 10, 6, 6, 17,
                        // Face 4: 8-0-16-2-10
                        8, 0, 0, 16, 16, 2, 2, 10, 10, 8,
                        // Face 5: 0-12-1-18-16
                        0, 12, 12, 1, 1, 18, 18, 16, 16, 0,
                        // Face 6: 6-10-2-13-15
                        6, 10, 10, 2, 2, 13, 13, 15, 15, 6,
                        // Face 7: 2-16-18-3-13
                        2, 16, 16, 18, 18, 3, 3, 13, 13, 2,
                        // Face 8: 18-1-9-11-3
                        18, 1, 1, 9, 9, 11, 11, 3, 3, 18,
                        // Face 9: 4-14-12-0-8
                        4, 14, 14, 12, 12, 0, 0, 8, 8, 4,
                        // Face 10: 11-9-5-19-7
                        11, 9, 9, 5, 5, 19, 19, 7, 7, 11,
                        // Face 11: 19-5-14-4-17
                        19, 5, 5, 14, 14, 4, 4, 17, 17, 19,
                        // Face 12: 1-12-14-5-9
                        1, 12, 12, 14, 14, 5, 5, 9, 9, 1
                    ])
                };
            }
        },
        icosahedron: {
            get: () => {
                const t = (1 + Math.sqrt(5)) / 2;
                const s = 1.05; // Scale to ~4 units height
                const v = new Float32Array([
                    -s, t * s, 0, s, t * s, 0, -s, -t * s, 0, s, -t * s, 0,
                    0, -s, t * s, 0, s, t * s, 0, -s, -t * s, 0, s, -t * s,
                    t * s, 0, -s, t * s, 0, s, -t * s, 0, -s, -t * s, 0, s
                ]);
                const i = new Uint16Array([
                    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
                    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
                    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
                    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
                ]);
                // Find min Z and shift to Z=0
                let minZ = Infinity;
                for (let j = 2; j < v.length; j += 3) if (v[j] < minZ) minZ = v[j];
                for (let j = 2; j < v.length; j += 3) v[j] -= minZ;

                return {
                    vertices: v,
                    indices: new Uint32Array(i),
                    edges: new Uint32Array([
                        // Top Cap (5)
                        0, 11, 0, 5, 0, 1, 0, 7, 0, 10,
                        // Top Rim (5)
                        11, 5, 5, 1, 1, 7, 7, 10, 10, 11,
                        // Bottom Cap (5)
                        3, 9, 3, 4, 3, 2, 3, 6, 3, 8,
                        // Bottom Rim (5)
                        9, 4, 4, 2, 2, 6, 6, 8, 8, 9,
                        // Zig-Zag Connections (10)
                        5, 9, 5, 4,
                        11, 4, 11, 2,
                        10, 2, 10, 6,
                        7, 6, 7, 8,
                        1, 8, 1, 9
                    ])
                };
            }
        },
        sphere: {
            get: (radius = 2.0, widthSegments = 24, heightSegments = 18) => {
                const v = [], i = [], edges = [];
                // UV Sphere Logic
                for (let y = 0; y <= heightSegments; y++) {
                    const phi = y * Math.PI / heightSegments; // Angle from top (0 to PI)
                    for (let x = 0; x <= widthSegments; x++) {
                        const theta = x * 2 * Math.PI / widthSegments; // Angle around Y axis (0 to 2PI)
                        const vx = radius * Math.sin(phi) * Math.cos(theta);
                        const vy = radius * Math.sin(phi) * Math.sin(theta);
                        const vz = radius * Math.cos(phi); // Z from -radius to +radius
                        v.push(vx, vy, vz + radius); // Shift Z to sit on Z=0
                    }
                }
                // Indices & Structural Edges
                for (let y = 0; y < heightSegments; y++) {
                    for (let x = 0; x < widthSegments; x++) {
                        const first = (y * (widthSegments + 1)) + x;
                        const second = first + widthSegments + 1;

                        // Flipped winding order for CCW front-faces
                        i.push(first, second, first + 1);
                        i.push(second, second + 1, first + 1);

                        // Structural Edges: Lat/Long lines ONLY. No diagonals.
                        // Horizontal line (Latitude)
                        edges.push(first, first + 1);
                        // Vertical line (Longitude)
                        edges.push(first, second);
                    }
                }
                return { vertices: new Float32Array(v), indices: new Uint32Array(i), edges: new Uint32Array(edges) };
            }
        }
        /*
        prism: {
            get: (sides = 6, height = 1.0, radius = 0.5) => {
                // To support "incrementing", we'll need UI to pass `sides`.
                // For now, default to Hexagon (6).
                const v = [], i = [], edges = [];
                const halfH = height / 2;

                // Top Cap Center (0), Bottom Cap Center (1)
                v.push(0, 0, halfH); // 0
                v.push(0, 0, -halfH); // 1

                // Ring Vertices
                for (let s = 0; s < sides; s++) {
                    const theta = (s / sides) * 2 * Math.PI;
                    const x = Math.cos(theta) * radius;
                    const y = Math.sin(theta) * radius;
                    // Top (even indices + 2), Bottom (odd indices + 2)? No, let's keep it simple.
                    // Structure: CenterT, CenterB, T0, B0, T1, B1...
                    v.push(x, y, halfH);  // Top Vert
                    v.push(x, y, -halfH); // Bottom Vert
                }

                // Indices construction
                // Base: 0 (center) -> T_i -> T_next
                for (let s = 0; s < sides; s++) {
                    const tCurrent = 2 + (s * 2);
                    const bCurrent = 3 + (s * 2);
                    const tNext = 2 + ((s + 1) % sides * 2);
                    const bNext = 3 + ((s + 1) % sides * 2);

                    // Top Cap
                    i.push(0, tCurrent, tNext);
                    // Bottom Cap
                    i.push(1, bNext, bCurrent); // CCW flipped? 1->Next->Current
                    // Side Quad (2 tris)
                    i.push(tCurrent, bCurrent, tNext);
                    i.push(bCurrent, bNext, tNext);

                    // Structural Edges
                    edges.push(tCurrent, tNext); // Top Rim
                    edges.push(bCurrent, bNext); // Bottom Rim
                    edges.push(tCurrent, bCurrent); // Vertical Pillar
                    // Note: Spokes to center (0-tCurrent) are usually hidden in "clean" cylinders, 
                    // but for a Prism they are structural. Let's add them.
                    edges.push(0, tCurrent);
                    edges.push(1, bCurrent);
                }
                return { vertices: new Float32Array(v), indices: new Uint32Array(i), edges: new Uint32Array(edges) };
            }
        }
        */
    }
};
