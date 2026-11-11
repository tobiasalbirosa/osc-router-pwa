import { useEffect, useState, useCallback } from "react";
import { colors, radius, space } from "../theme/tokens";

/**
 * Chrome exige HTTPS, manifest + SW, y además heurísticas de uso (~30 s + un toque)
 * antes de mostrar instalar. No usar preventDefault() en beforeinstallprompt: si lo
 * hacemos, bloqueamos la UI nativa de Chrome hasta que podamos llamar a prompt() nosotros.
 */
export function InstallPwaHelp() {
  const [swHint, setSwHint] = useState("…");
  const [dwellSec, setDwellSec] = useState(0);
  const [tappedOnce, setTappedOnce] = useState(false);

  const secure = typeof window !== "undefined" && window.isSecureContext;
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true);

  useEffect(() => {
    if (isStandalone) return;
    const onInteract = () => setTappedOnce(true);
    window.addEventListener("pointerdown", onInteract, { passive: true });
    return () => window.removeEventListener("pointerdown", onInteract);
  }, [isStandalone]);

  useEffect(() => {
    if (isStandalone) return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setDwellSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isStandalone]);

  const refreshSwStatus = useCallback(() => {
    if (!("serviceWorker" in navigator)) {
      setSwHint("Service Worker no disponible en este navegador.");
      return;
    }
    if (!secure) {
      setSwHint("Sin contexto seguro (HTTPS): Chrome no registra SW ni permite instalar.");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) {
        setSwHint(
          "SW no registrado. En el PC: npm run pwa:lan (build + HTTPS); en el móvil usa https://TU_IP:3840/"
        );
        return;
      }
      if (navigator.serviceWorker.controller) {
        setSwHint(
          "SW activo y controla la página. Espera ~30 s y toca la pantalla; luego mira la barra de Chrome o ⋮ → «Instalar aplicación»."
        );
      } else {
        setSwHint("SW registrado pero aún no controla la pestaña: pulsa Recargar una vez.");
      }
    });
  }, [secure]);

  useEffect(() => {
    refreshSwStatus();
    const id = setInterval(refreshSwStatus, 4000);
    return () => clearInterval(id);
  }, [refreshSwStatus]);

  if (isStandalone) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: colors.good }}>
        Estás usando la app instalada (modo standalone).
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
        <strong>PWA (instalar):</strong> en el PC corre{" "}
        <code style={{ color: colors.accent }}>npm run pwa:lan</code> (rebuild + HTTPS en tu IPv4).
        En el móvil, Chrome: <code style={{ color: colors.accent }}>https://TU_IP:3840/</code>{" "}
        (acepta el certificado). Sin HTTPS o sin build de producción, no hay instalación en Android.
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: space.lg,
          fontSize: 12,
          color: colors.muted,
          lineHeight: 1.5,
        }}
      >
        <li>
          Abre con <strong>Chrome Android</strong> (no WebView de Instagram/WhatsApp: elige «Abrir en
          Chrome»). En <strong>iOS/Safari</strong> usa <strong>Compartir → Añadir a pantalla de inicio</strong>.
        </li>
        <li>
          <strong>Chrome suele exigir ~30 segundos</strong> en la página y <strong>al menos un toque</strong>{" "}
          antes de mostrar «Instalar» (chip, barra o menú ⋮).
        </li>
        <li>
          Primera visita: tras cargar, <strong>recarga una vez</strong> para que el service worker controle
          la página.
        </li>
        <li>
          Si no ves banner: menú <strong>⋮</strong> → «Instalar aplicación» o «Añadir a pantalla de inicio».
        </li>
      </ul>
      <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
        En esta visita: {dwellSec}s en página · toque: {tappedOnce ? "sí" : "pendiente"} · HTTPS:{" "}
        {secure ? "sí" : "no"} · {swHint}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: `${space.sm}px ${space.md}px`,
            borderRadius: radius.sm,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: colors.text,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}
