const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, protected APIs to renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  getArch: () => ipcRenderer.invoke('app:get-arch'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // Native System Utilities
  showNotification: (payload) => ipcRenderer.send('system:show-notification', payload),
  openExternal: (url) => ipcRenderer.send('system:open-external', url)
});
