"use strict";

/**
 * Escucha UDP OSC en 0.0.0.0 (IPv4). Un puerto o un rango, para no chocar con Metro (8081) ni el bridge HTTP (PORT).
 *
 * Un puerto (por defecto 8000):
 *   node server/udp-listener.js
 *   OSC_LISTEN_PORT=8100 node server/udp-listener.js
 *
 * Rango inclusivo (ej. 9200–9209, solo UDP / sin HTTP):
 *   node server/udp-listener.js --from 9200 --to 9209
 *   OSC_LISTEN_FROM=9200 OSC_LISTEN_TO=9209 node server/udp-listener.js
 *
 * Lista separada por comas:
 *   OSC_LISTEN_PORTS=9100,9101,9102 node server/udp-listener.js
 *
 * Vista 3D (HTTP + WebSocket, misma máquina que el listener):
 *   Por defecto escucha en OSC_VIEW_PORT=9390. Abre http://<LAN>:9390/view
 *   Desactivar: OSC_VIEW_PORT=0 node server/udp-listener.js
 */

const os = require("os");
const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
const osc = require("osc");

const LOG_INTERVAL_MS = Number(process.env.OSC_UDP_LOG_INTERVAL_MS ?? 100);

/** 0 = sin servidor HTTP; por defecto 9390 (no suele chocar con 9200–9209 UDP). */
const OSC_VIEW_PORT = Number(process.env.OSC_VIEW_PORT ?? 9390);

const ADDR_TO_FIELD = Object.freeze({
  "/aX": "aX",
  "/aY": "aY",
  "/aZ": "aZ",
  "/gX": "gX",
  "/gY": "gY",
  "/gZ": "gZ",
});

/** @type {Map<string, { id: string, aX: number, aY: number, aZ: number, gX: number, gY: number, gZ: number }>} */
const sensorByRemote = new Map();

function firstFloatArg(msg) {
  const a = msg.args?.[0];
  if (a == null) return null;
  const v = typeof a === "object" && a !== null && "value" in a ? a.value : a;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function defaultSensorRecord(id) {
  return {
    id,
    aX: 0,
    aY: 0,
    aZ: 9.81,
    gX: 0,
    gY: 0,
    gZ: 0,
  };
}

function applySensorOsc(remoteKey, address, value) {
  const field = ADDR_TO_FIELD[address];
  if (!field) return false;
  let rec = sensorByRemote.get(remoteKey);
  if (!rec) {
    rec = defaultSensorRecord(remoteKey);
    sensorByRemote.set(remoteKey, rec);
  }
  rec[field] = value;
  return true;
}

function snapshotSources() {
  return [...sensorByRemote.values()];
}

/** @type {import("ws").WebSocketServer | null} */
let wssView = null;
let broadcastTimer = null;

function broadcastSensorView() {
  if (!wssView) return;
  const payload = JSON.stringify({
    type: "sensor3d",
    sources: snapshotSources(),
    t: Date.now(),
  });
  for (const client of wssView.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(payload);
    } catch {
      /* ignore */
    }
  }
}

function scheduleSensorBroadcast() {
  if (!wssView) return;
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    broadcastSensorView();
  }, 32);
}

