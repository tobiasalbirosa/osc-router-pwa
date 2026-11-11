/**
 * - react-native-sensors: jcenter() → mavenCentral() (Gradle 8+).
 * - react-native-background-actions: ServiceCompat.startForeground(…, type) needs
 *   a newer AndroidX Core than some RN/Expo stacks resolve; use Service API 29+.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const gradle = path.join(
  root,
  "node_modules",
  "react-native-sensors",
  "android",
  "build.gradle"
);
if (fs.existsSync(gradle)) {
  let s = fs.readFileSync(gradle, "utf8");
  const next = s.replace(/jcenter\(\)/g, "mavenCentral()");
  if (s !== next) {
    fs.writeFileSync(gradle, next);
    console.log("[patch-rn-deps] react-native-sensors: jcenter → mavenCentral");
  }
}

const bgTask = path.join(
  root,
  "node_modules",
  "react-native-background-actions",
  "android",
  "src",
  "main",
  "java",
  "com",
  "asterinet",
  "react",
  "bgactions",
  "RNBackgroundActionsTask.java"
);
if (fs.existsSync(bgTask)) {
  let s = fs.readFileSync(bgTask, "utf8");
  if (s.includes("ServiceCompat.startForeground(")) {
    s = s.replace(
      /import androidx\.core\.app\.ServiceCompat;\n\n/,
      ""
    );
    s = s.replace(
      `        try {
            ServiceCompat.startForeground(
                this,
                SERVICE_NOTIFICATION_ID,
                notification,
                bgOptions.getForegroundServiceType()
            );
        } catch (RuntimeException e) {`,
      `        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    SERVICE_NOTIFICATION_ID,
                    notification,
                    bgOptions.getForegroundServiceType()
                );
            } else {
                startForeground(SERVICE_NOTIFICATION_ID, notification);
            }
        } catch (RuntimeException e) {`
    );
    fs.writeFileSync(bgTask, s);
    console.log(
      "[patch-rn-deps] react-native-background-actions: ServiceCompat → Service.startForeground"
    );
  }
}
