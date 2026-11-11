/**
 * Gradle clean + remove Metro / Expo caches (safe before a rebuild).
 */
import { existsSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const rel of ["node_modules/.cache", ".expo"]) {
  const full = path.join(root, rel);
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true });
    console.log("[clean] removed", rel);
  }
}

const gradlew = path.join(root, "android", "gradlew.bat");
if (existsSync(gradlew)) {
  console.log("[clean] android/gradlew clean");
  const r = spawnSync(gradlew, ["clean"], {
    cwd: path.join(root, "android"),
    stdio: "inherit",
    shell: true,
  });
  process.exit(r.status ?? 1);
}

console.log("[clean] done (no android/ folder)");
