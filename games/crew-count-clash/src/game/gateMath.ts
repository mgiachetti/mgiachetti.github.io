import type { GateOp } from "./types";

export function calculateGateCount(count: number, op: GateOp, value: number, bonus = 0): number {
  if (op === "add") {
    return Math.max(0, Math.floor(count + value + Math.floor(bonus * 2)));
  }
  if (op === "subtract") {
    return Math.max(0, Math.floor(count - value));
  }
  if (op === "multiply") {
    return Math.max(0, Math.floor(count * value + bonus));
  }
  if (op === "divide") {
    return Math.max(0, Math.ceil(count / Math.max(1, value)));
  }
  return Math.max(0, Math.round(count * (1 + value / 100 + bonus * 0.03)));
}
