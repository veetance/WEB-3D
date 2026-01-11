# VEETANCE Engine Backup & Documentation

## 1. Novel Point Cloud Mode (Particle Manifold)
The Point Cloud mode represents geometry as a collection of sampled points, bypassing the face-rasterization pipeline for a high-performance, particle-like visualization.

### Interaction & UX
- **Side Panel Control**: A slider within the "Point Cloud" section tab (`#point-budget`) allows users to adjust the density of the point cloud in real-time.
- **Scroll Wheel Synchronization**: Users can hover over the point cloud slider area and use the **Scroll Wheel** to increase or decrease point density quickly.
- **Visual Feedback**: The point cloud color is synchronized with the engine's foreground color (`config.fg`).

### UI Integration: The "Digital Lattice" Button-Slider
The Point Cloud slider is architecturally integrated into the view-mode button itself, creating a multi-layered "Digital Lattice" interaction.

- **Dormant State**: The slider is invisible (`opacity: 0`) and sits 5px above the Point Cloud button.
- **Active State (Peak-on-Hover)**: Hovering over the Point Cloud button (`.point-cloud-container`) slides the density control down into view (`bottom: +2px`) and fades it in. 
- **Lattice Motif**: The slider uses a neon-cyan (`#00ffd2`) rectangular thumb with a high-glow shadow, mimicking a digital measurement probe.

### UI Styles (CSS)
```css
/* Point Cloud Digital Lattice Slider */
.point-cloud-container {
    position: relative;
    flex: 1;
    display: flex;
}

.point-cloud-container .mode-btn {
    width: 100%;
}

.point-slider {
    position: absolute;
    bottom: calc(100% + 5px);
    left: 10%;
    width: 80% !important;
    height: 2px !important;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    accent-color: #00ffd2;
    background: rgba(0, 255, 210, 0.1) !important;
    margin: 0 !important;
}

.point-cloud-container:hover .point-slider,
.point-slider:hover {
    opacity: 1;
    pointer-events: auto;
    bottom: calc(100% + 2px);
}

.point-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 1px;
    background: #00ffd2;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0, 255, 210, 0.8);
    border: none;
    margin-top: -4px;
}
```

### Interaction Logic (JS)
```javascript
// Point Budget Scroll Control inside ui.js
const pointContainer = document.querySelector('.point-cloud-container');
const pointSlider = document.getElementById('point-budget');
if (pointContainer && pointSlider) {
    pointContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = 2000;
        const direction = e.deltaY > 0 ? -1 : 1;
        let newValue = parseInt(pointSlider.value) + (direction * step);
        newValue = Math.max(parseInt(pointSlider.min), Math.min(parseInt(pointSlider.max), newValue));

        pointSlider.value = newValue;
        store.dispatch({ type: 'UPDATE_CONFIG', payload: { pointBudget: newValue } });
    }, { passive: false });
}
```

### Rendering Implementation (JS)
```javascript
// Inside rasterizer-pixel.js
function renderPoints(ctx, screen, sCount, config, width, height) {
    const buffers = Pool.getBuffers();
    const fb = buffers.framebuffer;
    const db = buffers.pixelDepth;

    const baseColor = config.fg || '#00ffd2';
    const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);
    const pointColor = 0xFF000000 | (b << 16) | (g << 8) | r;

    for (let i = 0; i < sCount; i++) {
        const i4 = i << 2;
        if (screen[i4 + 3] < 0) continue;

        const sx = screen[i4] | 0, sy = screen[i4 + 1] | 0, sz = screen[i4 + 2];
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

        const idx = sy * width + sx;
        if (sz > db[idx] - 0.05) {
            db[idx] = sz;
            fb[idx] = pointColor;
        }
    }
}
```

---

## 2. Geometry Preparation (OBJ/Primitive Normalization)
All external and internal models pass through `Parser.finalizeManifold` to ensure they are upright, centered, and physically consistent within the VEETANCE manifold.

### A. Axis Conversion (Upright Logic)
Standard OBJ files often use **Y-Up**, while the VEETANCE engine operates on a **Z-Up** world-axis. We convert coordinates during parsing to ensure models face correctly.
```javascript
// Y-up to Z-up conversion
if (isYUp) {
    out[i * 3]     = x;   // X remains X
    out[i * 3 + 1] = -z;  // Forward becomes Y
    out[i * 3 + 2] = y;   // Up becomes Z
}
```

### B. Unit Normalization (Scaling)
Models are scaled proportionately to fit a standard bounding volume (default 6.0 units), preventing models from being too small to see or large enough to clip the near plane.
```javascript
const maxRange = Math.max(rangeX, rangeY, rangeZ) || 1;
const scale = 6.0 / maxRange; // Normalize to 6-unit master scale
```

### C. Manifold Grounding
To ensure models don't "float" or clip through the grid arbitrarily, we calculate the lowest relative Z-point and offset the entire vertex buffer so the model sits exactly at `Z = 0`.
```javascript
// Step 5: Ground the model (sit on Z=0 plane)
let groundZ = Infinity;
for (let i = 0; i < numVerts; i++) {
    if (out[i * 3 + 2] < groundZ) groundZ = out[i * 3 + 2];
}
// Apply grounding offset
for (let i = 0; i < numVerts; i++) {
    out[i * 3 + 2] -= groundZ;
}
```

---

## 3. View Modes Documentation

### SHADED_WIRE (Default)
Combines shaded polygon faces with structural wireframe edges.
- **Logic**: Renders triangles using `RasterizerPixel.render`, followed by edges using `RasterizerPixel.renderEdges`.
- **Optimization**: Uses `structuralEdges` (coplanar-culled) to provide a clean architectural look.

### SOLID
Pure shaded rendering.
- **Logic**: Only calls `RasterizerPixel.render`. No wireframe overlay.
- **Shading**: CPU-based Lambertian shading calculated per triangle normal.

### WIRE
Classic wireframe view.
- **Logic**: Clears the framebuffer and only renders structural edges. 
- **Z-Buffer**: Uses depth-testing to allow edges to be occluded by closer geometry or themselves.

### POINTS
The novel point cloud manifold.
- **Logic**: Uses a secondary sampler inside `Batcher.js` to extract vertices based on the `pointBudget`.
- **Performance**: The fastest rendering mode, capable of moving millions of points at 60fps on the CPU.

---

## 4. Core Rendering Lifecycle (`js/core/engine.js`)
The engine uses an atomic **Clear -> Transform -> Render -> Flush** lifecycle to ensure zero flickering and consistent state.

```javascript
// Centralized SW Lifecycle
RP.clearHW(driverWidth, driverHeight); // 1. Reset Z-Buffer & Framebuffer

if (state.config.viewMode === 'POINTS') {
    // 2a. Point Path
    MathOps.projectBuffer(buffers.sampledScreen, sCount, driverWidth, driverHeight, fovScale);
    RP.renderPoints(mainCtx, buffers.sampledScreen, sCount, config, driverWidth, driverHeight);
    RP.flush(mainCtx, driverWidth, driverHeight);
} else {
    // 2b. Facet/Edge Path
    MathOps.projectBuffer(buffers.screen, vCount, driverWidth, driverHeight, fovScale);
    if (config.viewMode !== 'WIRE') RP.render(mainCtx, buffers.screen, ...);
    if (isWireMode || isShadedWire) RP.renderEdges(mainCtx, buffers.screen, ...);
    RP.flush(mainCtx, driverWidth, driverHeight);
}
```
