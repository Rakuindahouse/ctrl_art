import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import { ConfigManager } from './configManager';
import { AppConfig } from '../types';

const configManager = new ConfigManager();
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let monitorWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  const cfg = configManager.getConfig();

  mainWindow = new BrowserWindow({
    width: cfg.window.width,
    height: cfg.window.height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: cfg.window.alwaysOnTop,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    skipTaskbar: false,
    title: 'Standing Picture Controller',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      { label: '設定を開く', click: () => createSettingsWindow() },
      { label: '入力モニター', click: () => createMonitorWindow() },
      { label: 'デバッグツール', click: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }) },
      { type: 'separator' },
      { label: '終了', click: () => app.quit() },
    ]);
    menu.popup({ window: mainWindow ?? undefined });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  // メインウィンドウを一時的に最前面解除して設定ウィンドウを操作可能にする
  mainWindow?.setAlwaysOnTop(false);

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 850,
    resizable: true,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    title: '設定 — Standing Picture Controller',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
  settingsWindow.setMenu(null);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // 設定ウィンドウが閉じたらメインウィンドウのalwaysOnTopを復元
    const cfg = configManager.getConfig();
    if (mainWindow) mainWindow.setAlwaysOnTop(cfg.window.alwaysOnTop);
  });
}

function createMonitorWindow(): void {
  if (monitorWindow) { monitorWindow.focus(); return; }
  monitorWindow = new BrowserWindow({
    width: 240,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    title: '入力モニター',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  monitorWindow.loadFile(path.join(__dirname, '../renderer/input-monitor.html'));
  monitorWindow.on('closed', () => { monitorWindow = null; });
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args);
  }
}

// ---- IPC handlers ----

ipcMain.handle('get-config', () => configManager.getConfig());

ipcMain.handle('save-config', (_event, config: AppConfig) => {
  configManager.saveConfig(config);
  broadcast('config-updated', config);

  // Apply window settings immediately
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(config.window.alwaysOnTop);
    const [w, h] = mainWindow.getSize();
    if (w !== config.window.width || h !== config.window.height) {
      mainWindow.setSize(config.window.width, config.window.height);
    }
  }
  return { success: true };
});

// Silent auto-save (no broadcast, no toast)
ipcMain.handle('save-state', (_event, config: AppConfig) => {
  configManager.saveConfig(config);
  return { success: true };
});

// リアルタイムボタンマップ更新（設定ウィンドウからキャプチャ成功時）
ipcMain.handle('update-button-map', (_event, bm) => {
  mainWindow?.webContents.send('button-map-updated', bm);
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('get-app-root', () => configManager.getAppRoot());

ipcMain.on('input-action', (_e, label: string, category: string) => {
  monitorWindow?.webContents.send('input-action', label, category);
});

ipcMain.handle('open-monitor', () => createMonitorWindow());

ipcMain.handle('open-settings', () => createSettingsWindow());

ipcMain.handle('close-settings', () => {
  settingsWindow?.close();
});

// ---- App lifecycle ----

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
