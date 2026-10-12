// Renders public/icons/icon.svg into the PNG sizes the manifest and iOS need.
// Usage: node scripts/generate-icons.mjs   (needs `playwright` available)
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
const targets = [
  { file: "icon-192.png", size: 192, pad: 0, radius: true },
  { file: "icon-512.png", size: 512, pad: 0, radius: true },
  // Maskable icons need a full-bleed background with the glyph inside the safe zone.
  { file: "icon-maskable-512.png", size: 512, pad: 0.14, radius: false },
  { file: "apple-touch-icon.png", size: 180, pad: 0, radius: false },
];
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inner = t.radius ? svg : svg.replace('rx="112"', 'rx="0"');
  const scale = 1 - t.pad * 2;
  await page.setContent(
    `<html><body style="margin:0;background:#0d0e12;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
      <div style="width:${t.size * scale}px;height:${t.size * scale}px">${inner.replace("<svg ", `<svg width="100%" height="100%" `)}</div>
    </body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname, omitBackground: t.radius });
}
await browser.close();
console.log("icons written");
