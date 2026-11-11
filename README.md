# OSC Router

Puente local para enviar **acelerómetro / giroscopio** como mensajes **OSC** (float 0–1) hacia un destino **UDP** (`IP/host` + puerto).

Incluye:

1. **Servidor Node + PWA** (navegador / móvil por HTTPS en la LAN).
2. **Cliente Android** (React Native / Expo) que envía OSC por UDP en segundo plano.

Rutas OSC: `/aX` `/aY` `/aZ` (acelerómetro) y `/gX` `/gY` `/gZ` (giroscopio).

---

## Requisitos

- **Node.js** 18+ (recomendado 20+)
- Misma Wi‑Fi entre PC y teléfono (para pruebas por IPv4 LAN)
- Opcional (app nativa): Android SDK / dispositivo o emulador

---

## 1. PWA + bridge WebSocket → OSC (local)

En la raíz del repo:

```bash
npm install
```

### Arranque rápido (HTTPS + IPv4 LAN)

Compila la UI y levanta el servidor HTTPS en `0.0.0.0` (necesario para sensores / PWA en el móvil):

```bash
npm run pwa:lan
```

En la consola verás algo como:

```text
[PWA / teléfono]  https://192.168.x.x:3840/
```

Abre esa URL en **Chrome** del móvil, acepta el certificado autofirmado y, si hace falta, recarga una vez.

### Alternativas

| Comando | Qué hace |
| --- | --- |
| `npm run build:web` | Solo genera `dist/` |
| `npm run start:https` | Sirve `dist/` + WebSocket con HTTPS (sin rebuild) |
| `npm start` | HTTP (sin HTTPS: sensores/PWA suelen fallar en el móvil) |
| `npm run dev:web` | Vite en desarrollo (puerto 5173; el bridge WS sigue en el servidor Node) |

Puerto por defecto: **3840**. Otro puerto:

```bash
# PowerShell
$env:PORT=3850; npm run start:https
```

En la app web:

- **Sensores**: intervalo de envío y activar acelerómetro / giroscopio.
- **Destino**: IP/host y puerto UDP del software que escucha OSC (Max, SuperCollider, etc.).

El teléfono habla con el bridge por **WebSocket**; el bridge reenvía **OSC/UDP** al destino configurado.

---

## 2. Escuchar OSC UDP en el PC (opcional)

Para ver lo que llega por UDP (útil con el cliente Android o con cualquier fuente OSC):

```bash
npm run udp:listen
```

Por defecto escucha el puerto **8000**. Rango de puertos:

```bash
npm run udp:listen:range
```

Variables útiles: `OSC_LISTEN_PORT`, `OSC_LISTEN_FROM` / `OSC_LISTEN_TO`, `OSC_VIEW_PORT` (vista HTTP, por defecto `9390`).

---

## 3. Cliente Android (solo OSC/UDP, sin servidor)

Carpeta: `native/OscUdpClient`.

```bash
cd native/OscUdpClient
npm install
```

Arranque típico (dev client en LAN, Metro en **8081**):

```bash
npm run start:lan
```

O instalar / ejecutar en dispositivo:

```bash
npm run android
```

En la app:

- **Sensores**: switch de segundo plano, intervalo, acelerómetro y/o giroscopio.
- **Destino**: IP/host y puerto UDP del receptor (p. ej. la IP de tu PC).

Para forzar la IPv4 del packager en un teléfono físico, edita `native/OscUdpClient/.env.development` y descomenta `REACT_NATIVE_PACKAGER_HOSTNAME` con la IP de tu PC.

APK / build: ver scripts en `native/OscUdpClient/package.json` (`build:apk:lan`, `rebuild:android`, etc.).

---

## Estructura

```text
OSCRouter/
  server/           # Bridge HTTP(S) + WebSocket → OSC/UDP; listener UDP opcional
  frontend/         # UI React (PWA)
  public/           # Manifest, service worker, estáticos
  scripts/          # Icons, pwa:lan
  native/OscUdpClient/  # Cliente Android (Expo / RN)
```

---

## Notas

- En el móvil hace falta **HTTPS** (o el cliente nativo) para sensores de movimiento fiables.
- El certificado de `start:https` / `pwa:lan` es **autofirmado**: hay que aceptar la advertencia del navegador.
- Firewall de Windows: permite Node en la red privada si el teléfono no conecta.
