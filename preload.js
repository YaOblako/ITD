const { contextBridge, ipcRenderer } = require('electron')

const OriginalNotification = window.Notification

window.Notification = function(title, options = {}) {
  ipcRenderer.send('site-notification', { title, body: options.body || '', icon: options.icon || ''})
  return new OriginalNotification(title, options)
}
window.Notification.permission = 'granted'
window.Notification.requestPermission = async () => 'granted'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),
  reload: () => ipcRenderer.send('win-reload'),
  goBack: () => ipcRenderer.send('win-back'),
  goForward: () => ipcRenderer.send('win-forward'),
  devtools: () => ipcRenderer.send('win-devtools'),
})