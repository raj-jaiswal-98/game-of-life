/**
 * Web Audio Generative Synthesizer for Conway's Game of Life
 *
 * Maps cellular automata events to harmonic audio:
 * - Cell births/deaths trigger soft ambient pentatonic chimes
 * - Population density and oscillator activity modulate an ambient polyphonic drone
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private enabled: boolean = false;
  private lastTriggerTime: number = 0;

  // C major pentatonic scale frequencies (Hz) across two octaves
  private static readonly PENTATONIC: number[] = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
  ];

  constructor() {
    // Read persisted setting
    const saved = localStorage.getItem('gol_sound_enabled');
    this.enabled = saved === 'true';
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enable: boolean): boolean {
    this.enabled = enable;
    localStorage.setItem('gol_sound_enabled', String(enable));

    if (enable) {
      this.initAudio();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.startDrone();
    } else {
      this.stopDrone();
    }
    return this.enabled;
  }

  public toggle(): boolean {
    return this.setEnabled(!this.enabled);
  }

  private initAudio(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported in this browser.', e);
    }
  }

  private startDrone(): void {
    if (!this.ctx || !this.masterGain || this.droneOsc1) return;

    try {
      const now = this.ctx.currentTime;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.04, now + 2);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);

      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(130.81, now); // C3

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.setValueAtTime(196.00, now); // G3 (fifth)

      this.droneOsc1.connect(this.droneGain);
      this.droneOsc2.connect(this.droneGain);
      this.droneGain.connect(filter);
      filter.connect(this.masterGain);

      this.droneOsc1.start();
      this.droneOsc2.start();
    } catch {
      // Ignored
    }
  }

  private stopDrone(): void {
    if (this.droneOsc1 && this.ctx && this.droneGain) {
      try {
        const now = this.ctx.currentTime;
        this.droneGain.gain.cancelScheduledValues(now);
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        setTimeout(() => {
          this.droneOsc1?.stop();
          this.droneOsc2?.stop();
          this.droneOsc1?.disconnect();
          this.droneOsc2?.disconnect();
          this.droneOsc1 = null;
          this.droneOsc2 = null;
        }, 500);
      } catch {
        this.droneOsc1 = null;
        this.droneOsc2 = null;
      }
    }
  }

  /**
   * Called on every generation step or cell paint event
   * @param population Total live cells
   * @param births Estimated newly born cells or activity delta
   * @param fps Current simulation speed
   */
  public onStep(population: number, births: number, fps = 30): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;

    const now = performance.now();
    // Throttle chimes to prevent audio saturation at high FPS (> 40 ticks/sec)
    const minInterval = Math.max(40, 1000 / Math.min(fps, 35));
    if (now - this.lastTriggerTime < minInterval) return;
    this.lastTriggerTime = now;

    if (births > 0) {
      this.playChime(births, population);
    }
  }

  private playChime(births: number, population: number): void {
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // Select note based on hash of population & births
      const noteIndex = (population + births * 7) % SoundEngine.PENTATONIC.length;
      const freq = SoundEngine.PENTATONIC[noteIndex];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = noteIndex % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Lowpass filter for smooth warmth
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3, now);

      const amp = Math.min(0.12, 0.02 + Math.log10(Math.max(1, births)) * 0.03);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // Audio node failure fallback
    }
  }
}

export const soundEngine = new SoundEngine();
