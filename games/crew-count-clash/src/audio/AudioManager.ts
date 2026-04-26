export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private loopTimer = 0;
  private musicMode: "run" | "boss" | "roulette" | "shop" = "run";

  constructor(initialMuted: boolean) {
    this.muted = initialMuted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.58;
      this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.13;
      this.musicGain.connect(this.master);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.58;
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic(mode: "run" | "boss" | "roulette" | "shop" = "run"): void {
    this.musicMode = mode;
    if (!this.context || !this.musicGain || this.loopTimer) {
      return;
    }
    const play = () => {
      if (!this.context || !this.musicGain) {
        return;
      }
      const notesByMode = {
        run: [261.63, 329.63, 392, 493.88, 392, 329.63],
        boss: [130.81, 174.61, 196, 233.08, 196, 174.61],
        roulette: [392, 523.25, 659.25, 783.99, 659.25, 523.25],
        shop: [220, 277.18, 329.63, 369.99, 329.63, 277.18]
      };
      const notes = notesByMode[this.musicMode];
      const index = Math.floor(this.context.currentTime * 2) % notes.length;
      this.tone(notes[index], 0.09, "triangle", 0.08, this.musicGain);
      if (this.musicMode === "boss") {
        this.tone(notes[index] * 0.5, 0.12, "sawtooth", 0.035, this.musicGain, 0.02);
      }
    };
    play();
    this.loopTimer = window.setInterval(play, 420);
  }

  switchMusic(mode: "run" | "boss" | "roulette" | "shop"): void {
    this.musicMode = mode;
    this.startMusic(mode);
  }

  stopMusic(): void {
    if (this.loopTimer) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = 0;
    }
  }

  gate(good: boolean): void {
    const base = good ? 560 : 180;
    this.tone(base, 0.06, "sine", 0.18);
    this.tone(good ? base * 1.5 : base * 0.7, 0.08, "triangle", 0.1, undefined, 0.04);
  }

  collect(): void {
    this.tone(720, 0.045, "sine", 0.14);
    this.tone(960, 0.045, "triangle", 0.07, undefined, 0.025);
  }

  coin(): void {
    this.tone(950, 0.04, "sine", 0.12);
    this.tone(1280, 0.04, "sine", 0.08, undefined, 0.03);
  }

  hit(): void {
    this.tone(120, 0.11, "sawtooth", 0.2);
    this.noise(0.1, 0.2);
  }

  battle(): void {
    this.tone(220, 0.07, "square", 0.14);
    this.noise(0.08, 0.16);
    this.tone(330, 0.08, "triangle", 0.1, undefined, 0.06);
  }

  stomp(): void {
    this.tone(90, 0.16, "sawtooth", 0.24);
    this.noise(0.16, 0.22);
  }

  reward(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone(frequency, 0.12, "triangle", 0.14, undefined, index * 0.07);
    });
  }

  rouletteTick(): void {
    this.tone(760, 0.03, "square", 0.08);
  }

  fail(): void {
    this.tone(170, 0.18, "sawtooth", 0.24);
    this.tone(90, 0.24, "triangle", 0.16, undefined, 0.08);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    destination = this.master,
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
    if (!this.context || !this.master) {
      return;
    }
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }
}
