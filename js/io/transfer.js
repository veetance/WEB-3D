/**
 * VEETANCE Buffer Transfer
 * Handles OBJ/GLB I/O for Flat Arrays
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Transfer = (function () {
    const store = window.ENGINE.Store;
    const Parser = window.ENGINE.Parser;

    function init() {
        const fileInput = document.getElementById('import-file');
        const downloadAnchor = document.getElementById('downloadAnchor');
        const exportBtn = document.getElementById('exportBtn');
        const loader = document.getElementById('loading-overlay');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.name.toLowerCase().endsWith('.obj') && window.ENGINE.StreamingTransfer) {
                        window.ENGINE.StreamingTransfer.streamOBJ(file);
                    } else {
                        handleFile(file, loader);
                    }
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => handleExport(downloadAnchor));
        }
    }

    function handleFile(file, loader) {
        if (!file) return;
        if (loader) loader.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (ev) => {
            setTimeout(() => {
                try {
                    const name = file.name.split('.').slice(0, -1).join('.') || 'model';
                    // Parser returns { vertices: Float32Array, indices: Uint32Array }
                    console.log(`VFE: Processing ${file.name}...`);
                    const model = file.name.toLowerCase().endsWith('.glb')
                        ? Parser.parseGLB(ev.target.result)
                        : Parser.parseOBJ(ev.target.result);

                    if (model.vertices.length === 0) throw new Error("Parsed model is empty");

                    store.dispatch({ type: 'SET_MODEL', payload: { ...model, name } });

                    // Clear primitive selection visuals
                    document.querySelectorAll('.prim-btn').forEach(b => b.classList.remove('active'));

                    store.dispatch({ type: 'SET_VIEW_MODE', payload: 'WIRE' });
                    console.log(`VFE: Model Matched. Manifold stabilized.`);
                } catch (err) {
                    console.error('Core Logic IO Error:', err);
                } finally {
                    if (loader) loader.classList.add('hidden');
                }
            }, 50); // Small delay to allow UI to render spinner
        };

        reader.readAsArrayBuffer(file);
    }

    function handleExport(anchor) {
        const state = store.getState();
        const { vertices, indices, ui } = state;

        if (!vertices || vertices.length === 0) return;

        // Construct OBJ from Flat Arrays
        // v x y z
        // f i/i/i

        // This can be heavy for large models on Main Thread. 
        // Ideally should be chunked or worker-ized. For now, we do it raw.

        let content = `# VEETANCE Export\n`;
        const vLen = vertices.length / 3;
        const fLen = indices.length / 3;

        // Vertices
        for (let i = 0; i < vLen; i++) {
            content += `v ${vertices[i * 3].toFixed(6)} ${vertices[i * 3 + 1].toFixed(6)} ${vertices[i * 3 + 2].toFixed(6)}\n`;
        }

        // Faces (1-indexed for OBJ)
        for (let i = 0; i < fLen; i++) {
            content += `f ${indices[i * 3] + 1} ${indices[i * 3 + 1] + 1} ${indices[i * 3 + 2] + 1}\n`;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        if (anchor) {
            const fileName = (ui.currentModelName || 'model') + '_export.obj';
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();
            URL.revokeObjectURL(url);
        }
    }

    // Auto-init on load if scripting order allows, otherwise index.js calls init()
    // We expose init and handle functions.
    return { init, handleFile, handleExport };
})();

// Self-init if DOM ready (failsafe)
if (document.readyState === 'complete') window.ENGINE.Transfer.init();
else document.addEventListener('DOMContentLoaded', () => window.ENGINE.Transfer.init());
