# OSC UDP Sensor (cliente Android)

App **solo cliente**: lee acelerómetro y/o giroscopio y envía **OSC por UDP** al `IP/host` y puerto que configures. **No** incluye servidor HTTP ni bridge WebSocket.

Misma normalización que la PWA:

- `/aX` `/aY` `/aZ` — acelerómetro ±20 m/s² → 0–1
- `/gX` `/gY` `/gZ` — |°/s| / 360 → 0–1

## Requisitos

- Node 18+, Android SDK, dispositivo o emulador
- Receptor OSC en la LAN (p. ej. Max en el PC, o `npm run udp:listen` en la raíz del monorepo)

## Descargar APK (sin compilar)

Release GitHub (archivo `OscUdpClient.apk`):

**https://github.com/tobiasalbirosa/osc-router-pwa/releases/latest**

Instálala en el Android (permite orígenes desconocidos si lo pide). Destino = IP LAN del receptor OSC.

## Compilar e instalar desde código

```bash
cd native/OscUdpClient
npm install
npm run build:apk:lan   # → dist/OscUdpClient-lan-release.apk
```

Dispositivo / emulador:

```bash
npm run android
```

Dev client + Metro en LAN (puerto **8081**):

```bash
npm run start:lan
```

Forzar IPv4 del packager en teléfono físico: edita [`.env.development`](.env.development) y descomenta `REACT_NATIVE_PACKAGER_HOSTNAME` con la IP de tu PC.

APK release / scripts: ver `package.json` (`build:apk:lan`, `rebuild:android`, etc.).

## Pantallas

### Sensores

| Control | Comportamiento |
| --- | --- |
| **Segundo plano (mantener activo)** | Switch nativo. **On**: servicio en primer plano + notificación; captura/envío puede continuar con la app en segundo plano o pantalla apagada (según el fabricante). **Off**: solo envía con la app en primer plano. |
| **Enviar cada** | Intervalo entre ráfagas OSC (décimas de segundo `0,1 s` o segundos `s`). |
| **Acelerómetro / Giroscopio** | Activa cada sensor por separado. |

Permisos Android: notificaciones (Android 13+) para el servicio en segundo plano; acepta la notificación persistente cuando el switch está on.

### Destino

| Campo | Uso |
| --- | --- |
| **IP/HOST** | Destino UDP (p. ej. `192.168.1.10` del PC). No uses `127.0.0.1` desde el teléfono físico salvo emulador con red especial. |
| **Puerto** | Puerto OSC del receptor (p. ej. `8000`). |

Los cambios se guardan en AsyncStorage y se aplican al envío en curso.

## Probar sin Max

En la raíz del repo OSC Router:

```bash
npm run udp:listen
```

Pon en **Destino** la IPv4 LAN del PC y el puerto que imprime el listener (por defecto 8000).

## Limitación vs PWA

Esta APK **sí** habla UDP. La PWA del monorepo **no** puede: el navegador obliga a usar el bridge Node en otro proceso/dispositivo.
