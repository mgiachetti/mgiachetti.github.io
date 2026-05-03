import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SMOKE_PORT ?? 5228);
const debugPort = Number(process.env.SMOKE_DEBUG_PORT ?? 9368);
const origin = `http://127.0.0.1:${port}/vector-tank-zone/`;
const screenshotDir = process.env.SMOKE_OUT ?? "/tmp";
const chromePath =
  process.env.CHROME_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "google-chrome");

const server = spawn(
  join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite"),
  ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
);

let serverLog = "";
server.stdout.on("data", (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverLog += chunk.toString();
});

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-gpu-sandbox",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/vector-tank-zone-smoke-${debugPort}`,
    "about:blank"
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
);

function cleanup() {
  server.kill();
  chrome.kill();
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

try {
  await waitForHttp(origin, 10000, () => `Vite did not start.\n${serverLog}`);
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 10000, () => "Chrome DevTools did not start.");
  await assertPwaShell(origin);
  await mkdir(screenshotDir, { recursive: true });

  const title = await openPage();
  await title.send("Page.enable");
  await title.send("Runtime.enable");
  await title.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await title.send("Page.navigate", { url: origin });
  await waitForEval(
    title,
    `document.querySelector("#loading-screen")?.classList.contains("is-hidden") === true`,
    10000,
    "Game did not finish initial title boot."
  );
  const titleState = await title.eval(`(() => {
    document.querySelector("[data-start]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return {
      titleHidden: document.querySelector("#title-screen").classList.contains("is-hidden"),
      briefingVisible: !document.querySelector("#briefing-screen").classList.contains("is-hidden"),
      loadingHidden: document.querySelector("#loading-screen").classList.contains("is-hidden"),
      mapNodes: document.querySelectorAll(".map-node").length,
      objective: document.querySelector("[data-brief-objective]").textContent,
      detail: document.querySelector("[data-brief-detail]").textContent,
      scripts: Array.from(document.scripts).map((script) => script.src),
      overlay: document.querySelector("vite-error-overlay")?.shadowRoot?.textContent?.slice(0, 280) ?? ""
    };
  })()`);
  assert(titleState.titleHidden, `Start should move from title to briefing. State: ${JSON.stringify(titleState)}.`);
  assert(titleState.briefingVisible, `Briefing should be visible after Start. State: ${JSON.stringify(titleState)}.`);
  assert(titleState.mapNodes === 25, `Expected 25 level map nodes, got ${titleState.mapNodes}.`);
  assert(titleState.objective.length > 0, "Briefing should show an objective.");
  assert(titleState.detail.length > 0, "Briefing should show objective detail.");
  await title.screenshot(join(screenshotDir, "vector-tank-zone-smoke-briefing.png"));
  await title.close();

  const desktop = await openPage();
  await desktop.send("Page.enable");
  await desktop.send("Runtime.enable");
  await desktop.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await desktop.send("Page.navigate", { url: `${origin}?autostart=1&level=1&pixel=1` });
  await sleep(1300);
  const state = await desktop.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const samples = [];
    for (let y = Math.floor(canvas.height * 0.2); y <= Math.floor(canvas.height * 0.86); y += 10) {
      for (let x = Math.floor(canvas.width * 0.16); x <= Math.floor(canvas.width * 0.84); x += 10) {
        const pixel = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        samples.push(Array.from(pixel));
      }
    }
    const greenPixels = samples.filter(([r, g, b]) => g > 45 && g >= r && b >= 35).length;
    const warmPixels = samples.filter(([r, g, b]) => r > 75 && g > 35 && r >= b).length;
    return {
      greenPixels,
      warmPixels,
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      level: document.querySelector("[data-level]").textContent,
      targets: Number(document.querySelector("[data-targets]").textContent.replace(/,/g, "")),
      radarPips: document.querySelectorAll(".radar-pip").length
    };
  })()`);
  assert(state.hudVisible, "HUD should be visible during autostart.");
  assert(state.level === "1", `Expected level 1, got ${state.level}.`);
  assert(state.targets > 0, `Expected active targets, got ${state.targets}.`);
  assert(state.radarPips > 0, "Radar should show enemy pips.");
  assert(state.greenPixels > 0, "Canvas should show green vector pixels.");
  assert(state.warmPixels > 0, "Canvas should show enemy/warm pixels.");
  await desktop.screenshot(join(screenshotDir, "vector-tank-zone-smoke-desktop.png"));
  await desktop.close();

  const boss = await openPage();
  await boss.send("Page.enable");
  await boss.send("Runtime.enable");
  await boss.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await boss.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await boss.send("Page.navigate", { url: `${origin}?autostart=1&level=5&pixel=1` });
  await sleep(1600);
  const bossState = await boss.eval(`(() => ({
    hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
    bossVisible: !document.querySelector("[data-boss-wrap]").classList.contains("is-hidden"),
    radarPips: document.querySelectorAll(".radar-pip.boss").length,
    bottomFits: document.querySelector(".hud-bottom").getBoundingClientRect().bottom <= innerHeight,
    touchControlsVisible: getComputedStyle(document.querySelector(".touch-controls")).display !== "none",
    touchStickCount: document.querySelectorAll(".touch-stick").length,
    touchControlsFit: document.querySelector(".touch-controls").getBoundingClientRect().bottom <= innerHeight
  }))()`);
  assert(bossState.hudVisible, "Boss autostart should show HUD.");
  assert(bossState.bossVisible, "Boss level should show boss HP.");
  assert(bossState.radarPips > 0, "Boss should be visible on radar.");
  assert(bossState.bottomFits, "Mobile HUD bottom should fit viewport.");
  assert(bossState.touchControlsVisible, "Mobile joystick controls should be visible.");
  assert(bossState.touchStickCount === 2, `Expected 2 touch sticks, got ${bossState.touchStickCount}.`);
  assert(bossState.touchControlsFit, "Mobile joystick controls should fit viewport.");
  await boss.screenshot(join(screenshotDir, "vector-tank-zone-smoke-boss-mobile.png"));
  await boss.close();

  const finalBoss = await openPage();
  await finalBoss.send("Page.enable");
  await finalBoss.send("Runtime.enable");
  await finalBoss.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await finalBoss.send("Page.navigate", { url: `${origin}?autostart=1&level=25&pixel=1` });
  await sleep(1400);
  const finalBossState = await finalBoss.eval(`(() => ({
    hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
    level: document.querySelector("[data-level]").textContent,
    bossVisible: !document.querySelector("[data-boss-wrap]").classList.contains("is-hidden"),
    bossName: document.querySelector("[data-boss-name]").textContent,
    radarBossPips: document.querySelectorAll(".radar-pip.boss").length,
    targetCount: Number(document.querySelector("[data-targets]").textContent.replace(/,/g, ""))
  }))()`);
  assert(finalBossState.hudVisible, "Final boss QA should show HUD.");
  assert(finalBossState.level === "25", `Expected level 25, got ${finalBossState.level}.`);
  assert(finalBossState.bossVisible, "Final boss QA should show boss HP.");
  assert(finalBossState.bossName === "Crown Array", `Expected Crown Array, got ${finalBossState.bossName}.`);
  assert(finalBossState.radarBossPips > 0, "Final boss should be visible on radar.");
  assert(finalBossState.targetCount > 0, "Final boss level should have active targets.");
  await finalBoss.screenshot(join(screenshotDir, "vector-tank-zone-smoke-final-boss.png"));
  await finalBoss.close();

  console.log("Smoke check passed.");
} finally {
  cleanup();
}

async function openPage() {
  const target = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" }).then((response) => response.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      callbacks.get(message.id)(message);
      callbacks.delete(message.id);
    }
  };
  await new Promise((resolvePromise) => {
    ws.onopen = resolvePromise;
  });
  const send = (method, params = {}) =>
    new Promise((resolvePromise, reject) => {
      const request = { id: ++id, method, params };
      callbacks.set(request.id, (message) => {
        if (message.error) {
          reject(new Error(JSON.stringify(message.error)));
        } else {
          resolvePromise(message.result);
        }
      });
      ws.send(JSON.stringify(request));
    });
  return {
    send,
    eval: async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true });
      return result.result.value;
    },
    screenshot: async (path) => {
      const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
      await writeFile(path, Buffer.from(result.data, "base64"));
    },
    close: async () => {
      ws.close();
      try {
        await fetchWithTimeout(`http://127.0.0.1:${debugPort}/json/close/${target.id}`, {}, 1800);
      } catch {
        // Headless Chrome can occasionally keep a close request open.
      }
    }
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHttp(url, timeoutMs, message) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(150);
    }
  }
  throw new Error(message());
}

