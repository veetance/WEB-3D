# VEETANCE Standard: Fluid Viewport Synchronization

## 1. The Problem: Aspect Distortion & Resize Flicker
In a high-fidelity 3D environment, two critical failures occur when the UI (sidebars/panels) modifies the available canvas territory:
1.  **Aspect Distortion**: Geometry "stretches" or "squashes" because 3D units map to pixels without compensating for the change in width-to-height ratio.
2.  **Black Frame Flicker**: Modifying `canvas.width` or `canvas.height` instantly flushes the graphics context buffer, resulting in a blank black frame until the next asynchronous render cycle.

## 2. The Solution: Synchronous Manifold Reflow
To maintain "Veetance Excellence," all viewports must implement the following dual-layer synchronization.

### Layer A: Mathematical Calibration (Aspect Correction)
Projection logic must maintain a fixed vertical field of view (FOV) while allowing the horizontal axis to expand naturally.

**Pattern (Inside Projection Loop):**
```javascript
// Scale is derived from FOV and Depth
const scale = fov / Math.abs(z);

// Aspect ratio correction: Scale Y by width/height ratio
// This preserves the squareness of the grid relative to horizontal pixel density
const x = out[ox] * scale;
const y = out[ox + 1] * scale * (width / height);
```

### Layer B: Buffer Repopulation (ResizeObserver)
Instead of waiting for the next `requestAnimationFrame`, a synchronous render must be injected the moment the DOM shifts.

**Pattern (Orchestration):**
```javascript
const ro = new ResizeObserver(() => {
    const parent = canvas.parentElement;
    if (parent) {
        // 1. Sync internal resolution to DOM size (Flushes Buffer)
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        
        // 2. Immediate Synchronous Frame Injection
        // Bypasses the async loop to bridge the 'Black Frame' gap
        window.ENGINE.Core.update(ctx, canvas);
    }
});
ro.observe(canvas.parentElement);
```

## 3. Implementation Checklist
- [ ] **Engine Core**: Expose an `update()` method that performs a one-shot draw call.
- [ ] **Sidebar Transitions**: Ensure CSS transitions (e.g., `0.3s ease`) are captured by the `ResizeObserver`.
- [ ] **State Preservation**: Ensure immediate re-renders use the latest state from the `Store`.

---
*VEETANCE CORE DIRECTIVE - [VCD-SYNC-01]*
