/**
 * Cliente OSC/UDP nativo (solo envío): /a* en m/s², /g* en °/s, redondeados a 2 decimales.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  InteractionManager,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundService from 'react-native-background-actions';
import dgram from 'react-native-udp';
import {
  accelerometer,
  gyroscope,
  SensorTypes,
  setUpdateIntervalForType,
} from 'react-native-sensors';
import { encodeOscFloat } from './src/osc';
import {
  IntervalUnit,
  KEYS,
  loadPrefs,
  savePrefs,
  toIntervalMs,
} from './src/prefs';

const RAD_TO_DEG = 180 / Math.PI;

/** Redondeo a 2 decimales para OSC (ej. n.nn). */
function round2(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Tarea mínima para mantener el foreground service (notificación) en Android. */
const keepAliveTask = async () => {
  while (BackgroundService.isRunning()) {
    await sleep(4000);
  }
};

const bgServiceOptions = {
  taskName: 'OscUdpKeepAlive',
  taskTitle: 'OSC UDP sensores',
  taskDesc: 'Captura y envío en segundo plano',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' as const },
  color: '#1c2b3a',
  parameters: {},
  foregroundServiceType: ['dataSync'] as const,
};

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }
  try {
    const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const already = await PermissionsAndroid.check(perm);
    if (already) {
      return true;
    }
    const r = await PermissionsAndroid.request(perm);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.warn('[notif perm]', e);
    return false;
  }
}

/** Tras el diálogo de permisos la actividad puede seguir en transición; evita FGS start ilegal en API 31+. */
function afterActivityStable(ms = 450): Promise<void> {
  return new Promise(resolve => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

type TabKey = 'sensors' | 'dest';

function useAppStateRef() {
  const [s, setS] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setS);
    return () => sub.remove();
  }, []);
  return s;
}

