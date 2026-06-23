import { ipcRenderer } from 'electron';
import { AppConfig } from '../types';
import { ImageLoader } from './imageLoader';
import { CharacterManager } from './characterManager';
import { GamepadManager, GamepadActions } from './gamepadManager';
import { KeyboardManager } from './keyboardManager';
import { AnimationEngine } from './animationEngine';
import { LipSyncEngine } from './lipSyncEngine';

// ---- DOM refs ----
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let statusEl: HTMLElement;
let infoEl: HTMLElement;
let gpDot: HTMLElement;
let gpText: HTMLElement;
let lipDot: HTMLElement;
let lipText: HTMLElement;

// ---- App state ----
let config: AppConfig;
let appRoot: string;

let imgLoader: ImageLoader;
let charMgr: CharacterManager;
let gamepadMgr: GamepadManager;
let keyboardMgr: KeyboardManager;
let animEng: AnimationEngine;
let lipSync: LipSyncEngine;

let pos = { x: 960, y: 540 };
let scale = { x: 1.0, y: 1.0 };

// Lip-sync overlay toggle
let lipSyncActive = true;

// 表情ロック（trueのとき表情画像を表示、falseのとき口パクモード）
let expressionLocked = false;

// Reset hold tracking
let resetHolding = false;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

// Settings open guard
let settingsOpening = false;

// Auto-save interval
let lastSave = 0;

// Gamepad indicator cache
let lastGpId = '';
let lastLipState = '';

// ---- Status toast ----
let statusTimer: ReturnType<typeof setTimeout> | null = null;
function showStatus(msg: string, ms = 2000): void {
  statusEl.textContent = msg;
  statusEl.classList.add('visible');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.classList.remove('visible');
    statusTimer = null;
  }, ms);
}

// ---- Init ----
async function init(): Promise<void> {
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  statusEl = document.getElementById('status')!;
  infoEl = document.getElementById('info')!;
  gpDot = document.getElementById('gp-dot')!;
  gpText = document.getElementById('gp-text')!;
  lipDot = document.getElementById('lip-dot')!;
  lipText = document.getElementById('lip-text')!;

  config = await ipcRenderer.invoke('get-config') as AppConfig;
  appRoot = await ipcRenderer.invoke('get-app-root') as string;

  canvas.width = config.window.width;
  canvas.height = config.window.height;

  imgLoader = new ImageLoader(appRoot);
  charMgr = new CharacterManager(config, imgLoader);
  gamepadMgr = new GamepadManager(config.gamepad.deadzone, config.gamepad.gamepadIndex ?? -1);
  gamepadMgr.updateButtonMap(config.buttonMap);
  keyboardMgr = new KeyboardManager(config.keyboardMap);
  animEng = new AnimationEngine(config.animation, config.animation.float.enabled);
  lipSync = new LipSyncEngine(config.lipsync);

  // Restore last position/scale
  if (config.lastState) {
    pos = { ...config.lastState.position };
    scale = { ...config.lastState.scale };
    animEng.setEnabled(config.lastState.floatEnabled);
    lipSyncActive = config.lastState.lipSyncEnabled ?? true;
  } else {
    const ch = charMgr.getCharacter();
    if (ch) {
      pos = { ...ch.defaultPosition };
      scale = { ...(ch.defaultScale ?? { x: 1, y: 1 }) };
    }
  }

  ipcRenderer.on('button-map-updated', (_e, bm) => {
    gamepadMgr.updateButtonMap(bm);
  });

  ipcRenderer.on('click-through-changed', (_e, enabled: boolean) => {
    showStatus(enabled ? 'クリックスルー ON（⌘⇧T で解除）' : 'クリックスルー OFF');
  });

  ipcRenderer.on('config-updated', (_e, newCfg: AppConfig) => {
    config = newCfg;
    charMgr.updateConfig(newCfg);
    gamepadMgr.setDeadzone(newCfg.gamepad.deadzone);
    gamepadMgr.setGamepadIndex(newCfg.gamepad.gamepadIndex ?? -1);
    gamepadMgr.updateButtonMap(newCfg.buttonMap);
    keyboardMgr.updateKeyboardMap(newCfg.keyboardMap);
    animEng.updateConfig(newCfg.animation);
    lipSync.updateConfig(newCfg.lipsync);

    canvas.width = newCfg.window.width;
    canvas.height = newCfg.window.height;

    charMgr.preloadAll().then(() => showStatus('設定を更新しました'));
  });

  showStatus('画像読み込み中…', 9999);
  await charMgr.preloadAll();

  await lipSync.start(config.lipsync.micDeviceId);
  if (lipSync.isActive()) showStatus('マイク接続済み');
  else showStatus('マイクなし（リップシンク無効）');

  setTimeout(() => statusEl.classList.remove('visible'), 3000);

  requestAnimationFrame(loop);
}

