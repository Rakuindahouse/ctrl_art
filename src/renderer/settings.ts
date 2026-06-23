import { ipcRenderer } from 'electron';
import * as path from 'path';
import { AppConfig, ButtonMap, CharacterConfig, CostumeConfig } from '../types';

let config: AppConfig;
let appRoot: string;
let currentCharacterIdx = 0;
let currentCostumeIdx = 0;
let localButtonMap: ButtonMap;

// ---- Helpers ----
function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
function setVal(id: string, v: string | number | boolean): void {
  const e = el(id);
  if (!e) return;
  if (e instanceof HTMLInputElement) {
    if (e.type === 'checkbox') e.checked = Boolean(v);
    else e.value = String(v);
  } else if (e instanceof HTMLSelectElement) {
    e.value = String(v);
  }
}
function getVal(id: string): string {
  const e = el(id);
  if (!e) return '';
  if (e instanceof HTMLInputElement) return e.type === 'checkbox' ? (e.checked ? 'true' : 'false') : e.value;
  if (e instanceof HTMLSelectElement) return e.value;
  return '';
}
function getNum(id: string): number { return parseFloat(getVal(id)) || 0; }
function getBool(id: string): boolean { return getVal(id) === 'true'; }

// ---- Populate form ----
function populate(): void {
  const { gamepad: gp, animation: an, lipsync: ls, window: win } = config;
  setVal('deadzone', gp.deadzone);
  setVal('moveSpeed', gp.moveSpeed);
  setVal('scaleSpeed', gp.scaleSpeed);
  setVal('floatEnabled', an.float.enabled);
  setVal('vertAmp', an.float.vertical.amplitude);
  setVal('vertPeriod', an.float.vertical.period);
  setVal('horizAmp', an.float.horizontal.amplitude);
  setVal('horizPeriod', an.float.horizontal.period);
  setVal('lipsyncEnabled', ls.enabled);
  setVal('lipsyncThreshold', ls.threshold);
  setVal('closeDelay', ls.closeDelay);
  setVal('useMouthClosed', ls.useMouthClosed ?? false);
  setVal('alwaysOnTop', win.alwaysOnTop);
  setVal('winWidth', win.width);
  setVal('winHeight', win.height);
  ['deadzone','moveSpeed','scaleSpeed','vertAmp','vertPeriod',
   'horizAmp','horizPeriod','lipsyncThreshold','closeDelay'].forEach(id => {
    const disp = el(`${id}Val`);
    const inp = el<HTMLInputElement>(id);
    if (disp && inp) disp.textContent = inp.value;
  });
}

// ---- Character basic fields ----
function saveCurrentCharBasic(): void {
  const ch = config.characters[currentCharacterIdx];
  if (!ch) return;
  const posX = parseFloat((el('charPosX') as HTMLInputElement)?.value);
  const posY = parseFloat((el('charPosY') as HTMLInputElement)?.value);
  const scale = parseFloat((el('charScale') as HTMLInputElement)?.value);
  const name = (el('charName') as HTMLInputElement)?.value;
  if (name) ch.name = name;
  if (!isNaN(posX)) ch.defaultPosition.x = posX;
  if (!isNaN(posY)) ch.defaultPosition.y = posY;
  if (!isNaN(scale)) ch.defaultScale = { x: scale, y: scale };
}

function updateCharBasicFields(): void {
  const ch = config.characters[currentCharacterIdx];
  if (!ch) return;
  (el('charName') as HTMLInputElement).value = ch.name;
  (el('charPosX') as HTMLInputElement).value = String(ch.defaultPosition.x);
  (el('charPosY') as HTMLInputElement).value = String(ch.defaultPosition.y);
  (el('charScale') as HTMLInputElement).value = String(ch.defaultScale?.x ?? 1);
}

// ---- Collect and save ----
function collect(): AppConfig {
  saveCurrentCharBasic();
  return {
    ...config,
    buttonMap: { ...localButtonMap },
    window: {
      width: parseInt(getVal('winWidth')) || 1920,
      height: parseInt(getVal('winHeight')) || 1080,
      alwaysOnTop: getBool('alwaysOnTop'),
    },
    gamepad: {
      ...config.gamepad,
      deadzone: getNum('deadzone'),
      moveSpeed: getNum('moveSpeed'),
      scaleSpeed: getNum('scaleSpeed'),
      gamepadIndex: parseInt((el<HTMLSelectElement>('gamepadSelect'))?.value ?? '-1') || -1,
    },
    animation: {
      float: {
        enabled: getBool('floatEnabled'),
        vertical: { amplitude: getNum('vertAmp'), period: getNum('vertPeriod') },
        horizontal: { amplitude: getNum('horizAmp'), period: getNum('horizPeriod') },
      },
    },
    lipsync: {
      ...config.lipsync,
      enabled: getBool('lipsyncEnabled'),
      micDeviceId: getVal('micDevice') || 'default',
      threshold: getNum('lipsyncThreshold'),
      closeDelay: getNum('closeDelay'),
      useMouthClosed: getBool('useMouthClosed'),
    },
  };
}

