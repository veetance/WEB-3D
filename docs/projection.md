# Projection Formula

The core mathematical operation that transforms 3D space into 2D screen.

---

## The Formula

```
x' = x / z
y' = y / z
```

Given a point `P(x, y, z)` in 3D space, its projection onto a 2D plane is `P'(x/z, y/z)`.

---

## Proof via Similar Triangles

```
        Eye (origin)
           *
          /|\
         / | \
        /  |  \
       /   |   \
      /    |    \
     *-----+-----*  Screen plane (z = 1)
    P'     |     
           |
           * P(x, y, z)
```

The eye is at the origin `(0, 0, 0)`.
The screen is at `z = 1`.
Point P is at `(x, y, z)`.

By similar triangles:
- Triangle from eye to P' is similar to triangle from eye to P
- Ratio: `1 / z`

Therefore:
- `x' = x * (1/z) = x/z`
- `y' = y * (1/z) = y/z`

---

## Implementation

```javascript
function project(p) {
    const z = p.z || 1; // Prevent division by zero
    return {
        x: p.x / z,
        y: p.y / z
    };
}
```

---

## Notes

- Objects with larger Z appear smaller (perspective)
- Objects at Z=1 appear at their actual X,Y coordinates
- Objects at Z=2 appear half size
- Objects at Z<0 are behind the camera (should be clipped)

---

*This single formula is the foundation of all 3D graphics.*
