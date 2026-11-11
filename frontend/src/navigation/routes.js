/** Claves de pestaña: reutilizar en React Native (@react-navigation/bottom-tabs). */
export const TabRoute = {
  Sensors: "sensors",
  Destiny: "destiny",
};

export const TAB_CONFIG = [
  {
    route: TabRoute.Sensors,
    label: "Sensors",
    labelNative: "Sensors",
    accessibilityLabel: "Sensores OSC",
  },
  {
    route: TabRoute.Destiny,
    label: "Destiny",
    labelNative: "Destiny",
    accessibilityLabel: "Destino OSC",
  },
];
