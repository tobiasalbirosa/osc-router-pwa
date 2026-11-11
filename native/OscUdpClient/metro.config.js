const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Forward device `console.log` / warnings / errors to the Metro terminal (Expo default is on; keep explicit).
config.server = {
  ...config.server,
  forwardClientLogs: true,
};

module.exports = config;
