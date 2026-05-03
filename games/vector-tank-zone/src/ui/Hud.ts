import type { LevelData, RadarBlip, RunStats, SaveData } from "../game/types";
import { formatNumber, percent } from "../utils/math";

export class Hud {
  private hud = this.required<HTMLElement>("#hud");
  private title = this.required<HTMLElement>("#title-screen");
  private briefing = this.required<HTMLElement>("#briefing-screen");
  private clear = this.required<HTMLElement>("#level-clear-screen");
  private fail = this.required<HTMLElement>("#fail-screen");
  private pause = this.required<HTMLElement>("#pause-screen");
  private floatLayer = this.required<HTMLElement>("#float-layer");
  private radar = this.required<HTMLElement>("[data-radar]");
  private levelMap = this.required<HTMLElement>("[data-level-map]");
  private bossWrap = this.required<HTMLElement>("[data-boss-wrap]");
  private bossFill = this.required<HTMLElement>("[data-boss-fill]");
  private mute = this.required<HTMLButtonElement>("[data-mute]");
  private damageTimer = 0;

  onStart: (() => void) | null = null;
  onDeploy: (() => void) | null = null;
  onNext: (() => void) | null = null;
  onRetry: (() => void) | null = null;
  onHome: (() => void) | null = null;
  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onMute: (() => void) | null = null;

  constructor() {
    document.querySelectorAll<HTMLElement>("[data-start]").forEach((button) => button.addEventListener("click", () => this.onStart?.()));
    document.querySelectorAll<HTMLElement>("[data-deploy]").forEach((button) => button.addEventListener("click", () => this.onDeploy?.()));
    document.querySelectorAll<HTMLElement>("[data-next]").forEach((button) => button.addEventListener("click", () => this.onNext?.()));
    document.querySelectorAll<HTMLElement>("[data-retry]").forEach((button) => button.addEventListener("click", () => this.onRetry?.()));
    document.querySelectorAll<HTMLElement>("[data-home]").forEach((button) => button.addEventListener("click", () => this.onHome?.()));
    document.querySelectorAll<HTMLElement>("[data-pause]").forEach((button) => button.addEventListener("click", () => this.onPause?.()));
    document.querySelectorAll<HTMLElement>("[data-resume]").forEach((button) => button.addEventListener("click", () => this.onResume?.()));
    this.mute.addEventListener("click", () => this.onMute?.());
  }

  showTitle(save: SaveData): void {
    this.showOnly(this.title);
    this.hud.classList.add("is-hidden");
    this.set("[data-home-level]", String(save.currentLevel));
    this.set("[data-home-score]", formatNumber(save.highScore));
    this.set("[data-home-medals]", formatNumber(save.medals));
    this.set("[data-garage-tier]", this.garageTier(save.medals));
    this.renderLevelMap(save);
  }

  showBriefing(level: LevelData, save: SaveData): void {
    this.showOnly(this.briefing);
    this.hud.classList.add("is-hidden");
    this.set("[data-brief-title]", `${level.id}. ${level.name}`);
    this.set("[data-brief-threats]", formatNumber(level.enemySpawns.length + (level.boss ? 1 : 0)));
    this.set("[data-brief-score]", formatNumber(level.targetScore));
    this.set("[data-brief-objective]", level.objective?.label ?? "Eliminate Armor");
    this.set("[data-brief-detail]", level.objective?.detail ?? "Destroy every active target.");
    this.set("[data-brief-bonus]", `Bonus +${formatNumber(level.objective?.bonus ?? 0)}`);
    this.set("[data-brief-boss]", level.boss ? `Boss: ${level.boss.name}. Weak points: ${level.boss.weakPoints.length}.` : "");
    this.renderLevelMap(save);
  }

  showRun(): void {
    this.hidePanels();
    this.hud.classList.remove("is-hidden");
  }

  showPause(): void {
    this.showOnly(this.pause);
    this.hud.classList.remove("is-hidden");
  }

  showFail(stats: RunStats): void {
    this.hud.classList.add("is-hidden");
    this.showOnly(this.fail);
    this.set("[data-fail-score]", formatNumber(stats.score));
    this.set("[data-fail-kills]", formatNumber(stats.kills));
  }

