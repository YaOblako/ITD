const { app, BrowserWindow, session, ipcMain, Menu, Tray, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

app.setName('ИТД')
app.setPath('userData', 'C:\\Users\\' + require('os').userInfo().username + '\\AppData\\Roaming\\ИТД')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

Menu.setApplicationMenu(null)

let tray = null

function injectTitlebar(win) {
  const iconBase64 = fs.readFileSync(path.join(__dirname, 'icon.png')).toString('base64')

  win.webContents.insertCSS(`
    ::-webkit-scrollbar { display: none !important; }
    * { scrollbar-width: none !important; }
    #__etb {
      position: fixed; top: 0; left: 0; right: 0; height: 32px;
      background: #111; display: flex; align-items: center;
      z-index: 2147483647; -webkit-app-region: drag;
      user-select: none; font-family: 'Segoe UI', sans-serif; font-size: 12px;
    }
    #__etb * { -webkit-app-region: no-drag; }
    #__etb_title {
      position: absolute; left: 50%; transform: translateX(-50%);
      color: #ffffff; font-size: 12px; pointer-events: none;
    }
    #__etb_ctrl { margin-left: auto; display: flex; height: 100%; }
    .etb_cb {
      width: 46px; height: 100%; display: flex; align-items: center;
      justify-content: center; color: #888; cursor: pointer; transition: background 0.1s;
    }
    .etb_cb:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .etb_cb.etb_x:hover { background: #e81123; color: #fff; }
    .etb_cb svg { width: 10px; height: 10px; }
  `)

  win.webContents.executeJavaScript(`
    (function() {
      if (document.getElementById('__etb')) return;
      document.body.style.paddingTop = '32px';

      const bar = document.createElement('div');
      bar.id = '__etb';

      const logo = document.createElement('img');
      logo.src = 'data:image/png;base64,${iconBase64}';
      logo.style.cssText = 'width:20px;height:20px;border-radius:4px;margin-left:8px;margin-right:6px;pointer-events:none;';

      const title = document.createElement('div');
      title.id = '__etb_title';
      title.textContent = 'ИТД';

      const ctrl = document.createElement('div');
      ctrl.id = '__etb_ctrl';

      [
        ['<svg viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>', '', () => window.electronAPI.minimize()],
        ['<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><rect x=".5" y=".5" width="9" height="9"/></svg>', '', () => window.electronAPI.maximize()],
        ['<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/></svg>', 'etb_x', () => window.electronAPI.close()]
      ].forEach(([html, cls, fn]) => {
        const b = document.createElement('div');
        b.className = 'etb_cb ' + cls;
        b.innerHTML = html;
        b.addEventListener('click', fn);
        ctrl.appendChild(b);
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'F5') window.electronAPI.reload();
        if (e.key === 'F12') window.electronAPI.devtools();
        if (e.key === 'F11') document.documentElement.requestFullscreen?.();
      });

      bar.appendChild(logo);
      bar.appendChild(title);
      bar.appendChild(ctrl);
      document.body.appendChild(bar);
    })();
  `)
}
function createTray(win) {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('ИТД')
  
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'ИТД', icon: nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }), enabled: false },
    { label: 'Гитхаб', click: () => shell.openExternal('https://github.com/YaOblako/ITD/tree/main') },
    { type: 'separator' },
    { label: 'Открыть', click: () => { win.show(); win.focus() } },
    { label: 'Перезагрузить', click: () => win.webContents.reload() },
    { type: 'separator' },
    { label: 'Выйти', click: () => { app.isQuiting = true; app.quit() } }
  ]))
  tray.on('double-click', () => { win.show(); win.focus() })
}

function setupIpc() {
  ipcMain.removeAllListeners('win-minimize')
  ipcMain.removeAllListeners('win-maximize')
  ipcMain.removeAllListeners('win-close')
  ipcMain.removeAllListeners('win-reload')
  ipcMain.removeAllListeners('win-back')
  ipcMain.removeAllListeners('win-forward')
  ipcMain.removeAllListeners('win-devtools')

  ipcMain.on('win-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win-maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    w?.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.on('win-close', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length > 1 && allWindows[0].id !== w.id) {
      w.close()
    } else {
      w.hide()
    }
  })
  ipcMain.on('win-reload', (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.reload())
  ipcMain.on('win-back', (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.goBack())
  ipcMain.on('win-forward', (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.goForward())
  ipcMain.on('win-devtools', (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.toggleDevTools())
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    title: 'ИТД',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f0f0f',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  win.once('ready-to-show', () => win.show())

  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      win.hide()
    }
  })

  createTray(win)
  setupIpc()

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = UA
    details.requestHeaders['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
    details.requestHeaders['sec-ch-ua-mobile'] = '?0'
    details.requestHeaders['sec-ch-ua-platform'] = '"Windows"'
    callback({ requestHeaders: details.requestHeaders })
  })

  win.webContents.on('did-finish-load', () => injectTitlebar(win))
  win.webContents.on('did-navigate', () => injectTitlebar(win))
  win.on('page-title-updated', (e) => e.preventDefault())

  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 1200,
      height: 800,
      minWidth: 400,
      minHeight: 300,
      frame: false,
      backgroundColor: '#0f0f0f',
      show: false,
      icon: path.join(__dirname, 'icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      }
    }
  }))

  win.loadURL('https://итд.com')

  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    const { dialog } = require('electron')
    dialog.showMessageBox({
      type: 'info',
      title: 'Обновление',
      message: 'Доступна новая версия. Обновление...',
      buttons: ['OK']
    })
  })

  autoUpdater.on('update-downloaded', () => {
    const { dialog } = require('electron')
    dialog.showMessageBox({
      type: 'info',
      title: 'Обновление готово',
      message: 'Обновление установится после перезапуска.',
      buttons: ['Перезапустить', 'Позже']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })
}

app.on('browser-window-created', (_, newWin) => {
  newWin.once('ready-to-show', () => newWin.show())
  newWin.webContents.on('did-finish-load', () => injectTitlebar(newWin))
  newWin.webContents.on('did-navigate', () => injectTitlebar(newWin))
  newWin.on('page-title-updated', (e) => e.preventDefault())
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})