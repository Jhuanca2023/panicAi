// Feed de demostración: simula un ciclo de pánico (reposo → subida → pánico →
// bajada → reposo) con curvas ease-in/out, emitiendo una muestra por segundo.
import type { HeartRateProvider, HeartRateSample, HeartRateStatus, MockPhase } from './types';

const INTERVAL_MS     = 1000;
const RESTING_BPM     = 70;
const PANIC_BPM       = 148;
const RISE_MS         = 25_000;
const HOLD_PANIC_MS   = 60_000;
const FALL_MS         = 50_000;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, t: number)    { return a + (b - a) * t; }
function jitter(v: number)                        { return (Math.random() * 2 - 1) * v; }

export class MockHeartRateProvider implements HeartRateProvider {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sampleCbs:  Set<(s: HeartRateSample) => void>    = new Set();
  private statusCbs:  Set<(s: HeartRateStatus) => void>    = new Set();

  private phase: MockPhase = 'resting';
  private phaseStart       = 0;
  private currentBpm       = RESTING_BPM;

  async start(): Promise<void> {
    this.phase      = 'resting';
    this.currentBpm = RESTING_BPM;
    this.emit('active');
    this.intervalId = setInterval(() => this.tick(), INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.emit('idle');
  }

  /** Dispara la simulación de un ataque de pánico desde el estado de reposo. */
  triggerPanic(): void {
    if (this.phase === 'resting') {
      this.phase      = 'rising';
      this.phaseStart = Date.now();
    }
  }

  onSample(cb: (s: HeartRateSample) => void): () => void {
    this.sampleCbs.add(cb);
    return () => this.sampleCbs.delete(cb);
  }

  onStatus(cb: (s: HeartRateStatus) => void): () => void {
    this.statusCbs.add(cb);
    return () => this.statusCbs.delete(cb);
  }

  private emit(s: HeartRateStatus) { this.statusCbs.forEach(cb => cb(s)); }

  private tick(): void {
    const now     = Date.now();
    const elapsed = now - this.phaseStart;
    let target    = RESTING_BPM;
    let variance  = 3;

    switch (this.phase) {
      case 'resting':
        target   = RESTING_BPM;
        variance = 3;
        break;

      case 'rising': {
        const t  = clamp(elapsed / RISE_MS, 0, 1);
        target   = lerp(RESTING_BPM, PANIC_BPM, t * t);   // ease-in
        variance = lerp(3, 12, t);
        if (t >= 1) { this.phase = 'panic'; this.phaseStart = now; }
        break;
      }

      case 'panic':
        target   = PANIC_BPM;
        variance = 12;
        if (elapsed >= HOLD_PANIC_MS) { this.phase = 'falling'; this.phaseStart = now; }
        break;

      case 'falling': {
        const t  = clamp(elapsed / FALL_MS, 0, 1);
        const t2 = 1 - (1 - t) * (1 - t);                 // ease-out
        target   = lerp(PANIC_BPM, RESTING_BPM, t2);
        variance = lerp(12, 3, t);
        if (t >= 1) { this.phase = 'resting'; this.phaseStart = now; }
        break;
      }
    }

    // Inercia: suaviza hacia el target para evitar saltos bruscos
    this.currentBpm += (target - this.currentBpm) * 0.3 + jitter(variance);
    this.currentBpm  = clamp(this.currentBpm, 40, 200);

    const sample: HeartRateSample = { bpm: Math.round(this.currentBpm), timestamp: now };
    this.sampleCbs.forEach(cb => cb(sample));
  }
}
