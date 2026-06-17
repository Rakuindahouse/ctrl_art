import { LipSyncConfig } from '../types';

export class LipSyncEngine {
  private config: LipSyncConfig;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private mouthOpen = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private rms = 0;
  private active = false;

  constructor(config: LipSyncConfig) {
    this.config = config;
  }

  updateConfig(config: LipSyncConfig): void {
    const wasEnabled = this.config.enabled;
    this.config = config;
    if (!config.enabled && wasEnabled) this.stop();
  }

  async start(deviceId?: string): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;
      this.audioCtx.createMediaStreamSource(stream).connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      this.active = true;
    } catch {
      this.active = false;
    }
  }

  stop(): void {
    this.audioCtx?.close();
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = new Uint8Array(0) as Uint8Array<ArrayBuffer>;
    this.active = false;
    this.mouthOpen = false;
    this.rms = 0;
  }

  // Call once per frame
  update(): void {
    if (!this.analyser || !this.active) return;
    this.analyser.getByteTimeDomainData(this.dataArray);

    let sumSq = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      sumSq += v * v;
    }
    this.rms = Math.sqrt(sumSq / this.dataArray.length);

    if (this.rms > this.config.threshold) {
      if (this.closeTimer !== null) { clearTimeout(this.closeTimer); this.closeTimer = null; }
      this.mouthOpen = true;
    } else if (this.mouthOpen && this.closeTimer === null) {
      this.closeTimer = setTimeout(() => {
        this.mouthOpen = false;
        this.closeTimer = null;
      }, this.config.closeDelay);
    }
  }

  isMouthOpen(): boolean { return this.mouthOpen; }
  getRms(): number { return this.rms; }
  isActive(): boolean { return this.active; }
}
