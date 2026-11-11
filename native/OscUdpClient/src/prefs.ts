import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  host: 'oscHost',
  port: 'oscPort',
  intervalQty: 'oscIntervalQty',
  intervalUnit: 'oscIntervalUnit',
  background: 'oscBackgroundUdp',
  accel: 'oscAccelOn',
  gyro: 'oscGyroOn',
} as const;

export type IntervalUnit = 'ds' | 's';

export function toIntervalMs(qty: number, unit: IntervalUnit): number {
  const raw = unit === 's' ? qty * 1000 : qty * 100;
  return Math.max(10, Math.min(60_000, raw));
}

export async function loadPrefs(): Promise<{
  host: string;
  port: number;
  intervalQty: number;
  intervalUnit: IntervalUnit;
  background: boolean;
  accelOn: boolean;
  gyroOn: boolean;
}> {
  try {
    const [h, p, q, u, bg, ac, gy] = await AsyncStorage.multiGet([
      KEYS.host,
      KEYS.port,
      KEYS.intervalQty,
      KEYS.intervalUnit,
      KEYS.background,
      KEYS.accel,
      KEYS.gyro,
    ]);
    const qty = parseFloat(q[1] || '1');
    return {
      host: h[1] || '',
      port: p[1] ? parseInt(p[1], 10) || 8000 : 8000,
      intervalQty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      intervalUnit: u[1] === 's' ? 's' : 'ds',
      background: bg[1] === '1',
      accelOn: ac[1] === '1',
      gyroOn: gy[1] === '1',
    };
  } catch {
    return {
      host: '',
      port: 8000,
      intervalQty: 1,
      intervalUnit: 'ds',
      background: false,
      accelOn: false,
      gyroOn: false,
    };
  }
}

export async function savePrefs(p: {
  host: string;
  port: number;
  intervalQty: number;
  intervalUnit: IntervalUnit;
  background: boolean;
  accelOn: boolean;
  gyroOn: boolean;
}): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.host, p.host],
    [KEYS.port, String(p.port)],
    [KEYS.intervalQty, String(p.intervalQty)],
    [KEYS.intervalUnit, p.intervalUnit],
    [KEYS.background, p.background ? '1' : '0'],
    [KEYS.accel, p.accelOn ? '1' : '0'],
    [KEYS.gyro, p.gyroOn ? '1' : '0'],
  ]);
}