async function save(): Promise<void> {
  const btn = el<HTMLButtonElement>('saveBtn');
  btn.disabled = true;
  btn.textContent = '保存中…';
  try {
    await ipcRenderer.invoke('save-config', collect());
    btn.textContent = '保存しました ✓';
    setTimeout(() => ipcRenderer.invoke('close-settings'), 800);
  } catch {
    btn.textContent = 'エラー';
    btn.disabled = false;
  }
}

// ---- Microphone ----
async function loadMicDevices(): Promise<void> {
  const sel = el<HTMLSelectElement>('micDevice');
  if (!sel) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    sel.innerHTML = '<option value="default">デフォルト</option>';
    devices.filter(d => d.kind === 'audioinput').forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `マイク (${d.deviceId.slice(0, 8)})`;
      sel.appendChild(opt);
    });
    sel.value = config.lipsync.micDeviceId || 'default';
  } catch {
    sel.innerHTML = '<option value="default">（取得失敗）</option>';
  }
}

function startMicIndicator(): void {
  const badge = el('micStatus');
  if (!badge) return;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const threshold = () => getNum('lipsyncThreshold');
    const tick = (): void => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const active = rms > threshold();
      badge.className = `mic-badge${active ? ' active' : ''}`;
      badge.textContent = active ? '音声検出中' : '無音';
      requestAnimationFrame(tick);
    };
    tick();
  }).catch(() => {
    badge.textContent = 'マイク取得失敗';
  });
}

// ---- Gamepad status ----
function populateGamepadList(): void {
  const sel = el<HTMLSelectElement>('gamepadSelect');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="-1">自動（最初に見つかったもの）</option>';
  Array.from(navigator.getGamepads()).forEach((gp, i) => {
    if (!gp) return;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `[${i}] ${gp.id.replace(/\(.*?\)/g, '').trim().slice(0, 45)}`;
    sel.appendChild(opt);
  });
  sel.value = prev || String(config.gamepad.gamepadIndex ?? -1);
}

function cleanGpName(id: string): string {
  return id.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 45) || id.slice(0, 45);
}

function startGpPolling(): void {
  const statusEl = el('gpStatus');
  if (!statusEl) return;
  const update = (): void => {
    const pads = Array.from(navigator.getGamepads());
    const connectedPads = pads.filter((g): g is Gamepad => g !== null);
    populateGamepadList();

    const selIdx = parseInt((el<HTMLSelectElement>('gamepadSelect'))?.value ?? '-1');
    const activePad = selIdx >= 0 ? (pads[selIdx] ?? connectedPads[0] ?? null) : (connectedPads[0] ?? null);

    if (activePad) {
      statusEl.className = 'gp-badge connected';
      statusEl.textContent = `${cleanGpName(activePad.id)} 接続中`;
    } else {
      statusEl.className = 'gp-badge';
      statusEl.textContent = 'コントローラー未接続';
    }
  };
  update();
  setInterval(update, 500);
}

// ---- Button mapping ----
const XBOX_BUTTON_NAMES: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'View', 9: 'Menu', 10: 'LS', 11: 'RS',
  12: '↑', 13: '↓', 14: '←', 15: '→', 16: 'Xbox',
};

function xboxBtnLabel(idx: number): string {
  return XBOX_BUTTON_NAMES[idx] ?? `#${idx}`;
}

const BTN_MAP_LABELS: { key: keyof ButtonMap; label: string }[] = [
  { key: 'expr1',         label: '表情1' },
  { key: 'expr2',         label: '表情2' },
  { key: 'expr3',         label: '表情3' },
  { key: 'expr4',         label: '表情4' },
  { key: 'expr5',         label: '表情5' },
  { key: 'toggleFloat',   label: 'フワフワ ON/OFF' },
  { key: 'toggleLipSync', label: '口パク ON/OFF' },
  { key: 'resetHold',     label: 'リセット長押し' },
  { key: 'openSettings',  label: '設定を開く' },
  { key: 'prevCostume',   label: '衣装←' },
  { key: 'nextCostume',   label: '衣装→' },
  { key: 'prevCharacter', label: 'キャラ↑' },
  { key: 'nextCharacter', label: 'キャラ↓' },
];

let captureKey: keyof ButtonMap | null = null;
let captureBtn: HTMLButtonElement | null = null;
let capturePollId: number | null = null;
let captureTimeoutId: number | null = null;

