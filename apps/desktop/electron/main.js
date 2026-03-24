/**
 * MFO Nexus Desktop — Electron Main Process
 *
 * Creates the browser window and loads the split-panel UI.
 * WhatsApp Web requires <webview> tag support (bypasses X-Frame-Options).
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

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
      webviewTag:       true,        // ← required for WhatsApp Web bypass
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Remove menu bar for a cleaner look
  win.setMenuBarVisibility(false);

  win.loadFile(path.join(__dirname, 'index.html'));

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

// ── IPC: allow renderer to open WhatsApp chat by phone number ─────────────────
ipcMain.on('open-whatsapp-chat', (event, phoneNumber) => {
  if (win) {
    win.webContents.send('navigate-whatsapp', `https://web.whatsapp.com/send?phone=${phoneNumber}`);
  }
});
