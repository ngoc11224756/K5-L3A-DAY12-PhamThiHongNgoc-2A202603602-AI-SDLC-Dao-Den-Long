/**
 * Browser-only procedural Web Audio synthesizer.
 * Never imported by src/core/ or headless mode.
 */
export class SoundEffects {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined' && 'AudioContext' in window) {
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playPickup(carried: number): void {
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = pentatonic[(carried - 1) % pentatonic.length] ?? 659.25;
    this.tone(freq, 0.18, 'sine', 0.12, freq * 1.12);
  }

  playDeposit(): void {
    this.tone(392.0, 0.16, 'triangle', 0.13, 523.25);
  }

  playLanternLit(): void {
    this.tone(523.25, 0.45, 'triangle', 0.14);
    setTimeout(() => this.tone(659.25, 0.45, 'triangle', 0.13), 90);
    setTimeout(() => this.tone(783.99, 0.6, 'sine', 0.14), 180);
  }

  playPulse(): void {
    this.tone(320, 0.35, 'sine', 0.18, 880);
    this.tone(180, 0.4, 'triangle', 0.12, 90);
  }

  playHit(): void {
    this.tone(150, 0.25, 'sawtooth', 0.12, 65);
  }

  playWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.55, 'sine', 0.13), idx * 110);
    });
  }

  playLose(): void {
    [330, 293.66, 220].forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.45, 'triangle', 0.12), idx * 160);
    });
  }
}