function AppBody() {
  const insets = useSafeAreaInsets();
  const appState = useAppStateRef();
  const appActive = appState === 'active';

  const [tab, setTab] = useState<TabKey>('sensors');
  const [oscHost, setOscHost] = useState('');
  const [oscPort, setOscPort] = useState('8000');
  const [intervalQty, setIntervalQty] = useState('1');
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('ds');
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [accelOn, setAccelOn] = useState(false);
  const [gyroOn, setGyroOn] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [udpReady, setUdpReady] = useState(false);
  const [bgHint, setBgHint] = useState('');

  const socketRef = useRef<ReturnType<typeof dgram.createSocket> | null>(null);
  const latestAccel = useRef({ x: 0, y: 0, z: 0 });
  const latestGyro = useRef({ x: 0, y: 0, z: 0 });
  /** 0 = aún no hubo evento desde que el sensor está activo (evita enviar ceros congelados). */
  const lastAccelEventAt = useRef(0);
  const lastGyroEventAt = useRef(0);

  const capturing = backgroundEnabled || appActive;
  const intervalMs = toIntervalMs(
    Math.max(0.1, parseFloat(intervalQty) || 1),
    intervalUnit,
  );

  useEffect(() => {
    loadPrefs().then(p => {
      setOscHost(p.host);
      setOscPort(String(p.port));
      setIntervalQty(String(p.intervalQty));
      setIntervalUnit(p.intervalUnit);
      setBackgroundEnabled(p.background);
      setAccelOn(p.accelOn);
      setGyroOn(p.gyroOn);
      setPrefsLoaded(true);
    });
  }, []);

  const persist = useCallback(async () => {
    const port = parseInt(oscPort, 10);
    const qty = parseFloat(intervalQty);
    await savePrefs({
      host: oscHost.trim(),
      port: Number.isFinite(port) && port > 0 && port < 65536 ? port : 8000,
      intervalQty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      intervalUnit,
      background: backgroundEnabled,
      accelOn,
      gyroOn,
    });
  }, [
    oscHost,
    oscPort,
    intervalQty,
    intervalUnit,
    backgroundEnabled,
    accelOn,
    gyroOn,
  ]);

  useEffect(() => {
    if (!prefsLoaded) {
      return;
    }
    const t = setTimeout(() => {
      persist().catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [prefsLoaded, persist]);

  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.accelerometer, 50);
    setUpdateIntervalForType(SensorTypes.gyroscope, 50);
  }, []);

  useEffect(() => {
    const socket = dgram.createSocket({ type: 'udp4' });
    const onErr = (e: unknown) => console.warn('[udp]', e);
    socket.on('error', onErr);
    socket.once('listening', () => setUdpReady(true));
    socket.bind(0);
    socketRef.current = socket;
    return () => {
      socket.removeListener('error', onErr);
      setUdpReady(false);
      try {
        socket.close();
      } catch {
        /* */
      }
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!capturing || !accelOn) {
      return;
    }
    lastAccelEventAt.current = 0;
    const sub = accelerometer.subscribe(({ x, y, z }) => {
      lastAccelEventAt.current = Date.now();
      latestAccel.current = { x, y, z };
    });
    return () => sub.unsubscribe();
  }, [capturing, accelOn]);

  useEffect(() => {
    if (!capturing || !gyroOn) {
      return;
    }
    lastGyroEventAt.current = 0;
    const sub = gyroscope.subscribe(({ x, y, z }) => {
      lastGyroEventAt.current = Date.now();
      latestGyro.current = {
        x: x * RAD_TO_DEG,
        y: y * RAD_TO_DEG,
        z: z * RAD_TO_DEG,
      };
    });
    return () => sub.unsubscribe();
  }, [capturing, gyroOn]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!backgroundEnabled) {
      BackgroundService.stop().catch(() => {});
      setBgHint('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ok = await ensureNotificationPermission();
        if (cancelled) {
          return;
        }
        if (!ok) {
          setBgHint('Activa notificaciones para el modo segundo plano.');
          setBackgroundEnabled(false);
          try {
            await AsyncStorage.setItem(KEYS.background, '0');
          } catch {
            /* */
          }
          return;
        }
        await afterActivityStable(450);
        if (cancelled) {
          return;
        }
        setBgHint('Servicio en primer plano activo (notificación).');
        if (BackgroundService.isRunning()) {
          await BackgroundService.stop();
        }
        if (cancelled) {
          return;
        }
        await BackgroundService.start(keepAliveTask, bgServiceOptions);
      } catch (e) {
        console.warn('[bg]', e);
        setBgHint('No se pudo iniciar el servicio en segundo plano.');
        setBackgroundEnabled(false);
        try {
          await AsyncStorage.setItem(KEYS.background, '0');
        } catch {
          /* */
        }
      }
    })().catch(err => console.warn('[bg] async', err));
    return () => {
      cancelled = true;
      BackgroundService.stop().catch(() => {});
    };
  }, [backgroundEnabled]);

  useEffect(() => {
    if (!udpReady || !prefsLoaded) {
      return;
    }
    const sock = socketRef.current;
    if (!sock) {
      return;
    }

    const tick = () => {
      if (!capturing) {
        return;
      }
      if (!accelOn && !gyroOn) {
        return;
      }
      /* En segundo plano el bridge a veces deja de entregar eventos de sensor pero el intervalo
       * sigue: no reenviar el último frame para no simular datos vivos. */
      if (!appActive) {
        const now = Date.now();
        const staleMs = Math.max(500, intervalMs * 4);
        if (accelOn && (lastAccelEventAt.current === 0 || now - lastAccelEventAt.current > staleMs)) {
          return;
        }
        if (gyroOn && (lastGyroEventAt.current === 0 || now - lastGyroEventAt.current > staleMs)) {
          return;
        }
      }
      const host = oscHost.trim() || '127.0.0.1';
      const port = parseInt(oscPort, 10);
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return;
      }
      const sendOne = (path: string, buf: Buffer) => {
        try {
          sock.send(
            buf,
            undefined,
            undefined,
            port,
            host,
            (err: Error | undefined) => {
              if (err) {
                console.warn('[udp send]', path, err.message);
              }
            },
          );
        } catch (e) {
          console.warn('[udp send]', e);
        }
      };

      const { x: ax, y: ay, z: az } = latestAccel.current;
      const { x: gx, y: gy, z: gz } = latestGyro.current;
      if (accelOn) {
        sendOne('/aX', encodeOscFloat('/aX', round2(ax)));
        sendOne('/aY', encodeOscFloat('/aY', round2(ay)));
        sendOne('/aZ', encodeOscFloat('/aZ', round2(az)));
      }
      if (gyroOn) {
        sendOne('/gX', encodeOscFloat('/gX', round2(gx)));
        sendOne('/gY', encodeOscFloat('/gY', round2(gy)));
        sendOne('/gZ', encodeOscFloat('/gZ', round2(gz)));
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [
    udpReady,
    prefsLoaded,
    capturing,
    appActive,
    accelOn,
    gyroOn,
    intervalMs,
    oscHost,
    oscPort,
  ]);

  const qtyNum = parseFloat(intervalQty);
  const qtyOk = Number.isFinite(qtyNum) && qtyNum > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, tab === 'sensors' && styles.tabOn]}
          onPress={() => setTab('sensors')}>
          <Text style={styles.tabText}>Sensores</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'dest' && styles.tabOn]}
          onPress={() => setTab('dest')}>
          <Text style={styles.tabText}>Destino</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled">
        {tab === 'sensors' ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>
                Segundo plano {backgroundEnabled ? '(on)' : '(off)'}
              </Text>
              <Switch
                value={backgroundEnabled}
                onValueChange={setBackgroundEnabled}
                trackColor={{ false: '#333', true: '#2a4a6a' }}
                thumbColor={backgroundEnabled ? '#6ab' : '#888'}
              />
            </View>
            {bgHint ? <Text style={styles.hint}>{bgHint}</Text> : null}
            <Text style={styles.subHint}>
              On: notificación persistente y envío OSC/UDP con la app oculta o pantalla apagada
              (según el fabricante). Off: solo con la app en primer plano. Este cliente no usa
              servidor: el destino es directo por UDP.
            </Text>

            <View style={styles.intervalRow}>
              <Text style={styles.label}>Enviar cada</Text>
              <TextInput
                style={styles.inputQty}
                keyboardType="decimal-pad"
                value={intervalQty}
                onChangeText={setIntervalQty}
              />
              <Pressable
                style={[
                  styles.unitBtn,
                  intervalUnit === 'ds' && styles.unitBtnOn,
                ]}
                onPress={() => setIntervalUnit('ds')}>
                <Text style={styles.unitBtnText}>0,1 s</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.unitBtn,
                  intervalUnit === 's' && styles.unitBtnOn,
                ]}
                onPress={() => setIntervalUnit('s')}>
                <Text style={styles.unitBtnText}>s</Text>
              </Pressable>
            </View>
            {!qtyOk ? (
              <Text style={styles.warn}>Indica un valor &gt; 0.</Text>
            ) : null}

            <View style={[styles.row, styles.marginTop]}>
              <Text style={styles.label}>Acelerómetro</Text>
              <Switch
                value={accelOn}
                onValueChange={setAccelOn}
                trackColor={{ false: '#333', true: '#2a4a6a' }}
                thumbColor={accelOn ? '#6ab' : '#888'}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Giroscopio</Text>
              <Switch
                value={gyroOn}
                onValueChange={setGyroOn}
                trackColor={{ false: '#333', true: '#2a4a6a' }}
                thumbColor={gyroOn ? '#6ab' : '#888'}
              />
            </View>
            <Text style={styles.mono}>
              OSC: /aX /aY /aZ — aceleración (m/s²), 2 dec.{'\n'}
              /gX /gY /gZ — giro (°/s), 2 dec.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.subHint}>
              Destino OSC/UDP directo (sin bridge). En teléfono físico usa la IPv4 LAN del PC
              receptor, no 127.0.0.1.
            </Text>
            <Text style={styles.label}>IP/HOST</Text>
            <TextInput
              style={styles.input}
              value={oscHost}
              onChangeText={setOscHost}
              placeholder="192.168.1.10"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.label, styles.marginTop]}>Puerto</Text>
            <TextInput
              style={styles.input}
              value={oscPort}
              onChangeText={setOscPort}
              keyboardType="number-pad"
              placeholder="8000"
              placeholderTextColor="#666"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppBody />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f14' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1c2b3a',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: '#4a9eff' },
  tabText: { color: '#e8eef4', fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { color: '#9aa7b2', fontSize: 14, flex: 1 },
  hint: { color: '#7a9', fontSize: 12, marginBottom: 8 },
  subHint: { color: '#666', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  inputQty: {
    width: 72,
    borderWidth: 1,
    borderColor: '#2a3540',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#e8eef4',
    fontSize: 16,
    backgroundColor: '#121820',
  },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a3540',
    backgroundColor: '#121820',
  },
  unitBtnOn: { borderColor: '#4a9eff', backgroundColor: '#1a2838' },
  unitBtnText: { color: '#e8eef4', fontSize: 13 },
  warn: { color: '#c66', fontSize: 12, marginBottom: 8 },
  marginTop: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#2a3540',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e8eef4',
    fontSize: 16,
    backgroundColor: '#121820',
  },
  mono: {
    marginTop: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#5a7',
    lineHeight: 16,
  },
});
