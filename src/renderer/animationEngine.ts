import { AnimationConfig } from '../types';

export class AnimationEngine {
  private config: AnimationConfig;
  private enabled: boolean;
  private startTime: number;

  constructor(config: AnimationConfig, enabled: boolean) {
    this.config = config;
    this.enabled = enabled;
    this.startTime = performance.now();
  }

  updateConfig(config: AnimationConfig): void { this.config = config; }
  setEnabled(v: boolean): void { this.enabled = v; }
  toggle(): void { this.enabled = !this.enabled; }
  isEnabled(): boolean { return this.enabled; }

  getOffset(timestamp: number): { x: number; y: number } {
    if (!this.enabled || !this.config.float.enabled) return { x: 0, y: 0 };

    const t = (timestamp - this.startTime) / 1000;
    const v = this.config.float.vertical;
    const h = this.config.float.horizontal;

    return {
      x: Math.sin((2 * Math.PI * t) / h.period + Math.PI / 3) * h.amplitude,
      y: Math.sin((2 * Math.PI * t) / v.period) * v.amplitude,
    };
  }
}
