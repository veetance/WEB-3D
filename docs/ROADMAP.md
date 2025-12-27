# VFE Engine Roadmap

Our journey to create a world-class, baremetal 3D indie game engine.

---

## Phase 1: Foundation (Complete)
- [x] Baremetal Math (Projection, Rotation, Translation)
- [x] Solid Geometry Support (Proper Closed Manifolds)
- [x] GLB/OBJ Parsing (Direct Binary Buffer Extraction)
- [x] Optimized Depth Sorting (Linear Time O(n) Radix Sort)
- [x] Pure CSS HUD & Layout System

---

## Phase 2: Dual-Mode Architecture
- [ ] **CPU Mode:** Canvas 2D Painter's Algorithm (Existing)
- [ ] **GPU Mode:** Raw WebGL context with custom GLSL Shader compiler
- [ ] **The "Switch":** Real-time toggle between CPU rasterizer and GPU frag/vert shaders
- [ ] **Common Interface:** Unified rendering call that abstracts the backend

---

## Phase 3: Game Core & Simulation
- [ ] **Input System:** Integrated Keyboard/Mouse/Gamepad mapping
- [ ] **Physics (WASM/Rust):** 
  - Cross-compiling Rust to WebAssembly for heavy vector math
  - AABB and Mesh-based collision detection
  - Gravity and Impulse systems
- [ ] **Scene Graph:** Parent-child transforms for skeletal/hierarchical objects

---

## Phase 4: Shading & FX
- [ ] **Custom Shaders:** GLSL Fragment/Vertex shader support
- [ ] **Lighting:** Flat, Gouraud, and basic Phong reflection
- [ ] **Post-Processing:** Kernel-based effects (Blur, Bloom, Chromatic Aberration) implemented in GPU shaders

---

## Phase 5: Developer Tooling
- [ ] **In-Engine Editor:** Move/Rotate/Scale objects in the viewport
- [ ] **Hierarchy Tree:** Visual manifold management
- [ ] **Scene Serialization:** Save/Load levels as pure JSON
- [ ] **Asset Pipeline:** Live hot-reloading for GLB/OBJ models

---

*VEETANCE: Built on the iron of the hardware, not the fluff of the libraries.*
