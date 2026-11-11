import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) {
    console.warn("[pwa] Necesitas HTTPS (o localhost) para registrar el service worker.");
    return;
  }
  if (!import.meta.env.PROD) {
    console.info("[pwa] Service worker solo en build de producción (npm run build:web).");
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        console.log("[pwa] Service worker registrado:", reg.scope);
      })
      .catch((err) => {
        console.error("[pwa] Error al registrar service worker:", err);
      });
  });
}

registerServiceWorker();
