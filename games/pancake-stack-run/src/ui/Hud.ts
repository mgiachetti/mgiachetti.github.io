import { cosmeticCatalog } from "../game/saveData";
import type { CosmeticSlot, RunStats, SaveData, UpgradeKey } from "../game/types";
import { formatNumber } from "../utils/math";

type ResultData = {
  title: string;
  score: number;
  coins: number;
  stars: string;
  extra: string;
};

export class Hud {
  private hud = this.required<HTMLElement>("#hud");
  private title = this.required<HTMLElement>("#title-screen");
  private reward = this.required<HTMLElement>("#reward-screen");
  private fail = this.required<HTMLElement>("#fail-screen");
  private shop = this.required<HTMLElement>("#shop-screen");
  private pause = this.required<HTMLElement>("#pause-screen");
  private floatLayer = this.required<HTMLElement>("#float-layer");
  private cosmetics = this.required<HTMLElement>("[data-cosmetics]");

  private level = this.required<HTMLElement>("[data-level]");
  private progress = this.required<HTMLElement>("[data-progress]");
  private coins = this.required<HTMLElement>("[data-coins]");
  private stack = this.required<HTMLElement>("[data-stack]");
  private score = this.required<HTMLElement>("[data-score]");
  private combo = this.required<HTMLElement>("[data-combo]");
  private mute = this.required<HTMLButtonElement>("[data-mute]");

  onStart: (() => void) | null = null;
  onNext: (() => void) | null = null;
  onRetry: (() => void) | null = null;
  onHome: (() => void) | null = null;
  onOpenShop: (() => void) | null = null;
  onCloseShop: (() => void) | null = null;
  onResetSave: (() => void) | null = null;
  onBuy: ((key: UpgradeKey) => void) | null = null;
  onEquip: ((key: string) => void) | null = null;
  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onMute: (() => void) | null = null;

