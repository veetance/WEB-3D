# VEETANCE WASM MIGRATION ROADMAP
**Commander:** MrVee | **Executant:** DEUS
**Objective:** Achieve 60+ FPS on 1M+ face models through WebAssembly acceleration and Parallelism.

---

## CURRENT STATE (PHASE 4C COMPLETE)

### Performance Metrics (Parallel WASM + Culling)
- **Pyramid (6 faces):** 300+ FPS ✅
- **Large Troll (81K faces):** 144+ FPS ✅
- **Massive Model (900K+ faces):** 60-120 FPS ✅

### Bottleneck Resolution
**Parallel Tiled Rasterization:**
- Screen divided into 128x128 tiles.
- Distributed processing across all CPU cores via Web Workers.
- `SharedArrayBuffer` for zero-copy synchronization.

**Cluster-Based Frustum Culling:**
- AABB visibility checks pre-filter geometry in C++.
- Only visible clusters are processed, reducing vertex/pixel overhead.

---

## COMPLETED PHASES

### PHASE 4B: CORE WASM RASTERIZER ✅
- Ported `drawTriangle` to C++.
- Implemented SIMD (wasm_simd128) for 4-pixel parallel processing.
- Integrated `FastInvSqrt` for lighting.

### PHASE 4C: PARALLELISM & CULLING ✅
- **Multi-Threading:** Implemented Worker Pool for tiled rendering.
- **Shared Memory:** Integrated `coi-serviceworker.js` for COOP/COEP.
- **Cluster Culling:** Implemented AABB-based visibility filtering in WASM.
- **Fallback:** Added Sequential Tiled Fallback for non-isolated environments.

---

## PHASE 5: TEXTURE & MATERIAL MANIFOLD (IN PROGRESS)

### PHASE 5.1: QEM RETOPOLOGY (Week 4)
**Goal:** Implement Quadric Error Metrics simplification in C++.
**Tasks:**
1. Implement edge collapse logic with quadric error cost.
2. Maintain topology while reducing face count by 50-90%.
3. **Expected Gain:** Fluid interaction even with 10M+ raw polygon scans.

### PHASE 5.2: PERSPECTIVE-CORRECT TEXTURES (Week 5)
**Goal:** Implement Affine and Perspective texture mapping in WASM.
**Tasks:**
1. Add UV interpolation to `renderTile`.
2. Implement bilinear filtering in SIMD.
3. Multi-texture blending for complex materials.

---

## TECHNICAL ARCHITECTURE (CURRENT)

### Memory Layout (Shared)
```
┌─────────────────────────────────────┐
│   SharedArrayBuffer (Heap)          │
├─────────────────────────────────────┤
│ Framebuffer (Uint32Array)           │  ← RGBA pixels
│ Depth Buffer (Float32Array)         │  ← Z-values
├─────────────────────────────────────┤
│ Tile Buffer                         │  ← Binned face lists
├─────────────────────────────────────┤
│ Cluster Buffer                      │  ← AABBs and face offsets
├─────────────────────────────────────┤
│ Screen Buffer (Float32Array)        │  ← Projected vertices
│ Index Buffer (Uint32Array)          │  ← Triangle indices
└─────────────────────────────────────┘
```

### WASM Pipeline
1. `uploadClusters` (Once per model load)
2. `processVertices` (Transform & Lighting)
3. `processClusters` (Frustum Culling & Tiled Binning)
4. `renderTile` (Parallel per-thread rasterization)
5. `flush` (Main thread composition)

---

## SUCCESS CRITERIA ACHIEVED
- ✅ 1M+ face models render at 60+ FPS.
- ✅ No UI stutter during heavy rendering phases.
- ✅ Graceful degradation to single-core if isolation is blocked.

---

**END OF ROADMAP** 🦾✨
**VEETANCE ENGINE - EXCELLENCE IS DETERMINISTIC**
**Commander:** MrVee | **Executant:** DEUS
