# Rendering Pipeline

The stages that transform 3D vertices into screen pixels.

---

## Overview

```
VERTICES → Transform → Project → Screen → Rasterize → PIXELS
```

---

## Stage 1: Object Transform

Apply the object's own scale, rotation, and position.

```javascript
p = scale(vertex, objectScale);
p = rotateX(p, objectRotation.x);
p = rotateY(p, objectRotation.y);
p = rotateZ(p, objectRotation.z);
p = add(p, objectPosition);
```

---

## Stage 2: Camera Transform

Apply the camera's orbit rotation and zoom.

```javascript
p = rotateY(p, cameraOrbitY);
p = rotateX(p, cameraOrbitX);
p = translateZ(p, cameraZoom);
```

---

## Stage 3: Projection

Convert 3D to 2D using perspective division.

```javascript
p = { x: p.x / p.z, y: p.y / p.z };
```

---

## Stage 4: Screen Mapping

Convert normalized coordinates to pixel coordinates.

```javascript
p = screen(p, canvasWidth, canvasHeight);
```

---

## Stage 5: Rasterization

Draw the geometry to the canvas.

For wireframe rendering with Painter's Algorithm:

```javascript
// Sort faces back-to-front
faces.sort((a, b) => avgZ(b) - avgZ(a));

for (face of faces) {
    fillPolygon(face, backgroundColor);   // Occlude back faces
    strokePolygon(face, wireframeColor);  // Draw edges
}
```

---

## Pipeline Diagram

```
┌────────────┐   ┌────────────┐   ┌────────────┐
│   SCALE    │ → │   ROTATE   │ → │ TRANSLATE  │  Object
└────────────┘   └────────────┘   └────────────┘
                        │
                        ▼
              ┌────────────────┐
              │  ORBIT ROTATE  │  Camera
              └────────────────┘
                        │
                        ▼
              ┌────────────────┐
              │   Z OFFSET     │  Zoom
              └────────────────┘
                        │
                        ▼
              ┌────────────────┐
              │   PROJECT      │  x/z, y/z
              └────────────────┘
                        │
                        ▼
              ┌────────────────┐
              │  SCREEN MAP    │  Pixels
              └────────────────┘
                        │
                        ▼
              ┌────────────────┐
              │  RASTERIZE     │  Draw
              └────────────────┘
```

---

*Each stage is a pure function: input → transform → output.*
