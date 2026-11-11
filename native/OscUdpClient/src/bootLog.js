/**
 * Earliest JS-side error/warning logging (after the bundle loads).
 * Metro/Babel diagnostics appear in the terminal (see EXPO_DEBUG on npm scripts).
 */
import { LogBox } from 'react-native';

const TAG = '[OscUdpClient]';

function stamp() {
  return new Date().toISOString();
}

if (__DEV__) {
  if (typeof LogBox?.ignoreAllLogs === 'function') {
    LogBox.ignoreAllLogs(false);
  }

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args) => {
    origError(`${TAG} ${stamp()} ERROR`, ...args);
  };

  console.warn = (...args) => {
    origWarn(`${TAG} ${stamp()} WARN`, ...args);
  };

  const g = globalThis;
  if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
    const prev = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((error, isFatal) => {
      origError(
        `${TAG} ${stamp()} GLOBAL isFatal=${Boolean(isFatal)}`,
        error?.message ?? error,
        error?.stack ?? ''
      );
      if (typeof prev === 'function') {
        prev(error, isFatal);
      }
    });
  }

  const origLog = console.log.bind(console);
  origLog(`${TAG} ${stamp()} Boot log active (errors/warnings prefixed + global handler)`);
}
