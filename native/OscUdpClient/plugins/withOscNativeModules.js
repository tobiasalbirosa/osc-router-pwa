/**
 * Ensures react-native-background-actions FGS matches Android 14+ manifest rules:
 * RNBackgroundActionsTask must declare android:foregroundServiceType="dataSync"
 * (and tools:replace so the library AAR merge cannot drop it).
 */
const {
  createRunOncePlugin,
  withAndroidManifest,
  AndroidConfig,
} = require('expo/config-plugins');

const BG_SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';

function withOscNativeModules(config) {
  return withAndroidManifest(config, (config) => {
    const doc = config.modResults;
    const { manifest } = doc;
    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(doc);
    const services = application.service ?? [];

    const idx = services.findIndex((s) => s.$?.['android:name'] === BG_SERVICE);
    const attrs = {
      'android:name': BG_SERVICE,
      'android:exported': 'false',
      'android:foregroundServiceType': 'dataSync',
      'tools:replace': 'android:exported,android:foregroundServiceType',
    };
    if (idx >= 0) {
      services[idx].$ = { ...services[idx].$, ...attrs };
    } else {
      services.push({ $: attrs });
    }
    application.service = services;

    return config;
  });
}

module.exports = createRunOncePlugin(
  withOscNativeModules,
  'with-osc-native-modules',
);
