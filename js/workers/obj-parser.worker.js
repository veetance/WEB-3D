/** 
 * VEETANCE OBJ Parser Worker
 * Handles heavy text parsing off the main thread.
 */
self.onmessage = function (e) {
    const { chunk, leftover } = e.data;
    const vertices = [];
    const indices = [];

    const lines = (leftover + chunk).split(/\r?\n/);
    const newLeftover = lines.pop(); // Incomplete line

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const type = parts[0];

        if (type === 'v') {
            vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        } else if (type === 'f') {
            // Triangle face parsing
            indices.push(parseInt(parts[1]) - 1, parseInt(parts[2]) - 1, parseInt(parts[3]) - 1);
        }
    }

    self.postMessage({
        vertices: new Float32Array(vertices),
        indices: new Uint32Array(indices),
        leftover: newLeftover
    });
};
