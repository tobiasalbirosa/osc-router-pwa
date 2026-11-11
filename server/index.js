"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const https = require("https");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
const selfsigned = require("selfsigned");
const osc = require("osc");

const PORT = Number(process.env.PORT) || 3840;
const OSC_REMOTE_HOST = process.env.OSC_REMOTE_HOST || "127.0.0.1";
const OSC_REMOTE_PORT = Number(process.env.OSC_REMOTE_PORT) || 8000;
const USE_HTTPS =
  process.argv.includes("--https") || process.env.USE_HTTPS === "1";

/** Log de cada muestra OSC en consola (WS_LOG_DATA=0 para desactivar). */
const WS_LOG_DATA = process.env.WS_LOG_DATA !== "0";
/**
 * Mínimo ms entre líneas de log por (IP, ruta OSC). 0 = registrar todas las muestras.
 * Ej.: WS_LOG_INTERVAL_MS=150
 */
const WS_LOG_INTERVAL_MS = Number(process.env.WS_LOG_INTERVAL_MS ?? 150);

const wsLogLineTimes = new Map();

/** Último destino OSC anunciado por un cliente sensor (para visualizadores). */
let lastOscTarget = { host: OSC_REMOTE_HOST, port: OSC_REMOTE_PORT };
/** Últimos valores normalizados por ruta OSC (p. ej. /msg1). */
const lastSensorValues = Object.create(null);

function getHttpsCertOptions() {
  const lan = getLanIPv4();
  const altNames = [
    { type: 2, value: "localhost" },
    { type: 2, value: "osc-router-lan" },
    { type: 7, ip: "127.0.0.1" },
  ];
  if (lan && lan !== "0.0.0.0") altNames.push({ type: 7, ip: lan });

  const pems = selfsigned.generate(
    [{ name: "commonName", value: "osc-router-lan" }],
    {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
      extensions: [
        { name: "basicConstraints", cA: false },
        {
          name: "keyUsage",
          digitalSignature: true,
          keyEncipherment: true,
        },
        { name: "extKeyUsage", serverAuth: true },
        { name: "subjectAltName", altNames },
      ],
    }
  );
  return { key: pems.private, cert: pems.cert };
}

function getLanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "0.0.0.0";
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }
  let ip = req.socket?.remoteAddress || "unknown";
  if (typeof ip === "string" && ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip;
}

function ts() {
  return new Date().toISOString();
}

function shouldLogSensorLine(clientIp, address) {
  if (WS_LOG_INTERVAL_MS <= 0) return true;
  const key = `${clientIp}|${address}`;
  const now = Date.now();
  const prev = wsLogLineTimes.get(key) || 0;
  if (now - prev < WS_LOG_INTERVAL_MS) return false;
  wsLogLineTimes.set(key, now);
  return true;
}

const app = express();
app.set("etag", false);
const publicDir = path.join(__dirname, "..", "public");
const distDir = path.join(__dirname, "..", "dist");

app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=*, gyroscope=*, magnetometer=*"
  );
  next();
});

app.use((req, res, next) => {
  const p = req.path;
  if (
    p === "/" ||
    p === "/index.html" ||
    p === "/sw.js" ||
    p === "/manifest.json"
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  next();
});

app.get("/manifest.json", (req, res) => {
  const dir = fs.existsSync(distDir) ? distDir : publicDir;
  res.type("application/manifest+json");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(dir, "manifest.json"), (err) => {
    if (err) res.status(404).end();
  });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
} else {
  console.warn(
    "[osc-router] No existe dist/. Ejecuta npm run build:web para la UI React."
  );
}
app.use(express.static(publicDir));

let server;
if (USE_HTTPS) {
  server = https.createServer(getHttpsCertOptions(), app);
} else {
  server = http.createServer(app);
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nEl puerto ${PORT} ya está en uso (EADDRINUSE).\n\n` +
        "1) Ver el PID que escucha:\n" +
        `   netstat -ano | findstr ":${PORT}"\n\n` +
        "2) Cerrar ese proceso (sintaxis exacta en Windows):\n" +
        "   taskkill /PID <número_de_la_última_columna> /F\n\n" +
        "3) O usar otro puerto (CMD):\n" +
        "   set PORT=3850 && npm start\n" +
        "   PowerShell:  $env:PORT=3850; npm start\n"
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  const lan = getLanIPv4();
  const scheme = USE_HTTPS ? "https" : "http";
  console.log(
    `${scheme.toUpperCase()}  ${scheme}://127.0.0.1:${PORT}/  ${scheme}://localhost:${PORT}/`
  );
  if (lan && lan !== "0.0.0.0") {
    console.log(`[PWA / teléfono]  ${scheme}://${lan}:${PORT}/`);
    console.log(`Visualizador: ${scheme}://${lan}:${PORT}/viewer.html`);
  } else {
    console.log(`Visualizador: ${scheme}://127.0.0.1:${PORT}/viewer.html`);
  }
  if (USE_HTTPS) {
    console.log(
      "Certificado autofirmado (incluye tu IPv4 LAN en SAN): acepta la advertencia en el móvil; luego recarga para el service worker."
    );
  } else {
    console.log(
      "Sin --https: el micrófono puede estar bloqueado en Android Chrome (requiere HTTPS). Usa: npm run start:https"
    );
  }
  console.log(
    `OSC destino por defecto: ${OSC_REMOTE_HOST}:${OSC_REMOTE_PORT} (cambiable desde la app)`
  );
  console.log("UI React: tras cambiar el frontend ejecuta npm run build:web");
  console.log(
    `Log WS: muestras con IP de origen (WS_LOG_DATA=0 desactiva). Intervalo ms por ruta: ${
      WS_LOG_INTERVAL_MS > 0 ? WS_LOG_INTERVAL_MS : "0 = cada muestra"
    }`
  );
});

