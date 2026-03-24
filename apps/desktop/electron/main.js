/**
 * MFO Nexus Desktop — Electron Main Process
 *
 * Creates the browser window and loads the split-panel UI.
 * WhatsApp Web requires <webview> tag support (bypasses X-Frame-Options).
 */

const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');

// ── Spoof user-agent BEFORE any window opens ────────────────────────────────
// WhatsApp Web detects "Electron" in the UA and shows a "Get WhatsApp for
// Windows" degraded experience. We replace with a plain Chrome UA globally.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

app.userAgentFallback = CHROME_UA;

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

  // ── Intercept ALL outgoing requests to WhatsApp ────────────────────────────
  // Strip "Electron" and "node.js" from any request header WhatsApp inspects.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.whatsapp.com/*', '*://*.whatsapp.net/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      // Replace UA in every request to WhatsApp
      headers['User-Agent'] = CHROME_UA;
      // Remove dead-giveaway Electron headers
      delete headers['X-Electron-Version'];
      callback({ requestHeaders: headers });
    }
  );

  // Open external links in the system browser, but BLOCK WhatsApp's
  // "Download our app" redirect (wa.me/download, etc.)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/whatsapp\.com|wa\.me/.test(url)) return { action: 'deny' };
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
