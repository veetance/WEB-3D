# Physics and Game Logic

To evolve the VEETANCE manifold into a game engine, we must move from static rendering to dynamic interaction.

---

## 1. The Game Loop

A standard game loop separates **Update** (Physics) from **Render** (Graphics).

```javascript
let lastTime = 0;
function loop(time) {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    update(deltaTime); // Physics, Input, AI
    render();          // Projection, Sorting, Rasterization
    
    requestAnimationFrame(loop);
}
```

---

## 2. Collision Detection (AABB)

For Geometry Dash/Pac-Man style games, **Axis-Aligned Bounding Boxes** are the most efficient baremetal solution.

```javascript
function checkCollision(a, b) {
    return (a.minX <= b.maxX && a.maxX >= b.minX) &&
           (a.minY <= b.maxY && a.maxY >= b.minY) &&
           (a.minZ <= b.maxZ && a.maxZ >= b.minZ);
}
```

---

## 3. WASM for Heavy Logic

If physics calculations (e.g., 10,000 particles) become slow, we use **WebAssembly (WASM)**.

- **Source:** Written in Rust (pure, no crates).
- **Target:** Compiled to `.wasm`.
- **Interface:** JavaScript calls WASM functions to process arrays of numbers.
- **Why?** Near-native execution speed for math-heavy operations.

---

## 4. GPU (WebGL) Baremetal

WebGL is not a library; it is a **Browser API**. To utilize the GPU without libraries:

1. Request `webgl` context from canvas.
2. Write **GLSL** (OpenGL Shading Language).
3. Compile shaders at runtime using JS.
4. Pass buffers to the GPU.

**This is the ultimate baremetal path for 3D graphics.**

---

*VEETANCE: High performance through low-level control.*
