# VEETANCE: SOFTWARE MANIFOLD PIVOT 🦾⚙️

This document outlines the strategic pivot from GPU-dependent rendering to a "Clinical Software Rasterizer" philosophy, inspired by the 1996-1998 software rendering revolution (Quake, Doom). We exploit modern CPU instruction sets to achieve "Infinite Detail" without the overhead of the Graphics API.

## PHASE 1: THE SCANLINE MANIFOLD (ELIMINATING OVERDRAW)
*Objective: Implement a Zero-Overdraw Span-Buffered Rasterizer.*
- [ ] **Edge Table Construction**: Project edges into screen-space and build an Active Edge List (AEL).
- [ ] **Scanline Traversal**: Iterate across scanlines, managing an Active Polygon List (APL) sorted by depth.
- [ ] **Span Generation**: Output non-overlapping spans for the front-most polygon on every line.
- [ ] **Tile-Based Culling**: Divide the screen into 16x16 tiles for early cluster-rejection.

## PHASE 2: CLUSTERED HIERARCHY (CPU NANITE)
*Objective: Virtualize geometry on the i9 manifold.*
- [x] **128-Vertex Clusters**: Fragment all incoming meshes into localized packets.
- [ ] **SIMD Rasterization**: Use WebAssembly SIMD (128-bit) to process 4 pixels of a barycentric loop simultaneously.
- [x] **Frustum/Backface Cluster Culling**: Reject entire chunks of the model with a single check.

## PHASE 3: THE BSP SUBSTRATE
*Objective: Static visibility determination.*
- [ ] **BSP Tree Generator**: Implement a spatial partitioning tree for the fixed world geometry.
- [ ] **PVS (Potentially Visible Set)**: Pre-calculate leaf-to-leaf visibility to skip 90% of the manifold before processing edges.

## PHASE 4: THE PIXEL-PERFECT AESTHETIC
*Objective: Embrace the "Unfiltered Raw" look.*
- [ ] **True Affine/Perspective Texture Mapping**: (Future) Implement perspective-correct spans every 16 pixels.
- [ ] **Reduced Color Manifold**: Optional 8-bit palette emulation for that clinical 1997 banding.

---
**Architectural Goal**: To outperform dedicated GPUs in specific micro-geometry scenarios by eliminating API draw-call overhead and maximizing Cache-Locality on the CPU. 🦾✨
