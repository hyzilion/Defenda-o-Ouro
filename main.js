const { app, BrowserWindow, Menu, ipcMain, safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SAVE_FILE_NAME = 'save-data.json';
const WINDOW_ICON = path.join(__dirname, 'assets', 'icon.ico');
const IPC_LOAD_ALL = 'defenda-save:load-all';
const IPC_LOAD_ACCOUNT = 'defenda-save:load-account';
const IPC_SAVE_ACCOUNT = 'defenda-save:save-account';
const IPC_LOAD_SETTINGS = 'defenda-save:load-settings';
const IPC_SAVE_SETTINGS = 'defenda-save:save-settings';
const IPC_EXIT_APP = 'defenda-app:exit';
const IPC_SET_FULLSCREEN = 'defenda-window:set-fullscreen';

const DEFAULT_ACCOUNT = Object.freeze({
  level: 1,
  exp: 0,
  coins: 0,
  skins: [0],
  equippedSkin: 0,
  name: '',
  ownedAuras: [],
  equippedAura: -1,
  ownedShots: [],
  equippedShot: -1,
  ownedGolds: [],
  equippedGold: -1,
  ownedKills: [],
  equippedKill: 0,
  ownedNames: [0],
  equippedName: 0
});

const DEFAULT_SETTINGS = Object.freeze({
  music: 1,
  sfx: 1,
  fullscreen: false,
  zoomLevel: null,
  screenShake: true,
  inputMode: 'mouse',
  pauseOnSelect: true,
  autoAdvanceDialog: false
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp01(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function uniqueInts(list, fallback) {
  const src = Array.isArray(list) ? list : fallback;
  const out = [];
  for (const item of src) {
    const num = Number(item);
    if (!Number.isFinite(num)) continue;
    const int = num | 0;
    if (out.indexOf(int) < 0) out.push(int);
  }
  return out.length ? out : clone(fallback);
}

function normalizeAccount(raw) {
  const data = raw && typeof raw === 'object' ? clone(raw) : {};
  const out = clone(DEFAULT_ACCOUNT);

  out.level = Math.max(1, Number.isFinite(Number(data.level)) ? (Number(data.level) | 0) : 1);
  out.exp = Math.max(0, Math.round(Number(data.exp) || 0));
  out.coins = Math.max(0, Math.round(Number(data.coins) || 0));
  out.skins = uniqueInts(data.skins, [0]);
  if (out.skins.indexOf(0) < 0) out.skins.unshift(0);
  out.equippedSkin = Number.isFinite(Number(data.equippedSkin)) ? (Number(data.equippedSkin) | 0) : 0;
  if (out.skins.indexOf(out.equippedSkin) < 0) out.equippedSkin = 0;
  out.name = typeof data.name === 'string' ? data.name : '';

  out.ownedAuras = uniqueInts(data.ownedAuras, []);
  out.equippedAura = Number.isFinite(Number(data.equippedAura)) ? (Number(data.equippedAura) | 0) : -1;

  out.ownedShots = uniqueInts(data.ownedShots, []);
  out.equippedShot = Number.isFinite(Number(data.equippedShot)) ? (Number(data.equippedShot) | 0) : -1;

  out.ownedGolds = uniqueInts(data.ownedGolds, []);
  out.equippedGold = Number.isFinite(Number(data.equippedGold)) ? (Number(data.equippedGold) | 0) : -1;

  out.ownedKills = uniqueInts(data.ownedKills, []);
  out.equippedKill = Number.isFinite(Number(data.equippedKill)) ? (Number(data.equippedKill) | 0) : 0;
  if (out.equippedKill === -1) out.equippedKill = 0;

  out.ownedNames = uniqueInts(data.ownedNames, [0]).filter((value) => value !== 14);
  if (out.ownedNames.indexOf(0) < 0) out.ownedNames.unshift(0);
  out.equippedName = Number.isFinite(Number(data.equippedName)) ? (Number(data.equippedName) | 0) : 0;
  if (out.equippedName === 14 || out.ownedNames.indexOf(out.equippedName) < 0) out.equippedName = 0;

  return out;
}

function normalizeSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const zoomLevel = Number(data.zoomLevel);
  return {
    music: clamp01(data.music, 1),
    sfx: clamp01(data.sfx, 1),
    fullscreen: !!data.fullscreen,
    zoomLevel: Number.isFinite(zoomLevel) && zoomLevel > 0 ? zoomLevel : null,
    screenShake: typeof data.screenShake === 'boolean' ? data.screenShake : true,
    inputMode: data.inputMode === 'keys' ? 'keys' : 'mouse',
    pauseOnSelect: typeof data.pauseOnSelect === 'boolean' ? data.pauseOnSelect : true,
    autoAdvanceDialog: typeof data.autoAdvanceDialog === 'boolean' ? data.autoAdvanceDialog : false
  };
}

function defaultStore() {
  return {
    version: 1,
    account: clone(DEFAULT_ACCOUNT),
    settings: clone(DEFAULT_SETTINGS)
  };
}

function normalizeStore(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    version: 1,
    account: normalizeAccount(data.account),
    settings: normalizeSettings(data.settings)
  };
}

function getSaveFilePath() {
  return path.join(app.getPath('userData'), SAVE_FILE_NAME);
}

function encryptPayload(plaintext) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      version: 1,
      encrypted: true,
      mode: 'safeStorage',
      payload: safeStorage.encryptString(plaintext).toString('base64')
    };
  }

  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update('defenda-o-ouro-save-v1').digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    version: 1,
    encrypted: true,
    mode: 'aes-256-cbc',
    iv: iv.toString('base64'),
    payload: encrypted.toString('base64')
  };
}

