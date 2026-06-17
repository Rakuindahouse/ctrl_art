import { AppConfig, CharacterConfig, CostumeConfig, MouthPosition } from '../types';
import { ImageLoader } from './imageLoader';

export class CharacterManager {
  private config: AppConfig;
  private loader: ImageLoader;

  characterIndex = 0;
  costumeIndex = 0;
  expressionIndex = 0;

  constructor(config: AppConfig, loader: ImageLoader) {
    this.config = config;
    this.loader = loader;
    if (config.lastState) {
      this.characterIndex = config.lastState.characterIndex;
      this.costumeIndex = config.lastState.costumeIndex;
      this.expressionIndex = config.lastState.expressionIndex;
    }
    this.clamp();
  }

  private clamp(): void {
    const charCount = this.config.characters.length;
    if (charCount === 0) return;
    this.characterIndex = Math.min(this.characterIndex, charCount - 1);
    const char = this.getCharacter();
    if (!char) return;
    this.costumeIndex = Math.min(this.costumeIndex, char.costumes.length - 1);
    const costume = this.getCostume();
    if (!costume) return;
    this.expressionIndex = Math.min(this.expressionIndex, costume.expressions.length - 1);
  }

  updateConfig(config: AppConfig): void {
    this.config = config;
    this.clamp();
  }

  getCharacter(): CharacterConfig | null {
    return this.config.characters[this.characterIndex] ?? null;
  }

  getCostume(): CostumeConfig | null {
    return this.getCharacter()?.costumes[this.costumeIndex] ?? null;
  }

  getCurrentImage(): HTMLImageElement | null {
    const path = this.getCostume()?.expressions[this.expressionIndex];
    return path ? this.loader.getImage(path) : null;
  }

  getMouthOpenImage(): HTMLImageElement | null {
    const p = this.getCostume()?.mouthOpenPath;
    return p ? this.loader.getImage(p) : null;
  }

  getMouthClosedImage(): HTMLImageElement | null {
    const p = this.getCostume()?.mouthClosedPath;
    return p ? this.loader.getImage(p) : null;
  }

  getMouthPosition(): MouthPosition | null {
    return this.getCostume()?.mouthPosition ?? null;
  }

  nextCharacter(): void {
    const n = this.config.characters.length;
    if (n === 0) return;
    this.characterIndex = (this.characterIndex + 1) % n;
    this.costumeIndex = 0;
    this.expressionIndex = 0;
  }

  prevCharacter(): void {
    const n = this.config.characters.length;
    if (n === 0) return;
    this.characterIndex = (this.characterIndex - 1 + n) % n;
    this.costumeIndex = 0;
    this.expressionIndex = 0;
  }

  nextCostume(): void {
    const char = this.getCharacter();
    if (!char) return;
    this.costumeIndex = (this.costumeIndex + 1) % char.costumes.length;
    this.expressionIndex = 0;
  }

  prevCostume(): void {
    const char = this.getCharacter();
    if (!char) return;
    const n = char.costumes.length;
    this.costumeIndex = (this.costumeIndex - 1 + n) % n;
    this.expressionIndex = 0;
  }

  setExpression(index: number): void {
    const costume = this.getCostume();
    if (!costume) return;
    if (index >= 0 && index < costume.expressions.length) {
      this.expressionIndex = index;
    }
  }

  async preloadAll(): Promise<void> {
    const paths: string[] = [];
    for (const char of this.config.characters) {
      for (const costume of char.costumes) {
        paths.push(...costume.expressions);
        if (costume.mouthOpenPath) paths.push(costume.mouthOpenPath);
        if (costume.mouthClosedPath) paths.push(costume.mouthClosedPath);
      }
    }
    await this.loader.preloadAll(paths);
  }

  getStatusText(): string {
    const char = this.getCharacter();
    const costume = this.getCostume();
    if (!char) return 'キャラなし';
    return `${char.name} / ${costume?.id ?? '-'} / 表情${this.expressionIndex + 1}`;
  }
}
