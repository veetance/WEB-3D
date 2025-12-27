/**
 * VEETANCE Logic Engine - Geometry Optimizer
 * High-performance mesh decimation via Grid-Based Vertex Clustering.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Optimizer = {
    /**
     * Reduces mesh complexity by merging vertices within grid cells.
     * @param {Float32Array} vertices
     * @param {Uint16Array|Uint32Array} indices
     * @param {number} strength - 10 to 100 (higher = more reduction)
     */
    cluster: (vertices, indices, strength) => {
        const vCount = vertices.length / 3;
        const fCount = indices.length / 3;

        // Calculate Grid Resolution (Coarseness)
        // Strength 10 (Fine) to 100 (Coarse)
        const resolution = 1 / (strength * 0.01);

        const grid = new Map();
        const newVertices = [];
        const vertexMap = new Int32Array(vCount); // Old Index -> New Index

        // 1. Cluster Vertices
        for (let i = 0; i < vCount; i++) {
            const ix = i * 3;
            const x = vertices[ix], y = vertices[ix + 1], z = vertices[ix + 2];

            // Quantize to grid
            const qx = Math.round(x * resolution);
            const qy = Math.round(y * resolution);
            const qz = Math.round(z * resolution);
            const key = `${qx}_${qy}_${qz}`;

            if (!grid.has(key)) {
                const newIdx = newVertices.length / 3;
                grid.set(key, newIdx);
                newVertices.push(x, y, z);
                vertexMap[i] = newIdx;
            } else {
                vertexMap[i] = grid.get(key);
            }
        }

        // 2. Re-index and Cull Degenerate Faces
        const newIndices = [];
        for (let i = 0; i < fCount; i++) {
            const i3 = i * 3;
            const a = vertexMap[indices[i3]];
            const b = vertexMap[indices[i3 + 1]];
            const c = vertexMap[indices[i3 + 2]];

            // Only add faces that are not collapsed to points or lines
            if (a !== b && b !== c && c !== a) {
                newIndices.push(a, b, c);
            }
        }

        return {
            vertices: new Float32Array(newVertices),
            indices: indices.constructor === Uint16Array ? new Uint16Array(newIndices) : new Uint32Array(newIndices)
        };
    }
};