function reportAction(label: string, category: 'expr' | 'system'): void {
  ipcRenderer.send('input-action', label, category);
}

function getActions(): GamepadActions {
  const gpActions = gamepadMgr.poll();
  const kbActions = keyboardMgr.poll();
  // ゲームパッド接続中はゲームパッド優先、未接続時はキーボード
  return gamepadMgr.getActiveGamepad() ? gpActions : kbActions;
}

// ---- Main loop ----
function loop(ts: number): void {
  const actions = getActions();

  // Movement (left stick)
  pos.x += actions.moveX * config.gamepad.moveSpeed;
  pos.y += actions.moveY * config.gamepad.moveSpeed;

  // Scale (right stick Y) — uniform scaling to preserve aspect ratio
  const newScale = clamp(scale.x - actions.scaleY * config.gamepad.scaleSpeed, 0.1, 5);
  scale.x = newScale;
  scale.y = newScale;

  // Costume switch (D-Pad left/right)
  if (actions.prevCostume) { charMgr.prevCostume(); expressionLocked = false; const lbl = `衣装← ${charMgr.getCostume()?.id}`; showStatus(lbl); reportAction(lbl, 'system'); }
  if (actions.nextCostume) { charMgr.nextCostume(); expressionLocked = false; const lbl = `衣装→ ${charMgr.getCostume()?.id}`; showStatus(lbl); reportAction(lbl, 'system'); }

  // Character switch (D-Pad up/down)
  if (actions.prevCharacter || actions.nextCharacter) {
    if (actions.prevCharacter) charMgr.prevCharacter();
    else charMgr.nextCharacter();
    expressionLocked = false;
    const ch = charMgr.getCharacter();
    if (ch) { pos = { ...ch.defaultPosition }; scale = { ...(ch.defaultScale ?? { x: 1, y: 1 }) }; }
    const lbl = `キャラ: ${ch?.name ?? '?'}`;
    showStatus(lbl);
    reportAction(lbl, 'system');
  }

  // 表情キー → 表情ロックモードへ
  if (actions.expression !== null) {
    charMgr.setExpression(actions.expression);
    expressionLocked = true;
    const lbl = `表情 ${actions.expression + 1}`;
    showStatus(lbl);
    reportAction(lbl, 'expr');
  }

  // 口パクモードに戻る
  if (actions.resetExpression) {
    expressionLocked = false;
    showStatus('口パクモード');
    reportAction('口パクリセット', 'system');
  }

  // Float toggle (R1/RB)
  if (actions.toggleFloat) {
    animEng.toggle();
    const lbl = `フワフワ: ${animEng.isEnabled() ? 'ON' : 'OFF'}`;
    showStatus(lbl);
    reportAction(lbl, 'system');
  }

  // Lip-sync toggle
  if (actions.toggleLipSync) {
    lipSyncActive = !lipSyncActive;
    const lbl = `口パク: ${lipSyncActive ? 'ON' : 'OFF'}`;
    showStatus(lbl);
    reportAction(lbl, 'system');
  }

  // Position reset (L2/LT long hold ~800ms)
  if (actions.resetHeld) {
    if (!resetHolding) {
      resetHolding = true;
      resetTimer = setTimeout(() => {
        const ch = charMgr.getCharacter();
        if (ch) { pos = { ...ch.defaultPosition }; scale = { ...(ch.defaultScale ?? { x: 1, y: 1 }) }; }
        showStatus('位置リセット');
        reportAction('位置リセット', 'system');
        resetHolding = false;
        resetTimer = null;
      }, 800);
    }
  } else {
    if (resetTimer !== null) { clearTimeout(resetTimer); resetTimer = null; }
    resetHolding = false;
  }

  // Settings (Start/Menu)
  if (actions.openSettings && !settingsOpening) {
    settingsOpening = true;
    ipcRenderer.invoke('open-settings').finally(() => {
      settingsOpening = false;
    });
  }

  // Lip sync
  lipSync.update();

  // Float offset
  const offset = animEng.getOffset(ts);

  // Render
  render(offset);

  // Update HUD
  const activeGp = gamepadMgr.getActiveGamepad();
  const currentGpId = activeGp?.id ?? '';
  if (currentGpId !== lastGpId) {
    lastGpId = currentGpId;
    gpDot.className = activeGp ? 'dot connected' : 'dot';
    gpText.textContent = activeGp
      ? activeGp.id.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28)
      : '未接続';
  }
  const newLipState = `${lipSync.isActive()}-${lipSyncActive}`;
  if (newLipState !== lastLipState) {
    lastLipState = newLipState;
    const on = lipSync.isActive() && lipSyncActive;
    lipDot.className = on ? 'dot on' : 'dot';
    lipText.textContent = !lipSync.isActive() ? '口パク OFF（マイクなし）'
      : lipSyncActive ? '口パク ON' : '口パク OFF';
  }
  infoEl.textContent = charMgr.getStatusText();

  // Auto-save state every 5s
  if (ts - lastSave > 5000) {
    lastSave = ts;
    saveState();
  }

  requestAnimationFrame(loop);
}

