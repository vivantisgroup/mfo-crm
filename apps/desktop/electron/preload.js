/**
 * Preload script — runs in renderer context with Node access before page loads.
 * Exposes a safe, minimal IPC bridge so the shell HTML can communicate
 * with the main process without exposing raw Node.js APIs.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Tell Electron to navigate the WhatsApp webview to a specific phone number.
   * Called from the CRM panel (once IPC is wired in the web app).
   */
  openWhatsAppChat: (phoneNumber) => {
    ipcRenderer.send('open-whatsapp-chat', phoneNumber);
  },

  /**
   * Receive navigation commands from the main process (e.g. focus WhatsApp panel).
   */
  onNavigateWhatsApp: (callback) => {
    ipcRenderer.on('navigate-whatsapp', (_event, url) => callback(url));
  },
});
