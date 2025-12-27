# VFE State Engine (VSE)

The brain of the VFE Engine, utilizing a reactive Flux-based architecture inspired by modern high-performance manifolds.

---

## State-Driven Logic

VSE moves away from loose global variables. Every change in the engine—from camera rotation to 3D model loading—flows through a centralized **Store**.

### 1. The Store
A singleton object that holds the "Truth" of the manifold at any given moment.

### 2. Actions
Simple descriptor objects that tell the store *what* happened.
```javascript
{ type: 'UPDATE_CAMERA', payload: { zoom: 10 } }
```

### 3. The Reducer
A pure mathematical function that takes the current state and an action, returning a **new state**. It never mutates the old state.

---

## Why Reactivity?

- **Decoupling:** The UI doesn't need to know how the Math works. It just dispatches an action and the Math reacts.
- **Predictability:** Debugging becomes a matter of tracking the action stream.
- **Optimization:** Components only re-render when their specific slice of the state changes.

---

## Usage in VFE

1. **Dispatch:** `ENGINE.Store.dispatch({ type: 'MOVE_OBJECT', ... })`
2. **Subscribe:** `ENGINE.Store.subscribe(state => { /* Update View */ })`

*VFE: Controlled, Reactive, Superior.*
