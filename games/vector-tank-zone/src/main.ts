import "./style.css";
import { Game } from "./game/Game";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (!canvas) {
  throw new Error("Missing game canvas");
}

const game = new Game(canvas);
game.start();

window.requestAnimationFrame(() => {
  document.querySelector("#loading-screen")?.classList.add("is-hidden");
});

if (new URLSearchParams(window.location.search).has("autostart")) {
  window.setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const level = Number(params.get("level") ?? "0");
    void game.quickStart(Number.isFinite(level) && level > 0 ? level : undefined);
  }, 80);
}

if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    const serviceWorkerUrl = new URL("sw.js", window.location.href);
    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: new URL(".", serviceWorkerUrl).pathname });
  });
}

const installButton = document.querySelector<HTMLButtonElement>("[data-install]");
let installPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
  installButton?.classList.remove("is-hidden");
});

installButton?.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  installButton.disabled = true;
  await installPrompt.prompt();
  await installPrompt.userChoice.catch(() => undefined);
  installPrompt = null;
  installButton.classList.add("is-hidden");
  installButton.disabled = false;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton?.classList.add("is-hidden");
});
