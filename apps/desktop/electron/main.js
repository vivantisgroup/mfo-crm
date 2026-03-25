/**
 * MFO Nexus Desktop — Electron Main Process
 *
 * Creates the browser window and loads the CRM web app.
 */

const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');

// Spoof a standard Chrome user-agent so webviews aren't blocked by sites
// that detect Electron's default UA (e.g. WhatsApp Web, some SSO providers)
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Enforce single instance — focus existing window if already running
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width:  1600,
    height: 960,
    minWidth:  900,
    minHeight: 600,
    title: 'MFO Nexus',
    backgroundColor: '#0f1117',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      webviewTag:       true,   // required for <webview> in index.html
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Remove menu bar for a cleaner look
  win.setMenuBarVisibility(false);

  win.loadFile(path.join(__dirname, 'index.html'));

  // Apply spoofed UA to every request in the default session
  // (covers both the BrowserWindow and any <webview> spawned inside it)
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = CHROME_UA;
    callback({ requestHeaders: details.requestHeaders });
  });

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

// Focus existing window on second instance launch
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
