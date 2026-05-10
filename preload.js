const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),
  reload: () => ipcRenderer.send('win-reload'),
  goBack: () => ipcRenderer.send('win-back'),
  goForward: () => ipcRenderer.send('win-forward'),
  devtools: () => ipcRenderer.send('win-devtools'),
})