import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppConfig, ButtonMap, KeyboardMap } from '../types';

const DEFAULT_BUTTON_MAP: ButtonMap = {
  expr1: 0, expr2: 1, expr3: 2, expr4: 3, expr5: 4,
  toggleFloat: 5,
  toggleLipSync: 8,
  resetHold: 6,
  openSettings: 9,
  prevCharacter: 12, nextCharacter: 13,
  prevCostume: 14, nextCostume: 15,
  resetExpression: 7,
};

const DEFAULT_KEYBOARD_MAP: KeyboardMap = {
  moveLeft: 'ArrowLeft', moveRight: 'ArrowRight',
  moveUp: 'ArrowUp', moveDown: 'ArrowDown',
  expr1: 'Digit1', expr2: 'Digit2', expr3: 'Digit3', expr4: 'Digit4', expr5: 'Digit5',
  toggleFloat: 'KeyQ', toggleLipSync: 'KeyE',
  resetHold: 'KeyR', openSettings: 'KeyF',
  prevCostume: 'BracketLeft', nextCostume: 'BracketRight',
  prevCharacter: 'Comma', nextCharacter: 'Period',
  resetExpression: 'Backquote',
  scaleUp: 'Equal',
  scaleDown: 'Minus',
};

const DEFAULT_CONFIG: AppConfig = {
  window: { width: 1920, height: 1080, alwaysOnTop: true },
  gamepad: { deadzone: 0.15, moveSpeed: 5.0, scaleSpeed: 0.01, gamepadIndex: -1 },
  animation: {
    float: {
      enabled: true,
      vertical: { amplitude: 8, period: 3.0 },
      horizontal: { amplitude: 4, period: 4.5 },
    },
  },
  lipsync: { enabled: true, micDeviceId: 'default', threshold: 0.05, closeDelay: 80, useMouthClosed: false },
  buttonMap: { ...DEFAULT_BUTTON_MAP },
  keyboardMap: { ...DEFAULT_KEYBOARD_MAP },
  characters: [],
};

function deepMerge(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...override,
    window: { ...base.window, ...(override.window ?? {}) },
    gamepad: { ...base.gamepad, ...(override.gamepad ?? {}) },
    animation: {
      float: {
        ...base.animation.float,
        ...(override.animation?.float ?? {}),
        vertical: {
          ...base.animation.float.vertical,
          ...(override.animation?.float?.vertical ?? {}),
        },
        horizontal: {
          ...base.animation.float.horizontal,
          ...(override.animation?.float?.horizontal ?? {}),
        },
      },
    },
    lipsync: { ...base.lipsync, ...(override.lipsync ?? {}) },
    buttonMap: { ...base.buttonMap, ...(override.buttonMap ?? {}) },
    keyboardMap: { ...base.keyboardMap, ...(override.keyboardMap ?? {}) },
    characters: override.characters ?? base.characters,
    lastState: override.lastState ?? base.lastState,
  };
}

export class ConfigManager {
  private configPath: string;
  private appRoot: string;
  private config: AppConfig;

  constructor() {
    this.appRoot = app.getAppPath();
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.config = this.load();
  }

  private load(): AppConfig {
    // Prefer userData config
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return deepMerge(DEFAULT_CONFIG, JSON.parse(raw) as Partial<AppConfig>);
      } catch (e) {
        console.error('Failed to load user config:', e);
      }
    }

    // Fall back to bundled config.json
    const rootConfig = path.join(this.appRoot, 'config.json');
    if (fs.existsSync(rootConfig)) {
      try {
        const raw = fs.readFileSync(rootConfig, 'utf-8');
        const merged = deepMerge(DEFAULT_CONFIG, JSON.parse(raw) as Partial<AppConfig>);
        this.writeFile(merged);
        return merged;
      } catch (e) {
        console.error('Failed to load root config:', e);
      }
    }

    return { ...DEFAULT_CONFIG };
  }

  private writeFile(config: AppConfig): void {
    try {
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write config:', e);
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  saveConfig(config: AppConfig): void {
    this.config = config;
    this.writeFile(config);
  }

  getAppRoot(): string {
    return this.appRoot;
  }
}
