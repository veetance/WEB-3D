# Rotation Matrices

Formulas for rotating 3D points around each axis.

---

## Rotate Around Y-Axis (Horizontal Pan)

Looking down from above, rotates left/right.

```
x' = x * cos(θ) + z * sin(θ)
y' = y
z' = -x * sin(θ) + z * cos(θ)
```

```javascript
function rotateY(v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: v.x * c + v.z * s,
        y: v.y,
        z: -v.x * s + v.z * c
    };
}
```

---

## Rotate Around X-Axis (Vertical Tilt)

Looking from the side, tilts up/down.

```
x' = x
y' = y * cos(θ) - z * sin(θ)
z' = y * sin(θ) + z * cos(θ)
```

```javascript
function rotateX(v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: v.x,
        y: v.y * c - v.z * s,
        z: v.y * s + v.z * c
    };
}
```

---

## Rotate Around Z-Axis (Roll)

Looking head-on, rotates like a steering wheel.

```
x' = x * cos(θ) - y * sin(θ)
y' = x * sin(θ) + y * cos(θ)
z' = z
```

```javascript
function rotateZ(v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: v.x * c - v.y * s,
        y: v.x * s + v.y * c,
        z: v.z
    };
}
```

---

## Order Matters

Rotation is not commutative: `rotateX(rotateY(v))` ≠ `rotateY(rotateX(v))`

---

*Rotations are the basis of camera control and object animation.*