function startSensorViewServer() {
  if (!OSC_VIEW_PORT) return;

  const publicDir = path.join(__dirname, "..", "public");
  const app = express();

  app.get("/view", (req, res) => {
    const p = path.join(publicDir, "sensor-3d.html");
    res.sendFile(p, (err) => {
      if (err && !res.headersSent) res.status(404).send("sensor-3d.html no encontrado");
    });
  });

  app.use(express.static(publicDir));

  const server = http.createServer(app);
  wssView = new WebSocketServer({ server, path: "/ws-sensor3d" });

  wssView.on("connection", (socket) => {
    try {
      socket.send(
        JSON.stringify({
          type: "snapshot",
          sources: snapshotSources(),
          t: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[${ts()}] OSC_VIEW_PORT=${OSC_VIEW_PORT} en uso. Cierra el proceso o usa otro (OSC_VIEW_PORT=9391).`
      );
    } else {
      console.error("[vista 3D]", err.message || err);
    }
  });

  server.listen(OSC_VIEW_PORT, "0.0.0.0", () => {
    const lan = getLanIPv4();
    console.log(
      `[${ts()}] Vista 3D sensores  http://127.0.0.1:${OSC_VIEW_PORT}/view`
    );
    if (lan) {
      console.log(`[${ts()}] Vista 3D (LAN)      http://${lan}:${OSC_VIEW_PORT}/view`);
    }
  });

  return server;
}

function parseArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : null;
}

function collectPorts() {
  const fromEnv = Number(process.env.OSC_LISTEN_FROM);
  const toEnv = Number(process.env.OSC_LISTEN_TO);
  const listEnv = process.env.OSC_LISTEN_PORTS;

  const fromArg = parseArg("--from");
  const toArg = parseArg("--to");

  if (listEnv && String(listEnv).trim()) {
    const ports = String(listEnv)
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 65535);
    if (ports.length) return [...new Set(ports)].sort((a, b) => a - b);
  }

  const lo = fromArg ?? (Number.isFinite(fromEnv) ? fromEnv : null);
  const hi = toArg ?? (Number.isFinite(toEnv) ? toEnv : null);
  if (lo != null && hi != null) {
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    const out = [];
    for (let p = a; p <= b; p++) {
      if (p >= 1 && p <= 65535) out.push(p);
    }
    return out;
  }

  const single =
    Number(process.env.OSC_LISTEN_PORT || process.env.OSC_REMOTE_PORT) || 8000;
  return [single];
}

const PORTS = collectPorts();

function getLanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

function ts() {
  return new Date().toISOString();
}

function formatArgs(args) {
  if (!args || !args.length) return "";
  return args
    .map((a) => {
      if (a == null) return "?";
      if (typeof a === "object" && "value" in a) {
        const t = a.type || "?";
        const v = a.value;
        if (typeof v === "number") return `${t}:${v}`;
        return `${t}:${String(v)}`;
      }
      return String(a);
    })
    .join(" ");
}

const lastLogAt = new Map();
const seenRemotes = new Set();

function shouldLog(remoteKey, address) {
  if (LOG_INTERVAL_MS <= 0) return true;
  const key = `${remoteKey}|${address}`;
  const now = Date.now();
  const prev = lastLogAt.get(key) || 0;
  if (now - prev < LOG_INTERVAL_MS) return false;
  lastLogAt.set(key, now);
  return true;
}

/** @type {import("osc").UDPPort[]} */
const sockets = [];

function attachHandlers(udpIn, port) {
  udpIn.on("error", (err) => {
    const msg = err && (err.code || err.message) ? String(err.message || err) : String(err);
    console.error(`[${ts()}] [UDP :${port}] error`, msg);
    if (err && err.code === "EADDRINUSE") {
      const win = process.platform === "win32";
      console.error(
        `\nEl puerto UDP ${port} ya está en uso.\n\n` +
          "Opciones:\n" +
          `  - Elegir otro puerto o rango (--from / --to).\n` +
          (win
            ? `  - Ver proceso: netstat -ano | findstr ":${port}"\n`
            : `  - Ver proceso: lsof -i UDP:${port}\n`)
      );
    }
  });

  udpIn.on("message", (msg, _timeTag, rinfo) => {
    const host = rinfo?.address || "?";
    const sport = rinfo?.port ?? "?";
    const remoteKey = `${host}:${sport}`;

    if (!seenRemotes.has(remoteKey)) {
      seenRemotes.add(remoteKey);
      console.log(
        `[${ts()}] UDP origen (nuevo)  ${remoteKey}  total_origenes=${seenRemotes.size}`
      );
    }

    const addr = msg.address || "(sin ruta)";
    const argsStr = formatArgs(msg.args);

    const fv = firstFloatArg(msg);
    if (fv != null && applySensorOsc(remoteKey, addr, fv)) {
      scheduleSensorBroadcast();
    }

    if (shouldLog(remoteKey, `${port}|${addr}`)) {
      console.log(
        `[${ts()}] OSC  :${port}  ${remoteKey}  ${addr}  ${argsStr}`.trim()
      );
    }
  });

  udpIn.on("bundle", (bundle, _timeTag, rinfo) => {
    const host = rinfo?.address || "?";
    const sport = rinfo?.port ?? "?";
    const remoteKey = `${host}:${sport}`;
    const n = bundle?.packets?.length ?? 0;
    console.log(`[${ts()}] UDP bundle  :${port}  ${remoteKey}  mensajes=${n}`);
  });
}

/** @type {import("http").Server | undefined} */
let viewHttpServer;

for (const port of PORTS) {
  const udpIn = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: port,
  });
  attachHandlers(udpIn, port);
  udpIn.open();
  sockets.push(udpIn);
}

viewHttpServer = startSensorViewServer();

let readyCount = 0;
for (const udpIn of sockets) {
  udpIn.on("ready", () => {
    readyCount++;
    if (readyCount < sockets.length) return;

    const lan = getLanIPv4();
    console.log(
      `[${ts()}] Escuchando OSC/UDP en 0.0.0.0 puertos: ${PORTS.join(", ")} (${PORTS.length} socket(s))`
    );
    if (lan) {
      console.log(
        `[${ts()}] En el dispositivo (misma red / emulador→PC): Host ${lan} o 127.0.0.1 / 10.0.2.2 — Puerto uno de: ${PORTS[0]}${PORTS.length > 1 ? " … " + PORTS[PORTS.length - 1] : ""}`
      );
    } else {
      console.log(
        `[${ts()}] No se detectó IPv4 LAN; usa ipconfig y elige la IP de la Wi‑Fi.`
      );
    }
    console.log(
      `[${ts()}] Log por ruta/puerto: ${LOG_INTERVAL_MS > 0 ? LOG_INTERVAL_MS + " ms" : "cada mensaje (OSC_UDP_LOG_INTERVAL_MS=0)"}`
    );
  });
}

process.on("SIGINT", () => {
  for (const s of sockets) {
    try {
      s.close();
    } catch (_) {}
  }
  if (viewHttpServer) {
    try {
      viewHttpServer.close();
    } catch (_) {}
  }
  process.exit(0);
});