function decryptPayload(wrapper) {
  if (!wrapper || typeof wrapper !== 'object') return null;
  if (wrapper.mode === 'safeStorage' && typeof wrapper.payload === 'string') {
    const decrypted = safeStorage.decryptString(Buffer.from(wrapper.payload, 'base64'));
    return JSON.parse(decrypted);
  }
  if (wrapper.mode === 'aes-256-cbc' && typeof wrapper.payload === 'string' && typeof wrapper.iv === 'string') {
    const key = crypto.createHash('sha256').update('defenda-o-ouro-save-v1').digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(wrapper.iv, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(wrapper.payload, 'base64')),
      decipher.final()
    ]).toString('utf8');
    return JSON.parse(decrypted);
  }
  return null;
}

function writeStore(store) {
  const normalized = normalizeStore(store);
  const filePath = getSaveFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(encryptPayload(JSON.stringify(normalized)), null, 2),
    'utf8'
  );
  return normalized;
}

function readStore() {
  const filePath = getSaveFilePath();
  try {
    if (!fs.existsSync(filePath)) return writeStore(defaultStore());

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const decrypted = decryptPayload(parsed);
    if (!decrypted) throw new Error('Invalid save payload');

    const normalized = normalizeStore(decrypted);
    if (JSON.stringify(normalized) !== JSON.stringify(decrypted)) writeStore(normalized);
    return normalized;
  } catch (_) {
    return writeStore(defaultStore());
  }
}

function registerSaveIpc() {
  ipcMain.on(IPC_LOAD_ALL, (event) => {
    event.returnValue = readStore();
  });
  ipcMain.on(IPC_LOAD_ACCOUNT, (event) => {
    event.returnValue = readStore().account;
  });
  ipcMain.on(IPC_SAVE_ACCOUNT, (event, account) => {
    const current = readStore();
    event.returnValue = writeStore({ account, settings: current.settings }).account;
  });
  ipcMain.on(IPC_LOAD_SETTINGS, (event) => {
    event.returnValue = readStore().settings;
  });
  ipcMain.on(IPC_SAVE_SETTINGS, (event, settings) => {
    const current = readStore();
    event.returnValue = writeStore({ account: current.account, settings }).settings;
  });
  ipcMain.on(IPC_EXIT_APP, (event) => {
    event.returnValue = true;
    app.quit();
  });
  ipcMain.on(IPC_SET_FULLSCREEN, (event, on) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      event.returnValue = false;
      return;
    }
    win.setFullScreen(!!on);
    event.returnValue = win.isFullScreen();
  });
}

function createWindow() {
  const store = readStore();
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: WINDOW_ICON,
    fullscreen: !!(store && store.settings && store.settings.fullscreen),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  readStore();
  registerSaveIpc();
  createWindow();
});
