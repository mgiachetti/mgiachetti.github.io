import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SMOKE_PORT ?? 5198);
const debugPort = Number(process.env.SMOKE_DEBUG_PORT ?? 9338);
const origin = `http://127.0.0.1:${port}/crew-count-clash/`;
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
    `--user-data-dir=/tmp/crew-count-clash-smoke-${debugPort}`,
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
  await desktop.send("Page.navigate", { url: origin });
  await sleep(800);
  await desktop.send("Runtime.evaluate", { expression: "document.querySelector('[data-open-shop]').click()" });
  await sleep(300);
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
  assert(shop.visible, "Shop should be visible.");
  assert(shop.count >= 12, `Expected at least 12 cosmetics, got ${shop.count}.`);
  assert(shop.equipped >= 4, `Expected 4 equipped cosmetics, got ${shop.equipped}.`);
  assert(shop.withinViewport, "Shop should fit desktop viewport.");
  await desktop.screenshot(join(screenshotDir, "crew-count-clash-smoke-shop.png"));
  await desktop.close();

  const mobile = await openPage();
  await mobile.send("Page.enable");
  await mobile.send("Runtime.enable");
  await mobile.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await mobile.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await mobile.send("Page.navigate", { url: `${origin}?autostart=1&level=5&pixel=1` });
  await sleep(6500);
  const game = await mobile.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.55), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const crewSamples = [];
    const centerX = Math.floor(canvas.width * 0.5);
    const centerY = Math.floor(canvas.height * 0.72);
    for (let y = centerY - 72; y <= centerY + 72; y += 12) {
      for (let x = centerX - 96; x <= centerX + 96; x += 12) {
        const sample = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
        crewSamples.push(Array.from(sample));
      }
    }
    const crewPixels = crewSamples.filter(([r, g, b]) => r < 95 && g > 95 && b > 120).length;
    const bottom = document.querySelector(".hud-row.bottom").getBoundingClientRect();
    return {
      sample: Array.from(pixel),
      crewPixels,
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      withinViewport: bottom.right <= innerWidth && bottom.bottom <= innerHeight
    };
  })()`);
  assert(game.hudVisible, "HUD should be visible during autostart.");
  assert(game.withinViewport, "Mobile HUD should fit the viewport.");
  assert(game.sample.some((value) => value > 0), `Canvas sample should be nonblank, got ${game.sample.join(",")}.`);
  assert(game.crewPixels > 0, "Crew should still be visible after several seconds of running.");
  await mobile.screenshot(join(screenshotDir, "crew-count-clash-smoke-mobile.png"));
  await mobile.close();

  const advanced = await openPage();
  await advanced.send("Page.enable");
  await advanced.send("Runtime.enable");
  await advanced.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await advanced.send("Page.navigate", { url: `${origin}?autostart=1&level=12&pixel=1` });
  await sleep(3200);
  const advancedGame = await advanced.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width * 0.52), Math.floor(canvas.height * 0.55), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return {
      sample: Array.from(pixel),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      level: document.querySelector("[data-level]").textContent
    };
  })()`);
  assert(advancedGame.hudVisible, "HUD should be visible on advanced level autostart.");
  assert(advancedGame.level === "12", `Expected level 12 HUD, got ${advancedGame.level}.`);
  assert(advancedGame.sample.some((value) => value > 0), `Advanced level canvas sample should be nonblank, got ${advancedGame.sample.join(",")}.`);
  await advanced.screenshot(join(screenshotDir, "crew-count-clash-smoke-level12.png"));
  await advanced.close();

  const boss = await openPage();
  await boss.send("Page.enable");
  await boss.send("Runtime.enable");
  await boss.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await boss.send("Page.navigate", { url: `${origin}?autostart=1&level=10&boss=1&count=70&pixel=1` });
  await sleep(4500);
  const bossGame = await boss.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const samples = [];
    const centerX = Math.floor(canvas.width * 0.5);
    const centerY = Math.floor(canvas.height * 0.69);
    for (let y = centerY - 90; y <= centerY + 90; y += 10) {
      for (let x = centerX - 180; x <= centerX + 180; x += 10) {
        const sample = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
        samples.push(Array.from(sample));
      }
    }
    const crewPixels = samples.filter(([r, g, b]) => r < 95 && g > 95 && b > 120).length;
    return {
      crewPixels,
      count: Number(document.querySelector("[data-count]").textContent.replace(/,/g, "")),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden")
    };
  })()`);
  assert(bossGame.hudVisible, "HUD should still be visible during direct boss QA.");
  assert(bossGame.count > 0, `Boss QA crew count should stay above zero, got ${bossGame.count}.`);
  assert(bossGame.crewPixels > 0, "Crew should remain visible during boss fight.");
  await boss.screenshot(join(screenshotDir, "crew-count-clash-smoke-boss.png"));
  await boss.close();

  const bossVictory = await openPage();
  await bossVictory.send("Page.enable");
  await bossVictory.send("Runtime.enable");
  await bossVictory.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await bossVictory.send("Page.navigate", { url: `${origin}?autostart=1&level=10&boss=1&count=3000&pixel=1` });
  await sleep(1700);
  const bossVictoryMid = await bossVictory.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return {
      sample: Array.from(pixel),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden")
    };
  })()`);
  assert(bossVictoryMid.hudVisible, "Boss victory sequence should keep HUD visible before rewards.");
  assert(!bossVictoryMid.rewardVisible, "Boss victory should not jump straight to the reward panel.");
  assert(bossVictoryMid.sample.some((value) => value > 0), `Boss victory canvas should be nonblank, got ${bossVictoryMid.sample.join(",")}.`);
  await bossVictory.screenshot(join(screenshotDir, "crew-count-clash-smoke-boss-victory.png"));
  await sleep(5200);
  const bossVictoryDone = await bossVictory.eval(`(() => ({
    rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden"),
    title: document.querySelector("[data-result-title]").textContent,
    extra: document.querySelector("[data-result-extra]").textContent
  }))()`);
  assert(bossVictoryDone.rewardVisible, "Boss victory should finish on the reward panel.");
  assert(bossVictoryDone.title === "Boss Defeated", `Expected Boss Defeated reward, got ${bossVictoryDone.title}.`);
  assert(bossVictoryDone.extra.includes("Boss medal"), `Expected boss reward copy, got ${bossVictoryDone.extra}.`);
  await bossVictory.close();

  const stairs = await openPage();
  await stairs.send("Page.enable");
  await stairs.send("Runtime.enable");
  await stairs.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await stairs.send("Page.navigate", { url: `${origin}?autostart=1&level=1&stairs=1&count=60&pixel=1` });
  await sleep(1200);
  const stairsGame = await stairs.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const samples = [];
    const centerX = Math.floor(canvas.width * 0.5);
    const centerY = Math.floor(canvas.height * 0.54);
    for (let y = centerY - 100; y <= centerY + 100; y += 10) {
      for (let x = centerX - 190; x <= centerX + 190; x += 10) {
        const sample = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
        samples.push(Array.from(sample));
      }
    }
    const crewPixels = samples.filter(([r, g, b]) => r < 95 && g > 95 && b > 120).length;
    return {
      crewPixels,
      count: Number(document.querySelector("[data-count]").textContent.replace(/,/g, "")),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden")
    };
  })()`);
  assert(stairsGame.hudVisible, "HUD should be visible during direct stairs QA.");
  assert(stairsGame.count > 20, `Stairs QA crew count should still be climbing, got ${stairsGame.count}.`);
  assert(stairsGame.crewPixels > 0, "Crew should be visible during final stairs animation.");
  await stairs.screenshot(join(screenshotDir, "crew-count-clash-smoke-stairs.png"));
  await stairs.close();

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
