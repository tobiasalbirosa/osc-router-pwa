jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-udp', () => ({
  __esModule: true,
  default: {
    createSocket: () => ({
      bind: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    }),
  },
}));

jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => Promise.resolve(false)),
    updateNotification: jest.fn(),
  },
}));

jest.mock('react-native-sensors', () => {
  const noop = () => ({ unsubscribe: jest.fn() });
  return {
    SensorTypes: { accelerometer: 'accelerometer', gyroscope: 'gyroscope' },
    setUpdateIntervalForType: jest.fn(),
    accelerometer: { subscribe: noop },
    gyroscope: { subscribe: noop },
  };
});
