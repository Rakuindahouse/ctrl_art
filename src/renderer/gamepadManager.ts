import { ButtonMap } from '../types';

const DEFAULT_BUTTON_MAP: ButtonMap = {
  expr1: 0, expr2: 1, expr3: 2, expr4: 3, expr5: 4,
  toggleFloat: 5,
  toggleLipSync: 8,
  resetHold: 6,
  openSettings: 9,
  prevCharacter: 12, nextCharacter: 13,
  prevCostume: 14, nextCostume: 15,
};

export interface GamepadActions {
  moveX: number;
  moveY: number;
  scaleX: number;
  scaleY: number;
  nextCostume: boolean;
  prevCostume: boolean;
  nextCharacter: boolean;
  prevCharacter: boolean;
  expression: number | null;
  toggleFloat: boolean;
  toggleLipSync: boolean;
  resetHeld: boolean;
  openSettings: boolean;
}

export class GamepadManager {
  private deadzone: number;
  private gamepadIndex: number;
  private bm: ButtonMap;
  private prevButtons: boolean[] = [];

  constructor(deadzone = 0.15, gamepadIndex = -1) {
    this.deadzone = deadzone;
    this.gamepadIndex = gamepadIndex;
    this.bm = { ...DEFAULT_BUTTON_MAP };
  }

  setDeadzone(v: number): void { this.deadzone = v; }
  setGamepadIndex(idx: number): void { this.gamepadIndex = idx; this.prevButtons = []; }
  updateButtonMap(bm: ButtonMap): void { this.bm = { ...DEFAULT_BUTTON_MAP, ...bm }; }

  private getGamepad(): Gamepad | null {
    const pads = navigator.getGamepads();
    if (this.gamepadIndex >= 0) return pads[this.gamepadIndex] ?? null;
    return pads.find(g => g !== null) ?? null;
  }

  private applyDeadzone(v: number): number {
    if (Math.abs(v) < this.deadzone) return 0;
    const sign = v > 0 ? 1 : -1;
    return sign * (Math.abs(v) - this.deadzone) / (1 - this.deadzone);
  }

  private justPressed(buttons: readonly GamepadButton[], idx: number): boolean {
    const cur = buttons[idx]?.pressed ?? false;
    const prev = this.prevButtons[idx] ?? false;
    return cur && !prev;
  }

  poll(): GamepadActions {
    const gp = this.getGamepad();

    const none: GamepadActions = {
      moveX: 0, moveY: 0, scaleX: 0, scaleY: 0,
      nextCostume: false, prevCostume: false,
      nextCharacter: false, prevCharacter: false,
      expression: null, toggleFloat: false, toggleLipSync: false,
      resetHeld: false, openSettings: false,
    };

    if (!gp) {
      this.prevButtons = [];
      return none;
    }

    const { buttons, axes } = gp;
    const bm = this.bm;
    const actions: GamepadActions = { ...none };

    actions.moveX = this.applyDeadzone(axes[0] ?? 0);
    actions.moveY = this.applyDeadzone(axes[1] ?? 0);
    actions.scaleX = this.applyDeadzone(axes[2] ?? 0);
    actions.scaleY = this.applyDeadzone(axes[3] ?? 0);

    const exprBtns = [bm.expr1, bm.expr2, bm.expr3, bm.expr4, bm.expr5];
    for (let i = 0; i < exprBtns.length; i++) {
      if (this.justPressed(buttons, exprBtns[i])) actions.expression = i;
    }

    if (this.justPressed(buttons, bm.toggleFloat)) actions.toggleFloat = true;
    if (this.justPressed(buttons, bm.toggleLipSync)) actions.toggleLipSync = true;
    actions.resetHeld = (buttons[bm.resetHold]?.value ?? 0) > 0.8;
    if (this.justPressed(buttons, bm.openSettings)) actions.openSettings = true;
    if (this.justPressed(buttons, bm.prevCostume)) actions.prevCostume = true;
    if (this.justPressed(buttons, bm.nextCostume)) actions.nextCostume = true;
    if (this.justPressed(buttons, bm.prevCharacter)) actions.prevCharacter = true;
    if (this.justPressed(buttons, bm.nextCharacter)) actions.nextCharacter = true;

    this.prevButtons = Array.from({ length: buttons.length }, (_, i) => buttons[i]?.pressed ?? false);
    return actions;
  }

  isConnected(): boolean {
    return this.getGamepad() !== null;
  }

  getActiveGamepad(): Gamepad | null {
    return this.getGamepad();
  }

  getConnectedList(): { index: number; id: string }[] {
    return Array.from(navigator.getGamepads())
      .map((gp, i) => gp ? { index: i, id: gp.id } : null)
      .filter((x): x is { index: number; id: string } => x !== null);
  }
}