// ---- Render ----
function render(offset: { x: number; y: number }): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let img: HTMLImageElement | null;

  if (expressionLocked) {
    // 表情ロックモード：選択した表情画像をそのまま表示
    img = charMgr.getCurrentImage();
  } else {
    // 口パクモード：マイク入力で口開け/口閉じ画像を切り替え
    const mouthOpen = charMgr.getMouthOpenImage();
    const mouthClosed = charMgr.getMouthClosedImage();
    if (lipSyncActive && lipSync.isMouthOpen()) {
      img = mouthOpen ?? mouthClosed ?? charMgr.getCurrentImage();
    } else {
      img = mouthClosed ?? mouthOpen ?? charMgr.getCurrentImage();
    }
  }

  if (!img) {
    drawPlaceholder();
    return;
  }

  const dx = pos.x + offset.x;
  const dy = pos.y + offset.y;
  const w = img.naturalWidth * scale.x;
  const h = img.naturalHeight * scale.y;

  ctx.save();
  ctx.translate(dx, dy);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawPlaceholder(): void {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = 'rgba(100, 149, 237, 0.5)';
  ctx.strokeStyle = 'rgba(100, 149, 237, 0.9)';
  ctx.lineWidth = 2;
  const w = 300 * scale.x;
  const h = 500 * scale.y;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  ctx.fillStyle = 'white';
  ctx.font = '20px "Segoe UI"';
  ctx.textAlign = 'center';
  ctx.fillText('立ち絵なし', 0, 0);
  ctx.font = '14px "Segoe UI"';
  ctx.fillText('config.json に画像パスを設定', 0, 30);
  ctx.restore();
}

// ---- Save state ----
function saveState(): void {
  const updated: AppConfig = {
    ...config,
    lastState: {
      characterIndex: charMgr.characterIndex,
      costumeIndex: charMgr.costumeIndex,
      expressionIndex: charMgr.expressionIndex,
      position: { ...pos },
      scale: { ...scale },
      floatEnabled: animEng.isEnabled(),
      lipSyncEnabled: lipSyncActive,
    },
  };
  ipcRenderer.invoke('save-state', updated).catch(() => {});
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  init().catch((e) => {
    console.error('Init failed:', e);
  });
});
