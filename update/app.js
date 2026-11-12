const { app, BrowserWindow, session, shell, Menu } = require('electron');
const path = require('path');

// Loaded by main.js (the small loader). `dir` is where the page files live: the app bundle,
// or a newer copy downloaded by the auto-updater. `version` is the version of that copy.
let dir = __dirname, version = app.getVersion(), onReady = () => {};
function pagePath() { return path.join(dir, 'index.html'); }

// Adobe-style splash: a small frameless window with artwork, shown while the main window loads
function createSplash() {
  const splash = new BrowserWindow({
    width: 760, height: 440, frame: false, transparent: true, resizable: false, movable: true,
    show: false, center: true, alwaysOnTop: true, skipTaskbar: true, hasShadow: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  splash.loadFile(path.join(dir, 'splash.html'), { query: { v: version } });
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function createWindow(splash) {
  const shownAt = Date.now();
  const win = new BrowserWindow({
    show: !splash,
    width: 1440, height: 920, minWidth: 900, minHeight: 600,
    backgroundColor: '#0c0c0d',
    // no separate system title bar: the traffic lights sit inside the app's own toolbar
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 19 },
    title: 'PhotoGo',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadFile(pagePath(), { query: { app: process.platform === 'darwin' ? 'mac' : 'desktop' } });
  if (splash) {
    let handedOver = false;
    const handOver = async () => {
      if (handedOver) return; handedOver = true;
      // keep the splash up long enough to be seen, even when the page loads instantly
      const wait = Math.max(0, 2400 - (Date.now() - shownAt));
      await new Promise(r => setTimeout(r, wait));
      if (!splash.isDestroyed()) {
        await splash.webContents.executeJavaScript('done()').catch(() => {});
        await new Promise(r => setTimeout(r, 350));
        await splash.webContents.executeJavaScript('leave()').catch(() => {});
        await new Promise(r => setTimeout(r, 260));
      }
      win.show(); win.focus(); onReady();
      if (!splash.isDestroyed()) splash.close();
    };
    win.once('ready-to-show', handOver);
    // never leave the user staring at the splash if the page is slow
    setTimeout(handOver, 8000);
  }
  if (!splash) win.once('ready-to-show', () => onReady());
  // open external links in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

exports.start = (opts) => {
  dir = opts.dir; version = opts.version; onReady = opts.onReady || onReady;
app.whenReady().then(() => {
  // the page reads/writes the folder the user picks (SD card), so allow file system access
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['fileSystem', 'fullscreen', 'clipboard-sanitized-write'].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ['fileSystem', 'fullscreen'].includes(perm));

  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ label: 'PhotoGo', submenu: [
      { role: 'about', label: '关于 PhotoGo' }, { type: 'separator' },
      { role: 'hide', label: '隐藏' }, { role: 'hideOthers', label: '隐藏其他' }, { type: 'separator' },
      { role: 'quit', label: '退出 PhotoGo' }] }] : []),
    { label: '编辑', submenu: [{ role: 'copy', label: '拷贝' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
    { label: '显示', submenu: [{ role: 'reload', label: '重新载入' }, { role: 'togglefullscreen', label: '全屏' },
      { type: 'separator' }, { role: 'toggleDevTools', label: '开发者工具' }] },
    { role: 'windowMenu', label: '窗口' },
  ]));

  createWindow(createSplash());
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

};

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
