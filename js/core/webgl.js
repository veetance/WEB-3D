/** 
 * VEETANCE WebGL Core
 * The foundational hardware layer for GPU-accelerated Bio-Shaders.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GL = (function () {
    let gl = null;
    let program = null;
    let vbo = null;
    let ebo = null;

    const vsSource = `
        attribute vec3 aPosition;
        
        uniform mat4 uModelView;
        uniform mat4 uProjection;
        
        varying float vDepth;
        varying vec3 vViewPos;

        void main() {
            vec4 viewPos = uModelView * vec4(aPosition, 1.0);
            gl_Position = uProjection * viewPos;
            vViewPos = viewPos.xyz;
            vDepth = -viewPos.z; // Depth in view space
        }
    `;

    const fsSource = `
        precision highp float;
        varying float vDepth;
        varying vec3 vViewPos;
        
        uniform vec3 uPolyColor;
        uniform vec3 uFogColor;
        uniform float uTime;
        uniform float uViewMode; 
        uniform float uNear;
        uniform float uFar;

        vec3 posterize(vec3 color, float levels) {
            return floor(color * levels) / levels;
        }

        void main() {
            // 1. Basic Lighting (Fake it with View-Space normal approximation or just simple depth)
            // dFdx/dFdy would be better for flat shading normals
            vec3 normal = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
            float intensity = max(0.2, dot(normal, normalize(vec3(0.2, 0.3, 1.0))));

            // 2. Fog Calculation
            float fogFactor = smoothstep(uNear, uFar, vDepth);
            vec3 baseColor = uPolyColor * intensity;

            // 3. Beauty / Posterize Mode
            if (uViewMode > 0.5) {
                vec3 painted = posterize(baseColor, 4.0);
                float pulse = sin(uTime * 3.0) * 0.03;
                painted += pulse;
                gl_FragColor = vec4(mix(painted, uFogColor, fogFactor), 1.0);
            } else {
                gl_FragColor = vec4(mix(baseColor, uFogColor, fogFactor), 1.0);
            }
        }
    `;

    function init(canvas) {
        gl = canvas.getContext('webgl', { antialias: true, alpha: false });
        if (!gl) {
            console.error("VEETANCE: WebGL context stabilization failed.");
            return false;
        }

        gl.getExtension('OES_element_index_uint');
        gl.getExtension('OES_standard_derivatives');

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clearColor(0.04, 0.04, 0.04, 1.0);

        program = createProgram(gl, vsSource, fsSource);
        gl.useProgram(program);

        vbo = gl.createBuffer();
        ebo = gl.createBuffer();

        return true;
    }

    function createProgram(gl, vs, fs) {
        const vShader = compileShader(gl, vs, gl.VERTEX_SHADER);
        const fShader = compileShader(gl, fs, gl.FRAGMENT_SHADER);
        const prog = gl.createProgram();
        gl.attachShader(prog, vShader);
        gl.attachShader(prog, fShader);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(prog));
        }
        return prog;
    }

    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function render(vertices, indices, modelView, projection, config) {
        if (!gl) return;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        const uMV = gl.getUniformLocation(program, "uModelView");
        const uPJ = gl.getUniformLocation(program, "uProjection");
        const uPoly = gl.getUniformLocation(program, "uPolyColor");
        const uFog = gl.getUniformLocation(program, "uFogColor");
        const uTime = gl.getUniformLocation(program, "uTime");
        const uVM = gl.getUniformLocation(program, "uViewMode");
        const uNear = gl.getUniformLocation(program, "uNear");
        const uFar = gl.getUniformLocation(program, "uFar");

        gl.uniformMatrix4fv(uMV, false, modelView);
        gl.uniformMatrix4fv(uPJ, false, projection);

        const c = config.polyColor || "#1a1a1a";
        gl.uniform3f(uPoly, parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255);
        gl.uniform3f(uFog, 0.04, 0.04, 0.04);
        gl.uniform1f(uTime, performance.now() / 1000);
        gl.uniform1f(uVM, config.viewMode === 'BEAUTY' ? 1.0 : 0.0);
        gl.uniform1f(uNear, 2.0);
        gl.uniform1f(uFar, 50.0);

        const aPos = gl.getAttribLocation(program, "aPosition");
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    }

    return { init, render };
})();
