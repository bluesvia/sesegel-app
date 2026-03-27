const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  getDesktopSources: () => ipcRenderer.invoke('desktop:get-sources'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
});const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  getDesktopSources: () => ipcRenderer.invoke('desktop:get-sources'),
});
