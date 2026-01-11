/** 
 * VEETANCE OBJ Parser Worker (Turbo Edition)
 * Handles heavy text parsing and triangulation off the main thread.
 */
self.onmessage = function (e) {
    const { chunk, leftover } = e.data;
    const vertices = [];
    const indices = [];

    // Combine with previous leftover and process lines
    const content = leftover + chunk;
    const lines = content.split(/\r?\n/);
    const nextLeftover = lines.pop(); // Hold onto the potentially sliced line

    for (let i = 0, len = lines.length; i < len; i++) {
        const line = lines[i].trim();
        if (line.length < 2 || line[0] === '#') continue;

        const parts = line.split(/\s+/);
        const type = parts[0].toLowerCase();

        if (type === 'v') {
            // Vertex definition
            const vx = parseFloat(parts[1]);
            const vy = parseFloat(parts[2]);
            const vz = parseFloat(parts[3]);
            if (!isNaN(vx)) vertices.push(vx, vy, vz);
        } else if (type === 'f') {
            // Face definition (supports triangulation of n-gons)
            const face = [];
            for (let j = 1; j < parts.length; j++) {
                const p = parts[j];
                if (!p) continue;
                // OBJ indices can be v, v/vt, or v/vt/vn
                const vIdx = parseInt(p);
                if (!isNaN(vIdx)) {
                    // Convert to 0-based index (relative indices handled at model level if needed, 
                    // but standard is positive)
                    face.push(vIdx - 1);
                }
            }

            // Fan Triangulation for quads or complex polygons
            for (let j = 1; j < face.length - 1; j++) {
                indices.push(face[0], face[j], face[j + 1]);
            }
        }
    }

    // Binary transfer for zero-copy performance
    const vBuffer = new Float32Array(vertices);
    const iBuffer = new Uint32Array(indices);

    self.postMessage({
        vertices: vBuffer,
        indices: iBuffer,
        leftover: nextLeftover
    }, [vBuffer.buffer, iBuffer.buffer]);
};
