export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private musicTimer = 0;

  constructor(initialMuted: boolean) {
    this.muted = initialMuted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.context.destination);

      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.14;
      this.musicGain.connect(this.master);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.55;
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic(): void {
    if (!this.context || !this.musicGain || this.musicTimer) {
      return;
    }
    const playNote = () => {
      if (!this.context || !this.musicGain) {
        return;
      }
      const notes = [261.63, 329.63, 392, 523.25, 392, 329.63];
      const note = notes[Math.floor((this.context.currentTime * 2) % notes.length)];
      this.tone(note, 0.08, "triangle", 0.08, this.musicGain);
    };
    playNote();
    this.musicTimer = window.setInterval(playNote, 420);
  }

  stopMusic(): void {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = 0;
    }
  }

  collect(kind = "pancake"): void {
    const base = kind === "pancake" ? 520 : 700;
    this.tone(base, 0.055, "sine", 0.18);
    this.tone(base * 1.5, 0.05, "triangle", 0.08, undefined, 0.025);
  }

  hit(): void {
    this.tone(130, 0.12, "sawtooth", 0.22);
    this.noise(0.12, 0.22);
  }

  fail(): void {
    this.tone(180, 0.16, "sawtooth", 0.24);
    this.tone(95, 0.24, "triangle", 0.18, undefined, 0.08);
  }

  chomp(): void {
    this.tone(115, 0.08, "square", 0.12);
    this.noise(0.05, 0.18);
  }

  reward(): void {
    [520, 660, 784, 1046].forEach((freq, index) => {
      this.tone(freq, 0.12, "triangle", 0.14, undefined, index * 0.07);
    });
  }

  coin(): void {
    this.tone(900, 0.04, "sine", 0.12);
    this.tone(1200, 0.04, "sine", 0.08, undefined, 0.03);
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
    gain.gain.setValueAtTime(0, now);
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
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
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
