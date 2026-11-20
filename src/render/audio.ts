/**
 * Browser-only procedural Web Audio synthesizer (Phase 2).
 * Includes night ambient loop + all required SFX + master volume control.
 * Never imported by src/core/ or headless mode.
 */
export class SoundEffects {
  private ctx: AudioContext | null = null;
  private ambientTimer: number | null = null;
  private ambientStep = 0;
  volume = 0.6;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0.001) return null;
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
    gainScale: number,
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
    const peak = Math.max(0.001, gainScale * this.volume);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  startAmbient(): void {
    if (this.ambientTimer !== null || typeof window === 'undefined') return;
    const notes = [220, 261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 246.94];
    this.ambientTimer = window.setInterval(() => {
      if (this.muted || this.volume <= 0.001) return;
      const f = notes[this.ambientStep % notes.length];
      this.ambientStep += 1;
      this.tone(f, 1.4, 'sine', 0.045);
    }, 1800);
  }

  stopAmbient(): void {
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  playPickup(carried: number): void {
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = pentatonic[(carried - 1) % pentatonic.length] ?? 659.25;
    this.tone(freq, 0.16, 'sine', 0.14, freq * 1.12);
  }

  playDeposit(): void {
    this.tone(392.0, 0.14, 'triangle', 0.14, 523.25);
  }

  playLanternLit(): void {
    this.tone(523.25, 0.45, 'triangle', 0.16);
    setTimeout(() => this.tone(659.25, 0.45, 'triangle', 0.15), 90);
    setTimeout(() => this.tone(783.99, 0.6, 'sine', 0.16), 180);
  }

  playPulse(): void {
    this.tone(320, 0.35, 'sine', 0.2, 880);
    this.tone(180, 0.4, 'triangle', 0.14, 90);
  }

  playJump(): void {
    this.tone(280, 0.14, 'sine', 0.12, 460);
  }

  playDash(): void {
    this.tone(520, 0.16, 'triangle', 0.15, 190);
  }

  playCharm(): void {
    this.tone(659.25, 0.25, 'sine', 0.16, 987.77);
    setTimeout(() => this.tone(987.77, 0.35, 'sine', 0.14), 100);
  }

  playHit(): void {
    this.tone(150, 0.25, 'sawtooth', 0.15, 65);
  }

  playShadeSpawn(): void {
    this.tone(110, 0.45, 'sawtooth', 0.09, 75);
  }

  playDrifterSteal(): void {
    this.tone(420, 0.22, 'triangle', 0.14, 210);
  }

  playCountdownTick(): void {
    this.tone(880, 0.09, 'square', 0.08);
  }

  playWindWarning(): void {
    this.tone(240, 0.6, 'sine', 0.1, 340);
  }

  playWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.55, 'sine', 0.15), idx * 110);
    });
  }

  playLose(): void {
    [330, 293.66, 220].forEach((f, idx) => {
      setTimeout(() => this.tone(f, 0.45, 'triangle', 0.14), idx * 160);
    });
  }
}
