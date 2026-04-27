import { cosmeticCatalog, getCastleProgress, upgradeCosts } from "../game/saveData";
import type { CosmeticSlot, RewardData, RunStats, SaveData, UpgradeKey } from "../game/types";
import { getLevel } from "../levels/levelCatalog";
import { formatNumber } from "../utils/math";

export class Hud {
  private hud = this.required<HTMLElement>("#hud");
  private title = this.required<HTMLElement>("#title-screen");
  private reward = this.required<HTMLElement>("#reward-screen");
  private fail = this.required<HTMLElement>("#fail-screen");
  private pause = this.required<HTMLElement>("#pause-screen");
  private shop = this.required<HTMLElement>("#shop-screen");
  private map = this.required<HTMLElement>("#map-screen");
  private base = this.required<HTMLElement>("#base-screen");
  private floatLayer = this.required<HTMLElement>("#float-layer");
  private cosmetics = this.required<HTMLElement>("[data-cosmetics]");
  private levelMap = this.required<HTMLElement>("[data-level-map]");
  private baseMilestones = this.required<HTMLElement>("[data-base-milestones]");
  private rewardCastle = this.required<HTMLElement>("[data-reward-castle]");
  private roulettePrize = this.required<HTMLElement>("#roulette-prize");

  private level = this.required<HTMLElement>("[data-level]");
  private progress = this.required<HTMLElement>("[data-progress]");
  private count = this.required<HTMLElement>("[data-count]");
  private coins = this.required<HTMLElement>("[data-coins]");
  private score = this.required<HTMLElement>("[data-score]");
  private shield = this.required<HTMLElement>("[data-shield]");
  private combo = this.required<HTMLElement>("[data-combo]");
  private mute = this.required<HTMLButtonElement>("[data-mute]");
  private extraSpin = this.required<HTMLButtonElement>("[data-extra-spin]");

  onStart: (() => void) | null = null;
  onNext: (() => void) | null = null;
  onExtraSpin: (() => void) | null = null;
  onRetry: (() => void) | null = null;
  onHome: (() => void) | null = null;
  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onOpenShop: (() => void) | null = null;
  onCloseShop: (() => void) | null = null;
  onOpenMap: (() => void) | null = null;
  onCloseMap: (() => void) | null = null;
  onOpenBase: (() => void) | null = null;
  onCloseBase: (() => void) | null = null;
  onSelectLevel: ((level: number) => void) | null = null;
  onResetSave: (() => void) | null = null;
  onMute: (() => void) | null = null;
  onBuy: ((key: UpgradeKey) => void) | null = null;
  onCosmetic: ((key: string) => void) | null = null;

