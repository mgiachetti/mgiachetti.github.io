import { clamp } from "../utils/math";

export type InputState = {
  throttle: number;
  turn: number;
  turretTurn: number;
  fire: boolean;
  fireHeld: boolean;
};

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private pointerActive = false;
  private pointerCombat = false;
  private fireQueued = false;
  private fireHeld = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bind();
  }

  read(): InputState {
    const keyboardTurn = (this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0) + (this.keys.has("ArrowRight") || this.keys.has("KeyD") ? -1 : 0);
    const keyboardThrottle = (this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0) + (this.keys.has("ArrowDown") || this.keys.has("KeyS") ? -1 : 0);
    const keyboardTurret = (this.keys.has("KeyQ") ? 1 : 0) + (this.keys.has("KeyE") ? -1 : 0);
    const pointerDx = this.pointerActive ? clamp((this.pointerX - this.pointerStartX) / 90, -1, 1) : 0;
    const pointerDy = this.pointerActive ? clamp((this.pointerStartY - this.pointerY) / 110, -1, 1) : 0;
    const fire = this.fireQueued || this.keys.has("Space") || this.keys.has("Enter");
    this.fireQueued = false;
    return {
      throttle: clamp(keyboardThrottle + (this.pointerCombat ? 0 : pointerDy), -1, 1),
      turn: clamp(keyboardTurn + (this.pointerCombat ? 0 : pointerDx), -1, 1),
      turretTurn: clamp(keyboardTurret + (this.pointerCombat ? pointerDx : 0), -1, 1),
      fire,
      fireHeld: this.fireHeld || this.keys.has("Space") || this.keys.has("Enter")
    };
  }

  private bind(): void {
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "Space" || event.code === "Enter") {
        this.fireQueued = true;
        this.fireHeld = true;
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      if (event.code === "Space" || event.code === "Enter") {
        this.fireHeld = false;
      }
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.pointerId = event.pointerId;
      this.pointerStartX = event.clientX;
      this.pointerStartY = event.clientY;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.pointerActive = true;
      this.pointerCombat = event.clientY < window.innerHeight * 0.58;
      this.fireQueued = this.pointerCombat;
      this.fireHeld = true;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.pointerId !== event.pointerId) {
        return;
      }
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
    });
    const release = (event: PointerEvent) => {
      if (this.pointerId !== event.pointerId) {
        return;
      }
      this.pointerId = null;
      this.pointerActive = false;
      this.pointerCombat = false;
      this.fireHeld = false;
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
  }
}
