import { KeyboardMap } from '../types';
import { GamepadActions } from './gamepadManager';

export class KeyboardManager {
  private km: KeyboardMap;
  private held = new Set<string>();
  private fired = new Set<string>();

  constructor(km: KeyboardMap) {
    this.km = km;
    window.addEventListener('keydown', (e) => {
      if (!this.held.has(e.code)) this.fired.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.fired.clear();
    });
  }

  updateKeyboardMap(km: KeyboardMap): void {
    this.km = km;
  }

  poll(): GamepadActions {
    const km = this.km;
    const actions: GamepadActions = {
      moveX: 0, moveY: 0, scaleX: 0, scaleY: 0,
      nextCostume: false, prevCostume: false,
      nextCharacter: false, prevCharacter: false,
      expression: null,
      toggleFloat: false, toggleLipSync: false,
      resetHeld: false, openSettings: false, resetExpression: false,
    };

    if (this.held.has(km.moveLeft))  actions.moveX = -1;
    if (this.held.has(km.moveRight)) actions.moveX = 1;
    if (this.held.has(km.moveUp))    actions.moveY = -1;
    if (this.held.has(km.moveDown))  actions.moveY = 1;
    if (this.held.has(km.scaleUp))   actions.scaleY = -0.3;
    if (this.held.has(km.scaleDown)) actions.scaleY = 0.3;
    actions.resetHeld = this.held.has(km.resetHold);

    const exprKeys = [km.expr1, km.expr2, km.expr3, km.expr4, km.expr5];
    for (let i = 0; i < exprKeys.length; i++) {
      if (this.fired.has(exprKeys[i])) { actions.expression = i; break; }
    }
    if (this.fired.has(km.toggleFloat))   actions.toggleFloat = true;
    if (this.fired.has(km.toggleLipSync)) actions.toggleLipSync = true;
    if (this.fired.has(km.prevCostume))   actions.prevCostume = true;
    if (this.fired.has(km.nextCostume))   actions.nextCostume = true;
    if (this.fired.has(km.prevCharacter))   actions.prevCharacter = true;
    if (this.fired.has(km.nextCharacter))   actions.nextCharacter = true;
    if (this.fired.has(km.openSettings))    actions.openSettings = true;
    if (this.fired.has(km.resetExpression)) actions.resetExpression = true;

    this.fired.clear();
    return actions;
  }
}
