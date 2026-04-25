import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SMOKE_PORT ?? 5197);
const debugPort = Number(process.env.SMOKE_DEBUG_PORT ?? 9337);
const origin = `http://127.0.0.1:${port}/pancake-stack-run/`;
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
    `--user-data-dir=/tmp/pancake-stack-run-smoke-${debugPort}`,
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
  await mkdir(screenshotDir, { recursive: true });

  const desktop = await openPage();
  await desktop.send("Page.enable");
  await desktop.send("Runtime.enable");
  await desktop.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await desktop.send("Page.navigate", { url: `${origin}?smoke=shop` });
  await sleep(1200);
  await desktop.send("Runtime.evaluate", { expression: "document.querySelector('[data-open-shop]').click()" });
  await sleep(400);
  const shop = await desktop.eval(`(() => {
    const items = [...document.querySelectorAll("[data-cosmetics] .cosmetic")];
    const panel = document.querySelector("#shop-screen").getBoundingClientRect();
    return {
      count: items.length,
      equipped: items.filter((item) => item.classList.contains("equipped")).length,
      visible: !document.querySelector("#shop-screen").classList.contains("is-hidden"),
      withinViewport: panel.bottom <= innerHeight && panel.right <= innerWidth
    };
  })()`);
  assert(shop.visible, "Shop should be visible after clicking Shop.");
  assert(shop.count >= 10, `Expected at least 10 cosmetics, got ${shop.count}.`);
  assert(shop.equipped >= 3, `Expected at least 3 equipped cosmetics, got ${shop.equipped}.`);
  assert(shop.withinViewport, "Shop panel should fit the desktop viewport.");
  await desktop.screenshot(join(screenshotDir, "pancake-stack-run-smoke-shop.png"));
  await desktop.close();

  const mobile = await openPage();
  await mobile.send("Page.enable");
  await mobile.send("Runtime.enable");
  await mobile.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await mobile.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await mobile.send("Page.navigate", { url: `${origin}?autostart=1&level=10&pixel=1&smoke=mobile` });
  await sleep(2500);
  const game = await mobile.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.55), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const bottom = document.querySelector(".hud-row.bottom").getBoundingClientRect();
    return {
      sample: Array.from(pixel),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      withinViewport: bottom.right <= innerWidth && bottom.bottom <= innerHeight
    };
  })()`);
  assert(game.hudVisible, "HUD should be visible during autostart.");
  assert(game.withinViewport, "Mobile HUD should fit the viewport.");
  assert(game.sample.some((value) => value > 0), `Canvas pixel sample should be nonblank, got ${game.sample.join(",")}.`);
  await mobile.screenshot(join(screenshotDir, "pancake-stack-run-smoke-mobile.png"));
  await mobile.close();

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
  await new Promise((resolve) => {
    ws.onopen = resolve;
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
      await fetch(`http://127.0.0.1:${debugPort}/json/close/${target.id}`);
    }
  };
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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
