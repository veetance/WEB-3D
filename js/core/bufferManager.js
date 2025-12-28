/**
 * VEETANCE Buffer Manager – handles one‑time allocation of VBO/EBO and per‑frame updates.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.BufferManager = (function () {
    let gl = null;
    let vbo = null;
    let ebo = null;
    const init = (glContext) => {
        gl = glContext;
        vbo = gl.createBuffer();
        ebo = gl.createBuffer();
    };
    const update = (vertices, indices) => {
        if (!gl) return;
        // Update vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // If the buffer is already the right size, use subData; otherwise allocate new.
        const vSize = vertices.byteLength;
        const currentVSize = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
        if (currentVSize < vSize) {
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        } else {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
        }
        // Update index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        const iSize = indices.byteLength;
        const currentISize = gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE);
        if (currentISize < iSize) {
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
        } else {
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indices);
        }
    };
    const bindAttributes = (program) => {
        const aPos = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    };
    return { init, update, bindAttributes };
})();