  constructor() {
    document.querySelectorAll<HTMLElement>("[data-start]").forEach((button) => {
      button.addEventListener("click", () => this.onStart?.());
    });
    document.querySelectorAll<HTMLElement>("[data-next]").forEach((button) => {
      button.addEventListener("click", () => this.onNext?.());
    });
    document.querySelectorAll<HTMLElement>("[data-retry]").forEach((button) => {
      button.addEventListener("click", () => this.onRetry?.());
    });
    document.querySelectorAll<HTMLElement>("[data-home]").forEach((button) => {
      button.addEventListener("click", () => this.onHome?.());
    });
    document.querySelectorAll<HTMLElement>("[data-pause]").forEach((button) => {
      button.addEventListener("click", () => this.onPause?.());
    });
    document.querySelectorAll<HTMLElement>("[data-resume]").forEach((button) => {
      button.addEventListener("click", () => this.onResume?.());
    });
    document.querySelectorAll<HTMLElement>("[data-open-shop]").forEach((button) => {
      button.addEventListener("click", () => this.onOpenShop?.());
    });
    document.querySelectorAll<HTMLElement>("[data-close-shop]").forEach((button) => {
      button.addEventListener("click", () => this.onCloseShop?.());
    });
    document.querySelectorAll<HTMLElement>("[data-reset-save]").forEach((button) => {
      button.addEventListener("click", () => this.onResetSave?.());
    });
    document.querySelectorAll<HTMLElement>("[data-buy]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.buy as UpgradeKey | undefined;
        if (key) {
          this.onBuy?.(key);
        }
      });
    });
    this.cosmetics.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-equip]");
      if (button?.dataset.equip) {
        this.onEquip?.(button.dataset.equip);
      }
    });
    this.mute.addEventListener("click", () => this.onMute?.());
  }

  showTitle(save: SaveData): void {
    this.showOnly(this.title);
    this.hud.classList.add("is-hidden");
    this.set("[data-home-level]", String(save.currentLevel));
    this.set("[data-home-coins]", formatNumber(save.coins));
    this.set("[data-home-stars]", formatNumber(save.stars));
    this.set("[data-home-medals]", formatNumber(save.bossMedals));
  }

  showRun(): void {
    this.hidePanels();
    this.hud.classList.remove("is-hidden");
  }

  showPause(): void {
    this.showOnly(this.pause);
    this.hud.classList.remove("is-hidden");
  }

  showReward(data: ResultData): void {
    this.hud.classList.add("is-hidden");
    this.showOnly(this.reward);
    this.set("[data-result-title]", data.title);
    this.countTo("[data-result-score]", data.score, "");
    this.countTo("[data-result-coins]", data.coins, "+");
    this.set("[data-result-stars]", data.stars);
    this.set("[data-result-extra]", data.extra);
  }

  showFail(stats: RunStats): void {
    this.hud.classList.add("is-hidden");
    this.showOnly(this.fail);
    this.set("[data-fail-score]", formatNumber(stats.score));
    this.set("[data-fail-stack]", formatNumber(stats.stackMax));
  }

  showShop(save: SaveData): void {
    this.hud.classList.add("is-hidden");
    this.showOnly(this.shop);
    this.updateShop(save);
  }

  updateRun(levelNumber: number, progress: number, save: SaveData, stats: RunStats, stackCount: number): void {
    this.level.textContent = String(levelNumber);
    this.progress.style.width = `${Math.round(progress * 100)}%`;
    this.coins.textContent = formatNumber(save.coins);
    this.stack.textContent = formatNumber(stackCount);
    this.score.textContent = formatNumber(stats.score);
    this.combo.textContent = `${Math.max(1, stats.combo).toFixed(0)}x`;
  }

  updateMute(muted: boolean): void {
    this.mute.textContent = muted ? "Muted" : "Sound";
    this.mute.classList.toggle("is-active", muted);
  }

  updateShop(save: SaveData): void {
    this.set("[data-shop-coins]", formatNumber(save.coins));
    this.set("[data-shop-xp]", formatNumber(save.unlockXP));
    this.set("[data-shop-medals]", formatNumber(save.bossMedals));
    this.set("[data-shop-cosmetics]", formatNumber(save.ownedCosmetics.length));
    Object.entries(save.upgrades).forEach(([key, tier]) => {
      this.set(`[data-upgrade-${key}]`, `Tier ${tier}`);
    });
    this.renderCosmetics(save);
  }

  popText(text: string, tone: "good" | "bad" | "coin" = "good"): void {
    const item = document.createElement("div");
    item.className = `float-pop ${tone}`;
    item.textContent = text;
    item.style.left = `${44 + Math.random() * 12}%`;
    item.style.bottom = `${22 + Math.random() * 12}%`;
    this.floatLayer.append(item);
    window.setTimeout(() => item.remove(), 820);
  }

  private hidePanels(): void {
    [this.title, this.reward, this.fail, this.shop, this.pause].forEach((panel) => panel.classList.add("is-hidden"));
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

  private countTo(selector: string, target: number, prefix: string): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      return;
    }
    const start = performance.now();
    const duration = 520;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = `${prefix}${formatNumber(target * eased)}`;
      if (progress < 1) {
        window.requestAnimationFrame(animate);
      }
    };
    window.requestAnimationFrame(animate);
  }

  private renderCosmetics(save: SaveData): void {
    const slotLabels: Record<CosmeticSlot, string> = {
      plate: "Plate",
      stack: "Stack",
      trail: "Trail"
    };
    this.cosmetics.innerHTML = "";
    cosmeticCatalog.forEach((item) => {
      const owned = save.ownedCosmetics.includes(item.key);
      const equipped = save.equippedCosmetics[item.slot] === item.key;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cosmetic ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}`;
      button.disabled = !owned || equipped;
      button.dataset.equip = item.key;
      button.setAttribute("aria-label", owned ? `Equip ${item.label}` : `${item.label} locked`);
      button.innerHTML = `
        <span class="swatch" style="--swatch: #${item.primary.toString(16).padStart(6, "0")}; --swatch2: #${(item.secondary ?? item.primary).toString(16).padStart(6, "0")}"></span>
        <b>${item.label}</b>
        <small>${slotLabels[item.slot]} • ${equipped ? "Equipped" : owned ? "Unlocked" : "Locked"}</small>
      `;
      this.cosmetics.append(button);
    });
  }

  private required<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing element ${selector}`);
    }
    return element;
  }
}