function cancelCapture(): void {
  if (capturePollId !== null) clearInterval(capturePollId);
  if (captureTimeoutId !== null) clearTimeout(captureTimeoutId);
  if (captureBtn) {
    captureBtn.classList.remove('listening');
    if (captureKey !== null) captureBtn.textContent = xboxBtnLabel(localButtonMap[captureKey]);
  }
  captureKey = null;
  captureBtn = null;
  capturePollId = null;
  captureTimeoutId = null;
}

function startCapture(key: keyof ButtonMap, btn: HTMLButtonElement): void {
  cancelCapture();
  captureKey = key;
  captureBtn = btn;
  btn.textContent = '押して...';
  btn.classList.add('listening');

  capturePollId = window.setInterval(() => {
    const pads = navigator.getGamepads();
    for (const gp of pads) {
      if (!gp) continue;
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i]?.pressed && captureKey) {
          localButtonMap[captureKey] = i;
          btn.textContent = xboxBtnLabel(i);
          btn.classList.remove('listening');
          captureKey = null;
          captureBtn = null;
          if (capturePollId !== null) clearInterval(capturePollId);
          if (captureTimeoutId !== null) clearTimeout(captureTimeoutId);
          ipcRenderer.invoke('update-button-map', { ...localButtonMap });
          return;
        }
      }
    }
  }, 50);

  captureTimeoutId = window.setTimeout(cancelCapture, 5000);
}

function buildButtonMapTable(): void {
  const table = el('btnMapTable');
  table.innerHTML = '';
  BTN_MAP_LABELS.forEach(({ key, label }) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.textContent = label;
    const tdBtn = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn-assign';
    btn.textContent = xboxBtnLabel(localButtonMap[key]);
    btn.onclick = () => startCapture(key, btn);
    tdBtn.appendChild(btn);
    tr.appendChild(tdLabel);
    tr.appendChild(tdBtn);
    table.appendChild(tr);
  });
}

// ---- Character / costume management ----
function toFileUrl(imgPath: string): string {
  if (!imgPath) return '';
  const abs = path.isAbsolute(imgPath) ? imgPath : path.join(appRoot, imgPath);
  return 'file:///' + abs.replace(/\\/g, '/');
}

function makeBlankCostume(id: string): CostumeConfig {
  return { id, expressions: ['', '', '', '', ''] };
}

function makeBlankCharacter(name: string): CharacterConfig {
  return {
    id: `char_${Date.now()}`,
    name,
    defaultPosition: { x: 960, y: 540 },
    defaultScale: { x: 0.25, y: 0.25 },
    costumes: [makeBlankCostume('default')],
  };
}

function addCharacter(): void {
  saveCurrentCharBasic();
  config.characters.push(makeBlankCharacter(`キャラ${config.characters.length + 1}`));
  currentCharacterIdx = config.characters.length - 1;
  currentCostumeIdx = 0;
  renderCharacterCard();
}

function removeCharacter(idx: number): void {
  if (config.characters.length <= 1) {
    alert('最低1キャラクターが必要です');
    return;
  }
  if (!confirm(`「${config.characters[idx].name}」を削除しますか？`)) return;
  config.characters.splice(idx, 1);
  currentCharacterIdx = Math.min(currentCharacterIdx, config.characters.length - 1);
  currentCostumeIdx = 0;
  renderCharacterCard();
}

function addCostume(): void {
  const ch = config.characters[currentCharacterIdx];
  if (!ch) return;
  ch.costumes.push(makeBlankCostume(`costume${ch.costumes.length + 1}`));
  currentCostumeIdx = ch.costumes.length - 1;
  renderCostumeTabs();
  renderExpressionGrid(currentCostumeIdx);
  renderMouthGrid(currentCostumeIdx);
}

function removeCostume(idx: number): void {
  const ch = config.characters[currentCharacterIdx];
  if (!ch) return;
  if (ch.costumes.length <= 1) {
    alert('最低1衣装が必要です');
    return;
  }
  if (!confirm(`「${ch.costumes[idx].id}」を削除しますか？`)) return;
  ch.costumes.splice(idx, 1);
  currentCostumeIdx = Math.min(currentCostumeIdx, ch.costumes.length - 1);
  renderCostumeTabs();
  renderExpressionGrid(currentCostumeIdx);
  renderMouthGrid(currentCostumeIdx);
}

function renderCharacterTabs(): void {
  const tabsEl = el('charTabs');
  tabsEl.innerHTML = '';
  config.characters.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn${i === currentCharacterIdx ? ' active' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = ch.name;
    btn.appendChild(nameSpan);

    const del = document.createElement('span');
    del.className = 'tab-del';
    del.textContent = '×';
    del.onclick = (e) => { e.stopPropagation(); removeCharacter(i); };
    btn.appendChild(del);

    btn.onclick = () => {
      if (i === currentCharacterIdx) return;
      saveCurrentCharBasic();
      currentCharacterIdx = i;
      currentCostumeIdx = 0;
      renderCharacterCard();
    };
    tabsEl.appendChild(btn);
  });
}

