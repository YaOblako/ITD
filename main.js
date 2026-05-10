const { app, BrowserWindow, session, ipcMain, Menu } = require('electron')
const path = require('path')

app.setName('ИТД')
app.setPath('userData', 'C:\\Users\\' + require('os').userInfo().username + '\\AppData\\Roaming\\ИТД')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

Menu.setApplicationMenu(null)

function injectTitlebar(win) {
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
      color: #555; font-size: 12px; pointer-events: none;
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

      bar.appendChild(title);
      bar.appendChild(ctrl);
      document.body.appendChild(bar);
    })();
  `)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    title: 'ИТД',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  ipcMain.on('win-minimize', () => win.minimize())
  ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
  ipcMain.on('win-close', () => win.close())
  ipcMain.on('win-reload', () => win.webContents.reload())
  ipcMain.on('win-back', () => win.webContents.goBack())
  ipcMain.on('win-forward', () => win.webContents.goForward())
  ipcMain.on('win-devtools', () => win.webContents.toggleDevTools())

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = UA
    details.requestHeaders['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
    details.requestHeaders['sec-ch-ua-mobile'] = '?0'
    details.requestHeaders['sec-ch-ua-platform'] = '"Windows"'
    callback({ requestHeaders: details.requestHeaders })
  })

  win.webContents.on('did-finish-load', () => injectTitlebar(win))
  win.webContents.on('did-navigate', () => injectTitlebar(win))

  win.loadURL('https://итд.com')
  win.on('page-title-updated', (e) => e.preventDefault())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})