const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 0,
  remoteAddress: OSC_REMOTE_HOST,
  remotePort: OSC_REMOTE_PORT,
});

udpPort.open();

udpPort.on("error", (err) => {
  console.error("[OSC UDP]", err.message);
});

const wss = new WebSocketServer({ server, path: "/ws" });

function safeSend(socket, obj) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

/** Retransmite a todos los clientes excepto el que originó el mensaje. */
function broadcast(fromSocket, obj) {
  const raw = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client === fromSocket || client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(raw);
    } catch {
      /* ignore */
    }
  }
}

function sendSnapshot(socket) {
  safeSend(socket, {
    type: "snapshot",
    target: { ...lastOscTarget },
    sensors: { ...lastSensorValues },
  });
}

wss.on("connection", (socket, req) => {
  const clientIp = getClientIp(req);
  console.log(`[${ts()}] WS connect  ip=${clientIp}`);

  let remoteHost = OSC_REMOTE_HOST;
  let remotePort = OSC_REMOTE_PORT;

  sendSnapshot(socket);

  socket.on("close", () => {
    console.log(`[${ts()}] WS disconnect  ip=${clientIp}`);
  });

  /******
   * Cada cliente sensor mantiene su propio destino UDP al enviar OSC.
   * lastOscTarget solo refleja lo último anunciado (visualización).
   ******/
  const setRemote = (host, port) => {
    if (typeof host === "string" && host.length > 0) remoteHost = host.trim();
    const p = Number(port);
    if (Number.isFinite(p) && p > 0 && p < 65536) remotePort = p | 0;
    lastOscTarget = { host: remoteHost, port: remotePort };
  };

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg?.type === "hello") {
      /* Reservado: role viewer/sensor. El snapshot ya se envió al conectar. */
      return;
    }

    if (msg?.type === "config" && msg.target) {
      setRemote(msg.target.host, msg.target.port);
      console.log(
        `[${ts()}] WS config  ip=${clientIp}  osc_target=${remoteHost}:${remotePort}`
      );
      broadcast(socket, {
        type: "config",
        target: { host: remoteHost, port: remotePort },
      });
      return;
    }

    if (msg?.type !== "osc") return;

    const address = typeof msg.address === "string" ? msg.address : "";
    if (!address.startsWith("/")) return;

    const v = Number(msg.value);
    if (!Number.isFinite(v)) return;

    const clamped = Math.min(1, Math.max(0, v));
    lastSensorValues[address] = clamped;

    udpPort.send(
      {
        address,
        args: [{ type: "f", value: clamped }],
      },
      remoteHost,
      remotePort
    );

    if (WS_LOG_DATA && shouldLogSensorLine(clientIp, address)) {
      console.log(
        `[${ts()}] WS→OSC  ip=${clientIp}  ${address}=${clamped}  →udp ${remoteHost}:${remotePort}`
      );
    }

    broadcast(socket, {
      type: "sensor",
      address,
      value: clamped,
      t: Date.now(),
    });
  });
});

process.on("SIGINT", () => {
  udpPort.close();
  server.close();
  process.exit(0);
});
