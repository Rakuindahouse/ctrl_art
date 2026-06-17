import { pathToFileURL } from 'url';
import * as path from 'path';

export class ImageLoader {
  private cache: Map<string, HTMLImageElement> = new Map();
  private appRoot: string;

  constructor(appRoot: string) {
    this.appRoot = appRoot;
  }

  private toFileUrl(relativePath: string): string {
    if (relativePath.startsWith('file://') || relativePath.startsWith('http')) {
      return relativePath;
    }
    const abs = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(this.appRoot, relativePath);
    return pathToFileURL(abs).href;
  }

  async loadImage(relativePath: string): Promise<HTMLImageElement | null> {
    if (!relativePath) return null;
    if (this.cache.has(relativePath)) return this.cache.get(relativePath)!;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(relativePath, img);
        resolve(img);
      };
      img.onerror = () => {
        // Silently skip missing images
        resolve(null);
      };
      img.src = this.toFileUrl(relativePath);
    });
  }

  async preloadAll(paths: string[]): Promise<void> {
    await Promise.all(paths.filter(Boolean).map((p) => this.loadImage(p)));
  }

  getImage(relativePath: string): HTMLImageElement | null {
    return this.cache.get(relativePath) ?? null;
  }
}
