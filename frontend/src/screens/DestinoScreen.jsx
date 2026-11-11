import { useState, useEffect } from "react";
import { ScreenContainer } from "../components/layout/ScreenContainer";
import { colors, radius, space } from "../theme/tokens";
import { OscBridge } from "../lib/oscBridge";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  fontSize: 16,
};

export function DestinoScreen({ target, setTarget, bridge }) {
  const [localHost, setLocalHost] = useState(target.host);
  const [localPort, setLocalPort] = useState(String(target.port));

  useEffect(() => {
    setLocalHost(target.host);
    setLocalPort(String(target.port));
  }, [target.host, target.port]);

  useEffect(() => {
    const host = localHost.trim() || "127.0.0.1";
    const port = Number(localPort);
    const p = Number.isFinite(port) && port > 0 && port < 65536 ? port : 8000;
    const t = window.setTimeout(() => {
      setTarget({ host, port: p });
      if (bridge instanceof OscBridge) {
        bridge.sendConfig({ host, port: p });
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [localHost, localPort, setTarget, bridge]);

  return (
    <ScreenContainer>
      <p
        style={{
          margin: `0 0 ${space.lg}px`,
          fontSize: 12,
          color: colors.muted,
          lineHeight: 1.45,
        }}
      >
        Destino UDP del <strong style={{ color: colors.text }}>bridge en el PC</strong> (esta PWA
        no envía OSC por UDP sola). Para teléfono → UDP directo usa la app Android del repo.
      </p>
      <div style={{ marginBottom: space.md }}>
        <label
          style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: space.xs }}
        >
          IP/HOST
        </label>
        <input
          value={localHost}
          onChange={(e) => setLocalHost(e.target.value)}
          placeholder="127.0.0.1"
          autoComplete="off"
          style={inputStyle}
        />
      </div>
      <div>
        <label
          style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: space.xs }}
        >
          Puerto
        </label>
        <input
          type="number"
          min={1}
          max={65535}
          value={localPort}
          onChange={(e) => setLocalPort(e.target.value)}
          style={inputStyle}
        />
      </div>
    </ScreenContainer>
  );
}
