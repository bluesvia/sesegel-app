const { app, BrowserWindow, Tray, Menu, nativeImage, shell, session, dialog, ipcMain, desktopCapturer } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;
let tray = null;
let isCheckingForUpdates = false;
let isDownloadingUpdate = false;
let updatePromptedVersion = null;
let updateCheckSource = 'startup';

// Tek instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'SeseGel',
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#1e1810', symbolColor: '#ffffff', height: 40 },
    backgroundColor: '#1a1209',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Tüm izinlere izin ver (mikrofon, WebRTC)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  // CSP kaldır
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"]
      }
    });
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    // 3 saniye sonra güncelleme kontrol et
    if (app.isPackaged) {
      setTimeout(() => checkForAppUpdates('startup'), 3000);
    }
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Ctrl+Shift+I = DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.openDevTools();
    }
  });
}

function notifyRenderer(message) {
  mainWindow?.webContents.executeJavaScript(
    `if(window.toast) toast(${JSON.stringify(message)});`
  ).catch(() => {});
}

async function checkForAppUpdates(source = 'manual') {
  if (!app.isPackaged || isCheckingForUpdates) return false;
  isCheckingForUpdates = true;
  updateCheckSource = source;
  if (source === 'manual') notifyRenderer('Guncellemeler kontrol ediliyor...');
  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch (error) {
    log.error('Update check failed:', error);
    notifyRenderer('Guncelleme kontrolu basarisiz oldu.');
    return false;
  } finally {
    isCheckingForUpdates = false;
  }
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
    tray = new Tray(icon);
    const menu = Menu.buildFromTemplate([
      { label: "SeseGel'i Aç", click: () => { mainWindow.show(); mainWindow.focus(); } },
      { label: 'Güncelleme Kontrol Et', click: () => { checkForAppUpdates('manual'); } },
      { type: 'separator' },
      { label: `v${app.getVersion()}`, enabled: false },
      { type: 'separator' },
      { label: 'Çıkış', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip(`SeseGel v${app.getVersion()}`);
    tray.setContextMenu(menu);
    tray.on('click', () => {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    });
  } catch(e) { log.error('Tray error:', e); }
}

// Auto updater olayları
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  if (updatePromptedVersion === info.version || isDownloadingUpdate) return;
  updatePromptedVersion = info.version;
  const result = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: 'Guncelleme Bulundu',
    message: `Yeni surum hazir: v${info.version}`,
    detail: 'Simdi indirip hazirlamak ister misin?',
    buttons: ['Guncelle', 'Sonra'],
    defaultId: 0,
    cancelId: 1,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  if (result !== 0) return;
  isDownloadingUpdate = true;
  notifyRenderer(`Guncelleme indiriliyor: v${info.version}`);
  autoUpdater.downloadUpdate().catch((error) => {
    isDownloadingUpdate = false;
    log.error('Update download failed:', error);
    notifyRenderer('Guncelleme indirilemedi.');
  });
});

autoUpdater.on('update-not-available', () => {
  if (updateCheckSource === 'manual') {
    notifyRenderer('Bu surum zaten guncel.');
  }
});

autoUpdater.on('download-progress', (p) => {
  const pct = Math.round(p.percent);
  mainWindow?.setProgressBar(pct / 100);
  notifyRenderer(`Indiriliyor: %${pct}`);
});

autoUpdater.on('update-downloaded', (info) => {
  isDownloadingUpdate = false;
  mainWindow?.setProgressBar(-1);
  const res = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: 'Guncelleme Hazir',
    message: `Yeni versiyon: v${info.version}`,
    detail: 'Simdi yeniden baslatip guncellemeyi kurmak ister misin?',
    buttons: ['Simdi Guncelle', 'Sonra'],
    defaultId: 0,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  if (res === 0) { app.isQuitting = true; autoUpdater.quitAndInstall(); }
});

autoUpdater.on('error', (e) => {
  isDownloadingUpdate = false;
  log.error('AutoUpdater error:', e);
});

// WebRTC için gerekli bayraklar
app.commandLine.appendSwitch('enable-features', 'WebRTC');
app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '100');
app.commandLine.appendSwitch('disable-web-security');

ipcMain.removeHandler('desktop:get-sources');
ipcMain.handle('desktop:get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 0, height: 0 }
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    display_id: s.display_id || ''
  }));
});

ipcMain.removeHandler('app:check-for-updates');
ipcMain.handle('app:check-for-updates', async () => checkForAppUpdates('manual'));

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => { mainWindow.show(); mainWindow.focus(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { app.isQuitting = true; });
