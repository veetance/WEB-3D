# File Structure

Project architecture following the fragmentation principle.

---

## Directory Layout

```
WEB-3D/
├── index.html          # HTML structure only
├── docs/               # Documentation (this folder)
│   ├── README.md
│   ├── philosophy.md
│   ├── projection.md
│   ├── coordinates.md
│   ├── rotation.md
│   ├── pipeline.md
│   ├── glb-format.md
│   ├── painters-algorithm.md
│   ├── writing-pixels.md
│   └── file-structure.md
├── styles/             # CSS modules
│   ├── base.css        # Resets, body
│   ├── sidebar.css     # Panel layout
│   ├── controls.css    # Inputs, buttons
│   └── viewport.css    # Canvas, overlays
├── math.js             # Vector/matrix ops
├── renderer.js         # Canvas drawing
├── parser.js           # GLB/OBJ loading
├── data.js             # Default geometry
├── index.js            # Engine loop
└── obj/                # Sample models
    └── HELMET_02.glb
```

---

## File Responsibilities

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~85 | Pure HTML structure |
| `base.css` | ~35 | Resets, typography |
| `sidebar.css` | ~75 | Collapsible panel |
| `controls.css` | ~90 | Form elements |
| `viewport.css` | ~60 | Canvas area |
| `math.js` | ~40 | Transforms |
| `renderer.js` | ~50 | Drawing |
| `parser.js` | ~150 | Model loading |
| `data.js` | ~25 | Cube vertices |
| `index.js` | ~180 | Main loop |

---

## Rules

1. **No file exceeds ~200 lines**
2. **Single responsibility per file**
3. **No internal dependencies between CSS files**
4. **JS files communicate via `window.ENGINE`**

---

## Loading Order

HTML loads in this order:
```html
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/sidebar.css">
<link rel="stylesheet" href="styles/controls.css">
<link rel="stylesheet" href="styles/viewport.css">

<script src="math.js"></script>
<script src="renderer.js"></script>
<script src="data.js"></script>
<script src="parser.js"></script>
<script src="index.js"></script>
```

Order matters for JS — later files depend on earlier globals.

---

*Small files, clear purpose, no surprises.*
