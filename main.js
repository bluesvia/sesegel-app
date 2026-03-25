const { app, BrowserWindow, Tray, Menu, nativeImage, shell, session, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow = null;
let tray = null;

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
    titleBarOverlay: { color: '#0f0f17', symbolColor: '#a8a8c8', height: 32 },
    backgroundColor: '#0f0f17',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      backgroundThrottling: false,
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
      setTimeout(() => autoUpdater.checkForUpdates().catch(e => log.error(e)), 3000);
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

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
    tray = new Tray(icon);
    const menu = Menu.buildFromTemplate([
      { label: "SeseGel'i Aç", click: () => { mainWindow.show(); mainWindow.focus(); } },
      { label: 'Güncelleme Kontrol Et', click: () => { if (app.isPackaged) autoUpdater.checkForUpdates().catch(e => log.error(e)); } },
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
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.executeJavaScript(
    `if(window.toast) toast('🔄 Güncelleme indiriliyor: v${info.version}');`
  ).catch(() => {});
});

autoUpdater.on('download-progress', (p) => {
  const pct = Math.round(p.percent);
  mainWindow?.setProgressBar(pct / 100);
  mainWindow?.webContents.executeJavaScript(
    `if(window.toast) toast('⬇️ İndiriliyor: %${pct}');`
  ).catch(() => {});
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.setProgressBar(-1);
  const res = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: 'Güncelleme Hazır',
    message: `Yeni versiyon: v${info.version}`,
    detail: 'Şimdi yeniden başlatarak güncellemek ister misin?',
    buttons: ['Şimdi Güncelle', 'Sonra'],
    defaultId: 0,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  if (res === 0) { app.isQuitting = true; autoUpdater.quitAndInstall(); }
});

autoUpdater.on('error', (e) => log.error('AutoUpdater error:', e));

// WebRTC stabilite için gerekli bayraklar
app.commandLine.appendSwitch('enable-features', 'WebRTC,WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '70');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('enable-webrtc-hide-local-ips-with-mdns', 'false');
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-FlexFec-03-Advertised/Enabled/WebRTC-FlexFec-03/Enabled/');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => { mainWindow.show(); mainWindow.focus(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { app.isQuitting = true; });
