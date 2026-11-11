/**
 * Genera APK release (bundle JS embebido) y copia a dist/ para instalar por USB/LAN.
 * Requisitos: Android SDK, JAVA_HOME. Desde la carpeta OscUdpClient: npm run build:apk:lan
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');
const gradlew =
  process.platform === 'win32'
    ? path.join(androidDir, 'gradlew.bat')
    : path.join(androidDir, 'gradlew');

if (!fs.existsSync(gradlew)) {
  console.error('No existe android/gradlew. Ejecuta: npx expo prebuild');
  process.exit(1);
}

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const r = spawnSync(gradlew, ['assembleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV },
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

const src = path.join(
  root,
  'android/app/build/outputs/apk/release/app-release.apk',
);
const distDir = path.join(root, 'dist');
const destFixed = path.join(distDir, 'OscUdpClient-lan-release.apk');

if (!fs.existsSync(src)) {
  console.error('No se encontró el APK en:', src);
  console.error(
    'Si usas splits por ABI, revisa android/app/build/outputs/apk/release/',
  );
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(src, destFixed);
console.log('\nAPK lista para LAN (instalar en el móvil, mismo Wi‑Fi que el PC):');
console.log(' ', destFixed);
console.log(
  '\nEn la app → Destino: IP LAN del PC (la que muestra udp-listener) y el puerto UDP (ej. 8000 o 9200).',
);
