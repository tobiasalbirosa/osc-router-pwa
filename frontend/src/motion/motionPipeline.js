/**
 * Ejes en unidades físicas antes de normalizar a 0–1:
 * - Acelerómetro: m/s² (con gravedad en devicemotion / Accelerometer).
 * - Giroscopio: °/s (rotationRate y derivada de orientación; API Gyroscope en rad/s → °/s).
 */
export const motionState = {
  accel: { on: false, x: 0, y: 0, z: 0 },
  gyro: { on: false, x: 0, y: 0, z: 0 },
};

/** ± este valor (m/s²) se mapea al rango 0–1 (simétrico). */
export const ACCEL_MAX_MS2 = 20;

/** Magnitud |°/s| hasta 360 se mapea 0–1 (reposo → 0). */
export const GYRO_MAX_DPS = 360;

export const SENSOR_DEFS = [
  {
    id: "accel",
    name: "Acelerómetro",
    oscPrefix: "/a",
    axes: ["X", "Y", "Z"],
    hint: `m/s² → 0–1 con ±${ACCEL_MAX_MS2} m/s²`,
  },
  {
    id: "gyro",
    name: "Giroscopio",
    oscPrefix: "/g",
    axes: ["X", "Y", "Z"],
    hint: `|°/s| / ${GYRO_MAX_DPS} → 0–1`,
  },
];

export const OSC_AXIS_PATHS = {
  accel: ["/aX", "/aY", "/aZ"],
  gyro: ["/gX", "/gY", "/gZ"],
};

let accelHw = null;
let gyroHw = null;
let motionFallbackBound = false;
let orientFallbackBound = false;
let orientLast = null;
let orientLastT = 0;

const RAD_TO_DEG = 180 / Math.PI;

function bumpSampleTs() {
  window.__lastSensorSampleAt = performance.now();
}

/** v en [-maxAbs, +maxAbs] → [0, 1], reposo en ~0.5 si v≈0 (acelerómetro por eje). */
export function normalizeSymmetric(v, maxAbs) {
  if (!Number.isFinite(v) || !Number.isFinite(maxAbs) || maxAbs <= 0) return 0.5;
  return Math.min(1, Math.max(0, (v + maxAbs) / (2 * maxAbs)));
}

/** |v| en [0, maxAbs] → [0, 1] (giroscopio por eje, ej. 360 °/s → 1). */
export function normalizeMagnitude01(v, maxAbs) {
  if (!Number.isFinite(v) || !Number.isFinite(maxAbs) || maxAbs <= 0) return 0;
  return Math.min(1, Math.max(0, Math.abs(v) / maxAbs));
}

