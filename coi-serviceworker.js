/*! coi-serviceworker v0.1.7 - MIT License - https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.status === 0) {
                    return response;
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
        );
    });
} else {
    (function () {
        const url = new URL(location.href);
        const hasFailed = url.searchParams.has('coi-failed');

        if (window.crossOriginIsolated) {
            // Resonance Achieved. Scrub the failure flag if it exists.
            if (hasFailed) {
                url.searchParams.delete('coi-failed');
                window.history.replaceState({}, '', url.href);
                console.log("[DEUS] Origin Isolation Confirmed. Manifold Cleansed. 🦾✨");
            }
            return;
        }

        if (hasFailed) {
            console.error("VEETANCE: Multi-core isolation failed. Manifold resonance limited. Check COOP/COEP headers or use a Secure Context.");
            return;
        }

        if (window.location.protocol === 'file:') {
            console.warn("VEETANCE: Local file protocol detected. Multi-core resonance disabled (Requires HTTP/HTTPS Server).");
            return;
        }

        if (!window.isSecureContext || !navigator.serviceWorker) {
            console.warn("VEETANCE: Insecure context or no ServiceWorker support. Multi-core resonance disabled.");
            return;
        }

        console.log("[DEUS] Initiating Origin Isolation Protocol...");
        const script = document.currentScript;
        navigator.serviceWorker.register(script.src).then((registration) => {
            // Wait for the service worker to be active
            const waitForActive = () => {
                const sw = registration.installing || registration.waiting || registration.active;
                if (sw && sw.state === "activated") {
                    console.log("[DEUS] Manifold synchronized. Initializing origin shift...");
                    location.reload();
                } else if (sw) {
                    sw.addEventListener("statechange", (e) => {
                        if (e.target.state === "activated") {
                            console.log("[DEUS] Manifold synchronized. Initializing origin shift...");
                            location.reload();
                        }
                    });
                }
            };

            if (registration.active && !navigator.serviceWorker.controller) {
                location.reload();
            } else {
                waitForActive();
            }
        }).catch(err => {
            console.error("VEETANCE: ServiceWorker registration failed:", err);
            url.searchParams.set('coi-failed', '1');
            location.href = url.href;
        });
    })();
}