function renderCharacterCard(): void {
  renderCharacterTabs();
  updateCharBasicFields();
  renderCostumeTabs();
  renderExpressionGrid(currentCostumeIdx);
  renderMouthGrid(currentCostumeIdx);
}

function renderCostumeTabs(): void {
  const ch = config.characters[currentCharacterIdx];
  if (!ch) return;
  const tabsEl = el('costumeTabs');
  tabsEl.innerHTML = '';
  ch.costumes.forEach((costume, i) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn${i === currentCostumeIdx ? ' active' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = costume.id;
    btn.appendChild(nameSpan);

    const del = document.createElement('span');
    del.className = 'tab-del';
    del.textContent = '×';
    del.onclick = (e) => { e.stopPropagation(); removeCostume(i); };
    btn.appendChild(del);

    btn.onclick = () => {
      currentCostumeIdx = i;
      renderCostumeTabs();
      renderExpressionGrid(i);
      renderMouthGrid(i);
    };
    tabsEl.appendChild(btn);
  });
}

function createSlot(imgPath: string, label: string, onSet: (p: string) => void): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'expr-slot';

  const thumb = document.createElement('div');
  thumb.className = 'expr-thumb';
  updateThumb(thumb, imgPath);

  const lbl = document.createElement('div');
  lbl.className = 'expr-label';
  lbl.textContent = imgPath ? path.basename(imgPath) : label;

  const applyPath = (p: string): void => {
    onSet(p);
    updateThumb(thumb, p);
    lbl.textContent = p ? path.basename(p) : label;
  };

  slot.onclick = async () => {
    const result = await ipcRenderer.invoke('open-file-dialog') as string | null;
    if (result) applyPath(result);
  };
  slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
  slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
  slot.addEventListener('drop', e => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (file) applyPath((file as any).path);
  });

  slot.appendChild(thumb);
  slot.appendChild(lbl);
  return slot;
}

function renderExpressionGrid(costumeIdx: number): void {
  const costume = config.characters[currentCharacterIdx]?.costumes[costumeIdx];
  if (!costume) return;
  const grid = el('exprGrid');
  grid.innerHTML = '';
  const count = Math.max(costume.expressions.length, 5);
  for (let i = 0; i < count; i++) {
    grid.appendChild(createSlot(
      costume.expressions[i] ?? '',
      `表情 ${i + 1}`,
      p => { config.characters[currentCharacterIdx].costumes[costumeIdx].expressions[i] = p; }
    ));
  }
}

function renderMouthGrid(costumeIdx: number): void {
  const costume = config.characters[currentCharacterIdx]?.costumes[costumeIdx];
  if (!costume) return;
  const grid = el('mouthGrid');
  grid.innerHTML = '';
  grid.appendChild(createSlot(
    costume.mouthOpenPath ?? '',
    '口開け',
    p => { config.characters[currentCharacterIdx].costumes[costumeIdx].mouthOpenPath = p; }
  ));
  grid.appendChild(createSlot(
    costume.mouthClosedPath ?? '',
    '口閉じ',
    p => { config.characters[currentCharacterIdx].costumes[costumeIdx].mouthClosedPath = p; }
  ));
}

function updateThumb(thumbEl: HTMLElement, imgPath: string): void {
  thumbEl.innerHTML = '';
  if (imgPath) {
    const img = document.createElement('img');
    img.src = toFileUrl(imgPath);
    img.onerror = () => { thumbEl.innerHTML = ''; thumbEl.textContent = '?'; };
    thumbEl.appendChild(img);
  } else {
    thumbEl.textContent = '+';
  }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  [config, appRoot] = await Promise.all([
    ipcRenderer.invoke('get-config') as Promise<AppConfig>,
    ipcRenderer.invoke('get-app-root') as Promise<string>,
  ]);

  localButtonMap = { ...config.buttonMap };

  populate();
  loadMicDevices();
  startMicIndicator();
  startGpPolling();
  buildButtonMapTable();
  renderCharacterCard();

  document.querySelectorAll<HTMLInputElement>('input[type=range]').forEach(s => {
    s.addEventListener('input', () => {
      const disp = el(`${s.id}Val`);
      if (disp) disp.textContent = s.value;
    });
  });

  el('refreshGamepads')?.addEventListener('click', populateGamepadList);
  el('addCharBtn').addEventListener('click', addCharacter);
  el('addCostumeBtn').addEventListener('click', addCostume);
  el('saveBtn').addEventListener('click', () => save());
  el('closeBtn').addEventListener('click', () => window.close());
  el('resetStateBtn').addEventListener('click', () => {
    if (confirm('保存済み位置・表情をリセットしますか？')) {
      ipcRenderer.invoke('save-config', { ...config, lastState: undefined });
      alert('リセットしました');
    }
  });
});
