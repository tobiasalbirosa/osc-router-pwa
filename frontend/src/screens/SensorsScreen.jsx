import { useEffect, useReducer, useState, useCallback } from "react";
import { ScreenContainer } from "../components/layout/ScreenContainer";
import { colors, radius, space } from "../theme/tokens";
import { OscBridge } from "../lib/oscBridge";
import {
  SENSOR_DEFS,
  motionState,
  toggleSensor,
  runOscTick,
  setOscBundleIntervalMs,
  normalizeSymmetric,
  normalizeMagnitude01,
  ACCEL_MAX_MS2,
  GYRO_MAX_DPS,
} from "../motion/motionPipeline";

const LS_INTERVAL_QTY = "oscIntervalQty";
const LS_INTERVAL_UNIT = "oscIntervalUnit";

function loadIntervalPrefs() {
  try {
    const q = parseFloat(localStorage.getItem(LS_INTERVAL_QTY) || "1");
    const u = localStorage.getItem(LS_INTERVAL_UNIT) === "s" ? "s" : "ds";
    return {
      qty: Number.isFinite(q) && q > 0 ? q : 1,
      unit: u,
    };
  } catch {
    return { qty: 1, unit: "ds" };
  }
}

function toIntervalMs(qty, unit) {
  const raw = unit === "s" ? qty * 1000 : qty * 100;
  return Math.max(10, Math.min(60_000, raw));
}

const card = {
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: space.lg,
  marginBottom: space.md,
};

const inputStyle = {
  width: 72,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  fontSize: 15,
  boxSizing: "border-box",
};

const selectStyle = {
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${colors.border}`,
  background: colors.panel,
  color: colors.text,
  fontSize: 14,
};

export function SensorsScreen({ bridge }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const [wakeText, setWakeText] = useState("");
  const [wakeLock, setWakeLock] = useState(null);

  const [intPrefs, setIntPrefs] = useState(loadIntervalPrefs);

  useEffect(() => {
    setOscBundleIntervalMs(toIntervalMs(intPrefs.qty, intPrefs.unit));
    try {
      localStorage.setItem(LS_INTERVAL_QTY, String(intPrefs.qty));
      localStorage.setItem(LS_INTERVAL_UNIT, intPrefs.unit);
    } catch {
      /* */
    }
  }, [intPrefs]);

  useEffect(() => {
    if (!(bridge instanceof OscBridge)) return;
    let id;
    const loop = () => {
      runOscTick(bridge);
      bump();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [bridge]);

  const onToggle = useCallback(
    async (def, checked) => {
      try {
        await toggleSensor(def, checked);
      } catch (e) {
        window.alert(e?.message || "No se pudo acceder al movimiento.");
      }
      bump();
    },
    [bump]
  );

  const toggleWake = async () => {
    if (!("wakeLock" in navigator)) {
      setWakeText("Wake Lock no disponible.");
      return;
    }
    try {
      if (wakeLock) {
        await wakeLock.release();
        setWakeLock(null);
        setWakeText("");
        return;
      }
      const wl = await navigator.wakeLock.request("screen");
      setWakeLock(wl);
      setWakeText("Activo");
      wl.addEventListener("release", () => setWakeText(""));
    } catch (e) {
      setWakeText(e?.message || "error");
    }
  };

  const setQty = (v) => {
    const n = parseFloat(String(v));
    if (!Number.isFinite(n) || n <= 0) return;
    setIntPrefs((p) => ({ ...p, qty: n }));
  };

  const setUnit = (u) => {
    if (u !== "ds" && u !== "s") return;
    setIntPrefs((p) => ({ ...p, unit: u }));
  };

  return (
    <ScreenContainer title="Sensores OSC">
      <p
        style={{
          margin: `0 0 ${space.md}px`,
          fontSize: 12,
          color: colors.muted,
          lineHeight: 1.45,
        }}
      >
        Los envíos OSC salen del <strong style={{ color: colors.text }}>servidor Node en el PC</strong>{" "}
        (esta PWA no habla UDP). Sin bridge, no hay OSC. App Android del repo = UDP directo.
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: space.md,
          marginBottom: space.lg,
        }}
      >
        <button
          type="button"
          onClick={() => void toggleWake()}
          style={{
            padding: `${space.sm}px ${space.lg}px`,
            borderRadius: radius.sm,
            border: `1px solid ${colors.accent}`,
            background: wakeLock ? colors.accent : "transparent",
            color: wakeLock ? "#061018" : colors.accent,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Mantener activo
        </button>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: space.sm,
          }}
        >
          <span style={{ fontSize: 14, color: colors.muted }}>Enviar cada</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={intPrefs.qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label="Cantidad de tiempo entre envíos OSC"
            style={inputStyle}
          />
          <select
            value={intPrefs.unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Unidad: décimas de segundo o segundos"
            style={selectStyle}
          >
            <option value="ds">Décimas de seg. (0,1 s)</option>
            <option value="s">Segundos</option>
          </select>
        </div>

        {wakeText ? (
          <span style={{ fontSize: 12, color: colors.muted }}>{wakeText}</span>
        ) : null}
      </div>

      <div style={card}>
        {SENSOR_DEFS.map((def) => {
          const st = motionState[def.id];
          const on = st.on;
          const maxAbs = def.id === "accel" ? ACCEL_MAX_MS2 : GYRO_MAX_DPS;
          return (
            <div
              key={def.id}
              style={{
                padding: space.md,
                marginBottom: space.sm,
                borderRadius: radius.sm,
                background: "rgba(0,0,0,0.2)",
                border: `1px solid ${colors.border}`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: space.sm,
                  alignItems: "center",
                  marginBottom: space.sm,
                }}
              >
                <div style={{ fontWeight: 600, color: colors.text }}>{def.name}</div>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: space.xs,
                    cursor: "pointer",
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => void onToggle(def, e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: colors.accent }}
                  />
                  Activo
                </label>
              </div>
              {def.axes.map((axis, i) => {
                const axisKey = ["x", "y", "z"][i];
                const rawVal = st[axisKey];
                const n =
                  on && Number.isFinite(rawVal)
                    ? def.id === "accel"
                      ? normalizeSymmetric(rawVal, maxAbs)
                      : normalizeMagnitude01(rawVal, maxAbs)
                    : null;
                const path = `${def.oscPrefix}${axis}`;
                return (
                  <div
                    key={axis}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      paddingTop: space.xs,
                      borderTop: i === 0 ? "none" : `1px solid ${colors.border}`,
                      marginTop: i === 0 ? 0 : space.xs,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 13,
                        color: colors.accent,
                      }}
                    >
                      {path}
                    </span>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 14,
                        color: colors.good,
                      }}
                    >
                      {n == null ? "—" : n.toFixed(6)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
