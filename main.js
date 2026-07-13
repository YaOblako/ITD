process.title = 'ИТД'

const { app, BrowserWindow, session, ipcMain, Notification, Menu, Tray, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { autoUpdater } = require('electron-updater')

app.commandLine.appendSwitch('js-flags', '--expose-gc')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService')
app.commandLine.appendSwitch('disable-breakpad')
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

app.setName('ИТД')
app.setAppUserModelId('com.itd.app')
app.setPath('userData', path.join(app.getPath('appData'), 'ИТД'))

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
  } catch {
    return { autoUpdateEnabled: true }
  }
}

function saveSettings(settings) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8')
  } catch (e) {}
}

let settings = loadSettings()
let tray = null

const chromeVersion = process.versions.chrome;
const majorVersion = chromeVersion.split('.')[0];
const cleanUA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

app.userAgentFallback = cleanUA;

Menu.setApplicationMenu(null)

app.on('second-instance', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length > 0) {
    const w = allWindows[0]
    if (w.isMinimized()) w.restore()
    w.show()
    w.focus()
  }
})

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

async function clearMemory(silent = false) {
  try {
    if (global.gc) {
      global.gc()
      global.gc()
      global.gc()
    }

    const wins = BrowserWindow.getAllWindows()
    await Promise.all(wins.map(w =>
      w.webContents.executeJavaScript('if(window.gc){window.gc();window.gc();}').catch(() => {})
    ))

    await session.defaultSession.clearCache()
    await session.defaultSession.clearHostResolverCache()

    if (process.platform === 'win32') {
      const pids = [process.pid, ...wins.map(w => w.webContents.getOSProcessId()).filter(Boolean)]
      const typeDef = 'using System;using System.Runtime.InteropServices;public class M{[DllImport(\\"psapi.dll\\")]public static extern bool EmptyWorkingSet(IntPtr h);[DllImport(\\"kernel32.dll\\")]public static extern IntPtr OpenProcess(uint d,bool i,int p);[DllImport(\\"kernel32.dll\\")]public static extern bool CloseHandle(IntPtr h);}'
      const loop = `foreach($p in @(${pids.join(',')})){$h=[M]::OpenProcess(1024,$false,$p);if($h -ne [IntPtr]::Zero){[M]::EmptyWorkingSet($h);[M]::CloseHandle($h)}}`
      exec(`powershell -NoProfile -NonInteractive -Command "Add-Type -TypeDefinition '${typeDef}'; ${loop}"`, { windowsHide: true }, () => {})
    } 
  } catch (e) {
    if (!silent) console.error(e)
  }
}

setInterval(() => clearMemory(true), 1000 * 60 * 30)

function buildTrayMenu(win) {
  return Menu.buildFromTemplate([
    { label: 'ИТД', icon: nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }), enabled: false },
    { label: 'Гитхаб', click: () => shell.openExternal('https://github.com/YaOblako/ITD/') },
    { type: 'separator' },
    { label: 'Открыть', click: () => { win.show(); win.focus() } },
    { label: 'Перезагрузить', click: () => win.webContents.reload() },
    { type: 'separator' },
    {
      label: settings.autoUpdateEnabled ? 'Автообновления: Вкл' : 'Автообновления: Выкл',
      click: () => {
        settings.autoUpdateEnabled = !settings.autoUpdateEnabled
        saveSettings(settings)
        tray.setContextMenu(buildTrayMenu(win))
      }
    },
    {
      label: 'Проверить обновления',
      click: () => {
        if (!app.isPackaged) {
          new Notification({ title: 'ИТД', body: 'Проверка обновлений недоступна в дев режиме' }).show()
          return
        }
        autoUpdater.checkForUpdates()
      }
    },
    { type: 'separator' },
    { label: 'Выйти', click: () => { app.isQuiting = true; app.quit() } }
  ])
}

function createTray(win) {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }))
  tray.setToolTip('ИТД')
  tray.setContextMenu(buildTrayMenu(win))
  tray.on('double-click', () => { win.show(); win.focus() })
}

function setupUpdater() {
  if (!app.isPackaged) return
  if (settings.autoUpdateEnabled) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }

  autoUpdater.on('update-available', (info) => {
    new Notification({ title: 'ИТД', body: `Доступна версия ${info.version}, скачивание...`}).show()
  })

  autoUpdater.on('update-not-available', () => {
    new Notification({ title: 'ИТД', body: 'У вас уже последняя версия'}).show()
  })

  autoUpdater.on('error', () => {
    new Notification({ title: 'ИТД', body: 'Ошибка проверки обновлений'}).show()
  })

  autoUpdater.on('update-downloaded', (info) => {
    const n = new Notification({ title: 'ИТД', body: `Версия ${info.version} готова. Установить?`})
    n.on('click', () => autoUpdater.quitAndInstall())
    n.show()
  })
}

function setupIpc() {
  const events = {
    'win-minimize': (e) => BrowserWindow.fromWebContents(e.sender)?.minimize(),
    'win-maximize': (e) => {
      const w = BrowserWindow.fromWebContents(e.sender)
      w?.isMaximized() ? w.unmaximize() : w.maximize()
    },
    'win-close': (e) => {
      const w = BrowserWindow.fromWebContents(e.sender)
      if (!w) return
      BrowserWindow.getAllWindows().length > 1 ? w.close() : w.hide()
    },
    'win-reload': (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.reload(),
    'win-back': (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.goBack(),
    'win-forward': (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.goForward(),
    'win-devtools': (e) => BrowserWindow.fromWebContents(e.sender)?.webContents.toggleDevTools(),
    'site-notification': (_, { title, body, icon }) => {
      new Notification({ title, body, icon: icon || path.join(__dirname, 'icon.png') }).show()
    }
  }
  Object.entries(events).forEach(([name, fn]) => {
    ipcMain.removeAllListeners(name)
    ipcMain.on(name, fn)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, frame: false,
    title: 'ИТД', icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f0f0f', show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      sandbox: false, preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: true,
      devTools: true
    }
  })

  win.once('ready-to-show', () => win.show())
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      win.hide()
      clearMemory(true)
    }
  })

  createTray(win)
  setupIpc()
  setupUpdater()

  session.defaultSession.setPreloads([path.join(__dirname, 'preload.js')])

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = cleanUA
    details.requestHeaders['sec-ch-ua'] = `"Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}", "Not-A.Brand";v="99"`
    details.requestHeaders['sec-ch-ua-mobile'] = '?0'
    details.requestHeaders['sec-ch-ua-platform'] = '"Windows"'
    
    if (details.requestHeaders['sec-ch-ua-full-version-list']) {
        delete details.requestHeaders['sec-ch-ua-full-version-list'];
    }

    callback({ requestHeaders: details.requestHeaders })
  })

  const handleWin = (w) => {
    w.webContents.on('did-finish-load', () => injectTitlebar(w))
    w.webContents.on('did-navigate', () => injectTitlebar(w))
    w.on('page-title-updated', (e) => e.preventDefault())
  }

  handleWin(win)

  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 800, height: 800, frame: false,
      backgroundColor: '#0f0f0f', show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
    }
  }))

  win.loadURL('https://итд.com')
}

app.on('browser-window-created', (_, w) => {
  w.once('ready-to-show', () => w.show())
  w.webContents.on('did-finish-load', () => injectTitlebar(w))
  w.webContents.on('did-navigate', () => injectTitlebar(w))
  w.on('page-title-updated', (e) => e.preventDefault())
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => { 
  if (process.platform !== 'darwin') app.quit() 
})

app.on('activate', () => { 
  if (BrowserWindow.getAllWindows().length === 0) createWindow() 
})