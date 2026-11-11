import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgPath = path.join(root, "public", "icon.svg");
const svg = fs.readFileSync(svgPath);

async function main() {
  const out192 = await sharp(svg).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(root, "public", "icon-192.png"), out192);

  const out512 = await sharp(svg).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(root, "public", "icon-512.png"), out512);

  const out180 = await sharp(svg).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(root, "public", "apple-touch-icon.png"), out180);

  console.log("PWA icons: icon-192.png, icon-512.png, apple-touch-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
