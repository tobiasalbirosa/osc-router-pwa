import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const isWin = process.platform === "win32";
const gradle = isWin ? "gradlew.bat" : "./gradlew";

spawnSync(
  process.execPath,
  [path.join(root, "scripts", "patch-rn-deps.mjs")],
  { cwd: root, stdio: "inherit" }
);

const r = spawnSync(gradle, ["assembleDebug"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: true,
});

process.exit(r.status ?? 1);