  showClear(levelName: string, stats: RunStats, medals: number, best: boolean): void {
    this.hud.classList.add("is-hidden");
    this.showOnly(this.clear);
    this.set("[data-clear-title]", levelName);
    this.set("[data-clear-score]", formatNumber(stats.score));
    this.set("[data-clear-kills]", formatNumber(stats.kills));
    this.set("[data-clear-accuracy]", percent(stats.hits / Math.max(1, stats.shots)));
    this.set("[data-clear-medals]", `+${medals}`);
    const bonuses = [
      stats.timeBonus > 0 ? `time +${formatNumber(stats.timeBonus)}` : "",
      stats.noDamageBonus > 0 ? `no-damage +${formatNumber(stats.noDamageBonus)}` : "",
      stats.streakBonus > 0 ? `streak +${formatNumber(stats.streakBonus)}` : "",
      stats.objectiveBonus > 0 ? `objective +${formatNumber(stats.objectiveBonus)}` : ""
    ].filter(Boolean);
    this.set("[data-clear-extra]", `${best ? "New best score logged." : "Zone record preserved."}${bonuses.length ? ` Bonuses: ${bonuses.join(", ")}.` : ""}`);
  }

  updateRun(data: {
    level: number;
    armor: number;
    score: number;
    targets: number;
    reload: number;
    stats: RunStats;
    blips: RadarBlip[];
    arenaSize: number;
    objectiveLabel?: string;
    bossName?: string;
    bossHp?: number;
  }): void {
    this.set("[data-level]", String(data.level));
    this.set("[data-armor]", String(Math.max(0, Math.ceil(data.armor))));
    this.set("[data-score]", formatNumber(data.score));
    this.set("[data-targets]", formatNumber(data.targets));
    this.set("[data-streak]", formatNumber(data.stats.streak));
    this.set("[data-reload]", data.reload <= 0 ? "Ready" : `${Math.ceil(data.reload * 10) / 10}s`);
    this.set("[data-objective]", data.objectiveLabel ?? "Active");
    this.hud.classList.toggle("low-armor", data.armor < 35);
    this.renderRadar(data.blips, data.arenaSize);
    const bossVisible = data.bossName !== undefined && data.bossHp !== undefined;
    this.bossWrap.classList.toggle("is-hidden", !bossVisible);
    if (bossVisible) {
      this.set("[data-boss-name]", data.bossName ?? "Boss");
      this.bossFill.style.transform = `scaleX(${Math.max(0.001, data.bossHp ?? 0)})`;
    }
  }

  updateMute(muted: boolean): void {
    this.mute.textContent = muted ? "Muted" : "Sound";
    this.mute.classList.toggle("is-active", muted);
  }

  popText(text: string, tone: "good" | "bad" | "boss" = "good"): void {
    const item = document.createElement("div");
    item.className = `float-pop ${tone}`;
    item.textContent = text;
    item.style.left = `${42 + Math.random() * 16}%`;
    item.style.top = `${34 + Math.random() * 22}%`;
    this.floatLayer.append(item);
    window.setTimeout(() => item.remove(), 950);
  }

  flashDamage(): void {
    this.hud.classList.add("damage-hit");
    window.clearTimeout(this.damageTimer);
    this.damageTimer = window.setTimeout(() => this.hud.classList.remove("damage-hit"), 260);
  }

  private renderRadar(blips: RadarBlip[], arenaSize: number): void {
    this.radar.innerHTML = '<span class="radar-player"></span>';
    const radius = 52;
    blips.slice(0, 18).forEach((blip) => {
      const pip = document.createElement("span");
      const scale = radius / Math.max(1, arenaSize * 0.5);
      pip.className = `radar-pip${blip.boss ? " boss" : ""}`;
      pip.style.left = `${50 + blip.x * scale}%`;
      pip.style.top = `${50 + blip.z * scale}%`;
      this.radar.append(pip);
    });
  }

  private hidePanels(): void {
    [this.title, this.briefing, this.clear, this.fail, this.pause].forEach((panel) => panel.classList.add("is-hidden"));
  }

  private showOnly(panel: HTMLElement): void {
    this.hidePanels();
    panel.classList.remove("is-hidden");
  }

  private set(selector: string, value: string): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      element.textContent = value;
    }
  }

  private renderLevelMap(save: SaveData): void {
    this.levelMap.innerHTML = "";
    for (let level = 1; level <= 25; level += 1) {
      const node = document.createElement("span");
      const done = save.bestScores[String(level)] > 0;
      const current = level === save.currentLevel;
      const unlocked = level <= save.currentLevel;
      node.className = `map-node${done ? " done" : ""}${current ? " current" : ""}${!unlocked ? " locked" : ""}`;
      node.textContent = String(level);
      this.levelMap.append(node);
    }
  }

  private garageTier(medals: number): string {
    if (medals >= 76) {
      return "Crown Breaker Frame";
    }
    if (medals >= 48) {
      return "Siege Runner Frame";
    }
    if (medals >= 24) {
      return "Vector Assault Frame";
    }
    return "Recon Chassis";
  }

  private required<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing HUD element ${selector}`);
    }
    return element;
  }
}
