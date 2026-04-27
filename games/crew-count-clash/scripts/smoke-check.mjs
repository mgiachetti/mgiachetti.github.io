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
  assert(shop.equipped >= 5, `Expected 5 equipped cosmetics, got ${shop.equipped}.`);
  assert(shop.withinViewport, "Shop should fit desktop viewport.");
  await desktop.screenshot(join(screenshotDir, "crew-count-clash-smoke-shop.png"));
  await desktop.send("Runtime.evaluate", { expression: "document.querySelector('[data-close-shop]').click(); document.querySelector('[data-open-map]').click()" });
  await sleep(300);
  const map = await desktop.eval(`(() => {
    const nodes = [...document.querySelectorAll("[data-level-map] .level-node")];
    const panel = document.querySelector("#map-screen").getBoundingClientRect();
    return {
      count: nodes.length,
      unlocked: nodes.filter((item) => item.classList.contains("unlocked")).length,
      visible: !document.querySelector("#map-screen").classList.contains("is-hidden"),
      withinViewport: panel.bottom <= innerHeight && panel.right <= innerWidth
    };
  })()`);
  assert(map.visible, "Map should be visible.");
  assert(map.count >= 20, `Expected at least 20 map levels, got ${map.count}.`);
  assert(map.unlocked >= 1, `Expected at least one unlocked map node, got ${map.unlocked}.`);
  assert(map.withinViewport, "Map should fit desktop viewport.");
  await desktop.screenshot(join(screenshotDir, "crew-count-clash-smoke-map.png"));
  await desktop.send("Runtime.evaluate", { expression: "document.querySelector('[data-close-map]').click(); document.querySelector('[data-open-base]').click()" });
  await sleep(300);
  const base = await desktop.eval(`(() => {
    const pieces = [...document.querySelectorAll("[data-castle-piece]")];
    const milestones = [...document.querySelectorAll("[data-base-milestones] .base-milestone")];
    const panel = document.querySelector("#base-screen").getBoundingClientRect();
    return {
      pieces: pieces.length,
      milestones: milestones.length,
      tier: document.querySelector("[data-base-tier]").textContent,
      visible: !document.querySelector("#base-screen").classList.contains("is-hidden"),
      withinViewport: panel.bottom <= innerHeight && panel.right <= innerWidth
    };
  })()`);
  assert(base.visible, "Castle/base screen should be visible.");
  assert(base.pieces >= 9, `Expected castle pieces, got ${base.pieces}.`);
  assert(base.milestones >= 8, `Expected castle milestones, got ${base.milestones}.`);
  assert(base.tier.includes("/"), `Expected castle tier text, got ${base.tier}.`);
  assert(base.withinViewport, "Castle/base screen should fit desktop viewport.");
  await desktop.screenshot(join(screenshotDir, "crew-count-clash-smoke-base.png"));
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

  const battle = await openPage();
  await battle.send("Page.enable");
  await battle.send("Runtime.enable");
  await battle.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await battle.send("Page.navigate", { url: `${origin}?autostart=1&level=2&battle=1&count=42&pixel=1` });
  await waitForEval(
    battle,
    `!document.querySelector("#hud").classList.contains("is-hidden") && Number(document.querySelector("[data-count]").textContent.replace(/,/g, "")) < 42`,
    5000,
    "Battle QA should apply its first visible crew loss."
  );
  const battleGame = await battle.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const samples = [];
    const centerX = Math.floor(canvas.width * 0.5);
    const centerY = Math.floor(canvas.height * 0.53);
    for (let y = centerY - 110; y <= centerY + 110; y += 10) {
      for (let x = centerX - 210; x <= centerX + 210; x += 10) {
        const sample = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
        samples.push(Array.from(sample));
      }
    }
    const enemyPixels = samples.filter(([r, g, b]) => r > 95 && b > 75 && g < 120).length;
    return {
      enemyPixels,
      count: Number(document.querySelector("[data-count]").textContent.replace(/,/g, "")),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden"),
      failVisible: !document.querySelector("#fail-screen").classList.contains("is-hidden")
    };
  })()`);
  assert(battleGame.hudVisible, `Battle QA should keep HUD visible, got count=${battleGame.count} reward=${battleGame.rewardVisible} fail=${battleGame.failVisible}.`);
  assert(!battleGame.rewardVisible, "Battle QA should not show reward while clashing.");
  assert(battleGame.count > 0 && battleGame.count < 42, `Battle QA should apply partial losses, got ${battleGame.count}.`);
  assert(battleGame.enemyPixels > 0, "Battle QA should keep enemy pixels visible during clash.");
  await battle.screenshot(join(screenshotDir, "crew-count-clash-smoke-battle.png"));
  await battle.close();

  const roulette = await openPage();
  await roulette.send("Page.enable");
  await roulette.send("Runtime.enable");
  await roulette.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await roulette.send("Page.navigate", { url: `${origin}?autostart=1&level=6&roulette=1&pixel=1` });
  await sleep(6200);
  const roulettePrize = await roulette.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.43), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return {
      sample: Array.from(pixel),
      prizeVisible: !document.querySelector("#roulette-prize").classList.contains("is-hidden"),
      prize: document.querySelector("[data-roulette-prize]").textContent,
      rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden"),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden")
    };
  })()`);
  assert(roulettePrize.hudVisible, "Roulette reveal should keep HUD visible.");
  assert(roulettePrize.prizeVisible, "Roulette should show the prize before reward screen.");
  assert(roulettePrize.prize.length > 0, "Roulette prize label should be populated.");
  assert(!roulettePrize.rewardVisible, "Roulette should not jump straight to reward screen.");
  assert(roulettePrize.sample.some((value) => value > 0), `Roulette canvas sample should be nonblank, got ${roulettePrize.sample.join(",")}.`);
  await roulette.screenshot(join(screenshotDir, "crew-count-clash-smoke-roulette.png"));
  await sleep(3600);
  const rouletteDone = await roulette.eval(`(() => ({
    rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden"),
    title: document.querySelector("[data-result-title]").textContent,
    extra: document.querySelector("[data-result-extra]").textContent
  }))()`);
  assert(rouletteDone.rewardVisible, "Roulette should eventually continue to reward screen.");
  assert(rouletteDone.title === "Roulette Paid", `Expected Roulette Paid reward, got ${rouletteDone.title}.`);
  assert(rouletteDone.extra.includes("Wheel") || rouletteDone.extra.includes("Jackpot"), `Expected roulette reward copy, got ${rouletteDone.extra}.`);
  await roulette.close();

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

  const finalBoss = await openPage();
  await finalBoss.send("Page.enable");
  await finalBoss.send("Runtime.enable");
  await finalBoss.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await finalBoss.send("Page.navigate", { url: `${origin}?autostart=1&level=20&boss=1&count=160&pixel=1` });
  await sleep(3600);
  const finalBossGame = await finalBoss.eval(`(() => ({
    count: Number(document.querySelector("[data-count]").textContent.replace(/,/g, "")),
    hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
    rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden")
  }))()`);
  assert(finalBossGame.hudVisible, "Final boss QA should keep HUD visible.");
  assert(!finalBossGame.rewardVisible, "Final boss direct QA should stay in combat.");
  assert(finalBossGame.count > 0, `Final boss QA crew count should stay above zero, got ${finalBossGame.count}.`);
  await finalBoss.screenshot(join(screenshotDir, "crew-count-clash-smoke-final-boss.png"));
  await finalBoss.close();

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
  await waitForEval(
    bossVictory,
    `!document.querySelector("#reward-screen").classList.contains("is-hidden")`,
    14000,
    "Boss victory should finish on the reward panel."
  );
  const bossVictoryDone = await bossVictory.eval(`(() => ({
    rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden"),
    title: document.querySelector("[data-result-title]").textContent,
    extra: document.querySelector("[data-result-extra]").textContent,
    castleVisible: !document.querySelector("[data-reward-castle]").classList.contains("is-hidden"),
    castleTitle: document.querySelector("[data-reward-castle-title]").textContent
  }))()`);
  assert(bossVictoryDone.rewardVisible, "Boss victory should finish on the reward panel.");
  assert(bossVictoryDone.title === "Boss Defeated", `Expected Boss Defeated reward, got ${bossVictoryDone.title}.`);
  assert(bossVictoryDone.extra.includes("Boss medal"), `Expected boss reward copy, got ${bossVictoryDone.extra}.`);
  assert(bossVictoryDone.castleVisible, "Boss reward should show castle build progress.");
  assert(bossVictoryDone.castleTitle.includes("Castle"), `Expected castle reward copy, got ${bossVictoryDone.castleTitle}.`);
  await bossVictory.screenshot(join(screenshotDir, "crew-count-clash-smoke-reward.png"));
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

  const stairFinale = await openPage();
  await stairFinale.send("Page.enable");
  await stairFinale.send("Runtime.enable");
  await stairFinale.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await stairFinale.send("Page.navigate", { url: `${origin}?autostart=1&level=1&stairs=1&count=1&pixel=1` });
  await sleep(1800);
  const stairFinaleMid = await stairFinale.eval(`(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.48), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return {
      sample: Array.from(pixel),
      hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
      rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden")
    };
  })()`);
  assert(stairFinaleMid.hudVisible, "Stair finale should keep HUD visible before rewards.");
  assert(!stairFinaleMid.rewardVisible, "Stair finale should pause before reward screen.");
  assert(stairFinaleMid.sample.some((value) => value > 0), `Stair finale canvas should be nonblank, got ${stairFinaleMid.sample.join(",")}.`);
  await stairFinale.screenshot(join(screenshotDir, "crew-count-clash-smoke-stair-finale.png"));
  await waitForEval(
    stairFinale,
    `!document.querySelector("#reward-screen").classList.contains("is-hidden")`,
    7000,
    "Stair finale should eventually continue to reward screen."
  );
  const stairFinaleDone = await stairFinale.eval(`(() => ({
    rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden"),
    title: document.querySelector("[data-result-title]").textContent,
    extraSpinVisible: !document.querySelector("[data-extra-spin]").classList.contains("is-hidden")
  }))()`);
  assert(stairFinaleDone.rewardVisible, "Stair finale should eventually continue to reward screen.");
  assert(stairFinaleDone.title === "Level Clear", `Expected Level Clear reward, got ${stairFinaleDone.title}.`);
  assert(stairFinaleDone.extraSpinVisible, "Reward screen should offer no-ad extra spin when tickets are available.");
  await stairFinale.send("Runtime.evaluate", { expression: "document.querySelector('[data-extra-spin]').click()" });
  await sleep(850);
  const extraSpin = await stairFinale.eval(`(() => ({
    hudVisible: !document.querySelector("#hud").classList.contains("is-hidden"),
    rewardVisible: !document.querySelector("#reward-screen").classList.contains("is-hidden")
  }))()`);
  assert(extraSpin.hudVisible, "Extra spin should return to HUD/roulette view.");
  assert(!extraSpin.rewardVisible, "Extra spin should hide the reward panel while spinning.");
  await stairFinale.screenshot(join(screenshotDir, "crew-count-clash-smoke-extra-spin.png"));
  await stairFinale.close();

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

async function waitForEval(page, expression, timeoutMs, message) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.eval(`Boolean(${expression})`)) {
      return;
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
