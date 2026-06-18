// One-command screenshotter for the cavity-QED lab. Serves the production build (run `npm run build`
// first), opens each regime tab headless (swiftshader WebGL for the 3D), and writes screenshots/<tab>.png.
// Drag those PNGs straight into a chat to share the current visual state.
//
//   npm run build && npm run screenshot
//
// It starts and stops its own `vite preview` on PORT, so there is no server left running afterwards.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

const PORT = 4317;
const URL = `http://localhost:${PORT}`;
const TABS = [
  { name: "1-single", text: "SINGLE EMITTER", settle: 2500 },
  { name: "2-collective", text: "COLLECTIVE", settle: 2500 },
  { name: "3-cavity", text: "CAVITY FIELD", settle: 6000 }, // 3D needs longer warm-up under swiftshader
  { name: "4-dynamics", text: "DYNAMICS", settle: 6000 },   // 3D + live RAF
  { name: "5-vibronic", text: "VIBRONIC", settle: 2500 },
];

function waitForServer(timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () =>
      http
        .get(URL, (res) => { res.resume(); resolve(); })
        .on("error", () => (Date.now() - start > timeoutMs ? reject(new Error("vite preview did not come up — did you run `npm run build`?")) : setTimeout(tryOnce, 300)));
    tryOnce();
  });
}

(async () => {
  const viteBin = path.join(process.cwd(), "node_modules", ".bin", "vite");
  const preview = spawn(viteBin, ["preview", "--port", String(PORT)], { stdio: "ignore" });
  const cleanup = () => { try { preview.kill(); } catch { /* already gone */ } };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  try {
    await waitForServer();
    const browser = await chromium.launch({
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    });
    const page = await browser.newPage({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000); // WASM core + first paint

    const outDir = path.join(process.cwd(), "screenshots");
    fs.mkdirSync(outDir, { recursive: true });

    for (const tab of TABS) {
      await page.getByText(tab.text, { exact: true }).first().click().catch(() => { /* tab may already be active */ });
      await page.waitForTimeout(tab.settle);
      const file = path.join(outDir, `${tab.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`SCREENSHOT_PATH:${file}`);
    }

    await browser.close();
    console.log(`\n✓ ${TABS.length} screenshots written to ${outDir}`);
  } finally {
    cleanup();
  }
})().catch((e) => { console.error(e); process.exit(1); });