  constructor() {
    document.querySelectorAll<HTMLElement>("[data-start]").forEach((button) => {
      button.addEventListener("click", () => this.onStart?.());
    });
    document.querySelectorAll<HTMLElement>("[data-next]").forEach((button) => {
      button.addEventListener("click", () => this.onNext?.());
    });
    this.extraSpin.addEventListener("click", () => this.onExtraSpin?.());
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
    document.querySelectorAll<HTMLElement>("[data-open-map]").forEach((button) => {
      button.addEventListener("click", () => this.onOpenMap?.());
    });
    document.querySelectorAll<HTMLElement>("[data-close-map]").forEach((button) => {
      button.addEventListener("click", () => this.onCloseMap?.());
    });
    document.querySelectorAll<HTMLElement>("[data-open-base]").forEach((button) => {
      button.addEventListener("click", () => this.onOpenBase?.());
    });
    document.querySelectorAll<HTMLElement>("[data-close-base]").forEach((button) => {
      button.addEventListener("click", () => this.onCloseBase?.());
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
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-cosmetic]");
      if (button?.dataset.cosmetic) {
        this.onCosmetic?.(button.dataset.cosmetic);
      }
    });
    this.levelMap.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-level-select]");
      const level = Number(button?.dataset.levelSelect ?? "");
      if (button && Number.isFinite(level)) {
        this.onSelectLevel?.(level);
      }
    });
    this.mute.addEventListener("click", () => this.onMute?.());
  }

  showTitle(save: SaveData): void {
    this.hideRoulettePrize();
    this.showOnly(this.title);
    this.hud.classList.add("is-hidden");
    this.set("[data-home-level]", String(save.currentLevel));
    this.set("[data-home-coins]", formatNumber(save.coins));
    this.set("[data-home-gems]", formatNumber(save.gems));
    this.set("[data-home-medals]", formatNumber(save.medals));
  }

  showRun(): void {
    this.hideRoulettePrize();
    this.hidePanels();
    this.hud.classList.remove("is-hidden");
  }

  showPause(): void {
    this.hideRoulettePrize();
    this.showOnly(this.pause);
    this.hud.classList.remove("is-hidden");
  }

  showFail(stats: RunStats): void {
    this.hideRoulettePrize();
    this.hud.classList.add("is-hidden");
    this.showOnly(this.fail);
    this.set("[data-fail-score]", formatNumber(stats.score));
    this.set("[data-fail-count]", formatNumber(stats.maxCount));
  }

  showReward(data: RewardData, save?: SaveData): void {
    this.hideRoulettePrize();
    this.hud.classList.add("is-hidden");
    this.showOnly(this.reward);
    this.reward.classList.toggle("boss-reward", data.kind.includes("Boss"));
    this.reward.classList.toggle("roulette-reward", data.kind.includes("Roulette") || data.kind.includes("Ticket"));
    this.reward.classList.toggle("jackpot-reward", data.extra.includes("Jackpot") || data.title.includes("Jackpot"));
    this.reward.classList.toggle("castle-level-reward", data.castleLeveledUp);
    this.set("[data-result-kind]", data.kind);
    this.set("[data-result-title]", data.title);
    this.countTo("[data-result-score]", data.score, "");
    this.countTo("[data-result-coins]", data.coins, "+");
    this.countTo("[data-result-gems]", data.gems, "+");
    this.set("[data-result-stars]", "★".repeat(data.stars));
    this.set("[data-result-extra]", data.extra);
    this.rewardCastle.classList.toggle("is-hidden", data.castleXP <= 0);
    this.set("[data-reward-castle-title]", data.castleLeveledUp ? "Castle Upgraded" : `Castle +${formatNumber(data.castleXP)} XP`);
    this.set("[data-reward-castle-stage]", data.castleLeveledUp ? `New stage: ${data.castleStage}` : data.castleStage);
    const canSpin = (save?.tickets ?? 0) > 0;
    this.extraSpin.classList.toggle("is-hidden", !canSpin);
    this.extraSpin.textContent = canSpin ? `Extra Spin (${save?.tickets ?? 0})` : "Extra Spin";
  }

  showShop(save: SaveData): void {
    this.hideRoulettePrize();
    this.hud.classList.add("is-hidden");
    this.showOnly(this.shop);
    this.updateShop(save);
  }

  showMap(save: SaveData): void {
    this.hideRoulettePrize();
    this.hud.classList.add("is-hidden");
    this.showOnly(this.map);
    this.renderLevelMap(save);
  }

  showBase(save: SaveData): void {
    this.hideRoulettePrize();
    this.hud.classList.add("is-hidden");
    this.showOnly(this.base);
    this.updateBase(save);
  }

  updateRun(levelNumber: number, progress: number, save: SaveData, stats: RunStats, count: number, shield: number): void {
    this.level.textContent = String(levelNumber);
    this.progress.style.width = `${Math.round(progress * 100)}%`;
    this.count.textContent = formatNumber(count);
    this.coins.textContent = formatNumber(save.coins + stats.coins);
    this.score.textContent = formatNumber(stats.score);
    this.shield.textContent = String(shield);
    this.combo.textContent = `${Math.max(1, stats.combo).toFixed(0)}x`;
  }

  updateMute(muted: boolean): void {
    this.mute.textContent = muted ? "Muted" : "Sound";
    this.mute.classList.toggle("is-active", muted);
  }

  showRoulettePrize(label: string): void {
    this.set("[data-roulette-prize]", label);
    this.roulettePrize.classList.remove("is-hidden");
  }

  hideRoulettePrize(): void {
    this.roulettePrize.classList.add("is-hidden");
  }

  updateShop(save: SaveData): void {
    this.set("[data-shop-coins]", formatNumber(save.coins));
    this.set("[data-shop-gems]", formatNumber(save.gems));
    this.set("[data-shop-tickets]", formatNumber(save.tickets));
    this.set("[data-shop-stars]", formatNumber(save.stars));
    Object.entries(save.upgrades).forEach(([key, tier]) => {
      const cost = upgradeCosts[tier] ?? null;
      this.set(`[data-upgrade-${key}]`, cost === null ? "Max" : `T${tier} • ${cost}`);
    });
    this.renderCosmetics(save);
  }

  updateBase(save: SaveData): void {
    const progress = getCastleProgress(save);
    this.set("[data-base-tier]", `${progress.tier}/${progress.maxTier}`);
    this.set("[data-base-stage]", progress.stage);
    this.set("[data-base-xp]", formatNumber(progress.xp));
    const bar = document.querySelector<HTMLElement>("[data-base-progress]");
    if (bar) {
      bar.style.width = `${Math.round(progress.percent * 100)}%`;
    }
    document.querySelectorAll<HTMLElement>("[data-castle-piece]").forEach((piece) => {
      const unlockTier = Number(piece.dataset.castlePiece ?? "0");
      piece.classList.toggle("is-active", progress.tier >= unlockTier);
    });
    this.baseMilestones.innerHTML = "";
    progress.milestones.slice(1).forEach((milestone) => {
      const item = document.createElement("div");
      item.className = `base-milestone ${milestone.unlocked ? "unlocked" : "locked"}`;
      item.innerHTML = `
        <span>Lv ${milestone.tier}</span>
        <b>${milestone.label}</b>
        <small>${milestone.unlocked ? "Built" : `${formatNumber(milestone.xp)} XP`}</small>
      `;
      this.baseMilestones.append(item);
    });
  }

  popText(text: string, tone: "good" | "bad" | "coin" | "boss" = "good"): void {
    const item = document.createElement("div");
    item.className = `float-pop ${tone}`;
    item.textContent = text;
    item.style.left = `${42 + Math.random() * 16}%`;
    item.style.bottom = `${24 + Math.random() * 14}%`;
    this.floatLayer.append(item);
    window.setTimeout(() => item.remove(), 860);
  }

  private renderCosmetics(save: SaveData): void {
    const slotLabels: Record<CosmeticSlot, string> = {
      body: "Body",
      visor: "Visor",
      backpack: "Pack",
      hat: "Hat",
      trail: "Trail"
    };
    this.cosmetics.innerHTML = "";
    cosmeticCatalog.forEach((item) => {
      const owned = save.ownedCosmetics.includes(item.key);
      const equipped = save.equippedCosmetics[item.slot] === item.key;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cosmetic ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}`;
      button.dataset.cosmetic = item.key;
      button.disabled = equipped;
      button.setAttribute("aria-label", owned ? `Equip ${item.label}` : `Buy ${item.label}`);
      button.innerHTML = `
        <span class="swatch" style="--swatch:#${item.primary.toString(16).padStart(6, "0")}; --swatch2:#${(item.secondary ?? item.primary).toString(16).padStart(6, "0")}"></span>
        <b>${item.label}</b>
        <small>${slotLabels[item.slot]} • ${equipped ? "Equipped" : owned ? "Owned" : `${item.cost} coins`}</small>
      `;
      this.cosmetics.append(button);
    });
  }

  private renderLevelMap(save: SaveData): void {
    this.levelMap.innerHTML = "";
    const maxLevel = Math.max(20, save.currentLevel + 3);
    for (let levelNumber = 1; levelNumber <= maxLevel; levelNumber += 1) {
      const level = getLevel(levelNumber);
      const unlocked = levelNumber <= save.currentLevel;
      const stars = save.levelStars[String(levelNumber)] ?? 0;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `level-node ${level.kind} ${unlocked ? "unlocked" : "locked"}`;
      button.dataset.levelSelect = String(levelNumber);
      button.disabled = !unlocked;
      button.setAttribute("aria-label", unlocked ? `Play level ${levelNumber}` : `Level ${levelNumber} locked`);
      button.innerHTML = `
        <span>${levelNumber}</span>
        <b>${level.kind === "boss" ? "Boss" : level.kind === "bonus" ? "Bonus" : level.kind === "challenge" ? "Hard" : "Run"}</b>
        <small>${unlocked ? "★".repeat(stars).padEnd(3, "☆") : "Locked"}</small>
      `;
      this.levelMap.append(button);
    }
  }

  private hidePanels(): void {
    [this.title, this.reward, this.fail, this.pause, this.shop, this.map, this.base].forEach((panel) => panel.classList.add("is-hidden"));
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
    const duration = 560;
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

  private required<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing element ${selector}`);
    }
    return element;
  }
}
