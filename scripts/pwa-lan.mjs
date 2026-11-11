/**
 * Build producción (iconos + Vite) y arranca el servidor HTTPS en 0.0.0.0
 * para probar la PWA por IPv4 en la red local.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3840;

function lanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

console.log("[pwa:lan] Compilando frontend (npm run build:web)…\n");
let r = spawnSync(npm, ["run", "build:web"], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
  shell: process.platform === "win32",
});
if (r.error) {
  console.error(r.error);
  process.exit(1);
}
if (r.status !== 0) process.exit(r.status ?? 1);

const ip = lanIPv4();
console.log("\n[pwa:lan] Iniciando servidor HTTPS…\n");
if (ip) {
  console.log(
    `[pwa:lan] En el móvil (Chrome): https://${ip}:${PORT}/  — acepta el certificado y recarga una vez.\n`
  );
}

r = spawnSync(process.execPath, ["server/index.js", "--https"], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
process.exit(r.status ?? 0);