/** Delta con signo entre dos ángulos en grados (camino más corto). */
function signedAngleDeltaDeg(fromDeg, toDeg) {
  if (!Number.isFinite(fromDeg) || !Number.isFinite(toDeg)) return 0;
  let d = toDeg - fromDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function readAccelAxes(ev) {
  const aig = ev.accelerationIncludingGravity;
  const acc = ev.acceleration;
  const pick =
    aig && aig.x != null && aig.y != null && aig.z != null
      ? aig
      : acc && acc.x != null && acc.y != null && acc.z != null
        ? acc
        : null;
  if (!pick) return null;
  const x = Number(pick.x);
  const y = Number(pick.y);
  const z = Number(pick.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

/** rotationRate α,β,γ en °/s (DeviceMotion). */
function readRotationRateAxesDps(rr) {
  if (!rr) return null;
  const to = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const a = to(rr.alpha);
  const b = to(rr.beta);
  const g = to(rr.gamma);
  if (a === null && b === null && g === null) return null;
  return { x: a ?? 0, y: b ?? 0, z: g ?? 0 };
}

function rotationRateHasSignal(rr) {
  const ax = readRotationRateAxesDps(rr);
  if (!ax) return false;
  return Math.abs(ax.x) + Math.abs(ax.y) + Math.abs(ax.z) > 0.05;
}

function stopHardwareSensors() {
  if (accelHw) {
    try {
      accelHw.stop();
    } catch {
      /* */
    }
    accelHw = null;
  }
  if (gyroHw) {
    try {
      gyroHw.stop();
    } catch {
      /* */
    }
    gyroHw = null;
  }
}

function onDeviceMotionFallback(ev) {
  if (motionState.accel.on && !accelHw) {
    const ax = readAccelAxes(ev);
    if (ax) {
      motionState.accel.x = ax.x;
      motionState.accel.y = ax.y;
      motionState.accel.z = ax.z;
      bumpSampleTs();
    }
  }

  if (motionState.gyro.on && !gyroHw) {
    const g = readRotationRateAxesDps(ev.rotationRate);
    if (g) {
      motionState.gyro.x = g.x;
      motionState.gyro.y = g.y;
      motionState.gyro.z = g.z;
      bumpSampleTs();
    }
  }
}

function onDeviceOrientationFallback(ev) {
  if (!motionState.gyro.on || gyroHw) return;
  const t = performance.now();
  const rr = window.__lastMotionRR;
  if (rotationRateHasSignal(rr)) return;

  const alpha = ev.alpha;
  const beta = ev.beta;
  const gamma = ev.gamma;

  if (!orientLast || !orientLastT) {
    orientLast = { alpha, beta, gamma };
    orientLastT = t;
    return;
  }
  const dt = (t - orientLastT) / 1000;
  if (dt <= 0 || dt > 1) {
    orientLast = { alpha, beta, gamma };
    orientLastT = t;
    return;
  }

  const na = Number(alpha);
  const nb = Number(beta);
  const ng = Number(gamma);
  const oa = Number(orientLast.alpha);
  const ob = Number(orientLast.beta);
  const og = Number(orientLast.gamma);

  let wx = 0;
  let wy = 0;
  let wz = 0;

  if (Number.isFinite(na) && Number.isFinite(oa)) {
    wx = signedAngleDeltaDeg(oa, na) / dt;
  }
  if (Number.isFinite(nb) && Number.isFinite(ob)) {
    wy = (nb - ob) / dt;
  }
  if (Number.isFinite(ng) && Number.isFinite(og)) {
    wz = (ng - og) / dt;
  }

  if (wx !== 0 || wy !== 0 || wz !== 0) {
    motionState.gyro.x = wx;
    motionState.gyro.y = wy;
    motionState.gyro.z = wz;
    bumpSampleTs();
  }

  orientLast = { alpha, beta, gamma };
  orientLastT = t;
}

function bindMotionFallback() {
  if (motionFallbackBound) return;
  window.addEventListener(
    "devicemotion",
    (ev) => {
      window.__lastDeviceMotionAt = performance.now();
      if (ev.rotationRate) window.__lastMotionRR = ev.rotationRate;
      onDeviceMotionFallback(ev);
    },
    true
  );
  motionFallbackBound = true;
}

function bindOrientationFallback() {
  if (orientFallbackBound) return;
  window.addEventListener("deviceorientation", onDeviceOrientationFallback, {
    passive: true,
  });
  orientFallbackBound = true;
}

export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission) {
    const perm = await DeviceMotionEvent.requestPermission();
    if (perm !== "granted") throw new Error("Permiso movimiento denegado");
  }
  if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
    const perm = await DeviceOrientationEvent.requestPermission();
    if (perm !== "granted") throw new Error("Permiso orientación denegado");
  }
}

