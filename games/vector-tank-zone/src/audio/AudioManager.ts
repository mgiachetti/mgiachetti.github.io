export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;
  private loopTimer = 0;
  private musicMode: "menu" | "combat" | "boss" = "menu";
  private readonly compactSpeakerMix = window.matchMedia("(pointer: coarse)").matches;

  constructor(initialMuted: boolean) {
    this.muted = initialMuted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVolume();
      this.master.connect(this.context.destination);
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 7;
      compressor.connect(this.master);
      this.sfx = this.context.createGain();
      this.sfx.gain.value = this.compactSpeakerMix ? 0.68 : 0.8;
      this.sfx.connect(compressor);
      this.music = this.context.createGain();
      this.music.gain.value = this.compactSpeakerMix ? 0.055 : 0.075;
      this.music.connect(compressor);
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(compressor);
      this.engineOscillator = this.context.createOscillator();
      this.engineOscillator.type = "sawtooth";
      this.engineOscillator.frequency.value = 46;
      this.engineOscillator.connect(this.engineGain);
      this.engineOscillator.start();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : this.masterVolume();
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic(mode: "menu" | "combat" | "boss"): void {
    this.musicMode = mode;
    if (!this.context || !this.music || this.loopTimer) {
      return;
    }
    const play = () => {
      if (!this.context || !this.music) {
        return;
      }
      const sequence = {
        menu: [110, 146.83, 164.81, 220],
        combat: [82.41, 110, 146.83, 164.81],
        boss: [55, 73.42, 82.41, 110]
      }[this.musicMode];
      const index = Math.floor(this.context.currentTime * 2) % sequence.length;
      this.tone(sequence[index], 0.12, "sawtooth", 0.08, this.music);
      this.tone(sequence[index] * 2, 0.08, "triangle", 0.035, this.music, 0.04);
    };
    play();
    this.loopTimer = window.setInterval(play, 430);
  }

  switchMusic(mode: "menu" | "combat" | "boss"): void {
    this.musicMode = mode;
    this.startMusic(mode);
  }

  setEngine(throttle: number, active: boolean): void {
    if (!this.context || !this.engineGain || !this.engineOscillator) {
      return;
    }
    const now = this.context.currentTime;
    const amount = active ? Math.min(1, Math.max(0.18, Math.abs(throttle))) : 0;
    this.engineGain.gain.setTargetAtTime(amount * (this.compactSpeakerMix ? 0.032 : 0.045), now, 0.08);
    this.engineOscillator.frequency.setTargetAtTime(42 + amount * 48, now, 0.08);
  }

  stopMusic(): void {
    if (this.loopTimer) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = 0;
    }
  }

  shoot(): void {
    this.tone(95, 0.08, "sawtooth", 0.18);
    this.noise(0.06, 0.16);
  }

  enemyShoot(): void {
    this.tone(150, 0.06, "square", 0.09);
  }

  hit(): void {
    this.tone(260, 0.06, "triangle", 0.14);
    this.tone(520, 0.04, "sine", 0.08, undefined, 0.035);
  }

  explosion(strong = false): void {
    this.tone(strong ? 58 : 88, strong ? 0.22 : 0.14, "sawtooth", strong ? 0.22 : 0.16);
    this.noise(strong ? 0.22 : 0.12, strong ? 0.22 : 0.16);
  }

  reward(): void {
    [329.63, 415.3, 493.88, 659.25].forEach((frequency, index) => {
      this.tone(frequency, 0.12, "triangle", 0.12, undefined, index * 0.06);
    });
  }

  fail(): void {
    this.tone(82.41, 0.24, "sawtooth", 0.2);
    this.tone(55, 0.28, "triangle", 0.14, undefined, 0.08);
  }

  radarPing(): void {
    this.tone(1180, 0.035, "sine", 0.045);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    destination = this.sfx ?? this.master,
    delay = 0
  ): void {
    if (!this.context || !destination) {
      return;
    }
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noise(duration: number, volume: number): void {
    if (!this.context || !this.sfx) {
      return;
    }
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.sfx);
    source.start();
  }

  private masterVolume(): number {
    return this.compactSpeakerMix ? 0.38 : 0.46;
  }
}
