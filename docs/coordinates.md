# Coordinate Systems & Import Normalization

## Rotate Around Z-Axis (Horizontal Pan)
Looking down from above, rotates left/right around the vertical axis.

## The VEETANCE Manifold Standard
The engine operates natively in a **Z-Up, Right-Handed** coordinate system.
- **+Z**: Up (Gravity opposes this)
- **+Y**: Forward / Depth
- **+X**: Right

---

## Import Normalization Protocols

Different 3D formats adhere to different coordinate conventions. The Parser Engine automatically normalizes incoming data to fit the VEETANCE standard.

### 1. GLB / glTF Format (Y-Up Correction)
The glTF specification defines a **Y-Up** World.
- **Raw Data**: Y is Up, Z is Forward/Back.
- **The Problem**: Raw import appears "face down" or rotated -90 degrees on X.
- **The Fix**: The Parser detects `.glb` extensions and applies a coordinate swap during normalization.
  - `New X` = `Old X`
  - `New Y` = `Old Z`
  - `New Z` = `-Old Y` (Inverted to maintain Right-Hand Rule)

### 2. OBJ Format (Pass-Through)
The Wavefront OBJ format does not strictly enforce an axis convention, but it is often exported with Z-Up in CAD/Engineering contexts or intended for generic usage.
- **Protocol**: No rotation is applied.
- **Behavior**: The model is only **Centered** and **Scaled** to fit the unit view volume.
- **Reasoning**: Automatic rotation often breaks properly exported OBJs (like "Labub"). We assume the user has exported OBJ in the desired orientation.

---

## Projection: Display Space (Normalized)

After geometry processing, coordinates are projected to normalized display space:

- **Origin**: Center of screen
- **X range**: -1 (left) to +1 (right)
- **Y range**: -1 (bottom) to +1 (top)

This is independent of screen resolution.

---

## Screen Space (Pixels)

The actual canvas uses pixel coordinates:

- **Origin**: Top-left corner
- **X range**: 0 (left) to width (right)
- **Y range**: 0 (top) to height (bottom)

Note: Y is **inverted** compared to math convention.

---

## Conversion Formula

```javascript
function screen(p, width, height) {
    const x = ((p.x + 1) / 2) * width;
    const y = ((1 - p.y) / 2) * height; // Y flipped
    return { x, y };
}
```

### Breakdown

| Step | X | Y |
|------|---|---|
| Display input | -1 to +1 | -1 to +1 |
| Add 1 | 0 to 2 | - |
| Flip Y (1 - y) | - | -1 to +1 → +2 to 0 |
| Add 1 to flipped | - | 0 to 2 |
| Divide by 2 | 0 to 1 | 0 to 1 |
| Multiply by size | 0 to width | 0 to height |

---

## Visual

```
Display Space          Screen Space
    +Y                     0,0 ────► X
     ▲                      │
     │                      │
─────┼─────► +X             ▼
     │                      Y
    -Y
```

---

*Coordinate conversion is where math meets pixels.*
