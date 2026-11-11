# OSC Router

Envía **acelerómetro / giroscopio** del teléfono como mensajes **OSC** (float 0–1) a un destino **UDP** (`IP/host` + puerto).

Rutas: `/aX` `/aY` `/aZ` y `/gX` `/gY` `/gZ`.

---

## Elige el camino

| Objetivo | Qué usar |
| --- | --- |
| **Teléfono solo** → OSC/UDP (sin PC como puente) | **Cliente Android** en `native/OscUdpClient` |
| UI en el navegador + visualizador en el PC | **PWA + bridge Node** (el teléfono **no** puede abrir UDP solo) |

Chrome/Android **no** exponen sockets UDP a una PWA. Por eso la web siempre necesita el servidor Node en otro dispositivo (o en el mismo PC) para reenviar OSC.

```text
PWA:     Teléfono ──WebSocket──► PC (Node) ──OSC/UDP──► Max / SC / …
APK:     Teléfono ──OSC/UDP──────────────────────────► Max / SC / …
```

---

## Requisitos

- **Node.js** 18+ (recomendado 20+) para bridge / listener
- Misma Wi‑Fi (LAN IPv4) entre emisor y receptor OSC
- Cliente nativo: Android SDK / dispositivo o emulador

---

## 1. Cliente Android (recomendado si no quieres otro dispositivo de puente)

### Descargar e instalar (cualquier Android)

APK firmada (debug keystore de desarrollo) en el release de GitHub:

**https://github.com/tobiasalbirosa/osc-router-pwa/releases/latest**

1. Abre el link en el teléfono (Chrome).
2. Descarga `OscUdpClient.apk`.
3. Si Android bloquea: Ajustes → permitir instalar desde ese origen.
4. En la app → **Destino**: IPv4 LAN del PC receptor y el puerto OSC (p. ej. `8000`).

Carpeta del código: [`native/OscUdpClient`](native/OscUdpClient). Detalle: [`native/OscUdpClient/README.md`](native/OscUdpClient/README.md).

### Compilar desde el repo

```bash
cd native/OscUdpClient
npm install
npm run build:apk:lan    # genera dist/OscUdpClient-lan-release.apk
# o desarrollo:
npm run android          # o npm run start:lan + dispositivo con dev client
```

En la app:

- **Sensores**: switch **Segundo plano**, intervalo de envío, acelerómetro y/o giroscopio.
- **Destino**: IP/host y puerto UDP del software que escucha OSC (p. ej. la IP de tu PC donde corre Max).

El APK **no** arranca un servidor: solo captura sensores y envía datagramas OSC.

Para comprobar recepción en el PC (desde la raíz del repo):

```bash
npm install
npm run udp:listen
```

---

## 2. PWA + bridge WebSocket → OSC (necesita el PC)

El teléfono abre la PWA; el **PC** corre el bridge y hace el envío UDP.

```bash
npm install
npm run pwa:lan
```

Consola (ejemplo):

```text
[PWA / teléfono]  https://192.168.x.x:3840/
```

Abre esa URL en **Chrome** del móvil, acepta el certificado autofirmado y recarga si hace falta.

| Comando | Qué hace |
| --- | --- |
| `npm run build:web` | Genera `dist/` |
| `npm run start:https` | Sirve `dist/` + WS con HTTPS (sin rebuild) |
| `npm start` | HTTP (sensores/PWA suelen fallar en el móvil) |
| `npm run dev:web` | Vite (5173); el bridge WS sigue en Node |

Puerto por defecto del bridge: **3840**.

En la UI web, **Destino** es el host/puerto UDP que usará el **bridge en el PC**, no un envío UDP desde el navegador.

---

## 3. Escuchar OSC UDP en el PC (opcional)

```bash
npm run udp:listen
```

Puerto por defecto **8000**. Rango:

```bash
npm run udp:listen:range
```

Variables: `OSC_LISTEN_PORT`, `OSC_LISTEN_FROM` / `OSC_LISTEN_TO`, `OSC_VIEW_PORT` (vista HTTP, por defecto `9390`).

---

## Estructura

```text
OSCRouter/
  server/                 # Bridge HTTP(S)+WS→OSC; listener UDP
  frontend/               # UI React (PWA; requiere bridge)
  public/                 # Manifest, SW, estáticos
  scripts/                # Icons, pwa:lan
  native/OscUdpClient/    # Cliente Android (UDP directo)
```

---

## Notas

- **PWA sola ≠ envíos OSC UDP**: hace falta el bridge Node (u otra app nativa).
- Sensores en navegador: contexto **HTTPS** (certificado autofirmado de `pwa:lan` / `start:https`).
- Firewall de Windows: permite Node / el receptor OSC en la red privada.
