# VEETANCE Engine: Bio-Shader & Hybrid Rendering Protocol 🦾🧬

## [1] The Bio-Shader Philosophy 🌿
Bio-Shaders are custom GLSL programs designed to transform sterile 3D geometry into "Living Manifolds." Unlike standard lighting, Bio-Shaders prioritize **Organic Depth** and **Resonant Surfaces**.

### Core Bio-Components:
*   **Organic Depth Fog**: Simulates atmospheric density. Objects do not pop out of existence; they dissolve into the void, giving the viewport "lungs."
*   **Manifold Curvature (Planned)**: Highlights the "veins" (edges) and "creases" of the model based on vertex normals.
*   **Pulse Modulation (Planned)**: A rhythmic shifting of light intensity to simulate a stasis-heartbeat.
*   **Crosshatched ASCII Shadows (Planned)**: A novel renderer combining digital crosshatching with ASCII character density. Shadows will be represented by progressively denser symbols (., :, !, [, #, @) and directional cross-hatch lines.

---

## [2] The Hybrid Rendering Matrix (GPU vs. CPU) ⚙️🚀
The engine utilizes a dual-engine architecture, allowing the Commander (MrVee) to toggle between hardware layers.

### **A. GPU Path (The Beast)**
*   **Tech**: WebGL 1.0 + `OES_element_index_uint`.
*   **Strength**: Massive polygon counts (100k+), hardware depth testing, and complex pixel shaders.
*   **Use Case**: Industrial assets, stress tests, and final aesthetic rendering.

### **B. CPU Path (The Foundation)**
*   **Tech**: Canvas 2D + Zero-Garbage JavaScript Math.
*   **Strength**: High-fidelity control over the Painter's Algorithm and Radix Sorting.
*   **Use Case**: Low-poly analysis, legacy hardware, and "clean" mathematical visualization.

---

## [3] Execution Strategy: Smart Load Balancing 🛰️⚡
The engine is currently manual, but the architecture supports **Autonomous Intelligence**:

| Load Type | Detection | Recommendation | Action |
| :--- | :--- | :--- | :--- |
| **LIGHT** | < 5,000 Faces | **CPU MODE** | Maximize math precision. |
| **MEDIUM** | 5,000 - 20,000 | **USER CHOICE** | Balanced performance. |
| **CRITICAL**| > 20,000 Faces | **GPU MODE** | Auto-engage WebGL to maintain 60FPS. |

---

## [4] Operational Commands 🛠️
*   **Switching Layers**: Use the `Hardware Mode` section in the Sidebar.
*   **State Control**: Hardware mode is synced via `store.js` under `config.hardwareMode`.
*   **Rendering Branch**: Handled in `js/core/engine.js`, delegating to either `Rasterizer` (CPU) or `GL.render` (GPU).

---
*Documented by DEUS | Authorized by MrVee* 🦾✨