async function assertPwaShell(baseUrl) {
  const manifest = await fetch(`${baseUrl}manifest.webmanifest`).then((response) => response.json());
  assert(manifest.id === "/vector-tank-zone/", "Manifest should define the app id.");
  assert(manifest.display === "standalone", "Manifest should use standalone display.");
  assert(manifest.icons?.some((icon) => icon.src.endsWith("icon-192.png") && icon.sizes === "192x192"), "Manifest should include 192px PNG icon.");
  assert(manifest.icons?.some((icon) => icon.src.endsWith("icon-512.png") && icon.purpose.includes("maskable")), "Manifest should include maskable 512px PNG icon.");
  await assertAsset(`${baseUrl}icon-192.png`, "image/png");
  await assertAsset(`${baseUrl}icon-512.png`, "image/png");
  await assertAsset(`${baseUrl}sw.js`, "javascript");
}

async function assertAsset(url, contentType) {
  const response = await fetch(url);
  assert(response.ok, `${url} should be fetchable.`);
  assert(response.headers.get("content-type")?.includes(contentType), `${url} should have ${contentType} content type.`);
}

async function waitForEval(page, expression, timeoutMs, message) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await page.eval(expression);
      if (value) {
        return;
      }
    } catch {
      // The runtime can briefly reset while Vite swaps in transformed modules.
    }
    await sleep(150);
  }
  throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
