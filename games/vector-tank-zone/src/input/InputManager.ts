import { clamp } from "../utils/math";

export type InputState = {
  throttle: number;
  turn: number;
  turretTurn: number;
  fire: boolean;
  fireHeld: boolean;
};

type StickState = {
  id: number | null;
  startX: number;
  startY: number;
  x: number;
  y: number;
  knob: HTMLElement | null;
};

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private readonly moveStick: StickState = {
    id: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    knob: document.querySelector<HTMLElement>('[data-stick-knob="move"]')
  };
  private readonly aimStick: StickState = {
    id: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    knob: document.querySelector<HTMLElement>('[data-stick-knob="aim"]')
  };
  private fireQueued = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bind();
  }

  read(): InputState {
    const keyboardTurn = (this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0) + (this.keys.has("ArrowRight") || this.keys.has("KeyD") ? -1 : 0);
    const keyboardThrottle = (this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0) + (this.keys.has("ArrowDown") || this.keys.has("KeyS") ? -1 : 0);
    const keyboardTurret = (this.keys.has("KeyQ") ? -1 : 0) + (this.keys.has("KeyE") ? 1 : 0);
    const moveDx = this.stickX(this.moveStick);
    const moveDy = this.stickY(this.moveStick);
    const aimDx = this.stickX(this.aimStick);
    const fire = this.fireQueued || this.keys.has("Space") || this.keys.has("Enter");
    this.fireQueued = false;
    return {
      throttle: clamp(keyboardThrottle + moveDy, -1, 1),
      turn: clamp(keyboardTurn + moveDx, -1, 1),
      turretTurn: clamp(keyboardTurret - aimDx, -1, 1),
      fire,
      fireHeld: this.aimStick.id !== null || this.keys.has("Space") || this.keys.has("Enter")
    };
  }

  private bind(): void {
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "Space" || event.code === "Enter") {
        this.fireQueued = true;
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      const stick = event.clientX < window.innerWidth * 0.5 ? this.moveStick : this.aimStick;
      this.captureStick(stick, event);
      if (stick === this.aimStick) {
        this.fireQueued = true;
      }
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      const stick = this.stickForPointer(event.pointerId);
      if (stick) {
        stick.x = event.clientX;
        stick.y = event.clientY;
        this.updateStickVisual(stick);
      }
    });
    const release = (event: PointerEvent) => {
      const stick = this.stickForPointer(event.pointerId);
      if (stick) {
        this.releaseStick(stick);
      }
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
  }

  private captureStick(stick: StickState, event: PointerEvent): void {
    stick.id = event.pointerId;
    stick.startX = event.clientX;
    stick.startY = event.clientY;
    stick.x = event.clientX;
    stick.y = event.clientY;
    this.updateStickVisual(stick);
  }

  private releaseStick(stick: StickState): void {
    stick.id = null;
    stick.startX = 0;
    stick.startY = 0;
    stick.x = 0;
    stick.y = 0;
    if (stick.knob) {
      stick.knob.style.transform = "translate(-50%, -50%)";
    }
  }

  private stickForPointer(pointerId: number): StickState | null {
    if (this.moveStick.id === pointerId) {
      return this.moveStick;
    }
    if (this.aimStick.id === pointerId) {
      return this.aimStick;
    }
    return null;
  }

  private stickX(stick: StickState): number {
    return stick.id === null ? 0 : clamp((stick.x - stick.startX) / 86, -1, 1);
  }

  private stickY(stick: StickState): number {
    return stick.id === null ? 0 : clamp((stick.startY - stick.y) / 96, -1, 1);
  }

  private updateStickVisual(stick: StickState): void {
    if (!stick.knob) {
      return;
    }
    const x = this.stickX(stick) * 34;
    const y = -this.stickY(stick) * 34;
    stick.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }
}
