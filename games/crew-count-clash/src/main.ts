import "./style.css";
import { Game } from "./game/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (!canvas) {
  throw new Error("Missing game canvas");
}

const game = new Game(canvas);
game.start();

if (new URLSearchParams(window.location.search).has("autostart")) {
  window.setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const level = Number(params.get("level") ?? "0");
    void game.quickStart(Number.isFinite(level) && level > 0 ? level : undefined);
  }, 80);
}