function startHardwareSensorsIfPossible() {
  if (!window.isSecureContext) return;

  if (typeof Accelerometer !== "undefined" && motionState.accel.on && !accelHw) {
    try {
      const s = new Accelerometer({ frequency: 60 });
      s.addEventListener("reading", () => {
        if (!motionState.accel.on) return;
        motionState.accel.x = s.x;
        motionState.accel.y = s.y;
        motionState.accel.z = s.z;
        bumpSampleTs();
      });
      s.addEventListener("error", () => {
        try {
          s.stop();
        } catch {
          /* */
        }
        if (accelHw === s) accelHw = null;
      });
      s.start();
      accelHw = s;
    } catch {
      accelHw = null;
    }
  }

  if (typeof Gyroscope !== "undefined" && motionState.gyro.on && !gyroHw) {
    try {
      const s = new Gyroscope({ frequency: 60 });
      s.addEventListener("reading", () => {
        if (!motionState.gyro.on) return;
        motionState.gyro.x = s.x * RAD_TO_DEG;
        motionState.gyro.y = s.y * RAD_TO_DEG;
        motionState.gyro.z = s.z * RAD_TO_DEG;
        bumpSampleTs();
      });
      s.addEventListener("error", () => {
        try {
          s.stop();
        } catch {
          /* */
        }
        if (gyroHw === s) gyroHw = null;
      });
      s.start();
      gyroHw = s;
    } catch {
      gyroHw = null;
    }
  }
}

export function ensureMotionPipelines() {
  if (!motionState.accel.on && !motionState.gyro.on) {
    stopHardwareSensors();
    orientLast = null;
    orientLastT = 0;
    window.__lastDeviceMotionAt = 0;
    window.__lastSensorSampleAt = 0;
    window.__motionPipelinesStartedAt = 0;
    return;
  }

  if (!window.__motionPipelinesStartedAt) {
    window.__motionPipelinesStartedAt = performance.now();
  }

  startHardwareSensorsIfPossible();

  if (motionState.accel.on || motionState.gyro.on) bindMotionFallback();
  if (motionState.gyro.on && !gyroHw) bindOrientationFallback();
}

export async function toggleSensor(def, on) {
  if (!on) {
    motionState[def.id].on = false;
    motionState[def.id].x = 0;
    motionState[def.id].y = 0;
    motionState[def.id].z = 0;
    stopHardwareSensors();
    orientLast = null;
    orientLastT = 0;
    if (motionState.accel.on || motionState.gyro.on) ensureMotionPipelines();
    return;
  }

  await requestMotionPermission();
  motionState[def.id].on = true;
  ensureMotionPipelines();
}

function initOscLast() {
  const o = {};
  for (const p of OSC_AXIS_PATHS.accel) o[p] = -1;
  for (const p of OSC_AXIS_PATHS.gyro) o[p] = -1;
  return o;
}

export const oscLastSent = initOscLast();

/** Intervalo mínimo entre ráfagas OSC (todos los ejes activos). */
let oscBundleIntervalMs = 100;
let lastOscBundleAt = 0;

export function setOscBundleIntervalMs(ms) {
  const n = Number(ms);
  oscBundleIntervalMs = Number.isFinite(n) ? Math.max(10, Math.min(60_000, n)) : 100;
}

function sendAxis(bridge, path, normalized) {
  bridge.sendFloat(path, normalized);
  oscLastSent[path] = normalized;
}

export function runOscTick(bridge, now = performance.now()) {
  if (!bridge) return;
  if (!motionState.accel.on && !motionState.gyro.on) return;
  if (now - lastOscBundleAt < oscBundleIntervalMs) return;
  lastOscBundleAt = now;

  if (motionState.accel.on) {
    sendAxis(bridge, "/aX", normalizeSymmetric(motionState.accel.x, ACCEL_MAX_MS2));
    sendAxis(bridge, "/aY", normalizeSymmetric(motionState.accel.y, ACCEL_MAX_MS2));
    sendAxis(bridge, "/aZ", normalizeSymmetric(motionState.accel.z, ACCEL_MAX_MS2));
  }

  if (motionState.gyro.on) {
    sendAxis(bridge, "/gX", normalizeMagnitude01(motionState.gyro.x, GYRO_MAX_DPS));
    sendAxis(bridge, "/gY", normalizeMagnitude01(motionState.gyro.y, GYRO_MAX_DPS));
    sendAxis(bridge, "/gZ", normalizeMagnitude01(motionState.gyro.z, GYRO_MAX_DPS));
  }
}
